import os
import stripe
from flask import Blueprint, jsonify, request
from auth import get_current_user, token_required
from model import Address, Order, OrderItem, Product, db

payment_bp = Blueprint("payment", __name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")


def _validate_order_items(items):
    """Validate and resolve order items from product IDs."""
    if not isinstance(items, list) or not items:
        return None, {"error": "Order items are required"}

    cleaned = []
    product_ids = []

    for item in items:
        if not isinstance(item, dict):
            return None, {"error": "Each item must be an object"}
        try:
            product_id = int(item.get("product_id"))
            quantity = int(item.get("quantity"))
        except (TypeError, ValueError):
            return None, {"error": "Invalid product_id or quantity"}
        if quantity <= 0:
            return None, {"error": "Quantity must be at least 1"}
        product_ids.append(product_id)
        cleaned.append({"product_id": product_id, "quantity": quantity})

    products = Product.query.filter(Product.id.in_(product_ids)).all()
    product_map = {p.id: p for p in products}

    for item in cleaned:
        product = product_map.get(item["product_id"])
        if product is None:
            return None, {"error": f"Product {item['product_id']} not found"}
        item["product"] = product

    return cleaned, None


@payment_bp.route("/api/payments/create-intent", methods=["POST"])
@token_required
def create_payment_intent():
    """
    Create a Stripe PaymentIntent for the given cart items + shipping address.
    Returns { clientSecret, orderId } to the frontend.
    """
    if not request.is_json:
        return jsonify({"error": "Expected JSON body"}), 400

    data = request.get_json(silent=True) or {}

    # Validate address
    try:
        address_id = int(data.get("address_id"))
    except (TypeError, ValueError):
        return jsonify({"error": "A valid shipping address is required"}), 400

    # Validate items
    items, err = _validate_order_items(data.get("items"))
    if err:
        return jsonify(err), 400

    user = get_current_user()

    # Confirm address belongs to user
    address = Address.query.filter_by(id=address_id, user_id=user.id).first()
    if address is None:
        return jsonify({"error": "Shipping address not found"}), 404

    # Calculate total (in cents for Stripe)
    total_amount = sum(item["product"].price * item["quantity"] for item in items)
    amount_cents = round(total_amount * 100)

    if amount_cents < 50:
        return jsonify({"error": "Order total is too small to process"}), 400

    # Build line-item metadata for the webhook
    items_meta = ",".join(
        f"{item['product_id']}:{item['quantity']}" for item in items
    )

    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            automatic_payment_methods={"enabled": True},
            metadata={
                "user_id": str(user.id),
                "address_id": str(address_id),
                "items": items_meta,
            },
        )
    except stripe.error.StripeError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify(
        {
            "clientSecret": intent.client_secret,
            "amount": total_amount,
            "currency": "usd",
        }
    ), 200


@payment_bp.route("/api/payments/webhook", methods=["POST"])
def stripe_webhook():
    """
    Stripe sends a signed POST here after a payment succeeds.
    We fulfil the order here so the frontend never has to trust itself.
    """
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature", "")

    # Verify the webhook signature when a secret is configured
    if WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)
        except stripe.error.SignatureVerificationError:
            return jsonify({"error": "Invalid signature"}), 400
    else:
        # Development fallback – parse without verification
        import json
        event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        meta = intent["metadata"]

        try:
            user_id = int(meta["user_id"])
            address_id = int(meta["address_id"])
            items_meta = meta["items"]  # "product_id:qty,product_id:qty"
        except (KeyError, ValueError):
            # Malformed metadata – acknowledge but take no action
            return jsonify({"received": True}), 200

        # Prevent duplicate fulfilment
        existing = Order.query.filter_by(
            user_id=user_id,
            address_id=address_id,
        ).filter(Order.payment_intent_id == intent["id"]).first()

        if existing:
            return jsonify({"received": True}), 200

        # Parse items
        raw_items = []
        for entry in items_meta.split(","):
            try:
                pid, qty = entry.split(":")
                raw_items.append({"product_id": int(pid), "quantity": int(qty)})
            except ValueError:
                pass

        if not raw_items:
            return jsonify({"received": True}), 200

        product_ids = [i["product_id"] for i in raw_items]
        products = Product.query.filter(Product.id.in_(product_ids)).all()
        product_map = {p.id: p for p in products}

        total_amount = intent["amount"] / 100  # convert cents back

        order = Order(
            user_id=user_id,
            address_id=address_id,
            total_amount=total_amount,
            payment_intent_id=intent["id"],
        )
        db.session.add(order)
        db.session.flush()

        for item in raw_items:
            product = product_map.get(item["product_id"])
            if product is None:
                continue
            db.session.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    product_name=product.name,
                    product_image=product.image,
                    unit_price=product.price,
                    quantity=item["quantity"],
                )
            )

        db.session.commit()

    return jsonify({"received": True}), 200


@payment_bp.route("/api/payments/confirm-order", methods=["POST"])
@token_required
def confirm_order():
    """
    Called by the frontend after Stripe confirms payment on the client side.
    Creates the order record immediately (webhook is the reliable path;
    this gives instant feedback in the UI).
    """
    if not request.is_json:
        return jsonify({"error": "Expected JSON body"}), 400

    data = request.get_json(silent=True) or {}
    payment_intent_id = data.get("payment_intent_id", "").strip()

    if not payment_intent_id:
        return jsonify({"error": "payment_intent_id is required"}), 400

    # Verify the PaymentIntent with Stripe
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
    except stripe.error.StripeError as exc:
        return jsonify({"error": str(exc)}), 502

    if intent.status != "succeeded":
        return jsonify({"error": f"Payment not completed (status: {intent.status})"}), 402
    
    meta = intent["metadata"]
    user = get_current_user()

    try:
        user_id = int(meta["user_id"])
        address_id = int(meta["address_id"])
        items_meta = meta["items"]
    except (KeyError, ValueError):
        return jsonify({"error": "Invalid payment metadata"}), 400

    if user_id != user.id:
        return jsonify({"error": "Unauthorized"}), 403

    # Idempotent – return existing order if already created by webhook
    existing = Order.query.filter_by(
        user_id=user_id,
        payment_intent_id=payment_intent_id,
    ).first()

    if existing:
        return jsonify({"order": existing.to_dict(), "message": "Order already exists"}), 200

    address = Address.query.filter_by(id=address_id, user_id=user_id).first()
    if address is None:
        return jsonify({"error": "Address not found"}), 404

    # Parse items
    raw_items = []
    for entry in items_meta.split(","):
        try:
            pid, qty = entry.split(":")
            raw_items.append({"product_id": int(pid), "quantity": int(qty)})
        except ValueError:
            pass

    product_ids = [i["product_id"] for i in raw_items]
    products = Product.query.filter(Product.id.in_(product_ids)).all()
    product_map = {p.id: p for p in products}

    total_amount = intent.amount / 100

    order = Order(
        user_id=user_id,
        address_id=address_id,
        total_amount=total_amount,
        payment_intent_id=payment_intent_id,
    )
    db.session.add(order)
    db.session.flush()

    for item in raw_items:
        product = product_map.get(item["product_id"])
        if product is None:
            continue
        db.session.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name=product.name,
                product_image=product.image,
                unit_price=product.price,
                quantity=item["quantity"],
            )
        )

    db.session.commit()
    return jsonify({"order": order.to_dict(), "message": "Order placed successfully"}), 201

from flask import Blueprint, jsonify, request

from auth import get_current_user, token_required
from model import Address, Order, OrderItem, Product, WishlistItem, db

profile_bp = Blueprint("profile", __name__)


def validate_address_payload(data):
    if not isinstance(data, dict):
        return None, {"error": "Invalid JSON object"}

    required_fields = ("full_name", "phone", "line1", "city", "state", "postal_code", "country")
    cleaned = {}
    errors = {}

    for field in required_fields:
        value = data.get(field)
        if not isinstance(value, str) or not value.strip():
            errors[field] = "This field is required"
        else:
            cleaned[field] = value.strip()

    line2 = data.get("line2")
    if line2 is None:
        cleaned["line2"] = None
    elif not isinstance(line2, str):
        errors["line2"] = "Line 2 must be a string"
    else:
        cleaned["line2"] = line2.strip() or None

    cleaned["is_default"] = bool(data.get("is_default"))

    if errors:
        return None, {"errors": errors}

    return cleaned, None


def validate_order_items(items):
    if not isinstance(items, list) or not items:
        return None, {"error": "Order items are required"}

    product_ids = []
    cleaned_items = []

    for item in items:
        if not isinstance(item, dict):
            return None, {"error": "Each order item must be an object"}

        product_id = item.get("product_id")
        quantity = item.get("quantity")

        try:
            product_id = int(product_id)
            quantity = int(quantity)
        except (TypeError, ValueError):
            return None, {"error": "Invalid product_id or quantity"}

        if quantity <= 0:
            return None, {"error": "Quantity must be at least 1"}

        product_ids.append(product_id)
        cleaned_items.append({"product_id": product_id, "quantity": quantity})

    products = Product.query.filter(Product.id.in_(product_ids)).all()
    product_map = {}
    for product in products:
        product_map[product.id] = product

    for item in cleaned_items:
        product = product_map.get(item["product_id"])
        if product is None:
            return None, {"error": f"Product {item['product_id']} not found"}
        item["product"] = product

    return cleaned_items, None


@profile_bp.route("/api/profile", methods=["GET"])
@token_required
def get_profile():
    user = get_current_user()
    return jsonify(
        {
            "user": user.to_dict(),
            "addresses": [address.to_dict() for address in user.addresses],
            "orders": [order.to_dict() for order in user.orders],
            "wishlist": [item.to_dict() for item in user.wishlist_items if item.product],
        }
    ), 200


@profile_bp.route("/api/profile/addresses", methods=["POST"])
@token_required
def create_address():
    if not request.is_json:
        return jsonify({"error": "Expected JSON body"}), 400

    payload, error = validate_address_payload(request.get_json(silent=True))
    if error:
        return jsonify(error), 400

    user = get_current_user()
    if payload["is_default"]:
        Address.query.filter_by(user_id=user.id, is_default=True).update({"is_default": False})
    elif not user.addresses:
        payload["is_default"] = True

    address = Address(user_id=user.id, **payload)
    db.session.add(address)
    db.session.commit()

    return jsonify({"address": address.to_dict()}), 201



@profile_bp.route("/api/profile/addresses/<int:address_id>", methods=["DELETE"])
@token_required
def delete_address(address_id):
    user = get_current_user()

    address = Address.query.filter_by(id=address_id, user_id=user.id).first()
    if address is None:
        return jsonify({"error": "Address not found"}), 404

    order_exists = Order.query.filter_by(address_id=address.id).first()
    if order_exists:
        return jsonify({
            "error": "Cannot delete address used in orders"
        }), 400

    was_default = address.is_default

    db.session.delete(address)
    db.session.commit()

    if was_default:
        next_address = Address.query.filter_by(user_id=user.id)\
            .order_by(Address.created_at.desc()).first()
        if next_address is not None:
            next_address.is_default = True
            db.session.commit()

    return jsonify({"message": "Address deleted successfully"}), 200


@profile_bp.route("/api/profile/wishlist", methods=["POST"])
@token_required
def add_to_wishlist():
    if not request.is_json:
        return jsonify({"error": "Expected JSON body"}), 400

    data = request.get_json(silent=True) or {}
    product_id = data.get("product_id")

    try:
        product_id = int(product_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid product_id"}), 400

    product = db.session.get(Product, product_id)
    if product is None:
        return jsonify({"error": "Product not found"}), 404

    user = get_current_user()
    existing = WishlistItem.query.filter_by(user_id=user.id, product_id=product_id).first()
    if existing is not None:
        return jsonify({"wishlist_item": existing.to_dict()}), 200

    wishlist_item = WishlistItem(user_id=user.id, product_id=product_id)
    db.session.add(wishlist_item)
    db.session.commit()

    return jsonify({"wishlist_item": wishlist_item.to_dict()}), 201


@profile_bp.route("/api/profile/wishlist/<int:product_id>", methods=["DELETE"])
@token_required
def remove_from_wishlist(product_id):
    user = get_current_user()
    wishlist_item = WishlistItem.query.filter_by(user_id=user.id, product_id=product_id).first()
    if wishlist_item is None:
        return jsonify({"error": "Wishlist item not found"}), 404

    db.session.delete(wishlist_item)
    db.session.commit()
    return jsonify({"message": "Wishlist item removed successfully"}), 200


@profile_bp.route("/api/orders", methods=["POST"])
@token_required
def create_order():
    if not request.is_json:
        return jsonify({"error": "Expected JSON body"}), 400

    data = request.get_json(silent=True) or {}
    address_id = data.get("address_id")
    try:
        address_id = int(address_id)
    except (TypeError, ValueError):
        return jsonify({"error": "A valid shipping address is required"}), 400

    items, error = validate_order_items(data.get("items"))
    if error:
        return jsonify(error), 400

    user = get_current_user()
    address = Address.query.filter_by(id=address_id, user_id=user.id).first()
    if address is None:
        return jsonify({"error": "Shipping address not found"}), 404

    total_amount = sum(item["product"].price * item["quantity"] for item in items)
    order = Order(user_id=user.id, address_id=address.id, total_amount=total_amount)
    db.session.add(order)
    db.session.flush()

    for item in items:
        product = item["product"]
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
    return jsonify({"order": order.to_dict()}), 201

from collections import defaultdict
from datetime import datetime, UTC, timedelta

from flask import Blueprint, jsonify

from auth import admin_required
from model import Order, OrderItem, Product, User

admin_bp = Blueprint("admin", __name__)


def _to_utc(dt):
    """Ensure datetime is UTC-aware."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def _order_status(order):
    return "Paid" if order.payment_intent_id else "Placed"


def _order_payload(order):
    return {
        **order.to_dict(),
        "status": _order_status(order),
        "customer": order.user.to_dict() if order.user else None,
        "item_count": sum(item.quantity for item in order.items),
    }


def _customer_payload(user):
    total_spent = sum(order.total_amount for order in user.orders)
    last_order = user.orders[0].created_at if user.orders else None

    return {
        **user.to_dict(),
        "orders_count": len(user.orders),
        "total_spent": total_spent,
        "addresses_count": len(user.addresses),
        "wishlist_count": len(user.wishlist_items),
        "last_order_at": _to_utc(last_order).isoformat() if last_order else None,
    }


def _percent_delta(current, previous):
    if previous == 0:
        return 100 if current > 0 else 0
    return round(((current - previous) / previous) * 100, 1)


@admin_bp.route("/api/admin/dashboard", methods=["GET"])
@admin_required
def dashboard():
    products = Product.query.order_by(Product.id.desc()).all()
    orders = Order.query.order_by(Order.created_at.desc()).all()
    customers = User.query.order_by(User.created_at.desc()).all()

    now = datetime.now(UTC)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    # Normalize timestamps once (IMPORTANT FIX)
    for order in orders:
        order.created_at = _to_utc(order.created_at)

    recent_orders = [
        order for order in orders
        if order.created_at >= week_ago
    ]

    previous_orders = [
        order for order in orders
        if two_weeks_ago <= order.created_at < week_ago
    ]

    total_revenue = sum(order.total_amount for order in orders)
    recent_revenue = sum(order.total_amount for order in recent_orders)
    previous_revenue = sum(order.total_amount for order in previous_orders)

    avg_order_value = total_revenue / len(orders) if orders else 0

    # Last 7 days analytics
    revenue_by_day = []
    orders_by_day = []

    for offset in range(6, -1, -1):
        day = (now - timedelta(days=offset)).date()

        day_orders = [
            order for order in orders
            if order.created_at.date() == day
        ]

        revenue_by_day.append(round(sum(o.total_amount for o in day_orders), 2))
        orders_by_day.append(len(day_orders))

    # Product analytics
    product_sales = defaultdict(lambda: {
        "quantity": 0,
        "revenue": 0.0,
        "name": "",
        "image": None
    })

    for item in OrderItem.query.all():
        row = product_sales[item.product_id]
        row["quantity"] += item.quantity
        row["revenue"] += item.unit_price * item.quantity
        row["name"] = item.product_name
        row["image"] = item.product_image

    top_products = sorted(
        (
            {
                "product_id": pid,
                "name": v["name"],
                "image": v["image"],
                "quantity": v["quantity"],
                "revenue": round(v["revenue"], 2),
            }
            for pid, v in product_sales.items()
        ),
        key=lambda x: x["revenue"],
        reverse=True
    )[:8]

    return jsonify({
        "summary": {
            "totalRevenue": round(total_revenue, 2),
            "totalOrders": len(orders),
            "totalProducts": len(products),
            "totalCustomers": len(customers),
            "avgOrderValue": round(avg_order_value, 2),
            "revenueDelta": _percent_delta(recent_revenue, previous_revenue),
            "ordersDelta": _percent_delta(len(recent_orders), len(previous_orders)),
        },
        "orders": [_order_payload(order) for order in orders],
        "customers": [_customer_payload(user) for user in customers],
        "analytics": {
            "revenueByDay": revenue_by_day,
            "ordersByDay": orders_by_day,
            "topProducts": top_products,
        },
    }), 200
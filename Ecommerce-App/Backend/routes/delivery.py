"""
delivery.py  –  routes/delivery.py
────────────────────────────────────
Full delivery management blueprint.

Register in app.py:
    from routes.delivery import delivery_bp
    app.register_blueprint(delivery_bp)
"""

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from auth import admin_required, get_current_user, token_required, delivery_man_required, delivery_or_admin_required
from model import DeliveryTask, Order, User, db

delivery_bp = Blueprint("delivery", __name__)

_UTC = timezone.utc


def _now():
    return datetime.now(_UTC)


# ════════════════════════════════════════════════════════════════════════════
# SHARED HELPERS
# ════════════════════════════════════════════════════════════════════════════

def _task_or_404(task_id):
    task = db.session.get(DeliveryTask, task_id)
    if task is None:
        return None, (jsonify({"error": "Delivery task not found"}), 404)
    return task, None


def _order_already_has_active_task(order_id):
    """Return True if the order already has a non-rejected task."""
    return DeliveryTask.query.filter(
        DeliveryTask.order_id == order_id,
        DeliveryTask.status != "rejected",
    ).first() is not None


# ════════════════════════════════════════════════════════════════════════════
# DELIVERY MAN  –  read-only views
# ════════════════════════════════════════════════════════════════════════════

@delivery_bp.route("/api/delivery/available-orders", methods=["GET"])
@delivery_man_required
def list_available_orders():
    """
    Orders that are paid (have payment_intent_id) and have NO active
    DeliveryTask yet.  Delivery man can request these.
    """
    # sub-query: order_ids that already have an active task
    active_order_ids = db.session.query(DeliveryTask.order_id).filter(
        DeliveryTask.status != "rejected"
    ).subquery()

    orders = (
        Order.query
        .filter(
            Order.payment_intent_id.isnot(None),          # paid orders only
            Order.id.notin_(active_order_ids),
        )
        .order_by(Order.created_at.desc())
        .all()
    )

    return jsonify({"orders": [o.to_dict() for o in orders]}), 200


@delivery_bp.route("/api/delivery/my-tasks", methods=["GET"])
@delivery_man_required
def my_tasks():
    """All tasks (any status) assigned to / requested by the current delivery man."""
    user = get_current_user()
    tasks = (
        DeliveryTask.query
        .filter_by(delivery_man_id=user.id)
        .order_by(DeliveryTask.requested_at.desc())
        .all()
    )
    return jsonify({"tasks": [t.to_dict() for t in tasks]}), 200


# ════════════════════════════════════════════════════════════════════════════
# DELIVERY MAN  –  actions
# ════════════════════════════════════════════════════════════════════════════

@delivery_bp.route("/api/delivery/request", methods=["POST"])
@delivery_man_required
def request_task():
    """
    Delivery man requests to take an order.
    Body: { "order_id": <int> }
    Creates DeliveryTask with status='requested'.
    """
    data = request.get_json(silent=True) or {}
    try:
        order_id = int(data["order_id"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "order_id is required"}), 400

    order = db.session.get(Order, order_id)
    if order is None:
        return jsonify({"error": "Order not found"}), 404

    if not order.payment_intent_id:
        return jsonify({"error": "Order has not been paid yet"}), 400

    if _order_already_has_active_task(order_id):
        return jsonify({"error": "This order already has an active delivery task"}), 409

    user = get_current_user()

    task = DeliveryTask(
        order_id=order_id,
        delivery_man_id=user.id,
        status="requested",
        requested_by_delivery_man=True,
        requested_at=_now(),
    )
    db.session.add(task)
    db.session.commit()

    return jsonify({"task": task.to_dict(), "message": "Delivery request submitted"}), 201


@delivery_bp.route("/api/delivery/tasks/<int:task_id>/status", methods=["PATCH"])
@delivery_man_required
def update_task_status(task_id):
    """
    Delivery man advances the status of their own assigned task.
    Allowed transitions: assigned → picked_up → delivered
    Body: { "status": "picked_up" | "delivered" }
    """
    task, err = _task_or_404(task_id)
    if err:
        return err

    user = get_current_user()
    if task.delivery_man_id != user.id:
        return jsonify({"error": "Not your task"}), 403

    if task.status != "assigned" and task.status != "picked_up":
        return jsonify({
            "error": f"Cannot advance status from '{task.status}'"
        }), 409

    data = request.get_json(silent=True) or {}
    new_status = data.get("status", "").strip()

    # Validate transition
    allowed = {
        "assigned": "picked_up",
        "picked_up": "delivered",
    }
    if new_status != allowed.get(task.status):
        return jsonify({
            "error": f"Invalid transition: '{task.status}' → '{new_status}'"
        }), 400

    task.status = new_status
    now = _now()
    if new_status == "picked_up":
        task.picked_up_at = now
    elif new_status == "delivered":
        task.delivered_at = now

    db.session.commit()
    return jsonify({"task": task.to_dict()}), 200


# ════════════════════════════════════════════════════════════════════════════
# ADMIN  –  views
# ════════════════════════════════════════════════════════════════════════════

@delivery_bp.route("/api/admin/delivery/tasks", methods=["GET"])
@admin_required
def admin_list_tasks():
    """
    All delivery tasks with optional status filter.
    Query params: ?status=requested|assigned|picked_up|delivered|rejected
    """
    status_filter = request.args.get("status", "").strip().lower()

    query = DeliveryTask.query
    if status_filter:
        query = query.filter_by(status=status_filter)

    tasks = query.order_by(DeliveryTask.requested_at.desc()).all()
    return jsonify({"tasks": [t.to_dict() for t in tasks]}), 200


@delivery_bp.route("/api/admin/delivery/orders", methods=["GET"])
@admin_required
def admin_orders_with_delivery():
    """
    All paid orders with their delivery task (if any) embedded.
    Useful for the admin tracking table.
    """
    orders = (
        Order.query
        .filter(Order.payment_intent_id.isnot(None))
        .order_by(Order.created_at.desc())
        .all()
    )

    result = []
    for order in orders:
        d = order.to_dict()
        latest_task = (DeliveryTask.query.filter_by(order_id=order.id).order_by(DeliveryTask.id.desc()).first())
        d["delivery_task"] = latest_task.to_dict() if latest_task else None
        result.append(d)
    return jsonify({"orders": result}), 200


@delivery_bp.route("/api/admin/delivery/delivery-men", methods=["GET"])
@admin_required
def list_delivery_men():
    """All users with role == delivery_man."""
    users = User.query.filter_by(role="delivery_man").order_by(User.username).all()
    return jsonify({"delivery_men": [u.to_dict() for u in users]}), 200


# ════════════════════════════════════════════════════════════════════════════
# ADMIN  –  actions
# ════════════════════════════════════════════════════════════════════════════

@delivery_bp.route("/api/admin/delivery/tasks/<int:task_id>/approve", methods=["POST"])
@admin_required
def approve_task(task_id):
    """
    Approve a requested task → status becomes 'assigned'.
    Optionally re-assign to a different delivery man.
    Body (optional): { "delivery_man_id": <int> }
    """
    task, err = _task_or_404(task_id)
    if err:
        return err

    if task.status != "requested":
        return jsonify({"error": f"Task is '{task.status}', not 'requested'"}), 409

    data = request.get_json(silent=True) or {}
    if "delivery_man_id" in data:
        try:
            dm_id = int(data["delivery_man_id"])
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid delivery_man_id"}), 400

        dm = User.query.filter_by(id=dm_id, role="delivery_man").first()
        if dm is None:
            return jsonify({"error": "Delivery man not found"}), 404
        task.delivery_man_id = dm_id

    task.status = "assigned"
    task.assigned_at = _now()
    db.session.commit()

    return jsonify({"task": task.to_dict(), "message": "Task approved and assigned"}), 200


@delivery_bp.route("/api/admin/delivery/tasks/<int:task_id>/reject", methods=["POST"])
@admin_required
def reject_task(task_id):
    """Reject a requested task → status becomes 'rejected'."""
    task, err = _task_or_404(task_id)
    if err:
        return err

    if task.status not in ("requested", "assigned"):
        return jsonify({"error": f"Cannot reject task with status '{task.status}'"}), 409

    task.status = "rejected"
    task.rejected_at = _now()
    db.session.commit()

    return jsonify({"task": task.to_dict(), "message": "Task rejected"}), 200


@delivery_bp.route("/api/admin/delivery/assign", methods=["POST"])
@admin_required
def admin_assign_task():
    """
    Admin directly creates and assigns a delivery task for an order
    without waiting for a delivery man to request it.
    Body: { "order_id": <int>, "delivery_man_id": <int> }
    """
    data = request.get_json(silent=True) or {}
    try:
        order_id = int(data["order_id"])
        dm_id    = int(data["delivery_man_id"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "order_id and delivery_man_id are required"}), 400

    order = db.session.get(Order, order_id)
    if order is None:
        return jsonify({"error": "Order not found"}), 404

    if not order.payment_intent_id:
        return jsonify({"error": "Order has not been paid yet"}), 400

    if _order_already_has_active_task(order_id):
        return jsonify({"error": "Order already has an active delivery task"}), 409

    dm = User.query.filter_by(id=dm_id, role="delivery_man").first()
    if dm is None:
        return jsonify({"error": "Delivery man not found"}), 404

    now = _now()
    task = DeliveryTask(
        order_id=order_id,
        delivery_man_id=dm_id,
        status="assigned",
        requested_by_delivery_man=False,
        requested_at=now,
        assigned_at=now,
    )
    db.session.add(task)
    db.session.commit()

    return jsonify({"task": task.to_dict(), "message": "Task assigned"}), 201


@delivery_bp.route("/api/admin/delivery/tasks/<int:task_id>/status", methods=["PATCH"])
@admin_required
def admin_override_status(task_id):
    """
    Admin can force-set any valid status.
    Body: { "status": <string> }
    """
    task, err = _task_or_404(task_id)
    if err:
        return err

    data = request.get_json(silent=True) or {}
    new_status = data.get("status", "").strip()

    valid = {"requested", "assigned", "picked_up", "delivered", "rejected"}
    if new_status not in valid:
        return jsonify({"error": f"Invalid status '{new_status}'"}), 400

    now = _now()
    task.status = new_status
    if new_status == "assigned"  and not task.assigned_at:
        task.assigned_at = now
    if new_status == "picked_up" and not task.picked_up_at:
        task.picked_up_at = now
    if new_status == "delivered" and not task.delivered_at:
        task.delivered_at = now
    if new_status == "rejected"  and not task.rejected_at:
        task.rejected_at = now

    db.session.commit()
    return jsonify({"task": task.to_dict()}), 200
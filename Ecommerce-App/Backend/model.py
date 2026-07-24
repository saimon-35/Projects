from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import bcrypt

db = SQLAlchemy()


# ═══════════════════════════════════════════════════════════════
# PRODUCT
# ═══════════════════════════════════════════════════════════════

class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    price = db.Column(db.Float, nullable=False)
    description = db.Column(db.Text, nullable=True)
    image = db.Column(db.String(500), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "price": self.price,
            "description": self.description,
            "image": self.image,
        }


# ═══════════════════════════════════════════════════════════════
# USER (UPDATED WITH ROLE SYSTEM)
# ═══════════════════════════════════════════════════════════════

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # OLD FIELD (kept for backward compatibility logic)
    is_admin = db.Column(db.Boolean, default=False)

    # NEW FIELD (IMPORTANT)
    role = db.Column(
        db.String(20),
        nullable=False,
        default="customer",
        server_default="customer",
    )

    # ── Role helpers ─────────────────────────────────────────────
    @property
    def is_admin(self):
        return self.role == "admin"

    @is_admin.setter
    def is_admin(self, value):
        if value:
            self.role = "admin"
        elif self.role == "admin":
            self.role = "customer"

    @property
    def is_delivery_man(self):
        return self.role == "delivery_man"

    # ── relationships ────────────────────────────────────────────
    addresses = db.relationship(
        "Address",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="desc(Address.is_default), desc(Address.created_at)",
    )

    orders = db.relationship(
        "Order",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="desc(Order.created_at)",
    )

    wishlist_items = db.relationship(
        "WishlistItem",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan",
    )

    # ── auth helpers ─────────────────────────────────────────────
    def set_password(self, password):
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"),
            salt
        ).decode("utf-8")

    def check_password(self, password):
        return bcrypt.checkpw(
            password.encode("utf-8"),
            self.password_hash.encode("utf-8")
        )

    # ── output ───────────────────────────────────────────────────
    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
            "is_admin": self.is_admin,
            "role": self.role,
            "is_delivery_man": self.is_delivery_man,
        }


# ═══════════════════════════════════════════════════════════════
# ADDRESS (UNCHANGED)
# ═══════════════════════════════════════════════════════════════

class Address(db.Model):
    __tablename__ = "addresses"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    full_name = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    line1 = db.Column(db.String(255), nullable=False)
    line2 = db.Column(db.String(255), nullable=True)
    city = db.Column(db.String(120), nullable=False)
    state = db.Column(db.String(120), nullable=False)
    postal_code = db.Column(db.String(30), nullable=False)
    country = db.Column(db.String(120), nullable=False)
    is_default = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "phone": self.phone,
            "line1": self.line1,
            "line2": self.line2,
            "city": self.city,
            "state": self.state,
            "postal_code": self.postal_code,
            "country": self.country,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat(),
        }


# ═══════════════════════════════════════════════════════════════
# ORDER (UNCHANGED)
# ═══════════════════════════════════════════════════════════════

class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    address_id = db.Column(db.Integer, db.ForeignKey("addresses.id"), nullable=False)
    total_amount = db.Column(db.Float, nullable=False, default=0)

    payment_intent_id = db.Column(db.String(255), nullable=True, unique=True, index=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    shipping_address = db.relationship("Address")

    items = db.relationship(
        "OrderItem",
        backref="order",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="OrderItem.id",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "total_amount": self.total_amount,
            "payment_intent_id": self.payment_intent_id,
            "created_at": self.created_at.isoformat(),
            "shipping_address": self.shipping_address.to_dict() if self.shipping_address else None,
            "items": [item.to_dict() for item in self.items],
        }


# ═══════════════════════════════════════════════════════════════
# ORDER ITEM (UNCHANGED)
# ═══════════════════════════════════════════════════════════════

class OrderItem(db.Model):
    __tablename__ = "order_items"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    product_name = db.Column(db.String(200), nullable=False)
    product_image = db.Column(db.String(500), nullable=True)
    unit_price = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)

    product = db.relationship("Product")

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product_name,
            "product_image": self.product_image,
            "unit_price": self.unit_price,
            "quantity": self.quantity,
            "line_total": self.unit_price * self.quantity,
        }


# ═══════════════════════════════════════════════════════════════
# WISHLIST (UNCHANGED)
# ═══════════════════════════════════════════════════════════════

class WishlistItem(db.Model):
    __tablename__ = "wishlist_items"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    product = db.relationship("Product")

    __table_args__ = (
        db.UniqueConstraint("user_id", "product_id", name="uq_wishlist_user_product"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat(),
            "product": self.product.to_dict() if self.product else None,
        }


# ═══════════════════════════════════════════════════════════════
# NEW: DELIVERY SYSTEM MODEL
# ═══════════════════════════════════════════════════════════════

class DeliveryTask(db.Model):
    __tablename__ = "delivery_tasks"

    id = db.Column(db.Integer, primary_key=True)

    order_id = db.Column(
        db.Integer,
        db.ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    delivery_man_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status = db.Column(
        db.String(20),
        default="requested",
        nullable=False,
        index=True,
    )

    requested_by_delivery_man = db.Column(db.Boolean, default=True, nullable=False)

    requested_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    assigned_at = db.Column(db.DateTime, nullable=True)
    picked_up_at = db.Column(db.DateTime, nullable=True)
    delivered_at = db.Column(db.DateTime, nullable=True)
    rejected_at = db.Column(db.DateTime, nullable=True)

    # relationships
    order = db.relationship("Order", backref=db.backref("delivery_task", uselist=False))
    delivery_man = db.relationship("User", foreign_keys=[delivery_man_id])

    def to_dict(self):
        return {
            "id": self.id,
            "order_id": self.order_id,
            "delivery_man_id": self.delivery_man_id,
            "status": self.status,
            "requested_at": self.requested_at.isoformat(),
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "picked_up_at": self.picked_up_at.isoformat() if self.picked_up_at else None,
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "rejected_at": self.rejected_at.isoformat() if self.rejected_at else None,
        }
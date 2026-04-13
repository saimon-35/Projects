import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from data import PRODUCTS
from model import Product, db


load_dotenv()

app = Flask(__name__, instance_relative_config=True)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

CORS(app)
db.init_app(app)


def validate_product_payload(data, *, partial=False):
    if not isinstance(data, dict):
        return None, {"error": "Invalid JSON object"}

    allowed_fields = {"name", "price", "description", "image"}
    required_fields = {"name", "price"}
    errors = {}
    cleaned = {}

    for key in data:
        if key not in allowed_fields:
            errors[key] = "Unexpected field"

    if not partial:
        for field in required_fields:
            if field not in data:
                errors[field] = "This field is required"

    if "name" in data:
        name = data.get("name")
        if not isinstance(name, str) or not name.strip():
            errors["name"] = "Name must be a non-empty string"
        else:
            cleaned["name"] = name.strip()

    if "price" in data:
        try:
            price = float(data.get("price"))
        except (TypeError, ValueError):
            errors["price"] = "Price must be a valid number"
        else:
            if price < 0:
                errors["price"] = "Price must be greater than or equal to 0"
            else:
                cleaned["price"] = price

    for field in ("description", "image"):
        if field in data:
            value = data.get(field)
            if value is None:
                cleaned[field] = None
            elif not isinstance(value, str):
                errors[field] = f"{field.title()} must be a string"
            else:
                stripped = value.strip()
                cleaned[field] = stripped or None

    if errors:
        return None, {"errors": errors}

    return cleaned, None


def seed_if_empty():
    if Product.query.first() is not None:
        return

    for product in PRODUCTS:
        db.session.add(
            Product(
                name=product["name"],
                price=product["price"],
                description=product["description"],
                image=product["image"],
            )
        )

    db.session.commit()


with app.app_context():
    os.makedirs(app.instance_path, exist_ok=True)
    db.create_all()
    seed_if_empty()


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "message": "Backend is running"}), 200


@app.get("/api/products")
def list_products():
    products = Product.query.order_by(Product.id).all()
    return jsonify({"products": [product.to_dict() for product in products]}), 200


@app.post("/api/products")
def create_product():
    if not request.is_json:
        return jsonify({"error": "Expected JSON body"}), 400

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    payload, error = validate_product_payload(data)
    if error:
        return jsonify(error), 400

    product = Product(**payload)
    db.session.add(product)
    db.session.commit()

    return jsonify({"product": product.to_dict()}), 201


@app.get("/api/products/<int:product_id>")
def get_product(product_id):
    product = db.session.get(Product, product_id)
    if product is None:
        return jsonify({"error": "Product not found"}), 404
    return jsonify({"product": product.to_dict()}), 200


@app.put("/api/products/<int:product_id>")
def update_product(product_id):
    product = db.session.get(Product, product_id)
    if product is None:
        return jsonify({"error": "Product not found"}), 404

    if not request.is_json:
        return jsonify({"error": "Expected JSON body"}), 400

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    payload, error = validate_product_payload(data, partial=True)
    if error:
        return jsonify(error), 400

    if not payload:
        return jsonify({"error": "Provide at least one updatable field"}), 400

    for field, value in payload.items():
        setattr(product, field, value)

    db.session.commit()
    return jsonify({"product": product.to_dict()}), 200


@app.delete("/api/products/<int:product_id>")
def delete_product(product_id):
    product = db.session.get(Product, product_id)
    if product is None:
        return jsonify({"error": "Product not found"}), 404

    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": "Product deleted successfully"}), 200


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

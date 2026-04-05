from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import os
from data import PRODUCTS  # reuse your seed list
from model import Product, db


load_dotenv()

app = Flask(__name__, instance_relative_config=True)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL" 
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

CORS(app)
db.init_app(app)



def seed_if_empty():
    if Product.query.first() is not None:
        return
    for p in PRODUCTS:
        db.session.add(
            Product(
                name=p["name"],
                price=p["price"],
                description=p["description"],
                image=p["image"],
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
    return jsonify({"products": [p.to_dict() for p in products]}), 200

@app.post("/api/products")
def create_product():
    if not request.is_json:
        return jsonify({"error": "Expected JSON body"}), 400

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    name = data.get("name")
    price = data.get("price")
    description = data.get("description")
    image = data.get("image")

    if name is None or (isinstance(name, str) and not name.strip()):
        return jsonify({"error": "Field 'name' is required and must be non-empty"}), 400
    if not isinstance(name, str):
        return jsonify({"error": "Field 'name' must be a string"}), 400

    if price is None:
        return jsonify({"error": "Field 'price' is required"}), 400
    try:
        price_val = float(price)
    except (TypeError, ValueError):
        return jsonify({"error": "Field 'price' must be a number"}), 400
    if price_val < 0:
        return jsonify({"error": "Field 'price' must be >= 0"}), 400

    if description is not None and not isinstance(description, str):
        return jsonify({"error": "Field 'description' must be a string or omitted"}), 400
    if image is not None and not isinstance(image, str):
        return jsonify({"error": "Field 'image' must be a string or omitted"}), 400

    product = Product(
        name=name.strip(),
        price=price_val,
        description=description.strip() if isinstance(description, str) else None,
        image=image.strip() if isinstance(image, str) and image.strip() else None,
    )
    db.session.add(product)
    db.session.commit()

    return jsonify({"product": product.to_dict()}), 201


@app.get("/api/products/<int:product_id>")
def get_product(product_id):
    product = Product.query.get(product_id)
    if product is None:
        return jsonify({"error": "Product not found"}), 404
    return jsonify({"product": product.to_dict()}), 200


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
from flask import Blueprint, jsonify, request
from data import PRODUCTS
from model import Product, db

products_bp = Blueprint('products', __name__)

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

@products_bp.route('/api/products', methods=['GET'])
def list_products():
    # Get query parameters for search and filtering
    search_query = request.args.get('search', '')
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)
    
    # Start with all products
    query = Product.query
    
    # Apply search filter
    if search_query:
        query = query.filter(
            db.or_(
                Product.name.ilike(f'%{search_query}%'),
                Product.description.ilike(f'%{search_query}%')
            )
        )
    
    # Apply price filters
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    
    if max_price is not None:
        query = query.filter(Product.price <= max_price)
    
    # Execute query
    products = query.order_by(Product.id).all()
    return jsonify({"products": [product.to_dict() for product in products]}), 200

@products_bp.route('/api/products', methods=['POST'])
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

@products_bp.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = db.session.get(Product, product_id)
    if product is None:
        return jsonify({"error": "Product not found"}), 404
    return jsonify({"product": product.to_dict()}), 200

@products_bp.route('/api/products/<int:product_id>', methods=['PUT'])
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

@products_bp.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    product = db.session.get(Product, product_id)
    if product is None:
        return jsonify({"error": "Product not found"}), 404

    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": "Product deleted successfully"}), 200

import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from model import db
from routes.products import products_bp
from data import PRODUCTS
from model import Product

load_dotenv()

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

def create_app():
    app = Flask(__name__, instance_relative_config=True)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    CORS(app)
    db.init_app(app)

    # Register blueprints
    app.register_blueprint(products_bp)

    with app.app_context():
        os.makedirs(app.instance_path, exist_ok=True)
        db.create_all()
        seed_if_empty()

    return app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

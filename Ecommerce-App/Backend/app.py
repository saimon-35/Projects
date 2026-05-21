import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from model import db, User
from routes.products import products_bp
from routes.auth import auth_bp
from routes.profile import profile_bp
from routes.payment import payment_bp
from routes.upload import upload_bp
from routes.admin import admin_bp
from data import PRODUCTS
from model import Product
from flask_migrate import Migrate

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
    app.config["SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "fallback_secret_key_for_development")
    app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB upload limit

    CORS(app)
    db.init_app(app)
    migrate = Migrate(app, db)

    # Register blueprints
    app.register_blueprint(products_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(admin_bp)

    with app.app_context():
        os.makedirs(app.instance_path, exist_ok=True)
        db.create_all()
        seed_if_empty()

    return app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

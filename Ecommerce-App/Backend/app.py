import os

import cloudinary
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
from routes.delivery import delivery_bp
from data import PRODUCTS
from model import Product
from flask_migrate import Migrate

load_dotenv()
for key in ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"]:
    os.environ.pop(key, None)


def create_app():
    app = Flask(__name__, instance_relative_config=True)

    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "fallback_secret_key_for_development")
    app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

    # Cloudinary uses this process-wide configuration for all uploads. Secrets
    # remain in environment variables and are never sent to the client.
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True,
    )

    CORS(app)

    db.init_app(app)
    Migrate(app, db)

    app.register_blueprint(products_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(delivery_bp)
    return app

app = create_app()
@app.route("/")
def home():
    return {
        "status": "ok",
        "message": "Backend is running"
    }, 200
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

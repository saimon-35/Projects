import os
import uuid
from flask import Blueprint, jsonify, request, current_app, send_from_directory
from werkzeug.utils import secure_filename
from auth import admin_required

upload_bp = Blueprint("upload", __name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


def get_upload_folder():
    folder = os.path.join(current_app.instance_path, "uploads", "products")
    os.makedirs(folder, exist_ok=True)
    return folder


@upload_bp.route("/api/upload/product-image", methods=["POST"])
@admin_required
def upload_product_image():
    """
    Accepts a multipart/form-data POST with a single file field named 'image'.
    Returns { url } on success — a path the frontend can use as an img src.
    """
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify(
            {"error": f"File type not allowed. Accepted: {', '.join(ALLOWED_EXTENSIONS)}"}
        ), 400

    # Check file size (read into memory limit)
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > MAX_FILE_SIZE:
        return jsonify({"error": "File too large. Maximum size is 5 MB"}), 400

    # Build a unique, sanitised filename
    ext = secure_filename(file.filename).rsplit(".", 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"

    upload_folder = get_upload_folder()
    save_path = os.path.join(upload_folder, unique_name)
    file.save(save_path)

    # Return the public URL path
    url = f"/static/uploads/products/{unique_name}"
    return jsonify({"url": url, "filename": unique_name}), 201


@upload_bp.route("/static/uploads/products/<path:filename>")
def serve_product_image(filename):
    """Serve uploaded product images."""
    folder = get_upload_folder()
    return send_from_directory(folder, filename)
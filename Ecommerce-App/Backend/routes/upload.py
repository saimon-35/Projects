import os

import cloudinary.exceptions
import cloudinary.uploader
from flask import Blueprint, jsonify, request

from auth import admin_required

upload_bp = Blueprint("upload", __name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


@upload_bp.route("/api/upload/product-image", methods=["POST"])
@admin_required
def upload_product_image():
    """Upload one product image to Cloudinary and return its HTTPS URL."""
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify(
            {"error": f"File type not allowed. Accepted: {', '.join(ALLOWED_EXTENSIONS)}"}
        ), 400

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > MAX_FILE_SIZE:
        return jsonify({"error": "File too large. Maximum size is 5 MB"}), 400

    if not all(
        os.getenv(name)
        for name in (
            "CLOUDINARY_CLOUD_NAME",
            "CLOUDINARY_API_KEY",
            "CLOUDINARY_API_SECRET",
        )
    ):
        return jsonify({"error": "Image storage is not configured"}), 503

    try:
        result = cloudinary.uploader.upload(
            file,
            folder="products",
            resource_type="image",
        )
    except cloudinary.exceptions.Error:
        return jsonify({"error": "Image upload failed. Please try again."}), 502
    except Exception:
        # Do not expose provider or credential details in the API response.
        return jsonify({"error": "Image upload failed. Please try again."}), 502

    secure_url = result.get("secure_url")
    public_id = result.get("public_id")
    if not secure_url or not public_id:
        return jsonify({"error": "Image storage returned an invalid response"}), 502

    # Preserve the response fields expected by the existing frontend. `filename`
    # now identifies the remote Cloudinary asset and can be used for deletion later.
    return jsonify({"url": secure_url, "filename": public_id}), 201

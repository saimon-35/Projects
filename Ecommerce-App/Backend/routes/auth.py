from flask import Blueprint, jsonify, request
from model import User, db
from auth import generate_token
import re

auth_bp = Blueprint('auth', __name__)

def validate_email(email):
    """Validate email format (practical validation)"""

    if not isinstance(email, str):
        return False

    email = email.strip()

    # Basic length check (RFC standard max is 254)
    if len(email) > 254:
        return False

    # Improved regex
    pattern = r'^[a-zA-Z0-9]+([._%+-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-]?[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$'

    if not re.match(pattern, email):
        return False

    # Extra safety checks
    if '..' in email:
        return False

    return True

def validate_password(password):
    """Validate password strength"""
    # At least 6 characters
    return len(password) >= 6

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    if not request.is_json:
        return jsonify({"error": "Expected JSON body"}), 400

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    # Extract and validate fields
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    # Validate input
    if not username:
        return jsonify({"error": "Username is required"}), 400
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    if not password:
        return jsonify({"error": "Password is required"}), 400

    if not validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400

    if not validate_password(password):
        return jsonify({"error": "Password must be at least 6 characters long"}), 400

    # Check if user already exists
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400

    # Create new user
    user = User(username=username, email=email)
    user.set_password(password)
    # Make first user admin (optional)
    if User.query.count() == 0:
        user.is_admin = True

    db.session.add(user)
    db.session.commit()

    # Generate token
    token = generate_token(user.id)

    return jsonify({
        "message": "User registered successfully",
        "user": user.to_dict(),
        "token": token
    }), 201

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    """Login user and return JWT token"""
    if not request.is_json:
        return jsonify({"error": "Expected JSON body"}), 400

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    # Extract fields
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    # Validate input
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    if not password:
        return jsonify({"error": "Password is required"}), 400

    # Find user by email
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    # Generate token
    token = generate_token(user.id)

    return jsonify({
        "message": "Login successful",
        "user": user.to_dict(),
        "token": token
    }), 200

@auth_bp.route('/api/auth/profile', methods=['GET'])
def profile():
    """Get current user profile"""
    # Get Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({'error': 'Authorization header missing'}), 401
    
    try:
        # Expected format: "Bearer <token>"
        token = auth_header.split(' ')[1]
    except IndexError:
        return jsonify({'error': 'Invalid Authorization header format'}), 401
    
    from auth import decode_token
    payload = decode_token(token)
    if not payload:
        return jsonify({'error': 'Invalid or expired token'}), 401
    
    user_id = payload.get('user_id')
    if not user_id:
        return jsonify({'error': 'Invalid token payload'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        "user": user.to_dict()
    }), 200
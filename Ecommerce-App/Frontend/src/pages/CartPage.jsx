import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/cart';
import CartItem from '../components/CartItem';
import './CartPage.css';

export default function CartPage() {
  const navigate = useNavigate();
  const { cart, getCartTotal, clearCart } = useCart();
  const total = getCartTotal();

  if (cart.length === 0) {
    return (
      <div className="cart-page">
        <h1>Shopping Cart</h1>
        <div className="empty-cart">
          <p>Your cart is empty</p>
          <button onClick={() => navigate('/')} className="continue-shopping-btn">
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1>Shopping Cart</h1>
      
      <div className="cart-items">
        {cart.map((item) => (
          <CartItem key={item.id} item={item} />
        ))}
      </div>

      <div className="cart-summary">
        <div className="summary-row">
          <span>Subtotal:</span>
          <strong>${total.toFixed(2)}</strong>
        </div>
        <div className="summary-row total">
          <span>Total:</span>
          <strong>${total.toFixed(2)}</strong>
        </div>
      </div>

      <div className="cart-actions">
        <button onClick={() => navigate('/')} className="continue-shopping-btn">
          ← Continue Shopping
        </button>
        <button onClick={clearCart} className="clear-cart-btn">
          Clear Cart
        </button>
        <button className="checkout-btn">
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}

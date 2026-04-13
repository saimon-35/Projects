import { useCart } from '../context/cart.js';
import './CartItem.css';

export default function CartItem({ item }) {
  const { updateQuantity, removeFromCart } = useCart();

  const handleDecrease = () => {
    updateQuantity(item.id, item.quantity - 1);
  };

  const handleIncrease = () => {
    updateQuantity(item.id, item.quantity + 1);
  };

  const itemTotal = (item.price * item.quantity).toFixed(2);

  return (
    <div className="cart-item">
      <div className="cart-item-info">
        <h3>{item.name}</h3>
        <p className="cart-item-price">${Number(item.price).toFixed(2)}</p>
      </div>
      
      <div className="cart-item-controls">
        <div className="quantity-controls">
          <button onClick={handleDecrease} className="qty-btn">−</button>
          <span className="quantity">{item.quantity}</span>
          <button onClick={handleIncrease} className="qty-btn">+</button>
        </div>
        
        <div className="cart-item-total">
          <strong>${itemTotal}</strong>
        </div>
        
        <button
          onClick={() => removeFromCart(item.id)}
          className="remove-btn"
          title="Remove item"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

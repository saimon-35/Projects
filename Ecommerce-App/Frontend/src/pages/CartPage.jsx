import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/cart.js';
import { useAuth } from '../context/AuthContext';
import { createOrder, getProfile } from '../api.js';
import CartItem from '../components/CartItem';
import './CartPage.css';

export default function CartPage() {
  const navigate = useNavigate();
  const { cart, getCartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const total = getCartTotal();
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAddresses() {
      if (!user) {
        setAddresses([]);
        setSelectedAddressId('');
        return;
      }

      try {
        const data = await getProfile();
        if (!cancelled) {
          const nextAddresses = Array.isArray(data.addresses) ? data.addresses : [];
          setAddresses(nextAddresses);
          const defaultAddress = nextAddresses.find((address) => address.is_default);
          setSelectedAddressId(String(defaultAddress?.id || nextAddresses[0]?.id || ''));
        }
      } catch {
        if (!cancelled) {
          setAddresses([]);
          setSelectedAddressId('');
        }
      }
    }

    loadAddresses();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleCheckout = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!selectedAddressId) {
      setCheckoutError('Save a shipping address in your profile before checkout.');
      return;
    }

    setCheckingOut(true);
    setCheckoutError('');

    try {
      await createOrder({
        address_id: Number(selectedAddressId),
        items: cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
        })),
      });
      clearCart();
      navigate('/profile');
    } catch (e) {
      setCheckoutError(e?.message || 'Failed to place order');
    } finally {
      setCheckingOut(false);
    }
  };

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

      {user && (
        <div className="checkout-panel">
          <label htmlFor="shippingAddress">Shipping address</label>
          <select
            id="shippingAddress"
            value={selectedAddressId}
            onChange={(e) => setSelectedAddressId(e.target.value)}
            disabled={addresses.length === 0 || checkingOut}
          >
            {addresses.length === 0 ? (
              <option value="">No saved addresses</option>
            ) : (
              addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.full_name} - {address.city}, {address.country}
                </option>
              ))
            )}
          </select>
          {checkoutError && <p role="alert">{checkoutError}</p>}
        </div>
      )}

      <div className="cart-actions">
        <button onClick={() => navigate('/')} className="continue-shopping-btn">
          ← Continue Shopping
        </button>
        <button onClick={clearCart} className="clear-cart-btn">
          Clear Cart
        </button>
        <button className="checkout-btn" onClick={handleCheckout} disabled={checkingOut}>
          {checkingOut ? 'Placing Order...' : 'Proceed to Checkout'}
        </button>
      </div>
    </div>
  );
}

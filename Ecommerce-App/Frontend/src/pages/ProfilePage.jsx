import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createAddress,
  deleteAddress,
  getProfile,
  removeFromWishlist,
} from '../api.js';
import { useAuth } from '../context/AuthContext';
import './ProfilePage.css';

const emptyAddressForm = {
  full_name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  is_default: false,
};

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyAddressForm);
  const [savingAddress, setSavingAddress] = useState(false);
  const [busyWishlistId, setBusyWishlistId] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    loadProfile();
  }, [user, navigate]);

  async function loadProfile() {
    setLoading(true);
    setError('');
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (e) {
      setError(e?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleAddressSubmit(event) {
    event.preventDefault();
    setSavingAddress(true);
    setError('');

    try {
      const data = await createAddress(form);
      setProfile((current) => ({
        ...current,
        addresses: [data.address, ...(current?.addresses || []).filter((address) => !data.address.is_default || !address.is_default)],
      }));
      setForm(emptyAddressForm);
      await loadProfile();
    } catch (e) {
      setError(e?.message || 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  }

async function handleDeleteAddress(addressId) {
  try {
    setDeleteError('');
    await deleteAddress(addressId);
    await loadProfile();
  } catch (e) {
    setDeleteError(e.message);
  }
}

  async function handleRemoveWishlist(productId) {
    setBusyWishlistId(productId);
    try {
      await removeFromWishlist(productId);
      setProfile((current) => ({
        ...current,
        wishlist: (current?.wishlist || []).filter((item) => item.product?.id !== productId),
      }));
    } catch (e) {
      setError(e?.message || 'Failed to update wishlist');
    } finally {
      setBusyWishlistId(null);
    }
  }

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="profile-page">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (

    <div className="profile-page">
      <div className="profile-hero">
        <div>
          <p className="profile-eyebrow">Customer Profile</p>
          <h1>{profile?.user?.username}</h1>
          <p>{profile?.user?.email}</p>
        </div>
        <div className="profile-summary">
          <div>
            <strong>{profile?.addresses?.length || 0}</strong>
            <span>Addresses</span>
          </div>
          <div>
            <strong>{profile?.orders?.length || 0}</strong>
            <span>Orders</span>
          </div>
          <div>
            <strong>{profile?.wishlist?.length || 0}</strong>
            <span>Wishlist</span>
          </div>
        </div>
      </div>

      {error && <p className="profile-error">{error}</p>}

      <div className="profile-grid">
        <section className="profile-card">
          <div className="section-head">
            <div>
              <h2>Shipping Addresses</h2>
              <p>Save delivery details for faster checkout.</p>
            </div>
          </div>

          <form className="address-form" onSubmit={handleAddressSubmit}>
            <input name="full_name" placeholder="Full name" value={form.full_name} onChange={handleChange} required />
            <input name="phone" placeholder="Phone number" value={form.phone} onChange={handleChange} required />
            <input name="line1" placeholder="Address line 1" value={form.line1} onChange={handleChange} required />
            <input name="line2" placeholder="Address line 2" value={form.line2} onChange={handleChange} />
            <input name="city" placeholder="City" value={form.city} onChange={handleChange} required />
            <input name="state" placeholder="State" value={form.state} onChange={handleChange} required />
            <input name="postal_code" placeholder="Postal code" value={form.postal_code} onChange={handleChange} required />
            <input name="country" placeholder="Country" value={form.country} onChange={handleChange} required />
            <label className="checkbox-row">
              <input
                type="checkbox"
                name="is_default"
                checked={form.is_default}
                onChange={handleChange}
              />
              Set as default shipping address
            </label>
            <button type="submit" disabled={savingAddress}>
              {savingAddress ? 'Saving...' : 'Save Address'}
            </button>
          </form>

          <div className="address-list">
            {(profile?.addresses || []).length === 0 ? (
              <p>No saved addresses yet.</p>
            ) : (
              profile.addresses.map((address) => (
                <article key={address.id} className="address-item">
                  <div>
                    <h3>
                      {address.full_name}
                      {address.is_default && <span className="pill">Default</span>}
                    </h3>
                    <p>{address.phone}</p>
                    <p>{address.line1}</p>
                    {address.line2 && <p>{address.line2}</p>}
                    <p>
                      {address.city}, {address.state} {address.postal_code}
                    </p>
                    <p>{address.country}</p>
                  </div>
                  <button type="button" className="ghost-danger" onClick={() => handleDeleteAddress(address.id)}>
                    Remove
                  </button>
                  {deleteError && <p className="profile-error">{deleteError}</p>}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="profile-card">
          <div className="section-head">
            <div>
              <h2>Order History</h2>
              <p>Every checkout is saved here per user.</p>
            </div>
          </div>

          <div className="order-list">
            {(profile?.orders || []).length === 0 ? (
              <p>No orders yet. When you checkout from the cart, they will appear here.</p>
            ) : (
              profile.orders.map((order) => (
                <article key={order.id} className="order-item">
                  <div className="order-top">
                    <div>
                      <h3>Order #{order.id}</h3>
                      <p>{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <strong>${Number(order.total_amount).toFixed(2)}</strong>
                  </div>
                  <ul>
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.product_name} x {item.quantity} - ${Number(item.line_total).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="profile-card profile-card-full">
          <div className="section-head">
            <div>
              <h2>Wishlist</h2>
              <p>Saved products stay here until you are ready to buy them.</p>
            </div>
            <Link to="/" className="inline-link">
              Browse store
            </Link>
          </div>

          <div className="wishlist-grid">
            {(profile?.wishlist || []).length === 0 ? (
              <p>No wishlist items yet.</p>
            ) : (
              profile.wishlist.map((entry) => (
                <article key={entry.id} className="wishlist-item">
                  {entry.product?.image && (
                    <img src={entry.product.image} alt={entry.product.name} />
                  )}
                  <div>
                    <h3>{entry.product?.name}</h3>
                    <p>{entry.product?.description || 'No description available.'}</p>
                    <strong>${Number(entry.product?.price || 0).toFixed(2)}</strong>
                  </div>
                  <div className="wishlist-actions">
                    <Link to={`/product/${entry.product?.id}`} className="inline-link">
                      View product
                    </Link>
                    <button
                      type="button"
                      className="ghost-danger"
                      onClick={() => handleRemoveWishlist(entry.product?.id)}
                      disabled={busyWishlistId === entry.product?.id}
                    >
                      {busyWishlistId === entry.product?.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from '../api.js';
import './AdminPage.css';

const emptyForm = {
  name: '',
  price: '',
  description: '',
  image: '',
};

export default function AdminPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError('');
    try {
      const data = await getProducts();
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err) {
      setError(err?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name || '',
      price: String(product.price ?? ''),
      description: product.description || '',
      image: product.image || '',
    });
    setSuccess('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      name: form.name,
      price: form.price,
      description: form.description,
      image: form.image,
    };
    try {
      if (editingId) {
        const data = await updateProduct(editingId, payload);
        setProducts((current) =>
          current.map((product) => (product.id === editingId ? data.product : product))
        );
        setSuccess('Product updated successfully.');
      } else {
        const data = await createProduct(payload);
        setProducts((current) => [...current, data.product].sort((a, b) => a.id - b.id));
        setSuccess('Product created successfully.');
      }
      resetForm();
    } catch (err) {
      setError(err?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId) {
    const confirmed = window.confirm('Delete this product?');
    if (!confirmed) return;

    setError('');
    setSuccess('');
    try {
      await deleteProduct(productId);
      setProducts((current) => current.filter((product) => product.id !== productId));
      if (editingId === productId) {
        resetForm();
      }
      setSuccess('Product deleted successfully.');
    } catch (err) {
      setError(err?.message || 'Failed to delete product');
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <p className="admin-eyebrow">Admin</p>
          <h1>Manage Products</h1>
          <p className="admin-subtitle">
            Create, edit, and delete products from one place.
          </p>
        </div>
      </div>

      <div className="admin-layout">
        <section className="admin-panel">
          <h2>{editingId ? 'Edit Product' : 'Add Product'}</h2>
          <form className="admin-form" onSubmit={handleSubmit}>
            <label>
              Name
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Product name"
                required
              />
            </label>

            <label>
              Price
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                placeholder="99.99"
                required
              />
            </label>

            <label>
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Short product description"
                rows="5"
              />
            </label>

            <label>
              Image URL
              <input
                name="image"
                value={form.image}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
              />
            </label>

            <div className="admin-actions">
              <button type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
              </button>
              {editingId && (
                <button type="button" className="secondary-button" onClick={resetForm}>
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          {error && <p className="status-message error">{error}</p>}
          {success && <p className="status-message success">{success}</p>}
        </section>

        <section className="admin-panel">
          <div className="product-list-header">
            <h2>Product Inventory</h2>
            <button type="button" className="secondary-button" onClick={loadProducts}>
              Refresh
            </button>
          </div>

          {loading ? (
            <p>Loading products...</p>
          ) : products.length === 0 ? (
            <p>No products found.</p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.id}</td>
                      <td>{product.name}</td>
                      <td>${Number(product.price).toFixed(2)}</td>
                      <td>{product.description || 'No description'}</td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => startEdit(product)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => handleDelete(product.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

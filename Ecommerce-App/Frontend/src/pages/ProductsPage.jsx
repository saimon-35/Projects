import { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { getProducts } from '../api.js';
import './ProductsPage.css';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Fetch products with search/filter parameters
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const searchParams = {};
        if (searchTerm) searchParams.search = searchTerm;
        if (minPrice !== '') searchParams.minPrice = parseFloat(minPrice);
        if (maxPrice !== '') searchParams.maxPrice = parseFloat(maxPrice);
        
        
        const data = await getProducts(searchParams);
        if (!cancelled) setProducts(Array.isArray(data.products) ? data.products : []);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [searchTerm, minPrice, maxPrice]);

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setMinPrice('');
    setMaxPrice('');
  };

  return (
    <div className="products-page">
      <h1>Products</h1>
      
      {/* Search and Filter Form */}
      <form className="search-filter-form">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-container">
          <div className="price-filter">
            <label>
              Min Price:
              <input
                type="number"
                placeholder="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                min="0"
                step="0.01"
                className="price-input"
              />
            </label>
            
            <label>
              Max Price:
              <input
                type="number"
                placeholder="1000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                min="0"
                step="0.01"
                className="price-input"
              />
            </label>
          </div>
          
          <button type="button" onClick={resetFilters} className="reset-button">
            Reset Filters
          </button>
        </div>
      </form>
      
      {!import.meta.env.VITE_API_URL && (
        <p className="env-warn">
          Set <code>VITE_API_URL</code> in <code>.env.development</code> (e.g.{' '}
          <code>http://127.0.0.1:5000</code>) and restart Vite.
        </p>
      )}
      
      {loading && <p>Loading…</p>}
      {error && (
        <p role="alert">
          Error: {error}
        </p>
      )}
      
      {!loading && !error && (
        <>
          <p className="results-count">{products.length} products found</p>
          {products.length === 0 ? (
            <p>No products match your search criteria.</p>
          ) : (
            <ul className="product-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

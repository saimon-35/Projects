import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { searchProducts } from '../api';
import { getDepartmentLabel, PRODUCT_SORT_OPTIONS } from '../searchConfig';
import './SearchResultsPage.css';

const PAGE_SIZE = 12;

function buildPageList(currentPage, totalPages) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);

  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
}

export default function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ totalResults: 0, currentPage: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || 'relevance';
  const page = Math.max(Number(searchParams.get('page') || 1), 1);

  const pageNumbers = useMemo(
    () => buildPageList(meta.currentPage, meta.totalPages),
    [meta.currentPage, meta.totalPages]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadResults() {
      setLoading(true);
      setError(null);
      try {
        const data = await searchProducts({
          q: query,
          category,
          sort,
          page,
          perPage: PAGE_SIZE,
        });

        if (!cancelled) {
          setProducts(Array.isArray(data.products) ? data.products : []);
          setMeta({
            totalResults: data.totalResults || 0,
            currentPage: data.currentPage || 1,
            totalPages: data.totalPages || 1,
          });
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load search results');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadResults();
    return () => {
      cancelled = true;
    };
  }, [query, category, sort, page]);

  const updateParam = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortChange = (event) => {
    updateParam({ sort: event.target.value, page: 1 });
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > meta.totalPages || nextPage === meta.currentPage) return;
    updateParam({ page: nextPage });
  };

  const resultsCopy = query
    ? `Showing ${meta.totalResults} result${meta.totalResults === 1 ? '' : 's'} for "${query}"`
    : `Showing ${meta.totalResults} result${meta.totalResults === 1 ? '' : 's'}`;

  return (
    <main className="search-page">
      <section className="search-results-shell">
        <div className="search-results-topbar">
          <div>
            <p className="search-breadcrumb">
              {category === 'all' ? 'All departments' : getDepartmentLabel(category)}
            </p>
            <h1>{resultsCopy}</h1>
          </div>

          <label className="search-sort-control">
            <span>Sort by</span>
            <select value={sort} onChange={handleSortChange}>
              {PRODUCT_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!import.meta.env.VITE_API_URL && (
          <div className="search-env-warn">
            Set <code>VITE_API_URL</code> in <code>.env.development</code> and restart Vite.
          </div>
        )}

        {loading && (
          <div className="search-loading-grid" aria-label="Loading search results">
            {Array.from({ length: 8 }).map((_, index) => (
              <div className="search-skeleton-card" key={index}>
                <div className="search-skeleton-image" />
                <div className="search-skeleton-line wide" />
                <div className="search-skeleton-line" />
                <div className="search-skeleton-button" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="search-state">
            <h2>Search is temporarily unavailable</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Try again</button>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="search-state">
            <h2>No results found</h2>
            <p>Try a broader keyword or switch the department back to All.</p>
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <>
            <ul className="search-product-grid">
              {products.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>

            <nav className="pagination" aria-label="Search results pagination">
              <button
                type="button"
                onClick={() => handlePageChange(meta.currentPage - 1)}
                disabled={meta.currentPage <= 1}
              >
                Previous
              </button>

              {pageNumbers.map((pageNumber) => (
                <button
                  type="button"
                  key={pageNumber}
                  className={pageNumber === meta.currentPage ? 'active' : ''}
                  onClick={() => handlePageChange(pageNumber)}
                  aria-current={pageNumber === meta.currentPage ? 'page' : undefined}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                type="button"
                onClick={() => handlePageChange(meta.currentPage + 1)}
                disabled={meta.currentPage >= meta.totalPages}
              >
                Next
              </button>
            </nav>
          </>
        )}
      </section>
    </main>
  );
}

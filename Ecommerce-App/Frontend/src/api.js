const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
    }
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export function getProducts(searchParams = {}) {
  const { search, minPrice, maxPrice } = searchParams;
  let url = '/api/products';
  
  const queryParams = [];
  if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
  if (minPrice !== undefined) queryParams.push(`min_price=${minPrice}`);
  if (maxPrice !== undefined) queryParams.push(`max_price=${maxPrice}`);
  
  if (queryParams.length > 0) {
    url += '?' + queryParams.join('&');
  }
  
  return request(url);
}

export function searchProducts(params = {}) {
  const {
    q = '',
    category = 'all',
    sort = 'relevance',
    page = 1,
    perPage = 12,
  } = params;

  const queryParams = new URLSearchParams();
  if (q) queryParams.set('q', q);
  queryParams.set('category', category || 'all');
  queryParams.set('sort', sort || 'relevance');
  queryParams.set('page', String(page || 1));
  queryParams.set('per_page', String(perPage || 12));

  return request(`/api/products/search?${queryParams.toString()}`);
}

export function getProduct(id) {
  return request(`/api/products/${id}`);
}

export function createProduct(payload) {
  return request('/api/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProduct(id, payload) {
  return request(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteProduct(id) {
  return request(`/api/products/${id}`, {
    method: 'DELETE',
  });
}

export function getAdminDashboard() {
  return request('/api/admin/dashboard');
}

export function getProfile() {
  return request('/api/profile');
}

export function createAddress(payload) {
  return request('/api/profile/addresses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteAddress(id) {
  return request(`/api/profile/addresses/${id}`, {
    method: 'DELETE',
  });
}

export function addToWishlist(productId) {
  return request('/api/profile/wishlist', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId }),
  });
}

export function removeFromWishlist(productId) {
  return request(`/api/profile/wishlist/${productId}`, {
    method: 'DELETE',
  });
}

// ─── Legacy direct-order (kept for non-payment flows) ────────────────────────
export function createOrder(payload) {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Upload a product image (multipart/form-data).
 * Returns { url, filename }
 */
export function uploadProductImage(file) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('image', file);

  return fetch(apiUrl('/api/upload/product-image'), {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Do NOT set Content-Type here – browser sets it with the boundary
    },
    body: formData,
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data;
    });
}

// ─── Stripe payment flow ──────────────────────────────────────────────────────

/**
 * Ask the backend to create a Stripe PaymentIntent.
 * Returns { clientSecret, amount, currency }
 */
export function createPaymentIntent(payload) {
  return request('/api/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * After Stripe confirms payment on the client, tell the backend to
 * create the Order record and return it.
 * Returns { order, message }
 */
export function confirmOrder(paymentIntentId) {
  return request('/api/payments/confirm-order', {
    method: 'POST',
    body: JSON.stringify({ payment_intent_id: paymentIntentId }),
  });
}
// ── Delivery Man endpoints ────────────────────────────────────────────────

/** Orders available to be requested (paid, no active task). */
export function getAvailableOrders() {
  return request('/api/delivery/available-orders');
}

/** All tasks belonging to the current delivery man. */
export function getMyTasks() {
  return request('/api/delivery/my-tasks');
}

/** Request to deliver an order. */
export function requestDeliveryTask(orderId) {
  return request('/api/delivery/request', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId }),
  });
}

/**
 * Advance task status (delivery man).
 * @param {number} taskId
 * @param {'picked_up'|'delivered'} status
 */
export function updateDeliveryStatus(taskId, status) {
  return request(`/api/delivery/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ── Admin delivery endpoints ──────────────────────────────────────────────

/**
 * All delivery tasks, optionally filtered by status.
 * @param {string} [status]
 */
export function adminGetDeliveryTasks(status = '') {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/api/admin/delivery/tasks${qs}`);
}

/** All paid orders with embedded delivery_task. */
export function adminGetOrdersWithDelivery() {
  return request('/api/admin/delivery/orders');
}

/** All users with role == delivery_man. */
export function adminGetDeliveryMen() {
  return request('/api/admin/delivery/delivery-men');
}

/**
 * Approve a requested task (optionally re-assign delivery man).
 * @param {number} taskId
 * @param {number} [deliveryManId]
 */
export function adminApproveTask(taskId, deliveryManId) {
  const body = deliveryManId
    ? { delivery_man_id: deliveryManId }
    : {};
  return request(`/api/admin/delivery/tasks/${taskId}/approve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Reject a requested (or assigned) task. */
export function adminRejectTask(taskId) {
  return request(`/api/admin/delivery/tasks/${taskId}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Admin directly assigns an order to a delivery man (skips request flow).
 * @param {number} orderId
 * @param {number} deliveryManId
 */
export function adminAssignTask(orderId, deliveryManId) {
  return request('/api/admin/delivery/assign', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, delivery_man_id: deliveryManId }),
  });
}

/**
 * Admin force-sets any valid status on a task.
 * @param {number} taskId
 * @param {string} status
 */
export function adminOverrideStatus(taskId, status) {
  return request(`/api/admin/delivery/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
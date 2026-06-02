import { getToken, clearToken } from '../services/storage';

const API_BASE = 'https://store-backend-npao.onrender.com/api';

let onUnauthorized = null;

export function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

async function headers(extra = {}) {
  const token = await getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function handleResponse(res) {
  if (res.status === 401) {
    const hasToken = !!(await getToken());
    if (hasToken) {
      await clearToken();
      if (onUnauthorized) onUnauthorized();
    }
    throw new Error('Session expired. Please login again.');
  }
  if (!res.ok) {
    let msg = `Server error ${res.status}`;
    try { const j = await res.json(); msg = j.error || msg; } catch { msg = 'Server returned an unexpected response.'; }
    throw new Error(msg);
  }
  const json = await res.json();
  if (json && typeof json === 'object' && 'data' in json && 'total' in json) return json.data;
  return json;
}

export const api = {
  async postWithToken(endpoint, body, customToken) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customToken}` }, body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async get(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, { headers: await headers() });
    return handleResponse(res);
  },

  async post(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST', headers: await headers(), body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async put(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT', headers: await headers(), body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async patch(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH', headers: await headers(), body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async delete(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE', headers: await headers() });
    return handleResponse(res);
  },

  // Products
  getProducts: (params) => api.get(`/products?${new URLSearchParams(params)}`),
  getProduct: (id) => api.get(`/products/${id}`),
  getProductByBarcode: (b) => api.get(`/products/barcode/${encodeURIComponent(b)}`),
  getLowStock: (t) => api.get(`/products/low-stock?threshold=${t}`),
  createProduct: (d) => api.post('/products', d),
  updateProduct: (id, d) => api.put(`/products/${id}`, d),
  updateStock: (id, s) => api.patch(`/products/${id}/stock`, { stock: s }),
  deleteProduct: (id) => api.delete(`/products/${id}`),

  // Customers
  getCustomers: (p) => api.get(`/customers?${new URLSearchParams(p)}`),
  getCustomer: (id) => api.get(`/customers/${id}`),
  getCustomerOrders: (id) => api.get(`/customers/${id}/orders`),
  createCustomer: (d) => api.post('/customers', d),
  updateCustomer: (id, d) => api.put(`/customers/${id}`, d),
  deleteCustomer: (id) => api.delete(`/customers/${id}`),

  // Orders
  getOrders: (p) => api.get(`/orders?${new URLSearchParams(p)}`),
  getOrder: (id) => api.get(`/orders/${id}`),
  createOrder: (d) => api.post('/orders', d),
  deleteOrder: (id) => api.delete(`/orders/${id}`),

  // Settings
  getSettings: () => api.get('/settings'),
  updateSettings: (d) => api.put('/settings', d),

  // Reports
  getSalesReport: (params) => api.get(`/reports/sales?${new URLSearchParams(params)}`),
  getStockValue: () => api.get('/reports/stock-value'),
  getPriceHistory: (id) => api.get(`/reports/price-history/${id}`),

  // Purchases (Stock In)
  getPurchases: (p) => api.get(`/purchases?${new URLSearchParams(p)}`),
  createPurchase: (d) => api.post('/purchases', d),

  // Categories
  getCategories: () => api.get('/categories'),
  createCategory: (d) => api.post('/categories', d),
  updateCategory: (id, d) => api.put(`/categories/${id}`, d),
  deleteCategory: (id) => api.delete(`/categories/${id}`),

  // Returns
  returnItems: (orderId, items) => api.post(`/orders/${orderId}/return`, { items }),
};

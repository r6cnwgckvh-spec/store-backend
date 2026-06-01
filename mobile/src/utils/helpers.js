import * as Crypto from 'expo-crypto';

const API_BASE = 'https://store-backend-npao.onrender.com/api';

export async function sha256(str) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, str);
}

export function formatCurrency(amount) {
  return '\u20B9' + Number(amount).toFixed(2);
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function stockStatus(stock) {
  if (stock <= 0) return { label: 'Out of Stock', color: '#dc3545', cls: 'stock-out' };
  if (stock <= 5) return { label: 'Low Stock', color: '#ffc107', cls: 'stock-low' };
  return { label: 'In Stock', color: '#28a745', cls: 'stock-in' };
}

export function getImageUrl(image_url) {
  if (!image_url) return null;
  if (image_url.startsWith('/api/')) return API_BASE + image_url;
  return `data:image/jpeg;base64,${image_url}`;
}

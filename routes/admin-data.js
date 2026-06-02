const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database');
const jwt = require('jsonwebtoken');

function getSecret() {
  const row = db.prepare('SELECT jwt_secret, id FROM store_settings WHERE user_id = 1').get();
  if (row?.jwt_secret) return row.jwt_secret;
  const secret = crypto.randomBytes(32).toString('hex');
  if (row?.id) {
    db.prepare('UPDATE store_settings SET jwt_secret = ? WHERE id = ?').run(secret, row.id);
  } else {
    db.prepare('INSERT INTO store_settings (user_id, jwt_secret, store_name, address, phone) VALUES (1, ?, ?, ?, ?)').run(secret, 'Your Store Name', '123 Main Street, City', '+91 98765 43210');
  }
  return secret;
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(header.slice(7), getSecret());
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

router.use(requireAdmin);

router.get('/users/:id/products', (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId) || userId < 1) return res.status(400).json({ error: 'Invalid user ID' });
  try {
    const products = db.prepare('SELECT * FROM products WHERE user_id = ? ORDER BY name').all(userId);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id/orders', (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId) || userId < 1) return res.status(400).json({ error: 'Invalid user ID' });
  try {
    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id/customers', (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId) || userId < 1) return res.status(400).json({ error: 'Invalid user ID' });
  try {
    const customers = db.prepare('SELECT * FROM customers WHERE user_id = ? ORDER BY name').all(userId);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id/stats', (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId) || userId < 1) return res.status(400).json({ error: 'Invalid user ID' });
  try {
    const productCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE user_id = ?').get(userId).count;
    const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders WHERE user_id = ?').get(userId).count;
    const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers WHERE user_id = ?').get(userId).count;
    const totalRevenue = db.prepare('SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE user_id = ?').get(userId).total;
    res.json({ productCount, orderCount, customerCount, totalRevenue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/products/:productId', (req, res) => {
  const userId = parseInt(req.params.id);
  const productId = parseInt(req.params.productId);
  if (isNaN(userId) || userId < 1 || isNaN(productId) || productId < 1) {
    return res.status(400).json({ error: 'Invalid user or product ID' });
  }
  const { name, barcode, price, stock, cost_price, category, description, size, min_stock, expiry_date } = req.body;
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(productId, userId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    db.prepare(`
      UPDATE products SET name = ?, barcode = ?, price = ?, stock = ?, cost_price = ?, category = ?,
        description = ?, size = ?, min_stock = ?, expiry_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      (name || product.name).trim(),
      (barcode || product.barcode).trim(),
      price !== undefined ? parseFloat(price) : product.price,
      stock !== undefined ? parseInt(stock) : product.stock,
      cost_price !== undefined ? parseFloat(cost_price) : product.cost_price,
      category !== undefined ? category : product.category,
      description !== undefined ? description : product.description,
      size !== undefined ? size : product.size,
      min_stock !== undefined ? parseInt(min_stock) : product.min_stock,
      expiry_date !== undefined ? expiry_date : product.expiry_date,
      productId, userId
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id/products/:productId', (req, res) => {
  const userId = parseInt(req.params.id);
  const productId = parseInt(req.params.productId);
  if (isNaN(userId) || userId < 1 || isNaN(productId) || productId < 1) {
    return res.status(400).json({ error: 'Invalid user or product ID' });
  }
  try {
    const result = db.prepare('DELETE FROM products WHERE id = ? AND user_id = ?').run(productId, userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id/orders/:orderId', (req, res) => {
  const userId = parseInt(req.params.id);
  const orderId = parseInt(req.params.orderId);
  if (isNaN(userId) || userId < 1 || isNaN(orderId) || orderId < 1) {
    return res.status(400).json({ error: 'Invalid user or order ID' });
  }
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    const restoreStock = db.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const transaction = db.transaction(() => {
      for (const item of items) restoreStock.run(item.quantity, item.product_id);
      db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    });
    transaction();
    res.json({ message: 'Order deleted and stock restored' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id/customers/:customerId', (req, res) => {
  const userId = parseInt(req.params.id);
  const customerId = parseInt(req.params.customerId);
  if (isNaN(userId) || userId < 1 || isNaN(customerId) || customerId < 1) {
    return res.status(400).json({ error: 'Invalid user or customer ID' });
  }
  try {
    const result = db.prepare('DELETE FROM customers WHERE id = ? AND user_id = ?').run(customerId, userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId) || userId < 1) return res.status(400).json({ error: 'Invalid user ID' });
  const { name, email, status } = req.body;
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin' && status && status !== 'approved') {
      return res.status(400).json({ error: 'Cannot change admin status' });
    }

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email.trim().toLowerCase()); }
    if (status !== undefined) {
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.push('status = ?');
      params.push(status);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(userId);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT id, email, name, status, role, created_at FROM users WHERE id = ?').get(userId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

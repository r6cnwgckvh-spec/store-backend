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

router.get('/users', (req, res) => {
  const { status } = req.query;
  let query = 'SELECT id, email, name, status, role, created_at FROM users';
  const params = [];
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';
  const users = db.prepare(query).all(...params);
  res.json(users);
});

router.post('/users/:id/approve', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid user ID' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.status !== 'pending') return res.status(400).json({ error: 'User is not in pending status' });
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run('approved', id);
  res.json({ id, status: 'approved', message: 'User approved successfully' });
});

router.post('/users/:id/reject', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid user ID' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run('rejected', id);
  res.json({ id, status: 'rejected', message: 'User rejected' });
});

router.delete('/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid user ID' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Cannot delete admin user' });
  const transaction = db.transaction(() => {
    const prodIds = db.prepare('SELECT id FROM products WHERE user_id = ?').all(id).map(r => r.id);
    for (const pid of prodIds) {
      db.prepare('DELETE FROM order_items WHERE product_id = ?').run(pid);
    }
    db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)').run(id);
    db.prepare('DELETE FROM orders WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM customers WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM purchases WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM categories WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM shopping_list_items WHERE list_id IN (SELECT id FROM shopping_lists WHERE user_id = ?)').run(id);
    db.prepare('DELETE FROM shopping_lists WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM bills WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM store_settings WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });
  try {
    transaction();
    res.json({ message: 'User and all associated data permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database');
const jwt = require('jsonwebtoken');

function getSecret() {
  const row = db.prepare('SELECT jwt_secret FROM store_settings WHERE id = 1').get();
  return row?.jwt_secret || 'fallback-dev-secret';
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
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ message: 'User deleted' });
});

module.exports = router;

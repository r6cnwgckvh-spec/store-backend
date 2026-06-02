const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database');

function getSecret() {
  const row = db.prepare('SELECT jwt_secret, id FROM store_settings WHERE user_id = 1').get();
  if (row?.jwt_secret) return row.jwt_secret;
  const crypto = require('crypto');
  const secret = crypto.randomBytes(32).toString('hex');
  if (row?.id) {
    db.prepare('UPDATE store_settings SET jwt_secret = ? WHERE id = ?').run(secret, row.id);
  } else {
    db.prepare('INSERT INTO store_settings (user_id, jwt_secret, store_name, address, phone) VALUES (1, ?, ?, ?, ?)').run(secret, 'Your Store Name', '123 Main Street, City', '+91 98765 43210');
  }
  return secret;
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(header.slice(7), getSecret());
    next();
  } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}

router.get('/', auth, (req, res) => {
  const bills = db.prepare('SELECT * FROM bills WHERE user_id = ? ORDER BY created_at DESC').all(req.user.userId);
  res.json(bills);
});

router.get('/:id', auth, (req, res) => {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  res.json(bill);
});

router.post('/', auth, (req, res) => {
  const { image_data, notes, bill_date, total_amount } = req.body;
  if (!image_data) return res.status(400).json({ error: 'Image data is required' });
  const result = db.prepare(
    'INSERT INTO bills (user_id, image_data, notes, bill_date, total_amount) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.userId, image_data, notes || '', bill_date || '', Math.max(0, parseFloat(total_amount) || 0));
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  const { notes, bill_date, total_amount } = req.body;
  db.prepare('UPDATE bills SET notes = ?, bill_date = ?, total_amount = ? WHERE id = ? AND user_id = ?')
    .run(notes ?? bill.notes, bill_date ?? bill.bill_date, Math.max(0, parseFloat(total_amount) ?? bill.total_amount), req.params.id, req.user.userId);
  res.json({ success: true });
});

router.delete('/:id', auth, (req, res) => {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  db.prepare('DELETE FROM bills WHERE id = ? AND user_id = ?').run(req.params.id, req.user.userId);
  res.json({ success: true });
});

module.exports = router;

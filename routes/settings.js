const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  let settings = db.prepare('SELECT id, user_id, store_name, address, phone, email, tax_id, currency_symbol, currency_code FROM store_settings WHERE user_id = ?').get(req.user.userId);
  if (!settings) {
    db.prepare('INSERT INTO store_settings (user_id, store_name, address, phone, email, tax_id, currency_symbol, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      req.user.userId, 'Your Store Name', '123 Main Street, City', '+91 98765 43210', '', '', '\u20B9', 'INR'
    );
    settings = db.prepare('SELECT id, user_id, store_name, address, phone, email, tax_id, currency_symbol, currency_code FROM store_settings WHERE user_id = ?').get(req.user.userId);
  }
  res.json(settings);
});

router.put('/', (req, res) => {
  const { store_name, address, phone, email, tax_id, currency_symbol, currency_code } = req.body;
  try {
    const result = db.prepare(`
      UPDATE store_settings SET store_name = ?, address = ?, phone = ?, email = ?, tax_id = ?, currency_symbol = ?, currency_code = ?
      WHERE user_id = ?
    `).run(
      store_name || '', address || '', phone || '', email || '', tax_id || '',
      currency_symbol || '\u20B9', currency_code || 'INR', req.user.userId
    );
    if (result.changes === 0) {
      db.prepare('INSERT INTO store_settings (user_id, store_name, address, phone, email, tax_id, currency_symbol, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        req.user.userId, store_name || '', address || '', phone || '', email || '', tax_id || '', currency_symbol || '\u20B9', currency_code || 'INR'
      );
    }
    const settings = db.prepare('SELECT id, user_id, store_name, address, phone, email, tax_id, currency_symbol, currency_code FROM store_settings WHERE user_id = ?').get(req.user.userId);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const settings = db.prepare('SELECT id, store_name, address, phone, email, tax_id, currency_symbol, currency_code FROM store_settings WHERE id = 1').get();
  res.json(settings);
});

router.put('/', (req, res) => {
  const { store_name, address, phone, email, tax_id, currency_symbol, currency_code } = req.body;
  try {
    db.prepare(`
      UPDATE store_settings SET store_name = ?, address = ?, phone = ?, email = ?, tax_id = ?, currency_symbol = ?, currency_code = ?
      WHERE id = 1
    `).run(
      store_name || '', address || '', phone || '', email || '', tax_id || '',
      currency_symbol || '\u20B9', currency_code || 'INR'
    );
    const settings = db.prepare('SELECT id, store_name, address, phone, email, tax_id, currency_symbol, currency_code FROM store_settings WHERE id = 1').get();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { search, page, limit } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  let countQuery = 'SELECT COUNT(*) as total FROM customers';
  let query = 'SELECT * FROM customers';
  let where = ' WHERE user_id = ?';
  const params = [req.user.userId];

  if (search) {
    where += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const { total } = db.prepare(countQuery + where).get(...params);
  const customers = db.prepare(query + where + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params, limitNum, offset);
  res.json({ data: customers, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
});

router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid customer ID' });
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND user_id = ?').get(id, req.user.userId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

router.get('/:id/orders', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid customer ID' });
  const orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? AND user_id = ? ORDER BY created_at DESC').all(id, req.user.userId);
  res.json(orders);
});

router.post('/', (req, res) => {
  const { name, phone, email, address } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO customers (name, phone, email, address, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), (phone || '').trim(), (email || '').trim(), (address || '').trim(), req.user.userId);

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { name, phone, email, address } = req.body;
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid customer ID' });
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }
  try {
    const result = db.prepare('UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ? AND user_id = ?')
      .run(name.trim(), (phone || '').trim(), (email || '').trim(), (address || '').trim(), id, req.user.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Customer not found' });

    const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND user_id = ?').get(id, req.user.userId);
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid customer ID' });
  try {
    const result = db.prepare('DELETE FROM customers WHERE id = ? AND user_id = ?').run(id, req.user.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

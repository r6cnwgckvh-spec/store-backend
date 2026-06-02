const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c LEFT JOIN products p ON LOWER(p.category) = LOWER(c.name) AND p.user_id = ?
    GROUP BY c.id ORDER BY c.name
  `).all(req.user.userId);
  res.json(categories);
});

router.post('/', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = db.prepare('INSERT INTO categories (name, color, user_id) VALUES (?, ?, ?)').run(name, color || '#007bff', req.user.userId);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(cat);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Category already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid category ID' });
  const { name, color } = req.body;
  try {
    db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(name, color, id, req.user.userId);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, req.user.userId);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    res.json(cat);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid category ID' });
  try {
    const cat = db.prepare('SELECT name FROM categories WHERE id = ? AND user_id = ?').get(id, req.user.userId);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE products SET category = ? WHERE category = ? AND user_id = ?').run('', cat.name, req.user.userId);
    db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, req.user.userId);
    res.json({ message: 'Category deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

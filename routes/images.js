const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../database');

function getSecret() {
  const row = db.prepare('SELECT jwt_secret FROM store_settings WHERE user_id = 1').get();
  if (row?.jwt_secret) return row.jwt_secret;
  const secret = crypto.randomBytes(32).toString('hex');
  db.prepare('UPDATE store_settings SET jwt_secret = ? WHERE user_id = 1').run(secret);
  return secret;
}

router.post('/', (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Auth required' });
  try { jwt.verify(header.slice(7), getSecret()); } catch { return res.status(401).json({ error: 'Invalid token' }); }

  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'No image data provided' });

  const result = db.prepare('INSERT INTO product_images (image_data) VALUES (?)').run(image);
  res.json({ id: result.lastInsertRowid, url: `/api/images/${result.lastInsertRowid}` });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT image_data FROM product_images WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Image not found' });
  const base64Data = row.image_data;
  const imgBuf = Buffer.from(base64Data, 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Content-Length': imgBuf.length,
    'Cache-Control': 'public, max-age=86400',
  });
  res.end(imgBuf);
});

module.exports = router;

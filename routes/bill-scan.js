const express = require('express');
const router = express.Router();
const https = require('https');
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

function getApiKey() {
  if (process.env.OCR_SPACE_API_KEY) return process.env.OCR_SPACE_API_KEY;
  const row = db.prepare('SELECT ocr_space_api_key FROM store_settings WHERE user_id = 1').get();
  if (row?.ocr_space_api_key) return row.ocr_space_api_key;
  if (process.env.GCP_API_KEY) return `gcp:${process.env.GCP_API_KEY}`;
  const gcp = db.prepare('SELECT gcp_api_key FROM store_settings WHERE user_id = 1').get();
  if (gcp?.gcp_api_key) return `gcp:${gcp.gcp_api_key}`;
  return '';
}

function parseBillText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items = [];
  const skipWords = ['total', 'gst', 'tax', 'bill', 'invoice', 'store', 'shop', 'address',
    'phone', 'date', 'cash', 'change', 'discount', 'sub total', 'subtotal', 'qty',
    'rate', 'amount', 'hsn', 'sac', 'particulars', 'description', 'item', 'sl no',
    's.no', 's. no', '#', 'name', 'price', 'cgst', 'sgst', 'igst', 'round',
    'thank', 'welcome', 'mrp', 'batch', 'expiry', 'free', 'offer'];

  for (const line of lines) {
    const lower = line.toLowerCase().trim();

    // Skip lines that are too short or are header/footer
    if (lower.length < 6) continue;
    const words = lower.split(/\s+/);
    const skipRatio = words.filter(w => skipWords.some(s => w.includes(s))).length / words.length;
    if (skipRatio > 0.4) continue;
    if (/^\d+[\.\s]/.test(line)) continue; // line numbers
    if (/^[0-9\s\-−–()\/]+$/.test(line.replace(/\s/g, ''))) continue; // only numbers/symbols

    // Try to extract: name, quantity, amount/rate
    // Pattern 1: Name  Qty  Rate  Amount  (e.g., "Paracetamol 500mg  10  5.00  50.00")
    // Pattern 2: Name  Qty  Amount  (e.g., "Paracetamol 10  50.00")
    // Pattern 3: Name  Amount  (e.g., "Paracetamol  50.00")

    const numbers = line.match(/\d+\.?\d*/g) || [];
    if (numbers.length < 1) continue;

    // Find price-like numbers (decimal or large)
    const prices = numbers.filter(n => n.includes('.') || parseFloat(n) > 10);
    const qtyCandidates = numbers.filter(n => !n.includes('.') && parseFloat(n) <= 999);

    let name = line;
    let quantity = 1;
    let rate = 0;
    let amount = 0;

    if (prices.length >= 2) {
      // Name  Qty  Rate  Amount
      rate = parseFloat(prices[0]);
      amount = parseFloat(prices[1]);
      const lastPriceIdx = line.lastIndexOf(prices[1]);
      const secondLastPriceIdx = line.lastIndexOf(prices[0], lastPriceIdx - 1);
      name = line.substring(0, Math.min(secondLastPriceIdx, lastPriceIdx)).trim();
      if (qtyCandidates.length > 0) {
        const qtyStr = qtyCandidates[qtyCandidates.length - 1];
        const qtyIdx = line.indexOf(qtyStr);
        if (qtyIdx > 0 && qtyIdx < Math.min(secondLastPriceIdx, lastPriceIdx)) {
          quantity = parseInt(qtyStr);
        }
      }
    } else if (prices.length === 1) {
      // Name  Amount  (with optional qty)
      amount = parseFloat(prices[0]);
      const priceIdx = line.lastIndexOf(prices[0]);
      name = line.substring(0, priceIdx).trim();
      if (qtyCandidates.length > 0) {
        const qtyStr = qtyCandidates[qtyCandidates.length - 1];
        const qtyIdx = line.indexOf(qtyStr);
        if (qtyIdx > 0 && qtyIdx < priceIdx) {
          quantity = parseInt(qtyStr);
        }
      }
    }

    name = name.replace(/[×xX*]\s*\d+/g, '').replace(/@\s*\d+\.?\d*/g, '').trim();
    name = name.replace(/[^a-zA-Z0-9\s\.\-\/]/g, '').trim();
    name = name.replace(/\s+/g, ' ');

    if (name.length < 3) continue;
    if (skipWords.some(w => name.toLowerCase().includes(w))) continue;
    if (items.some(i => i.name.toLowerCase() === name.toLowerCase())) continue;

    items.push({
      name,
      quantity: Math.max(1, quantity),
      cost_price: 0,
      selling_price: Math.max(0, amount / Math.max(1, quantity)),
      amount: Math.max(0, amount),
    });
  }

  return items.slice(0, 100);
}

router.post('/extract', auth, (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'Image data is required' });

  const apiKey = getApiKey();
  if (!apiKey) return res.status(400).json({ error: 'No OCR API key configured. Get a free key at https://ocr.space/ocrapi and save it in Settings.' });

  if (apiKey.startsWith('gcp:')) {
    // Fallback to Google Cloud Vision
    const gcpKey = apiKey.slice(4);
    const requestBody = JSON.stringify({
      requests: [{
        image: { content: image },
        features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
      }],
    });
    const options = {
      hostname: 'vision.googleapis.com',
      path: `/v1/images:annotate?key=${gcpKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };
    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', (chunk) => data += chunk);
      apiRes.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.error) return res.status(400).json({ error: result.error.message });
          const text = result.responses?.[0]?.fullTextAnnotation?.text || '';
          const items = parseBillText(text);
          return res.json({ text, items, count: items.length });
        } catch (e) {
          return res.status(500).json({ error: 'Failed to parse OCR result' });
        }
      });
    });
    apiReq.on('error', (e) => res.status(500).json({ error: e.message }));
    apiReq.write(requestBody);
    apiReq.end();
    return;
  }

  // Use OCR.space
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="apikey"',
    '',
    apiKey,
    `--${boundary}`,
    'Content-Disposition: form-data; name="base64Image"',
    '',
    `data:image/jpeg;base64,${image}`,
    `--${boundary}`,
    'Content-Disposition: form-data; name="language"',
    '',
    'eng',
    `--${boundary}`,
    'Content-Disposition: form-data; name="isOverlayRequired"',
    '',
    'false',
    `--${boundary}--`,
  ].join('\r\n');

  const options = {
    hostname: 'api.ocr.space',
    path: '/parse/image',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => data += chunk);
    apiRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.IsErroredOnProcessing) {
          return res.status(400).json({ error: result.ErrorMessage?.[0] || 'OCR failed' });
        }
        const text = (result.ParsedResults?.[0]?.ParsedText || '').trim();
        const items = parseBillText(text);
        res.json({ text, items, count: items.length });
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse OCR result' });
      }
    });
  });

  apiReq.on('error', (e) => res.status(500).json({ error: e.message }));
  apiReq.write(body);
  apiReq.end();
});

router.post('/', auth, (req, res) => {
  const { items, notes, image_data } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }

  const transaction = db.transaction(() => {
    const results = { purchase_ids: [], created: [], updated: [], skipped: [] };

    for (const item of items) {
      const name = (item.name || '').trim();
      if (!name) { results.skipped.push({ reason: 'no name', item }); continue; }

      const quantity = Math.max(1, parseInt(item.quantity) || 1);
      const cost_price = Math.max(0, parseFloat(item.cost_price) || 0);
      const selling_price = Math.max(0, parseFloat(item.selling_price) || 0);
      const tablets_per_strip = Math.max(1, parseInt(item.tablets_per_strip) || 1);
      const category = (item.category || '').trim();
      const barcode = (item.barcode || '').trim();
      const expiry_date = (item.expiry_date || '').trim();

      let product = null;
      if (barcode) {
        product = db.prepare('SELECT * FROM products WHERE barcode = ? AND user_id = ?').get(barcode, req.user.userId);
      }

      if (product) {
        const newStock = product.stock + quantity;
        const newPrice = selling_price > 0 ? selling_price : product.price;
        db.prepare('UPDATE products SET stock = ?, price = ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newStock, newPrice, cost_price > 0 ? cost_price : product.cost_price, product.id);
        results.updated.push({ id: product.id, name: product.name, stock: newStock });
        const pid = db.prepare(
          'INSERT INTO purchases (product_id, product_name, quantity, cost_price, supplier, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(product.id, product.name, quantity, cost_price, notes || '', '', req.user.userId).lastInsertRowid;
        results.purchase_ids.push(pid);
      } else {
        const safeBarcode = barcode || `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const existing = db.prepare('SELECT id FROM products WHERE barcode = ? AND user_id = ?').get(safeBarcode, req.user.userId);
        if (existing) {
          results.skipped.push({ reason: 'barcode conflict', item });
          continue;
        }
        const pid = db.prepare(`
          INSERT INTO products (barcode, name, price, stock, cost_price, category, tablets_per_strip, expiry_date, image_url, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(safeBarcode, name, selling_price, quantity, cost_price, category, tablets_per_strip, expiry_date, image_data || '', req.user.userId).lastInsertRowid;
        const purchaseId = db.prepare(
          'INSERT INTO purchases (product_id, product_name, quantity, cost_price, supplier, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(pid, name, quantity, cost_price, notes || '', '', req.user.userId).lastInsertRowid;
        results.purchase_ids.push(purchaseId);
        results.created.push({ id: pid, name, barcode: safeBarcode });
      }
    }

    return results;
  });

  try {
    const results = transaction();
    res.status(201).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

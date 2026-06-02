const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');

const app = express();

const productsRouter = require('./routes/products');
const customersRouter = require('./routes/customers');
const ordersRouter = require('./routes/orders');
const settingsRouter = require('./routes/settings');
const reportsRouter = require('./routes/reports');
const purchasesRouter = require('./routes/purchases');
const categoriesRouter = require('./routes/categories');
const backupRouter = require('./routes/backup');
const authRouter = require('./routes/auth');
const imagesRouter = require('./routes/images');
const adminRouter = require('./routes/admin');
const adminDataRouter = require('./routes/admin-data');
const shoppingListsRouter = require('./routes/shopping-lists');
const billScanRouter = require('./routes/bill-scan');
const billsRouter = require('./routes/bills');
const authMiddleware = require('./middleware/auth');

app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));
app.disable('x-powered-by');

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later' },
});

const backupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Backup/restore rate limit exceeded' },
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.headers['content-type'] !== 'application/json' && !req.path.startsWith('/admin')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  next();
});

app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/images', imagesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin', adminDataRouter);
app.use('/api/backup', backupLimiter);
app.use('/api/bill-scan', billScanRouter);
app.use('/api/bills', billsRouter);

app.use(authMiddleware);

app.use('/api/products', productsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/backup', backupRouter);
app.use('/api/shopping-lists', shoppingListsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.use((req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

const HTTP_PORT = process.env.PORT || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

const networkInterfaces = os.networkInterfaces();
const addresses = [];
for (const name of Object.keys(networkInterfaces)) {
  for (const iface of networkInterfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      addresses.push({ name, address: iface.address });
    }
  }
}

http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`\nHTTP Server running on port ${HTTP_PORT}`);
  console.log(`  Local:   http://localhost:${HTTP_PORT}`);
  for (const addr of addresses) {
    if (!addr.address.startsWith('169.254')) {
      console.log(`  Network: http://${addr.address}:${HTTP_PORT}  (${addr.name})`);
    }
  }
  console.log(`\nFor camera scanning on phone, use HTTPS below`);
});

const certPath = path.join(__dirname, 'certs', 'cert.pem');
const keyPath = path.join(__dirname, 'certs', 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const httpsOptions = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
  https.createServer(httpsOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`\nHTTPS Server running on port ${HTTPS_PORT} (for camera access)`);
    for (const addr of addresses) {
      if (!addr.address.startsWith('169.254')) {
        console.log(`  Network: https://${addr.address}:${HTTPS_PORT}  (${addr.name})`);
      }
    }
    console.log(`\nOpen the HTTPS URL on your phone`);
    console.log(`Your phone will show a security warning - tap "Show Details" then "Visit Website"`);
  });
}

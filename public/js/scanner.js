let html5QrCode = null;
let scannerMode = 'add';

function openScanner(mode = 'add') {
  scannerMode = mode;
  document.getElementById('scannerModal').classList.remove('hidden');
  document.getElementById('scannerResult').textContent = '';

  setTimeout(() => startScanner(), 300);
}

function closeScanner() {
  stopScanner();
  document.getElementById('scannerModal').classList.add('hidden');
}

function startScanner() {
  const container = document.getElementById('scannerContainer');
  container.innerHTML = '';

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("scannerContainer");
  }

  const config = {
    fps: 15,
    qrbox: { width: 250, height: 150 },
    aspectRatio: 1.0,
  };

  html5QrCode.start(
    { facingMode: "environment" },
    config,
    onScanSuccess,
    onScanFailure
  ).catch(err => {
    document.getElementById('scannerResult').textContent = 'Camera error: ' + err;
    document.getElementById('scannerResult').style.color = '#dc3545';
  });
}

function stopScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().catch(() => {});
  }
}

function onScanSuccess(decodedText) {
  stopScanner();

  const resultEl = document.getElementById('scannerResult');
  resultEl.textContent = 'Scanned: ' + decodedText;
  resultEl.style.color = '#28a745';

  setTimeout(() => {
    closeScanner();

    if (scannerMode === 'add') {
      navigate(`products/add?barcode=${encodeURIComponent(decodedText)}`);
    } else if (scannerMode === 'sell') {
      addToCartByBarcode(decodedText);
    } else {
      const cb = window._scannerCallback;
      if (cb) { cb(decodedText); window._scannerCallback = null; }
    }
  }, 500);
}

function onScanFailure(err) {
  // Silently ignore - scanner keeps trying
}

// For generic scanning with callback
function scanWithCallback(callback) {
  window._scannerCallback = callback;
  openScanner('callback');
}

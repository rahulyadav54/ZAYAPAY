const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pubDir = path.resolve(rootDir, 'public');

if (!fs.existsSync(pubDir)) {
  fs.mkdirSync(pubDir, { recursive: true });
}

// 1. Copy store pages & outcome aliases
const storeSrc = path.resolve(rootDir, 'apps/coin-wallet-store/src');
if (fs.existsSync(storeSrc)) {
  const storeFiles = [
    'store.html',
    'wallet.html',
    'order-success.html',
    'order-failed.html',
    'order-cancelled.html',
    'order-expired.html',
    'order-suspicious.html'
  ];

  for (const f of storeFiles) {
    const srcFile = path.resolve(storeSrc, f);
    if (fs.existsSync(srcFile)) {
      const destName = f === 'store.html' ? 'index.html' : f;
      fs.copyFileSync(srcFile, path.resolve(pubDir, destName));
    }
  }

  // Create friendly static aliases so URL variations never 404
  const succSrc = path.resolve(storeSrc, 'order-success.html');
  if (fs.existsSync(succSrc)) {
    fs.copyFileSync(succSrc, path.resolve(pubDir, 'order success.html'));
    fs.copyFileSync(succSrc, path.resolve(pubDir, 'order_success.html'));
    fs.copyFileSync(succSrc, path.resolve(pubDir, 'ordersuccess.html'));
    fs.copyFileSync(succSrc, path.resolve(pubDir, 'success.html'));
  }

  const failSrc = path.resolve(storeSrc, 'order-failed.html');
  if (fs.existsSync(failSrc)) {
    fs.copyFileSync(failSrc, path.resolve(pubDir, 'order failed.html'));
    fs.copyFileSync(failSrc, path.resolve(pubDir, 'order_failed.html'));
    fs.copyFileSync(failSrc, path.resolve(pubDir, 'orderfailed.html'));
    fs.copyFileSync(failSrc, path.resolve(pubDir, 'failed.html'));
  }
}

// 2. Copy SDK files
const sdkSrc = path.resolve(rootDir, 'apps/checkout-portal/src/sdk');
if (fs.existsSync(sdkSrc)) {
  fs.mkdirSync(path.resolve(pubDir, 'sdk'), { recursive: true });
  const youpiPath = path.resolve(sdkSrc, 'youpi.js');
  if (fs.existsSync(youpiPath)) {
    fs.copyFileSync(youpiPath, path.resolve(pubDir, 'youpi.js'));
    fs.copyFileSync(youpiPath, path.resolve(pubDir, 'youpi-checkout.js'));
    fs.copyFileSync(youpiPath, path.resolve(pubDir, 'sdk/youpi.js'));
    fs.copyFileSync(youpiPath, path.resolve(pubDir, 'sdk/youpi-checkout.js'));
  }
}

// 3. Ensure pre-rendered checkout portal & QR svg exist
const checkoutDir = path.resolve(pubDir, 'checkout');
fs.mkdirSync(checkoutDir, { recursive: true });

const viewCheckout = path.resolve(rootDir, 'apps/checkout-portal/src/views/checkout.html');
if (fs.existsSync(viewCheckout)) {
  let content = fs.readFileSync(viewCheckout, 'utf8');
  content = content
    .replaceAll('{{MERCHANT_NAME}}', 'ZAYA CODE HUB')
    .replaceAll('{{APP_NAME}}', 'ZAYAPAY')
    .replaceAll('{{PAYEE_VPA}}', 'zayacodehub@okhdfcbank')
    .replaceAll('{{AMOUNT}}', '1.00')
    .replaceAll('{{ORDER_ID}}', 'COIN-ORD-DEMO')
    .replaceAll('{{CURRENCY}}', 'INR');

  fs.writeFileSync(path.resolve(checkoutDir, 'demo.html'), content, 'utf8');
  fs.writeFileSync(path.resolve(checkoutDir, 'index.html'), content, 'utf8');
}

// 4. Pre-render Merchant Admin Hub
const adminSrc = path.resolve(rootDir, 'apps/merchant-admin/src/views/admin.html');
if (fs.existsSync(adminSrc)) {
  const adminDir = path.resolve(pubDir, 'admin');
  fs.mkdirSync(adminDir, { recursive: true });
  fs.copyFileSync(adminSrc, path.resolve(pubDir, 'admin.html'));
  fs.copyFileSync(adminSrc, path.resolve(adminDir, 'index.html'));
}

// 5. Ensure health check static fallback JSON files exist
const healthPayload = JSON.stringify({ status: 'UP', app: 'ZAYAPAY', mode: 'production' }, null, 2);
fs.writeFileSync(path.resolve(pubDir, 'health'), healthPayload, 'utf8');
const apiDir = path.resolve(pubDir, 'api');
fs.mkdirSync(apiDir, { recursive: true });
fs.writeFileSync(path.resolve(apiDir, 'health'), healthPayload, 'utf8');

console.log('✅ ZAYAPAY Public deployment assets assembled successfully.');

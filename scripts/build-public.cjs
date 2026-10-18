const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pubDir = path.resolve(rootDir, 'public');

if (!fs.existsSync(pubDir)) {
  fs.mkdirSync(pubDir, { recursive: true });
}

// 1. Copy store pages
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

// Copy checkout assets if available
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

console.log('✅ ZAYAPAY Public deployment assets assembled successfully.');

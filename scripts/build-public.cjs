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
    'event-registration.html',
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

  // Friendly aliases for event registration
  const eventRegSrc = path.resolve(storeSrc, 'event-registration.html');
  if (fs.existsSync(eventRegSrc)) {
    fs.copyFileSync(eventRegSrc, path.resolve(pubDir, 'register.html'));
    fs.copyFileSync(eventRegSrc, path.resolve(pubDir, 'events.html'));
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
    .replaceAll('{{PRIMARY_COLOR}}', '#0b63e5')
    .replaceAll('{{PAYEE_VPA}}', 'zayacodehub@okhdfcbank')
    .replaceAll('{{VPA}}', 'zayacodehub@okhdfcbank')
    .replaceAll('{{AMOUNT}}', '1.00')
    .replaceAll('{{ORDER_ID}}', 'COIN-ORD-DEMO')
    .replaceAll('{{PAYMENT_ID}}', 'COIN-ORD-DEMO')
    .replaceAll('{{CURRENCY}}', 'INR')
    .replaceAll('{{API_BASE_URL}}', '')
    .replaceAll('{{SERVER_HEALTH_CLASS}}', 'is-working')
    .replaceAll('{{SERVER_HEALTH_LABEL}}', 'Server Is Working')
    .replaceAll('{{DOWNTIME_ALERT_STYLE}}', 'none')
    .replaceAll('{{DOWNTIME_ALERT_CLASS}}', 'ypg-downtime-alert')
    .replaceAll('{{DOWNTIME_HEADING}}', '')
    .replaceAll('{{DOWNTIME_MSG}}', '')
    .replaceAll('{{METHOD_SELECTOR_DISPLAY}}', 'none')
    .replaceAll('{{TAB_COD_STYLE}}', 'display:none;')
    .replaceAll('{{TAB_CASH_STYLE}}', 'display:none;')
    .replaceAll('{{TAB_CARD_STYLE}}', 'display:none;')
    .replaceAll('{{PC_COD_STYLE}}', 'display:none;')
    .replaceAll('{{PC_CASH_STYLE}}', 'display:none;')
    .replaceAll('{{PC_CARD_STYLE}}', 'display:none;')
    .replaceAll('{{DOWNTIME_ALT_BTN_DISPLAY}}', 'none')
    .replaceAll('{{DOWNTIME_ALT_BTN_LABEL}}', '')
    .replaceAll('{{COUNTER_INSTRUCTIONS}}', 'Please scan the dynamic UPI QR code or present this screen at the counter.')
    .replaceAll('{{SIDEBAR_NOTICE}}', 'Fast & Secure 256-Bit Encrypted Payments')
    .replaceAll('{{LOGO_URL}}', '')
    .replaceAll('{{INITIAL_STATE_JSON}}', JSON.stringify({
      id: 'COIN-ORD-DEMO',
      orderId: 'COIN-ORD-DEMO',
      amount: '1.00',
      currency: 'INR',
      status: 'ACTIVE',
      timeRemainingSeconds: 300,
      payeeName: 'ZAYA CODE HUB',
      payeeVpa: 'zayacodehub@okhdfcbank',
      merchantName: 'ZAYA CODE HUB',
      upiServerIndicator: { status: 'WORKING', tier: 'GREEN', label: 'Server Is Working' },
      branding: { appName: 'ZAYAPAY', primaryColor: '#0b63e5' }
    }));

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

// 5. Copy Store Assets (Screenshots, mockups)
const storeAssetsSrc = path.resolve(rootDir, 'apps/coin-wallet-store/public/assets');
if (fs.existsSync(storeAssetsSrc)) {
  const assetsDest = path.resolve(pubDir, 'assets');
  fs.mkdirSync(assetsDest, { recursive: true });
  fs.cpSync(storeAssetsSrc, assetsDest, { recursive: true });
}

// 6. Copy Checkout App & Card Icons
const iconsSrc = path.resolve(rootDir, 'apps/checkout-portal/public/icons');
if (fs.existsSync(iconsSrc)) {
  const iconsDest = path.resolve(pubDir, 'icons');
  const checkoutIconsDest = path.resolve(pubDir, 'checkout/icons');
  fs.mkdirSync(iconsDest, { recursive: true });
  fs.mkdirSync(checkoutIconsDest, { recursive: true });
  fs.cpSync(iconsSrc, iconsDest, { recursive: true });
  fs.cpSync(iconsSrc, checkoutIconsDest, { recursive: true });
}

// 7. Ensure QR SVG exists in root public and checkout
const qrSrc = path.resolve(rootDir, 'public/qr.svg');
const checkoutQrDest = path.resolve(checkoutDir, 'qr.svg');
if (fs.existsSync(qrSrc)) {
  fs.copyFileSync(qrSrc, checkoutQrDest);
} else if (fs.existsSync(checkoutQrDest)) {
  fs.copyFileSync(checkoutQrDest, path.resolve(pubDir, 'qr.svg'));
}

// 8. Ensure health check static fallback JSON files exist
const healthPayload = JSON.stringify({ status: 'UP', app: 'ZAYAPAY', mode: 'production' }, null, 2);
fs.writeFileSync(path.resolve(pubDir, 'health'), healthPayload, 'utf8');
const apiDir = path.resolve(pubDir, 'api');
fs.mkdirSync(apiDir, { recursive: true });
fs.writeFileSync(path.resolve(apiDir, 'health'), healthPayload, 'utf8');

console.log('✅ ZAYAPAY Public deployment assets assembled successfully.');

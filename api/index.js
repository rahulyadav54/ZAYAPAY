import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Authoritative environment variables
process.env.YOUPI_MODE = 'production';
process.env.NODE_ENV = 'production';
process.env.DEFAULT_APP_NAME = process.env.DEFAULT_APP_NAME || 'ZAYAPAY';
process.env.SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || (process.env.VERCEL ? '/tmp/zayapay.sqlite' : path.resolve(rootDir, 'data/youpi_pg.sqlite'));

// Try loading local .env if available
try {
  const rootEnv = path.resolve(rootDir, '.env');
  if (fs.existsSync(rootEnv) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(rootEnv);
  }
} catch {}

import { createPaymentApp } from '../apps/payment-api/src/index.js';
import { CheckoutServer } from '../apps/checkout-portal/src/server.js';
import { AdminServer } from '../apps/merchant-admin/src/server.js';
import { generateQrSvg } from '../apps/checkout-portal/src/qr.js';
import { toRupeesString, buildUpiUri, PaymentStatus } from '@youpi/common';

let services = null;

function initServices() {
  if (services) return services;

  const app = createPaymentApp();
  const context = app.context;
  const db = context.db;

  const dispatchApi = (req, res) => {
    return new Promise((resolve) => {
      const origEnd = res.end;
      res.end = function(...args) {
        origEnd.apply(this, args);
        resolve();
      };
      app.rawServer.emit('request', req, res);
    });
  };

  const stateFetcher = async (paymentId) => {
    const session = context.sessionRepo.findById(paymentId);
    if (!session) return null;
    const merchant = context.merchantRepo.findById(session.merchantId);
    const snapshot = session.metadata?.receivingAccountSnapshot;
    let receivingAccount = session.receivingAccountId
      ? context.accountRepo.findById(session.receivingAccountId)
      : null;
    if (!receivingAccount && snapshot?.id) {
      receivingAccount = context.accountRepo.findById(snapshot.id);
    }
    if (!receivingAccount && session.method === 'UPI') {
      receivingAccount = context.accountRepo.findActiveForMerchant(session.merchantId);
    }

    const payeeVpa = receivingAccount?.upiId || snapshot?.upiId || 'zayacodehub@okhdfcbank';
    const payeeName = receivingAccount?.payeeName || snapshot?.payeeName || 'ZAYA CODE HUB';

    let upiUri = null;
    if (session.status === PaymentStatus.ACTIVE && payeeVpa) {
      try {
        upiUri = buildUpiUri({
          payeeVpa,
          payeeName,
          amountPaise: session.amountPaise,
          transactionRef: session.orderId,
          currency: session.currency || 'INR'
        });
      } catch {
        upiUri = null;
      }
    }

    return {
      id: session.id,
      paymentId: session.id,
      orderId: session.orderId,
      amount: toRupeesString(session.amountPaise),
      amountPaise: Number(session.amountPaise),
      currency: session.currency || 'INR',
      status: session.status,
      queuePosition: session.queuePosition || 0,
      expiresAt: session.expiresAt ? session.expiresAt.toISOString() : null,
      payeeVpa,
      payeeName,
      merchantName: merchant?.businessName || payeeName,
      upiUri,
      branding: {
        appName: 'ZAYAPAY',
        primaryColor: '#2563eb',
        ...(merchant?.branding || {})
      }
    };
  };

  const checkoutPortal = new CheckoutServer({
    apiBaseUrl: '',
    stateFetcher,
    apiHandler: dispatchApi
  });

  const adminPortal = new AdminServer({
    db,
    apiBaseUrl: '',
    apiHandler: dispatchApi
  });

  services = { app, context, dispatchApi, checkoutPortal, adminPortal, stateFetcher };
  return services;
}

function readTemplate(filename) {
  const candidates = [
    path.resolve(rootDir, 'public', filename),
    path.resolve(rootDir, 'apps/coin-wallet-store/src', filename),
    path.resolve(rootDir, 'apps/checkout-portal/src/sdk', filename),
    path.resolve(rootDir, 'apps/checkout-portal/src/views', filename)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        return fs.readFileSync(c, 'utf8');
      } catch {}
    }
  }
  return '';
}

export default async function handler(req, res) {
  const { app, context, dispatchApi, checkoutPortal, adminPortal, stateFetcher } = initServices();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Device-Id, X-Timestamp, X-Signature'
    });
    res.end();
    return;
  }

  // 1. Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'UP', app: 'ZAYAPAY', mode: 'serverless' }));
    return;
  }

  // 2. Demo Storefront: GET / and /store
  if (pathname === '/' || pathname === '/store') {
    let html = readTemplate('index.html') || readTemplate('store.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // 3. Customer Wallet: GET /wallet
  if (pathname === '/wallet' || pathname === '/wallet.html') {
    let html = readTemplate('wallet.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // 4. Standardized Outcome Pages
  // 4a. Success Outcome
  if (pathname === '/order-success' || pathname === '/success' || pathname === '/order-success.html') {
    let html = readTemplate('order-success.html');
    const orderId = url.searchParams.get('order_id') || url.searchParams.get('orderId') || 'ORD-SUCCESS-TEST';
    const amount = url.searchParams.get('amount') || '499.00';
    const utr = url.searchParams.get('utr') || url.searchParams.get('bankRef') || '987654321012';
    const mode = url.searchParams.get('mode') || url.searchParams.get('payment_mode') || 'UPI';
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    let rendered = html
      .replaceAll('{{ORDER_ID}}', orderId)
      .replaceAll('{{AMOUNT}}', amount)
      .replaceAll('{{UTR}}', utr)
      .replaceAll('{{MODE}}', mode)
      .replaceAll('{{TIMESTAMP}}', timestamp);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(rendered);
    return;
  }

  // 4b. Failed Outcome
  if (pathname === '/order-failed' || pathname === '/failed' || pathname === '/order-failed.html') {
    let html = readTemplate('order-failed.html');
    const orderId = url.searchParams.get('order_id') || url.searchParams.get('orderId') || 'ORD-FAILED-TEST';
    const reason = url.searchParams.get('reason') || 'Transaction verification timed out or declined.';

    let rendered = html
      .replaceAll('{{ORDER_ID}}', orderId)
      .replaceAll('ORDER-#', orderId)
      .replaceAll('{{REASON}}', reason);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(rendered);
    return;
  }

  // 4c. Suspicious / Review Outcome
  if (pathname === '/order-suspicious' || pathname === '/suspicious' || pathname === '/order-suspicious.html') {
    let html = readTemplate('order-suspicious.html');
    const orderId = url.searchParams.get('order_id') || url.searchParams.get('orderId') || 'ORD-SUSPICIOUS-TEST';
    let rendered = html.replaceAll('{{ORDER_ID}}', orderId);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(rendered);
    return;
  }

  // 4d. Expired Outcome
  if (pathname === '/order-expired' || pathname === '/expired' || pathname === '/order-expired.html') {
    let html = readTemplate('order-expired.html');
    const orderId = url.searchParams.get('order_id') || url.searchParams.get('orderId') || 'ORD-EXPIRED-TEST';
    let rendered = html.replaceAll('{{ORDER_ID}}', orderId);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(rendered);
    return;
  }

  // 4e. Cancelled Outcome
  if (pathname === '/order-cancelled' || pathname === '/cancelled' || pathname === '/order-cancelled.html') {
    let html = readTemplate('order-cancelled.html');
    const orderId = url.searchParams.get('order_id') || url.searchParams.get('orderId') || 'ORD-CANCELLED-TEST';
    let rendered = html.replaceAll('{{ORDER_ID}}', orderId);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(rendered);
    return;
  }

  // 5. Universal Client SDK: /youpi.js, /youpi-checkout.js, /sdk/youpi.js, /sdk/youpi-checkout.js
  if (
    pathname === '/youpi.js' ||
    pathname === '/youpi-checkout.js' ||
    pathname === '/sdk/youpi.js' ||
    pathname === '/sdk/youpi-checkout.js' ||
    pathname.startsWith('/sdk/')
  ) {
    const sdkContent = readTemplate('youpi.js') || readTemplate('youpi-checkout.js');
    if (sdkContent) {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(sdkContent);
      return;
    }
  }

  // 6. Store checkout creation: POST /api/checkout
  if (pathname === '/api/checkout' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const price = Number(data.price || data.amount || 1.00);
        const amountPaise = Math.round(price * 100);
        const orderId = `COIN-ORD-${Date.now()}`;
        const activeAccount = context.accountRepo.findActiveForMerchant('00000000-0000-0000-0000-000000000001');

        const session = context.sessionRepo.create({
          merchantId: '00000000-0000-0000-0000-000000000001',
          orderId,
          amountPaise,
          currency: 'INR',
          status: 'INITIATED',
          receivingAccountId: activeAccount?.id || null,
          metadata: {
            receivingAccountSnapshot: {
              id: activeAccount?.id || '00000000-0000-0000-0000-000000000002',
              upiId: activeAccount?.upiId || 'zayacodehub@okhdfcbank',
              payeeName: activeAccount?.payeeName || 'ZAYA CODE HUB',
              isMerchantEnabled: 1
            }
          }
        });

        // Trigger real-time sync to Supabase
        if (context.webhookEngine?.syncToSupabase) {
          context.webhookEngine.syncToSupabase(session).catch(() => {});
        }

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          orderId,
          paymentId: session.id,
          checkoutUrl: `/checkout/${session.id}`
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 7. Merchant Admin Hub: /admin and /admin/*
  if (pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin')) {
    const adminHtml = adminPortal.renderHtml();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(adminHtml);
    return;
  }

  // 8. Checkout Portal: /checkout/:id/qr.svg
  const qrMatch = pathname.match(/^\/checkout\/([^/]+)\/qr\.svg$/);
  if (qrMatch) {
    const paymentId = qrMatch[1];
    const state = await stateFetcher(paymentId);
    const payeeVpa = state?.payeeVpa || 'zayacodehub@okhdfcbank';
    const payeeName = state?.payeeName || 'ZAYA CODE HUB';
    const amount = state?.amount || '1.00';
    const upiUri = state?.upiUri || `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(amount)}&tn=${encodeURIComponent(paymentId)}`;

    const svg = generateQrSvg(upiUri, 220);
    res.writeHead(200, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(svg);
    return;
  }

  // 9. Checkout Portal: /checkout/:id
  const checkoutMatch = pathname.match(/^\/checkout\/([^/]+)$/);
  if (checkoutMatch) {
    const paymentId = checkoutMatch[1];
    const state = await stateFetcher(paymentId);
    const html = checkoutPortal.renderHtml(paymentId, state);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // 10. Gateway REST API: /api/*
  if (pathname.startsWith('/api/')) {
    return dispatchApi(req, res);
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `Not Found: ${method} ${pathname}` }));
}

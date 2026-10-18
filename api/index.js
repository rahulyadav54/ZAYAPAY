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

  // 2. Demo Storefront: GET / and /wallet
  if (pathname === '/' || pathname === '/store') {
    const storeHtmlPath = path.resolve(rootDir, 'apps/coin-wallet-store/src/store.html');
    let html = fs.readFileSync(storeHtmlPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (pathname === '/wallet') {
    const walletHtmlPath = path.resolve(rootDir, 'apps/coin-wallet-store/src/wallet.html');
    let html = fs.readFileSync(walletHtmlPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // 3. Store checkout creation: POST /api/checkout
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

  // 4. Client SDK: /sdk/*
  if (pathname.startsWith('/sdk/')) {
    const sdkPath = path.resolve(rootDir, 'apps/checkout-portal/src/sdk/youpi-checkout.js');
    if (fs.existsSync(sdkPath)) {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(fs.readFileSync(sdkPath, 'utf8'));
      return;
    }
  }

  // 5. Merchant Admin Hub: /admin and /admin/*
  if (pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin')) {
    const adminHtml = adminPortal.renderHtml();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(adminHtml);
    return;
  }

  // 6. Checkout Portal: /checkout/:id/qr.svg
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

  // 7. Checkout Portal: /checkout/:id
  const checkoutMatch = pathname.match(/^\/checkout\/([^/]+)$/);
  if (checkoutMatch) {
    const paymentId = checkoutMatch[1];
    const state = await stateFetcher(paymentId);
    const html = checkoutPortal.renderHtml(paymentId, state);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // 8. Gateway REST API: /api/*
  if (pathname.startsWith('/api/')) {
    return dispatchApi(req, res);
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `Not Found: ${method} ${pathname}` }));
}

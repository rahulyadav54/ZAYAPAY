const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pubDir = path.resolve(rootDir, 'public');
const assetsDir = path.resolve(rootDir, 'apps/coin-wallet-store/public/assets');
const pubAssetsDir = path.resolve(pubDir, 'assets');

[assetsDir, pubAssetsDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function createStaticServer(port) {
  const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    const filePath = path.join(pubDir, p);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json',
        '.css': 'text/css'
      }[ext] || 'text/plain';

      res.writeHead(200, {
        'Content-Type': mime,
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + req.url);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function captureOne({ url, width, height, filename, evalFn }) {
  const port = 9400 + Math.floor(Math.random() * 500);
  const tempProfileDir = path.join(rootDir, 'node_modules', `.edge_profile_${port}`);

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempProfileDir}`,
    `--window-size=${width},${height}`,
    url
  ], { stdio: 'ignore' });

  try {
    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await res.json();
        const page = list.find(p => p.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
    }

    if (!wsUrl) throw new Error(`Could not connect to CDP on port ${port}`);

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    function sendCommand(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const onMessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === id) {
            ws.removeEventListener('message', onMessage);
            resolve(data.result);
          }
        };
        ws.addEventListener('message', onMessage);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width <= 768
    });

    await new Promise(r => setTimeout(r, 1800));

    if (evalFn) {
      await sendCommand('Runtime.evaluate', {
        expression: `(${evalFn.toString()})()`
      });
      await new Promise(r => setTimeout(r, 1200));
    }

    const shotResult = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shotResult.data, 'base64');

    // Save to both source and public destination
    fs.writeFileSync(path.join(assetsDir, filename), buffer);
    fs.writeFileSync(path.join(pubAssetsDir, filename), buffer);
    console.log(`✅ Captured ${filename} (${buffer.length} bytes)`);

    ws.close();
  } finally {
    try { edgeProc.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(tempProfileDir, { recursive: true, force: true }); } catch (e) {}
  }
}

async function run() {
  console.log('🚀 Starting ZAYAPAY brand asset capture...');
  const server = await createStaticServer(8989);
  console.log('Static server running on http://127.0.0.1:8989');

  try {
    // 1. PC Checkout (Desktop 2-Column with ZAYA CODE HUB & ZAYAPAY)
    await captureOne({
      url: 'http://127.0.0.1:8989/checkout/demo.html',
      width: 1200,
      height: 800,
      filename: 'gateway_pc_checkout.png',
      evalFn: () => {
        const nameEl = document.getElementById('pcMerchantName');
        if (nameEl) nameEl.textContent = 'ZAYA CODE HUB';
        const trustEl = document.getElementById('pcTrustBadgeText');
        if (trustEl) trustEl.textContent = 'ZAYAPAY Trusted Business';
        const proofEl = document.getElementById('pcSocialProofText');
        if (proofEl) proofEl.textContent = '500+ orders last month from ZAYA CODE HUB';
        const priceEl = document.getElementById('pcPriceSummaryAmount');
        if (priceEl) priceEl.textContent = '₹1.00';
        const userEl = document.getElementById('pcCustomerProfileText');
        if (userEl) userEl.textContent = 'Using as Guest Customer (+91 9876543210)';
        const h = document.getElementById('upiServerHealthIndicator');
        if (h) h.className = 'ypg-server-health-indicator is-working';
        const hl = document.getElementById('serverStatusLabel');
        if (hl) hl.textContent = 'Server Is Working';
        const da = document.getElementById('serverDowntimeAlert');
        if (da) da.style.display = 'none';
        const qrContainer = document.getElementById('qrImageContainer');
        if (qrContainer && !qrContainer.querySelector('svg')) {
          qrContainer.innerHTML = '<img src="/qr.svg" style="width:100%;height:100%;object-fit:contain;" />';
        }
      }
    });

    // 2. Mobile Checkout (Native sheet with ZAYA CODE HUB & ZAYAPAY)
    await captureOne({
      url: 'http://127.0.0.1:8989/checkout/demo.html',
      width: 412,
      height: 880,
      filename: 'gateway_mobile_checkout.png',
      evalFn: () => {
        const nameEl = document.getElementById('headerMerchantName');
        if (nameEl) nameEl.textContent = 'ZAYA CODE HUB';
        const trustEl = document.getElementById('headerTrustBadgeText');
        if (trustEl) trustEl.textContent = 'ZAYAPAY Verified Business';
        const subbannerEl = document.getElementById('subbannerText');
        if (subbannerEl) subbannerEl.textContent = '200+ orders verified this month by ZAYAPAY';
        const h = document.getElementById('upiServerHealthIndicator');
        if (h) h.className = 'ypg-server-health-indicator is-working';
        const hl = document.getElementById('serverStatusLabel');
        if (hl) hl.textContent = 'Server Is Working';
        const da = document.getElementById('serverDowntimeAlert');
        if (da) da.style.display = 'none';
        const qrContainer = document.getElementById('qrImageContainer');
        if (qrContainer && !qrContainer.querySelector('svg')) {
          qrContainer.innerHTML = '<img src="/qr.svg" style="width:100%;height:100%;object-fit:contain;" />';
        }
      }
    });

    // 3. Merchant Operations Hub
    await captureOne({
      url: 'http://127.0.0.1:8989/admin/index.html',
      width: 1280,
      height: 850,
      filename: 'gateway_merchant_operations.png',
      evalFn: () => {
        if (typeof switchSection === 'function') switchSection('operations');
        const vpaBadge = document.querySelector('.vpa-badge') || document.querySelector('[data-role="vpa"]');
        if (vpaBadge) vpaBadge.textContent = 'VPA: zayacodehub@okhdfcbank';
        const brandLogo = document.querySelector('.brand-title') || document.querySelector('.brand-name');
        if (brandLogo) brandLogo.textContent = 'ZAYAPAY';
      }
    });

    // 4. Developer Dark Hub
    await captureOne({
      url: 'http://127.0.0.1:8989/admin/index.html',
      width: 1280,
      height: 850,
      filename: 'gateway_developer_dark_hub.png',
      evalFn: () => {
        if (typeof switchSection === 'function') switchSection('developerHub');
        const brandLogo = document.querySelector('.brand-title') || document.querySelector('.brand-name');
        if (brandLogo) brandLogo.textContent = 'ZAYAPAY';
      }
    });

    // 5. White-Label Customizer
    await captureOne({
      url: 'http://127.0.0.1:8989/admin/index.html',
      width: 1280,
      height: 850,
      filename: 'gateway_whitelabel_customizer.png',
      evalFn: () => {
        if (typeof switchSection === 'function') switchSection('storeSettings');
        const storeInput = document.getElementById('cfgMerchantName') || document.querySelector('input[name="merchantName"]');
        if (storeInput) storeInput.value = 'ZAYA CODE HUB';
        const appInput = document.getElementById('cfgAppName') || document.querySelector('input[name="appName"]');
        if (appInput) appInput.value = 'ZAYAPAY';
        const brandLogo = document.querySelector('.brand-title') || document.querySelector('.brand-name');
        if (brandLogo) brandLogo.textContent = 'ZAYAPAY';

        // Update mockup preview inside customizer
        const mockStoreName = document.querySelector('.mockup-store-name') || document.getElementById('mockMerchantName');
        if (mockStoreName) mockStoreName.textContent = 'ZAYA CODE HUB';
        const mockTrust = document.querySelector('.mockup-trust-badge') || document.getElementById('mockTrustBadge');
        if (mockTrust) mockTrust.textContent = 'ZAYAPAY Verified Business';
      }
    });

    console.log('🎉 All 5 ZAYAPAY showcase images updated successfully!');
  } finally {
    server.close();
  }
}

run().catch(err => {
  console.error('Asset capture failed:', err);
  process.exit(1);
});

import http from 'node:http';
import { GmailPoller } from './gmail-poller.js';
import { GmailBrowserAutomator } from './browser-automator.js';

export class GmailObserverServer {
  /**
   * @param {{
   *   poller?: GmailPoller,
   *   apiBaseUrl?: string,
   *   receivingAccountId?: string
   * }} options
   */
  constructor(options = {}) {
    this.poller = options.poller || new GmailPoller(options);
    this.automator = new GmailBrowserAutomator({ gmailPoller: this.poller });
  }

  createServer() {
    return http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname;
      const method = (req.method || 'GET').toUpperCase();

      if (method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
      }

      // GET /health
      if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'UP',
          service: 'gmail-observer',
          isRunning: this.poller.isRunning,
          lastPollAt: this.poller.lastPollAt,
          observedCount: this.poller.observedCount
        }));
        return;
      }

      // POST /stop
      if (pathname === '/stop' && method === 'POST') {
        this.poller.stop();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Gmail poller stopped' }));
        return;
      }

      // GET /
      if (pathname === '/') {
        let clientId = '';
        const apiBase = (this.poller.apiBaseUrl && !this.poller.apiBaseUrl.includes('gauravtesting.online')) ? this.poller.apiBaseUrl : `http://127.0.0.1:${process.env.PAYMENT_API_PORT || 6100}`;
        try {
          const credRes = await fetch(`${apiBase}/api/v1/admin/gmail/credentials`);
          if (credRes.ok) {
            const credData = await credRes.json();
            clientId = credData.clientId || credData.gmailConfig?.clientId || '';
          }
        } catch {}
        if (!clientId) {
          clientId = (this.poller.credentials?.clientId)
            ? this.poller.credentials.clientId
            : (process.env.GMAIL_CLIENT_ID || '');
        }

        const finalRedirectUri = process.env.GMAIL_REDIRECT_URI || `${url.protocol}//${req.headers.host || 'localhost:6003'}/oauth/callback`;
        const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email');
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&include_granted_scopes=true`;
        const isConnected = Boolean(this.poller.credentials?.refreshToken || this.poller.credentials?.accessToken);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ZAYAPAY — Gmail Bank Observer</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #090d16;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1.5rem;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 1.25rem;
      padding: 2.5rem 2rem;
      text-align: center;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 1.25rem;
    }
    .badge-disconnected {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid #ef4444;
      color: #f87171;
    }
    .badge-connected {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid #10b981;
      color: #34d399;
    }
    h1 { font-size: 1.5rem; margin: 0 0 0.5rem 0; color: #fff; }
    p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin: 0 0 1.5rem 0; }
    .btn-google {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: #ffffff;
      color: #1f2937;
      font-weight: 600;
      font-size: 1rem;
      padding: 0.85rem 1.75rem;
      border-radius: 0.5rem;
      text-decoration: none;
      width: 100%;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
      transition: all 0.2s;
    }
    .btn-google:hover { background: #f1f5f9; transform: translateY(-1px); }
    .info { margin-top: 1.5rem; font-size: 0.8rem; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge ${isConnected ? 'badge-connected' : 'badge-disconnected'}">
      <span>●</span> ${isConnected ? 'Observer Connected: ' + (this.poller.credentials.connectedEmail || 'Active') : 'Observer Not Connected'}
    </div>
    <h1>⚡ ZAYAPAY Gmail Observer</h1>
    <p>Read incoming HDFC Bank UPI credit alert emails to confirm customer payments in real-time.</p>
    <a href="${authUrl}" class="btn-google">
      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/></svg>
      ${isConnected ? 'Re-authorize Google Account' : 'Sign in with Google'}
    </a>
    <div class="info">
      Redirect URI: <code>${finalRedirectUri}</code><br>
      Polling Interval: 5 seconds
    </div>
  </div>
</body>
</html>`);
        return;
      }

      // GET /oauth/url
      if (pathname === '/oauth/url') {
        let clientId = '';
        const apiBase = (this.poller.apiBaseUrl && !this.poller.apiBaseUrl.includes('gauravtesting.online')) ? this.poller.apiBaseUrl : `http://127.0.0.1:${process.env.PAYMENT_API_PORT || 6100}`;
        try {
          const credRes = await fetch(`${apiBase}/api/v1/admin/gmail/credentials`);
          if (credRes.ok) {
            const credData = await credRes.json();
            clientId = credData.clientId || credData.gmailConfig?.clientId || '';
          }
        } catch {}

        if (!clientId) {
          clientId = (this.poller.credentials?.clientId)
            ? this.poller.credentials.clientId
            : (process.env.GMAIL_CLIENT_ID || 'mock-youpi-client-id.apps.googleusercontent.com');
        }

        const finalRedirectUri = process.env.GMAIL_REDIRECT_URI || `${url.protocol}//${req.headers.host || 'localhost:6003'}/oauth/callback`;
        const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email');
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&include_granted_scopes=true`;

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ authUrl, redirectUri: finalRedirectUri }));
        return;
      }

      // GET /oauth/callback (Google OAuth redirect authorization exchange)
      if (pathname === '/oauth/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>Google OAuth Authorization Error</h1><p>${error}</p>`);
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>Missing Authorization Code</h1><p>No code returned from Google.</p>`);
          return;
        }

        try {
          let clientId = '';
          let clientSecret = '';
          const apiBase = (this.poller.apiBaseUrl && !this.poller.apiBaseUrl.includes('gauravtesting.online')) ? this.poller.apiBaseUrl : `http://127.0.0.1:${process.env.PAYMENT_API_PORT || 6100}`;

          try {
            const credRes = await fetch(`${apiBase}/api/v1/admin/gmail/credentials`);
            if (credRes.ok) {
              const credData = await credRes.json();
              clientId = credData.clientId || credData.gmailConfig?.clientId || '';
              clientSecret = credData.clientSecret || credData.gmailConfig?.clientSecret || '';
            }
          } catch (e) {
            console.warn('[Gmail Observer] Failed to fetch credentials from Payment API:', e.message);
          }

          if (!clientId || clientId.startsWith('demo-')) {
            clientId = (this.poller.credentials?.clientId && !this.poller.credentials.clientId.startsWith('demo-'))
              ? this.poller.credentials.clientId
              : (process.env.GMAIL_CLIENT_ID && !process.env.GMAIL_CLIENT_ID.startsWith('demo-') ? process.env.GMAIL_CLIENT_ID : '');
          }

          if (!clientSecret || clientSecret.startsWith('demo-')) {
            clientSecret = (this.poller.credentials?.clientSecret && !this.poller.credentials.clientSecret.startsWith('demo-'))
              ? this.poller.credentials.clientSecret
              : (process.env.GMAIL_CLIENT_SECRET && !process.env.GMAIL_CLIENT_SECRET.startsWith('demo-') ? process.env.GMAIL_CLIENT_SECRET : '');
          }

          if (!clientId || !clientSecret) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h1>Configuration Error</h1><p>Missing Gmail OAuth Client ID or Client Secret. Please configure them in Merchant Admin.</p>`);
            return;
          }

          const redirectUri = process.env.GMAIL_REDIRECT_URI || `${url.protocol}//${req.headers.host || 'localhost:6003'}/oauth/callback`;
          console.log(`[Gmail Observer] Exchanging OAuth code for tokens with Client ID: ${clientId.substring(0, 15)}... and Redirect URI: ${redirectUri}`);

          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code'
            }).toString()
          });

          const tokenData = await tokenRes.json();
          if (!tokenRes.ok) {
            throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed');
          }

          let userEmail = 'Connected Account';
          let messagesTotal = 0;
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${tokenData.access_token}` },
              signal: AbortSignal.timeout(5000)
            });
            if (userRes.ok) {
              const userInfo = await userRes.json();
              userEmail = userInfo.email || userEmail;
            }
          } catch {}

          try {
            const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
              headers: { Authorization: `Bearer ${tokenData.access_token}` },
              signal: AbortSignal.timeout(5000)
            });
            if (profileRes.ok) {
              const prof = await profileRes.json();
              if (prof.emailAddress) userEmail = prof.emailAddress;
              if (prof.messagesTotal !== undefined) messagesTotal = prof.messagesTotal;
            }
          } catch {}

          const nowIso = new Date().toISOString();
          // Persist credentials to Payment API
          try {
            await fetch(`${apiBase}/api/v1/admin/gmail/credentials`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clientId,
                clientSecret,
                refreshToken: tokenData.refresh_token,
                accessToken: tokenData.access_token,
                connectedEmail: userEmail,
                lastTestedAt: nowIso,
                lastSuccessfulFetch: nowIso,
                messagesTotal,
                status: 'CONNECTED'
              })
            });
          } catch (e) {
            console.error('[Gmail Observer] Failed to persist credentials to payment-api:', e.message);
          }

          this.poller.setCredentials({
            clientId,
            clientSecret,
            refreshToken: tokenData.refresh_token,
            accessToken: tokenData.access_token,
            connectedEmail: userEmail
          });
          this.poller.start();

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>YOUPI PG — Google Connected</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                * { box-sizing: border-box; }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  background: #090d16;
                  color: #f8fafc;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  padding: 1.5rem;
                }
                .card {
                  background: #111827;
                  border: 1px solid #1f2937;
                  border-radius: 1.25rem;
                  padding: 2.5rem 2rem;
                  text-align: center;
                  max-width: 440px;
                  width: 100%;
                  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
                }
                .icon-badge {
                  width: 64px;
                  height: 64px;
                  border-radius: 50%;
                  background: rgba(16, 185, 129, 0.15);
                  border: 2px solid #10b981;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0 auto 1.25rem auto;
                  font-size: 2rem;
                }
                h1 {
                  font-size: 1.4rem;
                  font-weight: 700;
                  color: #ffffff;
                  margin: 0 0 0.5rem 0;
                }
                p {
                  color: #9ca3af;
                  font-size: 0.9rem;
                  line-height: 1.5;
                  margin: 0 0 1.25rem 0;
                }
                .email-box {
                  background: #1f2937;
                  border: 1px solid #374151;
                  padding: 0.6rem 1rem;
                  border-radius: 0.5rem;
                  font-family: monospace;
                  font-size: 0.95rem;
                  color: #38bdf8;
                  display: inline-block;
                  margin-bottom: 1.25rem;
                  word-break: break-all;
                }
                .status-text {
                  font-size: 0.8rem;
                  color: #10b981;
                  font-weight: 600;
                  margin-bottom: 1.5rem;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 0.4rem;
                }
                .btn {
                  background: #2563eb;
                  color: #ffffff;
                  border: none;
                  padding: 0.75rem 1.5rem;
                  border-radius: 0.5rem;
                  font-size: 0.9rem;
                  font-weight: 600;
                  cursor: pointer;
                  width: 100%;
                  transition: background 0.15s;
                }
                .btn:hover { background: #1d4ed8; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon-badge">✅</div>
                <h1>Google Account Connected</h1>
                <p>Your Gmail account has been successfully authorized for real-time UPI payment verification.</p>
                <div class="email-box">${userEmail}</div>
                <div class="status-text">
                  <span>●</span> Background Payment Observer Active
                </div>
                <button class="btn" onclick="finishAndClose()">Return to Admin Dashboard</button>
              </div>
              <script>
                const payload = {
                  type: 'GMAIL_OAUTH_SUCCESS',
                  email: ${JSON.stringify(userEmail)},
                  messagesTotal: ${JSON.stringify(messagesTotal)},
                  timestamp: Date.now()
                };
                try { localStorage.setItem('youpi_gmail_oauth_result', JSON.stringify(payload)); } catch(e) {}
                try { if (window.opener) window.opener.postMessage(payload, '*'); } catch(e) {}
                function finishAndClose() {
                  try { if (window.opener && window.opener.fetchGmailCredentials) window.opener.fetchGmailCredentials(); } catch(e) {}
                  window.close();
                }
                setTimeout(finishAndClose, 1800);
              </script>
            </body>
            </html>
          `);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>OAuth Error</title></head>
            <body style="font-family:sans-serif; background:#090d16; color:#f8fafc; padding:2rem; text-align:center;">
              <h2 style="color:#ef4444;">Google Authorization Failed</h2>
              <p style="color:#94a3b8;">${err.message}</p>
              <button onclick="window.close()" style="background:#3b82f6; color:#fff; border:none; padding:0.6rem 1.2rem; border-radius:0.4rem; cursor:pointer;">Close Window</button>
            </body>
            </html>
          `);
        }
        return;
      }

      // GET /api/browser/status
      if (pathname === '/api/browser/status') {
        // Auto-ensure connection if currently idle/standby
        if (this.automator.mode === 'STANDBY' && !this.automator.isEnsuring) {
          this.automator.autoEnsureConnection().catch(() => {});
        }
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(this.automator.getStatus()));
        return;
      }

      // POST /api/browser/auto-ensure
      if (pathname === '/api/browser/auto-ensure' && method === 'POST') {
        try {
          const result = await this.automator.autoEnsureConnection();
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/browser/launch-login
      if (pathname === '/api/browser/launch-login' && req.method === 'POST') {
        try {
          const result = this.automator.launchLoginWindow();
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/sweep (Active sweep trigger during 30-second verification window)
      if (pathname === '/api/sweep' && req.method === 'POST') {
        try {
          await Promise.allSettled([
            this.automator.pollInboxEmails().catch(() => {}),
            this.poller.pollCycle().catch(() => {})
          ]);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ swept: true, source: 'GMAIL', count: this.poller.observedCount + this.automator.emailsObserved }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /process-email (Direct email ingestion / test injection)
      if (pathname === '/process-email' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const emailData = JSON.parse(body);
            const result = await this.poller.processEmail(emailData);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, result }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Gmail Observer Route Not Found');
    });
  }
}

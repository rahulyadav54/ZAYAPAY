const fs = require('fs');
const path = require('path');

const adminHtmlPath = path.resolve(__dirname, '../apps/merchant-admin/src/views/admin.html');
let content = fs.readFileSync(adminHtmlPath, 'utf8');

console.log('Original admin.html length:', content.length);

// 1. Swap :root and [data-theme="light"] so :root, [data-theme="dark"] is default Obsidian Dark
if (content.includes(':root,\r\n    [data-theme="light"] {') || content.includes(':root,\n    [data-theme="light"] {')) {
  content = content
    .replace(':root,\r\n    [data-theme="light"] {', '    [data-theme="light"] {')
    .replace(':root,\n    [data-theme="light"] {', '    [data-theme="light"] {');
  
  content = content
    .replace('[data-theme="dark"] {', ':root,\r\n    [data-theme="dark"] {');
  console.log('✔ Swapped :root to [data-theme="dark"]');
}

// 2. Update Header Theme Badge and add Store/Checkout Quick Links
const oldHeaderThemePill = `      <!-- Real Light / Dark Mode Toggle Pill -->
      <div class="theme-mode-pill" id="headerThemeBadge" onclick="toggleThemeManual()"
        title="Auto-switches to Dark Mode in Developer Hub and Bright White Mode in Operations &amp; Store Settings. Click to toggle manually anytime.">
        <span id="headerThemeIcon">☀️</span>
        <span id="headerThemeText">Bright White</span>
      </div>`;

const newHeaderThemePill = `      <!-- Real Light / Dark Mode Toggle Pill -->
      <div class="theme-mode-pill" id="headerThemeBadge" onclick="toggleThemeManual()"
        title="Toggle Obsidian Dark / Clean Light Mode">
        <span id="headerThemeIcon">🌙</span>
        <span id="headerThemeText">Dark Mode</span>
      </div>

      <a href="/" target="_blank" class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.75rem; text-decoration:none; border-radius:9999px;">
        🛍️ Store
      </a>
      <a href="/checkout/demo" target="_blank" class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.75rem; text-decoration:none; border-radius:9999px;">
        💳 Checkout
      </a>`;

if (content.includes(oldHeaderThemePill.replace(/\r?\n/g, '\r\n')) || content.includes(oldHeaderThemePill.replace(/\r?\n/g, '\n'))) {
  const isCrlf = content.includes('\r\n');
  const target = isCrlf ? oldHeaderThemePill.replace(/\r?\n/g, '\r\n') : oldHeaderThemePill.replace(/\r?\n/g, '\n');
  const replacement = isCrlf ? newHeaderThemePill.replace(/\r?\n/g, '\r\n') : newHeaderThemePill.replace(/\r?\n/g, '\n');
  content = content.replace(target, replacement);
  console.log('✔ Updated header theme badge and quick links');
}

// 3. Add Live Completed Payments Table in subViewOpsLive
const liveTransactionsHtml = `
          <!-- Live Completed Payments Table (Instant Settlement Stream) -->
          <div style="margin-top:2rem; border-top:1px solid var(--border); padding-top:1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
              <div>
                <div style="font-size:1.05rem; font-weight:800; color:var(--text-heading); display:flex; align-items:center; gap:0.5rem;">
                  <span>⚡</span> Live Completed Transactions &amp; Settlements
                </div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
                  Real-time payments verified automatically by 2-Layer banking observers (SMS + Gmail).
                </div>
              </div>
              <button class="btn btn-secondary" onclick="fetchPaymentsLedger()" style="padding:0.35rem 0.85rem; font-size:0.78rem;">
                🔄 Refresh Stream
              </button>
            </div>
            <div style="overflow-x:auto;">
              <table>
                <thead>
                  <tr>
                    <th>Order &amp; Ref</th>
                    <th>Amount</th>
                    <th>UTR / Bank Ref</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Payee VPA</th>
                    <th>Observer Tier</th>
                    <th>Date &amp; Time</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="liveCompletedPaymentsTbody">
                  <tr>
                    <td colspan="9" style="text-align:center; color:var(--text-muted); padding:1.5rem;">
                      Loading live transactions...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>`;

if (!content.includes('id="liveCompletedPaymentsTbody"')) {
  const isCrlf = content.includes('\r\n');
  const queueEndMarker = isCrlf 
    ? '              </table>\r\n            </div>\r\n          </div>\r\n        </div>\r\n      </div>\r\n\r\n      <!-- SUB-VIEW 1.2: COUNTER DESK'
    : '              </table>\n            </div>\n          </div>\n        </div>\n      </div>\n\n      <!-- SUB-VIEW 1.2: COUNTER DESK';
  
  const queueEndReplacement = isCrlf
    ? `              </table>\r\n            </div>\r\n          </div>${liveTransactionsHtml.replace(/\r?\n/g, '\r\n')}\r\n        </div>\r\n      </div>\r\n\r\n      <!-- SUB-VIEW 1.2: COUNTER DESK`
    : `              </table>\n            </div>\n          </div>${liveTransactionsHtml.replace(/\r?\n/g, '\n')}\n        </div>\n      </div>\n\n      <!-- SUB-VIEW 1.2: COUNTER DESK`;
  
  if (content.includes(queueEndMarker)) {
    content = content.replace(queueEndMarker, queueEndReplacement);
    console.log('✔ Injected Live Completed Transactions table into subViewOpsLive');
  } else {
    console.warn('⚠ Could not find exact queueEndMarker for subViewOpsLive table');
  }
}

// 4. Inject Receipt & Audit Modal
const receiptModalHtml = `
  <!-- Transaction Details & Receipt Modal -->
  <div id="receiptModal" class="modal-overlay" hidden>
    <div class="modal-box" style="max-width:540px; padding:0; overflow:hidden;">
      <div style="padding:1.25rem 1.5rem; background:var(--bg-surface); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <div style="width:34px; height:34px; border-radius:50%; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); display:flex; align-items:center; justify-content:center; font-size:1.1rem; color:#10b981; font-weight:900;">✓</div>
          <div>
            <div style="font-weight:800; font-size:1.05rem; color:var(--text-heading);">Transaction Receipt &amp; Audit</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Verified Non-Custodial Direct Settlement</div>
          </div>
        </div>
        <button onclick="closeReceiptModal()" style="background:none; border:none; color:var(--text-muted); font-size:1.4rem; cursor:pointer; line-height:1;">&times;</button>
      </div>
      <div style="padding:1.5rem;" id="receiptModalContent">
        <!-- populated dynamically -->
      </div>
      <div style="padding:1rem 1.5rem; background:var(--bg-surface); border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:0.75rem;">
        <button class="btn btn-secondary" onclick="copyReceiptJson()">📋 Copy JSON</button>
        <button class="btn btn-primary" onclick="closeReceiptModal()">Close</button>
      </div>
    </div>
  </div>`;

if (!content.includes('id="receiptModal"')) {
  const isCrlf = content.includes('\r\n');
  const dockMarker = isCrlf
    ? '  <!-- Global Cashier Floating Dock -->'
    : '  <!-- Global Cashier Floating Dock -->';
  
  if (content.includes(dockMarker)) {
    content = content.replace(dockMarker, (isCrlf ? receiptModalHtml.replace(/\r?\n/g, '\r\n') : receiptModalHtml) + (isCrlf ? '\r\n\r\n' : '\n\n') + dockMarker);
    console.log('✔ Injected receipt modal before cashier dock');
  }
}

// 5. Update Theme Functions
const isCrlf = content.includes('\r\n');
const nl = isCrlf ? '\r\n' : '\n';

// Replace toggleThemeManual and applyTheme
const oldThemeSection = `    // --- REAL LIGHT / DARK THEME CONTROLLER ---
    let manualThemeOverride = null;

    function updateThemeForSection(sectionId) {
      // Professional Enterprise Gateway Theme: Authoritative Midnight Dark Theme across all sections
      const savedTheme = localStorage.getItem('admin_theme_pref') || 'dark';
      applyTheme(savedTheme);
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      document.body.setAttribute('data-theme', theme);

      const icon = document.getElementById('headerThemeIcon');
      const text = document.getElementById('headerThemeText');
      if (theme === 'dark') {
        if (icon) icon.textContent = '🌙';
        if (text) text.textContent = 'Real Dark';
      } else {
        if (icon) icon.textContent = '☀️';
        if (text) text.textContent = 'Bright White';
      }
    }

    function toggleThemeManual() {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      manualThemeOverride = next;
      applyTheme(next);
      showAdminToast(\`Switched to \${next === 'dark' ? 'Real Dark Mode' : 'Bright White Mode'}\`);
    }`;

const newThemeSection = `    // --- REAL LIGHT / DARK THEME CONTROLLER ---
    function updateThemeForSection(sectionId) {
      const savedTheme = localStorage.getItem('admin_theme_pref') || 'dark';
      applyTheme(savedTheme);
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      document.body.setAttribute('data-theme', theme);

      const icon = document.getElementById('headerThemeIcon');
      const text = document.getElementById('headerThemeText');
      if (theme === 'dark') {
        if (icon) icon.textContent = '🌙';
        if (text) text.textContent = 'Dark Mode';
      } else {
        if (icon) icon.textContent = '☀️';
        if (text) text.textContent = 'Light Mode';
      }
    }

    function toggleThemeManual() {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem('admin_theme_pref', next);
      applyTheme(next);
      showAdminToast(\`Switched to \${next === 'dark' ? 'Dark Obsidian Mode' : 'Clean Light Mode'}\`);
    }`;

if (content.includes(oldThemeSection.replace(/\r?\n/g, nl))) {
  content = content.replace(oldThemeSection.replace(/\r?\n/g, nl), newThemeSection.replace(/\r?\n/g, nl));
  console.log('✔ Updated theme functions');
}

// 6. Ensure fetchLiveData calls fetchPaymentsLedger
if (content.includes('updateKpis(pData.payments || [], qData.queue || []);') && !content.includes('await fetchPaymentsLedger();')) {
  content = content.replace(
    'updateKpis(pData.payments || [], qData.queue || []);',
    'updateKpis(pData.payments || [], qData.queue || []);\r\n        await fetchPaymentsLedger();'
  );
  console.log('✔ Added await fetchPaymentsLedger() to fetchLiveData');
}

// 7. Update fetchPaymentsLedger to populate both tables & use modal receipt
const oldLedgerStart = `    // --- TRANSACTIONS LEDGER ---
    async function fetchPaymentsLedger() {`;

// Let's replace the whole fetchPaymentsLedger and viewTransactionDetails block
const ledgerRegex = /\/\/ --- TRANSACTIONS LEDGER ---[\s\S]*?\/\/ --- WHITE-LABEL BRANDING & SMARTPHONE PREVIEW ---/;

const newLedgerBlock = `// --- TRANSACTIONS LEDGER ---
    let currentReceiptData = null;

    async function fetchPaymentsLedger() {
      try {
        let apiPayments = [];
        try {
          const res = await fetch(\`\${API_BASE}/api/v1/admin/payments\`);
          if (res.ok) {
            const data = await res.json();
            apiPayments = data.payments || [];
          }
        } catch (err) {}

        // Read locally tracked customer checkout transactions
        let localPayments = [];
        try {
          localPayments = JSON.parse(localStorage.getItem('youpi_gateway_transactions') || '[]');
        } catch (e) {}

        // Merge and deduplicate by orderId / paymentId
        const txMap = new Map();
        apiPayments.forEach(p => {
          const key = p.orderId || p.id;
          txMap.set(key, p);
        });

        localPayments.forEach(lp => {
          const key = lp.orderId || lp.id;
          if (!txMap.has(key)) {
            txMap.set(key, lp);
          } else {
            const existing = txMap.get(key);
            if (lp.status === 'SUCCESS' && existing.status !== 'SUCCESS') {
              existing.status = 'SUCCESS';
              existing.utr = lp.utr || existing.utr;
              existing.completedAt = lp.completedAt || existing.completedAt;
            }
          }
        });

        const allTransactions = Array.from(txMap.values()).sort((a, b) => {
          const tA = new Date(a.completedAt || a.createdAt || 0).getTime();
          const tB = new Date(b.completedAt || b.createdAt || 0).getTime();
          return tB - tA;
        });

        const ledgerTbody = document.getElementById('paymentsLedgerTbody');
        const liveTbody = document.getElementById('liveCompletedPaymentsTbody');

        if (allTransactions.length === 0) {
          const emptyHtml = \`
            <tr>
              <td colspan="10" style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
                <div style="font-size:2rem; margin-bottom:0.5rem;">💳</div>
                <div style="font-weight:700; color:var(--text-heading); font-size:1.05rem;">No Transactions Recorded Yet</div>
                <div style="font-size:0.85rem; margin-top:0.25rem;">Live customer checkout payments and QR scans will automatically appear here in real time.</div>
              </td>
            </tr>
          \`;
          if (ledgerTbody) ledgerTbody.innerHTML = emptyHtml;
          if (liveTbody) liveTbody.innerHTML = emptyHtml;
          return;
        }

        const rowsHtml = allTransactions.map(p => {
          const isSuccess = p.status === 'SUCCESS';
          const isPending = p.status === 'ACTIVE' || p.status === 'QUEUED' || p.status === 'PROCESSING';
          const statusBadge = isSuccess
            ? '<span class="badge badge-success" style="font-weight:800; font-size:0.75rem;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;margin-right:5px;"></span>PAID</span>'
            : (isPending
              ? '<span class="badge badge-warning" style="font-weight:800; font-size:0.75rem;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f59e0b;margin-right:5px;"></span>PENDING</span>'
              : '<span class="badge badge-danger" style="font-weight:800; font-size:0.75rem;">FAILED</span>');

          const rawAmount = p.amount || (Number(p.amountPaise) / 100).toFixed(2);
          const formattedAmt = parseFloat(rawAmount).toFixed(2);
          const utrVal = p.utr || p.bankRef || '-';
          const payeeVpa = p.payeeVpa || 'zayacodehub@okhdfcbank';
          const payeeName = p.payeeName || 'ZAYA CODE HUB';
          const completedStr = p.completedAt ? new Date(p.completedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : (p.createdAt ? new Date(p.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-');
          const orderIdStr = escapeHtml(p.orderId || p.id);
          const pIdStr = escapeHtml((p.id || '').slice(0, 14));

          // Store tx data in global window cache for modal lookup
          window['__tx_' + (p.orderId || p.id)] = p;

          return \`
            <tr style="border-bottom:1px solid var(--border);">
              <td>
                <div style="font-weight:800; color:var(--text-heading); font-size:0.88rem;">#\${orderIdStr}</div>
                <div style="font-size:0.72rem; color:var(--text-muted); font-family:monospace;">ID: \${pIdStr}...</div>
              </td>
              <td>
                <div style="font-weight:900; color:\${isSuccess ? '#10b981' : 'var(--text-heading)'}; font-size:1.05rem;">₹\${formattedAmt}</div>
              </td>
              <td>
                <div style="display:flex; align-items:center; gap:6px;">
                  <code style="font-weight:700; color:#38bdf8; background:var(--bg-box); padding:2px 6px; border-radius:4px; font-size:0.8rem; border:1px solid var(--border);">\${escapeHtml(utrVal)}</code>
                  \${utrVal !== '-' ? \`<button type="button" onclick="navigator.clipboard.writeText('\${utrVal}'); showAdminToast('UTR Copied!');" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:0.8rem;" title="Copy UTR">📋</button>\` : ''}
                </div>
              </td>
              <td>
                <span style="font-weight:700; font-size:0.8rem; background:rgba(37,99,235,0.12); color:#60a5fa; padding:2px 7px; border-radius:4px; border:1px solid rgba(37,99,235,0.25);">\${escapeHtml(p.method || 'UPI QR')}</span>
              </td>
              <td>\${statusBadge}</td>
              <td>
                <div style="font-size:0.78rem; color:var(--text); font-weight:600;">\${escapeHtml(payeeVpa)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">\${escapeHtml(payeeName)}</div>
              </td>
              <td>
                <span class="badge badge-info" style="font-size:0.72rem;">📡 Bank Observer</span>
              </td>
              <td>
                <div style="font-size:0.78rem; color:var(--text-muted);">\${completedStr}</div>
              </td>
              <td>
                <button type="button" class="btn btn-secondary" onclick="viewTransactionDetails('\${escapeHtml(p.orderId || p.id)}', '\${formattedAmt}', '\${escapeHtml(utrVal)}', '\${p.status}', '\${completedStr}')" style="padding:0.3rem 0.65rem; font-size:0.75rem;">
                  Details ↗
                </button>
              </td>
            </tr>
          \`;
        }).join('');

        if (ledgerTbody) ledgerTbody.innerHTML = rowsHtml;
        if (liveTbody) liveTbody.innerHTML = rowsHtml;

        // Also refresh top KPI summary metrics from all unified transactions
        let totalVol = 0;
        let successCount = 0;
        allTransactions.forEach(t => {
          if (t.status === 'SUCCESS') {
            totalVol += parseFloat(t.amount || (Number(t.amountPaise) / 100) || 0);
            successCount++;
          }
        });
        const volEl = document.getElementById('kpiVol');
        const countEl = document.getElementById('kpiSuccessCount');
        if (volEl && totalVol > 0) volEl.textContent = \`₹\${totalVol.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`;
        if (countEl && successCount > 0) countEl.textContent = successCount.toString();
      } catch (e) {
        console.warn('fetchPaymentsLedger error:', e);
      }
    }

    // Modal popup to inspect full transaction details
    function viewTransactionDetails(orderId, amount, utr, status, timestamp) {
      const modal = document.getElementById('receiptModal');
      const container = document.getElementById('receiptModalContent');
      if (!modal || !container) {
        alert(\`Transaction: #\${orderId}\\nAmount: ₹\${amount}\\nUTR: \${utr}\\nStatus: \${status}\\nDate: \${timestamp}\`);
        return;
      }

      const cached = window['__tx_' + orderId] || {};
      currentReceiptData = {
        orderId,
        amount,
        utr,
        status,
        timestamp,
        id: cached.id || orderId,
        method: cached.method || 'UPI QR Instant',
        payeeVpa: cached.payeeVpa || 'zayacodehub@okhdfcbank',
        payeeName: cached.payeeName || 'ZAYA CODE HUB',
        settlementBank: 'HDFC Bank Account',
        verificationEngine: '2-Layer Banking Observer (Android SMS + Gmail)'
      };

      container.innerHTML = \`
        <div style="background:var(--bg-surface); border:1px solid var(--border); border-radius:0.75rem; padding:1.25rem; margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.75rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Settlement Amount</div>
              <div style="font-size:1.85rem; font-weight:900; color:#10b981; margin-top:0.25rem;">₹\${amount}</div>
            </div>
            <div>
              <span class="badge badge-success" style="font-size:0.85rem; padding:0.35rem 0.75rem; font-weight:800;">● PAID &amp; SETTLED</span>
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; font-size:0.85rem; margin-bottom:1rem;">
          <div style="background:var(--bg-box); padding:0.75rem; border-radius:6px; border:1px solid var(--border);">
            <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Order ID</div>
            <div style="font-weight:800; color:var(--text-heading); margin-top:2px;">#\${orderId}</div>
          </div>
          <div style="background:var(--bg-box); padding:0.75rem; border-radius:6px; border:1px solid var(--border);">
            <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Bank UTR / Ref</div>
            <div style="font-weight:800; color:#38bdf8; font-family:monospace; margin-top:2px;">\${utr}</div>
          </div>
          <div style="background:var(--bg-box); padding:0.75rem; border-radius:6px; border:1px solid var(--border);">
            <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Receiving VPA</div>
            <div style="font-weight:800; color:var(--text); margin-top:2px;">\${currentReceiptData.payeeVpa}</div>
          </div>
          <div style="background:var(--bg-box); padding:0.75rem; border-radius:6px; border:1px solid var(--border);">
            <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Merchant Name</div>
            <div style="font-weight:800; color:var(--text); margin-top:2px;">\${currentReceiptData.payeeName}</div>
          </div>
        </div>

        <div style="background:var(--bg-box); border:1px solid var(--border); border-radius:6px; padding:0.75rem; font-size:0.8rem; margin-bottom:0.5rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
            <span style="color:var(--text-muted);">Verification Engine:</span>
            <span style="font-weight:700; color:var(--text);">2-Layer Banking Observer</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
            <span style="color:var(--text-muted);">Settlement Destination:</span>
            <span style="font-weight:700; color:#10b981;">Direct Instant to HDFC Bank</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--text-muted);">Timestamp (IST):</span>
            <span style="font-weight:700; color:var(--text);">\${timestamp}</span>
          </div>
        </div>
      \`;

      modal.hidden = false;
    }

    function closeReceiptModal() {
      const modal = document.getElementById('receiptModal');
      if (modal) modal.hidden = true;
    }

    function copyReceiptJson() {
      if (!currentReceiptData) return;
      navigator.clipboard.writeText(JSON.stringify(currentReceiptData, null, 2));
      showAdminToast('Receipt JSON Copied to Clipboard!');
    }

    // --- WHITE-LABEL BRANDING & SMARTPHONE PREVIEW ---`;

if (ledgerRegex.test(content)) {
  content = content.replace(ledgerRegex, newLedgerBlock.replace(/\r?\n/g, nl));
  console.log('✔ Replaced fetchPaymentsLedger and added receipt modal handlers');
} else {
  console.warn('⚠ Could not match ledgerRegex in admin.html');
}

fs.writeFileSync(adminHtmlPath, content, 'utf8');
console.log('✔ Successfully saved patched admin.html. New length:', content.length);

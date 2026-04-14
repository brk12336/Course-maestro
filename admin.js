// ── AUTH ──────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = 'Zari95140'; // ← Change ce mot de passe !
const AUTH_KEY = 'restoAdminAuth';
const ORDERS_KEY = 'restoOrders';

function getOrders() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; }
  catch { return []; }
}

function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

// ── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const isAuth = sessionStorage.getItem(AUTH_KEY) === 'true';
  if (isAuth) showDashboard();
  else        showLogin();

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('btnLogout').addEventListener('click', handleLogout);
  document.getElementById('filterStatus').addEventListener('change', renderOrders);
  document.getElementById('filterSearch').addEventListener('input', renderOrders);
  document.getElementById('btnDeleteAll').addEventListener('click', deleteAllOrders);
  document.getElementById('btnExport').addEventListener('click', exportCSV);
});

// ── LOGIN ─────────────────────────────────────────────────────────────────
function handleLogin(e) {
  e.preventDefault();
  const pw = document.getElementById('passwordInput').value;
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    showDashboard();
  } else {
    document.getElementById('loginError').textContent = '❌ Mot de passe incorrect';
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordInput').focus();
  }
}

function handleLogout() {
  sessionStorage.removeItem(AUTH_KEY);
  showLogin();
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loginError').textContent = '';
  document.getElementById('passwordInput').focus();
}

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  renderStats();
  renderOrders();
}

// ── STATS ─────────────────────────────────────────────────────────────────
function renderStats() {
  const orders = getOrders();
  const total    = orders.length;
  const pending  = orders.filter(o => o.status === 'en_attente').length;
  const done     = orders.filter(o => o.status === 'reçue').length;
  const thisWeek = orders.filter(o => {
    const d = new Date(o.date);
    const now = new Date();
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).length;

  document.getElementById('statTotal').textContent   = total;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statDone').textContent    = done;
  document.getElementById('statWeek').textContent    = thisWeek;
}

// ── RENDER ORDERS ─────────────────────────────────────────────────────────
function renderOrders() {
  const statusFilter = document.getElementById('filterStatus').value;
  const searchVal    = document.getElementById('filterSearch').value.toLowerCase();
  let orders = getOrders();

  if (statusFilter !== 'all') orders = orders.filter(o => o.status === statusFilter);
  if (searchVal) {
    orders = orders.filter(o => {
      const dateStr = new Date(o.date).toLocaleDateString('fr-FR');
      return dateStr.includes(searchVal) ||
             (o.note || '').toLowerCase().includes(searchVal) ||
             o.items.some(i => i.name.toLowerCase().includes(searchVal));
    });
  }

  const container = document.getElementById('ordersList');

  if (!orders.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📭</div>
      <p>Aucune commande trouvée</p>
    </div>`;
    return;
  }

  container.innerHTML = orders.map(order => {
    const date = new Date(order.date);
    const dateStr = date.toLocaleDateString('fr-FR', {
      weekday:'long', day:'2-digit', month:'long', year:'numeric'
    });
    const timeStr = date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    const statusClass = {
      'en_attente': 'status-pending',
      'en_cours':   'status-progress',
      'reçue':      'status-done'
    }[order.status] || 'status-pending';
    const statusLabel = {
      'en_attente': '⏳ En attente',
      'en_cours':   '🔄 En cours',
      'reçue':      '✅ Reçue'
    }[order.status] || '⏳ En attente';

    // Group by category for display
    const grouped = {};
    order.items.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    const itemsHTML = Object.entries(grouped).map(([cat, items]) => {
      const catInfo = CATEGORIES[cat] || { label: cat, icon: '📦', color: '#999' };
      return `<div class="order-cat">
        <span class="order-cat-label" style="color:${catInfo.color}">${catInfo.icon} ${catInfo.label}</span>
        <div class="order-items-list">
          ${items.map(i => `<span class="order-item-chip">${i.name}${i.nameBn ? `<span class="chip-bn">${i.nameBn}</span>` : ''} <strong>${i.qty} ${i.unit}</strong></span>`).join('')}
        </div>
      </div>`;
    }).join('');

    return `
    <div class="order-card" id="order-${order.id}">
      <div class="order-header">
        <div class="order-meta">
          <span class="order-id">#${String(order.id).slice(-6)}</span>
          <div>
            <div class="order-date">${dateStr}</div>
            <div class="order-time">${timeStr} · ${order.items.length} articles</div>
          </div>
        </div>
        <div class="order-actions">
          <span class="status-badge ${statusClass}">${statusLabel}</span>
          <select class="status-select" onchange="updateStatus(${order.id}, this.value)">
            <option value="en_attente" ${order.status==='en_attente'?'selected':''}>En attente</option>
            <option value="en_cours"   ${order.status==='en_cours'?'selected':''}>En cours</option>
            <option value="reçue"      ${order.status==='reçue'?'selected':''}>Reçue</option>
          </select>
          <button class="btn-print-order" onclick="printSingleOrder(${order.id})" title="Imprimer">🖨️</button>
          <button class="btn-delete-order" onclick="deleteOrder(${order.id})" title="Supprimer">🗑️</button>
        </div>
      </div>
      ${order.note ? `<div class="order-note">📝 ${order.note}</div>` : ''}
      <div class="order-body">${itemsHTML}</div>
    </div>`;
  }).join('');
}

// ── UPDATE STATUS ─────────────────────────────────────────────────────────
function updateStatus(orderId, newStatus) {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx === -1) return;
  orders[idx].status = newStatus;
  saveOrders(orders);
  renderStats();
  renderOrders();
  showToast(`Statut mis à jour : ${newStatus === 'reçue' ? '✅ Reçue' : newStatus}`);
}

// ── DELETE ────────────────────────────────────────────────────────────────
function deleteOrder(orderId) {
  if (!confirm('Supprimer cette commande ?')) return;
  const orders = getOrders().filter(o => o.id !== orderId);
  saveOrders(orders);
  renderStats();
  renderOrders();
  showToast('🗑️ Commande supprimée');
}

function deleteAllOrders() {
  const orders = getOrders();
  if (!orders.length) { showToast('Aucune commande à supprimer', 'error'); return; }
  if (!confirm(`Supprimer TOUTES les ${orders.length} commandes ? Cette action est irréversible.`)) return;
  localStorage.removeItem(ORDERS_KEY);
  renderStats();
  renderOrders();
  showToast('🗑️ Toutes les commandes supprimées');
}

// ── EXPORT CSV ────────────────────────────────────────────────────────────
function exportCSV() {
  const orders = getOrders();
  if (!orders.length) { showToast('Aucune commande à exporter', 'error'); return; }

  const rows = [['Date', 'Heure', 'Statut', 'Produit', 'Quantité', 'Unité', 'Note']];
  orders.forEach(o => {
    const d = new Date(o.date);
    const date = d.toLocaleDateString('fr-FR');
    const time = d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    o.items.forEach(item => {
      rows.push([date, time, o.status, item.name, item.qty, item.unit, o.note || '']);
    });
  });

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `commandes_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Export CSV téléchargé');
}

// ── PRINT SINGLE ──────────────────────────────────────────────────────────
function printSingleOrder(orderId) {
  const order = getOrders().find(o => o.id === orderId);
  if (!order) return;

  const date = new Date(order.date);
  const dateStr = date.toLocaleDateString('fr-FR', {
    weekday:'long', day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'
  });

  const grouped = {};
  order.items.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  let bodyHTML = '';
  for (const [cat, items] of Object.entries(grouped)) {
    const catInfo = CATEGORIES[cat] || { label: cat, icon: '📦' };
    bodyHTML += `<div class="print-section">
      <div class="print-cat">${catInfo.icon} ${catInfo.label}</div>
      ${items.map(i => `<div class="print-item">
        <span>${i.name}</span>
        <span class="print-qty">${i.qty} ${i.unit}</span>
      </div>`).join('')}
    </div>`;
  }

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Commande #${String(order.id).slice(-6)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; padding: 20px; color: #1a1a1a; }
  h1 { font-size: 22px; text-align:center; margin-bottom:4px; }
  .date { text-align:center; font-size:13px; color:#666; margin-bottom:20px; }
  .note { background:#fff8e1; border-left:3px solid #f59e0b; padding:8px 12px; margin-bottom:16px; font-size:13px; }
  .print-section { margin-bottom:14px; }
  .print-cat { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1px;
    color:#666; border-bottom:1px solid #ddd; padding-bottom:4px; margin-bottom:6px; }
  .print-item { display:flex; justify-content:space-between; padding:3px 0;
    border-bottom:1px dotted #eee; font-size:14px; }
  .print-qty { font-weight:700; color:#f59e0b; }
  @media print { body { padding:8px; } }
</style>
</head>
<body>
  <h1>🛒 Bon de Commande #${String(order.id).slice(-6)}</h1>
  <div class="date">${dateStr}</div>
  ${order.note ? `<div class="note">📝 Note : ${order.note}</div>` : ''}
  ${bodyHTML}
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
  win.document.close();
}

// ── TOAST ─────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

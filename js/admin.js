import { db, collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy }
  from "./firebase-config.js";

const ADMIN_PASSWORD = 'admin123';
const AUTH_KEY       = 'restoAdminAuth';

let allOrders = []; // cache local mis à jour en temps réel

// ── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const isAuth = sessionStorage.getItem(AUTH_KEY) === 'true';
  if (isAuth) showDashboard(); else showLogin();

  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('btnLogout')?.addEventListener('click', handleLogout);
  document.getElementById('filterStatus')?.addEventListener('change', renderOrders);
  document.getElementById('filterSearch')?.addEventListener('input', renderOrders);
  document.getElementById('btnDeleteAll')?.addEventListener('click', deleteAllOrders);
  document.getElementById('btnExport')?.addEventListener('click', exportCSV);
});

// ── AUTH ──────────────────────────────────────────────────────────────────
function handleLogin(e) {
  e.preventDefault();
  const pw = document.getElementById('passwordInput').value;
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    showDashboard();
  } else {
    document.getElementById('loginError').textContent = '❌ Mot de passe incorrect';
    document.getElementById('passwordInput').value = '';
  }
}
function handleLogout() { sessionStorage.removeItem(AUTH_KEY); showLogin(); }

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('dashboard').style.display   = 'none';
  document.getElementById('adminHeader').style.display = 'none';
  document.getElementById('loginError').textContent    = '';
  document.getElementById('passwordInput')?.focus();
}

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboard').style.display   = 'block';
  document.getElementById('adminHeader').style.display = 'flex';
  startRealtimeListener();
}

// ── FIREBASE REAL-TIME LISTENER ───────────────────────────────────────────
function startRealtimeListener() {
  const q = query(collection(db, 'commandes'), orderBy('date', 'desc'));

  document.getElementById('ordersList').innerHTML = `
    <div class="empty-state"><div class="empty-icon">⏳</div><p>Connexion en cours…</p></div>`;

  onSnapshot(q, snapshot => {
    allOrders = snapshot.docs.map(d => ({ _id: d.id, ...d.data() }));
    renderStats();
    renderOrders();
  }, err => {
    console.error(err);
    document.getElementById('ordersList').innerHTML = `
      <div class="empty-state"><div class="empty-icon">❌</div>
      <p>Erreur de connexion Firebase</p>
      <small>${err.message}</small></div>`;
  });
}

// ── STATS ─────────────────────────────────────────────────────────────────
function renderStats() {
  const now   = new Date();
  const total   = allOrders.length;
  const pending = allOrders.filter(o => o.status === 'en_attente').length;
  const done    = allOrders.filter(o => o.status === 'reçue').length;
  const week    = allOrders.filter(o => {
    if (!o.date?.toDate) return false;
    return (now - o.date.toDate()) / 86400000 <= 7;
  }).length;

  document.getElementById('statTotal').textContent   = total;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statDone').textContent    = done;
  document.getElementById('statWeek').textContent    = week;
}

// ── RENDER ORDERS ─────────────────────────────────────────────────────────
function renderOrders() {
  const statusFilter = document.getElementById('filterStatus').value;
  const searchVal    = document.getElementById('filterSearch').value.toLowerCase();

  let orders = [...allOrders];
  if (statusFilter !== 'all') orders = orders.filter(o => o.status === statusFilter);
  if (searchVal) {
    orders = orders.filter(o => {
      const dateStr = o.date?.toDate ? o.date.toDate().toLocaleDateString('fr-FR') : '';
      return dateStr.includes(searchVal)
        || (o.note || '').toLowerCase().includes(searchVal)
        || (o.items || []).some(i => i.name.toLowerCase().includes(searchVal));
    });
  }

  const container = document.getElementById('ordersList');
  if (!orders.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>Aucune commande</p></div>`;
    return;
  }

  container.innerHTML = orders.map(order => {
    const date    = order.date?.toDate ? order.date.toDate() : new Date();
    const dateStr = date.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const timeStr = date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

    const statusClass = { 'en_attente':'status-pending', 'en_cours':'status-progress', 'reçue':'status-done' }[order.status] || 'status-pending';
    const statusLabel = { 'en_attente':'⏳ En attente', 'en_cours':'🔄 En cours', 'reçue':'✅ Reçue' }[order.status] || '⏳ En attente';

    const grouped = {};
    (order.items || []).forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    const itemsHTML = Object.entries(grouped).map(([cat, items]) => {
      const catInfo = CATEGORIES[cat] || { label: cat, icon: '📦', color:'#999', labelBn:'' };
      return `<div class="order-cat">
        <span class="order-cat-label" style="color:${catInfo.color}">${catInfo.icon} ${catInfo.label}</span>
        <div class="order-items-list">
          ${items.map(i => `<span class="order-item-chip">
            ${i.name}
            <span class="chip-bn">${i.nameBn || ''}</span>
            <strong>${i.qty} ${i.unit}</strong>
          </span>`).join('')}
        </div>
      </div>`;
    }).join('');

    return `<div class="order-card" id="order-${order._id}">
      <div class="order-header">
        <div class="order-meta">
          <span class="order-id">#${order._id.slice(-6)}</span>
          <div><div class="order-date">${dateStr}</div>
          <div class="order-time">${timeStr} · ${(order.items||[]).length} articles</div></div>
        </div>
        <div class="order-actions">
          <span class="status-badge ${statusClass}">${statusLabel}</span>
          <select class="status-select" onchange="updateStatus('${order._id}', this.value)">
            <option value="en_attente" ${order.status==='en_attente'?'selected':''}>En attente</option>
            <option value="en_cours"   ${order.status==='en_cours'?'selected':''}>En cours</option>
            <option value="reçue"      ${order.status==='reçue'?'selected':''}>Reçue</option>
          </select>
          <button class="btn-print-order" onclick="printOrder('${order._id}')" title="Imprimer">🖨️</button>
          <button class="btn-delete-order" onclick="deleteOrder('${order._id}')" title="Supprimer">🗑️</button>
        </div>
      </div>
      ${order.note ? `<div class="order-note">📝 ${order.note}</div>` : ''}
      <div class="order-body">${itemsHTML}</div>
    </div>`;
  }).join('');
}

// ── ACTIONS ───────────────────────────────────────────────────────────────
window.updateStatus = async (orderId, newStatus) => {
  try {
    await updateDoc(doc(db, 'commandes', orderId), { status: newStatus });
    showToast(`Statut → ${newStatus === 'reçue' ? '✅ Reçue' : newStatus}`);
  } catch (err) { showToast('❌ Erreur', 'error'); }
};

window.deleteOrder = async (orderId) => {
  if (!confirm('Supprimer cette commande ?')) return;
  try {
    await deleteDoc(doc(db, 'commandes', orderId));
    showToast('🗑️ Supprimée');
  } catch (err) { showToast('❌ Erreur', 'error'); }
};

async function deleteAllOrders() {
  if (!allOrders.length) { showToast('Aucune commande', 'error'); return; }
  if (!confirm(`Supprimer TOUTES les ${allOrders.length} commandes ?`)) return;
  try {
    await Promise.all(allOrders.map(o => deleteDoc(doc(db, 'commandes', o._id))));
    showToast('🗑️ Tout supprimé');
  } catch (err) { showToast('❌ Erreur', 'error'); }
}

window.printOrder = (orderId) => {
  const order = allOrders.find(o => o._id === orderId);
  if (!order) return;
  const date    = order.date?.toDate ? order.date.toDate() : new Date();
  const dateStr = date.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const grouped = {};
  (order.items||[]).forEach(i => { if (!grouped[i.category]) grouped[i.category]=[]; grouped[i.category].push(i); });
  let bodyHTML = '';
  for (const [cat, items] of Object.entries(grouped)) {
    const c = CATEGORIES[cat] || { label:cat, icon:'📦', labelBn:'' };
    bodyHTML += `<div class="print-section"><div class="print-cat">${c.icon} ${c.label} <span style="font-family:serif;font-size:11px;color:#888">— ${c.labelBn}</span></div>
    ${items.map(i=>`<div class="print-item"><span>${i.name} <span style="font-family:serif;font-size:11px;color:#b45309">${i.nameBn||''}</span></span><span class="print-qty">${i.qty} ${i.unit}</span></div>`).join('')}</div>`;
  }
  const win = window.open('','_blank'); if(!win) return;
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Commande #${order._id.slice(-6)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px;color:#1a1a1a}
h1{font-size:20px;text-align:center;margin-bottom:4px}.date{text-align:center;font-size:13px;color:#666;margin-bottom:20px}
.note{background:#fff8e1;border-left:3px solid #f59e0b;padding:8px 12px;margin-bottom:16px;font-size:13px}
.print-section{margin-bottom:14px}.print-cat{font-size:12px;font-weight:700;text-transform:uppercase;color:#555;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:6px}
.print-item{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #eee;font-size:14px}
.print-qty{font-weight:700;color:#b45309}@media print{body{padding:8px}}</style></head>
<body><h1>🛒 #${order._id.slice(-6)}</h1><div class="date">${dateStr}</div>
${order.note?`<div class="note">📝 ${order.note}</div>`:''}${bodyHTML}
<script>window.onload=()=>{window.print()}<\/script></body></html>`);
  win.document.close();
};

// ── EXPORT CSV ────────────────────────────────────────────────────────────
function exportCSV() {
  if (!allOrders.length) { showToast('Aucune commande', 'error'); return; }
  const rows = [['Date','Heure','Statut','Produit','Bengalî','Quantité','Unité','Note']];
  allOrders.forEach(o => {
    const d = o.date?.toDate ? o.date.toDate() : new Date();
    (o.items||[]).forEach(i => {
      rows.push([d.toLocaleDateString('fr-FR'), d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
        o.status, i.name, i.nameBn||'', i.qty, i.unit, o.note||'']);
    });
  });
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `commandes_${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}.csv` });
  a.click(); URL.revokeObjectURL(a.href);
  showToast('📥 Export téléchargé');
}

// ── TOAST ─────────────────────────────────────────────────────────────────
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

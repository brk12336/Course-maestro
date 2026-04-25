import { db, collection, addDoc, serverTimestamp } from "./firebase-config.js";

let cart = {}, filter = 'all', search = '';

document.addEventListener('DOMContentLoaded', () => {
  renderCategories(); renderProducts(); renderCart(); updateBadges(); bindEvents();
});

function bindEvents() {
  const searchD = document.getElementById('searchInputDesktop');
  const searchM = document.getElementById('searchInputMobile');
  const onSearch = e => {
    search = e.target.value.toLowerCase();
    if (searchD) searchD.value = search;
    if (searchM) searchM.value = search;
    renderProducts();
  };
  if (searchD) searchD.addEventListener('input', onSearch);
  if (searchM) searchM.addEventListener('input', onSearch);

  document.getElementById('btnDefaultOrderDesktop')?.addEventListener('click', loadDefaultOrder);
  document.getElementById('btnClearDesktop')?.addEventListener('click', clearCart);
  document.getElementById('btnSubmitDesktop')?.addEventListener('click', () => submitOrder('desktop'));
  document.getElementById('btnSubmitMobile')?.addEventListener('click', () => submitOrder('mobile'));
  document.getElementById('btnClearMobile')?.addEventListener('click', clearCart);
  document.getElementById('mobileFab')?.addEventListener('click', openCartSheet);

  let touchStartY = 0;
  const sheet = document.getElementById('cartBottomSheet');
  if (sheet) {
    sheet.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener('touchmove',  e => { if (e.touches[0].clientY - touchStartY > 60) closeCartSheet(); }, { passive: true });
  }
}

// ── CATÉGORIES ────────────────────────────────────────────────────────────
function renderCategories() {
  const sidebar   = document.getElementById('categorySidebar');
  const chipsWrap = document.getElementById('mobileCatChips');

  let htmlD = `<button class="cat-btn active" data-cat="all"><span class="cat-icon">🍽️</span><span class="cat-label"><span class="cat-fr">Tout</span><span class="cat-bn">সব</span></span></button>`;
  let htmlM = `<button class="chip active" data-cat="all"><span class="chip-icon">🍽️</span><span class="chip-labels"><span class="chip-fr">Tout</span><span class="chip-bn">সব</span></span></button>`;

  for (const [key, cat] of Object.entries(CATEGORIES)) {
    htmlD += `<button class="cat-btn" data-cat="${key}"><span class="cat-icon">${cat.icon}</span><span class="cat-label"><span class="cat-fr">${cat.label}</span><span class="cat-bn">${cat.labelBn}</span></span></button>`;
    htmlM += `<button class="chip" data-cat="${key}"><span class="chip-icon">${cat.icon}</span><span class="chip-labels"><span class="chip-fr">${cat.label}</span><span class="chip-bn">${cat.labelBn}</span></span></button>`;
  }

  if (sidebar)   { sidebar.innerHTML  = htmlD; sidebar.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => setFilter(b.dataset.cat))); }
  if (chipsWrap) { chipsWrap.innerHTML = htmlM; chipsWrap.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => setFilter(b.dataset.cat))); }
}

function setFilter(cat) {
  filter = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  document.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  document.querySelector('.chip.active')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  renderProducts();
}

// ── PRODUITS ──────────────────────────────────────────────────────────────
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  let products = PRODUCTS;
  if (filter !== 'all') products = products.filter(p => p.category === filter);
  if (search)           products = products.filter(p => p.name.toLowerCase().includes(search) || p.nameBn.includes(search));

  if (!products.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Aucun produit trouvé</p></div>`;
    return;
  }
  grid.innerHTML = products.map(p => {
    const qty = cart[p.id] || 0, inCart = qty > 0, cat = CATEGORIES[p.category];
    return `<div class="product-card ${inCart ? 'in-cart' : ''}">
      <div class="product-img-wrap">
        <img src="${p.imgUrl}" alt="${p.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=280&fit=crop'">
        <div class="product-cat-badge" style="background:${cat.color}">${cat.icon}</div>
        ${inCart ? `<div class="cart-indicator">✓</div>` : ''}
      </div>
      <div class="product-info">
        <h3 class="product-name">${p.name}</h3>
        <p class="product-name-bn">${p.nameBn}</p>
        <p class="product-unit">Unité : ${p.unit}</p>
        <div class="product-qty-controls">
          <button class="qty-btn minus" onclick="changeQty('${p.id}',-1)" ${qty===0?'disabled':''}>−</button>
          <input class="qty-input" type="number" value="${qty}" min="0" onchange="setQty('${p.id}',parseInt(this.value)||0)" onclick="this.select()">
          <button class="qty-btn plus" onclick="changeQty('${p.id}',1)">+</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── PANIER ────────────────────────────────────────────────────────────────
window.changeQty = (id, delta) => {
  const next = Math.max(0, (cart[id] || 0) + delta);
  if (next === 0) delete cart[id]; else cart[id] = next;
  renderProducts(); renderCart(); updateBadges();
};
window.setQty = (id, qty) => {
  if (qty <= 0) delete cart[id]; else cart[id] = qty;
  renderProducts(); renderCart(); updateBadges();
};

function loadDefaultOrder() {
  cart = {};
  PRODUCTS.forEach(p => { if (p.defaultQty > 0) cart[p.id] = p.defaultQty; });
  renderProducts(); renderCart(); updateBadges();
  showToast('⚡ Commande type chargée !');
}

function clearCart() {
  if (!Object.keys(cart).length) return;
  if (!confirm('Vider le panier ?')) return;
  cart = {};
  renderProducts(); renderCart(); updateBadges();
}

function buildCartHTML() {
  const items = Object.entries(cart);
  if (!items.length) return `<div class="cart-empty"><div class="cart-empty-icon">🛒</div><p>Panier vide</p><small>Ajoutez des produits ou ⚡ Commande type</small></div>`;
  const grouped = {};
  items.forEach(([id, qty]) => {
    const p = PRODUCTS.find(x => x.id === id); if (!p) return;
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push({ ...p, qty });
  });
  let html = '';
  for (const [cat, prods] of Object.entries(grouped)) {
    const c = CATEGORIES[cat];
    html += `<div class="cart-section">
      <div class="cart-section-title" style="color:${c.color}">${c.icon} ${c.label}</div>
      ${prods.map(p => `<div class="cart-item">
        <div class="cart-item-names"><span class="cart-item-name">${p.name}</span><span class="cart-item-name-bn">${p.nameBn}</span></div>
        <div class="cart-item-right"><span class="cart-item-qty">${p.qty} ${p.unit}</span>
        <button class="cart-item-remove" onclick="setQty('${p.id}',0)">×</button></div>
      </div>`).join('')}
    </div>`;
  }
  return html;
}

function renderCart() {
  const n = Object.keys(cart).length, label = `${n} article${n>1?'s':''}`, html = buildCartHTML();
  const bodyD = document.getElementById('cartBodyDesktop');
  if (bodyD) bodyD.innerHTML = html;
  const countD = document.getElementById('cartCountDesktop');
  if (countD) countD.textContent = n;
  const totalD = document.getElementById('cartItemsCount');
  if (totalD) totalD.textContent = label;
  const bodyM = document.getElementById('cartBodyMobile');
  if (bodyM) bodyM.innerHTML = html;
  const totalM = document.getElementById('cartItemsCountMob');
  if (totalM) totalM.textContent = label;
}

function updateBadges() {
  const n = Object.keys(cart).length;
  const fab = document.getElementById('fabBadge');
  if (fab) { fab.textContent = n; fab.style.display = n > 0 ? 'flex' : 'none'; }
  const navBadge = document.getElementById('navCartBadge');
  if (navBadge) { navBadge.textContent = n; navBadge.style.display = n > 0 ? 'flex' : 'none'; }
}

window.openCartSheet = () => {
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartBottomSheet').classList.add('open');
  document.body.style.overflow = 'hidden';
};
window.closeCartSheet = () => {
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartBottomSheet').classList.remove('open');
  document.body.style.overflow = '';
};
window.showHomeTab = window.closeCartSheet;

// ── ENVOI FIREBASE ────────────────────────────────────────────────────────
async function submitOrder(source = 'desktop') {
  const items = Object.entries(cart);
  if (!items.length) { showToast('❌ Panier vide !', 'error'); return; }

  const noteEl = source === 'mobile'
    ? document.getElementById('orderNoteMobile')
    : document.getElementById('orderNoteDesktop');
  const note = noteEl?.value.trim() || '';

  const btn = source === 'mobile'
    ? document.getElementById('btnSubmitMobile')
    : document.getElementById('btnSubmitDesktop');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi…'; }

  try {
    await addDoc(collection(db, 'commandes'), {
      date:   serverTimestamp(),
      note,
      status: 'en_attente',
      items:  items.map(([id, qty]) => {
        const p = PRODUCTS.find(x => x.id === id);
        return { id, name: p.name, nameBn: p.nameBn, qty, unit: p.unit, category: p.category };
      })
    });

    const snapshot = { date: new Date().toISOString(), note, items: items.map(([id,qty]) => { const p=PRODUCTS.find(x=>x.id===id); return {id,name:p.name,nameBn:p.nameBn,qty,unit:p.unit,category:p.category}; }) };
    printOrder(snapshot);

    cart = {};
    if (noteEl) noteEl.value = '';
    renderProducts(); renderCart(); updateBadges(); closeCartSheet();
    showToast('✅ Commande envoyée !');
  } catch (err) {
    console.error(err);
    showToast('❌ Erreur réseau, réessaie', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✅ Envoyer la commande'; }
  }
}

// ── IMPRESSION ────────────────────────────────────────────────────────────
function printOrder(order) {
  const date    = new Date(order.date);
  const dateStr = date.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const grouped = {};
  order.items.forEach(i => { if (!grouped[i.category]) grouped[i.category]=[]; grouped[i.category].push(i); });
  let bodyHTML = '';
  for (const [cat, items] of Object.entries(grouped)) {
    const c = CATEGORIES[cat];
    bodyHTML += `<div class="print-section"><div class="print-cat">${c.icon} ${c.label} <span style="font-family:serif;font-size:11px;color:#888">— ${c.labelBn}</span></div>
    ${items.map(i=>`<div class="print-item"><span>${i.name} <span style="font-family:serif;font-size:11px;color:#b45309">${i.nameBn}</span></span><span class="print-qty">${i.qty} ${i.unit}</span></div>`).join('')}</div>`;
  }
  const win = window.open('','_blank'); if(!win) return;
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Commande</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px;color:#1a1a1a}
h1{font-size:20px;text-align:center;margin-bottom:4px}.date{text-align:center;font-size:13px;color:#666;margin-bottom:20px}
.note{background:#fff8e1;border-left:3px solid #f59e0b;padding:8px 12px;margin-bottom:16px;font-size:13px}
.print-section{margin-bottom:14px}.print-cat{font-size:12px;font-weight:700;text-transform:uppercase;color:#555;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:6px}
.print-item{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #eee;font-size:14px}
.print-qty{font-weight:700;color:#b45309}@media print{body{padding:8px}}</style></head>
<body><h1>🛒 Bon de Commande</h1><div class="date">${dateStr}</div>
${order.note?`<div class="note">📝 ${order.note}</div>`:''}${bodyHTML}
<script>window.onload=()=>{window.print()}<\/script></body></html>`);
  win.document.close();
}

// ── TOAST ─────────────────────────────────────────────────────────────────
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

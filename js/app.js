// ── STORAGE ──────────────────────────────────────────────────────────────
const ORDERS_KEY = 'restoOrders';

function getOrders() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; }
  catch { return []; }
}
function saveOrder(order) {
  const orders = getOrders();
  orders.unshift(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

// ── STATE ─────────────────────────────────────────────────────────────────
let cart   = {};
let filter = 'all';
let search = '';

// ── DETECT MOBILE ─────────────────────────────────────────────────────────
const isMobile = () => window.innerWidth < 900;

// ── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderCategories();
  renderProducts();
  renderCart();
  updateBadges();
  bindEvents();
});

// ── EVENTS ────────────────────────────────────────────────────────────────
function bindEvents() {
  // Search — both inputs sync
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

  // Desktop buttons
  const btnDefaultD = document.getElementById('btnDefaultOrderDesktop');
  const btnClearD   = document.getElementById('btnClearDesktop');
  const btnSubmitD  = document.getElementById('btnSubmitDesktop');
  if (btnDefaultD) btnDefaultD.addEventListener('click', loadDefaultOrder);
  if (btnClearD)   btnClearD.addEventListener('click', clearCart);
  if (btnSubmitD)  btnSubmitD.addEventListener('click', () => submitOrder('desktop'));

  // Mobile buttons
  const btnSubmitM = document.getElementById('btnSubmitMobile');
  const btnClearM  = document.getElementById('btnClearMobile');
  const mobileFab  = document.getElementById('mobileFab');
  if (btnSubmitM) btnSubmitM.addEventListener('click', () => submitOrder('mobile'));
  if (btnClearM)  btnClearM.addEventListener('click', clearCart);
  if (mobileFab)  mobileFab.addEventListener('click', openCartSheet);

  // Swipe-down to close sheet
  let touchStartY = 0;
  const sheet = document.getElementById('cartBottomSheet');
  if (sheet) {
    sheet.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener('touchmove', e => {
      const dy = e.touches[0].clientY - touchStartY;
      if (dy > 60) closeCartSheet();
    }, { passive: true });
  }
}

// ── RENDER CATEGORIES (Desktop sidebar + Mobile chips) ────────────────────
function renderCategories() {
  // Desktop sidebar
  const sidebar = document.getElementById('categorySidebar');
  if (sidebar) {
    let html = `<button class="cat-btn active" data-cat="all">
      <span class="cat-icon">🍽️</span>
      <span class="cat-label">
        <span class="cat-fr">Tout</span>
        <span class="cat-bn">সব</span>
      </span>
    </button>`;
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      html += `<button class="cat-btn" data-cat="${key}" style="--cat-color:${cat.color}">
        <span class="cat-icon">${cat.icon}</span>
        <span class="cat-label">
          <span class="cat-fr">${cat.label}</span>
          <span class="cat-bn">${cat.labelBn}</span>
        </span>
      </button>`;
    }
    sidebar.innerHTML = html;
    sidebar.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => setFilter(btn.dataset.cat));
    });
  }

  // Mobile chips
  const chipsWrap = document.getElementById('mobileCatChips');
  if (chipsWrap) {
    let html = `<button class="chip active" data-cat="all">
      <span class="chip-icon">🍽️</span>
      <span class="chip-labels">
        <span class="chip-fr">Tout</span>
        <span class="chip-bn">সব</span>
      </span>
    </button>`;
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      html += `<button class="chip" data-cat="${key}">
        <span class="chip-icon">${cat.icon}</span>
        <span class="chip-labels">
          <span class="chip-fr">${cat.label}</span>
          <span class="chip-bn">${cat.labelBn}</span>
        </span>
      </button>`;
    }
    chipsWrap.innerHTML = html;
    chipsWrap.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => setFilter(btn.dataset.cat));
    });
  }
}

function setFilter(cat) {
  filter = cat;
  // Sync desktop sidebar
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
  // Sync mobile chips
  document.querySelectorAll('.chip').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
  // Scroll active chip into view
  const activeChip = document.querySelector('.chip.active');
  if (activeChip) activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  renderProducts();
}

// ── RENDER PRODUCTS ───────────────────────────────────────────────────────
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  let products = PRODUCTS;
  if (filter !== 'all') products = products.filter(p => p.category === filter);
  if (search)           products = products.filter(p =>
    p.name.toLowerCase().includes(search) || p.nameBn.includes(search)
  );

  if (!products.length) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🔍</div>
      <p>Aucun produit trouvé</p>
    </div>`;
    return;
  }

  grid.innerHTML = products.map(p => {
    const qty    = cart[p.id] || 0;
    const inCart = qty > 0;
    const cat    = CATEGORIES[p.category];
    return `
    <div class="product-card ${inCart ? 'in-cart' : ''}">
      <div class="product-img-wrap">
        <img src="${p.imgUrl}" alt="${p.name}" loading="lazy"
             onerror="this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=280&fit=crop'">
        <div class="product-cat-badge" style="background:${cat.color}">${cat.icon}</div>
        ${inCart ? `<div class="cart-indicator">✓</div>` : ''}
      </div>
      <div class="product-info">
        <h3 class="product-name">${p.name}</h3>
        <p class="product-name-bn">${p.nameBn}</p>
        <p class="product-unit">Unité : ${p.unit}</p>
        <div class="product-qty-controls">
          <button class="qty-btn minus"
            onclick="changeQty('${p.id}', -1)" ${qty === 0 ? 'disabled' : ''}>−</button>
          <input class="qty-input" type="number" value="${qty}" min="0"
            onchange="setQty('${p.id}', parseInt(this.value)||0)"
            onclick="this.select()">
          <button class="qty-btn plus"
            onclick="changeQty('${p.id}', 1)">+</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── CART LOGIC ────────────────────────────────────────────────────────────
function changeQty(id, delta) {
  const next = Math.max(0, (cart[id] || 0) + delta);
  if (next === 0) delete cart[id];
  else            cart[id] = next;
  renderProducts();
  renderCart();
  updateBadges();
}

function setQty(id, qty) {
  if (qty <= 0) delete cart[id];
  else          cart[id] = qty;
  renderProducts();
  renderCart();
  updateBadges();
}

function loadDefaultOrder() {
  cart = {};
  PRODUCTS.forEach(p => { if (p.defaultQty > 0) cart[p.id] = p.defaultQty; });
  renderProducts();
  renderCart();
  updateBadges();
  showToast('⚡ Commande type chargée !');
}

function clearCart() {
  if (!Object.keys(cart).length) return;
  if (!confirm('Vider le panier ?')) return;
  cart = {};
  renderProducts();
  renderCart();
  updateBadges();
}

// ── BUILD CART HTML ───────────────────────────────────────────────────────
function buildCartHTML() {
  const items = Object.entries(cart);
  if (!items.length) {
    return `<div class="cart-empty">
      <div class="cart-empty-icon">🛒</div>
      <p>Panier vide</p>
      <small>Ajoutez des produits ou chargez ⚡ Commande type</small>
    </div>`;
  }

  const grouped = {};
  items.forEach(([id, qty]) => {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) return;
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push({ ...p, qty });
  });

  let html = '';
  for (const [cat, prods] of Object.entries(grouped)) {
    const catInfo = CATEGORIES[cat];
    html += `<div class="cart-section">
      <div class="cart-section-title" style="color:${catInfo.color}">${catInfo.icon} ${catInfo.label}</div>
      ${prods.map(p => `
        <div class="cart-item">
          <div class="cart-item-names">
            <span class="cart-item-name">${p.name}</span>
            <span class="cart-item-name-bn">${p.nameBn}</span>
          </div>
          <div class="cart-item-right">
            <span class="cart-item-qty">${p.qty} ${p.unit}</span>
            <button class="cart-item-remove" onclick="setQty('${p.id}', 0)">×</button>
          </div>
        </div>`).join('')}
    </div>`;
  }
  return html;
}

function renderCart() {
  const items = Object.entries(cart);
  const n      = items.length;
  const label  = `${n} article${n > 1 ? 's' : ''}`;
  const html   = buildCartHTML();

  // Desktop
  const bodyD  = document.getElementById('cartBodyDesktop');
  const countD = document.getElementById('cartCountDesktop');
  const totalD = document.getElementById('cartItemsCount');
  if (bodyD)  bodyD.innerHTML   = html;
  if (countD) countD.textContent = n;
  if (totalD) totalD.textContent = label;

  // Mobile sheet
  const bodyM  = document.getElementById('cartBodyMobile');
  const totalM = document.getElementById('cartItemsCountMob');
  if (bodyM)  bodyM.innerHTML   = html;
  if (totalM) totalM.textContent = label;
}

function updateBadges() {
  const n = Object.keys(cart).length;

  // FAB
  const fab = document.getElementById('fabBadge');
  if (fab) { fab.textContent = n; fab.style.display = n > 0 ? 'flex' : 'none'; }

  // Bottom nav
  const navBadge = document.getElementById('navCartBadge');
  if (navBadge) { navBadge.textContent = n; navBadge.style.display = n > 0 ? 'flex' : 'none'; }
}

// ── CART SHEET (mobile) ───────────────────────────────────────────────────
function openCartSheet() {
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartBottomSheet').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCartSheet() {
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartBottomSheet').classList.remove('open');
  document.body.style.overflow = '';
}

function showHomeTab() {
  closeCartSheet();
}

// ── SUBMIT ORDER ──────────────────────────────────────────────────────────
function submitOrder(source = 'desktop') {
  const items = Object.entries(cart);
  if (!items.length) { showToast('❌ Panier vide !', 'error'); return; }

  const noteEl = source === 'mobile'
    ? document.getElementById('orderNoteMobile')
    : document.getElementById('orderNoteDesktop');
  const note = noteEl ? noteEl.value.trim() : '';

  const order = {
    id:     Date.now(),
    date:   new Date().toISOString(),
    note,
    items:  items.map(([id, qty]) => {
      const p = PRODUCTS.find(x => x.id === id);
      return { id, name: p.name, nameBn: p.nameBn, qty, unit: p.unit, category: p.category };
    }),
    status: 'en_attente'
  };

  saveOrder(order);
  printOrder(order);

  cart = {};
  if (noteEl) noteEl.value = '';
  renderProducts();
  renderCart();
  updateBadges();
  closeCartSheet();
  showToast('✅ Commande envoyée !');
}

// ── PRINT ─────────────────────────────────────────────────────────────────
function printOrder(order) {
  const date    = new Date(order.date);
  const dateStr = date.toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const grouped = {};
  order.items.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  let bodyHTML = '';
  for (const [cat, items] of Object.entries(grouped)) {
    const catInfo = CATEGORIES[cat];
    bodyHTML += `<div class="print-section">
      <div class="print-cat">${catInfo.icon} ${catInfo.label}
        <span style="font-family:serif;font-size:11px;font-weight:400;color:#888"> — ${catInfo.labelBn}</span>
      </div>
      ${items.map(i => `<div class="print-item">
        <span>${i.name} <span style="font-family:serif;font-size:11px;color:#b45309">${i.nameBn}</span></span>
        <span class="print-qty">${i.qty} ${i.unit}</span>
      </div>`).join('')}
    </div>`;
  }

  const win = window.open('', '_blank');
  if (!win) { showToast('⚠️ Autorisez les popups pour imprimer', 'error'); return; }
  win.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Commande ${dateStr}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;padding:20px;color:#1a1a1a}
  h1{font-size:20px;text-align:center;margin-bottom:4px}
  .date{text-align:center;font-size:13px;color:#666;margin-bottom:20px}
  .note{background:#fff8e1;border-left:3px solid #f59e0b;padding:8px 12px;margin-bottom:16px;font-size:13px}
  .print-section{margin-bottom:14px}
  .print-cat{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#555;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:6px}
  .print-item{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #eee;font-size:14px}
  .print-qty{font-weight:700;color:#b45309}
  @media print{body{padding:8px}}
</style></head>
<body>
  <h1>🛒 Bon de Commande</h1>
  <div class="date">${dateStr}</div>
  ${order.note ? `<div class="note">📝 ${order.note}</div>` : ''}
  ${bodyHTML}
  <script>window.onload=()=>{window.print()}<\/script>
</body></html>`);
  win.document.close();
}

// ── TOAST ─────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

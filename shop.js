// shop.js — product listing, product page, cart

const $ = (s, d = document) => d.querySelector(s);
const $$ = (s, d = document) => Array.from(d.querySelectorAll(s));

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json();
}

// -------- cart (localStorage) --------
const CART_KEY = 'eh-cart';
function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}
function writeCart(items) { localStorage.setItem(CART_KEY, JSON.stringify(items)); updateCartLink(); }
function addToCart(item) {
  const cart = readCart();
  const existing = cart.find(i => i.id === item.id);
  const max = Number.isFinite(item.max) ? item.max : Infinity;
  if (existing) {
    existing.qty = Math.min(max, (existing.qty || 0) + item.qty);
  } else {
    item.qty = Math.min(max, item.qty);
    cart.push(item);
  }
  writeCart(cart);
}
function cartCount() { return readCart().reduce((n, i) => n + i.qty, 0); }
function updateCartLink() {
  const link = $('#cartLink');
  if (link) link.textContent = `cart (${cartCount()})`;
}
updateCartLink();

// -------- routing based on page --------
document.addEventListener('DOMContentLoaded', async () => {
  if ($('#shopGrid')) renderShop();
  if ($('#productRoot')) renderProduct();
  if ($('#checkoutRoot')) renderCheckout();
});

// -------- shop (listing) --------
async function renderShop() {
  const grid = $('#shopGrid');
  const products = await fetchJSON('data/products.json');
  grid.innerHTML = products.map(p => `
    <article class="shop-card">
      <a class="shop-card__img" href="product.html?slug=${encodeURIComponent(p.slug)}">
        <img src="${p.images[0]}" alt="${escapeHTML(p.title)}" loading="eager" decoding="async" />
      </a>
      <h2 class="shop-card__title"><a href="product.html?slug=${encodeURIComponent(p.slug)}">${escapeHTML(p.title)}</a></h2>
      <div class="shop-card__price">$${p.price.toFixed(2)}</div>
    </article>
  `).join('');
}

// -------- product detail --------
async function renderProduct() {
  const root = $('#productRoot');
  const slug = new URL(location.href).searchParams.get('slug');
  const products = await fetchJSON('data/products.json');
  const p = products.find(x => x.slug === slug) || products[0];
  if (!p) { $('#productError').textContent = 'Product not found'; return; }

  $('#productTitle').textContent = p.title;
  $('#productPrice').textContent = `$${p.price.toFixed(2)}`;
  $('#productDesc').textContent = p.description;

  const mainImg = $('#productImg');
  mainImg.src = p.images[0];

  const thumbs = $('#thumbs');
  thumbs.innerHTML = p.images.map((src, i) => `
    <button class="thumb${i===0?' is-active':''}" data-src="${src}"><img src="${src}" alt=""></button>
  `).join('');
  thumbs.addEventListener('click', (e) => {
    const btn = e.target.closest('button.thumb');
    if (!btn) return;
    mainImg.src = btn.dataset.src;
    $$('.thumb', thumbs).forEach(b => b.classList.toggle('is-active', b === btn));
  });

  const max = Number.isFinite(p.max) ? p.max : Infinity;
  // If max is 1, lock qty input (already disabled in HTML)
  const qtyInput = $('#qty');
  if (max === 1 && qtyInput) { qtyInput.value = '1'; qtyInput.disabled = true; }

  const addBtn = $('#addToCart');

  const refreshAddedState = () => {
    const existing = readCart().find(i => i.id === p.id);
    if (existing && (existing.qty >= max)) {
      addBtn.textContent = 'go to checkout';
      addBtn.disabled = false;
    } else {
      addBtn.textContent = 'add to cart';
      addBtn.disabled = false;
    }
  };
  refreshAddedState();

  addBtn.addEventListener('click', () => {
    const existing = readCart().find(i => i.id === p.id);
    if (existing && existing.qty >= max) {
      location.href = 'checkout.html';
      return;
    }
    const qty = Math.max(1, parseInt((qtyInput?.value || '1'), 10));
    addToCart({ id: p.id, title: p.title, price: p.price, qty, max });
    refreshAddedState();
    location.href = 'checkout.html';
  });

  root.hidden = false;
}

// -------- checkout --------
function renderCheckout() {
  const root = $('#checkoutRoot');
  const list = $('#checkoutItems');
  const totalEl = $('#checkoutTotal');
  const items = readCart();
  if (!items.length) {
    list.innerHTML = '<p>Your cart is empty.</p>';
    totalEl.textContent = '$0.00';
    return;
  }
  list.innerHTML = items.map(i => `
    <div class="co-item">
      <div class="co-title">${escapeHTML(i.title)}</div>
      <div class="co-qty">× ${i.qty}</div>
      <div class="co-price">$${(i.price * i.qty).toFixed(2)}</div>
    </div>
  `).join('');
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  totalEl.textContent = `$${total.toFixed(2)}`;

  $('#clearCart')?.addEventListener('click', () => { writeCart([]); location.reload(); });
  $('#placeOrder')?.addEventListener('click', () => {
    // Simple email-based checkout for now
    const body = encodeURIComponent(
      'Order Summary\n' + items.map(i => `${i.title} × ${i.qty} — $${(i.price*i.qty).toFixed(2)}`).join('\n') +
      `\n\nTotal: $${total.toFixed(2)}`
    );
    location.href = `mailto:emhern29@asu.edu?subject=Shop%20Order&body=${body}`;
  });
}

function escapeHTML(s) { return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

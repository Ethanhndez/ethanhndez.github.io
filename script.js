/* =========================================================
   script.js  —  Home slider + Gallery masonry
   ========================================================= */

(() => {
  const $ = (s, d = document) => d.querySelector(s);
  const $$ = (s, d = document) => [...d.querySelectorAll(s)];

  const DATA_DIR = 'data';

  // Fade-in loaded state for subtle page transition
  try { document.body.classList.add('is-loaded'); } catch {}
  window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('is-loaded');
  });

  // Intercept internal navigations to fade-out before leaving
  (function enablePageFadeOut() {
    const isInternal = (a) => {
      try {
        const u = new URL(a.href, location.href);
        return u.origin === location.origin && /\.(html?)$/i.test(u.pathname);
      } catch { return false; }
    };
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      // Respect new-tab/middle-click/modified clicks
      if (e.defaultPrevented) return;
      if (e.button !== 0) return; // only left click
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.hasAttribute('data-cat')) return; // gallery category links stay on-page
      if (a.target === '_blank') return;
      if (!isInternal(a)) return;
      e.preventDefault();
      document.body.classList.add('is-fading');
      const href = a.href; // absolute
      setTimeout(() => { location.href = href; }, 140);
    });
  })();

  // Detect which page we’re on
  const page = document.body.dataset.page || (
    // fallback: look for elements that only exist on one page
    $('#stack') ? 'home' : ($('#gallery') ? 'gallery' : '')
  );

  if (page === 'home') initHome();
  if (page === 'gallery') initGallery();

  /* -------------------------------------------------------
     HOME  — vertical “book” scroller
  ------------------------------------------------------- */
  async function initHome() {
    const stack = $('#stack');
    if (!stack) return;

    // Load the 11 image paths
    const paths = await fetchJSON(`${DATA_DIR}/home.json`);
    // Build slides
    stack.innerHTML = paths.map(p => (
      `<section class="slide">
         <img data-src="${p}" alt="" loading="lazy" decoding="async" />
       </section>`
    )).join('');

    // Lazy load images
    const imgs = $$('img[data-src]', stack);
    const io = makeImageObserver(() => {
      // nothing special on load for home
    });
    imgs.forEach(img => io.observe(img));

    // Pager controls
    const prevBtn = $('#prevBtn');
    const nextBtn = $('#nextBtn');
    const indicator = $('#pageIndicator');

    const slides = $$('.slide', stack);
    const total = slides.length;
    let current = 0;

    const updateIndicator = (index) => {
      indicator.textContent = `${index + 1} / ${total}`;
    };

    const scrollToIndex = (index) => {
      current = Math.max(0, Math.min(total - 1, index));
      slides[current].scrollIntoView({ behavior: 'smooth', block: 'start' });
      updateIndicator(current);
    };

    updateIndicator(0);

    prevBtn.addEventListener('click', () => scrollToIndex(current - 1));
    nextBtn.addEventListener('click', () => scrollToIndex(current + 1));

    // Update current slide while user scrolls
    let ticking = false;
    stack.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = stack.scrollTop;
        let nearest = 0;
        let nearestDist = Infinity;
        slides.forEach((s, i) => {
          const dist = Math.abs(s.offsetTop - scrollY);
          if (dist < nearestDist) { nearest = i; nearestDist = dist; }
        });
        if (nearest !== current) {
          current = nearest;
          updateIndicator(current);
        }
        ticking = false;
      });
    });

    // Keyboard arrows for convenience
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') scrollToIndex(current + 1);
      if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   scrollToIndex(current - 1);
    });
  }

  /* -------------------------------------------------------
     GALLERY  — CSS-grid masonry with lazy loading
  ------------------------------------------------------- */
  async function initGallery() {
    const grid = $('#gallery');
    const focus = $('#galleryFocus');
    const focusImg = $('#focusImg');
    const btnPrev = focus?.querySelector('.focus__prev');
    const btnNext = focus?.querySelector('.focus__next');
    const btnUp   = focus?.querySelector('.focus__up');
    const counter = focus?.querySelector('.focus__counter');
    if (!grid) return;

    // Category links on the sidebar
    const catLinks = $$('a[data-cat]');
    const cats = new Set(catLinks.map(a => a.dataset.cat));

    const getCatFromURL = () => {
      const hash = (location.hash || '').replace(/^#/, '');
      const sp = new URLSearchParams(location.search);
      const qp = sp.get('cat');
      if (qp && cats.has(qp)) return qp;
      if (hash && cats.has(hash)) return hash;
      return null;
    };

    let currentCat = getCatFromURL() || (catLinks.find(a => a.classList.contains('active'))?.dataset.cat) || 'street';

    const setActive = (cat) => {
      catLinks.forEach(a => a.classList.toggle('active', a.dataset.cat === cat));
    };

    const loadCategory = async (cat, opts = { replace: false }) => {
      currentCat = cat;
      setActive(cat);
      grid.innerHTML = ''; // clear

      const raw = await fetchJSON(`${DATA_DIR}/${cat}.json`);
      // Normalize to objects: { src, caption? }
      const items = raw.map(entry => (typeof entry === 'string' ? { src: entry } : entry));

      grid.innerHTML = items.map(it => (
        `<a href="#" data-src="${it.src}">
           <img src="${it.src}" alt="" loading="eager" decoding="async">
         </a>`
      )).join('');

      // Lazy + masonry span calculation
      prepareMasonry(grid);

      // Focus viewer state
      enableFocusViewer(items, cat);

      // Update URL
      const url = new URL(location.href);
      url.hash = `#${cat}`;
      if (opts.replace) history.replaceState({ cat }, '', url);
      else history.pushState({ cat }, '', url);
    };

    // First load
    await loadCategory(currentCat, { replace: true });

    // Handle clicks
    catLinks.forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const cat = a.dataset.cat;
        if (cat && cat !== currentCat) loadCategory(cat);
      });
    });

    // Back/forward support
    window.addEventListener('popstate', () => {
      const cat = getCatFromURL() || 'street';
      if (cat !== currentCat) loadCategory(cat, { replace: true });
    });
  }

  /* -------------------------------------------------------
     Helpers
  ------------------------------------------------------- */

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    return res.json();
  }

  // IntersectionObserver for lazy images
  function makeImageObserver(onload) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        const src = img.dataset.src;
        if (!src) { obs.unobserve(img); return; }
        img.src = src;
        // ensure decode for sharp rendering
        img.decode?.().catch(() => {}).finally(() => {
          img.removeAttribute('data-src');
          img.classList.add('is-loaded');
          onload?.(img);
          obs.unobserve(img);
        });
      });
    }, { rootMargin: '200px 0px' });
    return io;
  }

  // Compute masonry row spans based on actual image height
  function prepareMasonry(grid) {
    const items = $$('a', grid);
    const imgs  = $$('img', grid);

    // When images load (or if already cached), compute their row spans
    imgs.forEach((img) => {
      const handler = () => spanItem(img.closest('a'));
      if (img.complete) handler();
      else img.addEventListener('load', handler, { once: true });
    });

    // Recalc on resize (debounced)
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => items.forEach(spanItem), 100);
    });

    // Initial pass (in case some have sizes immediately)
    items.forEach(spanItem);

    function spanItem(item) {
      const img = $('img', item);
      if (!img) return;

      const styles = getComputedStyle(grid);
      const rowH   = parseFloat(styles.getPropertyValue('grid-auto-rows')) || 6;
      const gap    = parseFloat(styles.getPropertyValue('row-gap')) || 0;
      const imgH = img.getBoundingClientRect().height;
      if (imgH === 0) return; // wait until it has size
      const rowSpan = Math.ceil((imgH + gap) / (rowH + gap));
      item.style.gridRowEnd = `span ${rowSpan}`;
    }
  }

  // Recompute spans for all items (use when grid becomes visible)
  function recomputeMasonry(grid) {
    const items = $$('a', grid);
    const styles = getComputedStyle(grid);
    const rowH   = parseFloat(styles.getPropertyValue('grid-auto-rows')) || 6;
    const gap    = parseFloat(styles.getPropertyValue('row-gap')) || 0;
    items.forEach((item) => {
      const img = $('img', item);
      if (!img) return;
      const imgH = img.getBoundingClientRect().height;
      if (!imgH) return;
      const rowSpan = Math.ceil((imgH + gap) / (rowH + gap));
      item.style.gridRowEnd = `span ${rowSpan}`;
    });
  }

  /* -------------------------------------------------------
     Focus viewer (enlarged first image, grid toggle)
  ------------------------------------------------------- */
  function enableFocusViewer(items, cat) {
    const grid = $('#gallery');
    const focus = $('#galleryFocus');
    const focusImg = $('#focusImg');
    const btnPrev = focus.querySelector('.focus__prev');
    const btnNext = focus.querySelector('.focus__next');
    const btnUp   = focus.querySelector('.focus__up');
    const counter = focus.querySelector('.focus__counter');
    const zoneLeft   = focus.querySelector('.zone--left');
    const zoneRight  = focus.querySelector('.zone--right');
    const zoneCenter = focus.querySelector('.zone--center');
    const focusCaption = $('#focusCaption');

    // Index deep-linking via ?i= and persistence per category
    const url = new URL(location.href);
    const paramI = parseInt(url.searchParams.get('i') || '', 10);
    const savedKey = `lastIndex:${cat}`;
    const saved = parseInt(sessionStorage.getItem(savedKey) || '', 10);
    let index = Number.isFinite(paramI) ? Math.max(0, Math.min(items.length - 1, paramI))
              : (Number.isFinite(saved) ? Math.max(0, Math.min(items.length - 1, saved)) : 0);

    const mod = (n, m) => ((n % m) + m) % m; // wrap-around

    const showFocus = (i) => {
      index = mod(i, items.length);
      const { src, caption } = items[index];
      focusImg.src = src;
      counter.textContent = `${index + 1} / ${items.length}`;
      focusCaption.textContent = caption || '';
      focus.hidden = false;
      grid.style.display = 'none';
      // update URL param and save
      const u = new URL(location.href);
      u.searchParams.set('i', String(index));
      history.replaceState({}, '', u);
      sessionStorage.setItem(savedKey, String(index));
    };
    const showGrid = () => {
      grid.style.display = '';
      focus.hidden = true;
      // remove index param when showing grid
      const u = new URL(location.href);
      u.searchParams.delete('i');
      history.replaceState({}, '', u);
      // Recompute spans now that grid is visible
      requestAnimationFrame(() => recomputeMasonry(grid));
    };
    const prev = () => showFocus(index - 1);
    const next = () => showFocus(index + 1);

    // Thumbnail clicks -> focus
    $$('#gallery a').forEach((a, i) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        showFocus(i);
      });
    });

    btnPrev.onclick = prev;
    btnNext.onclick = next;
    btnUp.onclick   = showGrid;
    zoneLeft.onclick = prev;
    zoneRight.onclick = next;
    zoneCenter.onclick = showGrid;

    // Keyboard navigation in focus mode
    window.addEventListener('keydown', (e) => {
      if (focus.hidden) return;
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowUp')    showGrid();
    });

    // Start enlarged at deep-linked/saved index
    showFocus(index);
  }
})();

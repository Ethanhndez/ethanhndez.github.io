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
      if (a.hasAttribute('data-cat')) return; // gallery category links stay on-page
      if (a.target === '_blank') return;
      if (!isInternal(a)) return;
      e.preventDefault();
      document.body.classList.add('is-fading');
      const href = a.getAttribute('href');
      setTimeout(() => { location.href = href; }, 160);
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

      const paths = await fetchJSON(`${DATA_DIR}/${cat}.json`);
      grid.innerHTML = paths.map(p => (
        `<a href="${p}">
           <img data-src="${p}" alt="" loading="lazy" decoding="async">
         </a>`
      )).join('');

      // Lazy + masonry span calculation
      prepareMasonry(grid);

      // Wire up lightbox on click
      enableLightbox(grid, paths);

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

    const io = makeImageObserver((img) => {
      spanItem(img.closest('a'));
    });
    imgs.forEach(img => io.observe(img));

    // Recalc on resize (debounced)
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => items.forEach(spanItem), 100);
    });

    // Initial pass in case some are already cached
    items.forEach(spanItem);

    function spanItem(item) {
      const img = $('img', item);
      if (!img || img.dataset.src) return; // only span once loaded

      // CSS grid auto rows + gap
      const styles = getComputedStyle(grid);
      const rowH   = parseFloat(styles.getPropertyValue('grid-auto-rows')) || 6;
      const gap    = parseFloat(styles.getPropertyValue('row-gap')) || 0;

      // We want the *rendered* height of the image in the current column width
      const imgH = img.getBoundingClientRect().height;
      const rowSpan = Math.ceil((imgH + gap) / (rowH + gap));
      item.style.gridRowEnd = `span ${rowSpan}`;
    }
  }

  /* -------------------------------------------------------
     Lightbox
  ------------------------------------------------------- */
  function ensureLightboxRoot() {
    let lb = $('#lightbox');
    if (lb) return lb;
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.className = 'lightbox';
    lb.innerHTML = `
      <button class="lightbox__close" aria-label="Close">✕</button>
      <button class="lightbox__prev" aria-label="Previous">‹</button>
      <img class="lightbox__img" alt="" />
      <button class="lightbox__next" aria-label="Next">›</button>
      <div class="lightbox__counter" aria-live="polite"></div>
    `;
    document.body.appendChild(lb);
    return lb;
  }

  function enableLightbox(grid, paths) {
    const items = $$('a', grid);
    const lb = ensureLightboxRoot();
    const img = $('.lightbox__img', lb);
    const btnPrev = $('.lightbox__prev', lb);
    const btnNext = $('.lightbox__next', lb);
    const btnClose = $('.lightbox__close', lb);
    const counter = $('.lightbox__counter', lb);
    let index = 0;

    const open = (i) => {
      index = clamp(i, 0, paths.length - 1);
      update();
      lb.classList.add('is-open');
    };
    const close = () => { lb.classList.remove('is-open'); };
    const prev = () => open(index - 1);
    const next = () => open(index + 1);
    const update = () => {
      img.src = paths[index];
      counter.textContent = `${index + 1} / ${paths.length}`;
    };

    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    items.forEach((a, i) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        open(i);
      });
    });

    btnPrev.addEventListener('click', prev);
    btnNext.addEventListener('click', next);
    btnClose.addEventListener('click', close);
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    window.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });
  }
})();

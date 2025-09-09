/* =========================================================
   script.js  —  Home slider + Gallery masonry
   ========================================================= */

(() => {
  const $ = (s, d = document) => d.querySelector(s);
  const $$ = (s, d = document) => [...d.querySelectorAll(s)];

  const DATA_DIR = 'data';

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
    let currentCat = (catLinks.find(a => a.classList.contains('active'))?.dataset.cat) || 'street';

    const setActive = (cat) => {
      catLinks.forEach(a => a.classList.toggle('active', a.dataset.cat === cat));
    };

    const loadCategory = async (cat) => {
      currentCat = cat;
      setActive(cat);
      grid.innerHTML = ''; // clear

      const paths = await fetchJSON(`${DATA_DIR}/${cat}.json`);
      grid.innerHTML = paths.map(p => (
        `<a href="${p}" target="_blank" rel="noopener">
           <img data-src="${p}" alt="" loading="lazy" decoding="async">
         </a>`
      )).join('');

      // Lazy + masonry span calculation
      prepareMasonry(grid);
    };

    // First load
    await loadCategory(currentCat);

    // Handle clicks
    catLinks.forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const cat = a.dataset.cat;
        if (cat && cat !== currentCat) loadCategory(cat);
      });
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
})();

// Simple gallery renderer using a static manifest.
// Keeps the site framework-free and works on GitHub Pages.

(function () {
  const MANIFEST_URL = 'assets/images/manifest.json';
  const MASONRY_ROW_HEIGHT = 8;
  const CATEGORY_ORDER = ['portraits', 'photo-tours', 'landscapes', 'brand-creative', 'food'];
  const CATEGORY_TITLES = {
    portraits: 'Portraits',
    'photo-tours': 'Photo Tours',
    landscapes: 'Landscape',
    'brand-creative': 'Brand & Creative',
    food: 'Food'
  };

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    });
    children.forEach((c) => node.appendChild(c));
    return node;
  }

  function humanize(name) {
    return name
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function withExtension(src, ext) {
    return src.replace(/\.[^.]+$/, ext);
  }

  function figureFor(src, alt) {
    const img = el('img', {
      src,
      alt,
      loading: 'lazy',
      decoding: 'async'
    });
    const picture = el('picture', {}, [
      el('source', { type: 'image/avif', srcset: withExtension(src, '.avif') }),
      el('source', { type: 'image/webp', srcset: withExtension(src, '.webp') }),
      img
    ]);
    return el('figure', { class: 'gallery-item' }, [picture]);
  }

  function debounce(fn, wait = 100) {
    let t = null;
    return function (...args) {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function layoutMasonry(gallery) {
    if (!gallery || !gallery.isConnected) return;
    if (gallery.getClientRects().length === 0) return;

    const styles = getComputedStyle(gallery);
    const gap = parseFloat(styles.rowGap || styles.gap) || 0;

    const items = Array.from(gallery.children).filter((n) => n.classList?.contains('gallery-item'));
    items.forEach((item) => {
      const height = item.getBoundingClientRect().height;
      const span = Math.ceil((height + gap) / (MASONRY_ROW_HEIGHT + gap));
      item.style.gridRowEnd = `span ${Math.max(1, span)}`;
    });

    gallery.classList.add('gallery-masonry-enabled');
  }

  function enableMasonry(gallery) {
    if (!gallery || gallery.dataset.masonry === 'on') return;
    gallery.dataset.masonry = 'on';
    gallery.classList.add('gallery-masonry');

    let raf = null;
    const schedule = () => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        layoutMasonry(gallery);
      });
    };

    gallery.querySelectorAll('img').forEach((img) => {
      if (img.complete) return;
      img.addEventListener('load', schedule, { passive: true });
      img.addEventListener('error', schedule, { passive: true });
    });

    window.addEventListener('resize', debounce(schedule, 120), { passive: true });
    schedule();
  }

  async function loadManifest() {
    if (location.protocol === 'file:') {
      throw new Error('Local file protocol blocks fetch; run a local server.');
    }
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load manifest');
    return res.json();
  }

  function prioritizeCategories(allCategories) {
    const valid = (allCategories || []).filter((cat) => cat.images && cat.images.length);
    const byName = new Map(valid.map((cat) => [cat.name, cat]));

    const prioritized = CATEGORY_ORDER
      .map((name) => byName.get(name))
      .filter(Boolean)
      .map((cat) => ({
        ...cat,
        title: CATEGORY_TITLES[cat.name] || cat.title || humanize(cat.name)
      }));

    if (prioritized.length) return prioritized;

    return valid.map((cat) => ({
      ...cat,
      title: CATEGORY_TITLES[cat.name] || cat.title || humanize(cat.name)
    }));
  }

  async function renderPortfolio(rootId) {
    const root = document.getElementById(rootId);
    if (!root) return;
    try {
      const manifest = await loadManifest();
      const cats = prioritizeCategories(manifest.categories);
      if (!cats.length) {
        root.appendChild(el('p', { class: 'muted', text: 'No images found.' }));
        return;
      }

      const tabs = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Portfolio categories' });
      const panelsWrap = el('div', {});
      const tabEls = [];
      const panelEls = [];

      function activate(index, setHash = true) {
        tabEls.forEach((t, i) => {
          const selected = i === index;
          t.setAttribute('aria-selected', selected ? 'true' : 'false');
          t.tabIndex = selected ? 0 : -1;
        });
        panelEls.forEach((p, i) => {
          p.hidden = i !== index;
        });
        const gallery = panelEls[index]?.querySelector('.gallery');
        if (gallery) enableMasonry(gallery);
        if (setHash) {
          const name = cats[index].name;
          try { history.replaceState(null, '', `#${name}`); } catch (_) {
            location.hash = name;
          }
        }
        // focus selected tab for keyboard users
        tabEls[index].focus({ preventScroll: true });
      }

      cats.forEach((cat, i) => {
        const tid = `tab-${cat.name}`;
        const pid = `panel-${cat.name}`;
        const t = el('button', {
          class: 'tab',
          role: 'tab',
          id: tid,
          'aria-selected': 'false',
          'aria-controls': pid
        }, [document.createTextNode(cat.title || humanize(cat.name))]);
        t.tabIndex = -1;
        t.addEventListener('click', () => activate(i));
        t.addEventListener('keydown', (e) => {
          const key = e.key;
          let ni = null;
          if (key === 'ArrowRight') ni = (i + 1) % tabEls.length;
          else if (key === 'ArrowLeft') ni = (i - 1 + tabEls.length) % tabEls.length;
          else if (key === 'Home') ni = 0;
          else if (key === 'End') ni = tabEls.length - 1;
          if (ni !== null) {
            e.preventDefault();
            activate(ni);
          }
        });
        tabEls.push(t);
        tabs.appendChild(t);

        const panel = el('div', { class: 'tab-panel', id: pid, role: 'tabpanel', 'aria-labelledby': tid });
        const gallery = el('div', { class: 'gallery gallery-masonry' });
        cat.images.forEach((file) => {
          const src = `${manifest.basePath}/${cat.name}/${file}`;
          gallery.appendChild(figureFor(src, `${cat.title || humanize(cat.name)} — Elle Phoenix`));
        });
        panel.appendChild(gallery);
        panel.hidden = true;
        panelEls.push(panel);
        panelsWrap.appendChild(panel);
      });

      root.appendChild(tabs);
      root.appendChild(panelsWrap);

      // initial selection based on hash or default first
      const wanted = (location.hash || '').replace('#', '');
      const initialIndex = Math.max(0, cats.findIndex(c => c.name === wanted));
      activate(initialIndex, false);

      window.addEventListener('hashchange', () => {
        const h = (location.hash || '').replace('#', '');
        const idx = cats.findIndex(c => c.name === h);
        if (idx >= 0) activate(idx, false);
      });
    } catch (e) {
      const msg = location.protocol === 'file:'
        ? 'Galleries need a local server. Run `make serve` and reload.'
        : 'No images found.';
      root.appendChild(el('p', { class: 'muted', text: msg }));
    }
  }

  async function renderFeatured(rootId, count = 6) {
    const root = document.getElementById(rootId);
    if (!root) return;
    try {
      const manifest = await loadManifest();
      const flat = [];
      manifest.categories.forEach((cat) => {
        (cat.images || []).forEach((file) => {
          flat.push({
            src: `${manifest.basePath}/${cat.name}/${file}`,
            alt: `${cat.title || humanize(cat.name)} — Elle Phoenix`
          });
        });
      });
      const take = flat.slice(0, count);
      take.forEach((it) => root.appendChild(figureFor(it.src, it.alt)));
    } catch (e) {
      const msg = location.protocol === 'file:'
        ? 'Featured images need a local server. Run `make serve` and reload.'
        : 'No featured images found.';
      root.appendChild(el('p', { class: 'muted', text: msg }));
    }
  }

  window.Gallery = { renderPortfolio, renderFeatured };
})();

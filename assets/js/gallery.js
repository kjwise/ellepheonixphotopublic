// Simple gallery renderer using a static manifest.
// Keeps the site framework-free and works on GitHub Pages.

(function () {
  const MANIFEST_URL = 'assets/images/manifest.json';

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

  function figureFor(src, alt) {
    const img = el('img', {
      src,
      alt,
      loading: 'lazy'
    });
    return el('figure', { class: 'gallery-item' }, [img]);
  }

  async function loadManifest() {
    if (location.protocol === 'file:') {
      throw new Error('Local file protocol blocks fetch; run a local server.');
    }
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load manifest');
    return res.json();
  }

  async function renderPortfolio(rootId) {
    const root = document.getElementById(rootId);
    if (!root) return;
    try {
      const manifest = await loadManifest();
      const cats = (manifest.categories || []).filter(c => c.images && c.images.length);
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
        const gallery = el('div', { class: 'gallery' });
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

// Small floating switcher for comparing the redesigns. Styles live in a shadow root
// so no theme can break it. Position: <script src="../switcher.js" data-pos="top-right">.
(function () {
  const DESIGNS = [
    { slug: 'space', name: 'Space' },
    { slug: 'watch', name: 'Watch Face' },
    { slug: 'city', name: 'City' },
    { slug: 'pastel', name: 'Pastel' },
  ];
  const script = document.currentScript;
  const base = new URL('./', script.src); // site/redesigns/
  const pos = (script.dataset.pos || 'bottom-right').split('-');
  const slug = location.pathname.split('/').filter(Boolean).slice(-1)[0];
  const i = DESIGNS.findIndex((d) => d.slug === slug);
  if (i < 0) return;
  try { if (sessionStorage.getItem('switcher-hidden') === '1') return; } catch (e) {}

  const prev = DESIGNS[(i + DESIGNS.length - 1) % DESIGNS.length];
  const next = DESIGNS[(i + 1) % DESIGNS.length];
  const href = (d) => new URL(d.slug + '/', base).href;

  function mount() {
    const host = document.createElement('div');
    host.setAttribute('data-design-switcher', '');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { all: initial; position: fixed; z-index: 2147483000; ${pos[0]}: 12px; ${pos[1]}: 12px; }
        nav { display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 999px;
          background: rgba(18, 18, 20, .86); color: #f4f4f5; box-shadow: 0 6px 24px rgba(0, 0, 0, .28);
          font: 500 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
        a, button { all: unset; cursor: pointer; padding: 7px 9px; border-radius: 999px; color: inherit; white-space: nowrap; }
        a:hover, button:hover { background: rgba(255, 255, 255, .14); }
        a:focus-visible, button:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
        .name { padding: 0 6px; opacity: .9; }
        .num { opacity: .55; margin-right: 4px; }
        .x { opacity: .6; }
        @media (max-width: 480px) { .name .label { display: none; } }
      </style>
      <nav aria-label="Compare redesigns">
        <a href="${href(prev)}" title="Previous: ${prev.name}" aria-label="Previous design: ${prev.name}">‹</a>
        <span class="name"><span class="num">${i + 1}/${DESIGNS.length}</span><span class="label">${DESIGNS[i].name}</span></span>
        <a href="${href(next)}" title="Next: ${next.name}" aria-label="Next design: ${next.name}">›</a>
        <a href="${base.href}" title="All designs">All</a>
        <button class="x" type="button" aria-label="Hide the design switcher">✕</button>
      </nav>`;
    root.querySelector('.x').addEventListener('click', () => {
      try { sessionStorage.setItem('switcher-hidden', '1'); } catch (e) {}
      host.remove();
    });
    document.body.appendChild(host);
  }
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount);
})();

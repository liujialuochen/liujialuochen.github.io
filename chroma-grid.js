/* ===========================================================
   ChromaGrid · 原生聚光灯彩色网格
   参考用户提供的 React ChromaGrid：指针位置驱动的径向揭示遮罩，
   灰度底图 + 彩色图层 + 卡片描边光晕，单个 rAF 做阻尼跟随。
   零依赖。用于 04 板块「创意短片」三张封面，点击打开短片播放层。
   =========================================================== */
(function () {
  'use strict';

  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const falloffStops = softness => {
    const core = Math.min(.95, Math.max(0, 1 - softness));
    const out = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const u = Math.min(1, Math.max(0, (t - core) / Math.max(.0001, 1 - core)));
      const a = 1 - u * u * u * (u * (u * 6 - 15) + 10);
      out.push('rgba(0,0,0,' + a.toFixed(3) + ') ' + (t * 100).toFixed(1) + '%');
    }
    return out.join(', ');
  };

  function init(root, items, options) {
    if (!root || !Array.isArray(items) || !items.length) return null;

    const opt = Object.assign({
      columns: 3, minCardWidth: 210, gap: 14, radius: 280,
      softness: .62, damping: .45, fadeOut: .6,
      grayscale: 1, dim: .05, glow: .5, borderGlow: 1,
      aspectRatio: '4 / 3',
      basePower: .14          // 静止时留一点色彩，避免三张封面全灰不可辨
    }, options || {});

    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const fine = !!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches);
    const idle = reduce || !fine ? 1 : opt.basePower;

    root.classList.add('chroma-grid');
    root.style.setProperty('--chroma-cols', String(Math.max(1, Math.round(opt.columns))));
    root.style.setProperty('--chroma-min', Math.max(80, opt.minCardWidth) + 'px');
    root.style.setProperty('--chroma-gap', Math.max(0, opt.gap) + 'px');
    root.style.setProperty('--chroma-r', Math.max(20, opt.radius) + 'px');
    root.style.setProperty('--chroma-stops', falloffStops(Math.min(1, Math.max(0, opt.softness))));
    root.style.setProperty('--chroma-gray', String(Math.min(1, Math.max(0, opt.grayscale))));
    root.style.setProperty('--chroma-dim', String(Math.min(.9, Math.max(0, opt.dim))));
    root.style.setProperty('--chroma-glow', String(Math.min(1, Math.max(0, opt.glow))));
    root.style.setProperty('--chroma-border', String(Math.min(1, Math.max(0, opt.borderGlow))));
    root.style.setProperty('--chroma-ratio', opt.aspectRatio);
    root.style.setProperty('--chroma-radius', '0px');
    root.style.setProperty('--chroma-power', String(idle));

    root.innerHTML = `
      <div class="chroma-grid-inner">
        ${items.map((it, i) => `
          <article class="chroma-card" data-chroma-area data-index="${i}" tabindex="0" role="button"
                   aria-label="${esc(it.text || '')} — 点击播放短片"
                   style="--chroma-accent:${esc(it.accent || '#1E305E')}">
            <span class="chroma-wash" aria-hidden="true"></span>
            <div class="chroma-media" data-chroma-area>
              <img class="chroma-mono" src="${esc(it.image)}" alt="${esc(it.alt || it.text || '')}" loading="lazy" draggable="false">
              <img class="chroma-color" src="${esc(it.image)}" alt="" aria-hidden="true" loading="lazy" draggable="false">
              <span class="chroma-media-rim" aria-hidden="true"></span>
            </div>
            <div class="chroma-info">
              <span class="chroma-title serif">${esc(it.text || '')}</span>
              <span class="chroma-subtitle eyebrow">${esc(it.sub || '')}</span>
            </div>
            <span class="chroma-play eyebrow" aria-hidden="true">点击播放 <span>↗</span></span>
            <span class="chroma-card-rim" aria-hidden="true"></span>
            <span class="chroma-card-glow" aria-hidden="true"></span>
          </article>`).join('')}
      </div>
      <div class="cg-player" hidden>
        <div class="cg-player-backdrop" data-close="1"></div>
        <div class="cg-player-box" role="dialog" aria-modal="true" aria-label="短片播放">
          <button class="cg-player-close" type="button" aria-label="关闭播放">✕ <span>CLOSE</span></button>
          <div class="cg-player-frame"><video controls playsinline preload="none"></video></div>
          <div class="cg-player-meta">
            <span class="eyebrow">FILM / 创意短片</span>
            <span class="cg-player-title serif"></span>
            <span class="eyebrow cg-player-sub"></span>
          </div>
        </div>
      </div>`;

    const player = root.querySelector('.cg-player');
    const video = player.querySelector('video');
    const titleEl = player.querySelector('.cg-player-title');
    const subEl = player.querySelector('.cg-player-sub');
    const closeBtn = player.querySelector('.cg-player-close');
    const cards = Array.prototype.slice.call(root.querySelectorAll('.chroma-card'));

    /* ---------- 播放层 ---------- */
    let openIndex = -1;
    function openPlayer(i) {
      const it = items[i];
      if (!it) return;
      openIndex = i;
      titleEl.textContent = it.text || '';
      subEl.textContent = it.sub || '';
      video.poster = it.image || '';
      video.src = it.video || '';
      player.hidden = false;
      root.classList.add('is-open');
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      closeBtn.focus({ preventScroll: true });
    }
    function closePlayer() {
      if (openIndex < 0) return;
      openIndex = -1;
      video.pause();
      video.removeAttribute('src');
      video.load();
      player.hidden = true;
      root.classList.remove('is-open');
    }
    closeBtn.addEventListener('click', closePlayer);
    player.addEventListener('click', e => {
      if (e.target.dataset && e.target.dataset.close) closePlayer();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && openIndex >= 0) { e.preventDefault(); closePlayer(); }
    });
    cards.forEach(card => {
      card.addEventListener('click', () => openPlayer(Number(card.dataset.index)));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPlayer(Number(card.dataset.index));
        }
      });
    });

    /* ---------- 聚光灯：位置与强度 ---------- */
    const state = { x: 0, y: 0, tx: 0, ty: 0, power: idle, target: idle, primed: false };
    let raf = 0, last = 0;

    function place() {
      const box = root.getBoundingClientRect();
      Array.prototype.forEach.call(root.querySelectorAll('[data-chroma-area]'), node => {
        const r = node.getBoundingClientRect();
        node.style.setProperty('--chroma-ox', (r.left - box.left).toFixed(2) + 'px');
        node.style.setProperty('--chroma-oy', (r.top - box.top).toFixed(2) + 'px');
      });
    }

    function frame(now) {
      raf = 0;
      const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const follow = reduce ? 1 : 1 - Math.exp(-dt / Math.max(.01, opt.damping * .32));
      state.x += (state.tx - state.x) * follow;
      state.y += (state.ty - state.y) * follow;
      const span = state.target > state.power ? .1 : Math.max(.02, opt.fadeOut * .35);
      state.power += (state.target - state.power) * (reduce ? 1 : 1 - Math.exp(-dt / span));
      root.style.setProperty('--chroma-x', state.x.toFixed(2) + 'px');
      root.style.setProperty('--chroma-y', state.y.toFixed(2) + 'px');
      root.style.setProperty('--chroma-power', state.power.toFixed(4));
      const settled = Math.abs(state.tx - state.x) < .1 &&
                      Math.abs(state.ty - state.y) < .1 &&
                      Math.abs(state.target - state.power) < .002;
      if (settled) {
        state.power = state.target;
        root.style.setProperty('--chroma-power', state.power.toFixed(4));
        last = 0;
      } else raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf) raf = requestAnimationFrame(frame); }

    function onMove(e) {
      if (!fine || reduce) return;
      const box = root.getBoundingClientRect();
      state.tx = e.clientX - box.left;
      state.ty = e.clientY - box.top;
      if (!state.primed || state.power < .02) {
        state.x = state.tx; state.y = state.ty; state.primed = true;
      }
      state.target = 1;
      wake();
    }
    function onLeave() { state.target = idle; wake(); }

    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerdown', onMove, { passive: true });
    root.addEventListener('pointerleave', onLeave, { passive: true });
    root.addEventListener('pointercancel', onLeave, { passive: true });

    place();
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(place);
      ro.observe(root);
    }
    window.addEventListener('load', place, { once: true });
    Array.prototype.forEach.call(root.querySelectorAll('.chroma-media img'), img => {
      img.addEventListener('load', place, { once: true });
    });

    return { open: openPlayer, close: closePlayer, place: place };
  }

  window.ChromaGrid = { init: init };
})();

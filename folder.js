/* ===========================================================
   Folder · 原生 3D 证书文件夹
   参考用户提供的 React Folder：前盖翻起、证书卡片从夹内摊开、
   点击放大、分页浏览。用 CSS 3D + 过渡实现，零依赖。
   用于 06「综合能力背书 / 荣誉类」下方的 24 张真实证书。
   =========================================================== */
(function () {
  'use strict';

  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function init(root, items, options) {
    if (!root || !Array.isArray(items) || !items.length) return null;
    const opt = Object.assign({ perPage: 6, label: 'HONORS / 荣誉证书' }, options || {});
    const per = Math.max(1, opt.perPage);
    const pages = Math.ceil(items.length / per);
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let page = 0, open = false, light = -1;

    root.classList.add('fd-root');
    root.innerHTML = `
      <div class="fd-head">
        <span class="eyebrow">CERTIFICATES / 证书档案</span>
        <span class="eyebrow">${items.length} CERTIFICATES · 点击开合 · 点击证书放大</span>
      </div>
      <div class="fd-stage" role="button" tabindex="0" aria-expanded="false"
           aria-label="荣誉证书文件夹，点击开合，展开后可点击证书放大">
        <div class="fd-docs" aria-hidden="true"></div>
        <div class="fd-back">
          <span class="fd-tab eyebrow">${esc(opt.label)}</span>
          <span class="fd-back-mark eyebrow">ARCHIVE / ${String(items.length).padStart(2, '0')} CERTIFICATES</span>
        </div>
        <div class="fd-front">
          <span class="fd-front-mark serif">HONORS</span>
          <span class="eyebrow">${String(items.length).padStart(2, '0')} CERTIFICATES</span>
          <span class="fd-front-line" aria-hidden="true"></span>
        </div>
      </div>
      <div class="fd-ui">
        <button class="fd-btn" type="button" data-dir="-1" aria-label="上一组证书">← <span>PREV</span></button>
        <span class="fd-page eyebrow"></span>
        <button class="fd-btn" type="button" data-dir="1" aria-label="下一组证书"><span>NEXT</span> →</button>
        <button class="fd-btn fd-toggle" type="button" aria-expanded="false">OPEN / 展开</button>
      </div>
      <div class="fd-lightbox" hidden>
        <div class="fd-lightbox-backdrop" data-close="1"></div>
        <div class="fd-lightbox-box" role="dialog" aria-modal="true" aria-label="证书大图">
          <button class="fd-lightbox-close" type="button" aria-label="关闭">✕ <span>CLOSE</span></button>
          <div class="fd-lightbox-frame"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></div>
          <div class="fd-lightbox-meta">
            <span class="eyebrow fd-lightbox-no"></span>
            <button class="fd-btn" type="button" data-light="-1">← <span>PREV</span></button>
            <button class="fd-btn" type="button" data-light="1"><span>NEXT</span> →</button>
          </div>
        </div>
      </div>`;

    const stage = root.querySelector('.fd-stage');
    const docs = root.querySelector('.fd-docs');
    const pageEl = root.querySelector('.fd-page');
    const toggle = root.querySelector('.fd-toggle');
    const lightbox = root.querySelector('.fd-lightbox');
    const lightImg = lightbox.querySelector('img');
    const lightNo = lightbox.querySelector('.fd-lightbox-no');
    const closeBtn = lightbox.querySelector('.fd-lightbox-close');

    /* ---------- 证书卡片位置：6 张像一叠纸一样从夹内扇形摊开 ----------
       只占用文件夹上方约一张卡片的高度，避免遮挡上面的荣誉清单；
       横向步长按舞台真实宽度收敛，窄屏也不会溢出。 */
    function layout() {
      const cards = docs.querySelectorAll('.fd-doc');
      const n = cards.length || 1;
      const w = stage.clientWidth || 560;
      const H = stage.clientHeight || 200;
      // 横向步长不小于卡片宽度，保证每张卡片的中心不被相邻卡片盖住（可点、可放大）。
      const cw = Math.max(56, Math.min(138, (w - 16) / (1 + .68 * (n - 1))));
      const ch = cw * 1.34;
      const spread = cw * .68;
      const mid = (n - 1) / 2;
      let minTop = 0;
      cards.forEach((card, i) => {
        const k = i - mid;
        const x = k * spread;
        const y = -ch - 40 - Math.abs(k) * 9;
        const rot = k * 4.6;
        card.style.width = cw + 'px';
        card.style.height = ch + 'px';
        card.style.setProperty('--fd-x', x.toFixed(1) + 'px');
        card.style.setProperty('--fd-y', y.toFixed(1) + 'px');
        card.style.setProperty('--fd-r', rot.toFixed(1) + 'deg');
        card.style.setProperty('--fd-delay', (i * 55) + 'ms');
        const tilt = Math.abs(Math.sin(rot * Math.PI / 180)) * cw / 2;
        minTop = Math.min(minTop, H / 2 + y - ch / 2 - tilt);
      });
      // 按真实尺寸动态留出摊开所需的高度，避免证书盖住上方标题或压到荣誉清单。
      root.style.setProperty('--fd-head-gap', Math.max(96, Math.ceil(-minTop + 22)) + 'px');
      stage.style.setProperty('--fd-doc-h', ch + 'px');
    }

    function render() {
      const slice = items.slice(page * per, page * per + per);
      docs.innerHTML = slice.map((it, i) => {
        const n = page * per + i;
        return `<button class="fd-doc" type="button" data-index="${n}"
                  aria-label="放大查看第 ${n + 1} 张证书" tabindex="${open ? 0 : -1}">
                  <img src="${esc(it.src)}" alt="${esc(it.alt || ('荣誉证书 ' + (n + 1)))}" loading="lazy" draggable="false">
                  <span class="eyebrow fd-doc-no">${String(n + 1).padStart(2, '0')}</span>
                </button>`;
      }).join('');
      pageEl.textContent = String(page * per + 1).padStart(2, '0') + '–' +
        String(Math.min(items.length, page * per + per)).padStart(2, '0') +
        ' / ' + String(items.length).padStart(2, '0') + '  ·  ' +
        String(page + 1).padStart(2, '0') + ' / ' + String(pages).padStart(2, '0');
      layout();
      docs.querySelectorAll('.fd-doc').forEach(b => {
        b.addEventListener('click', e => {
          e.stopPropagation();
          if (!open) { setOpen(true); return; }
          openLight(Number(b.dataset.index));
        });
      });
    }

    function setOpen(next) {
      open = next;
      root.toggleAttribute('data-open', open);
      stage.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'CLOSE / 收起' : 'OPEN / 展开';
      docs.setAttribute('aria-hidden', String(!open));
      docs.querySelectorAll('.fd-doc').forEach(b => { b.tabIndex = open ? 0 : -1; });
    }

    /* ---------- 放大层 ---------- */
    function showLight() {
      const it = items[light];
      if (!it) return;
      lightImg.src = it.src;
      lightImg.alt = it.alt || ('荣誉证书 ' + (light + 1));
      lightNo.textContent = 'CERTIFICATE ' + String(light + 1).padStart(2, '0') +
        ' / ' + String(items.length).padStart(2, '0');
      lightbox.hidden = false;
      closeBtn.focus({ preventScroll: true });
    }
    function openLight(i) { light = i; showLight(); }
    function closeLight() {
      light = -1;
      lightbox.hidden = true;
      lightImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
    closeBtn.addEventListener('click', closeLight);
    lightbox.addEventListener('click', e => {
      if (e.target.dataset && e.target.dataset.close) closeLight();
      const step = e.target.closest && e.target.closest('[data-light]');
      if (step) {
        light = (light + Number(step.dataset.light) + items.length) % items.length;
        showLight();
      }
    });
    document.addEventListener('keydown', e => {
      if (light < 0) return;
      if (e.key === 'Escape') { e.preventDefault(); closeLight(); }
      else if (e.key === 'ArrowRight') { light = (light + 1) % items.length; showLight(); }
      else if (e.key === 'ArrowLeft') { light = (light - 1 + items.length) % items.length; showLight(); }
    });

    /* ---------- 开合 / 翻页 ---------- */
    stage.addEventListener('click', () => setOpen(!open));
    stage.addEventListener('keydown', e => {
      if (e.target !== stage) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); }
    });
    toggle.addEventListener('click', () => setOpen(!open));
    root.querySelectorAll('[data-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        page = (page + Number(btn.dataset.dir) + pages) % pages;
        render();
      });
    });

    render();
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(layout);
      ro.observe(stage);
    }
    // 进入视口时轻轻打开一次，给出「这是个可交互文件夹」的提示
    if (!reduce && 'IntersectionObserver' in window) {
      let shown = false;
      const io = new IntersectionObserver(entries => {
        if (shown || !entries.some(e => e.isIntersecting)) return;
        shown = true;
        io.disconnect();
        setTimeout(() => setOpen(true), 420);
      }, { threshold: .35 });
      io.observe(root);
    }

    return { open: () => setOpen(true), close: () => setOpen(false), page: n => { page = n; render(); } };
  }

  window.CertFolder = { init: init };
})();

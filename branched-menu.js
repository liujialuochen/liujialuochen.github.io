/* ===========================================================
   BranchedMenu · 原生 JS 分支树状菜单
   参考用户提供的 React BranchedMenu：主干细线 + 圆角分支曲线 +
   当前项 reach 描线 + 滑动标记点 + grid 展开折叠。零依赖。

   用于 06「综合能力背书 / 技能」：五个分类为 section head，
   具体工具为叶子；默认全部展开，保证求职信息一眼可见。
   =========================================================== */
(function () {
  'use strict';

  const PAD = 6;
  const MARK = 16;
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function init(root, items, options) {
    if (!root || !items || !items.length) return null;

    const opt = Object.assign({
      rowHeight: 34,
      indent: 38,
      trunk: 13,
      radius: 9,
      lineWidth: 1.4,
      openAll: true,
      active: ''
    }, options || {});

    const r = Math.min(opt.radius, opt.rowHeight / 2 - 2);
    const endX = opt.indent - 8;
    const rowY = k => PAD + k * opt.rowHeight + opt.rowHeight / 2;
    const branch = k =>
      `M ${opt.trunk} ${rowY(k) - r} A ${r} ${r} 0 0 0 ${opt.trunk + r} ${rowY(k)} H ${endX}`;
    const reach = k =>
      `M ${opt.trunk} 0 V ${rowY(k) - r} A ${r} ${r} 0 0 0 ${opt.trunk + r} ${rowY(k)} H ${endX}`;
    const length = k =>
      rowY(k) - r + (Math.PI * r) / 2 + (endX - opt.trunk - r);

    /* 技能名后可插入对应的 App 图标：icons:[{after:'Word',key:'word'}, ...]
       图标 SVG 来自 app-icons.js，均为固定字符串，不含外部输入。 */
    const labelHTML = kid => {
      const base = esc(kid.label);
      if (!window.AppIcons) return base;
      if (Array.isArray(kid.icons)) {
        return kid.icons.reduce((s, spec) =>
          s.replace(esc(spec.after), esc(spec.after) + window.AppIcons.svg(spec.key)), base);
      }
      return kid.icon ? base + window.AppIcons.svg(kid.icon) : base;
    };

    const flat = [];
    items.forEach((it, i) => (it.children || []).forEach(k => flat.push({ value: k.value, section: i })));
    let active = opt.active || (flat[0] && flat[0].value) || '';
    const open = new Set(opt.openAll ? items.map((_, i) => i) : [0]);

    root.classList.add('bm-root');
    root.innerHTML = `
      <span class="bm-marker" aria-hidden="true"></span>
      ${items.map((it, i) => {
        const kids = it.children || [];
        const bodyH = PAD * 2 + kids.length * opt.rowHeight;
        const isOpen = open.has(i);
        const lastRow = Math.max(0, kids.length - 1);
        return `
        <div class="bm-section"${isOpen ? ' data-open' : ''}>
          <button class="bm-head" type="button" aria-expanded="${isOpen}">
            <span class="bm-head-label">${esc(it.label)}</span>
            <span class="bm-head-count" aria-label="${kids.length} 项">${String(kids.length).padStart(2, '0')}</span>
          </button>
          <div class="bm-body">
            <div class="bm-fold">
              <div class="bm-tree" style="height:${bodyH}px">
                <svg class="bm-lines" width="${opt.indent}" height="${bodyH}" aria-hidden="true">
                  <path class="bm-base" d="M ${opt.trunk} 0 V ${rowY(lastRow) - r}"></path>
                  ${kids.map((_, k) => `<path class="bm-base" d="${branch(k)}"></path>`).join('')}
                  ${kids.map((kid, k) => `<path class="bm-reach" d="${reach(k)}"
                      style="stroke-dasharray:${length(k)};stroke-dashoffset:${kid.value === active ? 0 : length(k)}"></path>`).join('')}
                </svg>
                ${kids.map(kid => `
                  <button class="bm-item" type="button" data-value="${esc(kid.value)}"
                    title="${esc(kid.label)}"
                    ${kid.value === active ? 'data-active aria-current="true"' : ''}
                    tabindex="${isOpen ? 0 : -1}">${labelHTML(kid)}</button>`).join('')}
              </div>
            </div>
          </div>
        </div>`;
      }).join('')}
    `;

    const sections = Array.prototype.slice.call(root.querySelectorAll('.bm-section'));
    const heads = Array.prototype.slice.call(root.querySelectorAll('.bm-head'));
    const marker = root.querySelector('.bm-marker');

    const activeSection = () =>
      items.findIndex(it => (it.children || []).some(k => k.value === active));

    function placeMarker(glide) {
      if (!marker) return;
      const sec = activeSection();
      const el = heads[sec];
      const shown = sec >= 0 && open.has(sec) && el;
      if (!glide) marker.style.transition = 'none';
      if (shown) marker.style.top = (el.offsetTop + (el.offsetHeight - MARK) / 2) + 'px';
      marker.toggleAttribute('data-on', !!shown);
      if (!glide) { void marker.offsetHeight; marker.style.transition = ''; }
    }

    function paint() {
      sections.forEach((sec, i) => {
        const isOpen = open.has(i);
        sec.toggleAttribute('data-open', isOpen);
        heads[i].setAttribute('aria-expanded', String(isOpen));
        Array.prototype.forEach.call(sec.querySelectorAll('.bm-item'), b => {
          const on = b.dataset.value === active;
          b.toggleAttribute('data-active', on);
          if (on) b.setAttribute('aria-current', 'true');
          else b.removeAttribute('aria-current');
          b.tabIndex = isOpen ? 0 : -1;
        });
        const kids = items[i].children || [];
        Array.prototype.forEach.call(sec.querySelectorAll('.bm-reach'), (p, k) => {
          p.style.strokeDashoffset = (kids[k] && kids[k].value === active) ? 0 : length(k);
        });
      });
      placeMarker(true);
    }

    heads.forEach((h, i) => h.addEventListener('click', () => {
      if (open.has(i)) open.delete(i); else open.add(i);
      paint();
    }));

    root.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('.bm-item');
      if (!b) return;
      active = b.dataset.value;
      paint();
    });

    // 容器高度变化（字体加载 / 换行 / 断点切换）后重新对齐标记点
    if ('ResizeObserver' in window) {
      let first = true;
      const ro = new ResizeObserver(() => {
        if (first) { first = false; return; }
        placeMarker(false);
      });
      ro.observe(root);
    }

    paint();
    return {
      get active() { return active; },
      select(value) { active = value; paint(); },
      get open() { return Array.from(open); }
    };
  }

  window.BranchedMenu = { init: init };
})();

/* ===========================================================
   LineSidebar · 原生 JS 邻近感应线性清单
   参考用户提供的 React LineSidebar：左侧横线标记 + 编号 + 文字，
   单个 rAF 循环对每项做帧率无关的指数平滑，颜色 / 位移 / 刻度
   全部读取同一个 --effect，不会出现 CSS transition 错拍。零依赖。

   用于 06「综合能力背书 / 荣誉奖项」，按「荣誉类 / 竞赛类」分别实例化。
   =========================================================== */
(function () {
  'use strict';

  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const FALLOFF = {
    linear: p => p,
    smooth: p => p * p * (3 - 2 * p),
    sharp: p => p * p * p
  };

  function init(root, items, options) {
    if (!root || !items || !items.length) return null;

    // 配色与尺寸全部交给 CSS（含断点覆盖），组件内联不写样式，
    // 否则内联自定义属性会盖掉 @media 里的移动端值。
    const opt = Object.assign({
      showIndex: true,
      proximityRadius: 96,
      falloff: 'smooth',
      smoothing: 100
    }, options || {});

    root.classList.add('ls-root');

    root.innerHTML = `
      <ul class="ls-list">
        ${items.map((it, i) => `
          <li class="ls-item" data-index="${i}">
            <span class="ls-marker" aria-hidden="true"></span>
            <span class="ls-label">
              ${opt.showIndex ? `<span class="ls-index">${String(i + 1).padStart(2, '0')}</span>` : ''}
              <span class="ls-text"><span class="ls-date">${esc(it.date)}</span>${esc(it.text)}</span>
            </span>
          </li>`).join('')}
      </ul>`;

    const list = root.querySelector('.ls-list');
    const els = Array.prototype.slice.call(root.querySelectorAll('.ls-item'));
    const n = els.length;
    const targets = new Array(n).fill(0);
    const current = new Array(n).fill(0);
    const falloff = FALLOFF[opt.falloff] || FALLOFF.smooth;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tau = Math.max(opt.smoothing, 1) / 1000;

    let centers = [];
    let raf = null;
    let last = 0;
    let activeIndex = null;

    function measure() {
      const top = list.getBoundingClientRect().top;
      centers = els.map(el => {
        const r = el.getBoundingClientRect();
        return r.top - top + r.height / 2;
      });
    }

    function frame(now) {
      raf = null;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      const k = reduce ? 1 : 1 - Math.exp(-dt / tau);
      let moving = false;
      for (let i = 0; i < n; i++) {
        const target = Math.max(targets[i], activeIndex === i ? 1 : 0);
        const next = current[i] + (target - current[i]) * k;
        const settled = Math.abs(target - next) < 0.0015;
        const value = settled ? target : next;
        current[i] = value;
        els[i].style.setProperty('--effect', value.toFixed(4));
        if (!settled) moving = true;
      }
      if (moving) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    function wake() {
      if (raf == null) { last = 0; raf = requestAnimationFrame(frame); }
    }

    list.addEventListener('pointermove', e => {
      // 触屏没有悬停语义：只保留点击选中，避免滚动时整列闪烁
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const top = list.getBoundingClientRect().top;
      const py = e.clientY - top;
      for (let i = 0; i < n; i++) {
        const distance = Math.abs(py - centers[i]);
        targets[i] = falloff(Math.max(0, 1 - distance / opt.proximityRadius));
      }
      wake();
    }, { passive: true });

    list.addEventListener('pointerleave', () => {
      targets.fill(0);
      wake();
    }, { passive: true });

    els.forEach((el, i) => el.addEventListener('click', () => {
      activeIndex = activeIndex === i ? null : i;
      els.forEach((other, j) => {
        const on = j === activeIndex;
        other.toggleAttribute('data-active', on);
        if (on) other.setAttribute('aria-current', 'true');
        else other.removeAttribute('aria-current');
      });
      wake();
    }));

    measure();
    wake();
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(measure);
      ro.observe(list);
    }
    window.addEventListener('resize', measure, { passive: true });
    // 字体 / 图片加载完成后行高可能变化，补测一次
    window.addEventListener('load', measure, { once: true });

    return {
      get active() { return activeIndex; },
      remeasure: measure
    };
  }

  window.LineSidebar = { init: init };
})();

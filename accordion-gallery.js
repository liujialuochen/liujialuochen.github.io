/* ===========================================================
   AccordionGallery · 原生 JS 移植
   参考用户给出的 React + gsap 组件，效果等价但零依赖：
   悬停/聚焦展开、3D 倾斜、图像视差位移、灰度转彩色、
   标签错峰淡入、键盘方向键切换、移动端竖向堆叠、减弱动效降级。
   =========================================================== */
(function () {
  'use strict';

  const DEFAULTS = {
    defaultIndex: 2,
    expandRatio: 0.52,
    gap: 10,
    radius: 2,
    duration: 0.62,
    tilt: 7,
    parallax: 0.5,
    trigger: 'hover'
  };

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function init(root, options) {
    if (!root) return null;
    const cfg = Object.assign({}, DEFAULTS, options || {});
    const panels = Array.prototype.slice.call(root.querySelectorAll('.ag-panel'));
    const count = panels.length;
    if (!count) return null;

    const r = clamp(cfg.expandRatio, 0.2, 0.9);
    const grow = count > 1 ? (r * (count - 1)) / (1 - r) : 1;
    let active = clamp(cfg.defaultIndex, 0, count - 1);
    let mediaSize = 320;

    root.style.setProperty('--ag-gap', cfg.gap + 'px');
    root.style.setProperty('--ag-radius', cfg.radius + 'px');
    root.style.setProperty('--ag-dur', (reduceMotion.matches ? 0.01 : cfg.duration) + 's');
    root.classList.add('is-instant');

    function applyLayout(animate) {
      if (!animate || reduceMotion.matches) root.classList.add('is-instant');

      panels.forEach(function (panel, i) {
        const on = i === active;
        const media = panel.querySelector('.ag-panel__media');
        const rot = on ? 0 : (i < active ? cfg.tilt : -cfg.tilt);

        panel.style.flexGrow = on ? grow : 1;
        panel.style.transform = 'rotateY(' + rot + 'deg)';
        panel.classList.toggle('ag-panel--active', on);
        panel.setAttribute('aria-current', on ? 'true' : 'false');

        if (media) {
          // 与参考组件一致：相邻面板按距离做轻微视差漂移，当前面板归零
          const drift = clamp(active - i, -1.5, 1.5);
          const shift = drift * cfg.parallax * mediaSize * 0.06;
          media.style.setProperty('--ag-x', (on ? 0 : shift) + 'px');
        }
      });

      if (!animate || reduceMotion.matches) {
        // 先以无过渡状态定格，下一帧再恢复过渡，避免首屏自己展开一次
        void root.offsetWidth;
        requestAnimationFrame(function () { root.classList.remove('is-instant'); });
      }
    }

    function measure() {
      const rect = root.getBoundingClientRect();
      const usable = Math.max(rect.width - cfg.gap * (count - 1), 120);
      mediaSize = Math.max(140, usable * r * 1.22);
      root.style.setProperty('--ag-media-size', mediaSize + 'px');
      applyLayout(false);
    }

    function setActive(i, focus) {
      active = clamp(i, 0, count - 1);
      applyLayout(true);
      if (focus) panels[active].focus({ preventScroll: true });
    }

    panels.forEach(function (panel, i) {
      if (cfg.trigger === 'hover') {
        panel.addEventListener('mouseenter', function () { if (i !== active) setActive(i); });
      }
      panel.addEventListener('focus', function () { if (i !== active) setActive(i); });
      panel.addEventListener('click', function () { if (i !== active) setActive(i); });
      panel.addEventListener('keydown', function (e) {
        let next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % count;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + count) % count;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = count - 1;
        if (next === null) return;
        e.preventDefault();
        setActive(next, true);
      });
    });

    measure();
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(function () { measure(); });
      ro.observe(root);
    } else {
      window.addEventListener('resize', measure);
    }

    return { setActive: setActive, get active() { return active; } };
  }

  window.AccordionGallery = { init: init };
})();

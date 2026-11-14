/* ===========================================================
   WaveText · 逐字放大镜 + 整行水波纹
   - 鼠标滑到哪个字，哪个字按高斯权重变大（放大镜）
   - 两侧的字按环形权重向外让位，避免放大后互相压糊
   - 距指针不同距离的字带不同正弦相位，上下起伏并随时间向外推进
   - 只在 (hover:hover) and (pointer:fine) 且未开启 reduced-motion 时启用
   - 触屏 / 降级：保持原始静态文字，不做拆字
   用法：给任意文字行加 data-wave；可选 data-wave-scale / data-wave-amp / data-wave-reach
   =========================================================== */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  if (reduceMotion || !finePointer || !('requestAnimationFrame' in window)) return;

  const lines = [];
  let raf = 0;
  let last = 0;

  const num = (v, fallback) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };

  class WaveLine {
    constructor(el) {
      this.el = el;
      const text = el.textContent;
      this.maxScale = num(el.dataset.waveScale, 1.26);
      this.amp = num(el.dataset.waveAmp, 9);
      this.reach = num(el.dataset.waveReach, 0);
      this.stiff = 0.16;
      this.px = -100000;
      this.active = false;

      const frag = document.createDocumentFragment();
      this.chars = Array.from(text).map((ch) => {
        const span = document.createElement('span');
        span.className = 'wch';
        span.textContent = ch === ' ' ? '\u00a0' : ch;
        span.setAttribute('aria-hidden', 'true');
        frag.appendChild(span);
        return { node: span, cx: 0, scale: 1, x: 0, y: 0 };
      });

      el.textContent = '';
      el.setAttribute('aria-label', text.trim());
      el.classList.add('is-waved');
      el.appendChild(frag);

      this.measure();

      const onMove = (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        this.px = e.clientX;
        this.active = true;
        wake();
      };
      el.addEventListener('pointermove', onMove, { passive: true });
      el.addEventListener('pointerenter', onMove, { passive: true });
      el.addEventListener('pointerleave', () => {
        this.px = -100000;
        this.active = false;
        wake();
      }, { passive: true });

      if ('ResizeObserver' in window) {
        this.ro = new ResizeObserver(() => this.measure());
        this.ro.observe(el);
      } else {
        window.addEventListener('resize', () => this.measure(), { passive: true });
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => this.measure(), () => {});
      }
    }

    measure() {
      let left = Infinity;
      let right = -Infinity;
      for (const c of this.chars) {
        const r = c.node.getBoundingClientRect();
        c.cx = r.left + r.width / 2;
        if (r.left < left) left = r.left;
        if (r.right > right) right = r.right;
      }
      const size = parseFloat(getComputedStyle(this.el).fontSize) || 24;
      const total = Math.max(1, right - left);
      // 影响半径收紧：只有靠近指针的一两个字显著放大，其余字负责波浪
      this.radius = this.reach || Math.min(size * 1.9, total * 0.4);
      this.waveLen = Math.max(48, size * 2.6);
      this.push = size * 0.7;
    }

    step(t) {
      const moving = this.active && this.px > -90000;
      let alive = false;

      for (const c of this.chars) {
        let targetScale = 1;
        let targetX = 0;
        let targetY = 0;

        if (moving) {
          const d = Math.abs(this.px - c.cx);
          const u = d / this.radius;
          const influence = Math.exp(-u * u);
          targetScale = 1 + (this.maxScale - 1) * influence;
          // 距离 → 相位差；时间项让波纹持续向外扩散
          const wave = Math.sin((d / this.waveLen) * Math.PI * 2 - t * 0.0042);
          targetY = -this.amp * influence * wave;
          // 环形让位：焦点字不动，两侧的字向外推开，放大时不会互相压糊
          const ring = u * Math.exp(-u * u);
          targetX = (c.cx >= this.px ? 1 : -1) * this.push * ring;
        }

        c.scale += (targetScale - c.scale) * this.stiff;
        c.x += (targetX - c.x) * this.stiff;
        c.y += (targetY - c.y) * this.stiff;

        if (Math.abs(c.scale - 1) > 0.002 || Math.abs(c.x) > 0.05 ||
            Math.abs(c.y) > 0.05 || moving) {
          alive = true;
        }
        if (c.scale < 1.004 && Math.abs(c.x) < 0.05 && Math.abs(c.y) < 0.05) {
          c.node.style.transform = '';
          c.node.style.zIndex = '';
        } else {
          c.node.style.transform =
            `translate3d(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px, 0) scale(${c.scale.toFixed(3)})`;
          c.node.style.zIndex = c.scale > 1.03 ? '2' : '';
        }
      }
      return alive;
    }
  }

  function tick(t) {
    raf = 0;
    const dt = Math.min(48, t - (last || t));
    last = t;
    const stiff = 1 - Math.exp(-dt / 85);
    let alive = false;
    for (const line of lines) {
      line.stiff = stiff;
      if (line.step(t)) alive = true;
    }
    if (alive) raf = requestAnimationFrame(tick);
    else last = 0;
  }

  function wake() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  document.querySelectorAll('[data-wave]').forEach((el) => lines.push(new WaveLine(el)));
  window.WaveText = { lines };
})();

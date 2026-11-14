/* ===========================================================
   JellyChips · JellyRadio（ReactBits 规格）的零依赖原生移植
   -----------------------------------------------------------
   站点不使用 React / motion，这里用原生弹簧积分等价实现：
   · 一组 chip 只有一个选中态：选中膨胀、其余轻微收缩
   · 选中项把左右邻片「顶开」，距离越远延迟越大（交错 stagger）
   · x / scaleX / scaleY 三路弹簧参数不同，形成果冻回弹
   · 悬停高光、点击/方向键切换、focus-visible 由 CSS 负责
   · prefers-reduced-motion 直接取终态，不做动画
   · 只在仍有残余运动时占用 rAF，静止后自动停帧
   =========================================================== */
(function () {
  'use strict';

  var CFG = {
    /* 标签恒定一横排：把膨胀与推开幅度收敛一点，避免最右侧标签被卡片裁切 */
    swell: 0.15,       // 选中项膨胀比例
    barge: 3,          // 额外推开距离
    shrink: 0.04,      // 未选中项收缩比例
    jelly: 1,          // 果冻感（scaleX / scaleY 的弹簧差异）
    bounce: 0.25,      // 回弹
    stagger: 22,       // 每远一档的延迟 ms
    stiffness: 580     // 基础刚度
  };

  function damping(k, m, bounce) {
    return 2 * Math.sqrt(k * m) * (1 - bounce);
  }

  function initGroup(group) {
    var chips = Array.prototype.slice.call(
      group.querySelectorAll('.jelly-radio__chip')
    );
    if (!chips.length) return;

    var reduce = !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var rtl = getComputedStyle(group).direction === 'rtl';
    var widths = [];
    var active = Math.max(0, chips.findIndex(function (c) {
      return c.getAttribute('data-on') === 'true';
    }));
    if (active < 0) active = 0;

    /* 每片一条状态：当前值 / 目标值 / 速度 / 弹簧参数 / 起始时间 */
    var S = chips.map(function () {
      return {
        x: 0, sx: 1, sy: 1, vx: 0, vsx: 0, vsy: 0,
        tx: 0, tsx: 1, tsy: 1,
        kx: CFG.stiffness, cx: damping(CFG.stiffness, 0.9, CFG.bounce),
        ksx: CFG.stiffness, csx: damping(CFG.stiffness, 0.9, CFG.bounce),
        ksy: CFG.stiffness, csy: damping(CFG.stiffness, 0.9, CFG.bounce),
        startAt: 0, moving: false
      };
    });

    var raf = 0, last = 0;

    function measure() {
      widths = chips.map(function (c) { return c.offsetWidth || 0; });
      var maxW = Math.max.apply(null, widths.concat([0]));
      var chipH = chips[0] ? (chips[0].offsetHeight || 28) : 28;
      var barge = Math.min(CFG.barge, Math.max(2, group.clientWidth * 0.018));
      group.style.setProperty('--jr-pad-x',
        (Math.ceil((maxW * CFG.swell * 1.3) / 2 + barge) + 2) + 'px');
      group.style.setProperty('--jr-pad-y',
        (Math.ceil((chipH * CFG.swell) / 2) + 2) + 'px');
      return barge;
    }

    function isMoving(s) {
      return Math.abs(s.tx - s.x) > 0.06 || Math.abs(s.vx) > 0.6 ||
        Math.abs(s.tsx - s.sx) > 0.0006 || Math.abs(s.vsx) > 0.006 ||
        Math.abs(s.tsy - s.sy) > 0.0006 || Math.abs(s.vsy) > 0.006;
    }

    function render(s, chip) {
      chip.style.transform = 'translateX(' + s.x.toFixed(2) + 'px) scale(' +
        s.sx.toFixed(4) + ',' + s.sy.toFixed(4) + ')';
    }

    function apply(sel, instant) {
      var barge = measure();
      var push = ((widths[sel] || 0) * CFG.swell) / 2 + barge;
      var now = performance.now();

      chips.forEach(function (chip, i) {
        var s = S[i];
        var on = i === sel;
        var far = Math.abs(i - sel);
        var dir = Math.sign(i - sel) * (rtl ? -1 : 1);

        chip.setAttribute('data-on', on ? 'true' : 'false');
        chip.setAttribute('aria-checked', on ? 'true' : 'false');
        chip.tabIndex = on ? 0 : -1;

        s.tx = dir * push;
        s.tsx = on ? 1 + CFG.swell : 1 - CFG.shrink;
        s.tsy = s.tsx;

        var k = CFG.stiffness * (1 - 0.12 * Math.min(far, 3));
        var j = CFG.jelly;
        s.kx = k;
        s.cx = damping(k, 0.9, CFG.bounce);
        s.ksx = k * (1 + 0.24 * j);
        s.csx = damping(s.ksx, 0.9 - 0.1 * j, Math.min(0.85, CFG.bounce + 0.3 * j));
        s.ksy = k * (1 - 0.14 * j);
        s.csy = damping(s.ksy, 0.9 + 0.05 * j, CFG.bounce);

        var inFlight = isMoving(s);
        s.startAt = now + (instant || reduce ? 0 : (inFlight ? 0 : far * CFG.stagger));
        s.moving = true;

        if (instant || reduce) {
          s.x = s.tx; s.sx = s.tsx; s.sy = s.tsy;
          s.vx = s.vsx = s.vsy = 0;
          s.moving = false;
          render(s, chip);
        }
      });
      if (!instant && !reduce) wake();
    }

    function step(value, velocity, target, k, c, dt) {
      var a = k * (target - value) - c * velocity;
      velocity += a * dt;
      value += velocity * dt;
      return [value, velocity];
    }

    function frame(now) {
      raf = 0;
      if (!last) last = now;
      var dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
      last = now;
      var settling = false;

      chips.forEach(function (chip, i) {
        var s = S[i];
        if (!s.moving) return;
        if (now < s.startAt) { settling = true; return; }

        var rx = step(s.x, s.vx, s.tx, s.kx, s.cx, dt);
        var rsx = step(s.sx, s.vsx, s.tsx, s.ksx, s.csx, dt);
        var rsy = step(s.sy, s.vsy, s.tsy, s.ksy, s.csy, dt);
        s.x = rx[0]; s.vx = rx[1];
        s.sx = rsx[0]; s.vsx = rsx[1];
        s.sy = rsy[0]; s.vsy = rsy[1];

        if (!isMoving(s)) {
          s.x = s.tx; s.sx = s.tsx; s.sy = s.tsy;
          s.vx = s.vsx = s.vsy = 0;
          s.moving = false;
        } else {
          settling = true;
        }
        render(s, chip);
      });

      if (settling) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    function wake() {
      if (!raf) raf = requestAnimationFrame(frame);
    }

    function commit(i) {
      if (i < 0 || i >= chips.length || i === active) {
        /* 重复点同一项也给一次轻微脉冲感：重放当前目标 */
        if (i === active) apply(active, false);
        return;
      }
      active = i;
      apply(active, false);
    }

    chips.forEach(function (chip, i) {
      chip.addEventListener('click', function (e) {
        /* e.detail === 0 表示键盘触发，直接落位不做弹性 */
        commit(i);
        if (e.detail === 0) apply(active, true);
      });
      chip.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % chips.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + chips.length) % chips.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = chips.length - 1;
        else if (e.key === ' ' || e.key === 'Enter') next = i;
        if (next === null) return;
        e.preventDefault();
        if (next === active) { apply(active, false); chips[next].focus(); return; }
        active = next;
        apply(active, true);
        chips[next].focus();
      });
    });

    apply(active, true);

    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () { apply(active, true); });
      ro.observe(group);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { apply(active, true); });
    }
  }

  function init() {
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-jelly]'), initGroup
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.JellyChips = { init: init };
})();

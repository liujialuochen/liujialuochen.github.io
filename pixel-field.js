/* ===========================================================
   PixelField · PixelCard（ReactBits 规格）的零依赖原生移植
   -----------------------------------------------------------
   站点不使用 React，这里把提供的 PixelCard 组件等价实现为 canvas：
   · 点阵按 gap 网格铺满容器，每点带随机色阶 / 相位 / 抖动
   · 进入视口时自动显影一次（intro），随后淡出
   · 悬停从中心（或指针）扩散显影，伴随跟随指针的聚光灯与径向辉光
   · 点击产生向外扩散的脉冲波；离场 / 离开时反向淡出
   · 只在「可见且仍在运动」时占用 requestAnimationFrame，静止后自动停帧
   · prefers-reduced-motion 直接取终态，不做动画
   配色按本作品集的暖米白 × 藏蓝重新调过（blue 变体的低对比版本），
   分为卡片浅底 / 卡片深底 / 板块环境层三档。
   =========================================================== */
(function () {
  'use strict';

  var APPEAR = 0.26;
  var EXIT = 0.22;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smoothstep = function (e0, e1, v) {
    var t = clamp((v - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  var easeOutBack = function (t) {
    var c = 1.9, u = t - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
  };

  var PRESETS = {
    cardLight: {
      colors: ['#e0f2fe', '#8fd3f7', '#1e3a8a'], glow: '#38bdf8',
      gap: 9, speed: 22, pixelSize: 2, opacity: .38, spotlight: .5,
      glowStrength: .32, revealDuration: 640, fade: .35
    },
    cardDark: {
      colors: ['#e0f2fe', '#7dd3fc', '#38bdf8'], glow: '#38bdf8',
      gap: 9, speed: 28, pixelSize: 2, opacity: .52, spotlight: .55,
      glowStrength: .42, revealDuration: 640, fade: .3
    },
    cardSky: {
      colors: ['#ffffff', '#e0f2fe', '#1e3a8a'], glow: '#e0f2fe',
      gap: 9, speed: 22, pixelSize: 2, opacity: .36, spotlight: .48,
      glowStrength: .28, revealDuration: 640, fade: .35
    },
    ambient: {
      colors: ['#dbe7fa', '#b9cdea', '#8ea9d2'], glow: '#185FA5',
      gap: 16, speed: 10, pixelSize: 1.6, opacity: .3, spotlight: .24,
      glowStrength: .14, revealDuration: 1100, fade: .85
    }
  };

  var toRgb = (function () {
    var ctx = null;
    return function (color) {
      if (!ctx) {
        var c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        ctx = c.getContext('2d', { willReadFrequently: true });
      }
      if (!ctx) return [24, 95, 165];
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#fff';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      var d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
  })();

  var engines = new WeakMap();

  function initNode(el) {
    var canvas = el.querySelector('canvas.aiw-px');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'aiw-px';
      canvas.setAttribute('aria-hidden', 'true');
      el.insertBefore(canvas, el.firstChild);
    }
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var isAmbient = el.getAttribute('data-pixel') === 'ambient';
    var tone = el.getAttribute('data-pixel-tone');
    var cfg = isAmbient ? PRESETS.ambient
      : (tone === 'dark' ? PRESETS.cardDark
        : tone === 'sky' ? PRESETS.cardSky : PRESETS.cardLight);
    var glowRgb = toRgb(cfg.glow);
    /* 环境层自身 pointer-events:none，事件改挂在整个板块上 */
    var eventsTarget = isAmbient ? (el.closest('.aiw-sec') || el) : el;
    var reduce = !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var s = {
      alive: true, raf: 0, last: 0, time: 0, dt: 1 / 60, visible: true,
      width: 0, height: 0, ratio: 1, key: '', count: 0,
      x: new Float32Array(0), y: new Float32Array(0), tint: new Uint8Array(0),
      size: new Float32Array(0), phase: new Float32Array(0), rate: new Float32Array(0),
      jitter: new Float32Array(0), presence: new Float32Array(0),
      delay: new Float32Array(0), mask: new Float32Array(0), maskKey: '',
      active: false, changedAt: 0, originX: 0, originY: 0, maxDistance: 1,
      pointerX: 0, pointerY: 0, spotX: 0, spotY: 0, spotVX: 0, spotVY: 0,
      spotPower: 0, hovering: false, pulses: [], introAt: -1, introStarted: false
    };

    function build() {
      var rect = el.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(rect.height));
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      var key = [w, h, ratio, cfg.gap, cfg.pixelSize].join('|');
      if (key === s.key) return;
      s.key = key; s.width = w; s.height = h; s.ratio = ratio;
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      var cols = Math.floor((w - 1) / cfg.gap) + 1;
      var rows = Math.floor((h - 1) / cfg.gap) + 1;
      var offX = (w - (cols - 1) * cfg.gap) / 2;
      var offY = (h - (rows - 1) * cfg.gap) / 2;
      var count = cols * rows, prev = s.presence, i = 0;
      s.count = count;
      s.x = new Float32Array(count); s.y = new Float32Array(count);
      s.tint = new Uint8Array(count); s.size = new Float32Array(count);
      s.phase = new Float32Array(count); s.rate = new Float32Array(count);
      s.jitter = new Float32Array(count); s.presence = new Float32Array(count);
      s.delay = new Float32Array(count);
      for (var col = 0; col < cols; col++) {
        for (var row = 0; row < rows; row++) {
          s.x[i] = offX + col * cfg.gap;
          s.y[i] = offY + row * cfg.gap;
          s.tint[i] = Math.floor(Math.random() * cfg.colors.length);
          s.size[i] = cfg.pixelSize * (0.25 + Math.random() * 0.75);
          s.phase[i] = Math.random() * Math.PI * 2;
          s.rate[i] = 0.55 + Math.random() * 0.9;
          s.jitter[i] = Math.random();
          if (prev.length) s.presence[i] = prev[Math.min(i, prev.length - 1)];
          i++;
        }
      }
      schedule();
    }

    function schedule() {
      var span = cfg.revealDuration / 1000, far = 1, i;
      for (i = 0; i < s.count; i++) {
        far = Math.max(far, Math.hypot(s.x[i] - s.originX, s.y[i] - s.originY));
      }
      s.maxDistance = far;
      for (i = 0; i < s.count; i++) {
        var d = Math.hypot(s.x[i] - s.originX, s.y[i] - s.originY) / far;
        s.delay[i] = s.active
          ? d * span * 0.82 + s.jitter[i] * span * 0.18
          : (1 - d) * span * 0.45 + s.jitter[i] * span * 0.1;
      }
    }

    function setActive(value, x, y) {
      if (s.active === value) return;
      s.active = value;
      s.changedAt = s.time;
      if (value) {
        var usePointer = x !== undefined && y !== undefined && cfg.spotlight > 0;
        s.originX = usePointer ? x : s.width / 2;
        s.originY = usePointer ? y : s.height / 2;
      }
      schedule();
      wake();
    }

    function draw() {
      ctx.setTransform(s.ratio, 0, 0, s.ratio, 0, 0);
      ctx.clearRect(0, 0, s.width, s.height);

      var maskKey = s.count + '|' + s.width + '|' + s.height + '|' + cfg.fade;
      if (s.maskKey !== maskKey) {
        s.maskKey = maskKey;
        s.mask = new Float32Array(s.count);
        var near = Math.min(s.width, s.height) * 0.05;
        var far = Math.min(s.width, s.height) * 0.42;
        for (var i = 0; i < s.count; i++) {
          var edge = Math.min(s.x[i], s.width - s.x[i], s.y[i], s.height - s.y[i]);
          var t = clamp((edge - near) / (far - near), 0, 1);
          s.mask[i] = 1 - cfg.fade * t * t * t * (t * (t * 6 - 15) + 10);
        }
      }

      var presenceSum = 0, elapsed = s.time - s.changedAt;
      var appearStep = s.dt / APPEAR, exitStep = s.dt / EXIT;
      for (var j = 0; j < s.count; j++) {
        var current = s.presence[j];
        var ready = elapsed >= s.delay[j] || reduce;
        var target = s.active ? (ready ? 1 : 0) : (ready ? 0 : current);
        if (reduce) s.presence[j] = target;
        else if (target > current) s.presence[j] = Math.min(1, current + appearStep);
        else if (target < current) s.presence[j] = Math.max(0, current - exitStep);
        presenceSum += s.presence[j];
      }
      var avg = s.count ? presenceSum / s.count : 0;

      if (cfg.glowStrength > 0 && avg > 0.001) {
        var gr = s.spotPower > 0.01 ? s.spotX : s.originX;
        var gy = s.spotPower > 0.01 ? s.spotY : s.originY;
        var reach = Math.max(s.width, s.height) * 0.85;
        var grad = ctx.createRadialGradient(gr, gy, 0, gr, gy, reach);
        var strength = cfg.glowStrength * cfg.opacity * 0.32 * Math.min(1, avg * 1.4);
        grad.addColorStop(0, 'rgba(' + glowRgb[0] + ',' + glowRgb[1] + ',' + glowRgb[2] + ',' + strength + ')');
        grad.addColorStop(.45, 'rgba(' + glowRgb[0] + ',' + glowRgb[1] + ',' + glowRgb[2] + ',' + strength * .35 + ')');
        grad.addColorStop(1, 'rgba(' + glowRgb[0] + ',' + glowRgb[1] + ',' + glowRgb[2] + ',0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, s.width, s.height);
      }

      var spotRadius = Math.min(s.width, s.height) * 0.38 + 30;
      var spotStrength = cfg.spotlight * s.spotPower;
      var twinkle = reduce ? 0 : (smoothstep(0, 100, cfg.speed) > 0 ? 1 : 0);
      var frequency = (cfg.speed / 35) * 1.35;

      for (var color = 0; color < cfg.colors.length; color++) {
        ctx.fillStyle = cfg.colors[color];
        for (var k = 0; k < s.count; k++) {
          if (s.tint[k] !== color) continue;
          var presence = s.presence[k];
          if (presence <= 0.002) continue;
          var px = s.x[k], py = s.y[k];
          var size = s.size[k];
          var alpha = 0.5 + presence * 0.38;
          if (twinkle) {
            var wave = Math.sin(s.phase[k] + s.time * frequency * s.rate[k]);
            size *= 0.62 + 0.38 * wave;
            alpha += 0.12 * wave + (s.jitter[k] > 0.92 ? 0.35 * Math.max(0, wave) : 0);
          }
          size *= easeOutBack(presence);
          var flash = presence < 1 && s.active ? Math.sin(presence * Math.PI) : 0;
          size *= 1 + flash * 0.9;
          alpha += flash * 0.6;
          if (spotStrength > 0.001) {
            var nearSpot = smoothstep(spotRadius, 0, Math.hypot(px - s.spotX, py - s.spotY));
            size *= 1 + spotStrength * nearSpot * nearSpot * 2.4;
            alpha += spotStrength * nearSpot * 0.45;
          }
          alpha = Math.min(1, alpha) * s.mask[k] * cfg.opacity;
          if (alpha <= 0.004) continue;
          for (var p = 0; p < s.pulses.length; p++) {
            var pulse = s.pulses[p];
            var band = (Math.hypot(px - pulse.x, py - pulse.y) - pulse.radius) / 26;
            var ripple = Math.exp(-band * band) * pulse.power;
            size *= 1 + ripple * 1.4;
            alpha = Math.min(1, alpha + ripple * 0.5);
          }
          if (size <= 0.05) continue;
          ctx.globalAlpha = alpha;
          ctx.fillRect(px - size * 0.5, py - size * 0.5, size, size);
        }
      }
      ctx.globalAlpha = 1;
      return presenceSum;
    }

    function frame(now) {
      s.raf = 0;
      if (!s.alive) return;
      var dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 1 / 60;
      s.last = now; s.dt = dt; s.time += dt;
      build();

      if (s.introAt >= 0 && s.time >= s.introAt) {
        s.introAt = -1;
        if (!s.active) setActive(true);
        s.pendingRelease = s.time + cfg.revealDuration / 1000 + 0.7;
      }
      if (s.pendingRelease >= 0 && s.time >= s.pendingRelease && (!s.hovering || isAmbient)) {
        s.pendingRelease = -1;
        if (isAmbient) s.hovering = false;
        setActive(false);
      }

      var want = s.hovering && !reduce ? 1 : 0;
      s.spotPower += (want - s.spotPower) * (1 - Math.exp(-(want ? 6 : 3) * dt));
      var stiff = 120, damp = 2 * Math.sqrt(stiff) * 0.9;
      s.spotVX += (stiff * (s.pointerX - s.spotX) - damp * s.spotVX) * dt;
      s.spotVY += (stiff * (s.pointerY - s.spotY) - damp * s.spotVY) * dt;
      s.spotX += s.spotVX * dt;
      s.spotY += s.spotVY * dt;

      var pulseSpeed = s.maxDistance / Math.max(0.35, (cfg.revealDuration / 1000) * 0.9);
      s.pulses = s.pulses.filter(function (pulse) {
        pulse.radius += pulseSpeed * dt;
        pulse.power = Math.max(0, 1 - pulse.radius / (s.maxDistance + 40));
        return pulse.power > 0;
      });

      var presence = draw();
      var settling = s.active || s.introAt >= 0 || presence > 0 || s.pulses.length > 0 ||
        s.spotPower > 0.002 || Math.abs(s.spotVX) + Math.abs(s.spotVY) > 0.5;
      if (settling && s.visible) s.raf = requestAnimationFrame(frame);
      else s.last = 0;
    }

    function wake() {
      if (!s.raf && s.alive && s.visible) s.raf = requestAnimationFrame(frame);
    }

    function local(ev) {
      var r = el.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    }
    function onEnter(ev) {
      var xy = local(ev);
      s.hovering = ev.pointerType !== 'touch';
      s.pointerX = xy[0]; s.pointerY = xy[1];
      if (s.spotPower < 0.01) {
        s.spotX = xy[0]; s.spotY = xy[1]; s.spotVX = 0; s.spotVY = 0;
      }
      s.introAt = -1; s.pendingRelease = -1;
      setActive(true, xy[0], xy[1]);
      wake();
    }
    function onMove(ev) {
      var xy = local(ev);
      s.pointerX = xy[0]; s.pointerY = xy[1];
      wake();
    }
    function onLeave() {
      s.hovering = false;
      setActive(false);
      wake();
    }
    function onDown(ev) {
      var xy = local(ev);
      if (!s.active) setActive(true, xy[0], xy[1]);
      /* 环境层不做长驻悬停显影：点击只给 2 秒左右的涟漪，随后自动退场，
         避免整段阅读期间一直占着 requestAnimationFrame。 */
      if (isAmbient) s.pendingRelease = s.time + 2;
      if (!reduce) s.pulses.push({ x: xy[0], y: xy[1], radius: 0, power: 1 });
      wake();
    }

    if (!isAmbient) {
      eventsTarget.addEventListener('pointerenter', onEnter);
      eventsTarget.addEventListener('pointermove', onMove);
      eventsTarget.addEventListener('pointerleave', onLeave);
    }
    eventsTarget.addEventListener('pointerdown', onDown);

    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () { build(); wake(); });
      ro.observe(el);
    } else {
      window.addEventListener('resize', function () { build(); wake(); });
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        s.visible = entries.some(function (e) { return e.isIntersecting; });
        if (s.visible && !s.introStarted && !reduce) {
          s.introStarted = true;
          build();
          s.introAt = s.time + (isAmbient ? 0.15 : 0.35);
        }
        if (s.visible) wake();
      }, { threshold: .05 });
      io.observe(el);
    } else {
      s.introStarted = true;
      s.introAt = 0.2;
    }

    build();
    s.pointerX = s.width / 2; s.pointerY = s.height / 2;
    s.spotX = s.pointerX; s.spotY = s.pointerY;
    s.originX = s.width / 2; s.originY = s.height / 2;
    s.pendingRelease = -1;
    wake();

    engines.set(el, {
      pulse: function (x, y) {
        if (reduce) return;
        var px = x === undefined ? s.width / 2 : x;
        var py = y === undefined ? s.height / 2 : y;
        if (!s.active) setActive(true, px, py);
        s.pulses.push({ x: px, y: py, radius: 0, power: 1 });
        wake();
      }
    });
  }

  function init() {
    var nodes = document.querySelectorAll('[data-pixel]');
    Array.prototype.forEach.call(nodes, initNode);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.PixelField = {
    init: init,
    pulse: function (el, x, y) {
      var engine = el && engines.get(el);
      if (engine) engine.pulse(x, y);
    }
  };
})();

/* ===========================================================
   CardSwap · PPT 设计卡片堆（原生移植 React CardSwap）
   层叠透视 / 弹性轮转 / 拖拽抛出 / 点击置顶 / 键盘 / 自动播放
   风格：Odyssee —— 暖米白卡面、藏蓝细线、零圆角
   =========================================================== */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var STEP = 1 / 240;
  var PAD = 32;
  var PERSPECTIVE = 900;
  var AXES = ['x', 'y', 'z', 'r', 'p'];
  var DOWN = { x: 0, y: 1 };

  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var pad2 = function (n) { return String(n).padStart(2, '0'); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function stackBounds(o) {
    var slope = Math.tan((o.skew * Math.PI) / 180);
    var spread = 1 + Math.max(0, o.hoverSpread);
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < o.visible; i++) {
      var scale = PERSPECTIVE / (PERSPECTIVE + i * o.dz);
      for (var a = 0; a < 2; a++) {
        for (var b = 0; b < 2; b++) {
          var u = a ? o.w / 2 : -o.w / 2;
          var v = b ? o.h / 2 : -o.h / 2;
          var x = (i * o.dx * spread + u) * scale;
          var y = (-i * o.dy * spread + v + u * slope) * scale;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    return {
      w: Math.ceil(maxX - minX + PAD * 2),
      h: Math.ceil(maxY - minY + PAD * 2),
      ox: PAD - minX,
      oy: PAD - minY
    };
  }

  function init(root, items, options) {
    if (!root || !items || !items.length) return null;
    var opt = Object.assign({
      width: 520, height: 322, cardDistance: 60, verticalDistance: 66,
      depth: 90, skew: 5, visibleCards: 4, delay: 4200, autoplay: true,
      pauseOnHover: true, draggable: true, speed: 1, bounce: .32,
      parallax: .42, hoverSpread: .1, dim: .34, intro: true
    }, options || {});

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var count = items.length;
    var rootW = root.clientWidth || 720;
    /* 卡片尺寸随容器收缩，保证手机端一屏能放下整叠 */
    var cw = clamp(rootW * .68, 232, opt.width);
    var ch = cw * (opt.height / opt.width);
    var s = {
      w: cw, h: ch,
      dx: opt.cardDistance * (cw / opt.width),
      dy: opt.verticalDistance * (cw / opt.width),
      dz: opt.depth * (cw / opt.width),
      skew: opt.skew,
      visible: clamp(Math.round(opt.visibleCards), 1, count),
      delay: opt.delay, autoplay: opt.autoplay && !reduce,
      pauseOnHover: opt.pauseOnHover, draggable: opt.draggable,
      speed: clamp(opt.speed, .1, 4), bounce: clamp(opt.bounce, 0, 1),
      parallax: clamp(opt.parallax, 0, 1), hoverSpread: Math.max(0, opt.hoverSpread),
      dim: clamp(opt.dim, 0, 1)
    };
    s.bounds = stackBounds(s);

    root.classList.add('cs-root');
    root.setAttribute('tabindex', '0');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'carousel');
    root.setAttribute('aria-label', 'PPT 设计作品卡片堆，可拖拽或点击切换');
    root.innerHTML =
      '<div class="cs-stage">' +
        items.map(function (it, i) {
          return '<div class="cs-slot" data-cs-index="' + i + '">' +
            '<div class="cs-card">' +
              '<div class="cs-head">' +
                '<span class="cs-no eyebrow">SLIDE ' + pad2(i + 1) + ' / ' + pad2(count) + '</span>' +
                '<span class="cs-title serif">' + esc(it.title || ('提案设计 ' + pad2(i + 1))) + '</span>' +
              '</div>' +
              '<div class="cs-media"><img src="' + esc(it.src) + '" alt="' + esc(it.alt || it.title || '') + '" ' +
                'loading="' + (i < 4 ? 'eager' : 'lazy') + '" draggable="false" decoding="async"></div>' +
            '</div><span class="cs-shade" aria-hidden="true"></span></div>';
        }).join('') +
      '</div>' +
      '<div class="cs-ui">' +
        '<button class="cs-arrow" type="button" data-cs-prev aria-label="上一张">← <span>PREV</span></button>' +
        '<button class="cs-arrow" type="button" data-cs-next aria-label="下一张"><span>NEXT</span> →</button>' +
        '<span class="cs-count eyebrow" aria-live="polite">01 / ' + pad2(count) + '</span>' +
        '<span class="cs-hint eyebrow">拖拽 / 点击卡片 / 方向键浏览</span>' +
      '</div>';

    var stage = root.querySelector('.cs-stage');
    var slots = Array.prototype.slice.call(root.querySelectorAll('.cs-slot'));
    var shades = Array.prototype.slice.call(root.querySelectorAll('.cs-shade'));
    var countEl = root.querySelector('.cs-count');
    var prevBtn = root.querySelector('[data-cs-prev]');
    var nextBtn = root.querySelector('[data-cs-next]');

    stage.style.width = s.bounds.w + 'px';
    stage.style.height = s.bounds.h + 'px';
    stage.style.perspective = PERSPECTIVE + 'px';
    root.style.setProperty('--cs-w', cw + 'px');
    root.style.setProperty('--cs-h', ch + 'px');
    root.style.setProperty('--cs-ox', s.bounds.ox + 'px');
    root.style.setProperty('--cs-oy', s.bounds.oy + 'px');

    var deck = items.map(function (_, index) {
      return {
        el: slots[index], shade: shades[index], index: index,
        pos: index, from: index, hold: 0, nudge: 0, phase: 'rest',
        dir: { x: 0, y: 1 }, tilt: 0, top: 0, under: false,
        x: 0, y: 0, z: 0, r: 0, p: 0,
        v: { x: 0, y: 0, z: 0, r: 0, p: 0 }
      };
    });
    var state = {
      order: deck.map(function (c) { return c.index; }),
      raf: 0, last: 0, timer: 0, queue: [], layers: 0, scale: 1,
      hovered: false, overCard: false, inView: true, drag: null,
      spread: 0, spreadV: 0, px: 0, py: 0, pvx: 0, pvy: 0,
      tx: 0, ty: 0, dragged: false, autoplay: s.autoplay, delay: s.delay
    };

    function slot(position) {
      var q = Math.min(position, s.visible);
      var spread = 1 + state.spread;
      return { x: q * s.dx * spread, y: -q * s.dy * spread, z: -q * s.dz, r: 0, p: q };
    }
    function clearance(dir) {
      return Math.abs(dir.x) * s.w + Math.abs(dir.y) * s.h + 12;
    }
    function targetOf(card, time) {
      if (card.phase === 'exit') {
        var base = slot(0), reach = clearance(card.dir) * 1.3;
        return { x: base.x + card.dir.x * reach, y: base.y + card.dir.y * reach, z: base.z, r: card.tilt, p: 0 };
      }
      if (card.phase === 'enter') {
        var b = slot(0);
        return { x: b.x, y: b.y + clearance(DOWN) * 1.3, z: b.z, r: 0, p: card.p };
      }
      var position = (time < card.hold ? card.from : card.pos) + card.nudge;
      return slot(Math.max(0, position));
    }
    function layerOf(card) {
      if (card.top) return 1000 + card.top;
      if (card.under) return 1;
      return 10 + (count - card.pos) * 2;
    }
    function write(card) {
      var el = card.el, shade = card.shade;
      if (!el) return;
      el.style.transform = 'translate3d(' + card.x.toFixed(2) + 'px,' + card.y.toFixed(2) + 'px,' +
        card.z.toFixed(2) + 'px) rotate(' + card.r.toFixed(3) + 'deg) skewY(' + s.skew + 'deg)';
      el.style.zIndex = String(layerOf(card));
      var fade = clamp(s.visible - card.p, 0, 1);
      el.style.opacity = fade < 1 ? fade.toFixed(3) : '';
      el.style.visibility = fade <= .001 ? 'hidden' : '';
      if (shade) {
        var depthT = clamp(card.p / Math.max(1, s.visible - 1), 0, 1);
        shade.style.opacity = (s.dim * .62 * depthT).toFixed(3);
      }
      el.style.cursor = card.phase === 'drag' ? 'grabbing' : card.pos > 0 ? 'pointer' : s.draggable ? 'grab' : '';
      if (card.pos === 0) el.setAttribute('data-front', '');
      else el.removeAttribute('data-front');
    }
    function writeStage() {
      stage.style.perspectiveOrigin = (s.bounds.ox + state.px).toFixed(2) + 'px ' +
        (s.bounds.oy + state.py).toFixed(2) + 'px';
    }
    function integrate(card, target, omega, zeta, dt) {
      var k = omega * omega, d = 2 * zeta * omega;
      var steps = Math.max(1, Math.ceil(dt / STEP)), h = dt / steps;
      for (var i = 0; i < steps; i++) {
        for (var j = 0; j < AXES.length; j++) {
          var axis = AXES[j];
          card.v[axis] += (k * (target[axis] - card[axis]) - d * card.v[axis]) * h;
          card[axis] += card.v[axis] * h;
        }
      }
    }
    function scalar(value, velocity, target, omega, zeta, dt) {
      var k = omega * omega, d = 2 * zeta * omega;
      var steps = Math.max(1, Math.ceil(dt / STEP)), h = dt / steps;
      var x = value, v = velocity;
      for (var i = 0; i < steps; i++) {
        v += (k * (target - x) - d * v) * h;
        x += v * h;
      }
      return [x, v];
    }
    function frame(time) {
      state.raf = 0;
      var dt = state.last ? Math.min(.05, (time - state.last) / 1000) : 1 / 60;
      state.last = time;
      var restOmega = TAU * 1.7 * s.speed;
      var restZeta = reduce ? 1 : 1 - .72 * s.bounce;
      var exitOmega = TAU * 1.9 * s.speed;
      var busy = false;

      var spreadTarget = state.hovered && !reduce ? s.hoverSpread : 0;
      var r1 = scalar(state.spread, state.spreadV, spreadTarget, TAU * 1.4, .9, dt);
      state.spread = r1[0]; state.spreadV = r1[1];
      var r2 = scalar(state.px, state.pvx, reduce ? 0 : state.tx, TAU * 1.1, 1, dt);
      state.px = r2[0]; state.pvx = r2[1];
      var r3 = scalar(state.py, state.pvy, reduce ? 0 : state.ty, TAU * 1.1, 1, dt);
      state.py = r3[0]; state.pvy = r3[1];
      if (Math.abs(state.spread - spreadTarget) > .0005 || Math.abs(state.spreadV) > .0005 ||
          Math.abs(state.px - state.tx) > .05 || Math.abs(state.py - state.ty) > .05 ||
          Math.abs(state.pvx) + Math.abs(state.pvy) > .05) busy = true;
      writeStage();

      for (var n = 0; n < deck.length; n++) {
        var card = deck[n];
        if (card.phase === 'drag') { busy = true; write(card); continue; }
        var target = targetOf(card, time);
        var moving = card.phase === 'exit' || card.phase === 'enter';
        integrate(card, target, moving ? exitOmega : restOmega, moving ? 1 : restZeta, dt);
        if (card.phase === 'exit') {
          var base = slot(0);
          var travelled = (card.x - base.x) * card.dir.x + (card.y - base.y) * card.dir.y;
          if (travelled >= clearance(card.dir)) { card.phase = 'rest'; card.top = 0; card.hold = 0; }
        } else if (card.phase === 'enter') {
          var b = slot(0);
          if (card.y - b.y >= clearance(DOWN)) { card.phase = 'rest'; card.under = false; card.hold = 0; }
        }
        if (card.hold > time || card.phase !== 'rest') busy = true;
        for (var a = 0; a < AXES.length; a++) {
          var ax = AXES[a], limit = ax === 'p' ? .001 : .02;
          if (Math.abs(target[ax] - card[ax]) > limit || Math.abs(card.v[ax]) > limit) busy = true;
        }
        write(card);
      }
      if (busy) state.raf = requestAnimationFrame(frame);
      else {
        state.last = 0;
        for (var q = 0; q < deck.length; q++) if (deck[q].top && deck[q].phase === 'rest') deck[q].top = 0;
      }
    }
    function wake() { if (!state.raf) state.raf = requestAnimationFrame(frame); }
    function paused() {
      return !state.autoplay || count < 2 || (s.pauseOnHover && state.overCard) ||
        state.drag || !state.inView || document.visibilityState === 'hidden';
    }
    function schedule() {
      clearTimeout(state.timer); state.timer = 0;
      if (paused()) return;
      state.timer = window.setTimeout(function () { state.timer = 0; shift(1); }, Math.max(400, s.delay));
    }
    function settleOrder(time, stagger) {
      state.order.forEach(function (index, position) {
        var card = deck[index];
        if (card.pos === position) return;
        card.from = card.pos; card.pos = position;
        card.hold = time + Math.max(0, position) * stagger;
      });
    }
    function shift(direction, opts) {
      if (count < 2) return;
      opts = opts || {};
      var time = performance.now(), stagger = .05 / s.speed;
      if (direction > 0) {
        var front = deck[state.order[0]];
        state.order = state.order.slice(1).concat([front.index]);
        settleOrder(time, stagger * 1000);
        front.phase = 'exit'; front.dir = opts.dir || DOWN; front.tilt = opts.tilt || 0;
        front.top = ++state.layers; front.under = false; front.nudge = 0; front.hold = 0;
        if (opts.velocity) { front.v.x = opts.velocity.x; front.v.y = opts.velocity.y; }
      } else {
        var back = deck[state.order[count - 1]];
        state.order = [back.index].concat(state.order.slice(0, count - 1));
        settleOrder(time, stagger * 1000);
        back.phase = 'enter'; back.top = 0; back.under = true; back.nudge = 0; back.hold = 0;
      }
      deck.forEach(function (c) { if (c.phase === 'rest') c.nudge = 0; });
      countEl.textContent = pad2(state.order[0] + 1) + ' / ' + pad2(count);
      wake(); schedule();
    }
    function goTo(position) {
      state.queue.forEach(clearTimeout); state.queue = [];
      var gap = 110 / s.speed;
      for (var i = 0; i < position; i++) {
        (function (k) { state.queue.push(window.setTimeout(function () { shift(1); }, k * gap)); })(i);
      }
    }
    function fit() {
      var w = root.clientWidth, h = root.clientHeight;
      var scale = Math.min(1, w / s.bounds.w, h > 0 ? h / s.bounds.h : 1);
      state.scale = scale > 0 ? scale : 1;
      stage.style.transform = 'translate(-50%,-50%) scale(' + state.scale.toFixed(4) + ')';
    }
    function local(e) {
      var box = root.getBoundingClientRect();
      return { x: e.clientX - box.left, y: e.clientY - box.top, w: box.width, h: box.height };
    }
    function onMove(e) {
      if (e.pointerType !== 'touch') {
        var p = local(e);
        var nx = clamp((p.x / Math.max(1, p.w)) * 2 - 1, -1, 1);
        var ny = clamp((p.y / Math.max(1, p.h)) * 2 - 1, -1, 1);
        state.tx = nx * s.parallax * .35 * s.bounds.w;
        state.ty = ny * s.parallax * .35 * s.bounds.h;
        state.hovered = true;
        var over = !!(e.target.closest && e.target.closest('[data-cs-index]'));
        if (over !== state.overCard) { state.overCard = over; schedule(); }
        wake();
      }
      var drag = state.drag;
      if (!drag || drag.id !== e.pointerId) return;
      var dx = (e.clientX - drag.startX) / state.scale;
      var dy = (e.clientY - drag.startY) / state.scale;
      if (!drag.active) {
        if (Math.hypot(dx, dy) < 5) return;
        drag.active = true; state.dragged = true;
        var card = deck[drag.index];
        card.phase = 'drag'; card.v = { x: 0, y: 0, z: 0, r: 0, p: 0 };
        try { root.setPointerCapture(e.pointerId); } catch (err) {}
        root.style.cursor = 'grabbing';
      }
      var c = deck[drag.index], base = slot(0);
      c.x = base.x + dx; c.y = base.y + dy; c.z = base.z;
      c.r = clamp(dx * .035, -9, 9); c.p = 0;
      var now = performance.now();
      drag.samples.push({ x: c.x, y: c.y, t: now });
      while (drag.samples.length > 2 && now - drag.samples[0].t > 90) drag.samples.shift();
      var progress = clamp(Math.hypot(dx, dy) / (Math.min(s.w, s.h) * .3), 0, 1);
      var next = deck[state.order[1]];
      if (next && next.phase === 'rest') next.nudge = -.22 * progress;
      wake();
    }
    function onLeave(e) {
      if (e.pointerType === 'touch' || (state.drag && state.drag.active)) return;
      state.hovered = false; state.overCard = false; state.tx = 0; state.ty = 0;
      schedule(); wake();
    }
    function onDown(e) {
      state.dragged = false;
      if (!s.draggable || e.button > 0 || count < 2) return;
      var target = e.target.closest && e.target.closest('[data-cs-index]');
      if (!target || !root.contains(target)) return;
      var index = Number(target.getAttribute('data-cs-index'));
      if (index !== state.order[0] || deck[index].phase !== 'rest') return;
      state.drag = { id: e.pointerId, index: index, startX: e.clientX, startY: e.clientY, active: false, samples: [] };
      schedule();
    }
    function onUp(e) {
      var drag = state.drag;
      if (!drag || drag.id !== e.pointerId) return;
      state.drag = null; root.style.cursor = '';
      if (!drag.active) { schedule(); return; }
      try { root.releasePointerCapture(e.pointerId); } catch (err) {}
      var card = deck[drag.index], base = slot(0);
      var first = drag.samples[0], last = drag.samples[drag.samples.length - 1];
      var span = first && last ? Math.max(.016, (last.t - first.t) / 1000) : 1;
      var velocity = first && last && last !== first
        ? { x: (last.x - first.x) / span, y: (last.y - first.y) / span } : { x: 0, y: 0 };
      var offset = { x: card.x - base.x, y: card.y - base.y };
      var distance = Math.hypot(offset.x, offset.y), fling = Math.hypot(velocity.x, velocity.y);
      var next = deck[state.order[1]];
      if (next) next.nudge = 0;
      if (e.type !== 'pointercancel' && (distance > Math.min(s.w, s.h) * .3 || fling > 700)) {
        var aim = { x: offset.x + velocity.x * .12, y: offset.y + velocity.y * .12 };
        var len = Math.hypot(aim.x, aim.y) || 1;
        card.phase = 'rest';
        shift(1, { dir: { x: aim.x / len, y: aim.y / len }, tilt: card.r, velocity: velocity });
      } else {
        card.phase = 'rest'; card.v.x = velocity.x; card.v.y = velocity.y;
        wake(); schedule();
      }
    }
    function onClick(e) {
      if (state.dragged) { state.dragged = false; return; }
      var target = e.target.closest && e.target.closest('[data-cs-index]');
      if (!target || !root.contains(target)) return;
      var index = Number(target.getAttribute('data-cs-index'));
      var position = state.order.indexOf(index);
      if (position > 0) goTo(position);
    }
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); shift(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); shift(-1); }
    }
    function onVisibility() { schedule(); }

    var now = performance.now();
    if (opt.intro && !reduce) {
      deck.forEach(function (c) { c.from = 0; c.hold = now + (c.pos * 70) / s.speed; });
      stage.animate && stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
    } else {
      deck.forEach(function (c) { Object.assign(c, slot(c.pos)); });
    }
    fit(); writeStage(); deck.forEach(write); wake();

    var ro = new ResizeObserver(fit);
    ro.observe(root);
    var io = new IntersectionObserver(function (entries) {
      state.inView = entries[entries.length - 1] && entries[entries.length - 1].isIntersecting;
      if (state.inView) { wake(); }
      schedule();
    }, { rootMargin: '120px' });
    io.observe(root);

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    prevBtn.addEventListener('click', function () { shift(-1); });
    nextBtn.addEventListener('click', function () { shift(1); });
    document.addEventListener('visibilitychange', onVisibility);
    schedule();

    return {
      next: function () { shift(1); },
      prev: function () { shift(-1); },
      destroy: function () {
        cancelAnimationFrame(state.raf); clearTimeout(state.timer);
        state.queue.forEach(clearTimeout);
        ro.disconnect(); io.disconnect();
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerleave', onLeave);
        root.removeEventListener('pointerdown', onDown);
        root.removeEventListener('pointerup', onUp);
        root.removeEventListener('pointercancel', onUp);
        root.removeEventListener('click', onClick);
        root.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisibility);
        root.innerHTML = ''; root.classList.remove('cs-root');
      }
    };
  }

  window.CardSwap = { init: init };
})();

/* ===========================================================
   CircularCarousel · 人像照环形画廊（原生移植 React CircularCarousel）
   CSS 3D 圆柱 / 8 段曲面分片 / 弹性吸附 / 拖拽惯性 / 键盘 / 横向滚轮
   风格：Odyssee —— 米白卡背、藏蓝细线、零圆角
   =========================================================== */
(function () {
  'use strict';

  var TILES = 8;
  var OVERLAP = 2.5;
  var DRAG_THRESHOLD = 5;
  var SPRING = 118;
  var SETTLE_SPEED = 9;
  var CAPTION_SPACE = 58;
  var TO_RAD = Math.PI / 180;

  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var wrap = function (d) { return ((((d + 180) % 360) + 360) % 360) - 180; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 4); };
  var easeOutQuint = function (t) { return 1 - Math.pow(1 - t, 5); };
  var pad2 = function (n) { return String(n).padStart(2, '0'); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var rotateX = function (p, deg) {
    var r = deg * TO_RAD, c = Math.cos(r), s = Math.sin(r);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  };
  var rotateY = function (p, deg) {
    var r = deg * TO_RAD, c = Math.cos(r), s = Math.sin(r);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  };

  function init(root, items, options) {
    if (!root || !items || !items.length) return null;
    var opt = Object.assign({
      cardWidth: 220, aspectRatio: .68, gap: 22, tilt: -5,
      perspective: 2200, curve: 1, spread: 1,
      speed: 11, interval: 3.6, direction: 'left',
      parallax: .32, stretch: .4, depthFade: .5,
      intro: 'rise', autoplay: 'step', pauseOnHover: true
    }, options || {});

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var count = items.length;
    var rootW = root.clientWidth || 720;
    var cardW = clamp(rootW * .3, 148, opt.cardWidth);
    var cardH = cardW / clamp(opt.aspectRatio, .2, 5);
    var step = 360 / count;
    var pitch = (cardW + opt.gap) * opt.spread;
    var n = Math.max(count, 3);
    var chord = pitch / (2 * Math.sin(Math.PI / n));
    var arc = (n * pitch) / (2 * Math.PI);
    var radius = Math.max(chord + (arc - chord) * opt.curve, cardW * .6);
    var bend = radius / (opt.curve || 1);
    var P = opt.perspective;
    var tiltValue = opt.tilt;

    /* 8 段分片：把一张平面照片弯成圆柱表面 */
    var length = cardW / TILES;
    var tiles = [];
    for (var t = 0; t < TILES; t++) {
      var start = t * length - (t > 0 ? OVERLAP / 2 : 0);
      var end = (t + 1) * length + (t < TILES - 1 ? OVERLAP / 2 : 0);
      var center = (start + end) / 2 - cardW / 2;
      var alpha = center / bend;
      var shift = bend * Math.sin(alpha);
      var sink = bend * (1 - Math.cos(alpha));
      tiles.push({
        offset: start, size: end - start,
        move: 'translate3d(' + shift.toFixed(2) + 'px,0,' + (-sink).toFixed(2) + 'px) rotateY(' +
          ((alpha * 180) / Math.PI).toFixed(3) + 'deg)'
      });
    }

    root.classList.add('cc-root');
    root.setAttribute('tabindex', '0');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'carousel');
    root.setAttribute('aria-label', '人像照环形画廊，可拖拽或使用方向键浏览');
    root.innerHTML =
      '<div class="cc-view"><div class="cc-stage"><div class="cc-camera"><div class="cc-ring">' +
        items.map(function (it, i) {
          var front = tiles.map(function (tile) {
            return '<div class="cc-tile" style="left:' + (-tile.size / 2).toFixed(2) + 'px;' +
              'top:' + (-cardH / 2).toFixed(2) + 'px;width:' + tile.size.toFixed(2) + 'px;' +
              'height:' + cardH.toFixed(2) + 'px;transform:' + tile.move + '">' +
              '<div class="cc-frame">' +
                '<img class="cc-photo" src="' + esc(it.src) + '" alt="" draggable="false" decoding="async" ' +
                  'loading="' + (i < 3 ? 'eager' : 'lazy') + '" ' +
                  'style="left:' + (-tile.offset).toFixed(2) + 'px;top:0;width:' + cardW.toFixed(2) +
                  'px;height:' + cardH.toFixed(2) + 'px">' +
                '<span class="cc-shade" aria-hidden="true"></span>' +
              '</div></div>';
          }).join('');
          return '<div class="cc-card" data-cc-index="' + i + '" role="group" aria-roledescription="slide" ' +
            'aria-label="' + esc(it.title || ('人像照 ' + pad2(i + 1))) + '，第 ' + (i + 1) + ' / ' + count + ' 张">' +
            front +
            '<div class="cc-cardback" aria-hidden="true" style="left:' + (-cardW / 2).toFixed(2) +
              'px;top:' + (-cardH / 2).toFixed(2) + 'px;width:' + cardW.toFixed(2) +
              'px;height:' + cardH.toFixed(2) + 'px"></div>' +
          '</div>';
        }).join('') +
      '</div></div></div></div>' +
      '<div class="cc-caption" aria-hidden="true">' +
        '<span class="cc-title serif"></span><span class="cc-subtitle eyebrow"></span>' +
        '<span class="cc-count eyebrow"><span class="cc-now">01</span> / ' + pad2(count) + '</span>' +
      '</div>' +
      '<div class="cc-live" aria-live="polite" aria-atomic="true"></div>';

    var stage = root.querySelector('.cc-stage');
    var camera = root.querySelector('.cc-camera');
    var ring = root.querySelector('.cc-ring');
    var cards = Array.prototype.slice.call(root.querySelectorAll('.cc-card'));
    var captionTitle = root.querySelector('.cc-title');
    var captionSub = root.querySelector('.cc-subtitle');
    var captionNow = root.querySelector('.cc-now');
    var live = root.querySelector('.cc-live');

    var state = {
      angle: 0, velocity: 0, target: null, dir: opt.direction === 'right' ? 1 : -1,
      press: null, drag: false, hover: false,
      pointer: { inside: false, x: 0, y: 0 },
      yaw: 0, pitch: 0, intro: null, introDone: false,
      holdUntil: 0, stepAt: 0, stepTimer: 0, suppressClick: false, wheelTimer: 0,
      fit: 1, shift: 0, drop: 0, last: 0, raf: 0, visible: true
    };
    var active = -1;

    function measure() {
      var rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var width = rect.width * .94;
      var height = (rect.height - CAPTION_SPACE) * .92;
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      var corners = [[-cardW / 2, -cardH / 2], [cardW / 2, -cardH / 2],
                     [-cardW / 2, cardH / 2], [cardW / 2, cardH / 2]];
      for (var a = -180; a <= 180; a += 15) {
        for (var c = 0; c < corners.length; c++) {
          var p = rotateX(rotateY([corners[c][0], corners[c][1], radius], a), tiltValue);
          p = [p[0], p[1], p[2] - radius];
          if (p[2] >= P * .95) continue;
          var k = P / (P - p[2]);
          minX = Math.min(minX, p[0] * k); maxX = Math.max(maxX, p[0] * k);
          minY = Math.min(minY, p[1] * k); maxY = Math.max(maxY, p[1] * k);
        }
      }
      var spanX = Math.max(maxX - minX, 1), spanY = Math.max(maxY - minY, 1);
      state.fit = Math.min(1, width / spanX, height / spanY);
      state.shift = -((minY + maxY) / 2) * state.fit - CAPTION_SPACE / 2;
      state.drop = (rect.height / Math.max(state.fit, .2)) * .55 + cardH;
      stage.style.perspective = P + 'px';
      stage.style.transform = 'translate3d(0,' + state.shift.toFixed(2) + 'px,0) scale(' + state.fit.toFixed(4) + ')';
    }

    function introCard(elapsed, landing) {
      if (!state.intro) return { radius: 1, lift: 0 };
      if (state.intro.type === 'rise') {
        var reach = Math.abs(wrap(landing + state.angle));
        var delay = (reach / 180) * 480;
        var p = easeOutQuint(clamp((elapsed - delay) / 900, 0, 1));
        return { radius: 1, lift: (1 - p) * state.drop };
      }
      return { radius: 1, lift: 0 };
    }

    function advance(dt, now) {
      if (!state.introDone) {
        if (!state.intro) {
          if (reduce || opt.intro === 'none') state.introDone = true;
          else state.intro = { type: 'rise', start: now };
        }
        if (state.intro && now - state.intro.start >= 1400) { state.intro = null; state.introDone = true; }
      }
      var busy = !!(state.intro || state.drag);

      if (state.drag || state.intro) {
        if (!state.drag) state.velocity = 0;
      } else if (state.target !== null) {
        var remaining = dt, damping = 2 * Math.sqrt(SPRING);
        while (remaining > 0) {
          var h = Math.min(remaining, 1 / 240);
          state.velocity += (SPRING * (state.target - state.angle) - damping * state.velocity) * h;
          state.angle += state.velocity * h;
          remaining -= h;
        }
        if (Math.abs(state.target - state.angle) < .004 && Math.abs(state.velocity) < .03) {
          state.angle = state.target; state.velocity = 0; state.target = null;
        }
        busy = true;
      } else {
        var tau = .18 + .6 * 1.5;
        state.velocity += (0 - state.velocity) * (1 - Math.exp(-dt / tau));
        state.angle += state.velocity * dt;
        var nearest = Math.round(state.angle / step) * step;
        /* 只有确实偏离卡位时才吸附，避免静止时 rAF 空转 */
        if (Math.abs(state.velocity) < SETTLE_SPEED && Math.abs(state.angle - nearest) > .05) state.target = nearest;
        busy = busy || Math.abs(state.velocity) > .01 || state.target !== null;
      }

      /* 逐张步进交给定时器，静止时不再每帧空转 rAF */
      if (now < state.holdUntil) busy = true;
      var ease = 1 - Math.exp(-dt / .35);
      var aimYaw = state.pointer.inside ? state.pointer.x * opt.parallax * 9 : 0;
      var aimPitch = state.pointer.inside ? -state.pointer.y * opt.parallax * 6 : 0;
      state.yaw += (aimYaw - state.yaw) * ease;
      state.pitch += (aimPitch - state.pitch) * ease;
      if (Math.abs(aimYaw - state.yaw) > .01 || Math.abs(aimPitch - state.pitch) > .01) busy = true;
      return busy;
    }

    function render(now) {
      var elapsed = state.intro ? now - state.intro.start : 0;
      var swell = 1 + (reduce ? 0 : opt.stretch) * .12 * Math.min(1, Math.abs(state.velocity) / 420);
      var R = radius * swell;
      camera.style.transform = 'translate3d(0,0,' + (-R).toFixed(2) + 'px) rotateX(' +
        (tiltValue + state.pitch).toFixed(3) + 'deg) rotateY(' + state.yaw.toFixed(3) + 'deg)';
      ring.style.transform = 'rotateY(' + state.angle.toFixed(3) + 'deg)';

      for (var i = 0; i < count; i++) {
        var base = i * step;
        var mod = introCard(elapsed, base);
        var transform = 'rotateY(' + base.toFixed(3) + 'deg) translateZ(' + (R * mod.radius).toFixed(2) + 'px)';
        if (mod.lift) transform += ' translateY(' + mod.lift.toFixed(2) + 'px)';
        cards[i].style.transform = transform;
        var world = wrap(base + state.angle);
        var facing = Math.cos(world * TO_RAD);
        var fade = opt.depthFade * Math.pow((1 - facing) / 2, 1.25);
        cards[i].style.setProperty('--cc-depth', fade.toFixed(3));
      }

      var index = ((Math.round(-state.angle / step) % count) + count) % count;
      if (index !== active) {
        active = index;
        var it = items[index];
        captionTitle.textContent = it.title || ('人像照 ' + pad2(index + 1));
        captionSub.textContent = it.subtitle || 'PORTRAIT';
        captionNow.textContent = pad2(index + 1);
        live.textContent = (it.title || '') + '，第 ' + (index + 1) + ' / ' + count + ' 张';
        root.setAttribute('data-cc-active', String(index));
      }
    }

    function frame(now) {
      state.raf = 0;
      var dt = state.last ? Math.min((now - state.last) / 1000, .05) : 1 / 60;
      state.last = now;
      var busy = advance(dt, now);
      render(now);
      if (busy && state.visible && !document.hidden) state.raf = requestAnimationFrame(frame);
      else state.last = 0;
    }
    function wake() {
      if (!state.raf && state.visible && !document.hidden) state.raf = requestAnimationFrame(frame);
    }
    function tickStep() {
      clearTimeout(state.stepTimer);
      if (reduce || opt.autoplay !== 'step') return;
      state.stepTimer = window.setTimeout(function () {
        var now = performance.now();
        var paused = (opt.pauseOnHover && state.hover) || state.drag || now < state.holdUntil;
        if (state.visible && !document.hidden && !paused) {
          var base = state.target !== null ? state.target : Math.round(state.angle / step) * step;
          state.target = base + step * state.dir;
        }
        wake();
        tickStep();
      }, Math.max(800, opt.interval * 1000));
    }
    function focusIndex(index) {
      var target = -index * step;
      target += 360 * Math.round((state.angle - target) / 360);
      state.target = target;
      state.holdUntil = performance.now() + 2800;
      wake();
    }
    function stepBy(delta) {
      var base = state.target !== null ? state.target : Math.round(state.angle / step) * step;
      state.target = base - delta * step;
      state.holdUntil = performance.now() + 2800;
      wake();
    }

    function updatePointer(e) {
      var rect = root.getBoundingClientRect();
      state.pointer.x = clamp(((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -1, 1);
      state.pointer.y = clamp(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1, -1, 1);
    }
    function onDown(e) {
      state.suppressClick = false;
      if (e.button !== 0) return;
      state.press = {
        id: e.pointerId, x: e.clientX, y: e.clientY, angle: state.angle,
        moved: false, origin: 0, samples: [{ time: performance.now(), angle: state.angle }]
      };
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (e.pointerType === 'mouse') { state.pointer.inside = true; updatePointer(e); }
      var press = state.press;
      if (!press || press.id !== e.pointerId) { if (e.pointerType === 'mouse') wake(); return; }
      var delta = e.clientX - press.x;
      var cross = e.clientY - press.y;
      if (!press.moved) {
        if (Math.abs(delta) < DRAG_THRESHOLD) return;
        if (Math.abs(cross) > Math.abs(delta) * 1.2 && e.pointerType !== 'mouse') { state.press = null; return; }
        press.moved = true; press.origin = delta;
        state.drag = true; state.target = null; state.velocity = 0;
        root.classList.add('is-dragging');
      }
      var perPixel = 180 / (Math.PI * radius * Math.max(state.fit, .2));
      state.angle = press.angle + (delta - press.origin) * perPixel;
      var now = performance.now();
      press.samples.push({ time: now, angle: state.angle });
      while (press.samples.length > 2 && now - press.samples[0].time > 110) press.samples.shift();
      wake();
    }
    function onUp(e) {
      var press = state.press;
      if (!press || press.id !== e.pointerId) return;
      state.press = null;
      try { root.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!press.moved) return;
      state.drag = false; root.classList.remove('is-dragging');
      state.suppressClick = true;
      var first = press.samples[0], last = press.samples[press.samples.length - 1];
      var span = (last.time - first.time) / 1000;
      var velocity = span > .008 ? clamp((last.angle - first.angle) / span, -1400, 1400) : 0;
      state.velocity = velocity;
      if (Math.abs(velocity) > 60) state.dir = Math.sign(velocity);
      var tau = .18 + .6 * 1.5;
      state.target = Math.round((state.angle + velocity * tau * .55) / step) * step;
      wake();
    }
    function onWheel(e) {
      var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (!delta) return;                 /* 纵向滚轮留给页面滚动 */
      e.preventDefault();
      var perPixel = 180 / (Math.PI * radius * Math.max(state.fit, .2));
      state.target = null;
      state.angle -= delta * perPixel * 1.4;
      state.velocity = -delta * perPixel * 1.4 * 30;
      state.holdUntil = performance.now() + 1600;
      clearTimeout(state.wheelTimer);
      state.wheelTimer = setTimeout(function () {
        state.target = Math.round((state.angle + state.velocity * .12) / step) * step;
        wake();
      }, 140);
      wake();
    }
    function onClick(e) {
      if (state.suppressClick) { state.suppressClick = false; return; }
      var card = e.target.closest && e.target.closest('[data-cc-index]');
      if (!card) return;
      focusIndex(Number(card.getAttribute('data-cc-index')));
    }
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') stepBy(1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') stepBy(-1);
      else if (e.key === 'Home') focusIndex(0);
      else if (e.key === 'End') focusIndex(count - 1);
      else return;
      e.preventDefault();
    }
    function onEnter(e) { if (e.pointerType === 'mouse') { state.hover = true; wake(); } }
    function onLeave(e) {
      if (e.pointerType === 'mouse') { state.hover = false; state.pointer.inside = false; }
      wake();
    }
    function onVisibility() {
      if (document.hidden) { cancelAnimationFrame(state.raf); state.raf = 0; state.last = 0; }
      else wake();
    }

    var ro = new ResizeObserver(function () { measure(); wake(); });
    ro.observe(root);
    var io = new IntersectionObserver(function (entries) {
      state.visible = !!(entries[0] && entries[0].isIntersecting);
      if (state.visible) wake();
      else { cancelAnimationFrame(state.raf); state.raf = 0; state.last = 0; }
    }, { rootMargin: '120px' });
    io.observe(root);

    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);

    measure(); render(performance.now()); wake(); tickStep();

    return {
      next: function () { stepBy(1); },
      prev: function () { stepBy(-1); },
      destroy: function () {
        cancelAnimationFrame(state.raf); clearTimeout(state.wheelTimer); clearTimeout(state.stepTimer);
        ro.disconnect(); io.disconnect();
        root.removeEventListener('wheel', onWheel);
        root.removeEventListener('pointerdown', onDown);
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerup', onUp);
        root.removeEventListener('pointercancel', onUp);
        root.removeEventListener('pointerenter', onEnter);
        root.removeEventListener('pointerleave', onLeave);
        root.removeEventListener('click', onClick);
        root.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisibility);
        root.innerHTML = ''; root.classList.remove('cc-root');
      }
    };
  }

  window.CircularCarousel = { init: init };
})();

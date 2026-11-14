/* ===========================================================
   DriftWall · 风景照漂移墙（原生移植 React DriftWall）
   多列反向漂移 / 3D 倾斜视差 / 悬停抬升 / 边缘柔化
   风格：Odyssee —— 米白底、藏蓝薄罩、零圆角、细线边框
   =========================================================== */
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var columnFactor = function (index, variance) {
    var pseudo = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1;
    return 1 + variance * pseudo;
  };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  function init(root, items, options) {
    if (!root || !items || !items.length) return null;
    var opt = Object.assign({
      tileWidth: 190, tileHeight: 132, gap: 14,
      tilt: 11, turn: -9, roll: 0, perspective: 1200, depth: 110,
      speed: 34, variance: .45, parallax: .6, lift: 52,
      fade: .38, dim: 1, grayscale: .08, pauseOnHover: false,
      direction: 'up'
    }, options || {});

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var rootW = root.clientWidth || 720;
    var rootH = root.clientHeight || 560;
    var columns = rootW < 520 ? 3 : rootW < 860 ? 4 : 5;
    var tileW = clamp(rootW / (columns + 1.05), 100, opt.tileWidth);
    var tileH = tileW * (opt.tileHeight / opt.tileWidth);
    var gap = opt.gap;
    var unit = tileH + gap;

    var cols = Array.from({ length: columns }, function () { return []; });
    items.forEach(function (it, i) { cols[i % columns].push(it); });
    cols = cols.map(function (col) { return col.length ? col : items.slice(0, 1); });

    var metas = cols.map(function (col) {
      var copyHeight = Math.max(unit, col.length * unit);
      var copies = Math.max(2, Math.ceil((rootH * 1.7) / copyHeight) + 1);
      return { copyHeight: copyHeight, copies: copies };
    });

    root.classList.add('dw-root');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', '风景照漂移墙，悬停可放大单张照片');
    root.style.setProperty('--dw-tile-w', tileW.toFixed(2) + 'px');
    root.style.setProperty('--dw-tile-h', tileH.toFixed(2) + 'px');
    root.style.setProperty('--dw-gap', gap + 'px');
    root.style.setProperty('--dw-perspective', opt.perspective + 'px');
    root.style.setProperty('--dw-lift', opt.lift + 'px');
    root.style.setProperty('--dw-dim', String(opt.dim));
    root.style.setProperty('--dw-gray', String(opt.grayscale));
    root.style.setProperty('--dw-edge', (Math.max(0, 1 - opt.fade) * 100).toFixed(1) + '%');

    function tileHTML(it, id, colIndex, copyIndex) {
      return '<div class="dw-tile" data-dw-id="' + id + '" data-col="' + colIndex + '" tabindex="-1" ' +
        'aria-label="' + esc(it.title || '风景照') + '">' +
        '<span class="dw-inner">' +
          '<img src="' + esc(it.src) + '" alt="' + esc(it.alt || it.title || '') + '" ' +
            'loading="lazy" decoding="async" draggable="false">' +
          '<span class="dw-overlay" aria-hidden="true"></span>' +
          '<span class="dw-tag eyebrow">' + esc(it.tag || '') + '</span>' +
        '</span></div>';
    }

    root.innerHTML = '<div class="dw-plane">' + cols.map(function (col, c) {
      var meta = metas[c];
      var copies = '';
      for (var k = 0; k < meta.copies; k++) {
        copies += col.map(function (it, j) { return tileHTML(it, c + '-' + k + '-' + j, c, k); }).join('');
      }
      return '<div class="dw-col"><div class="dw-track">' + copies + '</div></div>';
    }).join('') + '</div>';

    /* 竖屏长图按原比例完整呈现（contain + 米白底），不被裁成横屏；
       横屏图仍用 cover 铺满，保持漂移墙的节奏感。 */
    root.querySelectorAll('.dw-inner img').forEach(function (img) {
      function mark() {
        var tile = img.closest && img.closest('.dw-tile');
        if (tile && img.naturalHeight > img.naturalWidth) tile.classList.add('is-portrait');
      }
      if (img.complete && img.naturalWidth) mark();
      else img.addEventListener('load', mark);
    });

    var plane = root.querySelector('.dw-plane');
    var tracks = Array.prototype.slice.call(root.querySelectorAll('.dw-track'));
    var offsets = metas.map(function (meta, c) { return meta.copyHeight * ((c * .37) % 1); });
    var velocities = cols.map(function () { return 0; });
    var baseVelocities = cols.map(function (_, c) {
      var sign = opt.direction === 'up' ? 1 : -1;
      return opt.speed * columnFactor(c, opt.variance) * sign * (c % 2 === 0 ? 1 : -1);
    });

    var state = {
      raf: 0, last: null, visible: true,
      pointer: { x: 0, y: 0 }, damped: { x: 0, y: 0 },
      hoveredCol: -1, wallHovered: false, activeKey: null
    };
    /* id 形如「列-副本-序号」，去掉副本号得到同一张图的稳定键 */
    var keyOf = function (id) {
      var p = id.split('-');
      return p[0] + '-' + p[2];
    };

    function applyPlane(px, py) {
      plane.style.transform = 'translate(-50%,-50%) scale(1.14) ' +
        'rotateX(' + (opt.tilt + py).toFixed(3) + 'deg) rotateY(' + (opt.turn + px).toFixed(3) +
        'deg) rotateZ(' + opt.roll + 'deg) translateZ(' + (-opt.depth) + 'px)';
    }
    function frame(ts) {
      if (state.last === null) state.last = ts;
      var dt = Math.min(.05, Math.max(0, ts - state.last) / 1000);
      state.last = ts;
      var maxTilt = opt.parallax * 8;
      var targetX = state.pointer.x * maxTilt, targetY = -state.pointer.y * maxTilt;
      var damp = 1 - Math.exp(-dt / .12);
      state.damped.x += (targetX - state.damped.x) * damp;
      state.damped.y += (targetY - state.damped.y) * damp;
      applyPlane(state.damped.x, state.damped.y);

      if (!reduce) {
        for (var c = 0; c < tracks.length; c++) {
          var meta = metas[c];
          var paused = (state.wallHovered && opt.pauseOnHover) || state.hoveredCol === c;
          var target = paused ? 0 : baseVelocities[c];
          var ease = 1 - Math.exp(-dt / (target === 0 ? .16 : .28));
          velocities[c] += (target - velocities[c]) * ease;
          var next = offsets[c] + velocities[c] * dt;
          next = ((next % meta.copyHeight) + meta.copyHeight) % meta.copyHeight;
          offsets[c] = next;
          tracks[c].style.transform = 'translate3d(0,' + (-next).toFixed(2) + 'px,0)';
        }
      }
      state.raf = requestAnimationFrame(frame);
    }
    function wake() {
      if (!state.raf && state.visible && !document.hidden) state.raf = requestAnimationFrame(frame);
    }
    function onVisibility() {
      if (document.hidden) { cancelAnimationFrame(state.raf); state.raf = 0; state.last = null; }
      else wake();
    }
    function setActive(key) {
      if (key === state.activeKey) return;
      state.activeKey = key;
      state.hoveredCol = key ? Number(key.split('-')[0]) : -1;
      /* 同一张图有重复副本，全部同步高亮 */
      root.querySelectorAll('.dw-tile').forEach(function (n) {
        var on = key && keyOf(n.getAttribute('data-dw-id')) === key;
        n.classList.toggle('is-active', !!on);
      });
    }
    function onMove(e) {
      var rect = root.getBoundingClientRect();
      if (!reduce && opt.parallax > 0) {
        state.pointer.x = (e.clientX - rect.left) / Math.max(1, rect.width) - .5;
        state.pointer.y = (e.clientY - rect.top) / Math.max(1, rect.height) - .5;
      }
      var tile = e.target.closest && e.target.closest('[data-dw-id]');
      /* 3D 倾斜后列间会留出细缝：经过缝隙时保持上一张高亮，避免闪烁 */
      if (tile) setActive(keyOf(tile.getAttribute('data-dw-id')));
      wake();
    }
    function onEnter() { state.wallHovered = true; wake(); }
    function onLeave() {
      state.wallHovered = false; state.pointer.x = 0; state.pointer.y = 0;
      setActive(null); wake();
    }

    var ro = new ResizeObserver(function () { wake(); });
    ro.observe(root);
    var io = new IntersectionObserver(function (entries) {
      state.visible = !!(entries[0] && entries[0].isIntersecting);
      if (state.visible) wake();
      else { cancelAnimationFrame(state.raf); state.raf = 0; state.last = null; }
    }, { rootMargin: '120px' });
    io.observe(root);

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    applyPlane(0, 0);
    tracks.forEach(function (tr, c) { tr.style.transform = 'translate3d(0,' + (-offsets[c]).toFixed(2) + 'px,0)'; });
    wake();

    return {
      destroy: function () {
        cancelAnimationFrame(state.raf); ro.disconnect(); io.disconnect();
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerenter', onEnter);
        root.removeEventListener('pointerleave', onLeave);
        document.removeEventListener('visibilitychange', onVisibility);
        root.innerHTML = ''; root.classList.remove('dw-root');
      }
    };
  }

  window.DriftWall = { init: init };
})();

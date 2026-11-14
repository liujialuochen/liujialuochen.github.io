/* ===========================================================
   ReelGallery · 原生零依赖「卷轴画廊」（移植 reactbits ReelGallery）
   · 多行横向卷动的图片条：每行以不同速度自走、整体倾斜、行间拱形排布
   · 指针停留处为彩色聚光，其余位置去色（grayscale），圆角裁切、左右边缘淡出、
     外侧行压暗 / 收窄（dim / taper）
   · 支持拖拽、横向滚轮、自动漂移、释放惯性
   · 纯 DOM + CSS transform，无 WebGL、无外部依赖
   设计基调沿用作品集：暖米白底、藏蓝细边、克制的玻璃感投影。
   =========================================================== */
(function () {
  'use strict';

  function init(root, items, options) {
    if (!root || !Array.isArray(items) || !items.length) return null;
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var opt = Object.assign({
      rows: 4, rowHeight: 132, rowGap: 18, itemGap: 14,
      maxAspect: 2, minAspect: 0.62,
      tilt: 7, arch: 46, speed: 1, speedVariance: 0.5,
      alternate: true, autoScroll: 26, inertia: 0.92, damping: 0.1,
      dragSensitivity: 1.6, wheelSensitivity: 1, radius: 12,
      grayscale: 0.65, focusRadius: 210, focusStrength: 0.85, brightness: 1,
      fade: 0.12, dim: 0.35, taper: 0.12, paused: false, interactive: true
    }, options || {});

    root.classList.add('rg');
    root.innerHTML = '<div class="rg-stage"><div class="rg-tilt"></div></div>';
    var stage = root.querySelector('.rg-stage');
    var tilt = root.querySelector('.rg-tilt');
    tilt.style.transform = 'rotateX(' + (reduce ? 0 : opt.tilt) + 'deg)';

    // 图片按行轮转分配
    var rowItems = [];
    for (var ri = 0; ri < opt.rows; ri++) rowItems.push([]);
    items.forEach(function (it, i) { rowItems[i % opt.rows].push(it); });

    var rows = [];
    var raf = 0, last = 0, visible = true;
    var dragging = false, startX = 0, prevX = 0, startOffsets = [], dragMoved = false, lastStep = 0;
    var pressTile = null;
    var focusVX = -9999, focusVY = -9999, focusOn = false;

    rowItems.forEach(function (list, r) {
      var row = document.createElement('div');
      row.className = 'rg-row';
      tilt.appendChild(row);

      var tiles = [];
      list.forEach(function (it) {
        var fig = document.createElement('figure');
        fig.className = 'rg-tile';
        fig.dataset.i = String(items.indexOf(it));   // 点击放大时定位原图
        var img = document.createElement('img');
        img.src = it.src; img.alt = it.alt || '';
        img.draggable = false; img.loading = 'lazy'; img.decoding = 'async';
        img.addEventListener('load', function () {
          var a = img.naturalWidth / Math.max(1, img.naturalHeight);
          fig.dataset.aspect = Math.min(opt.maxAspect, Math.max(opt.minAspect, a)).toFixed(3);
          relayout();
        });
        fig.style.borderRadius = opt.radius + 'px';
        fig.appendChild(img);
        row.appendChild(fig);
        tiles.push(fig);
      });

      var norm = opt.rows > 1 ? (r / (opt.rows - 1) - 0.5) * 2 : 0;
      var speed = opt.autoScroll * opt.speed * (1 + opt.speedVariance * norm);
      if (opt.alternate && r % 2) speed = -speed;

      rows.push({
        el: row, tiles: tiles, baseCount: tiles.length,
        offset: Math.random() * 600, vel: 0, speed: speed,
        copyWidth: 0, taper: 1 - opt.taper * Math.abs(norm),
        dim: opt.dim * Math.abs(norm), top: 0, copies: 0
      });
    });

    // 确保每行有足够份拷贝，使横向滚动无缝衔接
    function ensureCopies(obj) {
      var W = stage.clientWidth || 1;
      var n = obj.baseCount;
      if (!n) return;
      var first = obj.tiles[0], lastT = obj.tiles[n - 1];
      var cw = (lastT.offsetLeft + lastT.offsetWidth) - first.offsetLeft;
      if (cw <= 0) cw = n * (obj.tiles[0].offsetWidth + opt.itemGap);
      obj.copyWidth = cw;
      var need = Math.max(2, Math.ceil((W + cw) / cw) + 1);
      while (obj.copies < need) {
        for (var i = 0; i < n; i++) {
          var src = obj.tiles[i].querySelector('img');
          var fig = document.createElement('figure');
          fig.className = 'rg-tile';
          fig.dataset.aspect = obj.tiles[i].dataset.aspect || '1.3';
          fig.style.borderRadius = opt.radius + 'px';
          fig.style.width = obj.tiles[i].style.width;
          fig.style.height = obj.tiles[i].style.height;
          var img = document.createElement('img');
          img.src = src ? src.src : ''; img.alt = src ? src.alt : '';
          img.draggable = false; img.loading = 'lazy'; img.decoding = 'async';
          fig.appendChild(img);
          obj.el.appendChild(fig);
          obj.tiles.push(fig);
        }
        obj.copies++;
      }
    }

    function relayout() {
      var W = stage.clientWidth;
      var scale = W < 760 ? 0.62 : (W < 1100 ? 0.82 : 1);
      var rh = Math.round(opt.rowHeight * scale);
      var gap = opt.itemGap * (W < 760 ? 0.7 : 1);
      root.style.setProperty('--rg-gap', gap + 'px');
      stage.style.setProperty('--rg-fade', opt.fade);
      var totalH = opt.rows * rh + (opt.rows - 1) * opt.rowGap * scale;
      stage.style.height = (totalH + opt.arch * 1.4 + 44) + 'px';

      rows.forEach(function (obj, r) {
        obj.el.style.height = rh + 'px';
        var norm = opt.rows > 1 ? (r / (opt.rows - 1) - 0.5) * 2 : 0;
        var archOff = opt.arch * (1 - Math.abs(norm)) * 0.5 * scale;
        obj.top = 22 + r * (rh + opt.rowGap * scale) + archOff;
        obj.el.style.top = obj.top + 'px';
        obj.el.style.transform = 'translateX(0) scale(' + obj.taper + ')';
        obj.el.style.filter = 'brightness(' + (1 - obj.dim) + ')';
        obj.tiles.forEach(function (t) {
          var a = parseFloat(t.dataset.aspect || '1.3');
          t.style.height = rh + 'px';
          t.style.width = Math.round(rh * a) + 'px';
        });
        ensureCopies(obj);
      });
      wake();
    }

    function applyFocus() {
      var vx = focusVX, vy = focusVY;
      // 第一遍：仅读取真实屏幕坐标（post-transform，含 tilt / scale），
      // 与指针的视口坐标直接比对，避免聚光偏移；本遍只读数不写，避免强制重排。
      rows.forEach(function (obj) {
        obj.tiles.forEach(function (t) {
          if (focusOn) {
            var r = t.getBoundingClientRect();
            var dx = (r.left + r.width / 2) - vx;
            var dy = (r.top + r.height / 2) - vy;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var f = Math.max(0, 1 - dist / opt.focusRadius);
            var s = opt.focusStrength * f;
            t._g = opt.grayscale * (1 - s);
            t._b = 1 + (opt.brightness - 1) * s;
          } else {
            t._g = opt.grayscale;
            t._b = 1;
          }
        });
      });
      // 第二遍：只写 filter，不再读数，杜绝逐元素重排。
      rows.forEach(function (obj) {
        obj.tiles.forEach(function (t) {
          var g = t._g, b = t._b;
          var key = g.toFixed(2) + '|' + b.toFixed(2);
          if (t._fk !== key) {
            t._fk = key;
            t.style.filter = 'grayscale(' + g.toFixed(3) + ') brightness(' + b.toFixed(3) + ')';
          }
        });
      });
    }

    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      rows.forEach(function (obj) {
        if (!dragging) {
          if (!opt.paused && !reduce) obj.offset += obj.speed * dt;
          if (obj.vel) {
            obj.offset += obj.vel;
            obj.vel *= opt.inertia;
            if (Math.abs(obj.vel) < 0.15) obj.vel = 0;
          }
        }
        obj.offset = ((obj.offset % obj.copyWidth) + obj.copyWidth) % obj.copyWidth;
        obj.el.style.transform = 'translateX(' + (-obj.offset) + 'px) scale(' + obj.taper + ')';
      });
      applyFocus();
      raf = requestAnimationFrame(frame);
    }
    function wake() {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }

    /* ---------- 交互：指针聚光 / 拖拽 / 滚轮 ---------- */
    if (opt.interactive) {
      stage.addEventListener('pointermove', function (e) {
        var rect = stage.getBoundingClientRect();
        focusVX = e.clientX;
        focusVY = e.clientY;
        focusOn = true;
        if (dragging) {
          var dx = e.clientX - startX, dy = e.clientY - rect.top - prevY;
          if (!dragMoved && e.pointerType !== 'mouse' && Math.abs(dy) > Math.abs(dx)) {
            dragging = false; return; // 触屏纵向滑动交给页面
          }
          if (!dragMoved && Math.abs(dx) < 4) return; // 点击时的轻微抖动不算拖拽
          dragMoved = true;
          var step = dx - (prevX - startX);
          rows.forEach(function (o, i) { o.offset = startOffsets[i] + dx * opt.dragSensitivity; });
          lastStep = step * opt.dragSensitivity; // 释放后惯性
          prevX = e.clientX;
          if (e.cancelable) e.preventDefault();
        }
      }, { passive: false });

      stage.addEventListener('pointerdown', function (e) {
        if (e.button && e.button !== 0) return;
        dragging = true; dragMoved = false; lastStep = 0;
        pressTile = e.target && e.target.closest ? e.target.closest('.rg-tile') : null;
        startX = e.clientX; prevX = e.clientX;
        var rect = stage.getBoundingClientRect(); prevY = e.clientY - rect.top;
        startOffsets = rows.map(function (o) { return o.offset; });
        focusOn = true;
      });
      window.addEventListener('pointerup', function () {
        if (!dragging) return;
        dragging = false;
        if (dragMoved) {
          rows.forEach(function (o) { o.vel = lastStep; });
          wake();
        } else if (pressTile && window.Lightbox) {
          /* 未拖拽 = 点击瓦片，打开全站共用的放大观看层 */
          window.Lightbox.open(items.map(function (it, k) {
            return {
              src: it.src, viewer: it.src,
              title: it.alt || '', alt: it.alt || '',
              no: '风景 ' + String(k + 1).padStart(2, '0')
            };
          }), Math.max(0, Number(pressTile.dataset.i) || 0));
        }
        pressTile = null;
      });
      stage.addEventListener('pointerleave', function () { focusOn = false; });

      stage.addEventListener('wheel', function (e) {
        var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
        if (!d) return;
        e.preventDefault();
        rows.forEach(function (o) { o.offset += d * opt.wheelSensitivity; o.vel = 0; });
        wake();
      }, { passive: false });
    }

    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        visible = entries.some(function (en) { return en.isIntersecting; });
        if (visible) { last = 0; wake(); } else { raf = 0; }
      }, { threshold: 0.05 });
      io.observe(stage);
    }

    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(relayout);
      ro.observe(stage);
    } else {
      window.addEventListener('resize', relayout, { passive: true });
    }
    window.addEventListener('load', relayout, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

    relayout();
    wake();
    return { relayout: relayout };
  }

  window.ReelGallery = { init: init };
})();

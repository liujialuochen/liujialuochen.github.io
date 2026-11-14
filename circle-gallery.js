/* ===========================================================
   Circle Gallery · 收尾板块照片圆环（React Bits Pro 规格的原生等价实现）
   -----------------------------------------------------------
   官方规格：A draggable circle of images that spins with inertia
   https://pro.reactbits.dev/docs/components/circle-gallery
   本站为零依赖静态站（无 React / 构建链 / Pro 授权），因此按官方
   props 表做等价实现，并把配色对齐米白 × 藏蓝、编号用衬线小字。

   props: radiusPercent 38(10-50) / itemWidth 280 / itemHeight 400 /
          itemScale .85 / borderRadius 8 / enableDrag true /
          throwResistance .35 / animationDuration .9 / showNumbers true /
          autoSpin 0(可调 5°/s) / className / itemClassName / onItemClick
   差异：radiusPercent 由「视口百分比」改为「容器短边百分比」，
         便于把照片集缩小后放进左栏；新增 keepUpright（卡片保持水平）。
   =========================================================== */
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  function init(root, items, options) {
    if (!root || !Array.isArray(items) || !items.length) return null;

    var opt = Object.assign({
      radiusPercent: 34,        // 圆环半径占容器短边百分比（官方默认 38）
      itemWidth: 112,           // 缩小后放进左栏
      itemHeight: 148,
      itemScale: 0.92,
      borderRadius: 8,
      enableDrag: true,
      throwResistance: 0.35,    // 越小动量越大
      animationDuration: 0.9,   // 依次弹入时长（秒）
      animationStagger: 0.075,
      showNumbers: true,
      autoSpin: 5,              // deg/s，0 = 关闭
      pauseOnHover: true,       // 指针悬停时暂停自转，便于点击放大
      keepUpright: true,        // 卡片保持水平（关闭则沿圆环放射状倾斜）
      className: '',
      itemClassName: '',
      onItemClick: null
    }, options || {});

    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var N = items.length;
    var step = 360 / N;

    root.classList.add('cgr');
    if (opt.className) root.classList.add(opt.className);
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', '照片圆环，可拖拽旋转、点击照片放大观看');

    root.innerHTML =
      '<div class="cgr-orbit" aria-hidden="true"></div>' +
      '<div class="cgr-hub"><span class="serif">08</span><span class="eyebrow">FRAMES</span></div>' +
      items.map(function (it, i) {
        return '<div class="cgr-item' + (opt.itemClassName ? ' ' + esc(opt.itemClassName) : '') + '"' +
          ' data-i="' + i + '" tabindex="0" role="button"' +
          ' aria-label="查看 ' + esc(it.title || ('照片 ' + (i + 1))) + '">' +
          (opt.showNumbers ? '<span class="cgr-no eyebrow">' + String(i + 1).padStart(3, '0') + '</span>' : '') +
          '<img src="' + esc(it.src) + '" alt="' + esc(it.alt || it.title || '') + '" ' +
            'loading="lazy" decoding="async" draggable="false">' +
          (it.title ? '<span class="cgr-cap eyebrow">' + esc(it.title) + '</span>' : '') +
        '</div>';
      }).join('') +
      '<div class="cgr-ui eyebrow">拖拽旋转 · 点击照片放大观看</div>';

    /* 放大层统一挂到 document.body（lightbox.js），避免父级 transform / perspective
       让 position:fixed 偏移；也避免 setPointerCapture 把 click 重定向到根节点。 */
    var nodeList = Array.prototype.slice.call(root.querySelectorAll('.cgr-item'));
    var orbit = root.querySelector('.cgr-orbit');

    var R = 120;
    var angle = 0;              // 当前圆环角度（deg）
    var velocity = 0;           // 惯性角速度（deg/s）
    var dragging = false, lastA = 0, lastT = 0, moved = 0;
    var pressTile = null, hovering = false;
    var born = 0, raf = 0, last = 0, visible = true;

    /* 半径按容器短边百分比换算；卡片尺寸同步写入 CSS 变量 */
    function layout() {
      var w = root.clientWidth || 360;
      var h = root.clientHeight || w;
      var short = Math.min(w, h);
      R = short * clamp(opt.radiusPercent, 10, 50) / 100;
      var iw = opt.itemWidth, ih = opt.itemHeight;
      /* 卡片不得大过圆环可容纳的宽度，否则窄屏会互相压死 */
      var maxW = Math.max(56, (2 * Math.PI * R / N) * 1.05);
      if (iw > maxW) { ih = ih * (maxW / iw); iw = maxW; }
      root.style.setProperty('--cgr-w', iw.toFixed(1) + 'px');
      root.style.setProperty('--cgr-h', ih.toFixed(1) + 'px');
      root.style.setProperty('--cgr-radius', opt.borderRadius + 'px');
      orbit.style.width = orbit.style.height = (R * 2).toFixed(1) + 'px';
      wake();
    }

    /* 每帧把 N 张卡片摆到圆周上；卡片水平朝向，整体角度随拖拽/惯性变化 */
    function paint(now) {
      var t = born ? (now - born) / 1000 : 99;
      nodeList.forEach(function (el, i) {
        var deg = i * step + angle;
        var rad = deg * Math.PI / 180;
        var x = Math.sin(rad) * R;
        var y = -Math.cos(rad) * R;
        /* 入场：依次弹入（带轻微回弹），与官方 animationDuration 对应 */
        var p = reduce ? 1 : clamp((t - i * opt.animationStagger) / Math.max(0.01, opt.animationDuration), 0, 1);
        var ease = 1 - Math.pow(1 - p, 3) + Math.sin(p * Math.PI) * 0.10;
        /* 顶端略大、底端略小，制造平面圆环的层次 */
        var depth = 0.94 + 0.06 * ((Math.cos(rad) + 1) / 2);
        var scale = opt.itemScale * depth * ease;
        el.style.transform =
          'translate(-50%,-50%) translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) ' +
          'rotate(' + (opt.keepUpright ? 0 : deg).toFixed(2) + 'deg) scale(' + Math.max(0, scale).toFixed(4) + ')';
        el.style.opacity = (0.15 + 0.85 * p).toFixed(3);
        el.style.zIndex = String(Math.round(((Math.cos(rad) + 1) / 2) * 100));
      });
    }

    function frame(now) {
      raf = 0;
      if (!alive) return;
      if (last === 0) last = now;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!born) born = now;

      if (!dragging && !reduce) {
        var spin = (hovering && opt.pauseOnHover) ? 0 : opt.autoSpin;
        angle += (spin + velocity) * dt;
        velocity *= Math.exp(-dt * (1.6 + clamp(opt.throwResistance, 0, 1) * 7));
        if (Math.abs(velocity) < 0.06) velocity = 0;
      }
      paint(now);
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function wake() {
      if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); }
    }
    function sleep() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    var alive = true;

    /* 按「绕圆心的角度」拖拽，比横向位移更符合圆环手感 */
    function pointerAngle(e) {
      var r = root.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    }
    root.addEventListener('pointerdown', function (e) {
      /* setPointerCapture 之后的 click 会被重定向到 root，卡片自己的 click
         监听收不到。这里先记下按下的卡片，抬起时直接判定是否要看大图。 */
      pressTile = e.target && e.target.closest ? e.target.closest('.cgr-item') : null;
      moved = 0;
      if (!opt.enableDrag) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      dragging = true; velocity = 0;
      lastA = pointerAngle(e); lastT = e.timeStamp || performance.now();
      root.classList.add('is-dragging');
      try { root.setPointerCapture(e.pointerId); } catch (x) {}
      wake();
    });
    root.addEventListener('pointerenter', function () { hovering = true; });
    root.addEventListener('pointerleave', function () { hovering = false; });
    root.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var a = pointerAngle(e);
      var d = a - lastA;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      var now = e.timeStamp || performance.now();
      var dt = Math.max(0.008, (now - lastT) / 1000);
      angle += d;
      velocity = velocity * 0.55 + clamp(d / dt, -720, 720) * 0.45;
      moved += Math.abs(d);
      lastA = a; lastT = now;
      wake();
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      root.classList.remove('is-dragging');
      try { root.releasePointerCapture(e.pointerId); } catch (x) {}
      wake();
    }
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);
    root.addEventListener('pointerup', function () {
      var t = pressTile; pressTile = null;
      if (!t || moved > 5) return;   // 拖拽过就不算点击
      openTile(Number(t.dataset.i));
    });

    /* 点击 / 键盘打开全站共用的放大观看层（可左右翻阅） */
    function openTile(i) {
      var it = items[i]; if (!it) return;
      if (typeof opt.onItemClick === 'function') { opt.onItemClick(i, it.src); return; }
      if (!window.Lightbox) return;
      window.Lightbox.open(items.map(function (x, k) {
        return {
          src: x.src, viewer: x.src,
          title: x.title || x.alt || '', alt: x.alt || '',
          no: 'FRAME ' + String(k + 1).padStart(3, '0')
        };
      }), i);
    }
    function closeLb() { if (window.Lightbox) window.Lightbox.close(); }
    nodeList.forEach(function (n) {
      n.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTile(Number(n.dataset.i)); }
      });
    });

    /* 键盘方向键 / 滚轮微调 */
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { angle += step; e.preventDefault(); wake(); }
      else if (e.key === 'ArrowLeft') { angle -= step; e.preventDefault(); wake(); }
    });
    root.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      angle += clamp(e.deltaY, -60, 60) * 0.12;
      wake();
    }, { passive: true });

    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(root);
    window.addEventListener('resize', layout, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = !!(es[0] && es[0].isIntersecting);
        if (visible) wake(); else sleep();
      }, { rootMargin: '120px' }).observe(root);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) sleep(); else wake(); });

    layout();
    wake();

    return {
      layout: layout,
      spinTo: function (deg) { angle = deg; wake(); },
      open: openTile,
      close: closeLb,
      destroy: function () { alive = false; sleep(); }
    };
  }

  window.CircleGallery = { init: init };
})();

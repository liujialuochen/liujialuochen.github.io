/* ===========================================================
   DepthCarousel · 3D 纵深叠卡轮播（零依赖原生实现）
   -----------------------------------------------------------
   移植自用户第 27 轮提供的 React DepthCarousel + DepthCarousel.css：
     · layout() 按 d = i - pos 计算 translateZ / translateX / rotateY /
       opacity / brightness / zIndex，形成往右后方退去的纵深卡片堆叠
     · 拖拽（指针速度投影惯性）+ 滚轮 + 方向键 + 左右箭头 + 圆点
     · gsap 的 power3.out 用 rAF + 1-(1-t)^3 等价实现
     · ResizeObserver 按容器宽度整体缩放，loop 循环，autoplay 可开
   按站点一贯要求做的适配（前几轮用户明确要求「封面完整清晰、不要模糊、不裁切」）：
     · blur 固定 0，不写任何 CSS filter: blur()
     · 官方黑色 multiply tint 不启用，falloff 降到 .055 / 亮度下限 .88
     · 图片 object-fit:contain —— 11 张封面 / 笔记正文全部完整直出
     · 说明面板保留「编号 / 主题眉标 / 标题 / 描述 / 页面浏览量」，
       标题保持原样，描述可随时替换；箭头和圆点移到面板区，不压住卡片
     · 悬停封面轻微放大 1.045 倍；点击后方卡对焦，点击当前卡 / 放大按钮
       打开全站共用观图层
   =========================================================== */
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var normalize = function (it) { return typeof it === 'string' ? { image: it } : (it || {}); };

  function init(root, items, options) {
    if (!root || !Array.isArray(items) || !items.length) return null;

    var opt = Object.assign({
      cardWidth: 300,
      cardHeight: 400,
      radius: 14,
      depth: 220,
      spread: 90,
      tilt: 22,
      tiltDirection: 'right',
      perspective: 1400,
      visibleCards: 4,
      falloff: 0.055,           // 官方 .2 太暗，这里保证后方卡仍清晰
      duration: 700,
      autoplay: false,
      autoplayDelay: 3200,
      loop: true,
      showControls: true,
      showIndicators: true,
      labelPrefix: 'VIRAL',
      hint: '拖拽 / 左右滑动浏览 · 悬停封面轻微放大 · 点击放大看原图',
      className: '',
      onChange: null
    }, options || {});

    var data = items.map(normalize);
    var n = data.length;
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var pos = 0, focus = 0, scale = 1, cfg = {};
    var tween = 0, drag = null, wheelTimer = 0, autoTimer = 0;
    var hovered = false, focused = false, alive = true;

    root.classList.add('depth-carousel');
    if (opt.className) root.classList.add(opt.className);
    root.setAttribute('role', 'group');
    root.setAttribute('aria-roledescription', 'carousel');
    root.setAttribute('aria-label', '爆款封面与文案 3D 纵深轮播，可拖拽、用方向键或箭头切换，点击卡片放大');
    root.tabIndex = 0;

    root.innerHTML =
      '<div class="dc-stage" style="perspective:' + opt.perspective + 'px">' +
        data.map(function (it, i) {
          return '<div class="dc-card" data-i="' + i + '" role="button" tabindex="-1"' +
            ' aria-label="第 ' + (i + 1) + ' 篇 / 共 ' + n + ' 篇"' +
            ' style="width:' + opt.cardWidth + 'px;height:' + opt.cardHeight + 'px;' +
            'border-radius:' + opt.radius + 'px">' +
            '<img class="dc-img" src="' + esc(it.image || it.src || '') + '" alt="' +
              esc(it.alt || it.title || '') + '" draggable="false" decoding="async" ' +
              'loading="lazy">' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div class="dc-panel">' +
        '<div class="dc-panel-main">' +
          '<span class="dc-no eyebrow"></span>' +
          '<span class="dc-topic eyebrow"></span>' +
          '<h3 class="dc-title serif"></h3>' +
          '<p class="dc-note"></p>' +
          '<span class="dc-metric eyebrow"></span>' +
        '</div>' +
        '<div class="dc-panel-side">' +
          (opt.showControls && n > 1 ?
            '<div class="dc-arrows">' +
              '<button class="dc-arrow dc-arrow--prev" type="button" aria-label="上一篇">' +
                '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" ' +
                'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '<span>PREV</span></button>' +
              '<button class="dc-arrow dc-arrow--next" type="button" aria-label="下一篇">' +
                '<span>NEXT</span>' +
                '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5l7 7-7 7" ' +
                'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
            '</div>' : '') +
          (opt.showIndicators && n > 1 ?
            '<div class="dc-dots" role="tablist" aria-label="选择爆款">' +
              data.map(function (_, i) {
                return '<button class="dc-dot' + (i === 0 ? ' is-active' : '') + '" type="button" role="tab"' +
                  ' data-i="' + i + '" aria-label="第 ' + (i + 1) + ' 篇"' +
                  ' aria-selected="' + (i === 0) + '"></button>';
              }).join('') +
            '</div>' : '') +
          '<button class="dc-zoom eyebrow" type="button">放大查看 ↗</button>' +
          '<span class="dc-hint eyebrow"></span>' +
        '</div>' +
      '</div>';

    var stageEl = root.querySelector('.dc-stage');
    var cardEls = Array.prototype.slice.call(root.querySelectorAll('.dc-card'));
    var dotEls = Array.prototype.slice.call(root.querySelectorAll('.dc-dot'));
    var noEl = root.querySelector('.dc-no');
    var topicEl = root.querySelector('.dc-topic');
    var titleEl = root.querySelector('.dc-title');
    var noteEl = root.querySelector('.dc-note');
    var metricEl = root.querySelector('.dc-metric');
    root.querySelector('.dc-hint').textContent = opt.hint;

    function refreshCfg() {
      var w = root.clientWidth || 600;
      var narrow = w < 620;
      cfg = {
        count: n,
        depth: narrow ? opt.depth * 0.68 : opt.depth,
        spread: narrow ? clamp(w * 0.115, 26, 56) : opt.spread,
        tilt: opt.tilt,
        dir: opt.tiltDirection === 'left' ? -1 : 1,
        visibleCards: narrow ? 2 : opt.visibleCards,
        falloff: opt.falloff,
        loop: opt.loop,
        cardWidth: opt.cardWidth,
        duration: opt.duration
      };
      /* 纵深是往右后方退去，左侧不占额外宽度：窄屏按卡片 + 一侧展开量算，
         避免把主卡缩得过小；桌面仍留足两侧余量。 */
      var needed = opt.cardWidth + Math.abs(cfg.spread) * (narrow ? 1.4 : 2) + (narrow ? 24 : 120);
      scale = clamp(w / needed, 0.42, 1);
      /* 再按舞台高度兜一次底，避免卡片上下越界 */
      var stageH = stageEl.clientHeight || 480;
      scale = Math.min(scale, clamp((stageH - 16) / opt.cardHeight, 0.42, 1.05));
    }

    function layout(p) {
      var c = cfg;
      for (var i = 0; i < c.count; i++) {
        var el = cardEls[i];
        if (!el) continue;
        var d = i - p;
        if (c.loop && c.count > 1) {
          d = ((d % c.count) + c.count) % c.count;
          if (d > c.count / 2) d -= c.count;
        }
        var back = Math.max(0, d);
        var az = Math.abs(d);
        var shown = az <= c.visibleCards + 0.5;
        var tz = -c.depth * d;
        var tx = c.dir * c.spread * d;
        var ry = c.dir * c.tilt * clamp(d, 0, 1);
        var opacity = d < 0 ? Math.max(0, 1 + d) : 1;
        if (!shown) opacity = 0;
        /* 只调亮度，完全不做模糊、不叠黑色 tint —— 封面始终清晰 */
        var brightness = Math.max(0.88, 1 - back * c.falloff);
        var zi = Math.round(2000 - d * 20);

        el.style.transform = 'translate(-50%, -50%) scale(' + scale.toFixed(3) + ') ' +
          'translateX(' + tx.toFixed(2) + 'px) translateZ(' + tz.toFixed(2) + 'px) ' +
          'rotateY(' + ry.toFixed(3) + 'deg)';
        el.style.opacity = opacity.toFixed(3);
        el.style.filter = 'brightness(' + brightness.toFixed(3) + ')';
        el.style.zIndex = String(zi);
        el.style.pointerEvents = shown && opacity > 0.05 ? 'auto' : 'none';
        el.setAttribute('aria-hidden', shown ? 'false' : 'true');
      }
    }

    function notify(idx) {
      focus = ((idx % n) + n) % n;
      var it = data[focus] || {};
      noEl.textContent = opt.labelPrefix + ' ' + String(focus + 1).padStart(2, '0') +
        ' / ' + String(n).padStart(2, '0') + (it.kind ? ' · ' + it.kind : '');
      topicEl.textContent = it.topic || '';
      topicEl.hidden = !it.topic;
      titleEl.textContent = it.title || it.text || it.alt || '';
      noteEl.textContent = it.note || it.description || '';
      noteEl.hidden = !noteEl.textContent;
      metricEl.textContent = it.metric || '';
      metricEl.hidden = !it.metric;
      dotEls.forEach(function (d, i) {
        d.classList.toggle('is-active', i === focus);
        d.setAttribute('aria-selected', i === focus ? 'true' : 'false');
      });
      cardEls.forEach(function (el, i) { el.tabIndex = i === focus ? 0 : -1; });
      if (typeof opt.onChange === 'function') opt.onChange(focus, it);
    }

    function tweenTo(target, animate) {
      if (tween) { cancelAnimationFrame(tween); tween = 0; }
      var from = pos, delta = target - from;
      var dur = animate && !reduce ? Math.max(0, cfg.duration || 700) : 0;
      if (dur <= 0 || Math.abs(delta) < 0.0001) {
        pos = target; layout(pos); wrap(); return;
      }
      var t0 = performance.now();
      function frame(now) {
        tween = 0;
        if (!alive) return;
        var t = clamp((now - t0) / dur, 0, 1);
        var e = 1 - Math.pow(1 - t, 3);      // power3.out
        pos = from + delta * e;
        layout(pos);
        if (t < 1) tween = requestAnimationFrame(frame);
        else wrap();
      }
      tween = requestAnimationFrame(frame);
    }
    function wrap() {
      if (n > 0) pos = ((pos % n) + n) % n;
      layout(pos);
    }

    function setFocus(rawIndex, animate) {
      if (!n) return;
      var idx = cfg.loop ? ((rawIndex % n) + n) % n : clamp(rawIndex, 0, n - 1);
      var delta = idx - pos;
      if (cfg.loop && n > 1) {
        delta = ((delta % n) + n) % n;
        if (delta > n / 2) delta -= n;
      }
      tweenTo(pos + delta, animate !== false);
      if (idx !== focus) notify(idx);
    }
    function navigateBy(step) { setFocus(focus + step, true); }

    /* ---------- 放大观看：全站共用观图层 ---------- */
    function openViewer(i) {
      if (!window.Lightbox) return;
      window.Lightbox.open(data.map(function (it, k) {
        return {
          src: it.image || it.src || '',
          viewer: it.viewer || it.image || it.src || '',
          title: it.title || it.text || it.alt || '',
          alt: it.alt || it.title || '',
          no: opt.labelPrefix + ' ' + String(k + 1).padStart(2, '0')
        };
      }), i, { onChange: function (idx) { setFocus(idx, true); } });
    }

    /* ---------- 拖拽 + 惯性 ---------- */
    root.addEventListener('pointerdown', function (e) {
      if (n < 2) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target && e.target.closest && e.target.closest('button')) return;
      if (tween) { cancelAnimationFrame(tween); tween = 0; }
      drag = {
        x: e.clientX, y: e.clientY, startPos: pos,
        lastX: e.clientX, lastT: performance.now(), v: 0,
        moved: false, id: e.pointerId,
        card: e.target && e.target.closest ? e.target.closest('.dc-card') : null
      };
    });
    root.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var stepPx = Math.max(cfg.cardWidth * 0.55 * scale, 40);
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 4) {
        drag.moved = true;
        try { root.setPointerCapture(drag.id); } catch (x) {}
        root.classList.add('is-dragging');
      }
      if (!drag.moved) return;
      var now = performance.now();
      var dt = Math.max(now - drag.lastT, 1);
      drag.v = (e.clientX - drag.lastX) / dt;
      drag.lastX = e.clientX; drag.lastT = now;
      pos = drag.startPos - dx / stepPx;
      layout(pos);
    });
    function endDrag() {
      if (!drag) return;
      var d = drag; drag = null;
      root.classList.remove('is-dragging');
      try { root.releasePointerCapture(d.id); } catch (x) {}
      if (!d.moved) {
        /* 未拖拽 = 点击：正面卡放大，后方卡对焦 */
        var i = d.card ? Number(d.card.dataset.i) : -1;
        if (i >= 0) {
          if (i === focus) openViewer(i);
          else setFocus(i, true);
        }
        return;
      }
      var stepPx = Math.max(cfg.cardWidth * 0.55 * scale, 40);
      var projected = pos - (d.v * 180) / stepPx;
      setFocus(Math.round(projected), true);
    }
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);

    /* ---------- 滚轮：只接管横向手势，纵向留给页面 ---------- */
    root.addEventListener('wheel', function (e) {
      if (n < 2) return;
      var dx = Math.abs(e.deltaX), dy = Math.abs(e.deltaY);
      if (dx <= dy || dx < 2) return;
      e.preventDefault();
      if (tween) { cancelAnimationFrame(tween); tween = 0; }
      var step = clamp(e.deltaX / (cfg.cardWidth * 0.9), -0.6, 0.6);
      pos += step; layout(pos);
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function () { setFocus(Math.round(pos), true); }, 130);
    }, { passive: false });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigateBy(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navigateBy(1); }
      else if (e.key === 'Enter' || e.key === ' ') {
        var t = e.target && e.target.closest ? e.target.closest('.dc-card') : null;
        if (t) { e.preventDefault(); openViewer(Number(t.dataset.i)); }
        else if (e.target === root) { e.preventDefault(); openViewer(focus); }
      }
    });

    if (opt.showControls && n > 1) {
      root.querySelector('.dc-arrow--prev').addEventListener('click', function () { navigateBy(-1); });
      root.querySelector('.dc-arrow--next').addEventListener('click', function () { navigateBy(1); });
    }
    dotEls.forEach(function (d) {
      d.addEventListener('click', function () { setFocus(Number(d.dataset.i), true); });
    });
    root.querySelector('.dc-zoom').addEventListener('click', function () { openViewer(focus); });

    root.addEventListener('mouseenter', function () { hovered = true; });
    root.addEventListener('mouseleave', function () { hovered = false; });
    root.addEventListener('focusin', function () { focused = true; });
    root.addEventListener('focusout', function () { focused = false; });

    function measure() { refreshCfg(); layout(pos); }
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(root);
    window.addEventListener('resize', measure, { passive: true });

    if (opt.autoplay && !reduce && n > 1) {
      autoTimer = window.setInterval(function () {
        if (!hovered && !focused) navigateBy(1);
      }, Math.max(opt.autoplayDelay, 600));
    }

    refreshCfg();
    layout(pos);
    notify(0);

    return {
      setFocus: setFocus,
      next: function () { navigateBy(1); },
      prev: function () { navigateBy(-1); },
      destroy: function () {
        alive = false;
        if (tween) cancelAnimationFrame(tween);
        if (wheelTimer) clearTimeout(wheelTimer);
        if (autoTimer) clearInterval(autoTimer);
      }
    };
  }

  window.DepthCarousel = { init: init };
})();

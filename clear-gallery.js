/* ===========================================================
   ClearArcGallery · 02 新媒体增长矩阵「内容切片」
   -----------------------------------------------------------
   第 26 轮：用户截图里聚焦态只剩一块灰色模糊阴影占位 —— 根因是
   WebGL 纹理未就绪时 uReady=0，卡片只以 8% 透明度画米白底，
   柔和阴影反而成了主体。这里彻底去掉 WebGL / shader / 阴影占位 /
   入场淡入，改用真实 <img> 直出的 DOM 弧形画廊：
     · 每张卡片 contain 完整呈现截图全貌（含底部数据），不裁切
     · 无 filter、无 blur、无 grayscale、无半透明磨砂
     · 保留弧线排布、左右拖拽 / 箭头 / 方向键 / 点击放大
   对外仍暴露 window.CircularGallery.init，main.js 无需改造。
   =========================================================== */
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var wrap = function (v, n) { return ((v % n) + n) % n; };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  function normalize(item) {
    if (typeof item === 'string') return { image: item, viewer: item, text: '', description: '', alt: '' };
    return {
      image: item.image || item.src || '',
      viewer: item.viewer || item.image || item.src || '',
      text: item.text || '',
      description: item.description || item.label || item.alt || '',
      alt: item.alt || item.text || ''
    };
  }

  function init(root, items, options) {
    if (!root || !Array.isArray(items) || !items.length) return null;
    var list = items.map(normalize);
    var n = list.length;
    var opt = Object.assign({
      labelPrefix: 'SLICE',
      hint: '拖拽 / ← → 切换 · 悬停轻微抬起 · 点击放大查看原图',
      ariaLabel: '内容切片清晰弧形画廊，可拖拽或用方向键切换，点击卡片放大查看完整截图'
    }, options || {});
    var pad = function (i) { return String(i + 1).padStart(2, '0'); };

    root.classList.remove('cgv2');
    root.classList.add('cag');
    root.innerHTML =
      '<div class="cag-stage" tabindex="0" role="region" aria-roledescription="carousel" ' +
           'aria-label="' + esc(opt.ariaLabel) + '">' +
        '<div class="cag-track">' +
          list.map(function (it, i) {
            return '<button class="cag-card" type="button" data-index="' + i + '" ' +
              'aria-label="放大查看 ' + esc(it.description || it.text) + '">' +
              '<span class="cag-media">' +
                '<img src="' + esc(it.image) + '" alt="' + esc(it.alt) + '" ' +
                  'loading="lazy" decoding="async" draggable="false">' +
              '</span>' +
              '<span class="cag-meta">' +
                '<span class="cag-no eyebrow">' + esc(opt.labelPrefix) + ' ' + pad(i) + '</span>' +
                '<span class="cag-text serif">' + esc(it.text) + '</span>' +
              '</span>' +
            '</button>';
          }).join('') +
        '</div>' +
        '<button class="cag-arrow cag-arrow--prev" type="button" data-dir="-1" ' +
          'aria-label="上一张内容切片">← <span>PREV</span></button>' +
        '<button class="cag-arrow cag-arrow--next" type="button" data-dir="1" ' +
          'aria-label="下一张内容切片"><span>NEXT</span> →</button>' +
      '</div>' +
      '<div class="cag-ui">' +
        '<div class="cag-caption">' +
          '<span class="cag-cap-no eyebrow" data-cag-no></span>' +
          '<span class="cag-cap-desc" data-cag-desc></span>' +
        '</div>' +
        '<button class="cag-zoom" type="button" data-cag-zoom>放大查看原图 <span aria-hidden="true">↗</span></button>' +
        '<span class="cag-count eyebrow" data-cag-count></span>' +
        '<span class="cag-hint eyebrow">' + esc(opt.hint) + '</span>' +
      '</div>' +
      '<span class="sr-only" aria-live="polite" data-cag-live></span>';

    var stage = root.querySelector('.cag-stage');
    var cards = Array.prototype.slice.call(root.querySelectorAll('.cag-card'));
    var noEl = root.querySelector('[data-cag-no]');
    var descEl = root.querySelector('[data-cag-desc]');
    var countEl = root.querySelector('[data-cag-count]');
    var live = root.querySelector('[data-cag-live]');

    var active = 0, step = 260, drag = null, suppressClick = false;
    var lbItems = list.map(function (it, i) {
      return { src: it.image, viewer: it.viewer, title: it.description || it.text,
               alt: it.alt, no: opt.labelPrefix + ' ' + pad(i) };
    });
    var openViewer = function (i) { if (window.Lightbox) window.Lightbox.open(lbItems, i); };

    function shortest(i) {
      var d = i - active;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      return d;
    }
    function measure() {
      var w = cards[0] ? cards[0].getBoundingClientRect().width : 240;
      var stageW = stage.clientWidth || 900;
      step = (stageW < 620) ? stageW * 0.72 : clamp(w * 0.92, 168, 310);
    }
    function apply() {
      var frac = drag ? drag.dx / step : 0;
      cards.forEach(function (el, i) {
        var d = shortest(i) - frac;
        var a = Math.abs(d);
        var x = d * step;
        var scale = 1 - Math.min(a, 2.5) * 0.115;
        var ry = clamp(-d * 13, -22, 22);
        var op = a < 0.02 ? 1 : (a < 1 ? 1 - a * 0.12 :
          (a < 2 ? 0.88 - (a - 1) * 0.88 : 0));
        el.style.transform = 'translate3d(calc(-50% + ' + x.toFixed(1) + 'px),-50%,0) ' +
          'rotateY(' + ry.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')';
        el.style.opacity = String(clamp(op, 0, 1));
        el.style.zIndex = String(100 - Math.round(a * 10));
        el.style.pointerEvents = op > 0.2 ? 'auto' : 'none';
        var isActive = shortest(i) === 0 && !drag;
        el.classList.toggle('is-active', isActive);
        el.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });
      var it = list[active];
      noEl.textContent = opt.labelPrefix + ' ' + pad(active);
      descEl.textContent = it.description;
      countEl.textContent = pad(active) + ' / ' + pad(n - 1);
    }
    function go(delta) {
      active = wrap(active + delta, n);
      apply();
      live.textContent = '第 ' + (active + 1) + ' 张，共 ' + n + ' 张：' + list[active].description;
    }

    root.querySelectorAll('.cag-arrow').forEach(function (b) {
      b.addEventListener('click', function () { go(Number(b.dataset.dir)); });
    });
    root.querySelector('[data-cag-zoom]').addEventListener('click', function () { openViewer(active); });
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openViewer(active); }
    });

    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('.cag-arrow')) return;
      drag = { id: e.pointerId, x0: e.clientX, dx: 0, moved: false };
      root.classList.add('is-dragging');
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x0;
      if (Math.abs(drag.dx) > 6) drag.moved = true;
      apply();
    }, { passive: true });
    window.addEventListener('pointerup', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = drag.dx, moved = drag.moved;
      drag = null;
      root.classList.remove('is-dragging');
      if (moved) {
        suppressClick = true;
        window.setTimeout(function () { suppressClick = false; }, 80);
        if (Math.abs(dx) > step * 0.18) {
          var steps = Math.max(1, Math.round(Math.abs(dx) / step));
          go(dx > 0 ? -steps : steps);
        } else apply();
      } else apply();
    });
    window.addEventListener('pointercancel', function () {
      drag = null;
      root.classList.remove('is-dragging');
      apply();
    });
    stage.addEventListener('click', function (e) {
      if (suppressClick) { suppressClick = false; return; }
      if (e.target.closest('.cag-arrow')) return;
      var card = e.target.closest('.cag-card');
      if (!card) return;
      var i = Number(card.dataset.index);
      var d = shortest(i);
      if (d === 0) openViewer(active); else go(d);
    });

    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { measure(); apply(); }).observe(stage);
    } else {
      window.addEventListener('resize', function () { measure(); apply(); });
    }
    measure();
    apply();
    return { go: go, open: openViewer, active: function () { return active; } };
  }

  window.CircularGallery = { init: init };
})();

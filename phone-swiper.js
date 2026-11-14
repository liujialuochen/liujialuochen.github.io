/* ===========================================================
   PhoneSwiper · 02 新媒体增长矩阵「爆款封面与文案」
   -----------------------------------------------------------
   零依赖原生 Swiper：一个精致的手机 UI 外框，屏幕里放用户提供的
   真实封面 / 文案截图（完整不裁切），可左右拖拽滑动、箭头、键盘、
   圆点跳转；悬停在封面上轻微放大；点击中间那篇进入全屏观图层。
   设计上刻意不做任何 blur / grayscale / 半透明磨砂，保证封面清晰。
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

  function init(root, items, options) {
    if (!root || !Array.isArray(items) || !items.length) return null;
    var list = items.map(function (it) {
      return {
        src: it.src || '',
        kind: it.kind || '封面',
        title: it.title || '',
        note: it.note || '',
        metric: it.metric || '',
        alt: it.alt || it.title || ''
      };
    });
    var n = list.length;
    var opt = Object.assign({
      labelPrefix: 'VIRAL',
      hint: '左右滑动 / 拖拽浏览 · 悬停封面轻微放大 · 点击放大看原文',
      ariaLabel: '爆款封面与文案手机轮播，可左右滑动浏览'
    }, options || {});

    var pad = function (i) { return String(i + 1).padStart(2, '0'); };
    var slideHTML = function (it, i) {
      return '<article class="psw-slide" data-index="' + i + '" aria-hidden="true">' +
        '<div class="psw-phone">' +
          '<span class="psw-side psw-side--a" aria-hidden="true"></span>' +
          '<span class="psw-side psw-side--b" aria-hidden="true"></span>' +
          '<span class="psw-side psw-side--c" aria-hidden="true"></span>' +
          '<div class="psw-screen">' +
            '<div class="psw-status" aria-hidden="true">' +
              '<span class="psw-time">9:41</span>' +
              '<span class="psw-island"></span>' +
              '<span class="psw-icons">▂▄▆ &nbsp;⌁</span>' +
            '</div>' +
            '<div class="psw-media">' +
              '<img src="' + esc(it.src) + '" alt="' + esc(it.alt) + '" ' +
                   'decoding="async" draggable="false">' +
            '</div>' +
            '<div class="psw-appbar">' +
              '<span class="psw-kind eyebrow">' + esc(it.kind) + ' / ' + pad(i) + '</span>' +
              '<span class="psw-open">放大看原图 <span aria-hidden="true">↗</span></span>' +
            '</div>' +
            '<span class="psw-home" aria-hidden="true"></span>' +
          '</div>' +
        '</div>' +
      '</article>';
    };

    root.classList.add('psw');
    root.innerHTML =
      '<div class="psw-stage" tabindex="0" role="region" aria-roledescription="carousel" ' +
           'aria-label="' + esc(opt.ariaLabel) + '">' +
        '<div class="psw-track">' + list.map(slideHTML).join('') + '</div>' +
      '</div>' +
      '<div class="psw-panel">' +
        '<div class="psw-info">' +
          '<span class="psw-no eyebrow">' + esc(opt.labelPrefix) + ' <b data-psw-no>01</b> / ' + pad(n - 1) + '</span>' +
          '<h3 class="psw-title serif" data-psw-title></h3>' +
          '<p class="psw-note" data-psw-note></p>' +
          '<span class="psw-metric eyebrow" data-psw-metric></span>' +
        '</div>' +
        '<div class="psw-controls">' +
          '<div class="psw-nav">' +
            '<button class="psw-arrow psw-arrow--prev" type="button" data-dir="-1" ' +
              'aria-label="上一篇爆款">← <span>PREV</span></button>' +
            '<button class="psw-arrow psw-arrow--next" type="button" data-dir="1" ' +
              'aria-label="下一篇爆款"><span>NEXT</span> →</button>' +
          '</div>' +
          '<div class="psw-dots" role="group" aria-label="选择爆款">' +
            list.map(function (it, i) {
              return '<button type="button" class="psw-dot" data-index="' + i + '" ' +
                'aria-label="第 ' + (i + 1) + ' 篇：' + esc(it.title) + '"></button>';
            }).join('') +
          '</div>' +
          '<span class="psw-hint eyebrow">' + esc(opt.hint) + '</span>' +
        '</div>' +
      '</div>' +
      '<span class="sr-only" aria-live="polite" data-psw-live></span>';

    var stage = root.querySelector('.psw-stage');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.psw-slide'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.psw-dot'));
    var noEl = root.querySelector('[data-psw-no]');
    var titleEl = root.querySelector('[data-psw-title]');
    var noteEl = root.querySelector('[data-psw-note]');
    var metricEl = root.querySelector('[data-psw-metric]');
    var live = root.querySelector('[data-psw-live]');
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var active = 0, step = 300, drag = null, suppressClick = false;

    var lbItems = list.map(function (it, i) {
      return { src: it.src, title: it.title, alt: it.alt, no: opt.labelPrefix + ' ' + pad(i) };
    });
    var openViewer = function (index) {
      if (window.Lightbox) window.Lightbox.open(lbItems, index);
    };

    function shortest(i) {
      var d = i - active;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      return d;
    }

    function measure() {
      var w = stage.clientWidth || root.clientWidth || 800;
      var phone = slides[0] ? slides[0].querySelector('.psw-phone').getBoundingClientRect().width : 280;
      step = (w < 620) ? w * 0.78 : clamp(phone * 1.02, 210, 320);
    }

    function apply() {
      var fraction = drag ? drag.dx / step : 0;
      var compact = (stage.clientWidth || 0) < 620;
      slides.forEach(function (el, i) {
        var d = shortest(i) - fraction;
        var a = Math.abs(d);
        var x = d * step;
        var ry = clamp(-d * 12, -20, 20);
        var scale = 1 - Math.min(a, 2.4) * 0.105;
        var op = a < 0.02 ? 1 : (a < 1 ? 1 - a * 0.12 :
          (a < 2 ? 0.88 - (a - 1) * 0.88 : 0));
        if (compact && a > 0.9) op = 0;
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
      noEl.textContent = pad(active);
      titleEl.textContent = it.title;
      noteEl.textContent = it.note;
      metricEl.textContent = it.metric;
      metricEl.hidden = !it.metric;
      dots.forEach(function (d, i) {
        d.classList.toggle('is-on', i === active);
        if (i === active) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    }

    function go(delta) {
      active = wrap(active + delta, n);
      apply();
      live.textContent = '第 ' + (active + 1) + ' 篇，共 ' + n + ' 篇：' + list[active].title;
    }

    root.querySelectorAll('.psw-arrow').forEach(function (b) {
      b.addEventListener('click', function () { go(Number(b.dataset.dir)); });
    });
    dots.forEach(function (d) {
      d.addEventListener('click', function () {
        active = Number(d.dataset.index);
        apply();
        live.textContent = '第 ' + (active + 1) + ' 篇：' + list[active].title;
      });
    });

    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openViewer(active); }
    });

    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('.psw-arrow')) return;
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, moved: false };
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
      var dx = drag.dx;
      var moved = drag.moved;
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
      if (e.target.closest('.psw-arrow')) return;
      var slide = e.target.closest('.psw-slide');
      if (!slide) return;
      var i = Number(slide.dataset.index);
      var d = shortest(i);
      if (d === 0) openViewer(active);
      else go(d);
    });

    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { measure(); apply(); }).observe(stage);
    } else {
      window.addEventListener('resize', function () { measure(); apply(); });
    }
    measure();
    apply();
    if (reduce) root.classList.add('is-reduced');

    return { go: go, open: openViewer, active: function () { return active; } };
  }

  window.PhoneSwiper = { init: init };
})();

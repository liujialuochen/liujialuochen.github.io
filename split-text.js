/* ===========================================================
   SplitText · 拆字入场 + 鼠标邻近放大（GSAP SplitText 规格的原生等价）
   -----------------------------------------------------------
   站点是零依赖静态站，没有 React / GSAP / ScrollTrigger，因此按用户给出的
   SplitText 组件规格用 DOM + rAF + IntersectionObserver 复刻：

     · tokenize：中文按字、英文/数字按词，空白原样保留
     · effect：pop / rise / wave / blur / fade / flip / skew，逐字 stagger
     · accentColor：入场时高亮回墨
     · hoverEffect='lift'：以鼠标为中心的高斯权重弹簧抬起
     · hoverEffect='wave'：进入时按距离延时给每个字一个速度 kick
     · STIFFNESS 180 / DAMPING 19 / KICK 0.024 的弹簧积分
     · mask：rise 用 clip-path 遮罩
     · prefers-reduced-motion：不拆字、不做动画，保留静态原文

   教育背景里的正文已由 ScrollReveal 拆成 .srev-word > .srev-piece：
   本组件把「放大」写在**外层** .srev-word / .stx-char 上，
   ScrollReveal 把 scrub 写在**内层** .srev-piece 上，两层互不覆盖。
   =========================================================== */
(function () {
  'use strict';

  /* 拆字入场兜底：不允许文字停在 opacity:0 等一个可能永远不触发的观察器 */
  var plays = [];
  function playAll() { plays.forEach(function (fn) { fn(); }); }
  document.addEventListener('fx:reveal-all', playAll);
  setTimeout(playAll, 1800);

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduce || !('requestAnimationFrame' in window)) {
    window.SplitTextFX = { init: function () {}, magnify: function () {} };
    return;
  }

  var STIFFNESS = 180, DAMPING = 19, KICK = 0.024;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var waveEase = function (t) { return 1 - Math.cos(t * Math.PI * 1.5) * Math.pow(1 - t, 1.2); };
  var LATIN = /[A-Za-z0-9%+.·\-—/:]/;

  function tokenize(text) {
    var out = [], buf = '', ch;
    for (var i = 0; i < text.length; i++) {
      ch = text[i];
      if (/\s/.test(ch)) {
        if (buf) { out.push({ type: 'word', value: buf }); buf = ''; }
        out.push({ type: 'space', value: ch });
      } else if (LATIN.test(ch)) {
        buf += ch;
      } else {
        if (buf) { out.push({ type: 'word', value: buf }); buf = ''; }
        out.push({ type: 'word', value: ch });
      }
    }
    if (buf) out.push({ type: 'word', value: buf });
    return out;
  }

  /* ---------- effect 的 from 状态 ---------- */
  function fromState(effect, em) {
    switch (effect) {
      case 'fade':  return { opacity: 0, transform: '', filter: '' };
      case 'blur':  return { opacity: 0, transform: '', filter: 'blur(' + (Math.round(em * 1.4) / 10) + 'px)' };
      case 'flip':  return { opacity: 0, transform: 'perspective(' + (em * 6) + 'px) rotateX(-90deg)', filter: '' };
      case 'pop':   return { opacity: 0, transform: 'scale(0)', filter: '' };
      case 'skew':  return { opacity: 0, transform: 'translateX(' + (-em * 0.4) + 'px) skewX(-24deg)', filter: '' };
      case 'wave':  return { opacity: 0, transform: 'translateY(' + (em * 0.45) + 'px)', filter: '' };
      case 'rise':
      default:      return { opacity: 0, transform: 'translateY(105%)', filter: '' };
    }
  }

  /* ---------- 拆字：把文本节点换成 .stx-char > .stx-inner ---------- */
  function splitElement(el, opts) {
    var original = el.textContent;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) {
      if (n.parentElement && n.parentElement.closest('.stx-sr')) continue;
      if (!/\S/.test(n.nodeValue)) continue;
      nodes.push(n);
    }
    var chars = [];
    nodes.forEach(function (node) {
      var host = node.parentElement;
      var display = host ? window.getComputedStyle(host).display : '';
      if (/flex|grid/.test(display)) {
        var wrap = document.createElement('span');
        wrap.className = 'stx-flexwrap';
        host.insertBefore(wrap, node);
        wrap.appendChild(node);
        node = wrap.firstChild;
      }
      var frag = document.createDocumentFragment();
      tokenize(node.nodeValue).forEach(function (t) {
        if (t.type === 'space') { frag.appendChild(document.createTextNode(t.value)); return; }
        var outer = document.createElement('span');
        outer.className = 'stx-char';
        var inner = document.createElement('span');
        inner.className = 'stx-inner';
        inner.textContent = t.value;
        inner.setAttribute('aria-hidden', 'true');
        outer.appendChild(inner);
        frag.appendChild(outer);
        chars.push(outer);
      });
      node.parentNode.replaceChild(frag, node);
    });
    if (!chars.length) return [];
    /* 无障碍：保留一份完整原文供读屏使用。
       若祖先已由 ScrollReveal 生成 .srev-sr 完整副本（教育背景就是这种情况），
       不再重复添加，否则读屏会把同一所学校名念两遍。 */
    if (opts.srOnly !== false && !el.closest('.srev-sr, [data-srev="on"]')) {
      var sr = document.createElement('span');
      sr.className = 'stx-sr sr-only';
      sr.textContent = original;
      el.appendChild(sr);
      el.setAttribute('aria-label', original);
    }
    return chars;
  }

  /* ---------- 弹簧邻近放大（可作用于已拆好的任意字节点） ---------- */
  function magnify(container, opts) {
    if (!container) return;
    opts = Object.assign({
      strength: 0.42,      // 最大放大倍率增量
      radius: 2.1,         // 影响半径 = 字高 × radius
      lift: 0.14,          // 抬起量 = 字高 × lift
      wave: true,
      selector: '.stx-char, .srev-word'
    }, opts || {});

    var nodes = Array.prototype.slice.call(container.querySelectorAll(opts.selector));
    if (!nodes.length) return;

    /* ScrollReveal 在 .srev-word 上写了 rise 遮罩（inset(-1em … -.15em)），
       字放大到 1.4 倍时会被下边缘裁掉。只在放大期间临时放宽遮罩，
       回弹结束立刻还原，滚动逐字揭示的效果不受影响。 */
    var WIDE_CLIP = 'inset(-1.6em -1.6em -1.6em -1.6em)';
    var states = nodes.map(function (node) {
      return { s: 1, y: 0, vs: 0, vy: 0, clip: node.style.clipPath || '', wide: false };
    });
    var centers = [], sizes = [], pointer = { x: 0, y: 0, inside: false };
    var raf = 0, last = 0, kicks = [];

    function measure() {
      var box = container.getBoundingClientRect();
      centers = nodes.map(function (node, i) {
        var r = node.getBoundingClientRect();
        sizes[i] = parseFloat(window.getComputedStyle(node).fontSize) || 16;
        return {
          x: r.left + r.width / 2 - box.left,
          y: r.top + r.height / 2 - box.top - states[i].y
        };
      });
    }

    function tick(now) {
      raf = 0;
      var dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
      last = now;
      var active = pointer.inside;

      for (var k = kicks.length - 1; k >= 0; k--) {
        if (now < kicks[k].at) continue;
        var st = states[kicks[k].index];
        if (st) st.vy -= kicks[k].velocity;
        kicks.splice(k, 1);
      }

      nodes.forEach(function (node, i) {
        var st = states[i], c = centers[i], em = sizes[i] || 16;
        var radius = em * opts.radius;
        var ts = 1, ty = 0;
        if (pointer.inside && c) {
          var dx = (c.x - pointer.x) / radius;
          var dy = (c.y - pointer.y) / (radius * 1.35);
          var w = Math.exp(-(dx * dx + dy * dy) * 0.5);
          ts = 1 + opts.strength * w;
          ty = -em * opts.lift * w;
        }
        st.vs += (STIFFNESS * (ts - st.s) - DAMPING * st.vs) * dt;
        st.s += st.vs * dt;
        st.vy += (STIFFNESS * (ty - st.y) - DAMPING * st.vy) * dt;
        st.y += st.vy * dt;
        if (Math.abs(ts - st.s) < 0.001 && Math.abs(ty - st.y) < 0.02 &&
            Math.abs(st.vs) < 0.002 && Math.abs(st.vy) < 0.05) {
          st.s = ts; st.y = ty; st.vs = 0; st.vy = 0;
        } else {
          active = true;
        }
        var moving = Math.abs(st.s - 1) > 0.001 || Math.abs(st.y) > 0.01;
        node.style.transform = moving
          ? 'translate3d(0,' + st.y.toFixed(2) + 'px,0) scale(' + st.s.toFixed(3) + ')'
          : '';
        if (st.clip) {
          if (moving && !st.wide) { node.style.clipPath = WIDE_CLIP; st.wide = true; }
          else if (!moving && st.wide) { node.style.clipPath = st.clip; st.wide = false; }
        }
      });
      if (active || kicks.length) raf = requestAnimationFrame(tick);
    }

    function wake() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function locate(e) {
      var box = container.getBoundingClientRect();
      pointer.x = e.clientX - box.left;
      pointer.y = e.clientY - box.top;
    }

    container.addEventListener('pointerenter', function (e) {
      locate(e);
      pointer.inside = true;
      if (!centers.length) measure();
      if (opts.wave) {
        var now = performance.now();
        var speed = 9 * (sizes[0] || 16);
        var velocity = ((sizes[0] || 16) * 0.16) / KICK;
        centers.forEach(function (c, index) {
          kicks.push({ index: index, velocity: velocity,
            at: now + (Math.abs(c.x - pointer.x) / speed) * 1000 });
        });
      }
      wake();
    });
    container.addEventListener('pointermove', function (e) {
      locate(e);
      pointer.inside = true;
      if (!centers.length) measure();
      wake();
    });
    container.addEventListener('pointerleave', function () {
      pointer.inside = false;
      wake();
    });

    /* 布局/字体变化后重新量一次中心 */
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { measure(); }).observe(container);
    }
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('scroll', function () { /* 中心为相对坐标，无需重算 */ }, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    setTimeout(measure, 80);
    measure();
  }

  /* ---------- 拆字入场 ---------- */
  function init(elements, opts) {
    opts = Object.assign({
      effect: 'pop', delay: 45, duration: 1.1, ease: 'cubic-bezier(.18,.9,.24,1)',
      threshold: 0.12, rootMargin: '-80px', accentColor: '', mask: false,
      staggerFrom: 'start', onComplete: null
    }, opts || {});
    var list = elements instanceof Element ? [elements] : Array.prototype.slice.call(elements || []);
    list.forEach(function (el) {
      var chars = splitElement(el, opts);
      if (!chars.length) return;
      var em = parseFloat(window.getComputedStyle(el).fontSize) || 16;
      var from = fromState(opts.effect, em);
      var ink = window.getComputedStyle(el).color;
      var order = opts.staggerFrom === 'end' ? chars.slice().reverse() : chars;

      chars.forEach(function (outer) {
        var inner = outer.firstChild;
        if (opts.mask || opts.effect === 'rise') {
          outer.style.clipPath = 'inset(-.35em -.35em -.12em -.35em)';
        }
        if (opts.effect === 'flip') inner.style.transformOrigin = '50% 100%';
        if (opts.effect === 'skew') inner.style.transformOrigin = '50% 100%';
        inner.style.transition = 'none';
        inner.style.opacity = '0';
        if (from.transform) inner.style.transform = from.transform;
        if (from.filter) inner.style.filter = from.filter;
        if (opts.accentColor) inner.style.color = opts.accentColor;
      });

      var played = false;
      function play() {
        if (played) return;
        played = true;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            order.forEach(function (outer, i) {
              var inner = outer.firstChild;
              var d = opts.effect === 'wave' ? waveEase(i / Math.max(1, order.length - 1)) : 1;
              inner.style.transition =
                'opacity ' + (opts.duration * d).toFixed(2) + 's ' + opts.ease + ',' +
                'transform ' + (opts.duration * d).toFixed(2) + 's ' + opts.ease + ',' +
                'filter ' + (opts.duration * d).toFixed(2) + 's ease-out,' +
                'color ' + (opts.duration * 0.7).toFixed(2) + 's ease-in-out';
              inner.style.transitionDelay = (i * opts.delay) + 'ms,' + (i * opts.delay) + 'ms,' +
                (i * opts.delay) + 'ms,' + (i * opts.delay + 180) + 'ms';
              inner.style.opacity = '1';
              inner.style.transform = 'none';
              inner.style.filter = 'none';
              if (opts.accentColor) inner.style.color = ink;
            });
            if (typeof opts.onComplete === 'function') {
              setTimeout(opts.onComplete, order.length * opts.delay + opts.duration * 1000);
            }
          });
        });
      }

      plays.push(play);
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          if (entries.some(function (e) { return e.isIntersecting; })) {
            io.disconnect();
            play();
          }
        }, { threshold: 0, rootMargin: '15% 0px 15% 0px' });
        io.observe(el);
      } else {
        play();
      }
    });
  }

  window.SplitTextFX = { init: init, magnify: magnify, playAll: playAll };
})();

/* ===========================================================
   ScrollReveal · 滚动逐字揭示（ReactBits ScrollReveal 规格的原生等价实现）
   -----------------------------------------------------------
   站点是零依赖静态站，没有 React / GSAP / ScrollTrigger，因此这里用
   IntersectionObserver + passive scroll + rAF 复刻相同的 scrub 语义：

   · splitBy chars：中文按字、英文/数字按词分组（"2024.09-2027.06" 不拆散）
   · masked rise：外层 .srev-word 用 clip-path 做遮罩，内层 translateY(100%) 升起
   · baseOpacity / blur / stagger / glow 高亮 / baseRotation 轻微回正
   · start「top bottom-=20%」→ end「bottom bottom」的滚动进度映射
   · prefers-reduced-motion 或不支持 rAF 时完全不拆字，保持静态原文

   用法：
     window.ScrollReveal.init(el, {
       effect:'rise', enableBlur:true, blurStrength:5, baseOpacity:.1,
       baseRotation:1.4, stagger:.04, highlightColor:'#1E305E'
     });
   =========================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fineRaf = 'requestAnimationFrame' in window;
  if (reduce || !fineRaf) return;

  var clamp01 = function (v) { return Math.min(1, Math.max(0, v)); };
  var smooth = function (v) { return v * v * (3 - 2 * v); };
  var easeOut = function (v) { return 1 - Math.pow(1 - v, 3); };
  var easeBack = function (v, overshoot) {
    var s = v - 1;
    return 1 + (overshoot + 1) * s * s * s + overshoot * s * s;
  };
  var glowAt = function (t) {
    if (t <= 0 || t >= 1) return 0;
    return t < 0.35 ? smooth(t / 0.35) : 1 - smooth((t - 0.35) / 0.65);
  };

  var SCRUB_SPAN = 0.5;
  var RISE_MASK = 'inset(-1em -1em -0.15em -1em)';

  /* 中文逐字、拉丁/数字连成一个词、空白原样保留 —— 中文没有空格，
     只按 /\s+/ 切词会导致整段变成一个 piece，看不出交错揭示。 */
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

  function paint(piece, t, look) {
    var reveal = t, fadeIn = t, motion = '';
    if (look.effect === 'rise') {
      reveal = easeOut(t);
      fadeIn = clamp01(reveal * 1.25);
      if (reveal < 1) {
        motion = look.masked
          ? 'translateY(' + ((1 - reveal) * 100).toFixed(2) + '%) translateY(' + ((1 - reveal) * 0.2).toFixed(3) + 'em)'
          : 'translateY(' + ((1 - reveal) * 0.8).toFixed(3) + 'em)';
      }
    } else if (look.effect === 'flip') {
      reveal = easeBack(t, 1.2);
      fadeIn = clamp01(t * 2);
      if (t < 1) motion = 'perspective(6em) rotateX(' + ((1 - reveal) * 90).toFixed(2) + 'deg)';
    } else if (look.effect === 'scale') {
      reveal = easeBack(t, 1.6);
      fadeIn = clamp01(t * 1.6);
      if (t < 1) motion = 'scale(' + (0.35 + 0.65 * reveal).toFixed(4) + ')';
    }
    if (look.highlightColor) fadeIn = Math.max(fadeIn, clamp01(t / 0.35));

    var settle = clamp01(reveal);
    var lift = look.offset * (1 - settle);
    piece.style.opacity = t >= 1 ? '' : (look.baseOpacity + (1 - look.baseOpacity) * fadeIn).toFixed(3);
    piece.style.transform = [lift ? 'translateY(' + lift.toFixed(2) + 'px)' : '', motion]
      .filter(Boolean).join(' ');
    piece.style.filter = look.blur && settle < 1
      ? 'blur(' + (look.blur * (1 - settle)).toFixed(2) + 'px)' : '';
    if (look.highlightColor) {
      var glow = glowAt(t);
      piece.style.color = glow > 0.002
        ? 'color-mix(in srgb, ' + look.highlightColor + ' ' + (glow * 100).toFixed(1) + '%, currentColor)'
        : '';
    }
  }

  var instances = [];
  var scheduled = false;

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      for (var i = 0; i < instances.length; i++) instances[i].render();
    });
  }

  function init(root, options) {
    if (!root || root.dataset.srev === 'on') return;
    var opt = options || {};
    var look = {
      effect: opt.effect || 'fade',
      masked: (opt.effect || 'fade') === 'rise',
      baseOpacity: typeof opt.baseOpacity === 'number' ? opt.baseOpacity : 0.1,
      blur: opt.enableBlur === false ? 0 : (typeof opt.blurStrength === 'number' ? opt.blurStrength : 4),
      offset: opt.baseOffset || 0,
      highlightColor: opt.highlightColor || ''
    };
    var gap = Math.max(0, typeof opt.stagger === 'number' ? opt.stagger : 0.05);
    var rotation = typeof opt.baseRotation === 'number' ? opt.baseRotation : 3;

    root.dataset.srev = 'on';

    /* 无障碍：拆字后逐字朗读会很难听，这里放一份完整原文的 sr-only 副本，
       再把原内容标为 aria-hidden，屏幕阅读器仍按整句读取。 */
    var full = root.textContent.replace(/\s+/g, ' ').trim();
    var sr = document.createElement('span');
    sr.className = 'sr-only srev-sr';
    sr.textContent = full;
    root.insertBefore(sr, root.firstChild);

    var children = Array.prototype.filter.call(root.children, function (el) { return el !== sr; });
    if (children.length) {
      children.forEach(function (el) { el.setAttribute('aria-hidden', 'true'); });
    } else {
      var wrapper = document.createElement('span');
      wrapper.className = 'srev-text';
      wrapper.setAttribute('aria-hidden', 'true');
      var node = sr.nextSibling;
      while (node) {
        var next = node.nextSibling;
        wrapper.appendChild(node);
        node = next;
      }
      root.appendChild(wrapper);
    }

    /* 收集并替换文本节点（跳过 sr-only 副本） */
    var texts = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var n;
    while ((n = walker.nextNode())) {
      /* .srev-skip：交给 SplitText 单独拆字入场的标题（如两所学校名），
         避免两个组件对同一段文字重复拆字。 */
      if (n.parentElement && n.parentElement.closest('.srev-sr, .srev-skip')) continue;
      if (!/\S/.test(n.nodeValue)) continue; // 纯缩进空白保留原样，不拆
      texts.push(n);
    }

    var pieces = [], words = [];
    texts.forEach(function (textNode) {
      /* flex / grid 容器里的裸文本若直接拆成 span，会变成一个个 flex item，
         被 gap 拉开（例如 .edu-rank 的「班级排名第一…」）。先包一层，
         让整行只占一个 flex item，字仍在普通行内流里排布。 */
      var host = textNode.parentElement;
      var display = host ? window.getComputedStyle(host).display : '';
      if (/flex|grid/.test(display)) {
        var wrap = document.createElement('span');
        wrap.className = 'srev-flexwrap';
        host.insertBefore(wrap, textNode);
        wrap.appendChild(textNode);
        textNode = wrap.firstChild;
        host = wrap;
      }
      var frag = document.createDocumentFragment();
      tokenize(textNode.nodeValue).forEach(function (token) {
        if (token.type === 'space') {
          frag.appendChild(document.createTextNode(token.value));
          return;
        }
        var word = document.createElement('span');
        word.className = 'srev-word';
        if (look.masked) word.style.clipPath = RISE_MASK;
        var piece = document.createElement('span');
        piece.className = 'srev-piece';
        piece.textContent = token.value;
        piece.setAttribute('aria-hidden', 'true');
        word.appendChild(piece);
        frag.appendChild(word);
        words.push(word);
        pieces.push(piece);
      });
      textNode.parentNode.replaceChild(frag, textNode);
    });

    if (!pieces.length) return;

    if (pieces.length <= 80) {
      pieces.forEach(function (piece) { piece.style.willChange = look.effect === 'fade' && !look.offset ? 'opacity' : 'opacity, transform'; });
    }
    if (look.effect === 'flip') {
      pieces.forEach(function (piece) { piece.style.transformOrigin = '50% 100%'; });
    }
    if (rotation) root.style.transformOrigin = '0% 50%';

    var total = SCRUB_SPAN + Math.max(0, pieces.length - 1) * gap;
    var last = pieces.map(function () { return -1; });

    /* 用 offsetTop/offsetHeight（布局盒，不受自身 rotate / 父级 reveal
       translateY 影响）算文档位置，避免 transform 反馈让进度抖动。 */
    function layoutTop(el) {
      var y = 0;
      for (var e = el; e; e = e.offsetParent) y += e.offsetTop;
      return y;
    }
    function progress() {
      var vh = window.innerHeight || 1;
      var h = root.offsetHeight || 1;
      var top = layoutTop(root);
      /* GSAP: start `top bottom-=20%` → end `bottom bottom` */
      var start = top - vh + 0.2 * Math.min(h, vh);
      var end = top + h - vh;
      return clamp01((window.pageYOffset - start) / Math.max(1, end - start));
    }

    /* 兜底：任何滚动角度都要能读完整文字。
       进入视口或收到全局点亮事件后，用一段短补间把进度推到 1 并锁死，
       不再随滚动位置回退；否则锚点直达 / 元素高于视口时文字会停在半透明。 */
    var settled = false;
    var settleP = null;
    function settle() {
      if (settled) return;
      settled = true;
      var from = progress();
      var t0 = performance.now();
      function tween(now) {
        var k = Math.min(1, (now - t0) / 620);
        settleP = from + (1 - from) * (1 - Math.pow(1 - k, 3));
        render();
        if (k < 1) requestAnimationFrame(tween);
        else settleP = 1;
      }
      requestAnimationFrame(tween);
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (!entries.some(function (e) { return e.isIntersecting; })) return;
        io.disconnect();
        settle();
      }, { threshold: 0, rootMargin: '10% 0px 10% 0px' });
      io.observe(root);
    } else {
      settle();
    }

    function render() {
      var p = settled ? (settleP === null ? 1 : settleP) : progress();
      var at = p * total;
      for (var i = 0; i < pieces.length; i++) {
        var t = clamp01((at - i * gap) / SCRUB_SPAN);
        if (t === last[i]) continue;
        last[i] = t;
        paint(pieces[i], t, look);
      }
      if (rotation) {
        root.style.transform = p >= 1 ? '' : 'rotate(' + (rotation * (1 - p)).toFixed(3) + 'deg)';
      }
    }

    instances.push({ render: render, settle: settle });
    render();
  }

  function settleAll() {
    instances.forEach(function (inst) { inst.settle(); });
    schedule();
  }
  window.ScrollReveal = { init: init, settleAll: settleAll };
  document.addEventListener('fx:reveal-all', settleAll);
  setTimeout(settleAll, 2600);   // 最迟到此时，全站逐字文字一定完整可读

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('load', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  setTimeout(schedule, 60);
})();

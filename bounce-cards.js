/* ===========================================================
   BounceCards · React Bits「BounceCards」的原生等价实现
   -----------------------------------------------------------
   用户提供的 React 组件 + BounceCards.css 逐逻辑移植到零依赖 JS：
   PATTERN 扇形排布 · 弹簧物理（stiffness / damping / substeps）·
   交错弹入 · hover 推开相邻卡片 · 点击回弹 · 键盘可达。
   差异：containerWidth/cardSize/spread 随容器宽度自适应（响应式），
        卡片底部增加 hover 才出现的说明条，配色对齐米白 × 藏蓝。
   =========================================================== */
(function () {
  'use strict';

  var PATTERN = [1, 0.5, -0.3, -1, 0.2, 0.75, -0.6, 0.35, -0.85, 0.1];
  var clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var toCard = function (item) {
    return typeof item === 'string'
      ? { src: item, alt: '' }
      : { src: item && item.src, alt: (item && item.alt) || '', no: (item && item.no) || '',
          cap: (item && item.cap) || '', pos: (item && item.pos) || '',
          viewer: (item && item.viewer) || '' };
  };

  function init(root, images, options) {
    if (!root || !Array.isArray(images) || !images.length) return null;

    var opt = Object.assign({
      containerHeight: 0,        // 0 = 按 cardSize 自适应
      cardSize: 0,               // 0 = 按容器宽度自适应
      spread: 0,
      rotation: 10,
      arc: 24,
      animationDelay: 0.35,
      animationStagger: 0.08,
      bounciness: 0.6,
      enableHover: true,
      pushDistance: 0,
      hoverScale: 1.08,
      borderWidth: 5,
      borderColor: '#FFFCF8',
      radius: 10,
      shadow: true,
      transformStyles: null,
      onCardClick: null
    }, options || {});

    var cards = images.map(toCard);
    var count = cards.length;
    var middle = (count - 1) / 2;
    var reach = Math.max(1, middle);
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    root.classList.add('bounce-cards');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', '活动现场影像卡片，悬停可展开，点击放大');
    root.innerHTML = cards.map(function (card, i) {
      return '<div class="bounce-cards__card bounce-cards__card--clickable" data-i="' + i + '"' +
        ' role="button" tabindex="0" aria-label="' + esc(card.alt || card.cap || ('卡片 ' + (i + 1))) + '"' +
        ' style="z-index:' + (i + 1) + '">' +
        (card.src ? '<img src="' + esc(card.src) + '" alt="' + esc(card.alt) + '" draggable="false" loading="lazy"' +
          (card.pos ? ' style="object-position:' + esc(card.pos) + '"' : '') + '>' : '') +
        '<span class="bc-no eyebrow">' + String(i + 1).padStart(2, '0') + '</span>' +
        (card.cap ? '<span class="bc-cap"><span class="eyebrow">' + esc(card.no) + '</span><span>' + esc(card.cap) + '</span></span>' : '') +
      '</div>';
    }).join('');

    /* 放大层统一挂 document.body（lightbox.js），支持左右翻阅 */
    var cardEls = Array.prototype.slice.call(root.querySelectorAll('.bounce-cards__card'));

    var settings = { slots: [], cardSize: 180, pushDistance: 140, hoverScale: opt.hoverScale };
    var bodies = [];
    var state = { hovered: -1, time: 0, layer: -1 };
    var raf = 0, last = 0, alive = true, visible = true;

    /* 响应式：卡片尺寸 / 间距 / 推开距离随容器宽度换算 */
    function measure() {
      var w = root.clientWidth || 400;
      var compact = w < 620;
      var size = opt.cardSize || (compact ? clamp(w * 0.26, 88, 132) : clamp(w * 0.20, 150, 210));
      /* 第 22 轮：卡片从 4 张增补到 9 张时略微缩小并收紧间距，
         保证整叠照片始终落在容器内，不产生横向溢出。 */
      if (count > 6) size *= 0.86;
      var baseSpread = opt.spread || size * (compact ? 0.55 : 0.62);
      var fitSpread = (w - size) / Math.max(1, count - 1);
      var spread = Math.max(16, Math.min(baseSpread, fitSpread * 0.98));
      var push = opt.pushDistance || size * (compact ? 0.55 : 0.80);
      if (count > 6 && !opt.pushDistance) push = Math.min(push, spread * (compact ? 0.9 : 1.1));
      var height = opt.containerHeight || size * (compact ? 1.72 : 1.70);
      var arc = opt.arc * (size / 190);

      settings.cardSize = Math.max(10, size);
      settings.pushDistance = push;
      settings.hoverScale = clamp(opt.hoverScale, 0.5, 2);
      settings.slots = cards.map(function (_, i) {
        var offset = i - middle;
        return { x: offset * spread, y: arc * Math.pow(offset / reach, 2), rotate: opt.rotation * PATTERN[i % PATTERN.length] };
      });

      root.style.height = height.toFixed(0) + 'px';
      root.style.setProperty('--bounce-cards-size', settings.cardSize + 'px');
      root.style.setProperty('--bounce-cards-border', Math.max(0, compact ? Math.min(3, opt.borderWidth) : opt.borderWidth) + 'px');
      root.style.setProperty('--bounce-cards-border-color', opt.borderColor);
      root.style.setProperty('--bounce-cards-radius', Math.max(0, opt.radius) + 'px');
      root.style.setProperty('--bounce-cards-shadow', opt.shadow
        ? '0 1px 2px rgba(30,48,94,.10), 0 14px 30px -10px rgba(30,48,94,.34)' : 'none');
      root.style.setProperty('--bounce-cards-shadow-active', opt.shadow
        ? '0 2px 6px rgba(30,48,94,.14), 0 26px 48px -12px rgba(30,48,94,.48)' : 'none');
      bodies = [];
      wake();
    }

    var body = function (i) {
      if (!bodies[i]) {
        var slot = settings.slots[i] || { x: 0, y: 0, rotate: 0 };
        bodies[i] = {
          x: slot.x, y: slot.y, rotate: slot.rotate,
          scale: reduce ? 1 : 0,
          vx: 0, vy: 0, vr: 0, vs: 0,
          born: state.time
        };
      }
      return bodies[i];
    };

    var step = function (value, velocity, target, stiffness, damping, dt) {
      var next = velocity + ((target - value) * stiffness - velocity * damping) * dt;
      return [value + next * dt, next];
    };

    function frame(now) {
      raf = 0;
      if (!alive) return;
      var dt = Math.min(1 / 30, Math.max(1 / 240, (now - last) / 1000));
      last = now;
      state.time += dt;

      var hovered = opt.enableHover ? state.hovered : -1;
      var popStiffness = 170;
      var popDamping = 2 * (1 - 0.85 * clamp(opt.bounciness, 0, 1)) * Math.sqrt(popStiffness);
      var moveStiffness = 210;
      var moveDamping = 2 * (reduce ? 1 : 0.72) * Math.sqrt(moveStiffness);
      var substeps = Math.ceil(dt / (1 / 240));
      var h = dt / substeps;
      var moving = 0;
      var s = settings;

      for (var i = 0; i < s.slots.length; i++) {
        var el = cardEls[i];
        if (!el) continue;
        var card = body(i);
        var slot = s.slots[i];
        var appeared = reduce || state.time - card.born >= opt.animationDelay + i * opt.animationStagger;
        var targetX = slot.x, targetY = slot.y, targetRotate = slot.rotate;
        var targetScale = appeared ? 1 : 0;
        if (hovered >= 0 && appeared) {
          if (i === hovered) {
            targetY = slot.y - s.cardSize * 0.04;
            targetRotate = 0;
            targetScale = s.hoverScale;
          } else {
            targetX = slot.x + Math.sign(i - hovered) * s.pushDistance;
          }
        }
        for (var k = 0; k < substeps; k++) {
          var rx = step(card.x, card.vx, targetX, moveStiffness, moveDamping, h); card.x = rx[0]; card.vx = rx[1];
          var ry = step(card.y, card.vy, targetY, moveStiffness, moveDamping, h); card.y = ry[0]; card.vy = ry[1];
          var rr = step(card.rotate, card.vr, targetRotate, moveStiffness, moveDamping, h); card.rotate = rr[0]; card.vr = rr[1];
          if (reduce) { card.scale = targetScale; card.vs = 0; }
          else {
            var rs = step(card.scale, card.vs, targetScale, popStiffness, popDamping, h); card.scale = rs[0]; card.vs = rs[1];
          }
        }
        moving += Math.abs(card.vx) + Math.abs(card.vy) + Math.abs(card.vr) + Math.abs(card.vs) * 100 +
          Math.abs(targetX - card.x) + Math.abs(targetY - card.y) + Math.abs(targetRotate - card.rotate) +
          Math.abs(targetScale - card.scale) * 100 + (appeared ? 0 : 1);
        el.style.transform = 'translate(-50%, -50%) translate3d(' + card.x.toFixed(2) + 'px, ' +
          card.y.toFixed(2) + 'px, 0) rotate(' + card.rotate.toFixed(3) + 'deg) scale(' +
          Math.max(0, card.scale).toFixed(4) + ')';
      }

      if (state.layer !== hovered) {
        state.layer = hovered;
        cardEls.forEach(function (node, j) {
          if (!node) return;
          node.style.zIndex = j === hovered ? String(s.slots.length + 1) : String(j + 1);
          if (j === hovered) node.setAttribute('data-active', ''); else node.removeAttribute('data-active');
        });
      }

      if (moving > 0.02 && visible) raf = requestAnimationFrame(frame);
    }

    function wake() {
      if (raf || !alive || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    var pick = function (event) {
      var rect = root.getBoundingClientRect();
      var px = event.clientX - rect.left - rect.width / 2;
      var py = event.clientY - rect.top - rect.height / 2;
      var best = -1, distance = Infinity;
      settings.slots.forEach(function (slot, i) {
        var gap = Math.abs(px - slot.x);
        if (gap < distance) { distance = gap; best = i; }
      });
      if (best < 0) return -1;
      var slot = settings.slots[best];
      var half = settings.cardSize / 2;
      if (Math.abs(py - slot.y) > half + 12 || distance > half + 12) return -1;
      if (state.hovered >= 0 && state.hovered !== best) {
        var current = settings.slots[state.hovered];
        if (current && Math.abs(px - current.x) - distance < 6) return state.hovered;
      }
      return best;
    };

    var onMove = function (event) {
      var next = pick(event);
      if (next !== state.hovered) { state.hovered = next; wake(); }
    };
    var onLeave = function () {
      if (state.hovered !== -1) { state.hovered = -1; wake(); }
    };
    var onClick = function (event) {
      var index = pick(event);
      if (index < 0) return;
      var card = bodies[index];
      if (card && !reduce) card.vs -= 2.2;
      wake();
      openCard(index);
    };
    var onFocus = function (event) {
      var index = cardEls.indexOf(event.target);
      if (index >= 0) { state.hovered = index; wake(); }
    };
    var onKey = function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var index = cardEls.indexOf(event.target);
      if (index < 0) return;
      event.preventDefault();
      if (bodies[index] && !reduce) bodies[index].vs -= 2.2;
      wake();
      openCard(index);
    };

    function openCard(index) {
      var card = cards[index];
      if (!card) return;
      if (typeof opt.onCardClick === 'function') { opt.onCardClick(index, card.src); return; }
      if (!window.Lightbox) return;
      window.Lightbox.open(cards.map(function (c, k) {
        return {
          src: c.src, viewer: c.viewer || c.src,
          title: (c.no ? c.no + ' · ' : '') + (c.cap || c.alt || ''),
          alt: c.alt || '', no: '现场影像 ' + String(k + 1).padStart(2, '0')
        };
      }), index);
    }
    function closeLb() { if (window.Lightbox) window.Lightbox.close(); onLeave(); }

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerdown', onMove);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('click', onClick);
    root.addEventListener('focusin', onFocus);
    root.addEventListener('focusout', onLeave);
    root.addEventListener('keydown', onKey);
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(root);
    window.addEventListener('resize', measure, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = !!(es[0] && es[0].isIntersecting);
        if (visible) wake();
      }, { rootMargin: '160px' }).observe(root);
    }

    measure();
    return { relayout: measure, wake: wake, destroy: function () { alive = false; if (raf) cancelAnimationFrame(raf); } };
  }

  window.BounceCards = { init: init };
})();

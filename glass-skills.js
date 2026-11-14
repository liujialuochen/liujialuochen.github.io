/* ===========================================================
   GlassSkills · 零依赖原生实现
   = GlassIcons（玻璃折射图标 / 渐变色板 / 弹簧 hover / 视差高光 / 交错入场）
   + FolderFloat（文件夹前盖翻起 / 技能纸片交错弹出 / 正弦漂浮 / 可拖拽）
   -----------------------------------------------------------
   用户提供的 React 版依赖 GSAP 风格 WebGL2 shader 与 Matter.js；
   这里用 CSS 玻璃层 + rAF 弹簧做等价观感，避免引入运行时依赖，
   也避免 WebGL 纹理造成的磨砂/占位问题（本站封面要求始终清晰）。
   =========================================================== */
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* GlassIcons 官方调色板，取 5 色对应五类技能 */
  var GRADIENTS = [
    'linear-gradient(135deg,hsl(214,95%,66%),hsl(226,80%,50%))',   /* 语言能力 · blue */
    'linear-gradient(135deg,hsl(326,92%,74%),hsl(314,70%,54%))',   /* 新媒体平台 · pink */
    'linear-gradient(135deg,hsl(38,100%,62%),hsl(20,94%,54%))',    /* 内容制作 · orange */
    'linear-gradient(135deg,hsl(276,84%,70%),hsl(262,66%,52%))',   /* AI 创作 · purple */
    'linear-gradient(135deg,hsl(184,80%,56%),hsl(196,84%,40%))'    /* 数据分析 · teal */
  ];

  /* 五个分类各自的线性 glyph（白色描边，适配深蓝反相底） */
  var GLYPHS = [
    /* 语言能力 · 对话气泡 + 声线 */
    '<path d="M3.5 5.6h11a2 2 0 0 1 2 2v5.2a2 2 0 0 1-2 2H8.7l-4.2 3v-3H3.5"/>' +
    '<path d="M6.9 9.1h6.3M6.9 11.7h4.1"/>' +
    '<path d="M18.4 5.2c1.3.5 2.2 1.6 2.2 3v3.4c0 1.4-.9 2.5-2.2 3"/>',
    /* 新媒体平台 · 播放框 + 信号 */
    '<rect x="2.8" y="5.2" width="13.4" height="11.2" rx="1.4"/>' +
    '<path d="m8 8.6 4.2 2.6L8 13.8V8.6Z"/>' +
    '<path d="M18.6 7.4c1.2.9 1.9 2.2 1.9 3.8s-.7 2.9-1.9 3.8M20.9 5c1.9 1.4 3 3.5 3 6s-1.1 4.6-3 6"/>',
    /* 内容制作与视觉设计 · 取景框 + 山 + 太阳 */
    '<rect x="3" y="4.6" width="18" height="14.8" rx="1.4"/>' +
    '<circle cx="8.4" cy="9.2" r="1.5"/>' +
    '<path d="m3.8 17 5-5 3.3 3.3 3-2.6 5.1 4.3"/>',
    /* AI 创作工具 · 星芒 */
    '<path d="M12 2.8 13.8 9l6.2 1.8-6.2 1.8L12 18.8l-1.8-6.2L4 10.8 10.2 9 12 2.8Z"/>' +
    '<path d="M19 16.4l.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7.7-2.2Z"/>',
    /* 数据分析与办公工具 · 柱状 + 折线 */
    '<path d="M3.2 20.2h17.6"/>' +
    '<rect x="4.8" y="12.6" width="3.2" height="6.2" rx=".5"/>' +
    '<rect x="10.2" y="8.4" width="3.2" height="10.4" rx=".5"/>' +
    '<rect x="15.6" y="10.8" width="3.2" height="8" rx=".5"/>' +
    '<path d="m4.4 6.2 4.4-2.6 4.2 2 5.6-3.2"/>'
  ];

  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var ease = function (t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); };
  var fade = function (from, to, t) {
    var x = clamp((t - from) / (to - from), 0, 1);
    return x * x * (3 - 2 * x);
  };
  /* 弹簧积分：与官方 drive() 同参数（value, velocity, target, stiffness, damping, dt） */
  var drive = function (value, velocity, target, k, d, dt) {
    var next = velocity + (k * (target - value) - d * velocity) * dt;
    return [value + next * dt, next];
  };
  var jitter = function (i) {
    var x = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
    return x - Math.floor(x);
  };

  function labelHTML(kid) {
    var base = esc(kid.label);
    if (!window.AppIcons) return base;
    if (Array.isArray(kid.icons)) {
      return kid.icons.reduce(function (s, spec) {
        return s.replace(esc(spec.after), esc(spec.after) + window.AppIcons.svg(spec.key));
      }, base);
    }
    return kid.icon ? base + window.AppIcons.svg(kid.icon) : base;
  }

  /* 纸片排布：按实测宽度/高度折行，偶数行轻微错位，模拟 FolderFloat 的 layout() */
  function layout(items, spread, lift, tilt, sizes) {
    var GAP = 10, rows = [], row = [], width = 0, maxH = 32;
    items.forEach(function (item, i) {
      var pw = (sizes[i] && sizes[i].w) || (28 + String(item.label).length * 7);
      var ph = (sizes[i] && sizes[i].h) || 32;
      if (row.length && width + GAP + pw > spread * 2) {
        rows.push({ items: row, width: width, height: maxH });
        row = []; width = 0; maxH = 32;
      }
      row.push({ i: i, pw: pw });
      width += (row.length > 1 ? GAP : 0) + pw;
      if (ph > maxH) maxH = ph;
    });
    if (row.length) rows.push({ items: row, width: width, height: maxH });
    var pos = [], acc = 0;
    rows.forEach(function (r, ri) {
      if (ri > 0) acc += rows[ri - 1].height + 14;
      var x = -r.width / 2;
      var shift = (ri % 2 ? 1 : -1) * Math.min(14, spread * 0.09);
      r.items.forEach(function (it) {
        var j = jitter(it.i);
        pos[it.i] = {
          x: x + it.pw / 2 + shift + (j - 0.5) * 6,
          y: -lift - acc - j * 6,
          r: tilt * (j * 2 - 1)
        };
        x += it.pw + GAP;
      });
    });
    return pos;
  }

  function init(root, groups, options) {
    if (!root || !Array.isArray(groups) || !groups.length) return null;
    var opt = Object.assign({
      size: 82, tilt: 30, spread: 0.5, intro: true,
      labelPrefix: 'SKILLS', startOpen: true
    }, options || {});
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var n = groups.length;

    root.classList.add('gsk-root');
    root.innerHTML =
      '<div class="gsk-icons" role="tablist" aria-label="技能分类，悬停或点击切换">' +
        groups.map(function (g, i) {
          var kids = g.children || [];
          return '<button class="gsk-icon" type="button" role="tab" data-i="' + i + '" ' +
            'aria-selected="' + (i === 0 ? 'true' : 'false') + '" aria-controls="gskStage" ' +
            'aria-label="' + esc(g.label) + '，' + kids.length + ' 项技能">' +
              '<span class="gsk-tile" aria-hidden="true">' +
                '<span class="gsk-plate" style="--gsk-grad:' + GRADIENTS[i % GRADIENTS.length] + '"></span>' +
                '<span class="gsk-glass">' +
                  '<span class="gsk-shine"></span><span class="gsk-shade"></span>' +
                  '<span class="gsk-edge"></span>' +
                '</span>' +
                '<span class="gsk-face">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
                  'stroke-linecap="round" stroke-linejoin="round" focusable="false">' +
                  (GLYPHS[i % GLYPHS.length]) + '</svg>' +
                '</span>' +
              '</span>' +
              '<span class="gsk-label"><span>' + esc(g.label) + '</span>' +
                '<em>' + String(kids.length).padStart(2, '0') + '</em></span>' +
            '</button>';
        }).join('') +
      '</div>' +
      '<div class="gsk-stage" id="gskStage" role="tabpanel" aria-label="技能纸片">' +
        '<div class="gsk-pills" aria-live="polite"></div>' +
        '<div class="gsk-folder" aria-hidden="false">' +
          '<span class="gsk-folder-back"></span>' +
          '<span class="gsk-folder-paper"></span>' +
          '<span class="gsk-folder-front">' +
            '<span class="gsk-folder-label"></span>' +
            '<span class="gsk-folder-sub"></span>' +
          '</span>' +
          '<button class="gsk-folder-trigger" type="button" aria-expanded="true" ' +
            'aria-label="展开或收起当前技能分类"></button>' +
        '</div>' +
      '</div>' +
      '<p class="gsk-hint eyebrow">悬停图标切换分类 · 拖动纸片可移动 · 点击图标锁定 · ESC 收起</p>';

    var icons = Array.prototype.slice.call(root.querySelectorAll('.gsk-icon'));
    var stage = root.querySelector('.gsk-stage');
    var pillsBox = root.querySelector('.gsk-pills');
    var folder = root.querySelector('.gsk-folder');
    var folderLabel = root.querySelector('.gsk-folder-label');
    var folderSub = root.querySelector('.gsk-folder-sub');
    var folderTrigger = root.querySelector('.gsk-folder-trigger');

    /* ---------- GlassIcons 弹簧状态 ---------- */
    var states = icons.map(function () {
      var e = (opt.intro && !reduce) ? 0 : 1;
      return {
        h: 0, hv: 0, ht: 0,
        p: 0, pv: 0, pt: 0,
        x: 0, xv: 0, xt: 0,
        y: 0, yv: 0, yt: 0,
        e: e, ev: 0, et: e, at: 0
      };
    });
    var entered = !opt.intro || reduce;
    var glassRaf = 0, glassLast = 0, alive = true;

    function poseOf(s) {
      var size = opt.size;
      var swing = ease((clamp(s.e, 0, 1) - 0.18) / 0.82);
      var hover = s.h;
      var liftY = -0.09 * size * hover;
      var settle = 0.92 + 0.08 * ease(s.e);
      var glassScale = (1 - 0.08 * s.p) * settle;
      var shift = [-s.x * 0.07 * size, -s.y * 0.07 * size];
      var angle = (opt.tilt + 10 * hover) * swing;
      var offset = [-0.08 * size * hover, -0.08 * size * hover];
      var reach = opt.spread * (0.26 + 0.08 * hover) * size * swing;
      return {
        liftY: liftY,
        domScale: glassScale,
        glassAlpha: fade(0, 0.55, s.e),
        plateAlpha: fade(0, 0.35, s.e),
        faceY: liftY + (1 - ease((s.e - 0.25) / 0.75)) * 0.1 * size,
        faceScale: 1 - 0.08 * s.p,
        faceAlpha: fade(0.3, 0.85, s.e),
        plateScale: 1 - 0.08 * s.p,
        shift: shift, angle: angle, offset: offset,
        reach: reach,
        lightX: 30 + s.x * 22, lightY: 18 + s.y * 18,
        glow: 1 + 0.3 * hover
      };
    }

    function applyGlass() {
      icons.forEach(function (el, i) {
        var s = states[i], p = poseOf(s);
        var glass = el.querySelector('.gsk-glass');
        var plate = el.querySelector('.gsk-plate');
        var face = el.querySelector('.gsk-face');
        var label = el.querySelector('.gsk-label');
        if (glass) {
          glass.style.transform = 'translate3d(0,' + p.liftY.toFixed(2) + 'px,0) scale(' + p.domScale.toFixed(4) + ')';
          glass.style.opacity = p.glassAlpha.toFixed(3);
        }
        if (plate) {
          plate.style.transform =
            'translate(' + p.shift[0].toFixed(2) + 'px,' + p.shift[1].toFixed(2) + 'px) ' +
            'scale(' + p.plateScale.toFixed(4) + ') rotate(' + p.angle.toFixed(2) + 'deg) ' +
            'translate(' + p.offset[0].toFixed(2) + 'px,' + p.offset[1].toFixed(2) + 'px)';
          plate.style.opacity = p.plateAlpha.toFixed(3);
        }
        if (face) {
          face.style.transform = 'translate3d(0,' + p.faceY.toFixed(2) + 'px,0) scale(' + p.faceScale.toFixed(4) + ')';
          face.style.opacity = p.faceAlpha.toFixed(3);
        }
        if (label) label.style.opacity = p.faceAlpha.toFixed(3);
        el.style.setProperty('--gsk-light-x', p.lightX.toFixed(1) + '%');
        el.style.setProperty('--gsk-light-y', p.lightY.toFixed(1) + '%');
        el.style.setProperty('--gsk-glow', p.glow.toFixed(3));
      });
    }

    function glassTick(now) {
      glassRaf = 0;
      if (!alive) return;
      var dt = glassLast ? Math.min(1 / 30, (now - glassLast) / 1000) : 1 / 60;
      glassLast = now;
      var steps = Math.max(1, Math.ceil(dt * 240));
      var h = dt / steps;
      var moving = false;
      var time = now / 1000;
      states.forEach(function (s, i) {
        if (s.et === 0 && entered && time >= s.at) s.et = 1;
        if (reduce) {
          s.h = s.ht; s.p = s.pt; s.x = s.xt; s.y = s.yt; s.e = s.et;
          return;
        }
        for (var k = 0; k < steps; k++) {
          var a, b, c, d, e2;
          a = drive(s.h, s.hv, s.ht, 170, 24, h); s.h = a[0]; s.hv = a[1];
          b = drive(s.p, s.pv, s.pt, 420, 40, h); s.p = b[0]; s.pv = b[1];
          c = drive(s.x, s.xv, s.xt, 90, 19, h); s.x = c[0]; s.xv = c[1];
          d = drive(s.y, s.yv, s.yt, 90, 19, h); s.y = d[0]; s.yv = d[1];
          e2 = drive(s.e, s.ev, s.et, 60, 15.5, h); s.e = e2[0]; s.ev = e2[1];
        }
        var pairs = [['h', 'hv', 'ht'], ['p', 'pv', 'pt'], ['x', 'xv', 'xt'],
                     ['y', 'yv', 'yt'], ['e', 'ev', 'et']];
        for (var j = 0; j < pairs.length; j++) {
          var key = pairs[j][0], vel = pairs[j][1], tar = pairs[j][2];
          if (Math.abs(s[tar] - s[key]) < 0.0005 && Math.abs(s[vel]) < 0.001) {
            s[key] = s[tar]; s[vel] = 0;
          } else moving = true;
        }
      });
      applyGlass();
      if (moving || (entered && states.some(function (s) { return s.e < 0.999; }))) {
        glassRaf = requestAnimationFrame(glassTick);
      } else glassLast = 0;
    }
    function wakeGlass() {
      if (!glassRaf && alive) glassRaf = requestAnimationFrame(glassTick);
    }

    /* ---------- FolderFloat 纸片 ---------- */
    var active = 0, locked = false, open = false, current = [];
    var floatRaf = 0, floatT0 = 0, drag = null;

    function measurePills() {
      return current.map(function (el) {
        return { w: el.offsetWidth, h: el.offsetHeight };
      });
    }

    function positionPills(animate) {
      var stageW = stage.clientWidth || root.clientWidth || 600;
      var spread = Math.min(stageW / 2 - 26, 250);
      spread = Math.max(spread, 110);
      var sizes = measurePills();
      var pos = layout(groups[active].children || [], spread, 24, 7, sizes);
      current.forEach(function (el, i) {
        var p = pos[i] || { x: 0, y: -40 - i * 40, r: 0 };
        el.dataset.x = p.x.toFixed(1);
        el.dataset.y = p.y.toFixed(1);
        el.style.setProperty('--gsk-x', p.x.toFixed(1) + 'px');
        el.style.setProperty('--gsk-y', p.y.toFixed(1) + 'px');
        el.style.setProperty('--gsk-r', p.r.toFixed(2) + 'deg');
        el.style.setProperty('--gsk-i', String(i));
        /* 交错延时由 CSS 的 --gsk-i 承担，这里不要写内联 transitionDelay，
           否则会把 stagger 覆盖成 0，纸片就不会逐个弹出了。 */
        if (animate === false) el.style.removeProperty('transition-delay');
      });
      /* 舞台高度随行数自适应，避免纸片被裁切 */
      var minY = Math.min.apply(null, pos.map(function (p) { return p.y; }).concat([-24]));
      var need = Math.abs(minY) + 60 + 132;
      stage.style.minHeight = Math.max(232, Math.min(430, need)) + 'px';
    }

    function renderPills() {
      var kids = groups[active].children || [];
      pillsBox.innerHTML = kids.map(function (kid, i) {
        return '<button class="gsk-pill" type="button" data-p="' + i + '" ' +
          'aria-label="' + esc(kid.label) + '">' +
          '<span class="gsk-pill-text">' + labelHTML(kid) + '</span></button>';
      }).join('');
      current = Array.prototype.slice.call(pillsBox.querySelectorAll('.gsk-pill'));
      current.forEach(function (el, i) {
        el.dataset.phase = jitter(i + active * 7).toFixed(4);
        el.addEventListener('pointerdown', onPillDown);
        el.addEventListener('pointermove', onPillMove);
        el.addEventListener('pointerup', onPillUp);
        el.addEventListener('pointercancel', onPillUp);
        el.addEventListener('click', onPillClick);
      });
    }

    function setOpen(next, replay) {
      open = next;
      stage.classList.toggle('is-open', open);
      folder.classList.toggle('is-open', open);
      folderTrigger.setAttribute('aria-expanded', String(open));
      icons.forEach(function (ic, i) {
        ic.setAttribute('aria-expanded', String(open && i === active));
      });
      if (open) {
        if (replay) {
          /* 重播交错弹出：先撤掉状态，强制重排，再挂回 */
          stage.classList.remove('is-open');
          folder.classList.remove('is-open');
          void stage.offsetWidth;
          stage.classList.add('is-open');
          folder.classList.add('is-open');
        }
        startFloat();
      } else {
        stopFloat();
      }
    }

    function activate(i, replay) {
      if (i === active && open && !replay) return;
      active = clamp(i, 0, n - 1);
      icons.forEach(function (ic, k) {
        ic.classList.toggle('is-active', k === active);
        ic.setAttribute('aria-selected', String(k === active));
      });
      var g = groups[active];
      var kids = g.children || [];
      folderLabel.textContent = g.label;
      folderSub.textContent = String(kids.length).padStart(2, '0') + ' SKILLS · ' + opt.labelPrefix;
      stage.setAttribute('aria-label', g.label + ' 的 ' + kids.length + ' 项技能');
      folderTrigger.setAttribute('aria-label', '展开或收起「' + g.label + '」的技能');
      renderPills();
      positionPills(false);
      setOpen(true, !!replay || true);
    }

    /* 正弦漂浮 + 拖拽偏移衰减 */
    function startFloat() {
      if (reduce || floatRaf) return;
      floatT0 = performance.now();
      var loop = function (now) {
        floatRaf = 0;
        if (!alive || !open) return;
        var t = (now - floatT0) / 1000;
        current.forEach(function (el) {
          var ph = parseFloat(el.dataset.phase || '0') * Math.PI * 2;
          var dx = Math.sin(t * 0.85 + ph) * 2.6;
          var dy = Math.cos(t * 1.15 + ph * 1.4) * 2.2;
          el.style.setProperty('--gsk-dx', dx.toFixed(2) + 'px');
          el.style.setProperty('--gsk-dy', dy.toFixed(2) + 'px');
          var d = el._disp;
          if (d && (Math.abs(d.x) > 0.05 || Math.abs(d.y) > 0.05)) {
            d.x *= 0.9; d.y *= 0.9;
            el.style.setProperty('--gsk-px', d.x.toFixed(2) + 'px');
            el.style.setProperty('--gsk-py', d.y.toFixed(2) + 'px');
          } else if (d) {
            d.x = 0; d.y = 0;
            el.style.setProperty('--gsk-px', '0px');
            el.style.setProperty('--gsk-py', '0px');
          }
        });
        floatRaf = requestAnimationFrame(loop);
      };
      floatRaf = requestAnimationFrame(loop);
    }
    function stopFloat() {
      if (floatRaf) cancelAnimationFrame(floatRaf);
      floatRaf = 0;
    }

    function onPillDown(e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      var el = e.currentTarget;
      drag = {
        el: el, id: e.pointerId, sx: e.clientX, sy: e.clientY,
        ox: parseFloat(el.dataset.x) || 0, oy: parseFloat(el.dataset.y) || 0,
        moved: false
      };
      if (!el._disp) el._disp = { x: 0, y: 0 };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
    function onPillMove(e) {
      if (!drag || drag.el !== e.currentTarget || drag.id !== e.pointerId) return;
      var ddx = e.clientX - drag.sx, ddy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(ddx, ddy) >= 4) drag.moved = true;
      if (!drag.moved) return;
      var limitX = Math.min(stage.clientWidth / 2 - 30, 210);
      var px = clamp(ddx, -limitX, limitX);
      var py = clamp(ddy, -70, 90);
      drag.el._disp.x = px; drag.el._disp.y = py;
      drag.el.style.setProperty('--gsk-px', px.toFixed(2) + 'px');
      drag.el.style.setProperty('--gsk-py', py.toFixed(2) + 'px');
      drag.el.classList.add('is-dragging');
    }
    function onPillUp(e) {
      if (!drag || drag.id !== e.pointerId) return;
      var el = drag.el;
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
      el.classList.remove('is-dragging');
      drag = null;
    }
    function onPillClick(e) {
      var el = e.currentTarget;
      el.classList.remove('is-pop');
      void el.offsetWidth;
      el.classList.add('is-pop');
    }

    /* ---------- 图标交互 ---------- */
    icons.forEach(function (ic, i) {
      ic.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        states[i].ht = 1;
        wakeGlass();
        /* 点击锁定后悬停不再抢焦点，Esc / 再次点击可解除 */
        if (!locked) activate(i, true);
      });
      ic.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var r = ic.getBoundingClientRect();
        states[i].xt = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
        states[i].yt = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
        wakeGlass();
      });
      ic.addEventListener('pointerleave', function () {
        states[i].ht = 0; states[i].xt = 0; states[i].yt = 0; states[i].pt = 0;
        wakeGlass();
      });
      ic.addEventListener('pointerdown', function () { states[i].pt = 1; wakeGlass(); });
      ic.addEventListener('pointerup', function () { states[i].pt = 0; wakeGlass(); });
      ic.addEventListener('focus', function () {
        states[i].ht = 1; wakeGlass();
        activate(i, true);
      });
      ic.addEventListener('blur', function () { states[i].ht = 0; wakeGlass(); });
      ic.addEventListener('click', function () {
        locked = (active === i) ? !locked : true;
        activate(i, true);
      });
      ic.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var next = (i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
          icons[next].focus();
        } else if (e.key === 'Escape') {
          setOpen(false, false);
          locked = false;
        }
      });
    });

    folderTrigger.addEventListener('click', function () {
      if (open) { locked = false; setOpen(false, false); }
      else { locked = true; setOpen(true, true); positionPills(false); }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { locked = false; setOpen(false, false); }
    });

    /* ---------- 入场 / 尺寸 ---------- */
    if (opt.intro && !reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entered || !entries.some(function (en) { return en.isIntersecting; })) return;
        entered = true;
        var time = performance.now() / 1000;
        states.forEach(function (s, i) { s.at = time + i * 0.07; });
        wakeGlass();
        io.disconnect();
      }, { threshold: 0.12 });
      io.observe(root);
    }
    applyGlass();

    var resizeTimer = 0;
    var onResize = function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { positionPills(false); applyGlass(); }, 120);
    };
    if ('ResizeObserver' in window) {
      new ResizeObserver(onResize).observe(root);
    } else {
      window.addEventListener('resize', onResize);
    }

    /* 初始展开第一类，首屏即可看到弹出的技能 */
    activate(0, true);
    if (opt.startOpen === false) { setOpen(false, false); locked = false; }

    return {
      activate: function (i) { locked = true; activate(i, true); },
      close: function () { locked = false; setOpen(false, false); },
      open: function () { setOpen(true, true); },
      state: function () { return { active: active, open: open, locked: locked, count: groups[active].children.length }; }
    };
  }

  window.GlassSkills = { init: init };
})();

/* ===========================================================
   MagicBento · 数据表格看板（ReactBits MagicBento 规格的原生等价实现）
   -----------------------------------------------------------
   站点零依赖、无 React / Hugeicons，因此把规格里的交互用原生实现：
   · 卡片聚光灯（跟随指针的径向渐变）与边缘光晕（1px mask 描边）
   · 悬停 3D 倾斜 + 磁吸位移 + 按下微缩（指数平滑，240Hz 子步等价）
   · 点击涟漪波（向外扩散的描边光环）与图表 / 条形 / 环形动画重播
   · 进入视口时的交错入场（80ms stagger）
   · 折线图指针 scrub：读出每篇稿件页面显示的真实浏览量
   数据全部取自 main.js 的履历与剪报口径，不新增任何未经提供的数字。
   =========================================================== */
(function () {
  'use strict';

  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var esc = function (v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ---- 单调三次曲线（规格里的 curve / sampleAt 等价实现，viewBox 100×60） ---- */
  function curve(values, width, height) {
    var top = 6, bottom = 2;
    var low = Math.min.apply(null, values) * 0.7;
    var high = Math.max.apply(null, values);
    var rng = Math.max(1e-6, high - low);
    var points = values.map(function (v, i) {
      return [(i / (values.length - 1)) * width, top + (1 - (v - low) / rng) * (height - top - bottom)];
    });
    var count = points.length, slopes = [], i;
    for (i = 0; i < count - 1; i++) slopes.push((points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0]));
    var tangents = points.map(function (_, k) {
      if (k === 0) return slopes[0];
      if (k === count - 1) return slopes[count - 2];
      return slopes[k - 1] * slopes[k] > 0 ? (slopes[k - 1] + slopes[k]) / 2 : 0;
    });
    for (i = 0; i < count - 1; i++) {
      if (slopes[i] === 0) { tangents[i] = 0; tangents[i + 1] = 0; continue; }
      var a = tangents[i] / slopes[i], b = tangents[i + 1] / slopes[i];
      var len = a * a + b * b;
      if (len > 9) {
        var scale = 3 / Math.sqrt(len);
        tangents[i] = scale * a * slopes[i];
        tangents[i + 1] = scale * b * slopes[i];
      }
    }
    var line = 'M' + points[0][0].toFixed(2) + ',' + points[0][1].toFixed(2);
    var samples = [];
    for (i = 0; i < count - 1; i++) {
      var x0 = points[i][0], y0 = points[i][1], x1 = points[i + 1][0], y1 = points[i + 1][1];
      var third = (x1 - x0) / 3;
      var c1 = [x0 + third, y0 + tangents[i] * third];
      var c2 = [x1 - third, y1 - tangents[i + 1] * third];
      line += ' C' + c1[0].toFixed(2) + ',' + c1[1].toFixed(2) + ' ' +
        c2[0].toFixed(2) + ',' + c2[1].toFixed(2) + ' ' + x1.toFixed(2) + ',' + y1.toFixed(2);
      for (var s = 0; s < 12; s++) {
        var t = s / 12, u = 1 - t;
        samples.push([
          u * u * u * x0 + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * x1,
          u * u * u * y0 + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * y1
        ]);
      }
    }
    samples.push(points[count - 1]);
    var area = line + ' L' + width.toFixed(2) + ',' + height.toFixed(2) + ' L0,' + height.toFixed(2) + ' Z';
    return { line: line, area: area, samples: samples };
  }
  function sampleAt(samples, x) {
    var i = 1;
    while (i < samples.length - 1 && samples[i][0] < x) i++;
    var x0 = samples[i - 1][0], y0 = samples[i - 1][1];
    var x1 = samples[i][0], y1 = samples[i][1];
    var t = x1 === x0 ? 0 : clamp((x - x0) / (x1 - x0), 0, 1);
    return y0 + (y1 - y0) * t;
  }

  /* ---- 表格：真实数据行（th/td 语义表格 + 可选条形轨道） ---- */
  function tableHTML(rows, bars) {
    if (!rows || !rows.length) return '';
    return '<table class="mb-table' + (bars ? ' mb-table--bars' : '') + '"><tbody>' +
      rows.map(function (r, i) {
        var track = bars
          ? '<td class="mb-track"><i class="mb-fill" style="--w:' + clamp(+r.pct || 0, 0, 100).toFixed(1) + '%;--i:' + i + '"></i></td>'
          : '';
        return '<tr><th scope="row">' + esc(r.k) + '</th>' + track + '<td class="mb-val">' + esc(r.v) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function visualHTML(item) {
    var v = item.visual;
    if (v === 'chart') {
      var c = item.chart || {};
      var vals = c.values || [], shape = curve(vals, 100, 60);
      /* 描边长度按 viewBox 用户单位实测；不用 pathLength=1 + 非等比缩放的
         vector-effect，否则 Edge 会把 dasharray 拉成断续的粗线段。 */
      var pathLen = 0;
      for (var pi = 1; pi < shape.samples.length; pi++) {
        pathLen += Math.hypot(shape.samples[pi][0] - shape.samples[pi - 1][0],
          shape.samples[pi][1] - shape.samples[pi - 1][1]);
      }
      return '<div class="mb-chart" data-chart' +
        ' data-values="' + esc(JSON.stringify(vals)) + '"' +
        ' data-labels="' + esc(JSON.stringify(c.labels || [])) + '"' +
        ' data-unit="' + esc(c.unit || '') + '"' +
        ' data-initial="' + esc(c.initial || '') + '"' +
        ' data-note="' + esc(c.note || '') + '">' +
        '<div class="mb-chart-figure"><span class="mb-chart-value serif">' + esc(c.initial || '') + '</span>' +
        '<span class="mb-chart-note eyebrow">' + esc(c.note || '') + '</span></div>' +
        '<div class="mb-plot"><svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">' +
        '<path class="mb-area" d="' + shape.area + '"/>' +
        '<path class="mb-line" d="' + shape.line + '" style="--len:' + pathLen.toFixed(1) + '"/>' +
        '</svg><span class="mb-scrub" aria-hidden="true"><span class="mb-dot"></span></span></div>' +
        '<p class="mb-caption eyebrow">' + esc(c.caption || '') + '</p></div>';
    }
    if (v === 'bars') return '<div class="mb-visual-inner">' + tableHTML(item.bars || [], true) + '</div>';
    if (v === 'table') return '<div class="mb-visual-inner">' + tableHTML(item.rows || [], false) + '</div>';
    if (v === 'ring') {
      var pct = clamp(+((item.ring || {}).pct) || 0, 0, 100);
      return '<div class="mb-visual-inner mb-ring-wrap">' +
        '<div class="mb-ring"><svg viewBox="0 0 80 80" aria-hidden="true" style="--p:' + pct + '">' +
        '<circle class="mb-ring-bg" cx="40" cy="40" r="30" pathLength="100"/>' +
        '<circle class="mb-ring-fg" cx="40" cy="40" r="30" pathLength="100"/>' +
        '</svg><span class="mb-ring-label serif">' + esc(item.value) + '</span></div>' +
        '<p class="mb-caption eyebrow">' + esc((item.ring || {}).caption || '') + '</p></div>';
    }
    if (v === 'dist') {
      var groups = (item.dist || {}).groups || [];
      var dotIndex = 0;
      var dots = groups.map(function (g) {
        var out = '';
        for (var i = 0; i < (+g.count || 0); i++) {
          out += '<i class="' + (g.on ? 'is-on' : '') + '" style="--i:' + (dotIndex++) + '"></i>';
        }
        return '<span class="mb-dist-group"><b>' + esc(g.label) + '</b><span class="mb-dist-dots">' + out + '</span></span>';
      }).join('');
      return '<div class="mb-visual-inner"><div class="mb-dist">' + dots + '</div>' +
        tableHTML((item.dist || {}).rows || [], false) + '</div>';
    }
    return '';
  }

  function cellHTML(item, index, total) {
    var span = String(index + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    /* foot 可由数据显式指定；图表 / 环形卡默认把 rows 放在底部。 */
    var footRows = item.foot || ((item.visual === 'chart' || item.visual === 'ring') ? item.rows : null);
    var foot = footRows ? '<div class="mb-foot">' + tableHTML(footRows, false) + '</div>' : '';
    return '<div class="mb-cell" data-visual="' + esc(item.visual) + '"' +
      ' style="--mb-delay:' + (index * 80) + 'ms;grid-column:span ' + (item.c || 1) +
      ';grid-row:span ' + (item.r || 1) + '">' +
      '<div class="mb-card" tabindex="0" role="group" aria-label="' +
      esc(item.label + ' · ' + item.title + ' · ' + item.value) + '">' +
      '<span class="mb-spot" aria-hidden="true"></span>' +
      '<span class="mb-rim" aria-hidden="true"></span>' +
      '<span class="mb-border" aria-hidden="true"></span>' +
      '<div class="mb-content">' +
      '<div class="mb-head"><span class="mb-label eyebrow">' + esc(item.label) + '</span>' +
      '<span class="mb-no eyebrow">' + span + '</span></div>' +
      '<div class="mb-figure"><span class="mb-value serif">' + esc(item.value) + '</span>' +
      '<span class="mb-unit eyebrow">' + esc(item.unit) + '</span></div>' +
      '<div class="mb-visual">' + visualHTML(item) + '</div>' + foot +
      '</div></div></div>';
  }

  function init(root, items, options) {
    if (!root || !Array.isArray(items) || !items.length) return;
    var opt = options || {};
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var motion = !reduce && !opt.disableAnimations && 'requestAnimationFrame' in window;

    root.classList.add('mb-grid');
    root.setAttribute('aria-label', opt.ariaLabel || '权威媒体传播履历数据看板');
    root.innerHTML = items.map(function (item, i) { return cellHTML(item, i, items.length); }).join('');
    if (motion) root.dataset.motion = '';
    if (motion && opt.intro !== false) root.dataset.intro = '';

    var cells = Array.prototype.slice.call(root.querySelectorAll('.mb-cell'));
    var cards = Array.prototype.slice.call(root.querySelectorAll('.mb-card'));
    var state = cards.map(function () {
      return { hot: 0, rx: 0, ry: 0, tx: 0, ty: 0, press: 1, written: {} };
    });
    var pointer = { x: -1e5, y: -1e5, inside: false, down: -1 };
    var light = { near: 0 };
    var wave = { x: 0, y: 0, t: -1, dur: 1.1, reach: 800 };
    var bounds = null, rects = [], dirty = true, raf = 0, last = 0, visible = true;
    var TILT = opt.tilt === undefined ? 3 : opt.tilt;
    var MAGNET = opt.magnet === undefined ? 5 : opt.magnet;

    function write(card, st, name, value) {
      if (st.written[name] === value) return;
      st.written[name] = value;
      card.style.setProperty(name, value);
    }
    function measure() {
      dirty = false;
      bounds = root.getBoundingClientRect();
      rects = cards.map(function (c) { return c.getBoundingClientRect(); });
    }
    function indexOf(target) {
      if (!target || !target.closest) return -1;
      var card = target.closest('.mb-card');
      return card ? cards.indexOf(card) : -1;
    }
    function replay(card) {
      if (!motion) return;
      var anims = card.querySelectorAll('.mb-fill,.mb-line,.mb-area,.mb-ring-fg,.mb-dist i');
      Array.prototype.forEach.call(anims, function (el) { el.style.animation = 'none'; });
      void card.offsetWidth; // 强制重排，让 CSS 动画从头重播
      Array.prototype.forEach.call(anims, function (el) { el.style.animation = ''; });
    }
    function activate(index, x, y) {
      var card = cards[index];
      if (!card || !motion) return;
      if (dirty) measure();
      wave.x = x; wave.y = y; wave.t = 0;
      wave.reach = Math.max(
        Math.hypot(x - bounds.left, y - bounds.top), Math.hypot(x - bounds.right, y - bounds.top),
        Math.hypot(x - bounds.left, y - bounds.bottom), Math.hypot(x - bounds.right, y - bounds.bottom)
      ) + 140;
      replay(card);
      wake();
    }

    function frame(now) {
      raf = 0;
      var dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      if (dirty) measure();
      var busy = false;
      var margin = 150;
      var near = pointer.inside && bounds &&
        pointer.x > bounds.left - margin && pointer.x < bounds.right + margin &&
        pointer.y > bounds.top - margin && pointer.y < bounds.bottom + margin ? 1 : 0;
      var nf = 1 - Math.exp(-dt / (near > light.near ? 0.12 : 0.4));
      light.near += (near - light.near) * nf;
      if (Math.abs(near - light.near) < 0.002) light.near = near; else busy = true;

      var wr = 1, wa = 0;
      if (wave.t >= 0) {
        wave.t += dt;
        var progress = Math.min(1, wave.t / wave.dur);
        wr = Math.max(1, wave.reach * (1 - Math.pow(1 - progress, 2.2)));
        wa = Math.pow(1 - progress, 1.3);
        if (progress >= 1) { wave.t = -1; wa = 0; wr = 1; } else busy = true;
      }

      cards.forEach(function (card, i) {
        var rect = rects[i];
        if (!rect) return;
        var st = state[i];
        var px = pointer.x - rect.left, py = pointer.y - rect.top;
        var inside = pointer.inside && px >= 0 && py >= 0 && px <= rect.width && py <= rect.height;
        var u = clamp(px / Math.max(1, rect.width), 0, 1) - 0.5;
        var v = clamp(py / Math.max(1, rect.height), 0, 1) - 0.5;

        var hotTarget = inside ? 1 : 0;
        st.hot += (hotTarget - st.hot) * (1 - Math.exp(-dt / (hotTarget > st.hot ? 0.14 : 0.32)));
        if (Math.abs(hotTarget - st.hot) < 0.002) st.hot = hotTarget; else busy = true;

        var targets = [
          inside && motion ? -v * 2 * TILT : 0,
          inside && motion ? u * 2 * TILT : 0,
          inside && motion ? u * 2 * MAGNET : 0,
          inside && motion ? v * 2 * MAGNET : 0
        ];
        var keys = [['rx', 'vrx'], ['ry', 'vry'], ['tx', 'vtx'], ['ty', 'vty']];
        var steps = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / steps;
        keys.forEach(function (pair, k) {
          var key = pair[0], vel = pair[1];
          st[vel] = st[vel] || 0;
          for (var s = 0; s < steps; s++) {
            st[vel] += (170 * (targets[k] - st[key]) - 20 * st[vel]) * h;
            st[key] += st[vel] * h;
          }
          if (Math.abs(targets[k] - st[key]) < 0.002 && Math.abs(st[vel]) < 0.01) {
            st[key] = targets[k]; st[vel] = 0;
          } else busy = true;
        });
        var pressTarget = pointer.down === i && motion ? 0.985 : 1;
        var pv = st.vpress = st.vpress || 0;
        for (var s2 = 0; s2 < steps; s2++) {
          pv += (420 * (pressTarget - st.press) - 28 * pv) * h;
          st.press += pv * h;
        }
        st.vpress = pv;
        if (Math.abs(pressTarget - st.press) < 0.0002 && Math.abs(pv) < 0.001) {
          st.press = pressTarget; st.vpress = 0;
        } else busy = true;

        write(card, st, '--mb-x', (pointer.x - rect.left).toFixed(1) + 'px');
        write(card, st, '--mb-y', (pointer.y - rect.top).toFixed(1) + 'px');
        write(card, st, '--mb-hot', st.hot.toFixed(3));
        write(card, st, '--mb-near', light.near.toFixed(3));
        write(card, st, '--mb-rx', st.rx.toFixed(3) + 'deg');
        write(card, st, '--mb-ry', st.ry.toFixed(3) + 'deg');
        write(card, st, '--mb-tx', st.tx.toFixed(2) + 'px');
        write(card, st, '--mb-ty', st.ty.toFixed(2) + 'px');
        write(card, st, '--mb-press', st.press.toFixed(4));
        write(card, st, '--mb-wx', (wave.x - rect.left).toFixed(1) + 'px');
        write(card, st, '--mb-wy', (wave.y - rect.top).toFixed(1) + 'px');
        write(card, st, '--mb-wr', wr.toFixed(1) + 'px');
        write(card, st, '--mb-wa', wa.toFixed(3));
      });
      if (busy && visible) raf = requestAnimationFrame(frame);
    }
    function wake() {
      if (raf || !visible || !motion) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    /* 折线图 scrub：只读取剪报页面已有的真实浏览量 */
    Array.prototype.forEach.call(root.querySelectorAll('[data-chart]'), function (chart) {
      var vals = [], labels = [];
      try { vals = JSON.parse(chart.dataset.values || '[]'); } catch (e) { /* 空数据 */ }
      try { labels = JSON.parse(chart.dataset.labels || '[]'); } catch (e2) { /* 空数据 */ }
      if (vals.length < 2) return;
      var shape = curve(vals, 100, 60);
      var plot = chart.querySelector('.mb-plot');
      var line = chart.querySelector('.mb-scrub');
      var dot = chart.querySelector('.mb-dot');
      var valueEl = chart.querySelector('.mb-chart-value');
      var noteEl = chart.querySelector('.mb-chart-note');
      var unit = chart.dataset.unit || '';
      var scrub = function (event) {
        var r = plot.getBoundingClientRect();
        var x = clamp((event.clientX - r.left) / Math.max(1, r.width) * 100, 0, 100);
        var y = sampleAt(shape.samples, x);
        var pos = x / 100 * (vals.length - 1);
        var i = Math.floor(pos), next = Math.min(vals.length - 1, i + 1);
        var val = vals[i] + (vals[next] - vals[i]) * (pos - i);
        chart.dataset.scrub = '';
        line.style.left = x.toFixed(2) + '%';
        dot.style.top = (y / 60 * 100).toFixed(2) + '%';
        valueEl.textContent = val.toFixed(1) + unit;
        noteEl.textContent = labels[Math.round(pos)] || '';
        wake();
      };
      var rest = function () {
        delete chart.dataset.scrub;
        valueEl.textContent = chart.dataset.initial || '';
        noteEl.textContent = chart.dataset.note || '';
      };
      chart.addEventListener('pointermove', scrub, { passive: true });
      chart.addEventListener('pointerdown', scrub, { passive: true });
      chart.addEventListener('pointerleave', rest);
    });

    /* 交错入场：任意部分进入视口即点亮，并加全局兜底，
       避免锚点直达 / 网格高于视口时数据看板整片停在 opacity:0 */
    var entered = !(motion && opt.intro !== false && 'IntersectionObserver' in window);
    function enter() {
      if (entered) return;
      entered = true;
      cells.forEach(function (cell) { cell.dataset.state = 'in'; });
      if (dirty) measure();
      wake();
    }
    document.addEventListener('fx:reveal-all', enter);
    setTimeout(enter, 1800);
    if (!entered) {
      var gate = new IntersectionObserver(function (entries, observer) {
        if (!entries.some(function (e) { return e.isIntersecting; })) return;
        observer.disconnect();
        enter();
      }, { threshold: 0, rootMargin: '15% 0px 15% 0px' });
      gate.observe(root);
    } else {
      cells.forEach(function (cell) {
        cell.style.setProperty('--mb-delay', '0ms');
        cell.dataset.state = 'in';
      });
    }

    var visibility = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
      visible = entries.some(function (e) { return e.isIntersecting; });
      if (visible) { dirty = true; wake(); }
    }) : null;
    if (visibility) visibility.observe(root);

    root.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; wake();
    }, { passive: true });
    root.addEventListener('pointerleave', function () {
      pointer.inside = false; pointer.down = -1; wake();
    });
    root.addEventListener('pointerdown', function (e) {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true;
      pointer.down = indexOf(e.target); wake();
    }, { passive: true });
    window.addEventListener('pointerup', function () { pointer.down = -1; wake(); }, { passive: true });
    window.addEventListener('pointercancel', function () { pointer.down = -1; wake(); }, { passive: true });
    root.addEventListener('click', function (e) {
      var i = indexOf(e.target);
      if (i >= 0) activate(i, e.clientX, e.clientY);
    });
    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var i = indexOf(e.target);
      if (i < 0 || e.target !== cards[i]) return;
      e.preventDefault();
      var r = cards[i].getBoundingClientRect();
      activate(i, r.left + r.width / 2, r.top + r.height / 2);
    });
    var onScroll = function () { dirty = true; wake(); };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll, { passive: true });
    setTimeout(function () { dirty = true; wake(); }, 80);
  }

  window.MagicBento = { init: init };
})();

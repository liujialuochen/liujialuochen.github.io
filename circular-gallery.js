/* ===========================================================
   CircularGallery · ReactBits Pro「CircularGallery」原生等价实现
   -----------------------------------------------------------
   按用户第 22 轮提供的 React + GLSL 规格移植到零依赖静态站：
     · WebGL2 32×24 分段网格，卡片沿圆弧排布（bend）、
       随拖拽速度产生顶点波浪（wave）、边缘淡出（fadeEdges）
     · intro 入场、hover 抬升、拖拽惯性 + 吸附（snap）、
       autoScroll、键盘导航、环形描边、纸片投影
     · 点击卡片在画布内聚焦放大（focus / open），其它卡淡出，
       出现说明文字与关闭按钮；再次点击或「放大查看原图」进入全屏观图层
   针对作品集「内容切片」的两处关键调整：
     1) 封面必须完整清晰呈现截图全貌 —— 卡片宽高按每张截图的
        真实比例计算，片元着色器用 contain（留米白边）而不是 cover，
        绝不裁掉底部「34.1万浏览」等数据；纹理用 LINEAR 双线性、
        不生成 mipmap，避免磨砂感；grayscale / blur 一律为 0。
     2) 纵向滚轮不劫持，页面仍可正常向下滚动。
   =========================================================== */
(function () {
  'use strict';

  const SEG_X = 32, SEG_Y = 24;
  const INTRO_SECONDS = 1.4;
  const WORLD_HEIGHT = 16.57;
  const PAPER = [1.0, 0.988, 0.973];   // #FFFCF8
  const INK = [0.118, 0.188, 0.369];   // #1E305E

  const VERTEX = `#version 300 es
  in vec2 aPosition;
  uniform vec2 uResolution;
  uniform vec2 uCenter;
  uniform vec2 uSize;
  uniform float uAngle;
  uniform float uPad;
  uniform float uWave;
  uniform float uWaveTime;
  uniform float uFocal;
  out vec2 vLocal;
  void main() {
    vec2 local = aPosition * (uSize + 2.0 * uPad);
    vec2 unit = local / max(uSize, vec2(1.0));
    float z = uWave * (sin(unit.x * 4.0 + uWaveTime) + cos(unit.y * 2.0 + uWaveTime)) * 0.5;
    float depth = uFocal / max(uFocal - z, 1.0);
    float c = cos(uAngle);
    float s = sin(uAngle);
    vec2 turned = vec2(c * local.x - s * local.y, s * local.x + c * local.y);
    vLocal = local;
    gl_Position = vec4((uCenter + turned * depth) / (uResolution * 0.5), 0.0, 1.0);
  }`;

  const FRAGMENT = `#version 300 es
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uImageAspect;
  uniform float uReady;
  uniform vec3 uPaper;
  uniform vec3 uRingColor;
  uniform float uGray;
  uniform float uDim;
  uniform float uAlpha;
  uniform float uRing;
  uniform float uRingWidth;
  uniform float uRingGap;
  uniform float uFade;
  uniform float uShadow;
  uniform float uBlur;
  uniform vec2 uShadowOffset;
  in vec2 vLocal;
  out vec4 outColor;

  float roundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  float smoother(float x) {
    x = clamp(x, 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
  }
  float edgeFade() {
    if (uFade <= 0.0) return 1.0;
    float u = gl_FragCoord.x / uResolution.x;
    return smoother(u / uFade) * smoother((1.0 - u) / uFade);
  }
  void main() {
    vec2 extent = uSize * 0.5;
    if (uShadow > 0.0) {
      float d = roundBox(vLocal - uShadowOffset, extent, uRadius);
      float a = uShadow * (1.0 - smoothstep(-uBlur, uBlur, d)) * uAlpha * edgeFade();
      outColor = vec4(0.0, 0.0, 0.0, a);
      return;
    }
    float d = roundBox(vLocal, extent, uRadius);
    float pixel = max(length(vec2(dFdx(d), dFdy(d))), 1e-4);
    float cover = clamp(0.5 - d / pixel, 0.0, 1.0);
    vec2 uv = vLocal / uSize + 0.5;
    float aspect = uSize.x / max(uSize.y, 1.0);
    /* 完整呈现截图全貌：contain 等比缩放，多出的部分留米白，
       绝不裁掉上下两端的数据栏（官方默认是 cover 裁切）。 */
    vec2 scale = aspect > uImageAspect
      ? vec2(aspect / uImageAspect, 1.0)
      : vec2(1.0, uImageAspect / aspect);
    vec2 t = (uv - 0.5) * scale + 0.5;
    vec3 image = (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0)
      ? uPaper : texture(uTexture, t).rgb;
    vec3 color = mix(uPaper, image, uReady);
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(color, vec3(luma), uGray) * (1.0 - uDim);
    float body = cover * mix(0.08, 1.0, uReady);
    float band = abs(d - uRingGap - uRingWidth * 0.5) - uRingWidth * 0.5;
    float ring = clamp(0.5 - band / pixel, 0.0, 1.0) * uRing;
    vec4 card = vec4(color * body, body);
    vec4 outline = vec4(uRingColor * ring, ring);
    outColor = (card + outline * (1.0 - card.a)) * uAlpha * edgeFade();
  }`;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = v => v * v * (3 - 2 * v);
  const wrap = (v, n) => ((v % n) + n) % n;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return sh;
    console.warn('CircularGallery shader:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  function link(gl) {
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return null;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPosition');
    gl.linkProgram(prog);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('CircularGallery link:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return null;
    }
    const u = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (info) u[info.name] = gl.getUniformLocation(prog, info.name);
    }
    return { program: prog, u: u };
  }

  function normalize(item) {
    return typeof item === 'string' ? { image: item, text: '', description: '', alt: '' } : {
      image: item.image || item.src || '',
      viewer: item.viewer || item.image || item.src || '',
      text: item.text || '',
      description: item.description || item.label || item.alt || '',
      alt: item.alt || item.text || ''
    };
  }

  function init(root, items, options) {
    if (!root || !Array.isArray(items) || !items.length) return null;
    const list = items.map(normalize);
    const count = list.length;
    const opt = Object.assign({
      bend: 2.2,
      textColor: '#1E305E',
      borderRadius: 0.012,
      scrollSpeed: 2,
      scrollEase: 0.05,
      itemSize: 1.06,
      itemAspect: 0.55,      // 仅用于计算间距的代表比例，实际卡宽按每张图真实比例
      gap: 0.26,
      wave: 0.6,
      fadeEdges: 0.07,
      shadow: 0.22,
      grayscale: false,
      showTitles: true,
      snap: true,
      autoScroll: 0,
      openOnClick: true,
      intro: true,
      dpr: 0,
      labelPrefix: 'SLICE',
      hint: '拖拽 / ← → 切换 · 点击卡片聚焦 · 放大查看原图',
      onItemClick: null,
      onActiveChange: null
    }, options || {});

    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    root.classList.add('cgv2');
    root.innerHTML =
      '<div class="circular-gallery cgv2-stage" role="region" aria-roledescription="carousel"' +
        ' aria-label="内容切片弧形画廊，可拖拽或用方向键切换，点击卡片放大查看" tabindex="0">' +
        '<canvas class="circular-gallery-canvas" aria-hidden="true"></canvas>' +
        '<div class="circular-gallery-labels" aria-hidden="true"></div>' +
        '<div class="circular-gallery-caption" aria-hidden="true">' +
          '<p class="circular-gallery-caption-text"></p>' +
          '<button class="cgv2-zoom" type="button">放大查看原图 <span aria-hidden="true">↗</span></button>' +
        '</div>' +
        '<button class="circular-gallery-close" type="button" aria-label="关闭聚焦" data-gallery-close>' +
          '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">' +
          '<path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
        '</button>' +
        '<ul class="circular-gallery-hidden" data-gallery-list>' +
          list.map((it, i) => '<li><button type="button" tabindex="-1" data-index="' + i + '">' +
            esc(it.text || it.alt || ('切片 ' + (i + 1))) + '，第 ' + (i + 1) + ' / ' + count + ' 张</button></li>').join('') +
        '</ul>' +
        '<div class="circular-gallery-hidden" aria-live="polite"></div>' +
      '</div>' +
      '<div class="cgv2-ui">' +
        '<button class="cgv2-arrow" type="button" data-dir="-1" aria-label="上一张内容切片">← <span>PREV</span></button>' +
        '<span class="cgv2-count eyebrow">01 / ' + String(count).padStart(2, '0') + '</span>' +
        '<button class="cgv2-arrow" type="button" data-dir="1" aria-label="下一张内容切片"><span>NEXT</span> →</button>' +
        '<span class="cgv2-hint eyebrow">' + esc(opt.hint) + '</span>' +
      '</div>';

    const stage = root.querySelector('.cgv2-stage');
    const canvas = root.querySelector('.circular-gallery-canvas');
    const labels = root.querySelector('.circular-gallery-labels');
    const caption = root.querySelector('.circular-gallery-caption');
    const captionText = root.querySelector('.circular-gallery-caption-text');
    const zoomBtn = root.querySelector('.cgv2-zoom');
    const closeBtn = root.querySelector('.circular-gallery-close');
    const countEl = root.querySelector('.cgv2-count');
    const live = root.querySelector('[aria-live]');
    const hiddenBtns = [...root.querySelectorAll('[data-gallery-list] button')];

    /* 全屏观图层：始终能看到未经裁切、未经缩放处理的原始截图 */
    const lbItems = list.map((it, i) => ({
      src: it.image, viewer: it.viewer,
      title: it.description || it.text || it.alt,
      alt: it.alt, no: opt.labelPrefix + ' ' + String(i + 1).padStart(2, '0')
    }));
    const showLightbox = index => {
      if (window.Lightbox) window.Lightbox.open(lbItems, index);
    };

    /* ---------- WebGL2 不可用：DOM 横滑降级（图片完整不裁切） ---------- */
    const gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false
    });
    const prog = gl ? link(gl) : null;
    if (!gl || !prog) {
      root.classList.add('is-fallback');
      stage.innerHTML = '<div class="cgv2-fallback">' + list.map((it, i) =>
        '<button class="cgv2-fcard" type="button" data-index="' + i + '" aria-label="放大查看 ' + esc(it.text) + '">' +
          '<img src="' + esc(it.image) + '" alt="' + esc(it.alt) + '" loading="lazy" draggable="false">' +
          '<span class="cgv2-fmeta"><span class="eyebrow">' + opt.labelPrefix + ' ' +
          String(i + 1).padStart(2, '0') + '</span><span class="serif">' + esc(it.text) + '</span></span>' +
        '</button>').join('') + '</div>';
      stage.querySelectorAll('.cgv2-fcard').forEach(b =>
        b.addEventListener('click', () => showLightbox(Number(b.dataset.index))));
      root.querySelectorAll('.cgv2-arrow').forEach(b => b.addEventListener('click', () => {
        const strip = stage.querySelector('.cgv2-fallback');
        const card = strip && strip.querySelector('.cgv2-fcard');
        if (card) strip.scrollBy({ left: (card.offsetWidth + 18) * Number(b.dataset.dir), behavior: 'smooth' });
      }));
      return { open: showLightbox, focus: () => {}, close: () => {}, destroy: () => {} };
    }

    const u = prog.u;
    const COUNT = SEG_X * SEG_Y * 6;
    const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');

    /* ---------- 几何 ---------- */
    const vertices = [];
    for (let y = 0; y <= SEG_Y; y++)
      for (let x = 0; x <= SEG_X; x++) vertices.push(x / SEG_X - 0.5, y / SEG_Y - 0.5);
    const indices = [];
    for (let y = 0; y < SEG_Y; y++) for (let x = 0; x < SEG_X; x++) {
      const a = y * (SEG_X + 1) + x, b = a + 1, c = a + SEG_X + 1, d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    const blank = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blank);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

    /* ---------- 纹理：清晰直出，不生成 mipmap ---------- */
    const textures = new Map();
    function textureFor(item) {
      const url = item.image;
      if (textures.has(url)) return textures.get(url);
      const entry = { texture: null, aspect: opt.itemAspect, ready: 0, loaded: false };
      textures.set(url, entry);
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (!textures.has(url)) return;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        /* LINEAR 双线性：不 generateMipmap、不用 LINEAR_MIPMAP_LINEAR，
           避免小尺寸卡片被多级采样糊成磨砂感 */
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (anisotropy) {
          const max = gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
          gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
        }
        entry.texture = tex;
        entry.aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
        entry.loaded = true;
        wake();
      };
      img.src = url;
      return entry;
    }
    list.forEach(textureFor);

    const view = { width: 1, height: 1, ratio: 1 };
    const state = {
      scroll: 0, target: 0, velocity: 0,
      open: 0, openTarget: 0,
      intro: (opt.intro && !reduce) ? 0 : 1,
      waveTime: 0, ring: 0, keyboard: false,
      hovered: null, hover: new Map(), focus: new Map(),
      drag: null, lastInput: 0, active: 0, spacing: 1
    };
    let cards = [], pool = [], raf = 0, last = 0, visible = true, snapTimer = 0, resizePending = false;

    function measure() {
      let h = 0.6 * view.height * opt.itemSize;
      const repW = h * opt.itemAspect;
      const scale = Math.min(1, (view.width * 0.82) / Math.max(repW, 1));
      h *= scale;
      const w = h * opt.itemAspect;
      return { w: w, h: h, spacing: w * (1 + opt.gap) };
    }
    function arcOf(x) {
      if (!opt.bend) return { y: 0, angle: 0 };
      const depth = Math.abs(opt.bend) * view.height / WORLD_HEIGHT;
      const half = Math.max(view.width, view.height * 1.9) / 2;
      const radius = (half * half + depth * depth) / (2 * depth);
      const reach = Math.min(Math.abs(x), half, radius * 0.999);
      const arc = radius - Math.sqrt(radius * radius - reach * reach);
      const angle = Math.sign(x) * Math.asin(reach / radius);
      return opt.bend > 0 ? { y: -arc, angle: -angle } : { y: arc, angle: angle };
    }
    const captionSize = () => clamp(view.height * 0.045, 15, 22);

    function openFrame(item) {
      const aspect = clamp(textureFor(item).aspect, 0.35, 2.4);
      const titleSpace = item.text && opt.showTitles ? captionSize() * 2.1 : 0;
      const captionSpace = titleSpace + (item.description ? 56 : 0);
      const margin = Math.max(20, Math.min(view.width, view.height) * 0.055);
      const width = Math.min(view.width - margin * 2,
        (view.height - margin * 2 - captionSpace) * aspect);
      return { width: Math.max(60, width), height: Math.max(80, width / aspect),
               y: captionSpace / 2, titleSpace: titleSpace };
    }

    function ensurePool(spacing) {
      const size = Math.ceil(view.width / Math.max(spacing, 1)) + 8;
      if (pool.length === size) return;
      labels.replaceChildren();
      pool = Array.from({ length: size }, () => {
        const el = document.createElement('span');
        el.className = 'circular-gallery-label cgv2-label';
        el.style.opacity = '0';
        labels.appendChild(el);
        return { el: el, slot: null, html: '' };
      });
    }

    function layout() {
      const m = measure();
      state.spacing = m.spacing;
      const introEase = 1 - Math.pow(1 - state.intro, 3);
      const scroll = state.scroll + (1 - introEase) * m.spacing * 1.6;
      const baseLabel = clamp(m.h * 0.052, 12, 19);
      const activeFrame = openFrame(list[wrap(state.active, count)]);
      const spread = Math.max(0, activeFrame.width / 2 - m.w / 2);
      const activeX = state.active * m.spacing - scroll;
      const first = Math.floor((scroll - view.width / 2 - m.spacing * 2) / m.spacing);
      const lastSlot = Math.ceil((scroll + view.width / 2 + m.spacing * 2) / m.spacing);
      const next = [];
      let lead = null;
      for (let slot = first; slot <= lastSlot; slot++) {
        const index = wrap(slot, count);
        const item = list[index];
        const entry = textureFor(item);
        const f = ease(state.focus.get(slot) || 0);
        const ownAspect = clamp(entry.aspect, 0.35, 2.4);
        let x = slot * m.spacing - scroll;
        x += Math.sign(x - activeX) * state.open * (1 - f) * spread;
        const arc = arcOf(x);
        const frame = f > 0 ? openFrame(item) : activeFrame;
        const order = Math.abs(slot * m.spacing - state.scroll) / m.spacing;
        const shown = ease(clamp(state.intro * 2.2 - order * 0.22, 0, 1));
        const hover = state.hover.get(slot) || 0;
        const lift = 1 + hover * 0.04 * (1 - f);
        const card = {
          slot: slot, index: index, item: item, entry: entry, frame: frame,
          x: mix(x, 0, f),
          y: mix(arc.y, frame.y, f) - (1 - shown) * m.h * 0.18,
          angle: arc.angle * (1 - f),
          w: mix(m.h * ownAspect, frame.width, f) * lift,
          h: mix(m.h, frame.height, f) * lift,
          radius: opt.borderRadius * Math.min(m.w, m.h),
          alpha: shown * mix(1, 0.12, state.open * (1 - f)),
          dim: state.open * (1 - f) * 0.4,
          gray: 0,
          focus: f,
          labelAlpha: mix(1 - state.open, 1, f),
          labelSize: mix(baseLabel, captionSize(), f)
        };
        if (!lead || f > lead.focus) lead = card;
        next.push(card);
      }
      next.sort((a, b) => a.focus - b.focus || Math.abs(b.x) - Math.abs(a.x));
      cards = next;
      const frame = lead && lead.focus > 0 ? lead.frame : activeFrame;
      return { w: m.w, h: m.h, spacing: m.spacing,
               openH: frame.height, openY: frame.y, titleSpace: frame.titleSpace };
    }

    function draw(m) {
      const ratio = view.ratio;
      const speed = Math.min(Math.abs(state.velocity) / Math.max(m.spacing * 4, 1), 1);
      const wavePx = reduce ? 0 : opt.wave * speed * view.height * 0.08 * ratio;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(prog.program);
      gl.bindVertexArray(vao);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      gl.uniform1f(u.uFocal, view.height * 1.207 * ratio);
      gl.uniform1f(u.uWaveTime, state.waveTime);
      gl.uniform1f(u.uFade, opt.fadeEdges);
      gl.uniform3fv(u.uPaper, PAPER);
      gl.uniform3fv(u.uRingColor, INK);
      gl.uniform1f(u.uRingWidth, 2 * ratio);
      gl.uniform1f(u.uRingGap, 5 * ratio);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(u.uTexture, 0);

      const blur = Math.max(10, m.h * 0.09) * ratio;
      const place = card => {
        gl.uniform2f(u.uCenter, card.x * ratio, card.y * ratio);
        gl.uniform2f(u.uSize, card.w * ratio, card.h * ratio);
        gl.uniform1f(u.uAngle, card.angle);
        gl.uniform1f(u.uRadius, Math.min(card.radius, card.w / 2, card.h / 2) * ratio);
        gl.uniform1f(u.uWave, wavePx * (1 - card.focus));
        gl.uniform1f(u.uAlpha, card.alpha);
      };
      if (opt.shadow > 0) {
        gl.uniform1f(u.uShadow, opt.shadow);
        gl.uniform1f(u.uBlur, blur);
        gl.uniform2f(u.uShadowOffset, 0, -blur * 0.45);
        gl.uniform1f(u.uPad, blur * 1.6);
        gl.bindTexture(gl.TEXTURE_2D, blank);
        cards.forEach(card => { place(card); gl.drawElements(gl.TRIANGLES, COUNT, gl.UNSIGNED_SHORT, 0); });
      }
      gl.uniform1f(u.uShadow, 0);
      gl.uniform1f(u.uPad, 10 * ratio);
      cards.forEach(card => {
        place(card);
        gl.bindTexture(gl.TEXTURE_2D, card.entry.texture || blank);
        gl.uniform1f(u.uImageAspect, card.entry.aspect || 1);
        gl.uniform1f(u.uReady, card.entry.ready);
        gl.uniform1f(u.uGray, card.gray);
        gl.uniform1f(u.uDim, card.dim);
        gl.uniform1f(u.uRing, card.slot === state.active ? state.ring * (1 - card.focus) : 0);
        gl.drawElements(gl.TRIANGLES, COUNT, gl.UNSIGNED_SHORT, 0);
      });
    }

    function placeLabels(m) {
      ensurePool(m.spacing);
      const used = new Set();
      const fade = value => {
        if (opt.fadeEdges <= 0) return 1;
        const t = clamp(value / opt.fadeEdges, 0, 1);
        return t * t * t * (t * (t * 6 - 15) + 10);
      };
      if (opt.showTitles) {
        cards.forEach(card => {
          if (!card.item.text) return;
          const entry = pool[wrap(card.slot, pool.length)];
          used.add(entry);
          const html = '<span class="cgv2-label-no eyebrow">' + esc(opt.labelPrefix) + ' ' +
            String(card.index + 1).padStart(2, '0') +
            '</span><span class="cgv2-label-text serif">' + esc(card.item.text) + '</span>';
          if (entry.slot !== card.slot || entry.html !== html) {
            entry.slot = card.slot; entry.html = html; entry.el.innerHTML = html;
          }
          const size = card.labelSize;
          const offset = card.h / 2 + size * 1.05;
          const x = card.x + Math.sin(card.angle) * offset;
          const y = card.y - Math.cos(card.angle) * offset;
          const cssX = view.width / 2 + x;
          const cssY = view.height / 2 - y;
          const edge = fade(cssX / view.width) * fade(1 - cssX / view.width);
          entry.el.style.fontSize = size.toFixed(1) + 'px';
          entry.el.style.color = opt.textColor;
          entry.el.style.transform = 'translate(' + cssX.toFixed(1) + 'px,' + cssY.toFixed(1) +
            'px) translate(-50%,-50%) rotate(' + (-card.angle).toFixed(4) + 'rad)';
          entry.el.style.opacity = String(clamp(card.alpha * card.labelAlpha * mix(edge, 1, card.focus), 0, 1));
        });
      }
      pool.forEach(entry => {
        if (!used.has(entry) && entry.el.style.opacity !== '0') entry.el.style.opacity = '0';
      });
      const top = view.height / 2 - (m.openY - m.openH / 2) + m.titleSpace + 4;
      caption.style.transform = 'translate(-50%,' + top.toFixed(1) + 'px)';
      caption.style.opacity = String(ease(clamp((state.open - 0.5) / 0.5, 0, 1)));
      caption.style.color = opt.textColor;
      captionText.textContent = list[wrap(state.active, count)].description || '';
    }

    const nearest = () => Math.round(state.target / Math.max(state.spacing, 1));
    function setSlot(slot, announce) {
      state.target = slot * state.spacing;
      if (slot !== state.active) {
        state.active = slot;
        const index = wrap(slot, count);
        if (announce !== false) {
          countEl.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(count).padStart(2, '0');
          captionText.textContent = list[index].description || '';
          if (typeof opt.onActiveChange === 'function') opt.onActiveChange(index);
        }
      }
      wake();
    }
    function setOpen(on) {
      if (on) {
        closeBtn.setAttribute('data-visible', '');
        closeBtn.tabIndex = 0;
        caption.setAttribute('data-visible', '');
        caption.removeAttribute('aria-hidden');
      } else {
        closeBtn.removeAttribute('data-visible');
        closeBtn.tabIndex = -1;
        caption.removeAttribute('data-visible');
        caption.setAttribute('aria-hidden', 'true');
      }
      live.textContent = on ? (list[wrap(state.active, count)].text + ' 已放大') : '';
    }
    function openSlot(slot) {
      setSlot(slot);
      state.openTarget = 1;
      setOpen(true);
      wake();
    }
    function close() {
      state.openTarget = 0;
      setOpen(false);
      wake();
    }

    function frame(now) {
      raf = 0;
      if (resizePending) { resizePending = false; applyResize(); }
      if (!visible || document.hidden) return;
      const dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
      last = now;
      const idle = now - state.lastInput > 1800;
      const auto = opt.autoScroll && !reduce && !state.drag && state.open < 0.01 &&
        state.hovered === null && !state.keyboard && idle;
      if (auto) state.target += opt.autoScroll * state.spacing * 0.25 * dt;
      const follow = reduce ? 1 : 1 - Math.pow(1 - opt.scrollEase, dt * 60);
      const before = state.scroll;
      state.scroll += (state.target - state.scroll) * follow;
      if (Math.abs(state.target - state.scroll) < 0.05) state.scroll = state.target;
      const velocity = (state.scroll - before) / dt;
      state.velocity += (velocity - state.velocity) * (1 - Math.exp(-dt / 0.08));
      if (Math.abs(state.velocity) < 0.5) state.velocity = 0;
      state.waveTime += dt * 2.4;
      const openFollow = reduce ? 1 : 1 - Math.exp(-dt / 0.14);
      state.open += (state.openTarget - state.open) * openFollow;
      if (Math.abs(state.openTarget - state.open) < 0.001) state.open = state.openTarget;
      state.ring += ((state.keyboard ? 1 : 0) - state.ring) * (1 - Math.exp(-dt / 0.1));
      if (Math.abs((state.keyboard ? 1 : 0) - state.ring) < 0.002) state.ring = state.keyboard ? 1 : 0;
      if (state.intro < 1) state.intro = Math.min(1, state.intro + dt / INTRO_SECONDS);
      let settling = false;
      state.hover.forEach((value, slot) => {
        const goal = slot === state.hovered ? 1 : 0;
        const nxt = value + (goal - value) * (1 - Math.exp(-dt / 0.12));
        if (Math.abs(goal - nxt) < 0.002) {
          if (goal === 0) state.hover.delete(slot); else state.hover.set(slot, 1);
        } else { state.hover.set(slot, nxt); settling = true; }
      });
      if (state.openTarget > 0 && !state.focus.has(state.active)) state.focus.set(state.active, 0);
      state.focus.forEach((value, slot) => {
        const goal = state.openTarget > 0 && slot === state.active ? 1 : 0;
        const nxt = reduce ? goal : value + (goal - value) * (1 - Math.exp(-dt / 0.16));
        if (Math.abs(goal - nxt) < 0.001) {
          if (goal === 0) state.focus.delete(slot); else state.focus.set(slot, 1);
        } else { state.focus.set(slot, nxt); settling = true; }
      });
      textures.forEach(entry => {
        if (!entry.loaded || entry.ready >= 1) return;
        entry.ready = reduce ? 1 : Math.min(1, entry.ready + dt / 0.45);
        settling = true;
      });
      const slot = auto ? Math.round(state.scroll / Math.max(state.spacing, 1)) : nearest();
      if (slot !== state.active && !state.drag) {
        state.active = slot;
        const index = wrap(slot, count);
        countEl.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(count).padStart(2, '0');
        captionText.textContent = list[index].description || '';
        if (typeof opt.onActiveChange === 'function') opt.onActiveChange(index);
      }
      const m = layout();
      draw(m);
      placeLabels(m);
      const moving = (opt.autoScroll && !reduce) || state.scroll !== state.target ||
        state.velocity !== 0 || state.open !== state.openTarget || state.intro < 1 ||
        (state.ring !== 0 && state.ring !== 1) || settling;
      if (moving) raf = requestAnimationFrame(frame);
      else last = 0;
    }
    function wake() {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }

    function applyResize() {
      view.width = Math.max(1, stage.clientWidth);
      view.height = Math.max(1, stage.clientHeight);
      view.ratio = Math.min(opt.dpr || window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(view.width * view.ratio));
      canvas.height = Math.max(1, Math.round(view.height * view.ratio));
      const before = state.spacing;
      const spacing = measure().spacing;
      if (before > 1 && spacing !== before) {
        state.scroll = state.scroll / before * spacing;
        state.target = state.target / before * spacing;
      }
      state.spacing = spacing;
      wake();
    }
    const resize = () => { resizePending = true; wake(); };

    /* ---------- 交互 ---------- */
    const point = event => {
      const r = stage.getBoundingClientRect();
      return { x: event.clientX - r.left - r.width / 2, y: r.height / 2 - (event.clientY - r.top) };
    };
    function hit(p) {
      for (let i = cards.length - 1; i >= 0; i--) {
        const card = cards[i];
        if (card.alpha < 0.05) continue;
        const dx = p.x - card.x, dy = p.y - card.y;
        const c = Math.cos(-card.angle), s = Math.sin(-card.angle);
        const lx = c * dx - s * dy, ly = s * dx + c * dy;
        if (Math.abs(lx) <= card.w / 2 && Math.abs(ly) <= card.h / 2) return card;
      }
      return null;
    }
    function setPointer(card) {
      const slot = card ? card.slot : null;
      if (slot !== state.hovered) {
        state.hovered = slot;
        if (slot !== null && !state.hover.has(slot)) state.hover.set(slot, 0);
        wake();
      }
      stage.setAttribute('data-pointer', card ? '' : 'null');
      if (!card) stage.removeAttribute('data-pointer');
    }
    function snapNow() {
      if (!opt.snap && state.open < 0.5) return;
      setSlot(nearest());
    }
    const onPointerDown = event => {
      if (event.button !== 0 || event.target.closest('[data-gallery-close]')) return;
      const p = point(event);
      state.drag = { id: event.pointerId, x0: event.clientX, y0: event.clientY,
                     start: state.target, moved: false, samples: [], p: p };
      state.lastInput = performance.now();
      wake();
    };
    const onPointerMove = event => {
      const drag = state.drag;
      if (drag && drag.id === event.pointerId) {
        const dx = event.clientX - drag.x0, dy = event.clientY - drag.y0;
        if (!drag.moved && Math.hypot(dx, dy) > 6) {
          if (Math.abs(dy) > Math.abs(dx) && event.pointerType !== 'mouse') { state.drag = null; return; }
          drag.moved = true;
          stage.setPointerCapture && stage.setPointerCapture(event.pointerId);
          stage.setAttribute('data-dragging', '');
          setPointer(null);
        }
        if (drag.moved) {
          state.target = drag.start - dx * (opt.scrollSpeed / 2);
          drag.samples.push({ x: event.clientX, t: performance.now() });
          if (drag.samples.length > 6) drag.samples.shift();
          state.lastInput = performance.now();
          wake();
        }
        return;
      }
      if (event.pointerType === 'mouse') setPointer(hit(point(event)));
    };
    const onPointerUp = event => {
      const drag = state.drag;
      if (!drag || drag.id !== event.pointerId) return;
      state.drag = null;
      stage.removeAttribute('data-dragging');
      if (stage.hasPointerCapture && stage.hasPointerCapture(event.pointerId))
        stage.releasePointerCapture(event.pointerId);
      if (drag.moved) {
        const samples = drag.samples;
        if (samples.length > 1) {
          const a = samples[0], b = samples[samples.length - 1];
          const speed = ((b.x - a.x) / Math.max(b.t - a.t, 16)) * 1000;
          state.target -= speed * 0.18 * (opt.scrollSpeed / 2);
        }
        snapNow();
        return;
      }
      const card = hit(drag.p);
      if (!card) { if (state.open > 0.5) close(); return; }
      if (typeof opt.onItemClick === 'function') { opt.onItemClick(card.item, card.index); return; }
      if (!opt.openOnClick) { setSlot(card.slot); return; }
      /* 已聚焦的卡片再点一次：直接进全屏观图层看完整原图 */
      if (state.open > 0.5 && card.slot === state.active) showLightbox(card.index);
      else openSlot(card.slot);
    };
    const onPointerCancel = event => {
      if (state.drag && state.drag.id === event.pointerId) {
        state.drag = null; stage.removeAttribute('data-dragging'); snapNow();
      }
    };
    /* 纵向滚轮留给页面；只响应横向滚轮 / 触控板横扫 */
    const onWheel = event => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || !event.deltaX) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.height : 1;
      state.target += event.deltaX * unit * (opt.scrollSpeed / 2);
      state.lastInput = performance.now();
      clearTimeout(snapTimer);
      snapTimer = setTimeout(snapNow, 140);
      wake();
    };
    const STEPS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const onKeyDown = event => {
      state.lastInput = performance.now();
      const step = STEPS[event.key];
      if (step) {
        event.preventDefault();
        state.keyboard = true;
        setSlot(nearest() + step);
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const base = nearest() - wrap(nearest(), count);
        setSlot(event.key === 'Home' ? base : base + count - 1);
        return;
      }
      if (event.key === 'Escape' && state.openTarget > 0) { event.preventDefault(); close(); }
      if ((event.key === 'Enter' || event.key === ' ') && event.target === stage) {
        event.preventDefault();
        showLightbox(wrap(state.active, count));
      }
    };
    const onFocusIn = event => {
      if (!event.target.closest('[data-gallery-list]')) return;
      state.keyboard = true;
      wake();
    };
    const onFocusOut = event => {
      if (!stage.contains(event.relatedTarget)) { state.keyboard = false; wake(); }
    };
    const onVisibility = () => { last = 0; wake(); };

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerCancel);
    stage.addEventListener('pointerleave', () => setPointer(null));
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('keydown', onKeyDown);
    stage.addEventListener('focusin', onFocusIn);
    stage.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', onVisibility);
    closeBtn.addEventListener('click', close);
    zoomBtn.addEventListener('click', () => showLightbox(wrap(state.active, count)));
    root.querySelectorAll('.cgv2-arrow').forEach(btn => btn.addEventListener('click', () => {
      state.keyboard = true;
      setSlot(nearest() + Number(btn.dataset.dir));
    }));
    hiddenBtns.forEach(btn => {
      const index = Number(btn.dataset.index);
      btn.addEventListener('focus', () => {
        const slot = nearest();
        const base = slot - wrap(slot, count) + index;
        const best = [base - count, base, base + count].reduce((a, v) =>
          Math.abs(v - slot) < Math.abs(a - slot) ? v : a);
        setSlot(best, false);
      });
      btn.addEventListener('click', () => openSlot(slotFor(index)));
    });
    function slotFor(index) {
      const slot = nearest();
      const base = slot - wrap(slot, count) + index;
      return [base - count, base, base + count].reduce((a, v) =>
        Math.abs(v - slot) < Math.abs(a - slot) ? v : a);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    const io = new IntersectionObserver(entries => {
      visible = entries.some(e => e.isIntersecting);
      if (visible) { last = 0; wake(); }
    });
    io.observe(stage);
    applyResize();

    return {
      wake: wake,
      open: index => openSlot(slotFor(index)),
      focus: index => setSlot(slotFor(index), false),
      close: close,
      destroy: () => {
        cancelAnimationFrame(raf);
        clearTimeout(snapTimer);
        ro.disconnect(); io.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        textures.forEach(entry => { if (entry.texture) gl.deleteTexture(entry.texture); });
        gl.deleteTexture(blank);
        gl.deleteProgram(prog.program);
        gl.deleteBuffer(vb); gl.deleteBuffer(ib); gl.deleteVertexArray(vao);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    };
  }

  window.CircularGallery = { init: init };
})();

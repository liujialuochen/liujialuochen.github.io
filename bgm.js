/* ===========================================================
   背景音乐 / BGM —— 零依赖原生实现
   -----------------------------------------------------------
   曲库：freesafemusic.com（License & Usage：免费商用、无需署名、
   允许 trim / fade / loop；仅禁止单独转售或再分发原始音频文件）。
   四首均为器乐纯音乐，按「抒情 → 轻快」排列，默认第一首。

   ★ 与开场短片错峰播放（本轮改动）：
     1. 页面打开后先完整播一次开场短片，这一整段 BGM 不启动、不出声；
     2. 短片结束（或被浏览器拦下 / 滚离首屏的兜底）后，BGM 才淡入；
     3. 之后任何时候点击重播短片，BGM 立即暂停让位，短片结束 / 暂停
        再从当前进度接续 —— 两路声音绝不同时播放。
     4. 主流浏览器仍禁止「无用户交互的有声自动播放」：短片结束后先按
        有声发起，成功就淡入；被拦则静音走时间轴并显示「开启音乐」入口，
        首次真实交互（点击 / 按键 / 触摸）立即解除静音。
   用户主动关闭后写入 localStorage，下次访问不再自动播放。
   =========================================================== */
(function () {
  'use strict';

  // title 为曲库发布名；mood 是站内按情绪做的中文氛围标注，不是官方译名。
  var TRACKS = [
    { id: 'lsff', src: 'assets/audio/lsff.mp3', title: 'Desk by the Window', mood: '抒情 · 波萨诺瓦轻快' },
    { id: 'h91w', src: 'assets/audio/h91w.mp3', title: 'Morning in Ipanema', mood: '明亮 · 木吉他轻快' },
    { id: 'zj7a', src: 'assets/audio/zj7a.mp3', title: 'Whispers in Time', mood: '舒缓 · 柔爵士抒情' },
    { id: 'wydo', src: 'assets/audio/wydo.mp3', title: 'Paper Smile', mood: '温暖 · 钢琴氛围上扬' }
  ];

  var LS = { enabled: 'jlc-bgm-enabled', index: 'jlc-bgm-index', volume: 'jlc-bgm-volume' };
  var DEFAULT_VOL = 0.34;
  var GESTURES = ['pointerdown', 'keydown', 'touchstart'];

  var dock = document.getElementById('bgmDock');
  var fab = document.getElementById('bgmFab');
  var panel = document.getElementById('bgmPanel');
  var list = document.getElementById('bgmList');
  var toggleBtn = document.getElementById('bgmToggle');
  var prevBtn = document.getElementById('bgmPrev');
  var nextBtn = document.getElementById('bgmNext');
  var volInput = document.getElementById('bgmVolume');
  var fabLabel = document.getElementById('bgmFabLabel');
  var heroVideo = document.getElementById('heroVideo');
  if (!dock || !fab || !panel || !list) return;

  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) {}
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  var index = clamp(parseInt(read(LS.index, '0'), 10) || 0, 0, TRACKS.length - 1);
  var baseVol = clamp(parseFloat(read(LS.volume, '')) || DEFAULT_VOL, 0, 0.8);
  var wantsPlay = read(LS.enabled, '1') !== '0';
  var armedByGesture = false;   // 页面内有过真实交互 / 浏览器已放行有声播放
  var introDone = !heroVideo;    // 开场短片首播阶段是否结束
  var bgmStarted = false;        // 错峰之后是否已起播
  var held = true;               // 当前是否因短片让位
  var raf = 0;

  var audio = document.createElement('audio');
  audio.id = 'bgmAudio';
  audio.loop = true;
  audio.preload = 'none';
  audio.muted = true;
  audio.volume = 0;
  audio.hidden = true;
  audio.setAttribute('aria-hidden', 'true');
  dock.appendChild(audio);
  audio.addEventListener('playing', render);
  audio.addEventListener('pause', render);

  /* ---------- 状态 ---------- */
  function videoActive() {
    return !!(heroVideo && !heroVideo.paused && !heroVideo.ended);
  }
  function mediaHold() { return !introDone || videoActive(); }
  function canGoAudible() { return armedByGesture; }
  function isAudible() {
    return wantsPlay && !audio.muted && !audio.paused && !mediaHold();
  }

  function fadeTo(target, ms) {
    cancelAnimationFrame(raf);
    var from = audio.volume;
    var t0 = performance.now();
    var dur = ms === undefined ? 520 : ms;
    return new Promise(function (resolve) {
      if (dur <= 0) { audio.volume = target; resolve(); return; }
      function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - k, 3);
        audio.volume = clamp(from + (target - from) * e, 0, 1);
        if (k < 1) raf = requestAnimationFrame(step);
        else resolve();
      }
      raf = requestAnimationFrame(step);
    });
  }
  function safePlay() {
    try {
      var p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var state = !wantsPlay ? 'off' : (isAudible() ? 'playing' : 'silent');
    dock.setAttribute('data-state', state);
    dock.setAttribute('data-hold', String(mediaHold()));

    if (fabLabel) {
      fabLabel.textContent = state === 'off' ? '音乐已关'
        : mediaHold() ? (videoActive() ? '短片播放中 · 稍后接续' : '等待开场短片')
        : state === 'silent' ? '开启音乐'
        : 'BGM';
    }
    fab.setAttribute('aria-label', state === 'off' ? '背景音乐已关闭，点击打开设置'
      : mediaHold() ? '开场短片播放中，结束后自动接续背景音乐'
      : state === 'silent' ? '开启背景音乐或打开设置'
      : '背景音乐播放中，点击打开设置');

    if (toggleBtn) {
      toggleBtn.textContent = wantsPlay ? '暂停' : '播放';
      toggleBtn.setAttribute('aria-pressed', String(wantsPlay));
      toggleBtn.setAttribute('aria-label', wantsPlay ? '暂停背景音乐' : '播放背景音乐');
    }
    Array.prototype.forEach.call(list.querySelectorAll('.bgm-track'), function (btn, i) {
      var active = i === index;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function buildList() {
    TRACKS.forEach(function (t, i) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bgm-track';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', '播放 ' + t.title + '，' + t.mood);
      btn.innerHTML =
        '<span class="bgm-track-no">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="bgm-track-main">' +
          '<span class="bgm-track-title"></span>' +
          '<span class="bgm-track-mood"></span>' +
        '</span>' +
        '<span class="bgm-track-eq" aria-hidden="true"></span>';
      btn.querySelector('.bgm-track-title').textContent = t.title;
      btn.querySelector('.bgm-track-mood').textContent = t.mood;
      btn.addEventListener('click', function () { select(i); });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  /* ---------- 错峰：起播 / 让位 / 接续 ---------- */
  // 短片结束后才调用。先按有声发起（浏览器放行的环境真的会「短片完就响」）；
  // 被 Autoplay Policy 拦下则静音走时间轴，等首次手势解除静音。
  function startBgm() {
    if (!wantsPlay || mediaHold()) return;
    held = false;
    bgmStarted = true;
    audio.muted = false;
    audio.volume = 0;
    var p = null;
    try { p = audio.play(); } catch (e) { p = null; }
    if (p && typeof p.then === 'function') {
      p.then(function () {
        if (!wantsPlay || mediaHold()) return;
        armedByGesture = true;      // 已确认浏览器放行有声播放
        fadeTo(baseVol, 1200);
        render();
      }).catch(function () {
        audio.muted = true;
        audio.volume = 0;
        safePlay();                 // 静音降级，时间轴不空转
        render();
      });
    } else {
      audio.muted = true;
      audio.volume = 0;
      safePlay();
    }
    render();
  }

  // 短片播放期间：整路暂停、归零，绝不与视频声音叠加
  function holdBgm() {
    held = true;
    cancelAnimationFrame(raf);
    try { audio.pause(); } catch (e) {}
    audio.muted = true;
    audio.volume = 0;
    bgmStarted = false;
    render();
  }

  function syncMedia() {
    if (!wantsPlay) { holdBgm(); return; }
    if (mediaHold()) { holdBgm(); return; }
    if (!bgmStarted || audio.paused) { startBgm(); return; }
    if (audio.muted && canGoAudible()) {
      audio.muted = false;
      fadeTo(baseVol, 700);
    }
    render();
  }

  function attemptAudible() {
    if (!wantsPlay || !canGoAudible() || mediaHold()) return false;
    if (!bgmStarted || audio.paused) { startBgm(); return true; }
    if (audio.muted) audio.muted = false;
    fadeTo(baseVol, 900);
    render();
    return true;
  }

  function load(i) {
    index = (i + TRACKS.length) % TRACKS.length;
    audio.src = TRACKS[index].src;
    try { audio.load(); } catch (e) {}
    save(LS.index, index);
    render();
  }

  function select(i) {
    if (i === index) {
      if (wantsPlay) attemptAudible();
      return;
    }
    fadeTo(0, 200).then(function () {
      load(i);
      if (!wantsPlay) return;
      bgmStarted = false;
      syncMedia();
    });
  }

  function setEnabled(on) {
    wantsPlay = !!on;
    save(LS.enabled, wantsPlay ? '1' : '0');
    if (!wantsPlay) {
      fadeTo(0, 300).then(function () {
        audio.pause(); audio.muted = true; bgmStarted = false; render();
      });
    } else {
      syncMedia();   // 短片仍在播就保持让位，结束后自然接续
    }
    render();
  }

  /* ---------- 短片事件 ---------- */
  function finishIntro() {
    if (introDone) return;
    introDone = true;
    setTimeout(syncMedia, 220);   // 画面停稳后稍作停顿再起音乐，错峰更清晰
  }
  document.addEventListener('hero:intro-complete', finishIntro);
  if (heroVideo) {
    ['play', 'pause', 'ended', 'volumechange', 'seeked'].forEach(function (ev) {
      heroVideo.addEventListener(ev, syncMedia);
    });
    heroVideo.addEventListener('ended', function () {
      introDone = true;
      setTimeout(syncMedia, 260);   // 画面停稳后再淡入，衔接更自然
    }, { once: true });
  }
  // 极端环境（视频完全无法加载 / 事件没派发）也不能让音乐永远不响
  setTimeout(function () { if (!introDone) finishIntro(); }, 9000);

  /* ---------- 面板 ---------- */
  function setOpen(on) {
    dock.setAttribute('data-open', String(on));
    fab.setAttribute('aria-expanded', String(on));
    panel.setAttribute('aria-hidden', String(!on));
    try { panel.inert = !on; } catch (e) {}
  }
  fab.addEventListener('click', function () {
    setOpen(dock.getAttribute('data-open') !== 'true');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dock.getAttribute('data-open') === 'true') {
      setOpen(false);
      fab.focus();
    }
  });
  document.addEventListener('pointerdown', function (e) {
    if (dock.getAttribute('data-open') === 'true' && !dock.contains(e.target)) setOpen(false);
  }, true);

  if (toggleBtn) toggleBtn.addEventListener('click', function () { setEnabled(!wantsPlay); });
  if (prevBtn) prevBtn.addEventListener('click', function () { select(index - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { select(index + 1); });
  if (volInput) {
    volInput.max = '80';
    volInput.value = String(Math.round(baseVol * 100));
    volInput.addEventListener('input', function () {
      baseVol = clamp((parseInt(volInput.value, 10) || 0) / 100, 0, 0.8);
      save(LS.volume, baseVol);
      if (!audio.muted && !audio.paused && !mediaHold()) fadeTo(baseVol, 180);
    });
  }

  /* ---------- 启动 ---------- */
  buildList();
  load(index);
  setOpen(false);
  // 首播期间完全不启动 BGM：先让开场白完整播完，再谈背景音乐
  audio.muted = true;
  audio.volume = 0;
  held = true;
  render();

  if (wantsPlay) {
    // 首次真实交互只是「解锁有声资格」；若短片还在播，等它结束后再响
    var onGesture = function () {
      armedByGesture = true;
      GESTURES.forEach(function (ev) { window.removeEventListener(ev, onGesture, true); });
      attemptAudible();
    };
    GESTURES.forEach(function (ev) { window.addEventListener(ev, onGesture, true); });
  }

  // 页面隐藏时静音让位，回来时按用户偏好恢复（短片在播则继续让位）
  document.addEventListener('visibilitychange', function () {
    if (!wantsPlay) return;
    if (document.hidden) {
      if (!audio.muted) fadeTo(0, 260).then(function () { audio.muted = true; });
    } else if (!mediaHold()) {
      syncMedia();
    }
    render();
  });

  // 触屏阅读时让位：右下角悬浮按钮会压住正文，滚动中淡出，停下 900ms 恢复。
  if (window.matchMedia && window.matchMedia('(hover:none)').matches) {
    var readTimer = null;
    window.addEventListener('scroll', function () {
      if (dock.dataset.open === 'true') return;
      dock.classList.add('is-reading');
      if (readTimer) clearTimeout(readTimer);
      readTimer = setTimeout(function () { dock.classList.remove('is-reading'); }, 900);
    }, { passive: true });
  }

  // 供其它模块 / 调试读取状态
  window.BGM = {
    tracks: TRACKS,
    select: select,
    setEnabled: setEnabled,
    state: function () {
      return { index: index, title: TRACKS[index].title, enabled: wantsPlay,
        paused: audio.paused, muted: audio.muted, volume: audio.volume,
        ducked: held, held: held, introDone: introDone, started: bgmStarted,
        videoActive: videoActive(), trackCount: TRACKS.length };
    }
  };
})();

/* ===========================================================
   FlipBook · 原生 JS / CSS 3D 翻书剪报册
   参考 dmtrbrl.github.io/leafthrough：摊开的杂志、纸叠厚度、书脊阴影、
   纸张绕书脊 180° 翻动、底部极简箭头与页码。零依赖。

   桌面：双页跨页（左页静态 + 右页翻动 + 底层页），翻过去的纸正好
         落在左半，静态底层遮住归零重排，因此视觉完全连续。
   窄屏：收成单页翻阅，用轻量纸张淡入切换，避免截图被压得过小。
   交互：点击纸页左右半区、水平拖拽、PREV / NEXT、方向键 / Home / End。
   =========================================================== */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const smallScreen = window.matchMedia('(max-width: 760px)');
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* 版式扉页（不计入七张稿件，仅作册页开场） */
  const COVER = {
    kind: 'cover', no: '00', org: 'PRESS CLIPS', date: '2025 — 2026',
    views: '07 CLIPS', viewsLabel: '04 新华网 / 03 贵州日报',
    title: '已发布稿件剪报',
    note: '新华网客户端 · 贵州日报「天眼新闻」已发布稿件页面截图'
  };

  function clipHTML(p, side) {
    if (p.kind === 'cover') {
      return `
        <div class="fb-cover">
          <span class="eyebrow">AUTHORITATIVE MEDIA / TRACK RECORD</span>
          <span class="fb-cover-mark serif">03</span>
          <h3 class="fb-cover-title serif">已发布<br>稿件剪报</h3>
          <div class="fb-cover-rule" aria-hidden="true"></div>
          <p class="fb-cover-text">新华网客户端 · 贵州日报「天眼新闻」<br>七篇已发布稿件的真实页面截图</p>
          <span class="eyebrow fb-cover-foot">LEAF THROUGH / 向右翻页 →</span>
        </div>`;
    }
    return `
      <div class="fb-page-inner">
        <div class="fb-face-top">
          <span class="eyebrow">${esc(p.org)}</span>
          <span class="eyebrow">${esc(p.date)}</span>
        </div>
        <figure class="fb-figure">
          <img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy" draggable="false">
        </figure>
        <div class="fb-face-foot">
          <a class="fb-face-title serif" href="${esc(p.url || '#')}" target="_blank" rel="noopener noreferrer"
             title="在新窗口阅读原文">${esc(p.title)} <span class="fb-link-mark" aria-hidden="true">↗</span></a>
          <span class="eyebrow fb-face-views">${esc(p.views)}</span>
        </div>
        <div class="fb-face-bottom">
          <span class="eyebrow">CLIP ${esc(p.no)} / 07</span>
          ${side ? `<span class="eyebrow">${esc(side)}</span>` : ''}
        </div>
      </div>`;
  }

  function init(root, clips) {
    if (!root || !clips || !clips.length) return null;

    /* 页序列：扉页 + 七张稿件 = 8 页 = 4 个双页跨页 */
    const PAGES = [COVER].concat(clips);
    const SPREADS = [];
    for (let i = 0; i < PAGES.length; i += 2) SPREADS.push([PAGES[i], PAGES[i + 1] || null]);
    const spreadCount = SPREADS.length;

    root.innerHTML = `
      <div class="fb-body">
        <div class="fb-stage" id="fbStage">
          <div class="fb-book" id="fbBook">
            <div class="fb-page fb-page--left" id="fbLeft"></div>
            <div class="fb-page fb-page--under" id="fbUnder"></div>
            <div class="fb-sheet" id="fbSheet">
              <div class="fb-face fb-face--front" id="fbFront"></div>
              <div class="fb-face fb-face--back" id="fbBack"></div>
            </div>
            <span class="fb-spine" aria-hidden="true"></span>
            <span class="fb-stack" aria-hidden="true"></span>
          </div>
          <span class="fb-drag-hint eyebrow">← 拖拽 / 点击纸页翻页 →</span>
        </div>
      </div>
      <div class="fb-controls">
        <button class="fb-arrow" id="fbPrev" type="button" aria-label="上一页">← <span>PREV</span></button>
        <span class="fb-count eyebrow" id="fbCount" aria-live="polite">01 / 04</span>
        <button class="fb-arrow" id="fbNext" type="button" aria-label="下一页"><span>NEXT</span> →</button>
      </div>`;

    const stage = root.querySelector('#fbStage');
    const book  = root.querySelector('#fbBook');
    const sheet = root.querySelector('#fbSheet');
    const left  = root.querySelector('#fbLeft');
    const under = root.querySelector('#fbUnder');
    const front = root.querySelector('#fbFront');
    const back  = root.querySelector('#fbBack');
    const prevB = root.querySelector('#fbPrev');
    const nextB = root.querySelector('#fbNext');
    const count = root.querySelector('#fbCount');

    let spread = 0;      // 桌面双页跨页索引
    let page = 0;        // 窄屏单页索引
    let turning = false;
    let pending = null;
    let drag = null;
    let fallback = null;

    const isSingle = () => smallScreen.matches;
    const blank = side => `<div class="fb-page-inner fb-page-inner--blank"><span class="eyebrow">${esc(side)}</span></div>`;

    function setAngle(deg, animate) {
      if (!animate) sheet.style.transition = 'none';
      sheet.style.transform = 'rotateY(' + deg + 'deg)';
      if (!animate) {
        void sheet.offsetWidth;
        sheet.style.transition = '';
      }
    }

    /* 桌面静止态：左页 / 右页正面 / 下一跨页的底层与背面 */
    function paintSpread() {
      const cur = SPREADS[spread];
      const nxt = SPREADS[spread + 1];
      left.innerHTML  = cur[0] ? clipHTML(cur[0], 'LEFT') : blank('LEFT');
      front.innerHTML = cur[1] ? clipHTML(cur[1], 'RIGHT') : blank('RIGHT');
      under.innerHTML = nxt && nxt[1] ? clipHTML(nxt[1], 'RIGHT') : blank('RIGHT');
      back.innerHTML  = nxt && nxt[0] ? clipHTML(nxt[0], 'LEFT') : blank('LEFT');
      setAngle(0, false);
    }

    /* 窄屏单页：只显示 PAGES[page]，其余层留空 */
    function paintPage() {
      const p = PAGES[page];
      left.innerHTML = blank('LEFT');
      under.innerHTML = blank('RIGHT');
      front.innerHTML = clipHTML(p, '');
      back.innerHTML = blank('LEFT');
      setAngle(0, false);
    }

    function updateUI() {
      const single = isSingle();
      const total = single ? PAGES.length : spreadCount;
      const at = single ? page : spread;
      count.textContent = String(at + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
      prevB.disabled = at === 0;
      nextB.disabled = at === total - 1;
      prevB.setAttribute('aria-disabled', String(at === 0));
      nextB.setAttribute('aria-disabled', String(at === total - 1));
      book.classList.toggle('is-single', single);
      root.classList.toggle('is-single', single);
    }

    function render() {
      if (isSingle()) paintPage(); else paintSpread();
      updateUI();
    }

    function finish() {
      if (!pending) return;
      const p = pending;
      pending = null;
      if (p.mode === 'page') page = p.target; else spread = p.target;
      clearTimeout(fallback);
      sheet.classList.remove('is-turning');
      book.classList.remove('is-turning', 'is-swapping');
      render();                       // 静态底层已遮住归零重排，视觉连续
      turning = false;
    }

    function jump(dir) {
      const single = isSingle();
      const at = single ? page : spread;
      const total = single ? PAGES.length : spreadCount;
      const target = at + dir;
      if (target < 0 || target >= total || turning) return;

      if (reduceMotion.matches || single) {
        // 减弱动效 / 窄屏：轻量纸张切换，不做 180° 翻转
        turning = true;
        pending = { target: target, mode: single ? 'page' : 'spread' };
        book.classList.add('is-swapping');
        setTimeout(finish, reduceMotion.matches ? 10 : 260);
        return;
      }

      turning = true;
      pending = { target: target, mode: 'spread' };
      sheet.classList.add('is-turning');
      book.classList.add('is-turning');
      clearTimeout(fallback);
      fallback = setTimeout(finish, 1150);
      if (dir > 0) {
        setAngle(0, false);
        requestAnimationFrame(() => setAngle(-180, true));
      } else {
        // 反向：先把背面定为「当前左页」，定格在 -180°（看到的仍是当前页）
        const cur = SPREADS[spread];
        const prv = SPREADS[target];
        back.innerHTML = cur[0] ? clipHTML(cur[0], 'LEFT') : blank('LEFT');
        front.innerHTML = prv[1] ? clipHTML(prv[1], 'RIGHT') : blank('RIGHT');
        left.innerHTML = prv[0] ? clipHTML(prv[0], 'LEFT') : blank('LEFT');
        under.innerHTML = cur[1] ? clipHTML(cur[1], 'RIGHT') : blank('RIGHT');
        setAngle(-180, false);
        requestAnimationFrame(() => setAngle(0, true));
      }
    }

    sheet.addEventListener('transitionend', e => {
      if (e.propertyName === 'transform' && e.target === sheet) finish();
    });
    prevB.addEventListener('click', () => jump(-1));
    nextB.addEventListener('click', () => jump(1));

    root.addEventListener('keydown', e => {
      let d = null;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') d = 1;
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') d = -1;
      else if (e.key === 'Home' || e.key === 'End') {
        const single = isSingle();
        const target = e.key === 'Home' ? 0 : (single ? PAGES.length : spreadCount) - 1;
        const at = single ? page : spread;
        if (target !== at) {
          if (single) page = target; else spread = target;
          render();
        }
        e.preventDefault();
        return;
      }
      if (d === null) return;
      e.preventDefault();
      jump(d);
    });

    /* 拖拽跟手 + 点击纸页左右半区 */
    stage.addEventListener('pointerdown', e => {
      // 标题是原文外链：不劫持为翻页拖拽，交给链接本身打开新窗口
      if (e.target.closest && e.target.closest('a')) return;
      if (turning || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
      drag = { x: e.clientX, y: e.clientY };
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener('pointermove', e => {
      if (!drag || turning || isSingle()) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) < 5) return;
      drag.moved = true;
      const a = Math.max(-11, Math.min(11, -dx * 0.05));
      sheet.style.transition = 'none';
      sheet.style.transform = 'rotateY(' + a + 'deg)';
    });
    const endDrag = e => {
      if (e.target.closest && e.target.closest('a')) return;
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = Math.abs(e.clientY - drag.y);
      const moved = !!drag.moved;
      drag = null;
      setAngle(0, false);
      if (moved) {
        if (Math.abs(dx) > 42 && Math.abs(dx) > dy) jump(dx < 0 ? 1 : -1);
        return;
      }
      const r = stage.getBoundingClientRect();
      jump(e.clientX < r.left + r.width / 2 ? -1 : 1);
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', () => {
      if (!drag) return;
      drag = null;
      setAngle(0, false);
    });

    const onBreakpoint = () => {
      // 切换布局时把进度折算到同一页，避免跳回开头
      if (isSingle()) page = Math.min(PAGES.length - 1, spread * 2);
      else spread = Math.min(spreadCount - 1, Math.floor(page / 2));
      turning = false; pending = null;
      clearTimeout(fallback);
      sheet.classList.remove('is-turning');
      book.classList.remove('is-turning', 'is-swapping');
      render();
    };
    if (smallScreen.addEventListener) smallScreen.addEventListener('change', onBreakpoint);
    else smallScreen.addListener(onBreakpoint);

    render();
    return {
      next: () => jump(1),
      prev: () => jump(-1),
      get spread() { return spread; },
      get page() { return page; }
    };
  }

  window.FlipBook = { init: init };
})();

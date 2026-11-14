/* ===========================================================
   IpBuddy · 板块标题旁的 IP 形象（透明背景动作短片）
   五段动作逐帧抠像为「带 alpha 的动画 WebP」，只保留人物与手势，
   不再有原始蓝色摄影棚背景的矩形痕迹；静止态用同帧透明 PNG 兜底。
   尺寸与标题字号相近，分布在标题上下左右，支持：
   进场播放一次 · 悬停重播 · 点击切换动作 · 指针轻微视差。
   =========================================================== */
(function () {
  'use strict';

  const ACTIONS = [
    { key: 'blink',  label: '眨眨眼' },
    { key: 'finger', label: '有主意' },
    { key: 'shrug',  label: '摊摊手' },
    { key: 'temple', label: '想一想' },
    { key: 'lips',   label: '嘘一下' }
  ];
  // 紧贴标题的上下左右四个方位轮流排布；第 02 板块（增长矩阵）落在「阵」字收尾的
  // 右下角（呼应参照截图鼠标圈选位置），用 finger 手势指向标题，形成互动感；
  // 08 结束语改为贴标题右端，避开下方副文案，不遮挡任何文字。
  const SIDES = ['top', 'right', 'left', 'bottom', 'right', 'left', 'top', 'bottom'];
  const BASE = 'assets/ip/';

  function init() {
    const heads = Array.prototype.slice.call(document.querySelectorAll('.sec-head'));
    if (!heads.length) return null;
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const fine = !!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches);
    const api = [];

    heads.forEach((head, i) => {
      const h2 = head.querySelector('.sec-title');
      if (!h2) return;
      const sec = head.closest('section');
      const isGrowth = !!(sec && sec.id === 'growth');
      /* 08 结束语已并入 07 收尾版面的右栏（#closing 不再是独立 section） */
      const isClosing = !!head.closest('#closing');
      const side = isGrowth ? 'br' : (isClosing ? 'right' : SIDES[i % SIDES.length]);
      let act = i % ACTIONS.length;
      let endTimer = 0;

      const buddy = document.createElement('span');
      buddy.className = 'ip-buddy';
      buddy.dataset.side = side;
      buddy.setAttribute('aria-hidden', 'true');
      buddy.innerHTML =
        '<img class="ip-video" alt="" draggable="false" ' +
        'src="' + BASE + ACTIONS[act].key + '.png">' +
        '<span class="ip-tip eyebrow"></span>';
      head.appendChild(buddy);

      let img = buddy.querySelector('img');
      const tip = buddy.querySelector('.ip-tip');
      let tipTimer = 0;

      // 动画 WebP 只播一次；换一个新的 <img> 让浏览器从头重新解码重播。
      // 不用 ?v= 查询串，避免部分静态服务器对带参路径返回 404 或产生被取消的请求。
      function play() {
        if (reduce) return;
        const fresh = document.createElement('img');
        fresh.className = img.className;
        fresh.alt = img.alt;
        fresh.draggable = false;
        fresh.src = BASE + ACTIONS[act].key + '.webp';
        img.replaceWith(fresh);
        img = fresh;
        buddy.classList.add('is-playing');
        clearTimeout(endTimer);
        endTimer = setTimeout(() => buddy.classList.remove('is-playing'), 5300);
      }
      function setAction(next) {
        act = (next + ACTIONS.length) % ACTIONS.length;
        const a = ACTIONS[act];
        if (reduce) img.src = BASE + a.key + '.png';
        else play();
        tip.textContent = a.label;
        buddy.classList.add('show-tip');
        clearTimeout(tipTimer);
        tipTimer = setTimeout(() => buddy.classList.remove('show-tip'), 1500);
      }

      /* 位置：围绕标题的上 / 下 / 左 / 右 / 右下分布，但与所有文字保持明确间距。
         第 22 轮修正：旧版 top 只上移 0.72×size，圆形徽章会压住标题末字；
         新版先算出主标题字形盒 + 英文副题 / 序号的文字盒，再按方位生成候选位置，
         取第一个与任何文字都不相交的位置，保证「相隔一点距离」且不遮挡。 */
      function place() {
        if (window.innerWidth <= 1024) { buddy.style.left = ''; buddy.style.top = ''; return; }
        const host = head.getBoundingClientRect();
        const size = buddy.offsetWidth || 46;
        let text = { left: host.left, right: host.left + Math.min(host.width, 260), top: host.top, bottom: host.top + 40 };
        try {
          const range = document.createRange();
          range.selectNodeContents(h2);
          const r = range.getBoundingClientRect();
          if (r.width > 10) text = r;
        } catch (e) { /* 用兜底值 */ }

        /* 需要避让的文字盒（换成 head 局部坐标） */
        const boxes = [text];
        head.querySelectorAll('.sec-en, .counter, .closing-eyebrow').forEach(node => {
          try {
            const rg = document.createRange();
            rg.selectNodeContents(node);
            const r = rg.getBoundingClientRect();
            if (r.width > 8 && r.height > 4) boxes.push(r);
          } catch (e) { /* 忽略 */ }
        });
        const local = boxes.map(r => ({
          left: r.left - host.left, right: r.right - host.left,
          top: r.top - host.top, bottom: r.bottom - host.top
        }));
        const main = local[0];
        const endX = main.right, startX = main.left, midY = (main.top + main.bottom) / 2;
        /* 结束语右栏较窄，多留一点呼吸；增长矩阵「阵」右下也稍微拉开 */
        const gap = isClosing ? 18 : (side === 'br' ? 14 : 16);
        /* 标题左侧允许探进栅格留白（约 1 列），这样 left 方位不会被
           夹回标题首字上方；右侧仍不越过 header 边界。 */
        const minX = -(size + gap + 10);
        const clampX = x => Math.min(Math.max(minX, x), Math.max(0, host.width - size));
        const hits = (x, y) => local.some(b =>
          x < b.right + 2 && x + size > b.left - 2 && y < b.bottom + 2 && y + size > b.top - 2);

        const above = x => ({ x: clampX(x), y: main.top - size - gap });
        const below = x => ({ x: clampX(x), y: main.bottom + gap });
        const right = () => ({ x: clampX(endX + gap), y: midY - size / 2 });
        const left = () => ({ x: clampX(startX - size - gap), y: midY - size / 2 });
        const br = () => ({ x: clampX(endX + gap), y: main.bottom - size * 0.15 });
        const belowHead = x => ({ x: clampX(x), y: Math.max(main.bottom + gap, host.height - size * 0.45) });

        let candidates;
        if (side === 'top') candidates = [above(endX - size * 0.1), above(startX), left(), right()];
        else if (side === 'bottom') candidates = [belowHead(endX - size * 0.5), above(endX - size * 0.1), right(), left()];
        else if (side === 'left') candidates = [left(), above(startX), right(), below(startX)];
        else if (side === 'br') candidates = [br(), right(), above(endX - size * 0.1), left()];
        else candidates = [right(), above(endX - size * 0.1), left(), below(endX - size * 0.5)];

        const minY = -(size + gap + 12);
        let picked = candidates.find(c => c.y >= minY && !hits(c.x, c.y));
        if (!picked) picked = { x: clampX(endX - size * 0.1), y: main.top - size - gap };
        buddy.style.right = 'auto'; // 解除 CSS 默认 right:0 与 left 的冲突
        buddy.style.left = picked.x.toFixed(1) + 'px';
        buddy.style.top = picked.y.toFixed(1) + 'px';
      }

      /* 互动：标题区域悬停重播，点击切换动作，指针视差 */
      head.addEventListener('pointerenter', e => {
        if (!fine || reduce || (e.pointerType && e.pointerType !== 'mouse')) return;
        play();
      });
      buddy.addEventListener('pointerenter', e => {
        if (!fine || reduce || (e.pointerType && e.pointerType !== 'mouse')) return;
        play();
      });
      buddy.addEventListener('click', e => { e.preventDefault(); setAction(act + 1); });
      buddy.addEventListener('pointerdown', e => e.stopPropagation(), { passive: true });
      head.addEventListener('pointermove', e => {
        if (!fine || reduce) return;
        const r = head.getBoundingClientRect();
        const nx = (e.clientX - r.left) / Math.max(1, r.width) - .5;
        const ny = (e.clientY - r.top) / Math.max(1, r.height) - .5;
        buddy.style.setProperty('--ip-dx', (nx * 9).toFixed(2) + 'px');
        buddy.style.setProperty('--ip-dy', (ny * 7).toFixed(2) + 'px');
        buddy.style.setProperty('--ip-rot', (nx * 8).toFixed(2) + 'deg');
      }, { passive: true });
      head.addEventListener('pointerleave', () => {
        buddy.style.setProperty('--ip-dx', '0px');
        buddy.style.setProperty('--ip-dy', '0px');
        buddy.style.setProperty('--ip-rot', '0deg');
      }, { passive: true });

      /* 进入视口播一次，不循环 */
      if (!reduce && 'IntersectionObserver' in window) {
        let played = false;
        const io = new IntersectionObserver(entries => {
          if (played || !entries.some(e => e.isIntersecting)) return;
          played = true;
          io.disconnect();
          play();
        }, { threshold: .35 });
        io.observe(head);
      }

      place();
      api.push({ head: head, place: place, action: n => setAction(n) });
    });

    /* 字体 / 布局 / 缩放变化后重新贴合标题 */
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => api.forEach(a => a.place()));
      api.forEach(a => ro.observe(a.head));
    }
    window.addEventListener('resize', () => api.forEach(a => a.place()), { passive: true });
    window.addEventListener('load', () => api.forEach(a => a.place()), { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => api.forEach(a => a.place()));

    return api;
  }

  window.IpBuddy = { init: init, actions: ACTIONS };
})();

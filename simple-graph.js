/* ===========================================================
   Simple Graph · 01 个人概览的曲线板块导航（零依赖）
   参考 React Bits Pro "Simple Graph"：一条平滑曲线 + 六个数据点，
   点上只写板块标题；悬停（或轻触 ＋）展开该板块简介。

   与作品集结合的改动：
   · 曲线进场按路径描边绘制，点依次淡入（prefers-reduced-motion 直接完成）
   · 每个圆点仍是锚点链接，点击直达 02–07 板块，保留上一轮的跳转能力
   · 触屏没有 hover：点旁的 ＋ 按钮展开简介，简介同时在曲线下方
     以通栏信息块呈现，避免窄屏卡片溢出
   · 鼠标从圆点移到简介卡之间有 160ms 桥接，卡片不会闪退
   =========================================================== */
(function () {
  'use strict';

  function init() {
    const root = document.getElementById('capGraph');
    if (!root) return;
    const points = Array.prototype.slice.call(root.querySelectorAll('.sg-point'));
    const info = document.getElementById('sgMobileInfo');
    if (!points.length) return;

    const reduce = !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* ---------- 进场：曲线描边 + 点依次淡入 ---------- */
    /* 入场门槛降到「任意部分进入视口」并加全局兜底：
       锚点直达、极快滚动、曲线高于视口时圆点也不会停在 opacity:0 */
    const showGraph = () => root.classList.add('is-in');
    if (reduce || !('IntersectionObserver' in window)) {
      showGraph();
    } else {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          showGraph();
          io.disconnect();
        }
      }, { threshold: 0, rootMargin: '15% 0px 15% 0px' });
      io.observe(root);
    }
    document.addEventListener('fx:reveal-all', showGraph);
    setTimeout(showGraph, 1800);

    /* ---------- 窄屏：把简介写进曲线下方的通栏信息块 ---------- */
    function renderInfo(point) {
      if (!info) return;
      const en = point.querySelector('.sg-card .eyebrow');
      const title = point.querySelector('.sg-card-title');
      const desc = point.querySelector('.sg-card-desc');
      const href = point.querySelector('.sg-node').getAttribute('href');

      const tag = document.createElement('span');
      tag.className = 'eyebrow';
      tag.textContent = en ? en.textContent : '';

      const h = document.createElement('h3');
      h.className = 'sg-info-title serif';
      h.textContent = title ? title.textContent : '';

      const p = document.createElement('p');
      p.className = 'sg-info-desc';
      p.textContent = desc ? desc.textContent : '';

      const a = document.createElement('a');
      a.className = 'sg-info-jump eyebrow';
      a.href = href || '#';
      a.textContent = '查看板块 ↗';

      info.replaceChildren(tag, h, p, a);
      info.hidden = false;
    }

    function closeAll(except) {
      points.forEach(pt => {
        if (pt === except) return;
        pt.classList.remove('is-open');
        const t = pt.querySelector('.sg-toggle');
        if (t) { t.setAttribute('aria-expanded', 'false'); t.textContent = '+'; }
      });
      if (info) info.hidden = true;
    }

    points.forEach(point => {
      const card = point.querySelector('.sg-card');
      const toggle = point.querySelector('.sg-toggle');
      let timer = 0;

      const keep = () => {
        clearTimeout(timer);
        point.classList.add('is-active');
      };
      const release = () => {
        clearTimeout(timer);
        // 给鼠标从圆点移动到简介卡留出过桥时间
        timer = setTimeout(() => point.classList.remove('is-active'), 160);
      };
      point.addEventListener('pointerenter', keep);
      point.addEventListener('pointerleave', release);
      if (card) {
        card.addEventListener('pointerenter', keep);
        card.addEventListener('pointerleave', release);
      }

      if (toggle) {
        toggle.addEventListener('click', e => {
          e.stopPropagation();
          const open = point.classList.contains('is-open');
          closeAll(point);
          if (open) {
            point.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.textContent = '+';
            if (info) info.hidden = true;
          } else {
            point.classList.add('is-open', 'is-active');
            toggle.setAttribute('aria-expanded', 'true');
            toggle.textContent = '×';
            renderInfo(point);
          }
        });
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAll(null);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.SimpleGraph = { init: init };
})();

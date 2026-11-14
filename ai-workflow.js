/* ===========================================================
   AI 工作流板块 · 右下角 ＋ 展开纯图片展示
   -----------------------------------------------------------
   三张卡互斥展开（同一时间只开一张），按钮在 ＋ / × 之间旋转，
   同步 aria-expanded / aria-hidden；Escape 与点击卡片外收起。
   展开时顺带触发一次像素点阵脉冲，和背景效果呼应。

   两处「任意滚动位置都可用」的加固：
   · 右下角 AI 助手浮窗如果恰好压住某个 ＋，头像会短暂让位，
     不再出现「只有滑到某个位置才能点开」的死角；
   · 展开面板里的截图可点击进全站共用的放大层，且放大层不会误收起面板。
   =========================================================== */
(function () {
  'use strict';

  function init() {
    /* 锚点直达 / 快速滚动时，板块顶部可能一瞬间越过视口，
       导致 main.js 的滚动进场观察器没来得及给 sec-head 加 is-in。
       这里补一层兜底：板块任意部分进入视口，就把内部 .reveal 全部点亮。 */
    var sec = document.getElementById('ai-workflow');
    var revealAll = function () {
      if (!sec) return;
      Array.prototype.forEach.call(sec.querySelectorAll('.reveal'), function (n) {
        n.classList.add('is-in');
      });
    };
    if (sec && 'IntersectionObserver' in window) {
      var secObserver = new IntersectionObserver(function (entries) {
        if (!entries.some(function (e) { return e.isIntersecting; })) return;
        revealAll();
        secObserver.disconnect();
      }, { threshold: 0 });
      secObserver.observe(sec);
    }
    /* 全局兜底事件：锚点直达、极快滚动、首次交互都会派发一次 */
    document.addEventListener('fx:reveal-all', revealAll);
    /* 板块在视口内时收起助手的宽标题气泡，避免压住卡片标签；圆形头像仍在 */
    if (sec && 'IntersectionObserver' in window) {
      var bodyIO = new IntersectionObserver(function (entries) {
        document.body.classList.toggle('aiw-in-view',
          entries.some(function (e) { return e.isIntersecting; }));
      }, { threshold: 0 });
      bodyIO.observe(sec);
    }

    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-aiw-card]'));
    if (!cards.length) return;
    var reduceMotion = !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function markScrollable(card) {
      var panel = card.querySelector('.aiw-expand');
      if (!panel) return;
      /* 展开面板现在只有图片，滚动提示只保留细滚动条，不再插入任何文字 */
      card.classList.toggle('is-scrollable', panel.scrollHeight > panel.clientHeight + 8);
    }

    function setOpen(card, open) {
      var btn = card.querySelector('.aiw-plus');
      var panel = card.querySelector('.aiw-expand');
      if (!btn || !panel) return;
      card.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      var label = btn.getAttribute('aria-label') || '';
      btn.setAttribute('aria-label', open
        ? label.replace(/^展开/, '收起')
        : label.replace(/^收起/, '展开'));
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) {
        if (window.PixelField) window.PixelField.pulse(card);
        requestAnimationFrame(function () { markScrollable(card); guard(); });
        setTimeout(function () { markScrollable(card); }, 320);
      } else {
        card.classList.remove('is-scrollable');
      }
    }

    function closeAll(except) {
      cards.forEach(function (c) {
        if (c !== except && c.classList.contains('is-open')) setOpen(c, false);
      });
    }

    cards.forEach(function (card) {
      var btn = card.querySelector('.aiw-plus');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !card.classList.contains('is-open');
        closeAll(card);
        setOpen(card, open);
        guard();
      });
    });

    /* ---------- 浮窗让位：任何滚动角度下 ＋ 都能点到 ---------- */
    var widget = document.getElementById('aiWidget');
    var fabWrap = widget ? widget.querySelector('.ai-fab-wrap') : null;
    var guardQueued = false;
    function guard() {
      guardQueued = false;
      if (!widget || !fabWrap) return;
      var fr = fabWrap.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      var blocked = false;
      cards.forEach(function (card) {
        if (card.classList.contains('is-open')) markScrollable(card);
        var plus = card.querySelector('.aiw-plus');
        if (!plus || blocked) return;
        var r = plus.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > window.innerWidth) return;
        if (r.right > fr.left - 6 && r.left < fr.right + 6 &&
            r.bottom > fr.top - 6 && r.top < fr.bottom + 6) blocked = true;
      });
      widget.classList.toggle('is-yielding', blocked);
    }
    function scheduleGuard() {
      if (guardQueued) return;
      guardQueued = true;
      requestAnimationFrame(guard);
    }
    window.addEventListener('scroll', scheduleGuard, { passive: true });
    window.addEventListener('resize', scheduleGuard, { passive: true });
    document.addEventListener('fx:reveal-all', scheduleGuard);
    scheduleGuard();

    /* ---------- 图片展示：点击进全站放大层 ---------- */
    Array.prototype.forEach.call(document.querySelectorAll('[data-aiw-gallery]'), function (group) {
      var tiles = Array.prototype.slice.call(group.querySelectorAll('.aiw-shot-tile'));
      if (!tiles.length) return;
      var items = tiles.map(function (t, i) {
        var img = t.querySelector('img');
        return {
          src: t.getAttribute('data-src'),
          title: t.getAttribute('data-title') || '',
          alt: img ? img.getAttribute('alt') : '',
          no: String(i + 1).padStart(2, '0')
        };
      });
      tiles.forEach(function (t, i) {
        t.setAttribute('aria-label', '放大查看：' + (items[i].title || items[i].alt));
        var img = t.querySelector('img');
        if (img) {
          img.addEventListener('load', function () {
            var card = t.closest('[data-aiw-card]');
            if (card) markScrollable(card);
          });
        }
        t.addEventListener('click', function (e) {
          e.stopPropagation();
          if (window.Lightbox) window.Lightbox.open(items, i);
        });
      });
    });

    /* 「点击 ＋ 探索全貌」：滚动到主卡并展开完整交付链路 */
    var explore = document.getElementById('aiwExplore');
    if (explore) {
      explore.addEventListener('click', function () {
        var main = cards[0];
        closeAll(main);
        setOpen(main, true);
        revealAll();
        try {
          main.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'center' });
        } catch (err) {
          main.scrollIntoView();
        }
        scheduleGuard();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll(null);
    });
    document.addEventListener('pointerdown', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      /* 放大层 / 两个浮窗内的点击不算「点卡片外」，避免看完图回来面板已被收起 */
      if (t.closest('[data-aiw-card], .lb2, #aiWidget, #bgmDock')) return;
      closeAll(null);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.AIWorkflow = { init: init };
})();

/* ===========================================================
   Lightbox · 全站共用的「点击照片放大观看」层（零依赖）
   -----------------------------------------------------------
   挂在 document.body 上（不放在任何组件内部），因此可以彻底避开
   父级 transform / perspective 让 position:fixed 偏移的问题。
   支持：左右切换、方向键、Esc、点背景关闭、计数、缩放入场、
   焦点归还、滚动锁定、reduced-motion 降级。
   items: [{ src, viewer?, title?, alt?, no? }]
   viewer 优先于 src（用于「卡片裁过黑边、放大层看完整原图」）。
   =========================================================== */
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var root = null, img = null, cap = null, count = null;
  var items = [], index = 0, opener = null, prevOverflow = '';
  var onChange = null;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function build() {
    root = document.createElement('div');
    root.className = 'lb2';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '照片放大观看');
    root.innerHTML =
      '<div class="lb2-backdrop" data-close="1"></div>' +
      '<div class="lb2-panel">' +
        '<div class="lb2-top">' +
          '<span class="lb2-count eyebrow"></span>' +
          '<button class="lb2-close" type="button" aria-label="关闭">✕ <span>CLOSE</span></button>' +
        '</div>' +
        '<div class="lb2-stage">' +
          '<button class="lb2-arrow lb2-arrow--prev" type="button" aria-label="上一张">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
            '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.6" ' +
            'stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
          '<img class="lb2-img" alt="">' +
          '<button class="lb2-arrow lb2-arrow--next" type="button" aria-label="下一张">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
            '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6" ' +
            'stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '</div>' +
        '<div class="lb2-bottom">' +
          '<span class="lb2-cap serif"></span>' +
          '<span class="lb2-hint eyebrow">← → 切换 · ESC 关闭</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);

    img = root.querySelector('.lb2-img');
    cap = root.querySelector('.lb2-cap');
    count = root.querySelector('.lb2-count');

    root.querySelector('.lb2-close').addEventListener('click', close);
    root.querySelector('.lb2-arrow--prev').addEventListener('click', function () { go(-1); });
    root.querySelector('.lb2-arrow--next').addEventListener('click', function () { go(1); });
    root.addEventListener('click', function (e) {
      if (e.target && e.target.dataset && e.target.dataset.close) close();
    });
    document.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (!root || root.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  }

  function show() {
    var it = items[index] || {};
    var full = it.viewer || it.src || '';
    img.src = full;
    img.alt = it.alt || it.title || '';
    cap.textContent = it.title || it.alt || '';
    count.textContent = (it.no ? esc(it.no) + '  ·  ' : '') +
      String(index + 1).padStart(2, '0') + ' / ' + String(items.length).padStart(2, '0');
    var many = items.length > 1;
    root.querySelector('.lb2-arrow--prev').hidden = !many;
    root.querySelector('.lb2-arrow--next').hidden = !many;
    root.querySelector('.lb2-hint').hidden = !many;
    /* 重新触发入场动效 */
    root.classList.remove('is-open');
    if (!reduce) {
      void root.offsetWidth;
      requestAnimationFrame(function () { root.classList.add('is-open'); });
    } else {
      root.classList.add('is-open');
    }
    if (typeof onChange === 'function') onChange(index, it);
  }

  function go(delta) {
    if (items.length < 2) return;
    index = (index + delta + items.length) % items.length;
    show();
  }

  function open(list, start, opts) {
    if (!Array.isArray(list) || !list.length) return;
    if (!root) build();
    opts = opts || {};
    items = list;
    index = Math.max(0, Math.min(items.length - 1, Number(start) || 0));
    onChange = opts.onChange || null;
    opener = document.activeElement;
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.hidden = false;
    show();
    root.querySelector('.lb2-close').focus({ preventScroll: true });
  }

  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    root.classList.remove('is-open');
    img.removeAttribute('src');
    document.body.style.overflow = prevOverflow;
    if (opener && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    opener = null;
  }

  window.Lightbox = { open: open, close: close, get current() { return index; } };
})();

/* ===========================================================
   AppIcons · 技能清单里各 App / 软件的小型矢量图标
   统一 20×20 圆角方牌 + 品牌色 + 白色符号，深底浅底都清晰。
   仅用于 06「综合能力背书」的技能项，零依赖。
   =========================================================== */
(function () {
  'use strict';

  const defs = {
    douyin: {
      bg: '#161823', fg: '#FFFFFF',
      shape: '<path d="M11.3 3.4v8.1a2.5 2.5 0 1 1-2.1-2.46" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M11.3 3.4c.4 1.5 1.6 2.5 3.2 2.7v2c-1.4-.05-2.5-.55-3.2-1.35" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>'
    },
    xhs: { bg: '#FF2442', fg: '#FFFFFF', t: '小' },
    wechat: {
      bg: '#07C160', fg: '#FFFFFF',
      shape: '<ellipse cx="8.2" cy="8.6" rx="4.9" ry="4.1" fill="#fff"/><ellipse cx="12.8" cy="11.9" rx="4.1" ry="3.4" fill="#fff"/><circle cx="6.6" cy="7.8" r=".75" fill="#07C160"/><circle cx="9.8" cy="7.8" r=".75" fill="#07C160"/><circle cx="11.6" cy="11.2" r=".62" fill="#07C160"/><circle cx="14.2" cy="11.2" r=".62" fill="#07C160"/>'
    },
    ps: { bg: '#001E36', fg: '#31A8FF', t: 'Ps' },
    jianying: { bg: '#1B1B22', fg: '#FFFFFF', t: '剪' },
    xiumi: { bg: '#F26B3A', fg: '#FFFFFF', t: '秀' },
    claude: {
      bg: '#D97757', fg: '#FFFFFF',
      shape: '<path d="M10 3.2v13.6M3.2 10h13.6M5.2 5.2l9.6 9.6M14.8 5.2l-9.6 9.6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>'
    },
    midjourney: {
      bg: '#17181C', fg: '#FFFFFF',
      shape: '<path d="M10 3.1 13.4 10H10V3.1Z" fill="#fff"/><path d="M10 3.1v6.9H4.6L10 3.1Z" fill="#fff" opacity=".62"/><path d="M3.4 12.2c1.6 1.5 3.8 1.9 6.6 1.9s5-.4 6.6-1.9" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>'
    },
    doubao: { bg: '#5B6BE1', fg: '#FFFFFF', t: '豆' },
    deepseek: { bg: '#4D6BFE', fg: '#FFFFFF', t: 'DS' },
    wordbuddy: { bg: '#1E305E', fg: '#FFFFFF', t: 'W' },
    jimeng: { bg: '#7B5BD6', fg: '#FFFFFF', t: '即' },
    newrank: { bg: '#E8543F', fg: '#FFFFFF', t: '榜' },
    powerbi: {
      bg: '#F2C811', fg: '#2A2A2A',
      shape: '<rect x="4" y="10" width="2.6" height="6" fill="#3A3222"/><rect x="8.7" y="6.6" width="2.6" height="9.4" fill="#3A3222"/><rect x="13.4" y="3.6" width="2.6" height="12.4" fill="#3A3222"/>'
    },
    word: { bg: '#2B579A', fg: '#FFFFFF', t: 'W' },
    excel: { bg: '#217346', fg: '#FFFFFF', t: 'X' },
    powerpoint: { bg: '#D24726', fg: '#FFFFFF', t: 'P' }
  };

  function svg(key) {
    const d = defs[key];
    if (!d) return '';
    const body = d.shape ||
      '<text x="10" y="10.4" text-anchor="middle" dominant-baseline="central" ' +
      'font-family="Inter,Arial,\'Microsoft YaHei\',sans-serif" font-size="' +
      (String(d.t).length > 1 ? 8.4 : 11) + '" font-weight="700" fill="' + d.fg + '">' + d.t + '</text>';
    return '<svg class="app-ico" viewBox="0 0 20 20" role="img" aria-label="' + key + ' 图标" focusable="false">' +
      '<rect x="0" y="0" width="20" height="20" rx="1" fill="' + d.bg + '"/>' +
      '<rect x=".5" y=".5" width="19" height="19" rx="1" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1"/>' +
      body + '</svg>';
  }

  window.AppIcons = { svg: svg, has: key => !!defs[key], keys: Object.keys(defs) };
})();

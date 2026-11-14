/* ============================================================
   洛宸的专属 AI 助手
   原生实现：打字机欢迎语 + 预设问题按钮 + 用户气泡 + 关键词模糊匹配 + 兜底话术
   - 打开窗口：助手主动用打字机输出欢迎语，随后在下方展示所有预设问题按钮
   - 点击预设问题：用户气泡（蓝底靠右）→ 延迟 300ms → 助手打字机回答（末尾闪烁蓝色光标）
   - 自由输入：回车发送，关键词模糊匹配命中对应问答；未命中输出兜底话术
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 问答数据 ---------- */
  var QA = [
    {
      q: "你认为你的核心优势是什么？",
      a: "如果提炼成三个词，我会说是：'敏锐的市场洞察者'、'靠谱的全链路执行者'、以及'热爱折腾的探索者'。我的优势不在于只会某项单点技能，而是能打通从'前端策划'到'后端落地'的闭环。我既能写出官媒那种严谨克制的深度稿件，也能操盘单条播放 34w+ 的社交媒体爆款；既能带队统筹上百人的大型活动，也能熟练运用 AIGC 等新工具降本增效。我始终认为，优秀的营销人需要保持对世界的好奇，并把它转化为真实的业务结果。"
    },
    {
      q: "你最拿得出手的代表作是什么？",
      a: "其实分属两个极端。一个是国家级媒体（新华网）的实习履历，我参与了 21 篇稿件从策划到发布的全流程，学会了什么叫'字斟句酌'和'严谨的审核红线'；另一个是我个人的小红书/抖音账号，那条播放超 34 万的演唱会视频。从选题、拍摄、剪辑到封面包装全是我一个人搞定的。这两段经历让我既有了'正规军'的专业底线，又有了'游击队'的敏锐网感，能够适应不同品牌调性的表达。"
    },
    {
      q: "你的性格是什么？MBTI是什么？",
      a: "我的性格底色是极具共情力、目标感强，且充满探索欲的。我的 MBTI 是 ENFJ（主人公人格）。我有着很强的共情能力，这让我无论是做品牌、产品还是用户洞察，都能迅速抓到受众的真实痛点；同时我很有目标感，擅长计划和统筹，比如在操盘百人晚会时，能把复杂任务拆解得井井有条并推动落地；我也一直保持着好奇心，乐于尝试新鲜事物。总体来说，是一个既能敏锐感知情绪，又能踏实拿结果的性格。"
    },
    {
      q: "现在都在聊 AI，你觉得 AI 对你来说是怎样的存在？",
      a: "AI 对我来说早已不是一个'新鲜玩具'，而是我的'超级搭档'。我不会写代码，但我用 AI 工具（WorkBuddy）从零搭建了你现在看到的这个作品集网站；做非遗短片时，我用 Midjourney 和即梦 AI 生成了 80 多张极其复杂的国风水墨素材，替代了昂贵的实拍。我最大的优势不是掌握了多少工具，而是具备很强的'任务拆解能力'，我能快速把一个模糊的业务需求，翻译成 AI 听得懂的执行指令。"
    },
    {
      q: "你平时是怎么保持学习、持续输入的？",
      a: "在快速变化的环境里，保持敏锐是我一直对自己的要求。我的日常输入主要有三个来源：第一是保持对行业的敏锐，我会深度拆解各类出圈的案例，不仅是看热闹，而是去理解背后的商业逻辑和用户心理；第二是死磕新工具，像 AIGC 和各类 Agent，我都会第一时间去试玩，思考如何用新技术提升效率；第三是复盘迭代，我电脑里有个文档专门记录那些效果不及预期的项目并剖析原因，失败往往比成功更能教会我如何做出好决策。"
    },
    {
      q: "你平时有什么特别的爱好吗？这些爱好对你的工作有什么反哺？",
      a: "我的爱好很丰富，是个'重度生活体验派'。我学了 10 年的爵士舞，喜欢旅游、摄影和看电影，也喜欢研究服装色彩搭配和与人交谈。这些爱好极大地反哺了我的工作：舞蹈和电影培养了我的审美与节奏感；旅游和与不同人交谈让我能够快速洞察人性与需求；色彩搭配则直接提升了我的视觉呈现能力。做营销本质是对'人'和'生活'的理解，只有自己热爱生活，才能做出打动用户的品牌和产品。"
    },
    {
      q: "你未来的职业规划是什么？",
      a: "短期内（1-3年），我希望能在具体的业务线里扎根，把我在内容策划、增长运营和 AIGC 工具应用上的优势发挥到极致，成为一个能独立操盘大型项目的'多面手'。长期来看，我希望自己能成长为一名'懂业务、懂技术、懂用户'的复合型专家，不仅能打造出圈案例，还能沉淀出一套可复制的增长方法论，带着团队一起打胜仗。"
    }
  ];

  var WELCOME = "Hi，我是洛宸的专属 AI 助手。你可以点击下面的问题快速了解我，也可以直接输入关键词。";
  var FALLBACK = "这个问题我还没有学会。你可以试试点击下方的预设问题哦~";

  /* 自由输入关键词 → QA 索引（模糊匹配，顺序即 QA 顺序，先命中先返回） */
  var KEYWORDS = [
    ['核心优势', '优势', '三个词', '市场洞察', '执行者', '探索者'],
    ['代表作', '作品', '拿得出手', '经历'],
    ['性格', 'mbti', '人格', 'enfj', '共情'],
    ['ai', '人工智能', '工具', 'aigc', 'midjourney', '即梦'],
    ['学习', '输入', '复盘', '迭代', '案例', 'agent', '拆解'],
    ['爱好', '反哺', '舞蹈', '旅游', '摄影', '电影', '色彩'],
    ['规划', '职业', '未来', '目标', '长期', '方向']
  ];

  function matchQA(text) {
    if (!text) return -1;
    var t = text.toLowerCase();
    for (var i = 0; i < QA.length; i++) {
      var ks = KEYWORDS[i];
      for (var j = 0; j < ks.length; j++) {
        if (t.indexOf(ks[j]) !== -1) return i;
      }
    }
    return -1;
  }

  /* ---------- DOM ---------- */
  var widget = document.getElementById('aiWidget');
  var fab = document.getElementById('aiFab');
  var closeBtn = document.getElementById('aiClose');
  var panel = document.getElementById('aiPanel');
  var msgs = document.getElementById('aiMsgs');
  var input = document.getElementById('aiInput');
  var sendBtn = document.getElementById('aiSend');
  if (!widget || !fab || !panel || !msgs || !input || !sendBtn) return;

  var typingTimer = null;
  var currentBubble = null;
  var currentText = '';
  var opened = false;

  function clearTyping() {
    if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
    if (currentBubble) {
      currentBubble.classList.remove('ai-typing');
      currentBubble.textContent = currentText;
      currentBubble = null; currentText = '';
    }
  }

  function scrollBottom() { msgs.scrollTop = msgs.scrollHeight; }

  function appendUser(text) {
    var b = document.createElement('div');
    b.className = 'ai-msg ai-user';
    b.textContent = text;
    msgs.appendChild(b);
    scrollBottom();
  }

  function botBubble() {
    var b = document.createElement('div');
    b.className = 'ai-msg ai-bot ai-typing';
    msgs.appendChild(b);
    scrollBottom();
    return b;
  }

  /* 打字机：逐字渲染，末尾保留闪烁蓝色光标，完成后光标消失 */
  function typewriter(bubble, text, done) {
    clearTyping();
    currentBubble = bubble; currentText = text;
    var i = 0;
    typingTimer = setInterval(function () {
      if (i <= text.length) {
        bubble.textContent = text.slice(0, i);
        var cur = document.createElement('span');
        cur.className = 'ai-cursor';
        bubble.appendChild(cur);
        i++;
        scrollBottom();
      } else {
        clearInterval(typingTimer);
        typingTimer = null;
        bubble.classList.remove('ai-typing');
        bubble.textContent = text;
        currentBubble = null; currentText = '';
        scrollBottom();
        if (done) done();
      }
    }, 30);
  }

  function renderPresets() {
    if (msgs.querySelector('.ai-presets')) return;
    var box = document.createElement('div');
    box.className = 'ai-presets';
    QA.forEach(function (item, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-preset';
      btn.textContent = item.q;
      btn.addEventListener('click', function () { ask(idx); });
      box.appendChild(btn);
    });
    msgs.appendChild(box);
    scrollBottom();
  }

  function ask(index, questionText) {
    appendUser(questionText != null ? questionText : QA[index].q);
    setTimeout(function () {
      var bubble = botBubble();
      typewriter(bubble, QA[index].a);
    }, 300);
  }

  function sendFree() {
    var v = input.value.trim();
    if (!v) return;
    input.value = '';
    var idx = matchQA(v);
    if (idx >= 0) {
      ask(idx, v);
    } else {
      appendUser(v);
      setTimeout(function () {
        var bubble = botBubble();
        typewriter(bubble, FALLBACK);
      }, 300);
    }
  }

  function openPanel() {
    if (widget.dataset.open === 'true') return;
    widget.dataset.open = 'true';
    fab.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-hidden', 'false');
    if (!opened) {
      opened = true;
      var wb = botBubble();
      typewriter(wb, WELCOME, function () { renderPresets(); });
    }
    setTimeout(scrollBottom, 80);
  }

  function closePanel() {
    widget.dataset.open = 'false';
    fab.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
  }

  fab.addEventListener('click', openPanel);
  if (closeBtn) closeBtn.addEventListener('click', closePanel);
  sendBtn.addEventListener('click', sendFree);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); sendFree(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && widget.dataset.open === 'true') closePanel();
  });
})();

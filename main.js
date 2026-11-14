/* ===========================================================
   刘佳洛宸 · 作品集网站
   内容数据、渲染、章节交互、视频（自动播一次 + 点击重播）、自定义箭头光标
   文字行的逐字放大镜 / 水波纹由 wave-text.js 自行接管
   =========================================================== */

/* ---------- 1. 章节定义（顶栏、底部胶囊条、进度计数共用） ---------- */
const CHAPTERS = [
  { no:'00', id:'hero',          label:'HERO',          short:'00 / HERO' },
  { no:'01', id:'overview',      label:'OVERVIEW',      short:'01 / OVERVIEW' },
  { no:'02', id:'growth',        label:'GROWTH',        short:'02 / GROWTH' },
  { no:'03', id:'ai-workflow',   label:'AI WORKFLOW',   short:'03 / AI WORKFLOW' },
  { no:'04', id:'media',         label:'MEDIA',         short:'04 / MEDIA' },
  { no:'05', id:'creativity',    label:'CREATIVITY',    short:'05 / CREATIVITY' },
  { no:'06', id:'projects',      label:'PROJECTS',      short:'06 / PROJECTS' },
  { no:'07', id:'competencies',  label:'COMPETENCIES',  short:'07 / COMPETENCIES' },
  /* 第 22 轮：照片集与结束语合并为唯一的收尾板块，不再单列「个人风采」 */
  { no:'08', id:'closing',       label:'CLOSING',       short:'08 / CLOSING' },
];

/* ---------- 2. 新媒体增长矩阵：六张真实后台 / 内容页截图 ----------
   用户提供，按顺序对应：抖音演唱会、万峰林油菜花、小红书狗咖、
   小红书减脂合集、贵大新传考研经验贴、抖音校园汪汪队。
   第 26 轮改用「清晰弧形画廊」：卡片是真 <img> 原图直出、contain 完整呈现，
   不再走 WebGL 纹理 / 柔和阴影占位，彻底去掉聚焦态的灰色模糊块；
   data = 卡片下方突出显示的数据优势；label = 放大层标题；
   viewer = 第一张已裁掉录屏黑边的清晰版，放大层优先用它。 */
const GROWTH_SLIDES = [
  { src:'assets/works/growth/growth-01.jpg', viewer:'assets/works/growth/growth-01-view.jpg',
    alt:'抖音演唱会内容后台截图，显示 34.1 万浏览', short:'演唱会现场', data:'34.1万 浏览', label:'抖音 · 演唱会现场 / 34.1万浏览', cropTop:.184 },
  { src:'assets/works/growth/growth-02.jpg', alt:'抖音万峰林油菜花内容后台截图，显示 3.0 万浏览', short:'万峰林油菜花', data:'3.0万 浏览', label:'抖音 · 万峰林油菜花 / 3.0万浏览', cropTop:0 },
  { src:'assets/works/growth/growth-03.jpg', alt:'小红书小狗总动员狗咖笔记截图，411 赞', short:'小狗总动员狗咖', data:'411 赞', label:'小红书 · 小狗总动员狗咖 / 411赞', cropTop:0 },
  { src:'assets/works/growth/growth-04.jpg', alt:'小红书宿舍小锅减脂合集笔记截图，190 赞', short:'宿舍减脂合集', data:'190 赞', label:'小红书 · 宿舍小锅减脂合集 / 190赞', cropTop:0 },
  { src:'assets/works/growth/growth-05.jpg', alt:'小红书贵大新传考研上岸经验贴截图，162 赞', short:'考研上岸经验贴', data:'162 赞', label:'小红书 · 贵大新传考研经验贴 / 162赞', cropTop:0 },
  { src:'assets/works/growth/growth-06.jpg', alt:'抖音校园汪汪队内容后台截图，显示 3.2 万浏览', short:'校园汪汪队', data:'3.2万 浏览', label:'抖音 · 校园汪汪队 / 3.2万浏览', cropTop:0 },
];

/* ---------- 3. 公众号运营：四条推文（真实封面 + 原文外链） ----------
   封面为四条推文的微信原图；views 为用户确认的「单篇阅读量」，
   与板块说明里的累计口径「累计推送 40 余篇 / 阅读量 4.5万+」区分开。 */
const WECHAT_POSTS = [
  {
    no:'01', org:'贵研新声',
    title:'嗨翻了！贵大体育节开幕式变身“全员狂欢现场”！你上镜了吗？',
    url:'https://mp.weixin.qq.com/s/RBdLq3xKeNUOnoHc9yn3Zw',
    cover:'assets/works/growth/wechat-01.jpg',
    views:'4700+', viewsLabel:'VIEWS / 单篇阅读'
  },
  {
    no:'02', org:'贵研新声',
    title:'送你！第一份新年礼物',
    url:'https://mp.weixin.qq.com/s/UBig4rv2LanA2c5TXrBgag',
    cover:'assets/works/growth/wechat-02.jpg',
    views:'2800+', viewsLabel:'VIEWS / 单篇阅读'
  },
  {
    no:'03', org:'贵研新声',
    title:'手慢无！！贵小研专属红包封面贺岁登场！',
    url:'https://mp.weixin.qq.com/s/BCVpbh4LU8BbaoqglhiJIw',
    cover:'assets/works/growth/wechat-03.jpg',
    views:'1800+', viewsLabel:'VIEWS / 单篇阅读'
  },
  {
    no:'04', org:'贵研新声',
    title:'省级优秀毕业生专访｜金方茹：把论文写在大地上，把根扎进泥土里',
    url:'https://mp.weixin.qq.com/s/udZodruOIISlJNkIBII_ug',
    cover:'assets/works/growth/wechat-04.jpg',
    views:'4000+', viewsLabel:'VIEWS / 单篇阅读'
  },
];

/* ---------- 3a. 爆款封面与文案（手机 UI 外框 Swiper） ----------
   第 26 轮新增：十一张用户提供的真实封面 / 笔记正文截图。
   kind 只区分「封面 / 文案」，说明文字只描述画面里看得见的内容；
   metric 仅在第 07、08 张标注截图页面本身显示的浏览量，不编造数据。 */
const VIRAL_POSTS = [
  {
    src:'assets/works/growth/viral/viral-01.jpg', kind:'封面',
    topic:'小狗派对探店封面',
    title:'小狗派对 Dog’s Party · 探店',
    note:'将多只狗狗的可爱形象集中呈现，搭配卡通字体与手绘线条营造热闹的派对氛围；萌宠自带吸引力，明快有趣的视觉表达也让探店主题一目了然，更容易激发点击与分享。',
    alt:'小狗派对 Dog’s party 狗咖猫咖探店封面，暖棕底犬群拼贴与「探店」大字'
  },
  {
    src:'assets/works/growth/viral/viral-02.jpg', kind:'封面',
    topic:'街角猫咖封面',
    title:'衔雪 & 猫咖啡 · 探店',
    note:'以多只猫咪的不同神态为视觉主体，通过错落排布、虚线描边和趣味字体增强画面层次，营造轻松治愈的探店氛围；萌宠内容直观吸睛，也容易引发爱猫用户的兴趣与互动。',
    alt:'衔雪与猫咖啡探店封面，粉色底多只猫咪贴纸与「探店」字样'
  },
  {
    src:'assets/works/growth/viral/viral-03.jpg', kind:'封面',
    topic:'美食与日常组合图',
    title:'城市漫游 · 色彩拼贴',
    note:'将美食、萌宠与旅行片段融入五彩相框拼贴，以丰富配色和多元场景呈现鲜活日常；画面亲切又有层次，既抓住用户视线，也容易唤起对生活小美好的共鸣。',
    alt:'旅行拼贴封面，彩色相框叠放街景、美食与小狗照片'
  },
  {
    src:'assets/works/growth/viral/viral-04.jpg', kind:'封面',
    topic:'偶遇三代同堂的流浪猫家族',
    title:'偶遇三代同堂的「流浪猫家族」',
    note:'以近景猫咪的直视镜头作为视觉焦点，结合背景中的猫群营造偶遇流浪猫家族的现场感，并用醒目标题点出「三代同堂」的故事看点；萌态与温情兼具，容易激发观众的好奇与共鸣。',
    alt:'橘猫俯拍封面，标题「偶遇三代同堂的流浪猫家族」'
  },
  {
    src:'assets/works/growth/viral/viral-05.jpg', kind:'封面',
    topic:'菲林风格人物照片',
    title:'用胶片机拍到了人生照片！',
    note:'以人物笑容为视觉中心，搭配复古胶片色调、自然风景与多场景照片，营造轻松温暖的生活叙事；醒目的人像与「人生照」主题增强情绪代入，契合用户对氛围感内容的喜爱。',
    alt:'胶片机人生照片封面，人像主图与六宫格照片拼贴'
  },
  {
    src:'assets/works/growth/viral/viral-07.jpg', kind:'文案',
    topic:'考研上岸经验｜情绪共鸣型内容',
    title:'贵大新传考研上岸经验贴',
    metric:'4813 浏览 · 页面显示',
    note:'以「备考失利—坚持二战—最终上岸」为叙事主线，先建立情绪代入，再传递支持与鼓励；结合考研相关话题标签，触达目标人群。',
    alt:'贵大新传考研上岸经验贴正文截图，页面显示 4813 浏览'
  },
  {
    src:'assets/works/growth/viral/viral-08.jpg', kind:'文案',
    topic:'贵阳小狗总动员狗咖｜体验种草型内容',
    title:'贵阳｜小狗总动员狗咖·猫咖',
    metric:'2.5万 浏览 · 页面显示',
    note:'用「狗狗上班也有班味」的趣味观察制造记忆点，再通过狗狗性格、互动体验和现场反应呈现治愈氛围，搭配地点及品类标签提升本地搜索触达。',
    alt:'贵阳小狗总动员狗咖猫咖笔记正文截图，页面显示 2.5 万浏览'
  },
  {
    src:'assets/works/growth/viral/viral-09.jpg', kind:'文案',
    topic:'贵大新传复试急救指南｜实用攻略型内容',
    title:'贵大新传上岸学姐的复试急救指南',
    note:'抓住查分后的复试准备焦虑，以「时间紧、怎么准备」为切口，拆解复习计划、口语练习和模拟面试等行动建议，帮助读者快速上手。',
    alt:'贵大新传上岸学姐复试急救指南正文截图，含复习计划与勾选清单'
  },
  {
    src:'assets/works/growth/viral/viral-10.jpg', kind:'文案',
    topic:'宿舍减脂餐｜生活方式分享型内容',
    title:'宿舍小锅减脂餐',
    note:'从个人减脂经历切入，用体重变化建立真实感，再围绕宿舍设备、食材储存和搭配方法分享可复刻的做法，同时以提问引导用户交流食谱。',
    alt:'宿舍减脂餐笔记正文截图，含效果、食材存放与食材选用三段'
  },
  {
    src:'assets/works/growth/viral/viral-11.jpg', kind:'文案',
    topic:'玖合素手体验｜消费决策型内容',
    title:'玖合素手体验',
    note:'以真实到店体验切入，将营业时间、点单建议、口味评价和留宿规则分类呈现；既突出推荐项，也说明个人体验中的不足，让内容更实用、可信。',
    alt:'玖合素手体验笔记正文截图，编号列出推荐与留宿须知'
  },
];

/* ---------- 4a. 传播数据看板（MagicBento 数据表格） ----------
   第 26 轮：按用户要求删掉 REVIEW 环形图 / OUTPUT 产出结构 / CLIPS 剪报分布
   三张图表，只保留新华网、贵州日报、兴义三家机构的数据表格；
   并按用户提供的两家机构内容运营履历把表格数据补齐（选题、视频、审核、
   复盘、命中率等口径），不新增任何未经提供的数字。折线图用的是四篇
   新华网稿件「页面显示浏览量」的真实数值，caption 注明为连线示意。 */
const MEDIA_BOARD = [
  {
    label:'XINHUA / 新华网', title:'稿件总浏览量', value:'2000万+',
    unit:'2025.09–2025.12 · 内容运营', c:2, r:2, visual:'chart',
    chart:{
      values:[142.2, 145.8, 127.3, 101.5],
      labels:['稿件 01','稿件 02','稿件 03','稿件 04'],
      unit:'万', initial:'516.8万', note:'4 篇剪报页面浏览量合计',
      caption:'曲线为四篇新华网稿件页面显示浏览量的连线示意'
    },
    rows:[
      { k:'跟进发布会',       v:'15 场' },
      { k:'累计策划选题',     v:'33 个' },
      { k:'零失误上线稿件',   v:'21 篇' },
      { k:'稿件总浏览量',     v:'约2000万+' },
      { k:'篇均浏览',         v:'100万+' },
      { k:'累计复盘稿件',     v:'60+ 篇' },
      { k:'篇均浏览提升',     v:'+20%' },
      { k:'选题命中率',       v:'70%' }
    ]
  },
  {
    label:'GUIZHOU DAILY / 贵州日报', title:'全渠道曝光', value:'150万+',
    unit:'2026.04–2026.07 · 内容运营', c:2, r:1, visual:'bars',
    bars:[
      { k:'累计策划选题',   v:'30+ 个', pct:100 },
      { k:'全渠道曝光',     v:'150万+', pct:92 },
      { k:'单条最高播放',   v:'8万+',   pct:78 },
      { k:'产出短视频',     v:'22 条',  pct:68 },
      { k:'累计优化内容',   v:'40+ 篇', pct:56 },
      { k:'平均曝光提升',   v:'+30%',   pct:44 }
    ],
    foot:[
      { k:'短视频点赞', v:'5万+' },
      { k:'选题命中率', v:'70%' }
    ]
  },
  {
    label:'XINGYI / 兴义融媒体中心', title:'累计覆盖人群', value:'10万+',
    unit:'民生新闻采编与成片制作', c:2, r:1, visual:'table',
    rows:[
      { k:'民生新闻成片', v:'8 条' },
      { k:'参与采编报道', v:'5 篇' }
    ]
  }
];

/* ---------- 4b. 已发布稿件剪报（翻书册七页） ----------
   七张均为用户提供的真实稿件页面截图；浏览量 / 热度按截图页面原样标注，
   贵州日报三篇页面只显示「热度 ★★★★★」，不编造具体数字。
   url 为用户提供的原稿地址，按标题一一对应（与用户列出的顺序不同）：
   新华网 4 篇、贵州日报「天眼新闻」3 篇；点击剪报标题在新窗口打开原文。 */
const XH_TOKEN = '&share_device_token=CD1AA255-A51C-462D-8DF7-A958558E4C5F';
const XH = id => 'https://my-h5news.app.xinhuanet.com/h5/article.html?articleId=' + id + XH_TOKEN;
const MEDIA_CLIPS = [
  {
    no:'01', org:'新华网客户端', date:'2025.11.27',
    views:'142.2万', viewsLabel:'VIEWS / 页面显示浏览量',
    title:'“云贵咖路相逢·双冠啡同凡响”网络传播创享会在贵阳举办',
    url:XH('97c2d963db83fe15f03c31731b44366b') + '&share_time=1793338239962&share_type=6',
    src:'assets/works/media/clip-01.jpg',
    alt:'新华网客户端稿件截图：“云贵咖路相逢·双冠啡同凡响”网络传播创享会在贵阳举办，页面显示 142.2 万浏览',
    note:'稿件页面截图，来源为新华网客户端；页面显示浏览量 142.2 万。'
  },
  {
    no:'02', org:'新华网客户端', date:'2025.10.03',
    views:'145.8万', viewsLabel:'VIEWS / 页面显示浏览量',
    title:'贵州万峰林峰潮集人气旺 沉浸式体验打卡热',
    url:XH('65c88d25fc2582de49b69d965a0c57f7') + '&share_time=1793338412340&share_type=6',
    src:'assets/works/media/clip-02.jpg',
    alt:'新华网客户端稿件截图：贵州万峰林峰潮集人气旺 沉浸式体验打卡热，页面显示 145.8 万浏览',
    note:'稿件页面截图，来源为新华网客户端；页面显示浏览量 145.8 万。'
  },
  {
    no:'03', org:'新华网客户端', date:'2025.10.20',
    views:'127.3万', viewsLabel:'VIEWS / 页面显示浏览量',
    title:'首届环贵州公园省自行车赛第一赛段德克玛蒙邱天慧获男女职业组冠军',
    url:XH('01e95593ca118f95a4f59df2f7147575') + '&share_time=1793338364946&share_type=6',
    src:'assets/works/media/clip-03.jpg',
    alt:'新华网客户端稿件截图：首届环贵州公园省自行车赛第一赛段德克玛蒙邱天慧获男女职业组冠军，页面显示 127.3 万浏览',
    note:'稿件页面截图，来源为新华网客户端；页面显示浏览量 127.3 万。'
  },
  {
    no:'04', org:'新华网客户端', date:'2025.10.19',
    views:'101.5万', viewsLabel:'VIEWS / 页面显示浏览量',
    title:'首届环贵州公园省国际公路自行车赛在贵阳开幕',
    url:XH('48e4d0d1853d061cae31ec945db8fe39') + '&share_time=1793338383052&share_type=6',
    src:'assets/works/media/clip-04.jpg',
    alt:'新华网客户端稿件截图：首届环贵州公园省国际公路自行车赛在贵阳开幕，页面显示 101.5 万浏览',
    note:'稿件页面截图，来源为新华网客户端；页面显示浏览量 101.5 万。'
  },
  {
    no:'05', org:'贵州日报 · 天眼新闻', date:'2026.06.01',
    views:'热度 ★★★★★', viewsLabel:'HEAT / 页面显示热度',
    title:'打造贵州特色的行业词元体系｜访贵州大学多模态感知与边缘计算团队负责人杨静',
    url:'https://share.eyesnews.cn/news/news-news_detail-news_id-11515117171789.html',
    src:'assets/works/media/clip-05.jpg',
    alt:'贵州日报天眼新闻稿件截图：打造贵州特色的行业词元体系，访贵州大学多模态感知与边缘计算团队负责人杨静，页面显示五星热度',
    note:'稿件页面截图，来源为贵州日报报刊社「天眼新闻」；页面以五星热度呈现，未显示具体浏览量。'
  },
  {
    no:'06', org:'贵州日报 · 天眼新闻', date:'2026.04.30',
    views:'热度 ★★★★★', viewsLabel:'HEAT / 页面显示热度',
    title:'视频｜省工商联、省律协联合为黔企出海保驾护航',
    url:'https://share.eyesnews.cn/news/news-news_detail-news_id-11515117154977.html',
    src:'assets/works/media/clip-06.jpg',
    alt:'贵州日报天眼新闻视频稿件截图：省工商联、省律协联合为黔企出海保驾护航，页面署名含实习记者刘佳洛宸',
    note:'视频稿件页面截图，页面署名含「实习 刘佳洛宸」；页面以五星热度呈现，未显示具体浏览量。'
  },
  {
    no:'07', org:'贵州日报 · 天眼新闻', date:'2026.04.28',
    views:'热度 ★★★★★', viewsLabel:'HEAT / 页面显示热度',
    title:'贵州省工商联、省律协联合举办法律服务活动，常态化护航民企出海',
    url:'https://share.eyesnews.cn/news/news-news_detail-news_id-11515117153654.html',
    src:'assets/works/media/clip-07.jpg',
    alt:'贵州日报天眼新闻稿件截图：贵州省工商联、省律协联合举办法律服务活动，常态化护航民企出海，页面显示五星热度',
    note:'稿件页面截图，来源为贵州日报报刊社「天眼新闻」；页面以五星热度呈现，未显示具体浏览量。'
  },
];

/* ---------- 5b. 创意短片：ChromaGrid 聚光灯网格 ----------
   名称按用户最新口径；三张封面按画面语义与真实片源一一配对
   （三福 → 品牌广告片 / 苗银 → AIGC非遗短片 / 湘江 → 纪实宣传片），
   避免按文件字面顺序错配导致点击后播放错片。
   accent 为每张卡片的聚光灯光晕色；视频 preload="none"，点击后才加载。 */
const FILMS = [
  {
    no:'01', text:'品牌广告片', sub:'26s · 竖屏 · 三福品牌广告短片',
    image:'assets/works/films/film-01.jpg', video:'assets/works/films/film-01.mp4',
    alt:'三福「福伴好物 · 独处有搭」品牌广告片海报', accent:'#C58A62'
  },
  {
    /* 原片 ican.MP4 带 90° 旋转标记，旧片源 film-02.mp4 误按存储方向
       压成竖屏、人物横躺；film-02-wide.mp4 由原片重新导出为 1280×720
       横屏（主体完整居中，上下同帧模糊填充），播放形式与纪实片一致。 */
    no:'02', text:'AIGC非遗短片', sub:'1:57 · 横屏 · 苗银非遗水墨短片',
    image:'assets/works/films/film-03.jpg', video:'assets/works/films/film-02-wide.mp4',
    alt:'苗银「穿在身上的史诗」AIGC 非遗短片画面', accent:'#8E7CA8'
  },
  {
    no:'03', text:'纪实宣传片', sub:'2:26 · 横屏 · 《湘江·守护》纪实影像',
    image:'assets/works/films/film-02.jpg', video:'assets/works/films/film-03.mp4',
    alt:'《湘江·守护》纪实宣传片画面', accent:'#6E8C8A'
  },
];

/* ---------- 5c. 04 板块第二部分：ppt设计（CardSwap 卡片堆） ----------
   12 张真实竞赛提案 / 项目汇报页面，按用户提供顺序排列。 */
const PPT_SLIDES = [
  { src:'assets/works/ppt/ppt-01.jpg', title:'穿在身上的史诗 · 苗银的千年传承与匠造', alt:'iCAN 2025 大学生创新创业大赛 AI 挑战赛全国总决赛汇报封面' },
  { src:'assets/works/ppt/ppt-02.jpg', title:'汇报提纲 · 五段式叙事结构', alt:'汇报提纲页：缘起、创作、表达、成果、创新' },
  { src:'assets/works/ppt/ppt-03.jpg', title:'缘起 · AIGC 赋能非遗创造性转译', alt:'AIGC 赋能非遗创造性转译的论证页' },
  { src:'assets/works/ppt/ppt-04.jpg', title:'三环相扣 · 技术 / 美学 / 叙事', alt:'三环相扣：技术实现、美学选择、叙事构建' },
  { src:'assets/works/ppt/ppt-05.jpg', title:'第十五届「挑战杯」· 智助银龄', alt:'第十五届挑战杯中国大学生创业计划竞赛封面：智助银龄项目' },
  { src:'assets/works/ppt/ppt-06.jpg', title:'项目概述 · 调查结果', alt:'项目概述页：问卷 1630 份、村民访谈 717 人等调查数据' },
  { src:'assets/works/ppt/ppt-07.jpg', title:'社会价值 · 乐在乡小程序', alt:'乐在乡小程序低保真至高保真原型与最终展示' },
  { src:'assets/works/ppt/ppt-08.jpg', title:'社会价值 · 媒体报道', alt:'人民网、央广网等 80+ 主流媒体报道，累计阅读量超 428500 次' },
  { src:'assets/works/ppt/ppt-09.jpg', title:'颗粒奇兵 · 绿色高效农业减排技术', alt:'第十九届全国大学生节能减排竞赛作品封面：颗粒奇兵' },
  { src:'assets/works/ppt/ppt-10.jpg', title:'调研分析 · 贵州 9 地州市 68 个村庄', alt:'调研分析页：跨越 2000 公里、累计调查 600 余次' },
  { src:'assets/works/ppt/ppt-11.jpg', title:'研发历程 · 2023—2026', alt:'研发历程时间轴：组建团队、调研、研发化肥、试验田推广' },
  { src:'assets/works/ppt/ppt-12.jpg', title:'社会价值 · 产业与农业贡献', alt:'项目社会价值页：产业效益、农业贡献与示范数据' },
];

/* ---------- 5d. 04 板块第三部分：摄影 ----------
   人像照 6 张走 3D 环形画廊，风景照 18 张走漂移影像墙。 */
const PORTRAITS = [
  { src:'assets/works/photo/portrait-01.jpg', title:'人像照 01', subtitle:'花束 · 室内自然光', alt:'室内暖光人像，怀抱白色花束' },
  { src:'assets/works/photo/portrait-02.jpg', title:'人像照 02', subtitle:'秋日 · 街拍', alt:'秋日树荫下的街拍人像，手持相机' },
  { src:'assets/works/photo/portrait-03.jpg', title:'人像照 03', subtitle:'庭院 · 绿植', alt:'庭院绿植旁的环境人像' },
  { src:'assets/works/photo/portrait-04.jpg', title:'人像照 04', subtitle:'旗袍 · 建筑', alt:'中式建筑前的浅蓝旗袍人像' },
  { src:'assets/works/photo/portrait-05.jpg', title:'人像照 05', subtitle:'白裙 · 竹篮', alt:'绿植庭院中的白裙人像，手提竹篮' },
  { src:'assets/works/photo/portrait-06.jpg', title:'人像照 06', subtitle:'草地 · 逆光', alt:'草地逆光下的人像' },
];

const LANDSCAPES = [
  { src:'assets/works/photo/landscape-01.jpg', title:'风景照 01', tag:'火壶 · 夜', alt:'非遗火壶表演的火焰瞬间' },
  { src:'assets/works/photo/landscape-02.jpg', title:'风景照 02', tag:'打铁花 · 光轨', alt:'打铁花甩出的环形火花光轨' },
  { src:'assets/works/photo/landscape-03.jpg', title:'风景照 03', tag:'铁花 · 漫天', alt:'漫天铁花洒落的夜景' },
  { src:'assets/works/photo/landscape-04.jpg', title:'风景照 04', tag:'火壶 · 人群', alt:'围观人群前的火壶表演' },
  { src:'assets/works/photo/landscape-05.jpg', title:'风景照 05', tag:'落日 · 骑行', alt:'落日林荫道上的骑行者剪影' },
  { src:'assets/works/photo/landscape-06.jpg', title:'风景照 06', tag:'喷泉 · 逆光', alt:'逆光下的喷泉与行人' },
  { src:'assets/works/photo/landscape-07.jpg', title:'风景照 07', tag:'樱花 · 塔影', alt:'樱花枝与远处塔影' },
  { src:'assets/works/photo/landscape-08.jpg', title:'风景照 08', tag:'樱花 · 教学楼', alt:'樱花掩映下的红砖教学楼' },
  { src:'assets/works/photo/landscape-09.jpg', title:'风景照 09', tag:'老楼 · 树影', alt:'蓝天下老建筑与树影' },
  { src:'assets/works/photo/landscape-10.jpg', title:'风景照 10', tag:'雪岭 · 松林', alt:'雪地与松林、远山' },
  { src:'assets/works/photo/landscape-11.jpg', title:'风景照 11', tag:'林荫 · 光束', alt:'林荫小道与穿透树叶的光束' },
  { src:'assets/works/photo/landscape-12.jpg', title:'风景照 12', tag:'柏树 · 长路', alt:'两侧柏树夹道的长路' },
  { src:'assets/works/photo/landscape-13.jpg', title:'风景照 13', tag:'层峦 · 远山', alt:'层叠远山与山谷村落' },
  { src:'assets/works/photo/landscape-14.jpg', title:'风景照 14', tag:'湖湾 · 群山', alt:'群山之间的湖湾' },
  { src:'assets/works/photo/landscape-15.jpg', title:'风景照 15', tag:'热气球 · 晚霞', alt:'晚霞下的热气球与群山' },
  { src:'assets/works/photo/landscape-16.jpg', title:'风景照 16', tag:'云想山 · 落日', alt:'橙红落日下的云想山路牌与长椅' },
  { src:'assets/works/photo/landscape-17.jpg', title:'风景照 17', tag:'猫 · 街角', alt:'街角砖地上的猫' },
  { src:'assets/works/photo/landscape-18.jpg', title:'风景照 18', tag:'猫 · 室内', alt:'室内皮凳上的长毛猫' },
];

/* ---------- 7. 结束语板块照片集：八张真实照片（CircleGallery 图片圆环） ---------- */
const PERSONAL_PHOTOS = [
  { src:'assets/works/photo/personal/personal-01.jpg', title:'湖畔白裙', alt:'湖畔草地上身着白裙花衣的人像' },
  { src:'assets/works/photo/personal/personal-02.jpg', title:'湖畔回眸', alt:'湖畔回望镜头、手扶脸颊的人像' },
  { src:'assets/works/photo/personal/personal-03.jpg', title:'露台小憩', alt:'绿植露台旁身着米白衬衫的人像' },
  { src:'assets/works/photo/personal/personal-04.jpg', title:'长椅秋日', alt:'暖黄墙边长椅上、秋叶满地的人像' },
  { src:'assets/works/photo/personal/personal-05.jpg', title:'门廊光影', alt:'门廊木梁与竹篱前的人像' },
  { src:'assets/works/photo/personal/personal-06.jpg', title:'怀抱花束', alt:'庭院中怀抱花束的人像' },
  { src:'assets/works/photo/personal/personal-07.jpg', title:'林间漫步', alt:'林间小径、藕色裙装的人像' },
  { src:'assets/works/photo/personal/personal-08.jpg', title:'街角侧影', alt:'街边树旁、黑色上衣与米白长裙的人像' },
];

/* ---------- 通用小工具 ---------- */
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* ---------- 渲染：增长矩阵内容切片（清晰弧形画廊 / 原图直出） ----------
   六张截图全部用 DOM <img> contain 呈现，卡片不做滤镜、不做淡入磨砂；
   保留弧线排布与拖拽 / 箭头 / 方向键翻阅，点中间卡片直接进入全屏观图层。 */
const growthEl = document.getElementById('growthGallery');
if (growthEl && window.CircularGallery) {
  window.CircularGallery.init(growthEl, GROWTH_SLIDES.map(s => ({
    image: s.viewer || s.src,
    viewer: s.viewer || s.src,
    text: s.data || s.short,
    description: s.label,
    alt: s.alt
  })), {
    labelPrefix: 'SLICE',
    hint: '拖拽 / ← → 切换 · 原图清晰直出 · 点击放大查看完整截图'
  });
}

/* ---------- 渲染：爆款封面与文案（四排索引：5列×4排，上封下文） ----------
   每 5 个帖子为一组：第一排封面 / 第二排文案（帖子 01–05），
   第三排封面 / 第四排文案（帖子 06–10）；每个封面正上方即自己的文案。
   封面点击调 Lightbox 放大看原图。 */
const viralEl = document.getElementById('viralSwiper');
if (viralEl) {
  const items = VIRAL_POSTS.map(p => ({ src: p.src, viewer: p.src, title: p.title, alt: p.alt }));
  const total = VIRAL_POSTS.length;
  const COLS = 5;                                  // 每组列数 → 整体 5 列
  viralEl.classList.add('viral-masonry');
  viralEl.innerHTML =
    /* 全部封面：帖子 01–05 落在第 1 排，06–10 落在第 3 排 */
    VIRAL_POSTS.map((p, i) => {
      const row = (i < COLS ? 1 : 3);
      const col = (i % COLS) + 1;
      return `
      <button class="viral-shot" type="button" data-i="${i}" aria-label="放大查看：${esc(p.title)}"
              style="grid-row:${row};grid-column:${col}">
        <img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy" draggable="false">
      </button>`;
    }).join('') +
    /* 全部文案：帖子 01–05 落在第 2 排，06–10 落在第 4 排 */
    VIRAL_POSTS.map((p, i) => {
      const row = (i < COLS ? 2 : 4);
      const col = (i % COLS) + 1;
      return `
      <figcaption class="viral-cap" style="grid-row:${row};grid-column:${col}">
        <span class="viral-kind eyebrow">VIRAL ${String(i + 1).padStart(2, '0')} / ${total} · ${esc(p.kind)}</span>
        <span class="viral-topic serif">${esc(p.title)}</span>
        <p class="viral-note">${esc(p.note)}</p>
        ${p.metric ? `<span class="viral-metric eyebrow">${esc(p.metric)}</span>` : ''}
      </figcaption>`;
    }).join('');
  viralEl.querySelectorAll('.viral-shot').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.i);
      if (window.Lightbox) window.Lightbox.open(items, idx);
    });
  });
}

/* ---------- 渲染：公众号运营 2×2 推文卡片 ----------
   整卡即链接，新窗口打开微信原文；封面右上角为浏览量角标。 */
const wechatEl = document.getElementById('wechatPosts');
if (wechatEl) {
  wechatEl.innerHTML = WECHAT_POSTS.map(p => `
    <a class="wx-card" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer"
       aria-label="${esc(p.title)} — 新窗口打开原推文">
      <span class="wx-cover">
        <img src="${esc(p.cover)}" alt="${esc(p.title)} · 推文封面" loading="lazy" draggable="false">
        <span class="wx-views">
          <span class="wx-views-num serif">${esc(p.views)}</span>
          <span class="eyebrow">${esc(p.viewsLabel)}</span>
        </span>
        <span class="wx-open eyebrow">阅读原文 <span aria-hidden="true">↗</span></span>
      </span>
      <span class="wx-meta">
        <span class="eyebrow">WECHAT ${esc(p.no)} / ${esc(p.org)}</span>
        <span class="wx-title serif">${esc(p.title)}</span>
      </span>
    </a>`).join('');
}

/* 第 27 轮：5.png 所示的「实习内容」文字（导语 + 三条可展开履历）整体删掉，
   改由 index.html 中表格上方的三行「实习地点与时间」直接交代清楚；
   两家机构的全部指标已由下方 MEDIA_BOARD 数据表格完整承载。 */

/* ---------- 渲染：权威媒体已发布稿件翻书册 ----------
   flipbook.js 负责 3D 翻页与交互，这里只传七张真实剪报。 */
const flipbookEl = document.getElementById('mediaFlipbook');
if (flipbookEl && window.FlipBook) {
  window.FlipBook.init(flipbookEl, MEDIA_CLIPS);
}

/* ---------- 渲染：01 教育背景「滚动逐字揭示」 ----------
   按 ReactBits ScrollReveal 规格：rise 遮罩 + 模糊渐清 + 交错 stagger +
   随滚动 scrub 推进，字符短暂泛出墨蓝高亮后回正。滚动到板块时文字
   从左到右、由上至下逐字落定；reduced-motion 下保持静态原文。 */
if (window.ScrollReveal) {
  const edu = document.querySelector('.edu');
  if (edu) {
    const label = edu.querySelector(':scope > .eyebrow');
    const rows = edu.querySelector('.edu-rows');
    const look = {
      effect: 'rise', enableBlur: true, blurStrength: 5, baseOpacity: .1,
      baseRotation: 1.4, stagger: .04, highlightColor: '#1E305E'
    };
    if (label) window.ScrollReveal.init(label, Object.assign({}, look, {
      baseRotation: 0, stagger: .08, blurStrength: 4
    }));
    if (rows) window.ScrollReveal.init(rows, look);
  }
}

/* ---------- 教育背景：SplitText 拆字入场（仅校名 pop 弹入）----------
   校名（贵州大学 / 齐齐哈尔大学）交给 SplitText 用 pop 逐字弹入 +
   藏蓝高亮回墨；鼠标邻近的逐字波浪放大已按需求移除，改由 CSS
   在 .edu 整框悬停时整体放大（见 styles.css 的 .reveal.edu.is-in:hover）。
   ScrollReveal 已跳过 .srev-skip，两个组件不会重复拆同一段文字。 */
if (window.SplitTextFX) {
  const schoolEls = document.querySelectorAll('.edu-school[data-split-text]');
  if (schoolEls.length) {
    window.SplitTextFX.init(schoolEls, {
      effect: 'pop', delay: 55, duration: 1.05,
      accentColor: '#1E305E', threshold: .12,
      srOnly: false   /* .edu-rows 已由 ScrollReveal 生成完整读屏副本，不重复 */
    });
  }
}

/* ---------- 渲染：03 传播数据看板（MagicBento 原生等价） ---------- */
const bentoEl = document.getElementById('mediaBento');
if (bentoEl && window.MagicBento) {
  window.MagicBento.init(bentoEl, MEDIA_BOARD, {
    intro: true, tilt: 3, magnet: 5,
    ariaLabel: '权威媒体传播履历数据看板，三张可交互数据表格卡片'
  });
}

/* ---------- 渲染：创意短片聚光灯网格 ----------
   chroma-grid.js 负责径向显色、卡片光晕与播放弹层；
   这里只传三段短片的封面、片源、名称与光晕色。 */
const filmEl = document.getElementById('filmGallery');
if (filmEl && window.ChromaGrid) {
  window.ChromaGrid.init(filmEl, FILMS, { columns:3, minCardWidth:210, radius:280 });
}

/* ---------- 6. 综合能力背书：技能分组 / 荣誉奖项 ----------
   技能按五类划分，交给 glass-skills.js 渲染成玻璃图标 + 文件夹纸片：
   悬停/点击图标打开对应分类的技能夹，纸片交错弹出、可拖拽。
   五类 17 项的名称与顺序一字未改，App 小图标仍来自 app-icons.js；
   荣誉与竞赛按用户提供的原始顺序，交给 line-sidebar.js 做邻近感应。 */
const SKILL_GROUPS = [
  { label:'语言能力', children:[
    { value:'mandarin', label:'普通话（二级甲等）' },
    { value:'cet4', label:'英语（CET-4）' }
  ]},
  { label:'新媒体平台', children:[
    { value:'douyin', label:'抖音', icon:'douyin' },
    { value:'xhs', label:'小红书', icon:'xhs' },
    { value:'wechat', label:'微信公众号', icon:'wechat' }
  ]},
  { label:'内容制作与视觉设计', children:[
    { value:'ps', label:'Photoshop', icon:'ps' },
    { value:'jianying', label:'剪映', icon:'jianying' },
    { value:'xiumi', label:'秀米', icon:'xiumi' }
  ]},
  { label:'AI 创作工具', children:[
    { value:'claude', label:'Claude', icon:'claude' },
    { value:'midjourney', label:'Midjourney', icon:'midjourney' },
    { value:'doubao', label:'豆包', icon:'doubao' },
    { value:'deepseek', label:'DeepSeek', icon:'deepseek' },
    { value:'wordbuddy', label:'WordBuddy', icon:'wordbuddy' },
    { value:'jimeng', label:'即梦 AI', icon:'jimeng' }
  ]},
  { label:'数据分析与办公工具', children:[
    { value:'newrank', label:'新榜', icon:'newrank' },
    { value:'powerbi', label:'Power BI', icon:'powerbi' },
    { value:'office', label:'Microsoft Office（Word、Excel、PowerPoint）',
      icons:[{after:'Word',key:'word'},{after:'Excel',key:'excel'},{after:'PowerPoint',key:'powerpoint'}] }
  ]}
];

const HONORS = [
  { date:'2026.11', text:'贵州省及校级“三好学生”' },
  { date:'2026.10', text:'贵州大学单项奖学金' },
  { date:'2026.05', text:'贵州大学校级“优秀共青团员”' },
  { date:'2026.08', text:'贵州大学校级组织活动“优秀工作者”4项、“先进个人”' },
  { date:'2025.11', text:'贵州大学2025年暑期“四大文化工程”专题社会实践活动“优秀实践团队”' },
  { date:'2025.10', text:'贵州大学硕士一等奖学金' },
  { date:'2025.05', text:'“正大杯”第十五届全国大学生市场调查与分析大赛研究生组&在华留学生组全国总决赛“优秀志愿者”' }
];

/* ---------- 6b. 荣誉证书原件截图（Folder 动画的 24 张卡片） ----------
   全部来自用户提供的真实证书截图，按给定顺序压缩存放。 */
const CERTIFICATES = Array.from({ length:24 }, (_, i) => ({
  src:'assets/works/certificates/cert-' + String(i + 1).padStart(2, '0') + '.jpg',
  alt:'荣誉证书原件截图 ' + String(i + 1).padStart(2, '0')
}));

const COMPETITIONS = [
  { date:'2026.09', text:'全国大学生广告艺术大赛全国总决赛优秀奖1项、贵州赛区二等奖2项及三等奖4项' },
  { date:'2026.08', text:'第十五届“挑战杯”贵州省大学生创业计划竞赛省二等奖' },
  { date:'2026.08', text:'中国好创意暨全国数字艺术设计大赛省一等奖' },
  { date:'2025.12', text:'iCAN大学生创新创业大赛AI挑战赛全国总决赛一等奖' },
  { date:'2025.11', text:'贵州大学“‘今天’拍张照——第六届溪山里的国庆节”摄影大赛三等奖' },
  { date:'2025.10', text:'第十三届全国大学生数字媒体科技作品及创意竞赛全国总决赛三等奖2项、贵州省赛二等奖2项及三等奖1项' },
  { date:'2025.07', text:'“诵读中国”经典诵读大赛贵州省二等奖' },
  { date:'2025.06', text:'第19届全国大学生节能减排社会实践与科技竞赛贵州大学二等奖' },
  { date:'2025.06', text:'“多彩创意，潮赋新生”全省大学生文化创新设计大赛贵州大学三等奖' },
  { date:'2025.06', text:'“青春在场·万物有声”微信推文设计大赛三等奖' }
];

/* ---------- 渲染：综合能力背书 ----------
   glass-skills.js 负责五枚玻璃图标与对应技能夹（含 App 小图标）；
   line-sidebar.js 负责荣誉 / 竞赛邻近感应；folder.js 负责证书文件夹；
   ip-buddy.js 负责六个板块标题的 IP 形象。
   这里只传五类技能、七条荣誉、十条竞赛与二十四张证书。 */
const skillEl = document.getElementById('skillGlass');
if (skillEl && window.GlassSkills) {
  window.GlassSkills.init(skillEl, SKILL_GROUPS, { labelPrefix: 'TOOLS' });
}
const honorEl = document.getElementById('honorList');
const awardEl = document.getElementById('awardList');
if (honorEl && window.LineSidebar) window.LineSidebar.init(honorEl, HONORS);
if (awardEl && window.LineSidebar) window.LineSidebar.init(awardEl, COMPETITIONS);

const certEl = document.getElementById('certFolder');
if (certEl && window.CertFolder) window.CertFolder.init(certEl, CERTIFICATES, { perPage:6 });
if (window.IpBuddy) window.IpBuddy.init();

/* ---------- 渲染：04 板块上下三段 ----------
   创意短片（ChromaGrid 聚光灯网格）已在上方初始化；此处初始化 ppt设计与摄影。 */
const pptEl = document.getElementById('pptSwap');
if (pptEl && window.CardSwap) {
  window.CardSwap.init(pptEl, PPT_SLIDES, { delay:4600, visibleCards:4, autoplay:true });
}
const portraitEl = document.getElementById('portraitCarousel');
if (portraitEl && window.CircularCarousel) {
  window.CircularCarousel.init(portraitEl, PORTRAITS, { interval:3.8, speed:11 });
}
const landscapeEl = document.getElementById('landscapeWall');
if (landscapeEl && window.ReelGallery) {
  window.ReelGallery.init(landscapeEl, LANDSCAPES.map(function (l) {
    return { src: l.src, alt: l.alt || l.title };
  }), {
    rows: 4, rowHeight: 132, rowGap: 18, itemGap: 14,
    tilt: 7, arch: 46, autoScroll: 26, speedVariance: 0.5, alternate: true,
    grayscale: 0.7, focusRadius: 230, focusStrength: 1, radius: 12,
    fade: 0.12, dim: 0.35, taper: 0.12
  });
}

/* ---------- 渲染：07 结束语板块 · 照片圆环（React Bits Pro「Circle Gallery」规格） ----------
   A draggable circle of images that spins with inertia：
   平面圆环排布 / 按角度拖拽 / 松手惯性 / 5°/s 自动慢转 / 001-008 编号。
   半径按容器短边百分比换算，因此缩小后放进收尾版面的左栏。 */
const personalEl = document.getElementById('personalGallery');
if (personalEl && window.CircleGallery) {
  window.CircleGallery.init(personalEl, PERSONAL_PHOTOS, {
    radiusPercent: 36,
    itemWidth: 92, itemHeight: 122, itemScale: 0.95,
    borderRadius: 8, enableDrag: true, throwResistance: 0.30,
    animationDuration: 0.9, animationStagger: 0.07,
    showNumbers: true, autoSpin: 5, keepUpright: true
  });
}

/* ---------- 渲染：05 项目操盘现场影像（BounceCards 弹性卡片） ----------
   与用户提供的 React 组件同参：PATTERN 扇形 / 弹簧入场 / hover 推开 / 点击放大。 */
const bounceEl = document.getElementById('projectBounce');
if (bounceEl && window.BounceCards) {
  window.BounceCards.init(bounceEl, [
    { src:'assets/works/project/project-01.jpg', alt:'学院第三届研究生会主席工作汇报现场大屏', no:'01 / REPORT',    cap:'研究生会工作汇报' },
    { src:'assets/works/project/project-02.jpg', alt:'院研究生会主席在会议现场发言',           no:'02 / ON SITE',   cap:'现场统筹与发言' },
    { src:'assets/works/project/project-03.jpg', alt:'百人级活动落幕后的舞台大合影',           no:'03 / ACTIVITY',  cap:'百人级活动合影' },
    { src:'assets/works/project/project-04.jpg', alt:'国家级赛事开闭幕式现场，礼堂内坐满师生', no:'04 / CEREMONY',  cap:'开闭幕式 · 1500+ 师生' },
    /* 第 22 轮补充的 5 张现场影像（原列表里「个人风采3」与「个人风采3-1」
       是同一张照片，已去重，只保留一张）。 */
    { src:'assets/works/project/project-05.jpg', alt:'「正大杯」第十五届全国大学生市场调查与分析大赛研究生组总决赛一等奖颁奖合影', no:'05 / AWARD',     cap:'正大杯总决赛 · 一等奖' },
    /* 竖幅照片另出一张方形卡面（保留面部与银冠），放大层仍看完整原图 */
    { src:'assets/works/project/project-06-card.jpg', viewer:'assets/works/project/project-06.jpg',
      alt:'iCAN 大学生创新创业大赛 AI 挑战赛全国总决赛展位，身着苗族服饰介绍非遗 AIGC 作品', no:'06 / EXHIBIT', cap:'非遗 AIGC 作品展位' },
    { src:'assets/works/project/project-07.jpg', alt:'志愿服务现场，与孩子们围坐交流',         no:'07 / VOLUNTEER', cap:'志愿服务 · 优秀志愿者' },
    { src:'assets/works/project/project-08.jpg', alt:'iCAN 大学生创新创业大赛全国总决赛团队合影', no:'08 / TEAM',      cap:'iCAN 总决赛 · 团队合影' },
    { src:'assets/works/project/project-09.jpg', alt:'第十五届「挑战杯」贵州省大学生创业计划竞赛终审决赛合影', no:'09 / FINAL',     cap:'挑战杯省赛终审决赛' }
  ], {
    rotation: 10, arc: 24, bounciness: 0.62,
    animationDelay: 0.30, animationStagger: 0.09,
    enableHover: true, hoverScale: 1.09,
    borderWidth: 5, borderColor: '#FFFCF8', radius: 10, shadow: true
  });
}

/* ---------- 渲染：底部章节条 ---------- */
const pillsEl = document.getElementById('chapterPills');
if (pillsEl) {
  pillsEl.innerHTML = CHAPTERS.map((c,i) => `
    <a class="chapter-pill${i===0?' is-active':''}" href="#${c.id}" data-pill="${c.id}">${esc(c.label)}</a>`).join('');
}

/* ---------- 交互：滚动状态 ---------- */
const hdr = document.getElementById('hdr');
const fill = document.getElementById('progressFill');
const currentEl = document.getElementById('chapterCurrent');
const pills = [...document.querySelectorAll('.chapter-pill')];
pills.forEach(p => p.addEventListener('click', () => setActive(p.dataset.pill)));
const navLinks = [...document.querySelectorAll('.hdr-nav a')];

const onScroll = () => {
  const y = window.scrollY || document.documentElement.scrollTop;
  if (hdr) hdr.classList.toggle('is-scrolled', y > 12);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (fill) fill.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
};
window.addEventListener('scroll', onScroll, { passive:true });
window.addEventListener('resize', onScroll);
onScroll();

const setActive = (id) => {
  pills.forEach(p => p.classList.toggle('is-active', p.dataset.pill === id));
  navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
  const c = CHAPTERS.find(c => c.id === id);
  if (c && currentEl) currentEl.textContent = c.short;
};

/* 收尾版面的联系方式进入视口中带时，兜底把章节计数切到 08 / CLOSING
   （IntersectionObserver 只在状态翻转时回调，锚点跳转后可能不触发） */
window.addEventListener('scroll', () => {
  const c = document.getElementById('contact');
  if (!c) return;
  const r = c.getBoundingClientRect();
  if (r.top < window.innerHeight * .62 && r.bottom > window.innerHeight * .12) setActive('closing');
}, { passive: true });

if ('IntersectionObserver' in window) {
  const chapterObserver = new IntersectionObserver((entries) => {
    const vis = entries.filter(e => e.isIntersecting);
    const visible = vis.sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setActive(visible.target.id);
  }, { rootMargin:'-30% 0px -55% 0px', threshold:[0, .1, .3, .6] });
  document.querySelectorAll('[data-chapter]').forEach(s => chapterObserver.observe(s));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); revealObserver.unobserve(e.target); } });
  }, { rootMargin:'25% 0px 25% 0px', threshold:0 });
  document.querySelectorAll('.reveal').forEach((n,i) => {
    n.style.setProperty('--d', `${Math.min(i % 5, 4) * 80}ms`);
    revealObserver.observe(n);
  });
} else {
  document.querySelectorAll('.reveal').forEach(n => n.classList.add('is-in'));
}

/* ---------- 进场效果兜底：不依赖滚动位置 ----------
   逐字揭示、拆字入场、能力图谱描边、数据看板交错入场原本都只在
   IntersectionObserver 命中时才点亮；锚点直达 / 极快滚动 / 元素高于视口
   时会出现「文字不展开、效果不出现」。这里统一派发一次点亮事件，
   由各动画模块自己落到最终态：任何滚动角度都可读、可点、可展开。 */
function forceEffects() {
  document.querySelectorAll('.reveal').forEach(n => n.classList.add('is-in'));
  const sg = document.getElementById('capGraph');
  if (sg) sg.classList.add('is-in');
  document.querySelectorAll('.mb-grid[data-intro] .mb-cell').forEach(n => { n.dataset.state = 'in'; });
  document.dispatchEvent(new Event('fx:reveal-all'));
}
let effectsForced = false;
const forceEffectsOnce = () => {
  if (effectsForced) return;
  effectsForced = true;
  forceEffects();
};
if (location.hash) forceEffectsOnce();                       // 带锚点直达，立即点亮
window.addEventListener('scroll', forceEffectsOnce, { once:true, passive:true });
['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
  window.addEventListener(ev, forceEffectsOnce, { once:true, passive:true }));
window.addEventListener('hashchange', forceEffectsOnce, { once:true });
window.addEventListener('load', () => setTimeout(forceEffectsOnce, 250));
setTimeout(forceEffectsOnce, 1200);

/* ---------- 交互：移动端 MENU ---------- */
const menuBtn = document.getElementById('menuBtn');
const hdrNav = document.getElementById('hdrNav');
if (menuBtn && hdrNav) {
  const closeMenu = () => { hdrNav.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded','false'); menuBtn.textContent = 'MENU'; };
  menuBtn.addEventListener('click', () => {
    const open = hdrNav.classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'CLOSE' : 'MENU';
  });
  hdrNav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
}

/* ---------- 交互：Hero 开场短片（打开自动播一次，之后点击才重播） ----------
   - 页面打开后自动完整播放一次，播完停在末帧，不循环
   - 这一次播放结束后，桌面与触屏统一「点击影像区」播放 / 暂停；移开鼠标不再暂停
   - 原声优先（渐进增强）：先按有声发起自动播放，浏览器放行的环境真的会
     带原声播一次、无需任何按钮；被 Autoplay Policy 拦下才静音降级，并显示
     「开启声音」入口。首次真实交互也会补上原声、解锁 BGM
   - PLAY / PAUSE / REPLAY 与 SOUND / MUTE 随时可手动控制；离屏自动暂停 */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const heroMedia = document.getElementById('heroMedia');
const heroVideo = document.getElementById('heroVideo');
const videoToggle = document.getElementById('videoToggle');
const soundToggle = document.getElementById('soundToggle');
const soundUnlock = document.getElementById('soundUnlock');
const hoverHint = document.getElementById('hoverHint');
const hintLabel = document.getElementById('hintLabel');
const heroSection = document.getElementById('hero');

if (heroVideo) {
  let soundTouched = false;
  let soundManuallyOff = false;
  // introPhase = 页面打开后的那一次自动播放阶段；结束后才允许点击重播
  let introPhase = true;
  const hideUnlock = () => { if (soundUnlock) soundUnlock.hidden = true; };
  const showUnlock = () => { if (soundUnlock) soundUnlock.hidden = false; };
  const unlockAudio = () => {
    if (!soundManuallyOff && heroVideo.muted) setSound(true);
    // 收起按钮统一交给 dismissUnlock（交互完成后），BGM 模块自身监听首次手势
  };
  const endIntro = () => {
    if (!introPhase) return;
    introPhase = false;
    if (hintLabel) hintLabel.textContent = 'CLICK TO PLAY / 点击播放';
    // 首播阶段结束（播完 / 被浏览器拦下 / 滚离首屏）：通知 BGM 可以接续播放
    document.dispatchEvent(new Event('hero:intro-complete'));
  };

  const setHint = (show) => {
    if (hoverHint) hoverHint.classList.toggle('is-hidden', !show);
  };
  const syncToggle = () => {
    const ended = heroVideo.ended;
    const paused = heroVideo.paused;
    if (videoToggle) {
      videoToggle.textContent = ended ? 'REPLAY' : paused ? 'PLAY' : 'PAUSE';
      videoToggle.setAttribute('aria-label', ended ? '重播开场短片' : paused ? '播放开场短片' : '暂停开场短片');
      videoToggle.setAttribute('aria-pressed', String(paused || ended));
    }
    if (heroMedia) heroMedia.classList.toggle('is-playing', !paused && !ended);
    setHint(paused || ended);
  };
  const setSound = (on) => {
    heroVideo.muted = !on;
    heroVideo.volume = 1;
    if (soundToggle) {
      soundToggle.textContent = on ? 'MUTE' : 'SOUND';
      soundToggle.setAttribute('aria-pressed', String(on));
      soundToggle.setAttribute('aria-label', on ? '关闭开场短片原声' : '开启开场短片原声');
    }
  };
  const play = () => {
    if (heroVideo.ended) { try { heroVideo.currentTime = 0; } catch (e) {} }
    const p = heroVideo.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // 有声播放被自动播放策略拦截 → 静音重试；用户已手动设过声音就不覆盖
        if (!heroVideo.muted && !soundTouched) setSound(false);
        const retry = heroVideo.play();
        if (retry && typeof retry.catch === 'function') retry.catch(() => {});
      });
    }
    syncToggle();
  };
  const pause = () => {
    if (!heroVideo.paused) heroVideo.pause();
    syncToggle();
  };

  if (videoToggle) {
    videoToggle.addEventListener('click', () => {
      endIntro(); // 访客手动接管后，后续一律由点击影像区触发
      if (heroVideo.paused || heroVideo.ended) play(); else pause();
    });
  }
  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      soundTouched = true;
      const turningOn = heroVideo.muted;
      soundManuallyOff = !turningOn;
      setSound(turningOn);
    });
  }
  if (soundUnlock) {
    soundUnlock.addEventListener('click', () => {
      soundTouched = true;
      soundManuallyOff = false;
      unlockAudio();
      endIntro();   // 之后交还控制权：点击影像区重播
      // 首播被策略压成静音时，这里带原声从头完整重播一次，让开场白被听到
      try { heroVideo.currentTime = 0; } catch (e) {}
      play();
    });
  }

  heroVideo.addEventListener('play', syncToggle);
  heroVideo.addEventListener('pause', syncToggle);
  heroVideo.addEventListener('ended', () => {
    endIntro(); // 这一次自动播放完成，停在末帧，解锁点击重播
    syncToggle();
  });

  // 初始状态：按「有声」准备（渐进增强）。放行的浏览器会真的带原声播一次；
  // 被拦时 startIntro 的 catch 会静音降级并显示「开启声音」入口。
  setSound(true);
  syncToggle();

  let introStarted = false;
  const startIntro = () => {
    if (introStarted) return;
    introStarted = true;
    // 先按有声发起自动播放，给浏览器一个放行机会；不做「先解除静音再探测」
    // 之外的花招。失败时静音重试，保证这一遍仍完整播完、停在末帧。
    const p = heroVideo.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        // 有声自动播放成功：不需要任何解锁入口
        if (!heroVideo.muted) hideUnlock();
      }).catch(() => {
        // 访客已点过页面（有手势）→ 直接有声重试即可；否则静音降级并给出入口
        if (soundTouched) {
          const again = heroVideo.play();
          if (again && typeof again.catch === 'function') again.catch(() => {});
          return;
        }
        setSound(false);   // 降级静音，保证这一遍完整播完
        showUnlock();      // 保留首次交互补声的入口
        const retry = heroVideo.play();
        if (retry && typeof retry.catch === 'function') retry.catch(() => {});
      });
    }
    syncToggle();
  };
  if (heroVideo.readyState >= 2) startIntro();
  else heroVideo.addEventListener('canplay', startIntro, { once:true });
  setTimeout(startIntro, 1200); // 兜底：元数据迟迟不来时直接尝试
  // 若浏览器完全拦截自动播放，兜底解锁点击重播，不让页面永远停在封面
  setTimeout(() => {
    if (introPhase && (heroVideo.paused || heroVideo.ended)) endIntro();
  }, 7000);

  if (heroMedia) {
    // 桌面与触屏统一：点击影像区播放 / 暂停；悬停、移开鼠标都不再触发
    heroMedia.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('.media-controls, .hero-follow')) return;
      if (introPhase) return;   // 首播完整播完一次，不被点击打断
      if (heroVideo.paused || heroVideo.ended) play(); else pause();
    });
  }

  // 任意首次真实点击 / 按键 / 触摸都算解锁（不必非要点「开启声音」）：
  // 此刻浏览器已放行有声播放，补上视频原声；但不主动重播视频，
  // 避免访客只是想滚动 / 点导航时被打扰（想听完整开场白可点击影像区重播）。
  const firstGesture = (e) => {
    soundTouched = true;
    const onSoundButton = e.target && e.target.closest && e.target.closest('#soundToggle');
    if (!onSoundButton && heroVideo.muted && !soundManuallyOff) setSound(true);
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.removeEventListener(ev, firstGesture, true));
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, firstGesture, true));

  // 引导按钮放到「交互完成之后」再收起：若 pointerdown 阶段就把它移出渲染树，
  // 浏览器可能取消随后派发到该按钮的 click，导致带原声重播不触发。
  const dismissUnlock = () => { setTimeout(hideUnlock, 0); };
  window.addEventListener('click', dismissUnlock, { once: true });
  window.addEventListener('keydown', dismissUnlock, { once: true });

  // 离开首屏暂停；回到首屏不自动恢复，等下一次点击
  if ('IntersectionObserver' in window && heroSection) {
    new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) {
          if (introPhase) endIntro(); // 首播被滚动打断，后续交给点击
          pause();
        }
      });
    }, { threshold:.12 }).observe(heroSection);
  }
}

/* ---------- 交互：逐字放大镜 + 水波纹 ----------
   wave-text.js 自动接管所有 [data-wave] 文字行：
   Hero 姓名、六个板块标题、五张能力卡标题。
   触屏与 prefers-reduced-motion 下自动降级为静态文字，无需在此初始化。 */

/* 自定义箭头光标改由 styles.css 的 --cursor-arrow（SVG 光标）实现，原圆圈光标已移除 */

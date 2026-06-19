// 潮线 Tideline · Mock data ------------------------------------------------
// All numbers are fictional. Brands/influencers are invented names.

window.TL = window.TL || {};

TL.brands = [
  { id: 'b1', name: '青朴自然护肤', cat: '美妆个护', logo: '青' },
  { id: 'b2', name: '林野鲜食', cat: '食品饮料', logo: '林' },
  { id: 'b3', name: '小鹿家居', cat: '家居日用', logo: '鹿' },
  { id: 'b4', name: '云杉运动', cat: '运动户外', logo: '云' },
  { id: 'b5', name: '北麓数码', cat: '3C数码', logo: '北' },
];

TL.team = [
  { id: 'u1', name: '陈思远', role: '主理人', av: 'av-c1', initial: '陈' },
  { id: 'u2', name: '林玥', role: '编导', av: 'av-c2', initial: '林' },
  { id: 'u3', name: '周一航', role: '剪辑', av: 'av-c3', initial: '周' },
  { id: 'u4', name: '宋知夏', role: '数据分析', av: 'av-c4', initial: '宋' },
  { id: 'u5', name: '苏念', role: '直播运营', av: 'av-c5', initial: '苏' },
  { id: 'u6', name: '黎明', role: '投放', av: 'av-c6', initial: '黎' },
];

TL.tasks = [
  { id: 't101', title: '青朴山茶花精华 · 9月主推视频脚本 v2', brand: 'b1', stage: 'review', assignee: 'u2', due: '今天 18:00', priority: 'high', cover: 'video', score: 86 },
  { id: 't102', title: '林野手剥松子 · 直播间预告短视频', brand: 'b2', stage: 'shoot', assignee: 'u3', due: '明天 12:00', priority: 'med', cover: 'video', score: 72 },
  { id: 't103', title: '小鹿真丝枕套 · 测评对比图文', brand: 'b3', stage: 'edit', assignee: 'u2', due: '5月14日', priority: 'med', cover: 'image', score: 68 },
  { id: 't104', title: '云杉夏日防晒衣 · 达人合作剧情', brand: 'b4', stage: 'plan', assignee: 'u1', due: '5月15日', priority: 'high', cover: 'video', score: 90 },
  { id: 't105', title: '北麓 N1 蓝牙耳机 · 开箱测评', brand: 'b5', stage: 'plan', assignee: 'u3', due: '5月16日', priority: 'low', cover: 'video', score: 64 },
  { id: 't106', title: '青朴 · 母亲节大促首图&主图', brand: 'b1', stage: 'done', assignee: 'u2', due: '已完成', priority: 'high', cover: 'image', score: 95 },
  { id: 't107', title: '林野 · 直播脚本（5/12 晚 19:30）', brand: 'b2', stage: 'review', assignee: 'u5', due: '今天 22:00', priority: 'high', cover: 'doc', score: 81 },
  { id: 't108', title: '云杉防晒衣 · 投流素材 ×6', brand: 'b4', stage: 'edit', assignee: 'u6', due: '5月13日', priority: 'med', cover: 'video', score: 75 },
  { id: 't109', title: '小鹿 · 周报数据复盘', brand: 'b3', stage: 'done', assignee: 'u4', due: '已完成', priority: 'low', cover: 'doc', score: 92 },
];

TL.stages = [
  { id: 'plan',   name: '选题/脚本',   color: 'oklch(0.7 0.05 258)' },
  { id: 'shoot',  name: '拍摄/生成',   color: 'oklch(0.7 0.12 200)' },
  { id: 'edit',   name: '剪辑/制作',   color: 'oklch(0.7 0.12 320)' },
  { id: 'review', name: '审核',        color: 'oklch(0.72 0.14 70)' },
  { id: 'done',   name: '已发布',      color: 'oklch(0.7 0.13 152)' },
];

TL.activity = [
  { who: 'u4', what: '完成了', obj: '小鹿 · 周报数据复盘', when: '12 分钟前' },
  { who: 'u2', what: '提交审核', obj: '青朴 · 9月主推脚本 v2', when: '34 分钟前' },
  { who: 'u3', what: 'AI 生成了 6 条', obj: '云杉防晒衣分镜', when: '1 小时前' },
  { who: 'u5', what: '更新了直播脚本', obj: '林野直播 5/12', when: '2 小时前' },
  { who: 'u6', what: '上传投流素材', obj: '云杉 · 防晒衣 6 条', when: '今早 09:12' },
  { who: 'u1', what: '新建项目', obj: '北麓 N1 耳机 5月排期', when: '昨天 18:24' },
];

// Account / live data ----
TL.accounts = [
  { id: 'a1', name: '青朴自然·官方旗舰', followers: 412800, growth7d: 0.063, gmv7d: 1284600, live7d: 8, video7d: 14, avgVV: 38200, ctr: 0.072, cvr: 0.041, brand: 'b1', color: 'c1' },
  { id: 'a2', name: '林野鲜食小铺', followers: 267400, growth7d: 0.041, gmv7d: 826400, live7d: 12, video7d: 21, avgVV: 24600, ctr: 0.061, cvr: 0.039, brand: 'b2', color: 'c2' },
  { id: 'a3', name: '小鹿家·甄选', followers: 189300, growth7d: -0.008, gmv7d: 412800, live7d: 5, video7d: 9, avgVV: 18900, ctr: 0.052, cvr: 0.028, brand: 'b3', color: 'c3' },
  { id: 'a4', name: '云杉运动 OUTDOOR', followers: 521600, growth7d: 0.124, gmv7d: 2087000, live7d: 10, video7d: 18, avgVV: 64300, ctr: 0.083, cvr: 0.047, brand: 'b4', color: 'c4' },
  { id: 'a5', name: '北麓数码评测室', followers: 96400, growth7d: 0.018, gmv7d: 184500, live7d: 3, video7d: 11, avgVV: 12400, ctr: 0.044, cvr: 0.021, brand: 'b5', color: 'c5' },
];

// GMV trend (last 14 days)
TL.gmvTrend = [128,142,118,156,184,168,192,210,178,224,256,238,272,298];
TL.followerTrend = [12,18,9,22,28,16,34,42,28,48,56,38,62,74];
TL.videoVV = [320,420,380,510,460,540,620,580,690,720,640,780,820,920];

// Lives
TL.lives = [
  { id: 'l1', acc: 'a4', title: '云杉夏日防晒衣场专场 5/10 晚', date: '今天 19:30 - 23:42', dur: '4h12min', gmv: 318400, viewers: 84200, peak: 4126, payRate: 0.038, atv: 198, returns: 0.046, status: 'ongoing' },
  { id: 'l2', acc: 'a1', title: '青朴 · 母亲节宠妈专场', date: '5/9 20:00 - 23:18', dur: '3h18min', gmv: 256800, viewers: 64100, peak: 3208, payRate: 0.044, atv: 168, returns: 0.038, status: 'done' },
  { id: 'l3', acc: 'a2', title: '林野 · 山货周末特卖', date: '5/8 19:30 - 22:48', dur: '3h18min', gmv: 142400, viewers: 38200, peak: 1820, payRate: 0.032, atv: 86, returns: 0.052, status: 'done' },
  { id: 'l4', acc: 'a3', title: '小鹿家·寝具暖夜场', date: '5/7 20:00 - 22:30', dur: '2h30min', gmv: 92600, viewers: 21400, peak: 968, payRate: 0.028, atv: 142, returns: 0.061, status: 'done' },
];

// Library
TL.library = [
  { id: 'li1', kind: 'script', title: '"成分党看完都买了" · 精华液种草脚本', cat: '美妆', tags: ['种草','成分','测评'], uses: 24, fav: true, updated: '5/8' },
  { id: 'li2', kind: 'topic', title: '5月母亲节·送妈妈实用礼物清单', cat: '通用', tags: ['节点','礼物','清单'], uses: 12, fav: true, updated: '5/9' },
  { id: 'li3', kind: 'hook', title: '前 3 秒钩子 · 反差冲突类 ×16', cat: '通用', tags: ['钩子','开头'], uses: 87, fav: false, updated: '5/6' },
  { id: 'li4', kind: 'image', title: '青朴山茶花精华 · 高清产品图 ×24', cat: '美妆', tags: ['产品图','静物'], uses: 9, fav: false, updated: '5/4' },
  { id: 'li5', kind: 'script', title: '"打工人的下午茶" · 食品场景脚本', cat: '食品', tags: ['场景','OL'], uses: 18, fav: false, updated: '5/3' },
  { id: 'li6', kind: 'image', title: '直播间贴片背景模板 ×8', cat: '通用', tags: ['直播','贴片'], uses: 41, fav: true, updated: '5/2' },
  { id: 'li7', kind: 'topic', title: '618 预热 · 品类选品角度 ×24', cat: '通用', tags: ['618','选品'], uses: 6, fav: false, updated: '5/1' },
  { id: 'li8', kind: 'hook', title: '直播间留人话术 · 节奏模板 ×12', cat: '直播', tags: ['留人','话术'], uses: 32, fav: false, updated: '4/28' },
];

// Schedule events
TL.schedule = [
  { day: 8, type: 'video', label: '青朴 · 母亲节短视频', acc: 'a1', time: '12:00' },
  { day: 8, type: 'livestream', label: '林野山货周末', acc: 'a2', time: '19:30' },
  { day: 9, type: 'image', label: '小鹿真丝枕套图文', acc: 'a3', time: '10:00' },
  { day: 9, type: 'livestream', label: '青朴母亲节专场', acc: 'a1', time: '20:00' },
  { day: 10, type: 'livestream', label: '云杉防晒衣大场', acc: 'a4', time: '19:30' },
  { day: 10, type: 'video', label: '林野直播预告', acc: 'a2', time: '11:00' },
  { day: 11, type: 'video', label: '青朴 · 9月主推 v2', acc: 'a1', time: '18:00' },
  { day: 12, type: 'livestream', label: '林野鲜食专场', acc: 'a2', time: '19:30' },
  { day: 12, type: 'video', label: '小鹿测评图文', acc: 'a3', time: '14:00' },
  { day: 13, type: 'video', label: '云杉投流素材 ×6', acc: 'a4', time: '08:00' },
  { day: 14, type: 'event', label: '团队周会复盘', acc: null, time: '10:00' },
  { day: 14, type: 'video', label: '小鹿真丝枕套图文', acc: 'a3', time: '15:00' },
  { day: 15, type: 'livestream', label: '云杉 · 户外日专场', acc: 'a4', time: '20:00' },
  { day: 15, type: 'video', label: '云杉防晒衣剧情', acc: 'a4', time: '12:00' },
  { day: 16, type: 'video', label: '北麓 N1 开箱测评', acc: 'a5', time: '18:30' },
  { day: 17, type: 'event', label: '618 预热启动', acc: null, time: '全天' },
  { day: 18, type: 'livestream', label: '青朴618预热场', acc: 'a1', time: '20:00' },
  { day: 20, type: 'livestream', label: '云杉户外周末场', acc: 'a4', time: '19:30' },
  { day: 22, type: 'video', label: '北麓N1 ASMR 拆机', acc: 'a5', time: '20:00' },
  { day: 24, type: 'livestream', label: '林野山货周末场', acc: 'a2', time: '19:30' },
];

// Monitor
TL.competitors = [
  { name: '澈光本草', cat: '美妆', followers: 612800, gmv30d: 8420000, hot: '"成分溯源"短剧系列', trend: 'up', delta: 0.18 },
  { name: '荟野食研所', cat: '食品', followers: 384600, gmv30d: 4280000, hot: '工厂直播 + 老板IP', trend: 'up', delta: 0.09 },
  { name: '木知家居', cat: '家居', followers: 286400, gmv30d: 2160000, hot: '床品质检对比图文', trend: 'flat', delta: 0.01 },
  { name: '骆驼山外', cat: '户外', followers: 728200, gmv30d: 12400000, hot: '徒步实测系列', trend: 'up', delta: 0.24 },
  { name: '声极派', cat: '3C', followers: 198400, gmv30d: 1240000, hot: '盲测对比', trend: 'down', delta: -0.04 },
];

TL.kols = [
  { name: '@小满日记', tag: '美妆种草', followers: 1240000, avgVV: 184000, cpe: 12.4, cat: '美妆', fit: 92, status: '已合作 3 次' },
  { name: '@阿野的厨房', tag: '生活美食', followers: 824000, avgVV: 96000, cpe: 8.6, cat: '食品', fit: 88, status: '待档期' },
  { name: '@山系阿K', tag: '户外露营', followers: 528000, avgVV: 142000, cpe: 14.2, cat: '户外', fit: 95, status: '已发邀约' },
  { name: '@家有阿木', tag: '家居好物', followers: 296000, avgVV: 38000, cpe: 5.8, cat: '家居', fit: 78, status: '未合作' },
  { name: '@极物Eva', tag: '数码评测', followers: 412000, avgVV: 62000, cpe: 9.4, cat: '3C', fit: 84, status: '已合作 1 次' },
];

// AI Video starter prompts
TL.aiSuggest = [
  '为青朴山茶花精华生成 1 条 30 秒种草视频，目标人群是 28-35 岁都市白领',
  '帮我把这个商品链接做成 6 条投流素材，每条强调一个卖点',
  '生成一条对比测评，对比我家小鹿真丝枕套和市面平价款',
  '为林野手剥松子做一条 ASMR 拆袋短视频',
];

TL.copyTemplates = [
  { id: 'c1', name: '标题 · 反差钩子', desc: '前 3 秒制造冲突，留人率 +28%', usage: 1284 },
  { id: 'c2', name: '标题 · 痛点共鸣', desc: '直击人群痛点，点赞率 +15%', usage: 892 },
  { id: 'c3', name: '直播 · 留人话术', desc: '黄金 1 分钟开场，停留 +42 秒', usage: 642 },
  { id: 'c4', name: '种草文案 · 成分党', desc: '理性派种草模板，适合美妆/保健', usage: 568 },
  { id: 'c5', name: '种草文案 · 场景化', desc: '生活场景植入，转化 +12%', usage: 421 },
  { id: 'c6', name: '抖店标题优化', desc: 'SEO 关键词组合，曝光 +35%', usage: 384 },
];

// Helpers
TL.fmtMoney = (n) => {
  if (n >= 10000) return (n/10000).toFixed(n>=1000000?0:1) + ' 万';
  return n.toLocaleString();
};
TL.fmtPct = (n, sign=true) => (sign && n>0 ? '+' : '') + (n*100).toFixed(1) + '%';
TL.fmtCount = (n) => {
  if (n >= 10000) return (n/10000).toFixed(1) + ' 万';
  return n.toLocaleString();
};

TL.brandById = (id) => TL.brands.find(b => b.id === id);
TL.userById  = (id) => TL.team.find(u => u.id === id);
TL.accountById = (id) => TL.accounts.find(a => a.id === id);

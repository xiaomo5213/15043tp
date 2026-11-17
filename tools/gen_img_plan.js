/*
 * 生成 img_plan.js —— 每个知识点的「配图需求单」
 * 用法：在项目根目录执行  node tools/gen_img_plan.js
 * 依赖：data.js、kp_seed.js、img_p1.js
 * 产物：img_plan.js（window.KP_IMG）
 *
 * 策略：
 *   · P1（103 条高频）用 img_p1.js 里逐条手写的内容，具体到「哪张照片/哪个物」
 *   · P2/P3 用规则派生（类型 + 标题专名 + 首选库），够用但不精
 *   · 抽象条目（意义/评价/性质类）标 noimg，劝你别硬配图
 *   · 图片统一命名 media/k{序号}.jpg，离线可用，不怕外链失效
 *
 * 原则：只给「找什么、去哪、搜什么、别用什么」，不给图片链接——
 *       图片链接必须人眼核过，AI 编不出来也验不了。
 */
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8').replace(/const /g, 'var ') +
  ';this.knowledge=knowledge;this.chapterMeta=chapterMeta;this.chapterOrder=chapterOrder;', ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'exam_data.js'), 'utf8'), ctx);
// 手写精编（P1）
vm.runInContext(fs.readFileSync(path.join(ROOT, 'img_p1.js'), 'utf8'), ctx);
const P1 = ctx.window.IMG_P1 || {};
const KP = ctx.knowledge;

const seedTxt = fs.readFileSync(path.join(ROOT, 'kp_seed.js'), 'utf8');
const SEED = JSON.parse(seedTxt.slice(seedTxt.indexOf('['), seedTxt.lastIndexOf(']') + 1));

/* ---------------- 图库：用 site: 站内检索，链接格式不会失效 ---------------- */
const LIB = {
  ac:    ['抗战文献平台', 'modernhistory.org.cn'],
  museum:['国博藏品',     'chnmuseum.cn'],
  party: ['人民网党史',   'dangshi.people.com.cn'],
  wiki:  ['Wikimedia',    'commons.wikimedia.org'],
  nlc:   ['国家图书馆',   'nlc.cn'],
  gov:   ['中国政府网',   'gov.cn'],
  xinh:  ['新华社',       'xinhuanet.com'],
  mil:   ['军事博物馆',   'jb.mil.cn']
};
function libURL(domain, kw) {
  return 'https://www.bing.com/search?q=' + encodeURIComponent('site:' + domain + ' ' + kw);
}
function libList(keys, kw) {
  return String(keys).split('+').filter(function(k){ return LIB[k]; }).map(function(k){
    return { n: LIB[k][0], u: libURL(LIB[k][1], kw) };
  });
}

/* ---------------- 规则派生（P2/P3） ---------------- */
function pickType(t) {
  if (/(界定|含义|概念|特征|规律|必然|区别|联系|条件|前提|标准|原则|实质|本质|地位|意义|经验|教训|启示|性质|特点|评价|作用|影响|贡献|优越性)/.test(t)
      && !/(会议|条约|起义|战争|战役|事变)/.test(t)) return 'abstract';
  if (/条约|协定|章程|约法|宪法|纲领|宣言|布告|训令|法令|条例|大纲|决议案|文件|著作|文集|选集|文选|讲演|讲话|电报|书信|诗词|手稿/.test(t)) return 'doc';
  if (/会议|大会|全会|代表大会|政治局|座谈会|谈判|会谈|签约|签字/.test(t)) return 'meet';
  if (/战役|战斗|战争|起义|暴动|事变|围剿|长征|进军|渡江|抗日|根据地|游击|出兵|远征|轰炸|惨案|屠杀|血案|罢工|罢课|游行|示威|风潮/.test(t)) return 'war';
  if (/外交|关系|访问|建交|复交|交涉|联合声明|公报|国际|对外/.test(t)) return 'dip';
  if (/经济|工业|农业|商业|金融|货币|银行|铁路|交通|水利|钢铁|油田|建设|生产|合作社|企业|市场|特区|开放|开发|计划|承包|税|土地/.test(t)) return 'econ';
  if (/报|刊|杂志|文学|艺术|戏剧|电影|学校|大学|学堂|出版|翻译|新文化|教育/.test(t)) return 'cult';
  if (/制度|政策|方针|路线|战略|思想|理论|体制|改革|改造|整风|科技|卫生|民族|宗教|法律|法制|民主|党建|组织|纪律|作风|整党/.test(t)) return 'inst';
  return 'doc';
}

const SPEC = {
  doc:      { it:'文献影印', ask:'找这份文件的原件扫描页，优先带印章、签字或出版信息的首页。',
              no:'不要用后人重排的白话文本截图，也不要用影视剧里的道具文件。',
              alt:'找不到原件，用当时报纸的报道版面替代。', suf:'影印' },
  meet:     { it:'会场·文件', ask:'找会场旧址、代表合影，或会议通过文件的影印。',
              no:'不要用《建国大业》《觉醒年代》这类影视剧的会场剧照。',
              alt:'没有会场照片，用会议文件首页或纪念邮票。', suf:'旧址' },
  war:      { it:'现场·地图', ask:'找当时的现场照片、作战地图，或纪念馆藏实物（武器、旗帜、布告）。',
              no:'不要用影视剧照、游戏截图、AI 上色修复图——近代史里最容易认错的就是这类。',
              alt:'没有照片就用当时的报刊版面 + 作战地图。', suf:'老照片' },
  dip:      { it:'签字·公报', ask:'找签字仪式照片，或公报、声明、照会的影响件。',
              no:'不要用近年重演、纪念活动的照片冒充当年的。',
              alt:'找不到就用当时报纸头版。', suf:'签字' },
  econ:     { it:'建设老照片', ask:'找当时的生产、建设现场老照片，或当年的宣传画、邮票、票证。',
              no:'不要用现在的同址新照片，也不要用 AI 生成的示意图。',
              alt:'找不到就用当年的报纸版面或原版统计图表。', suf:'老照片' },
  inst:     { it:'报刊·宣传画', ask:'找当时的报纸版面、文件影印或宣传画，用来证明「当时是这么说的」。',
              no:'不要用现代做的图解、思维导图、PPT 截图。',
              alt:'实在没有，就用该文献的封面书影。', suf:'报纸' },
  cult:     { it:'书影·封面', ask:'找书刊封面、创刊号、手稿，或当年书店、校舍的照片。',
              no:'不要用二手书店的现代翻拍（有水印、有价签）。',
              alt:'找不到就用目录页或发刊词影印。', suf:'封面' },
  abstract: { it:'建议不配图', ask:'这条是抽象结论（含义/意义/评价类），没有对应的历史照片。要配就配能证明它的原始材料，否则宁可不配。',
              no:'不要为了配图去找人物合影或风景照，图文对不上反而扣分。',
              alt:'优先选一条能支撑该结论的原始材料（报纸、文件、数据表）。', suf:'' }
};

const HIST = /^c[1-7]$/;
function libsFor(type, ch) {
  const h = HIST.test(ch);
  const M = {
    doc:  h?['ac','museum','nlc']:['gov','nlc','wiki'],
    meet: h?['party','museum','ac']:['gov','xinh','party'],
    war:  h?['ac','mil','museum']:['mil','xinh','gov'],
    dip:  h?['ac','party','wiki']:['gov','xinh','wiki'],
    econ: h?['ac','museum','nlc']:['xinh','gov','wiki'],
    inst: h?['ac','party','museum']:['gov','party','xinh'],
    cult: h?['ac','nlc','wiki']:['nlc','gov','wiki'],
    abstract: h?['ac','museum','party']:['gov','xinh','wiki']
  };
  return (M[type] || M.doc).join('+');
}

/* 检索词：只用标题里的专名（种子里的 k），再加一个类型限定词 */
function buildKw(s, type) {
  const out = [];
  const push = function(x){ x = String(x || '').trim(); if (x && out.indexOf(x) < 0) out.push(x); };
  (s.k || [s.t]).forEach(push);
  const suf = SPEC[type].suf;
  const head = (s.k && s.k[0]) || s.t;
  if (suf && head.indexOf(suf) < 0) push(head + ' ' + suf);
  return out.slice(0, 3);
}

/* ---------------- 生成 ---------------- */
const out = SEED.map(function(s){
  const kp = KP[s.i] || {};
  const fn = 'media/k' + String(s.i + 1).padStart(3, '0') + '.jpg';
  const hand = P1[String(s.i)];

  if (hand) {
    // 手写精编：i:[类型, 找什么, 检索词, 库, 禁忌]
    const kws = String(hand[2] || '').split('|').map(function(x){ return x.trim(); }).filter(Boolean);
    return {
      i: s.i, t: s.t, ch: s.ch, p: s.p, h: s.h || 0,
      it: hand[0],
      ask: hand[1],
      ik: kws,
      src: libList(hand[3], kws[0] || s.t),
      no: hand[4] || '',
      alt: '',
      fn: fn,
      noimg: /不配图/.test(hand[0]),
      hand: true
    };
  }

  const type = pickType(s.t);
  const sp = SPEC[type];
  const kw = buildKw(s, type);
  return {
    i: s.i, t: s.t, ch: s.ch, p: s.p, h: s.h || 0,
    it: sp.it,
    ask: sp.ask,
    ik: kw,
    src: libList(libsFor(type, s.ch), kw[0] || s.t),
    no: sp.no,
    alt: sp.alt,
    fn: fn,
    noimg: type === 'abstract',
    hand: false
  };
});

fs.writeFileSync(path.join(ROOT, 'img_plan.js'),
  '/* 配图需求单：P1 手写精编 + 其余规则派生。由 tools/gen_img_plan.js 生成，可重跑。 */\n' +
  'window.KP_IMG=' + JSON.stringify(out) + ';\n');

/* ---------------- 自检 ---------------- */
const dist = {};
out.forEach(function(o){ dist[o.it] = (dist[o.it] || 0) + 1; });
console.log('总条数', out.length, '| 手写', out.filter(function(o){return o.hand;}).length,
            '| 规则', out.filter(function(o){return !o.hand;}).length);
console.log('类型分布', JSON.stringify(dist));
console.log('建议不配图', out.filter(function(o){return o.noimg;}).length,
            '其中 P1', out.filter(function(o){return o.noimg && o.p === 'P1';}).length);
console.log('文件大小', fs.statSync(path.join(ROOT, 'img_plan.js')).size);
[15, 24, 106, 188, 307, 404, 40, 130].forEach(function(i){
  const o = out[i];
  console.log('\nK' + (i + 1), '[' + o.p + (o.hand ? '·手写' : '') + ']', o.it, '|', o.t);
  console.log('  找：' + o.ask);
  console.log('  搜：' + o.ik.join(' / '));
  console.log('  去：' + o.src.map(function(x){return x.n;}).join(' / '));
  console.log('  禁：' + o.no);
});

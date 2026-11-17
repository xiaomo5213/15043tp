/*
 * 重新生成 kp_seed.js（知识点采集台的种子数据）
 * 用法：在项目根目录执行  node tools/gen_kp_seed.js
 * 依赖：data.js（知识点）、exam_data.js（真题，用于算命中数）
 * 产物：kp_seed.js（含说明、检索词、建议形态、优先级）
 */
const path=require('path'),fs=require('fs'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
const ctx={window:{},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'data.js'),'utf8').replace(/const /g,'var ')+'\n;this.knowledge=knowledge;this.chapterMeta=chapterMeta;this.chapterOrder=chapterOrder;',ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'exam_data.js'),'utf8'),ctx);
const KP=ctx.knowledge, CH=ctx.chapterMeta;

/* ---------- 用与页面同一套二元组+IDF 算法，算每个知识点的真题命中数 ---------- */
function _normZ(s){return String(s==null?'':s).replace(/[，。、；：？！“”‘’（）《》〈〉…—\s·,.;:?!"'()\[\]{}<>\/\\|~`@#$%^&*+=_\-]/g,'');}
function _bgrams(s){s=_normZ(s);const out=[],seen={};for(let i=0;i<s.length-1;i++){const g=s.slice(i,i+2);if(!seen[g]){seen[g]=1;out.push(g);}}return out;}
const ITEMS=(ctx.window.EXAM_DATA||{}).items||[];
const HITS=(function(){
  const N=KP.length,TF=[],df={};
  KP.forEach(kp=>{const c={};_bgrams(kp.title).forEach(x=>c[x]=(c[x]||0)+3);
    _bgrams(kp.speak).forEach(x=>c[x]=(c[x]||0)+1);
    if(kp.quiz&&kp.quiz.q)_bgrams(kp.quiz.q).forEach(x=>c[x]=(c[x]||0)+1.5);
    TF.push(c);for(const g in c)df[g]=(df[g]||0)+1;});
  const W={};for(const g in df)W[g]=Math.log(1+N/df[g]);
  const post={};TF.forEach((c,i)=>{for(const g in c){(post[g]=post[g]||[]).push(i,c[g]);}});
  const titles=[];KP.forEach((kp,i)=>{const t=_normZ(kp.title);if(t.length>=4)titles.push([t,i]);});
  const out={};
  ITEMS.forEach(it=>{
    const txt=it.q+' '+(it.t==='c'?(it.o[it.a]||''):(it.a||''))+' '+(it.e||'');
    const sc=new Float64Array(N);
    _bgrams(txt).forEach(g=>{const p=post[g];if(!p)return;const w=W[g];for(let j=0;j<p.length;j+=2)sc[p[j]]+=TF[p[j]][g]*w;});
    const nt=_normZ(txt);
    titles.forEach(t=>{if(nt.indexOf(t[0])>=0)sc[t[1]]+=4;});
    let best=-1,bs=8;
    for(let i=0;i<N;i++)if(sc[i]>bs){bs=sc[i];best=i;}
    if(best>=0)out[best]=(out[best]||0)+1;
  });
  return out;
})();


function sumOf(s){
  s=String(s).replace(/\s+/g,'');
  const first=s.split('。')[0];
  if(first.length<=58) return first;
  const cls=first.split(/[，；：]/); let acc='';
  for(const c of cls){ if((acc?acc+'，'+c:c).length>56) break; acc=acc?acc+'，'+c:c; }
  if(acc.length<14) acc=first.slice(0,54);
  return acc.replace(/[，；：]$/,'')+'…';
}
const STOP=/^(其|这|那|由此|因此|同时|此外|一方面|另一方面|总之|所谓)/;
function kwOf(title,speak){
  let base=title.replace(/[（(][^)）]{0,24}[)）]/g,'').replace(/[“”"]/g,'').trim();
  base=base.replace(/(及)?其?(原因|意义|内容|特点|性质|影响|过程|经过|评价|经验|教训|启示|作用|表现)$/,'').trim();
  const parts=base.split(/[:：]/).map(s=>s.trim()).filter(Boolean);
  let core=parts[0].replace(/的(爆发|制定|实施|兴起|提出|形成|建立|召开|签订|发表|确立|完成|失败|胜利|发展|经过|内容|意义|性质|特点|作用|影响)$/,'');
  if(core.length>13&&core.indexOf('与')>2) core=core.split('与')[0];
  let subs=[];
  parts.slice(1).forEach(p=>p.split(/与|、|，|,/).forEach(s=>{s=s.trim();if(s.length>=2&&subs.indexOf(s)<0)subs.push(s);}));
  let terms=[];
  const push=t=>{t=(t||'').replace(/[，。、；：！？]/g,'').trim();if(t.length>=2&&t.length<=14&&terms.indexOf(t)<0)terms.push(t);};
  push(core); subs.slice(0,2).forEach(push);
  if(terms.length<2){
    const y=(String(speak).match(/(1[6-9]\d{2}|20[0-2]\d)\s*年/)||[])[0];
    if(y && !/\d{4}\s*年/.test(base)) push(y.replace(/\s*年/,'年')+' '+core);
  }
  if(terms.length<1) push(base.slice(0,12));
  if(terms.length<1) push(base.slice(0,6));
  return terms.slice(0,3);
}
function formOf(title,speak){
  const t=title;
  if(/会议|大会|全会|代表会议|政治局|瓦窑堡|洛川|七大|八大|十二大|十三大|十四大|十五大|十六大|十七大|十八大|十九大|二十大/.test(t)) return '会议影像/党史纪录片';
  if(/条约|协定|章程|纲领|宣言|约法|宪法|文件|著作|文章|讲话/.test(t)) return '档案影印/原文图片';
  if(/战役|战争|起义|战斗|事变|战斗|围剿|长征|进军|渡江|抗美援朝/.test(t)) return '纪录片片段/历史地图/影视片段';
  if(/运动|罢工|游行|示威|风潮|革命/.test(t)) return '纪录片/影视片段/老照片';
  if(/制度|政策|方针|路线|战略|思想|理论|体制|改革|开放|计划|改造|合作|外交|关系/.test(t)) return '专家讲解/图解/纪录片';
  if(/人物|思想|评价|意义|经验|教训|启示|特点|性质/.test(t)) return '专家讲解/纪录片';
  return '纪录片/专题短视频';
}
const out=KP.map((kp,i)=>{
  const h=HITS[i]||0;
  return {i,ch:kp.ch,t:kp.title,s:sumOf(kp.speak),h,p:h>=3?'P1':(h>=2?'P2':'P3'),k:kwOf(kp.title,kp.speak),f:formOf(kp.title,kp.speak)};
});
const dist={};out.forEach(o=>dist[o.p]=(dist[o.p]||0)+1);console.log('优先级',JSON.stringify(dist));
[0,1,5,20,40,60,90,120,160,200,240,300,340,380,420,460].forEach(i=>console.log(out[i].p,out[i].h,'|',out[i].t,'|',out[i].s,'|',out[i].k.join(' / '),'|',out[i].f));
fs.writeFileSync(path.join(ROOT,'kp_seed.js'),'/* 知识点采集种子：由 data.js 自动派生（说明取讲解首句，检索词取标题/引号专名）。可重新生成。 */\nwindow.KP_SEED='+JSON.stringify(out)+';\n');
console.log('written',fs.statSync('kp_seed.js').size);

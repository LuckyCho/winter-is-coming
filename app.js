'use strict';
const DATA_PATH='./data/indicators.json';
const FALLBACK_CONFIG=[{"id":"us_curve","title":"미국 장단기 금리차 (10년-3개월)","section":"US TREASURY","unit":"%p","kind":"series","source":"https://home.treasury.gov/resource-center/data-chart-center/interest-rates","description":"미국 국채 10년물 금리에서 3개월물 금리를 뺀 값. 역전과 역전 해소 과정 모두 함께 관찰합니다."},{"id":"us_cli","title":"미국 경기선행지수 (OECD CLI)","section":"US LEADING","unit":"","kind":"series","source":"https://data-explorer.oecd.org/","description":"경기 전환의 방향을 보여주는 OECD 지표. 절대값보다 상승·하락 추세가 중요합니다."},{"id":"kr_cli","title":"한국 경기선행지수 (OECD CLI)","section":"KR LEADING","unit":"","kind":"series","source":"https://data-explorer.oecd.org/","description":"한국의 경기 전환 가능성을 보여주는 OECD 지표. 미국 지표와 함께 방향을 비교합니다."},{"id":"us_gz","title":"미국 회사채 신용스프레드 (GZ)","section":"US CREDIT","unit":"%p","kind":"series","source":"https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv","description":"미국 비금융기업 회사채의 전반적인 신용위험. 상승은 자금조달 부담 확대 신호일 수 있습니다."},{"id":"us_ebp","title":"초과채권프리미엄 (EBP)","section":"US CREDIT","unit":"%p","kind":"series","source":"https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv","description":"부도위험만으로 설명되지 않는 추가 채권 프리미엄. 상승하면 투자자의 신용위험 회피가 커질 수 있습니다."},{"id":"us_recession_prob","title":"향후 12개월 경기침체 모형 확률","section":"US RECESSION","unit":"%","kind":"series","source":"https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv","description":"연준 연구모형의 추정 확률이며 연준의 공식 전망이나 확정적 경기침체 예측은 아닙니다."}];
let state={years:3,entries:[],updated:null,ai:null};
const el=id=>document.getElementById(id);
const fixed=(v,n=2)=>Number.isFinite(v)?Number(v).toFixed(n):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function range(points,years){
 if(!points.length)return [];
 const end=new Date(points.at(-1).date+'T00:00:00Z');const start=new Date(end);
 start.setUTCFullYear(start.getUTCFullYear()-years);
 return points.filter(p=>new Date(p.date+'T00:00:00Z')>=start);
}
function chart(points,unit){
 if(points.length<2)return '<div class="chart-empty">관측치가 2개 이상 쌓이면 추이 차트를 표시합니다.</div>';
 const w=590,h=190,L=49,R=16,T=17,B=28,vs=points.map(p=>p.value);
 let lo=Math.min(...vs),hi=Math.max(...vs);
 if(lo===hi){lo-=1;hi+=1}else{const d=(hi-lo)*.12;lo-=d;hi+=d}
 const t0=Date.parse(points[0].date+'T00:00:00Z'),t1=Date.parse(points.at(-1).date+'T00:00:00Z');
 const px=p=>L+(Date.parse(p.date+'T00:00:00Z')-t0)/(t1-t0||1)*(w-L-R);
 const py=p=>T+(hi-p.value)/(hi-lo)*(h-T-B);
 const path=points.map((p,i)=>`${i?'L':'M'}${px(p).toFixed(2)},${py(p).toFixed(2)}`).join(' ');
 const grid=[0,1,2,3].map(i=>{const y=T+i*(h-T-B)/3;return `<line class="svg-grid" x1="${L}" y1="${y}" x2="${w-R}" y2="${y}"/><text class="svg-label" x="${L-7}" y="${y+3}" text-anchor="end">${fixed(hi-i*(hi-lo)/3,1)}</text>`}).join('');
 const labels=[0,.5,1].map(r=>{const d=new Date(t0+(t1-t0)*r);return `<text class="svg-label" x="${L+r*(w-L-R)}" y="${h-5}" text-anchor="middle">${d.getUTCFullYear()}.${String(d.getUTCMonth()+1).padStart(2,'0')}</text>`}).join('');
 const last=points.at(-1);
 return `<svg class="svg-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="기간별 추이, 최근값 ${fixed(last.value)} ${esc(unit)}"><title>시계열 추이</title>${grid}${labels}<path class="svg-line" d="${path}"/><circle cx="${px(last)}" cy="${py(last)}" r="4" fill="#c9efd9"/></svg>`;
}
function badge(e){
 if(!e.series?.length)return ['갱신 대기',''];
 const v=e.series.at(-1).value;
 if(e.id==='us_curve' && v<0)return ['금리 역전','risk'];
 if(e.id==='us_curve')return ['금리차 양수','info'];
 if(e.series.length<4)return ['관측 중',''];
 const n=e.id==='us_gz'||e.id==='us_ebp'||e.id==='us_recession_prob'||e.id.endsWith('_cli')?3:63;
 const previous=e.series[Math.max(0,e.series.length-1-n)].value;
 return v>previous?['최근 상승','info']:v<previous?['최근 하락','warn']:['최근 보합',''];
}
function card(e){
 const pts=range(e.series||[],state.years),last=e.series?.at(-1),first=pts[0];
 const diff=last&&first?last.value-first.value:null,[label,status]=badge(e);
 const movement=diff===null?'':('선택 기간 변화 '+(diff>=0?'+':'')+fixed(diff)+' '+(e.unit||'pt'));
 const note=e.description||FALLBACK_CONFIG.find(x=>x.id===e.id)?.description||'시계열의 변화 방향을 확인하세요.';
 const number=last?fixed(last.value):'—';
 return '<article class="signal-card">'+
   '<div class="card-head"><div><div class="card-kicker">'+esc(e.section)+'</div><div class="card-title">'+esc(e.title)+'</div></div><span class="card-badge '+status+'">'+esc(label)+'</span></div>'+
   '<div class="card-value-row"><div class="card-value">'+number+'<span class="unit">'+(last?esc(e.unit||'지수'):'')+'</span></div><div class="card-change">'+esc(movement)+'</div></div>'+
   chart(pts,e.unit||'지수')+'<div class="card-note">'+esc(note)+'</div>'+
   '<div class="card-foot"><span class="card-date">'+(last?'실제 관측일 '+esc(last.date):'관측치 대기')+'</span><a class="source-link" href="'+esc(e.source)+'" target="_blank" rel="noopener noreferrer">원천 데이터 보기 ↗</a></div></article>';
}
function render(){
 el('cards').innerHTML=state.entries.map(card).join('');
 el('refreshText').textContent=state.updated?'데이터 갱신 '+state.updated.replace('T',' ').slice(0,16)+' UTC':'첫 수집 대기';
 const available=state.entries.filter(e=>e.series?.length);
 const ai=state.ai;
 if(ai && ai.summary && available.length===6){
   el('outlookTitle').textContent='AI 종합의견 · '+ai.generated_at.slice(0,10)+' 생성';
   const stale=ai.source_data_generated_at!==state.updated;
   el('outlookDetail').textContent=ai.summary+(stale?'\n\n※ 이 의견은 최초 생성 시점의 자료로 작성됐으며, 현재 수집된 최신 데이터는 반영되지 않았을 수 있습니다.':'');
 }else if(available.length===6){
   el('outlookTitle').textContent='6개 지표 수집 완료 · AI 분석 대기';
   el('outlookDetail').textContent='원천 데이터 6개가 준비됐습니다. 첫 AI 종합의견이 생성되면 이 영역에 표시됩니다.';
 }else{
   el('outlookTitle').textContent='수집 데이터 확인 중';
   el('outlookDetail').textContent='현재 '+available.length+'/6개 지표가 있습니다. 원천 데이터가 모두 확보되면 종합의견을 표시합니다.';
 }
 el('outlookIcon').textContent='◒';
 const notes=[];
 for(const e of state.entries){
   if(!e.series?.length){notes.push(e.title+': 데이터 수집 대기');continue;}
   const last=e.series.at(-1),period=e.id==='us_curve'?63:3;
   const prior=e.series[Math.max(0,e.series.length-1-period)];
   const delta=last.value-prior.value;
   notes.push(e.title+': '+fixed(last.value)+(e.unit||'')+' ('+last.date+'). 약 '+(period===63?'3개월':'3개월')+' 전 대비 '+(delta>=0?'+':'')+fixed(delta)+(e.unit||'pt')+'.');
 }
 el('analysisNotes').innerHTML=notes.map(n=>'<div class="analysis-point">'+esc(n)+'</div>').join('');
}
function initRange(){
 document.querySelectorAll('[data-years]').forEach(b=>b.addEventListener('click',()=>{
  state.years=Number(b.dataset.years);
  document.querySelectorAll('[data-years]').forEach(c=>{c.classList.toggle('active',b===c);c.setAttribute('aria-pressed',String(b===c))});
  render();
 }));
}
async function main(){
 initRange();
 try{
  const r=await fetch(DATA_PATH,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
  const data=await r.json();state.updated=data.generated_at||null;
  state.entries=(data.indicators||FALLBACK_CONFIG).map(e=>({...e,series:(e.series||[]).filter(p=>p.date&&Number.isFinite(p.value)).sort((a,b)=>a.date.localeCompare(b.date))}));
   try {
     const report=await fetch('./data/analysis.json',{cache:'no-store'});
     if(report.ok)state.ai=await report.json();
   }catch(err){console.warn('One-time AI review unavailable',err);}
 }catch(e){console.error('Data unavailable',e);state.entries=FALLBACK_CONFIG.map(e=>({...e,series:[]}));}
 render();
}
main();
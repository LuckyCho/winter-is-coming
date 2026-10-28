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
   '<div class="card-head"><div><div class="card-kicker">'+esc(e.section)+'</div><div class="card-title">'+helpTerm(e.title,e.id,'chart')+'</div></div><span class="card-badge '+status+'">'+esc(label)+'</span></div>'+
   '<div class="card-value-row"><div class="card-value">'+number+'<span class="unit">'+(last?esc(e.unit||'지수'):'')+'</span></div><div class="card-change">'+esc(movement)+'</div></div>'+
   chart(pts,e.unit||'지수')+'<div class="card-note">'+esc(note)+'</div>'+
   '<div class="card-foot"><span class="card-date">'+(last?'실제 관측일 '+esc(last.date):'관측치 대기')+'</span><a class="source-link" href="'+esc(e.source)+'" target="_blank" rel="noopener noreferrer">원천 데이터 보기 ↗</a></div></article>';
}
const INDICATOR_HELP={
  us_curve:{
    definition:'미국 국채 10년물 금리에서 3개월물 금리를 뺀 값입니다.',
    interpretation:'음수는 장단기 금리 역전, 양수는 정상 금리차입니다. 역전과 이후 정상화는 경기 위험을 살필 단서지만, 단독으로 침체를 확정하지 않습니다.'
  },
  us_cli:{
    definition:'OECD가 여러 경제 선행 신호를 합쳐 만든 미국 경기선행지수입니다.',
    interpretation:'절대 수준보다 몇 달간 올라가는지 내려가는지가 중요합니다. 상승은 경기 개선 가능성, 하락은 둔화 가능성을 시사합니다.'
  },
  kr_cli:{
    definition:'OECD가 여러 경제 선행 신호를 합쳐 만든 한국 경기선행지수입니다.',
    interpretation:'최근 3~6개월의 방향 전환이 중요합니다. 미국 지표와 함께 비교하면 경기 흐름 차이를 이해하기 좋습니다.'
  },
  us_gz:{
    definition:'미국 비금융기업 회사채의 수익률과 비슷한 국채 수익률 사이의 차이입니다.',
    interpretation:'상승하면 기업 신용위험 또는 자금조달 부담이 커질 수 있습니다. 하이일드·CCC 전용 스프레드는 아닙니다.'
  },
  us_ebp:{
    definition:'회사채의 예상 부도위험만으로 설명되지 않는 추가 위험 프리미엄입니다.',
    interpretation:'상승하면 투자자의 위험 회피가 강화될 수 있습니다. 음수 자체가 위험이 없음을 뜻하지는 않으며, 변화 방향도 함께 봅니다.'
  },
  us_recession_prob:{
    definition:'연준 연구모형이 추정한 향후 12개월 미국 경기침체 확률입니다.',
    interpretation:'값이 높아지면 모형상 침체 위험이 커진 것입니다. 연준의 공식 경기 전망이나 실제 침체 발생 확률에 대한 보장은 아닙니다.'
  }
};
function helpTerm(label,id,scope){
 const help=INDICATOR_HELP[id];
 if(!help)return esc(label);
 const tooltipId='help-'+scope+'-'+id;
 return '<span class="indicator-help">'+
   '<button type="button" class="indicator-name" aria-describedby="'+tooltipId+'" aria-label="'+esc(label)+' 설명 보기">'+esc(label)+'<span class="indicator-info" aria-hidden="true">ⓘ</span></button>'+
   '<span class="indicator-popover" id="'+tooltipId+'" role="tooltip">'+
   '<span class="tooltip-heading">무엇을 보나요?</span>'+esc(help.definition)+
   '<span class="tooltip-heading">어떻게 해석하나요?</span>'+esc(help.interpretation)+
   '</span></span>';
}
function reviewItems(entries,scope){
 if(!Array.isArray(entries))return '';
 return '<ul class="review-list">'+entries.map(e=>'<li><strong>'+helpTerm(e.label||'',e.id,scope)+'</strong> '+esc(e.detail||'')+'</li>').join('')+'</ul>';
}
function renderReview(review,stale){
 const positives=reviewItems(review.positives,'positive');
 const cautions=reviewItems(review.cautions,'caution');
 const watch=Array.isArray(review.watchpoints)?review.watchpoints.map(x=>'<li>'+esc(x)+'</li>').join(''):'';
 return '<div class="review-summary"><div class="review-section-label">현재 판단</div><p class="review-headline">'+esc(review.headline||'')+'</p></div>'+
 '<div class="review-grid">'+
 '<section class="review-group positive"><h3><span aria-hidden="true">●</span> 긍정 신호</h3>'+positives+'</section>'+
 '<section class="review-group caution"><h3><span aria-hidden="true">●</span> 주의 신호</h3>'+cautions+'</section>'+
 '</div>'+
 '<section class="review-watch"><h3>관찰 포인트</h3><ul>'+watch+'</ul></section>'+
 '<div class="review-caveat"><strong>유의사항</strong><p>'+esc(review.caveat||'')+'</p></div>'+
 (stale?'<p class="review-stale">※ 이 의견이 작성된 이후 일부 지표의 관측일이 달라졌습니다. 최신 차트를 따로 확인하세요.</p>':'');
}

function render(){
 el('cards').innerHTML=state.entries.map(card).join('');
 el('refreshText').textContent=state.updated?'데이터 갱신 '+state.updated.replace('T',' ').slice(0,16)+' UTC':'첫 수집 대기';
 const available=state.entries.filter(e=>e.series?.length);
 const ai=state.ai;
 if(ai && ai.summary && available.length===6){
   el('outlookTitle').textContent='AI 종합의견 · '+ai.generated_at.slice(0,10)+' 생성';
   const dates=new Map((ai.indicators||[]).map(x=>[x.id,x.latest_date]));
   const stale=state.entries.some(e=>e.series?.length && dates.get(e.id)!==e.series.at(-1).date);
   if(ai.review && ai.review.headline && Array.isArray(ai.review.positives) && Array.isArray(ai.review.cautions)){
     el('outlookDetail').innerHTML=renderReview(ai.review,stale);
   }else{
     el('outlookDetail').textContent=ai.summary+(stale?'\n\n※ 원래 분석 시점 이후 관측치가 갱신됐습니다.':'');
   }
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
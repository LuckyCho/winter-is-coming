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
// Coordinates are in a 500px SVG viewBox, so axis labels stay readable even in three-column cards.
const CHART_GEOMETRY={w:500,h:276,L:59,R:35,T:39,B:44};
function chartMetrics(points){
 const g=CHART_GEOMETRY;
 const values=points.map(p=>p.value);
 let lo=Math.min(...values), hi=Math.max(...values);
 if(lo===hi){lo-=1;hi+=1;}
 else{const pad=(hi-lo)*.13;lo-=pad;hi+=pad;}
 const t0=Date.parse(points[0].date+'T00:00:00Z');
 const t1=Date.parse(points.at(-1).date+'T00:00:00Z');
 const px=p=>g.L+(Date.parse(p.date+'T00:00:00Z')-t0)/(t1-t0||1)*(g.w-g.L-g.R);
 const py=p=>g.T+(hi-p.value)/(hi-lo)*(g.h-g.T-g.B);
 return {...g,lo,hi,t0,t1,px,py};
}
function chart(points,unit,id){
 if(points.length<2)return '<div class="chart-empty">관측치가 2개 이상 쌓이면 추이 차트를 표시합니다.</div>';
 const g=chartMetrics(points);
 const axisDigits=(g.hi-g.lo)<3?2:1;
 const xText=date=>date.slice(2,7).replace('-','.');
 const grid=Array.from({length:5},(_,i)=>{
   const y=g.T+i*(g.h-g.T-g.B)/4;
   const v=g.hi-i*(g.hi-g.lo)/4;
   return '<line class="svg-grid" x1="'+g.L+'" y1="'+y.toFixed(1)+'" x2="'+(g.w-g.R)+'" y2="'+y.toFixed(1)+'"/>'+
     '<text class="svg-axis-label" x="'+(g.L-11)+'" y="'+(y+5)+'" text-anchor="end">'+fixed(v,axisDigits)+'</text>';
 }).join('');
 const xLabels=[0,.5,1].map((r,i)=>{
   const d=new Date(g.t0+(g.t1-g.t0)*r).toISOString().slice(0,10);
   return '<text class="svg-axis-label" x="'+(g.L+r*(g.w-g.L-g.R)).toFixed(1)+'" y="'+(g.h-7)+
     '" text-anchor="'+(['start','middle','end'][i])+'">'+xText(d)+'</text>';
 }).join('');
 const line=points.map((p,i)=>(i?'L':'M')+g.px(p).toFixed(2)+','+g.py(p).toFixed(2)).join(' ');
 const stride=Math.max(1,Math.ceil((points.length-1)/20));
 const dots=[];
 for(let i=0;i<points.length;i+=stride)dots.push(i);
 if(dots.at(-1)!==points.length-1)dots.push(points.length-1);
 const markers=dots.map(i=>{
   const p=points[i],latest=i===points.length-1;
   return '<circle class="svg-observation'+(latest?' latest':'')+'" cx="'+g.px(p).toFixed(2)+
     '" cy="'+g.py(p).toFixed(2)+'" r="'+(latest?6:4.1)+'"/>';
 }).join('');
 // Label a small number of useful actual observations. Never crowd the line.
 let maxIdx=0,minIdx=0;
 for(let i=1;i<points.length;i++){
   if(points[i].value>points[maxIdx].value)maxIdx=i;
   if(points[i].value<points[minIdx].value)minIdx=i;
 }
 const indices=[0,points.length-1];
 for(const index of [maxIdx,minIdx]){
   if(!indices.includes(index)&&indices.every(k=>Math.abs(g.px(points[k])-g.px(points[index]))>92))indices.push(index);
 }
 const valueLabels=indices.map(index=>{
   const p=points[index],x=g.px(p),y=g.py(p),last=index===points.length-1;
   const yy=y<g.T+29?y+26:y-15;
   const anchor=index===0?'start':last?'end':'middle';
   const labelX=index===0?x+6:last?x-7:x;
   return '<text class="svg-value-label'+(last?' latest':'')+'" x="'+labelX.toFixed(1)+
     '" y="'+yy.toFixed(1)+'" text-anchor="'+anchor+'">'+fixed(p.value,2)+'</text>';
 }).join('');
 const latest=points.at(-1);
 return '<div class="chart-legend"><span class="chart-key" aria-hidden="true"></span>'+
   '실제 관측값 · 마우스를 올리면 상세 수치</div>'+
   '<div class="chart-plot" data-indicator="'+esc(id)+'" tabindex="0" '+
   'aria-label="'+esc(id)+' 추이 그래프. 마우스 또는 터치로 관측일과 값을 확인합니다. 키보드 방향키도 사용할 수 있습니다.">'+
   '<div class="chart-viewport"><svg class="svg-chart" viewBox="0 0 '+g.w+' '+g.h+
   '" role="img" aria-label="'+esc(points[0].date)+'부터 '+esc(latest.date)+'까지 관측값의 꺾은선 그래프">'+
   '<title>관측값을 연결한 꺾은선, 최근값 '+fixed(latest.value,2)+' '+esc(unit)+'</title>'+
   grid+xLabels+'<path class="svg-line" d="'+line+'"/>'+markers+valueLabels+
   '<line class="svg-tracker" x1="0" x2="0" y1="'+g.T+'" y2="'+(g.h-g.B)+'" visibility="hidden"/>'+
   '<circle class="svg-tracker-dot" cx="0" cy="0" r="7" visibility="hidden"/></svg></div>'+
   '<div class="chart-tooltip" role="tooltip" hidden><span class="chart-tooltip-date"></span>'+
   '<strong class="chart-tooltip-number"></strong><span class="chart-tooltip-source">실제 관측값</span></div></div>';
}
function wireChartInteractions(){
 document.querySelectorAll('.chart-plot[data-indicator]').forEach(plot=>{
   const source=state.entries.find(e=>e.id===plot.dataset.indicator);
   if(!source)return;
   const points=range(source.series||[],state.years);
   if(points.length<2)return;
   const g=chartMetrics(points);
   const timestamps=points.map(p=>Date.parse(p.date+'T00:00:00Z'));
   const svg=plot.querySelector('.svg-chart'),tip=plot.querySelector('.chart-tooltip');
   const viewport=plot.querySelector('.chart-viewport');
   const line=plot.querySelector('.svg-tracker'),dot=plot.querySelector('.svg-tracker-dot');
   let selected=points.length-1,pinned=false;
   function nearest(t){
     let lo=0,hi=timestamps.length-1;
     while(lo<hi){
       const mid=(lo+hi)>>1;
       if(timestamps[mid]<t)lo=mid+1;else hi=mid;
     }
     return lo>0&&Math.abs(t-timestamps[lo-1])<Math.abs(timestamps[lo]-t)?lo-1:lo;
   }
   function show(index){
     selected=Math.max(0,Math.min(points.length-1,index));
     const p=points[selected],x=g.px(p),y=g.py(p);
     line.setAttribute('x1',x);line.setAttribute('x2',x);line.setAttribute('visibility','visible');
     dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('visibility','visible');
     tip.querySelector('.chart-tooltip-date').textContent=p.date;
     tip.querySelector('.chart-tooltip-number').textContent=Number(p.value).toLocaleString('ko-KR',{maximumFractionDigits:5})+' '+(source.unit||'지수');
     tip.hidden=false;
     const svgRect=svg.getBoundingClientRect(),plotRect=plot.getBoundingClientRect();
     const screenX=svgRect.left-plotRect.left+x/svg.viewBox.baseVal.width*svgRect.width;
     const screenY=svgRect.top-plotRect.top+y/svg.viewBox.baseVal.height*svgRect.height;
     const tipWidth=tip.offsetWidth,tipHeight=tip.offsetHeight;
     const left=Math.max(3,Math.min(plot.clientWidth-tipWidth-3,screenX-tipWidth/2));
     const above=screenY-tipHeight-15;
     tip.style.left=left+'px';
     tip.style.top=(above>=2?above:screenY+15)+'px';
   }
   function hide(){
     if(pinned)return;
     tip.hidden=true;
     line.setAttribute('visibility','hidden');dot.setAttribute('visibility','hidden');
   }
   function eventIndex(event){
     const b=svg.getBoundingClientRect();
     const x=(event.clientX-b.left)/b.width*g.w;
     const date=g.t0+(Math.max(g.L,Math.min(g.w-g.R,x))-g.L)/(g.w-g.L-g.R)*(g.t1-g.t0);
     return nearest(date);
   }
   viewport.addEventListener('pointermove',event=>{
     if(event.pointerType==='touch'||pinned)return;
     show(eventIndex(event));
   });
   viewport.addEventListener('pointerleave',hide);
   viewport.addEventListener('click',event=>{
     const at=eventIndex(event);
     if(pinned&&selected===at){pinned=false;hide();return;}
     pinned=true;show(at);
   });
   plot.addEventListener('keydown',event=>{
     if(event.key==='Escape'){pinned=false;hide();return;}
     if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
       event.preventDefault();pinned=true;
       show(selected+(event.key==='ArrowLeft'?-1:1));
     }
   });
   plot.addEventListener('blur',()=>{
     pinned=false;hide();
   });
 });
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
   chart(pts,e.unit||'지수',e.id)+'<div class="card-note">'+esc(note)+'</div>'+
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

const NOTE_LABELS={
  us_curve:'미국 장단기 금리차',
  us_cli:'미국 경기선행지수',
  kr_cli:'한국 경기선행지수',
  us_gz:'미국 회사채 신용스프레드 (GZ)',
  us_ebp:'초과채권프리미엄 (EBP)',
  us_recession_prob:'12개월 경기침체 모형 확률'
};
function threeMonthReference(series){
 if(!series||series.length<2)return null;
 const latest=series.at(-1);
 const end=new Date(latest.date+'T00:00:00Z');
 if(!Number.isFinite(end.valueOf()))return null;
 const firstDay=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-3,1));
 const daysInMonth=new Date(Date.UTC(firstDay.getUTCFullYear(),firstDay.getUTCMonth()+1,0)).getUTCDate();
 const previousDay=new Date(Date.UTC(firstDay.getUTCFullYear(),firstDay.getUTCMonth(),Math.min(end.getUTCDate(),daysInMonth))).toISOString().slice(0,10);
 for(let i=series.length-1;i>=0;i--){
   if(series[i].date<=previousDay)return series[i];
 }
 return null;
}
function signalTone(id,latest,delta){
 if(!Number.isFinite(delta)||Math.abs(delta)<0.000001)return 'neutral';
 if(id==='us_curve')return latest<0?'caution':'neutral';
 if(id==='us_gz'||id==='us_ebp'||id==='us_recession_prob')return delta<0?'positive':'caution';
 if(id==='us_cli'||id==='kr_cli')return delta>0?'positive':'caution';
 return 'neutral';
}
function noteRow(e){
 const latest=e.series?.at(-1);
 const previous=threeMonthReference(e.series);
 const delta=latest&&previous?latest.value-previous.value:null;
 const deltaUnit=e.unit==='%'?'%p':e.unit==='%p'?'%p':'pt';
 const currentUnit=e.unit||'지수';
 const unit=deltaUnit==='pt'?'pt':'%p';
 const sign=delta===null?'':delta>0?'+':delta<0?'−':'';
 const arrow=delta===null?'—':delta>0?'↑':delta<0?'↓':'→';
 const valueText=latest?fixed(latest.value)+(latest.value<0?'':'')+(e.unit==='%'?'%':e.unit==='%p'?'%p':''):'—';
 const deltaText=delta===null?'자료 부족':sign+fixed(Math.abs(delta))+' '+unit;
 const tone=latest&&delta!==null?signalTone(e.id,latest.value,delta):'neutral';
 const name=NOTE_LABELS[e.id]||e.title;
 return '<tr class="metric-row">'+
   '<td class="metric-name-col"><div class="metric-name">'+helpTerm(name,e.id,'note')+'</div>'+
   '<div class="metric-date">'+(latest?esc(latest.date.replaceAll('-','.')):'관측치 대기')+'</div></td>'+
   '<td class="metric-value" data-label="최신값"><strong>'+esc(valueText)+'</strong>'+
   (e.unit===''&&latest?'<span class="metric-unit"> 지수</span>':'')+'</td>'+
   '<td class="metric-change" data-label="3개월 변화"><span class="metric-change-value '+tone+'">'+
   '<span class="metric-arrow" aria-hidden="true">'+arrow+'</span> '+esc(deltaText)+'</span></td></tr>';
}
function renderIndicatorNotes(entries){
 const rows=entries.map(noteRow).join('');
 return '<div class="metrics-heading"><div><h3>지표별 관찰 노트</h3>'+
   '<p>최신 관측값과 최근 3개월 변화</p></div><span class="metrics-count">'+entries.length+'개 지표</span></div>'+
   '<table class="metrics-table"><thead><tr><th scope="col">지표</th>'+
   '<th scope="col">최신값</th><th scope="col">3개월 변화</th></tr></thead><tbody>'+rows+'</tbody></table>'+
   '<p class="metrics-explain">* 색상은 상승·하락 자체가 아니라 <strong>경기위험 관점의 해석</strong>입니다. '+
   '금리차 변화는 단독으로 판단하지 않아 중립색으로 표시합니다. 각 지표의 발표 주기와 관측일은 다릅니다.</p>';
}

function render(){
 el('cards').innerHTML=state.entries.map(card).join('');
 wireChartInteractions();
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
 el('analysisNotes').innerHTML=renderIndicatorNotes(state.entries);
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
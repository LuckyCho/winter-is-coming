'use strict';
const DATA_PATH='./data/indicators.json';
const FALLBACK_CONFIG=[
{id:'us_curve',title:'미국 장단기 금리차',section:'US TREASURY',unit:'%p',kind:'series',source:'https://fred.stlouisfed.org/series/T10Y3M'},
{id:'us_hy',title:'하이일드 신용스프레드',section:'US CREDIT',unit:'%p',kind:'external',source:'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',embed:'https://fred.stlouisfed.org/graph/graph-landing.php?g=qZI0&width=670&height=330',attribution:'ICE Data Indices, LLC · BAMLH0A0HYM2 · via FRED'},
{id:'us_ccc',title:'CCC 이하 신용스프레드',section:'US CREDIT',unit:'%p',kind:'external',source:'https://fred.stlouisfed.org/series/BAMLH0A3HYC',embed:'https://fred.stlouisfed.org/graph/graph-landing.php?g=pEuZ&width=670&height=330',attribution:'ICE Data Indices, LLC · BAMLH0A3HYC · via FRED'},
{id:'us_cli',title:'미국 경기선행지수 (OECD CLI)',section:'US LEADING',unit:'',kind:'series',source:'https://data-explorer.oecd.org/'},
{id:'kr_cli',title:'한국 경기선행지수 (OECD CLI)',section:'KR LEADING',unit:'',kind:'series',source:'https://data-explorer.oecd.org/'}];
let state={years:3,entries:[],updated:null};
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
 if(e.kind==='external')return ['FRED 공식 그래프','info'];
 if(!e.series?.length)return ['갱신 대기',''];
 if(e.id==='us_curve')return e.series.at(-1).value<0?['금리 역전','risk']:['정상 금리차','info'];
 if(e.series.length<4)return ['관측 중',''];
 return e.series.at(-1).value<e.series.at(-4).value?['3개월 하락','warn']:['3개월 상승·보합','info'];
}
function fredPlot(e){
 const url=e.embed||'';
 if(!url.startsWith('https://fred.stlouisfed.org/graph/graph-landing.php?g=')){
   return '<div class="chart-empty">공식 FRED 그래프 설정을 확인하세요.</div>';
 }
 const attrib=e.attribution||'ICE Data Indices, LLC · via FRED';
 return `<div class="fred-embed-container">
 <iframe src="${esc(url)}" title="${esc(e.title)} — FRED 공식 차트" class="fred-iframe" width="670" height="330" loading="lazy" scrolling="no" referrerpolicy="strict-origin-when-cross-origin"></iframe>
 </div><p class="fred-credit">자료 원천: ${esc(attrib)}.</p>
 <p class="fred-legal">FRED® Graphs ©Federal Reserve Bank of St. Louis. All rights reserved. All FRED® Graphs appear courtesy of Federal Reserve Bank of St. Louis. <a href="https://fred.stlouisfed.org/" target="_blank" rel="noopener noreferrer">fred.stlouisfed.org</a></p>`;
}
function card(e){
 const external=e.kind==='external';
 const pts=range(e.series||[],state.years),last=e.series?.at(-1),first=pts[0];
 const diff=last&&first?last.value-first.value:null, [label,status]=badge(e);
 const plot=external?fredPlot(e):chart(pts,e.unit||'지수');
 const note=external?'FRED 원본 차트가 별도로 갱신됩니다. ICE 저작권 자료는 우리 서버에 저장하지 않습니다. FRED 제공 범위는 최근 3년입니다.':e.id==='us_curve'?'금리 역전과 역전 해소 과정 모두 확인합니다.':'OECD 선행지수는 값보다 추세 변화가 중요합니다.';
 const movement=diff===null?'':`선택 기간 변화 ${diff>=0?'+':''}${fixed(diff)} ${e.unit||'pt'}`;
 const date=last?`실제 관측일 ${esc(last.date)}`:external?'최신 관측일은 FRED 그래프에 표시':'첫 자동 수집 후 표시';
 const numberMarkup=external?'<span class="external-value">FRED 제공 차트</span>':`${last?fixed(last.value):'—'}<span class="unit">${last?esc(e.unit||'지수'):''}</span>`;
 return `<article class="signal-card"><div class="card-head"><div><div class="card-kicker">${esc(e.section)}</div><div class="card-title">${esc(e.title)}</div></div><span class="card-badge ${status}">${label}</span></div>
 <div class="card-value-row"><div class="card-value">${numberMarkup}</div><div class="card-change">${esc(movement)}</div></div>
 ${plot}<div class="card-note">${esc(note)}</div><div class="card-foot"><span class="card-date">${date}</span><a class="source-link" href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">FRED 원본 보기 ↗</a></div></article>`;
}
function render(){
 el('cards').innerHTML=state.entries.map(card).join('');
 el('refreshText').textContent=state.updated?`데이터 생성 ${state.updated.replace('T',' ').slice(0,16)} UTC`:'첫 수집 대기';
 const populated=state.entries.filter(e=>e.kind==='series'&&e.series?.length);
 const curve=state.entries.find(e=>e.id==='us_curve'),clis=state.entries.filter(e=>e.id.endsWith('_cli')&&e.series?.length>=4);
 if(!populated.length){
  el('outlookTitle').textContent='첫 갱신을 기다립니다';
  el('outlookDetail').textContent='GitHub Actions가 데이터를 수집하면 화면이 채워집니다.';
  el('outlookIcon').textContent='◌';
 }else{
  const inverted=curve?.series?.length&&curve.series.at(-1).value<0;
  const falling=clis.filter(c=>c.series.at(-1).value<c.series.at(-4).value).length;
  el('outlookTitle').textContent=inverted||falling>=2?'경계 신호 관찰':'경기 흐름 관찰 중';
  el('outlookDetail').textContent='공개 수집 가능한 지표 중심의 부분 분석입니다. 신용시장 위험은 공식 자료에서 별도로 확인하세요.';
  el('outlookIcon').textContent=inverted||falling>=2?'☁':'◒';
 }
 const notes=[];
 if(curve?.series?.length){
  const v=curve.series.at(-1),old=curve.series[Math.max(0,curve.series.length-64)];
  notes.push(`미국 장단기 금리차: ${fixed(v.value)}%p (${v.date}). 약 3개월 전 대비 ${v.value>=old.value?'+':''}${fixed(v.value-old.value)}%p.`);
 }
 for(const c of clis){
  const v=c.series.at(-1),old=c.series.at(-4);
  notes.push(`${c.title}: ${fixed(v.value)} (${v.date}). 최근 3개월 ${v.value<old.value?'하락':'상승 또는 보합'}.`);
 }
 notes.push('하이일드·CCC 스프레드는 ICE Data Indices, LLC 원천자료를 FRED 공식 그래프로 직접 표시합니다. 별도 수집·재배포하지 않으며, 자동 종합판단에는 아직 포함되지 않습니다.');
 if(!populated.length)notes.unshift('현재 표시할 관측치가 없습니다. 최초 자동 수집 이후 실제 값이 표시됩니다.');
 el('analysisNotes').innerHTML=notes.map(n=>`<div class="analysis-point">${esc(n)}</div>`).join('');
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
 }catch(e){console.error('Data unavailable',e);state.entries=FALLBACK_CONFIG.map(e=>({...e,series:[]}));}
 render();
}
main();
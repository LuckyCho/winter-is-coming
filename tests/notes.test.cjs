'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8').replace(/\bmain\(\);\s*$/,'');
const sandbox={console,Date,Math,Number,Intl};
vm.runInNewContext(source+'\n globalThis.test={renderIndicatorNotes,threeMonthReference,signalTone,noteRow};',sandbox);
const {renderIndicatorNotes,threeMonthReference,signalTone,noteRow}=sandbox.test;
function sample(id,unit,prior,current,priorDate='2026-06-01',date='2026-09-01'){
 return {id,title:id,unit,series:[{date:priorDate,value:prior},{date,value:current}]};
}
const entries=[
 sample('us_curve','%p',.71,.77,'2026-07-27','2026-10-27'),
 sample('us_cli','',100.76,101),
 sample('kr_cli','',102.59,102.53),
 sample('us_gz','%p',.87,.93),
 sample('us_ebp','%p',-.28,-.39),
 sample('us_recession_prob','%',11.52,9.12)
];
const html=renderIndicatorNotes(entries);
assert.ok(html.includes('class="metrics-table"'),'table missing');
assert.equal((html.match(/class="metric-row"/g)||[]).length,6,'six rows expected');
assert.ok(html.includes('aria-describedby="help-note-us_cli"'),'tooltip not reused');
assert.ok(html.includes('2026.10.27'),'observation date missing');
assert.ok(html.includes('101.00'),'CLI latest missing');
assert.ok(html.includes('0.77%p'),'curve unit missing');
assert.ok(html.includes('9.12%'),'probability percentage missing');
assert.ok(html.includes('−2.40 %p'),'probability change must be percentage points');
assert.ok(!html.includes('−2.40 %<'),'incorrect probability delta unit');
assert.ok(html.includes('positive') && html.includes('caution') && html.includes('neutral'));
assert.equal(threeMonthReference(entries[0].series).date,'2026-07-27');
assert.equal(signalTone('us_curve',.77,.06),'neutral');
assert.equal(signalTone('us_gz',.93,.06),'caution');
assert.equal(signalTone('us_ebp',-.39,-.11),'positive');
assert.equal(signalTone('kr_cli',102.53,-.06),'caution');
assert.equal(signalTone('us_recession_prob',9.12,-2.4),'positive');
assert.ok(noteRow({id:'us_cli',title:'CLI',unit:'',series:[]}).includes('자료 부족'));
assert.equal(threeMonthReference([{date:'2026-08-01',value:1},{date:'2026-09-01',value:2}]),null);
console.log('PASS: six rows, source dates, three-month actual observation lookback, signals, hover definitions and percentage-point units');

// ชุดทดสอบสมุดบันทึก (เงินนำส่ง / เปลี่ยนแผน / ออมเพิ่ม) — ตัวเลขสมมติทั้งหมด
// อ้าง: Requirements v1.3 หัวข้อ 5.2, 5.3 และ AC-27–AC-32
// รัน: node tests/test-ledger.js
const F = require('../js/forms');
const S = require('../js/store');
const C = require('../js/calc');
const PL = require('../js/plans');
let pass = 0, fail = 0; const rows = [];
const eq = (id, name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; rows.push(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'} | ${id} | ${name} | ได้ ${JSON.stringify(got)}${ok ? '' : ' | ต้องได้ ' + JSON.stringify(want)}`); };
const b = C.baht;
const TODAY = '2026-11-21';
const T01 = () => {   // ชุดตัวเลขสมมติ T01 (Requirements 7)
  const st = S.emptyState('2026-11-20');
  st.yearEnds.push({ year: 2025, date: '2025-12-31', v: b(850000), pm: b(300000), pg: b(300000) });
  st.records.push({ date: '2026-10-15', v: b(940000), pm: b(320250), pg: b(320250), note: '' });
  st.records.push({ date: '2026-11-15', v: b(943310), pm: b(322500), pg: b(322500), note: '' });
  return st;
};
const D = (d, m, y) => ({ d: String(d), m: String(m), y: String(y) });   // วันที่แบบช่องเลือก (ปี พ.ศ.)
const add = (st, item, id) => { st.ledger.push(Object.assign({ id }, item)); return st; };
const nums = st => { const r = C.compute(st); return [r.year.profit, r.year.pct, r.year.contributed, r.latest.v, r.dV]; };

// ---------- AC-27 เงินนำส่ง ----------
{ const st = T01(); const r = F.checkDeposit(st, { ...D(27, 10, 2569), a: '4,500', note: ' ทดสอบ ' }, { today: TODAY });
  eq('L01', 'เงินนำส่งถูกต้อง → บันทึกได้ (จำนวนเป็นสตางค์, บันทึกเพิ่มเติมตัดช่องว่าง)', [r.errors, r.item], [{}, { type: 'deposit', date: '2026-10-27', a: 450000, note: 'ทดสอบ' }]); }
{ const st = T01(); const c = f => Object.keys(F.checkDeposit(st, { ...D(27, 10, 2569), ...f }, { today: TODAY }).errors);
  eq('L02', 'ว่าง / ติดลบ / ทศนิยมเกิน 2 / 0 บาท → บันทึกไม่ได้', [c({ a: '' }), c({ a: '-5' }), c({ a: '1.234' }), c({ a: '0' })], [['a'], ['a'], ['a'], ['a']]);
  eq('L02', '0 บาท บอกเหตุผล', F.checkDeposit(st, { ...D(27, 10, 2569), a: '0' }, { today: TODAY }).errors.a, 'จำนวนเงินต้องมากกว่า 0');
  eq('L03', 'วันที่ไม่มีจริง / ในอนาคต → บันทึกไม่ได้', [c({ a: '1', ...D(31, 11, 2569) }), c({ a: '1', ...D(22, 11, 2569) })], [['date'], ['date']]); }
{ const st = add(T01(), { type: 'deposit', date: '2026-10-27', a: b(4500), note: '' }, 'd1');
  const r = F.checkDeposit(st, { ...D(27, 10, 2569), a: '4600' }, { today: TODAY });
  eq('L04', 'วันซ้ำ → แจ้งและพาไปแก้รายการเดิม', [r.errors.date, r.duplicateOf], ['มีเงินนำส่งวันที่นี้แล้ว', 'd1']);
  const e = F.checkDeposit(st, { ...D(27, 10, 2569), a: '4600' }, { editingId: 'd1', today: TODAY });
  eq('L04', 'แก้รายการเดิมวันเดิม → ไม่ถือว่าซ้ำ', e.errors, {}); }
{ const st = T01(); const before = nums(st);
  add(st, { type: 'deposit', date: '2026-10-27', a: b(4500), note: '' }, 'd1');
  add(st, { type: 'deposit', date: '2026-09-27', a: b(999999), note: '' }, 'd2');
  eq('L05', 'AC-27 บันทึกเงินนำส่งแล้ว กำไร % เงินที่ส่งเข้าไป ยอดเปลี่ยน ไม่เปลี่ยน', nums(st), before);
  st.ledger = st.ledger.filter(x => x.id !== 'd1');
  eq('L05', 'AC-27 ลบเงินนำส่งแล้ว ตัวเลขคำนวณไม่เปลี่ยน', nums(st), before);
  eq('L05', 'ตรวจว่ายังเป็นตัวเลข T01 (กำไร 48,310.00 / 5.54%)', [C.fmtMoney(nums(st)[0]), C.fmtPct(nums(st)[1])], ['48,310.00', '5.54%']); }

// ---------- AC-28 เปลี่ยนแผน ----------
eq('L06', 'รายชื่อแผน: เลือกได้ตอนนี้ 12 / ในแผนผสม 7 (Requirements 5.2)', [PL.CURRENT.length, PL.MIX_PARTS.length], [12, 7]);
{ const st = T01(); const r = F.checkPlan(st, { ...D(15, 9, 2569), plan: 'แผนเชิงรุก 35', note: '' }, { today: TODAY });
  eq('L07', 'เลือกแผนจากรายชื่อ → บันทึกได้', [r.errors, r.item], [{}, { type: 'plan', date: '2026-09-15', plan: 'แผนเชิงรุก 35', note: '' }]);
  const c = F.checkPlan(st, { ...D(15, 9, 2569), plan: 'แผนสมดุลตามอายุ (สัดส่วนเดิม)' }, { today: TODAY });
  eq('L07', 'แผนที่ปิดรับแล้ว (บันทึกย้อนหลัง) → บันทึกได้', c.errors, {});
  eq('L07', 'ไม่ได้เลือกแผน → บันทึกไม่ได้', F.checkPlan(st, { ...D(15, 9, 2569), plan: '' }, { today: TODAY }).errors.plan, 'กรุณาเลือกแผน');
  eq('L07', 'ชื่อแผนที่ไม่มีในรายชื่อ (เช่น ไฟล์แก้เอง) → บันทึกไม่ได้', Object.keys(F.checkPlan(st, { ...D(15, 9, 2569), plan: 'แผนหลัก' }, { today: TODAY }).errors), ['plan']); }
{ const st = T01(); const o = F.checkPlan(st, { ...D(1, 3, 2563), plan: PL.OTHER, other: '  แผนหลัก  ' }, { today: TODAY });
  eq('L08', 'แผนอื่น (พิมพ์เอง) → เก็บชื่อที่พิมพ์', [o.errors, o.item.plan, o.item.other], [{}, 'แผนหลัก', true]);
  eq('L08', 'แผนอื่นแต่ไม่พิมพ์ชื่อ → บันทึกไม่ได้', F.checkPlan(st, { ...D(1, 3, 2563), plan: PL.OTHER, other: ' ' }, { today: TODAY }).errors.other, 'กรุณาพิมพ์ชื่อแผน'); }
const mixF = arr => Object.fromEntries(arr.map((v, i) => ['mix-' + i, v]));
// ลำดับ: เงินฝากฯ, ตราสารหนี้, ตราสารหนี้ต่างประเทศ, ทองคำ, อสังหาฯ, หุ้นไทย, หุ้นต่างประเทศ
{ const st = T01(); const ok = F.checkPlan(st, { ...D(1, 10, 2569), plan: PL.MIX, ...mixF(['', '30', '', '10', '', '20', '40']) }, { today: TODAY });
  eq('L09', 'แผนผสมรวม 100 → บันทึกได้ เก็บเฉพาะแผนที่มากกว่า 0', [ok.errors, ok.total, ok.item.mix],
     [{}, 100, [{ plan: 'แผนตราสารหนี้', pct: 30 }, { plan: 'แผนทองคำ', pct: 10 }, { plan: 'แผนหุ้นไทย', pct: 20 }, { plan: 'แผนหุ้นต่างประเทศ', pct: 40 }]]);
  const r90 = F.checkPlan(st, { ...D(1, 10, 2569), plan: PL.MIX, ...mixF(['', '30', '', '', '', '20', '40']) }, { today: TODAY });
  eq('L10', 'AC-28 รวมไม่เท่า 100 → บันทึกไม่ได้และบอกผลรวม', r90.errors.mix, 'ต้องรวมได้ 100% (ตอนนี้ 90%)');
  eq('L10', 'รวมเกิน 100 → บันทึกไม่ได้', F.checkPlan(st, { ...D(1, 10, 2569), plan: PL.MIX, ...mixF(['50', '60']) }, { today: TODAY }).errors.mix, 'ต้องรวมได้ 100% (ตอนนี้ 110%)');
  eq('L10', 'ไม่ได้ใส่แผนใดเลย → บันทึกไม่ได้', F.checkPlan(st, { ...D(1, 10, 2569), plan: PL.MIX }, { today: TODAY }).errors.mix, 'ใส่ % อย่างน้อย 1 แผน ให้รวมได้ 100%');
  const neg = F.checkPlan(st, { ...D(1, 10, 2569), plan: PL.MIX, ...mixF(['-10', '110']) }, { today: TODAY });
  const dec = F.checkPlan(st, { ...D(1, 10, 2569), plan: PL.MIX, ...mixF(['50.5', '49.5']) }, { today: TODAY });
  eq('L10', 'ติดลบ / ทศนิยม → บันทึกไม่ได้ บอกช่องที่ผิด', [Object.keys(neg.errors), Object.keys(dec.errors)], [['mix-0', 'mix-1'], ['mix-0', 'mix-1']]);
  const g = F.checkPlan(st, { ...D(1, 10, 2569), plan: PL.MIX, ...mixF(['', '', '', '30', '', '', '70']) }, { today: TODAY });
  eq('L11', 'ทองคำเกิน 25 → บันทึกไม่ได้ บอกที่ช่องทองคำ (0.4.1 ซันตัดสิน 22 พ.ย.)', g.errors, { 'mix-3': 'แผนทองคำเลือกได้ไม่เกิน 25%' });
  eq('L11', 'ทองคำ 25 พอดี → บันทึกได้', F.checkPlan(st, { ...D(1, 10, 2569), plan: PL.MIX, ...mixF(['', '', '', '25', '', '', '75']) }, { today: TODAY }).errors, {});
  eq('L11', 'ข้อความระหว่างพิมพ์: ทองคำ 26 / หุ้นไทย 26 / ทองคำ 2.5', [F.liveMixPart(3, '26'), F.liveMixPart(5, '26'), F.liveMixPart(3, '2.5')],
     ['แผนทองคำเลือกได้ไม่เกิน 25%', null, 'ใส่เป็นจำนวนเต็มเท่านั้น ไม่มีทศนิยม']); }
{ const st = add(T01(), { type: 'plan', date: '2026-09-15', plan: 'แผนเชิงรุก 35', note: '' }, 'p1');
  const r = F.checkPlan(st, { ...D(15, 9, 2569), plan: 'แผนหุ้นไทย' }, { today: TODAY });
  eq('L12', 'เปลี่ยนแผนวันซ้ำ → พาไปแก้รายการเดิม (วันละ 1 รายการต่อประเภท)', [r.errors.date, r.duplicateOf], ['มีการเปลี่ยนแผนวันที่นี้แล้ว', 'p1']);
  eq('L12', 'คนละประเภทวันเดียวกันได้', F.checkSaving(st, { ...D(15, 9, 2569), rate: '5' }, { today: TODAY }).errors, {}); }
{ const st = T01(); const before = nums(st);
  add(st, { type: 'plan', date: '2026-10-01', plan: PL.MIX, mix: [{ plan: 'แผนหุ้นไทย', pct: 100 }], note: '' }, 'p1');
  eq('L13', 'AC-28 จดเปลี่ยนแผนแล้ว ตัวเลขคำนวณไม่เปลี่ยน', nums(st), before); }

// ---------- AC-29 ออมเพิ่ม ----------
{ const st = T01(); const c = v => F.checkSaving(st, { ...D(1, 7, 2569), rate: v }, { today: TODAY });
  eq('L14', 'AC-29 0 / 5 / 27 เต็มจำนวน → บันทึกได้', [c('0').errors, c('5').item.rate, c('27').errors], [{}, 5, {}]);
  eq('L14', 'AC-29 ติดลบ / ทศนิยม / ตัวอักษร / ว่าง → บันทึกไม่ได้', [c('-1').errors.rate, c('2.5').errors.rate, c('ห้า').errors.rate, c('').errors.rate],
     ['ติดลบไม่ได้', 'ใส่เป็นจำนวนเต็มเท่านั้น ไม่มีทศนิยม', 'กรอกเป็นตัวเลขเท่านั้น', 'กรุณากรอกอัตรา']);
  eq('L15', 'เกิน 27 → บันทึกไม่ได้ (0.4.1 ซันตัดสิน 22 พ.ย.)', [c('28').errors.rate, c('30').errors.rate], ['ออมเพิ่มได้ไม่เกิน 27%', 'ออมเพิ่มได้ไม่เกิน 27%']);
  eq('L15', 'ข้อความระหว่างพิมพ์: ว่าง / 5 / 28 / 2.5', [F.liveSaving(''), F.liveSaving('5'), F.liveSaving('28'), F.liveSaving('2.5')],
     [null, null, 'ออมเพิ่มได้ไม่เกิน 27%', 'ใส่เป็นจำนวนเต็มเท่านั้น ไม่มีทศนิยม']);
  const before = nums(st); add(st, c('5').item, 's1');
  eq('L16', 'จดออมเพิ่มแล้ว ตัวเลขคำนวณไม่เปลี่ยน', nums(st), before); }

// ---------- AC-31 สำรอง/กู้คืนทุกประเภท ----------
const FULL = () => {
  const st = T01();
  add(st, { type: 'deposit', date: '2026-10-27', a: b(4500), note: '' }, 'd1');
  add(st, { type: 'deposit', date: '2026-09-25', a: b(4500), note: 'ก.ย.' }, 'd2');
  add(st, { type: 'plan', date: '2026-10-01', plan: PL.MIX, mix: [{ plan: 'แผนทองคำ', pct: 20 }, { plan: 'แผนหุ้นไทย', pct: 80 }], note: '' }, 'p1');
  add(st, { type: 'plan', date: '2020-03-01', plan: 'แผนหลัก', other: true, note: '' }, 'p2');
  add(st, { type: 'saving', date: '2026-07-01', rate: 5, note: '' }, 's1');
  return st;
};
{ const st = FULL(); const p = S.parseBackup(S.makeBackup(st, '2026-11-21T00:00:00Z'));
  eq('L17', 'AC-31 สรุปก่อนกู้คืนบอกจำนวนแต่ละประเภท', p.summary, { years: 3, records: 2, yearEnds: 1, deposit: 2, plan: 2, saving: 1, latest: '2026-11-15' });
  const st2 = S.stateFromBackup(p.data, 'x');
  eq('L17', 'AC-31 กู้คืนแล้วรายการสมุดครบทุกช่องเท่าเดิม', JSON.stringify(st2.ledger), JSON.stringify(st.ledger)); }
const bad = mut => { const st = FULL(); mut(st.ledger); return S.parseBackup(S.makeBackup(st, 'x')).ok; };
eq('L18', 'ไฟล์ที่สมุดผิดรูปแบบ → ไม่รับ (เงินนำส่ง 0, % รวมไม่ถึง 100, ออมเพิ่มทศนิยม, ไม่มีรหัส, ชื่อแผนว่าง)',
   [bad(l => { l[0].a = 0; }), bad(l => { l[2].mix[0].pct = 10; }), bad(l => { l[4].rate = 2.5; }), bad(l => { delete l[0].id; }), bad(l => { l[3].plan = ' '; })],
   [false, false, false, false, false]);
eq('L18', 'ไฟล์ที่สมุดประเภทเดียวกันวันซ้ำ / รหัสซ้ำ → ไม่รับ', [bad(l => { l[1].date = l[0].date; }), bad(l => { l[1].id = l[0].id; })], [false, false]);
{ const fs = require('fs'), path = require('path');
  const res = ['h10-safari.json', 'h10-homescreen.json'].map(n => S.parseBackup(fs.readFileSync(path.join(__dirname, '..', 'test-data', n), 'utf8')).ok);
  eq('L19', 'ไฟล์ทดสอบ H10 รุ่นเก่า (0.1–0.3) ยังกู้คืนได้ในรุ่นนี้', res, [true, true]); }
{ const st = FULL(); const mem = (() => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; })();
  S.save(mem, st); const r = S.load(mem);
  eq('L19', 'เก็บในเครื่องแล้วเปิดใหม่ สมุดยังครบ (schema ยังเป็น 1)', [r.ok, r.state.ledger.length, r.state.schema], [true, 5, 1]); }

// ---------- F-17 สรุปสมุด ----------
{ const st = FULL(); add(st, { type: 'plan', date: '2026-11-21', plan: 'แผนหุ้นไทย', note: '' }, 'p3');
  eq('L20', 'F-17 แผนล่าสุดที่จด = วันที่มีผลล่าสุดที่ไม่เกินวันนี้', [F.latestLedger(st, 'plan', TODAY).id, F.latestLedger(st, 'plan', '2026-11-20').id], ['p3', 'p1']);
  eq('L20', 'ยังไม่เคยจด → ไม่มีสรุป (AC-32)', F.latestLedger(T01(), 'saving', TODAY), null); }

console.log(rows.join('\n')); console.log(`\nรวม ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
if (fail) process.exitCode = 1;

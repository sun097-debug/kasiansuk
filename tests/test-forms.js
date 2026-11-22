// ชุดทดสอบกติกาช่องกรอก — ตัวเลขสมมติทั้งหมด
// รัน: node tests/test-forms.js
const F = require('../js/forms');
const C = require('../js/calc');
let pass = 0, fail = 0; const rows = [];
const eq = (id, name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; rows.push(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'} | ${id} | ${name} | ได้ ${JSON.stringify(got)}${ok ? '' : ' | ต้องได้ ' + JSON.stringify(want)}`); };
const b = C.baht, TODAY = '2026-11-20';
const base = () => ({ records: [{ date: '2026-10-15', v: b(935800), pm: b(320250), pg: b(320250), note: '' }],
                      yearEnds: [{ year: 2025, date: '2025-12-31', v: b(850000), pm: b(300000), pg: b(300000) }], ledger: [] });
const form = o => Object.assign({ d: '15', m: '11', y: '2569', v: '943,310', pm: '322500', pg: '322500', note: '' }, o);

// F01 เงิน
eq('F01', 'คอมมาและสตางค์', F.parseMoney('12,345,678.90').value, 1234567890);
eq('F01', 'สตางค์ 1 ตำแหน่ง = 10 สตางค์', F.parseMoney('0.1').value, 10);
eq('F01', 'ว่าง / ตัวอักษร / ติดลบ / ทศนิยม 3 ตำแหน่ง (AC-06)', ['', 'abc', '-5', '1.234'].map(x => F.parseMoney(x).why),
   ['กรุณากรอกจำนวนเงิน', 'กรอกเป็นตัวเลขเท่านั้น', 'จำนวนเงินติดลบไม่ได้', 'ใส่สตางค์ได้ไม่เกิน 2 ตำแหน่ง']);
eq('F01', 'แปลงกลับเป็นช่องกรอก', [F.moneyInput(1234567890), F.moneyInput(1234567805), F.moneyInput(null)], ['12345678.90', '12345678.05', '']);

// F06 ใส่ลูกน้ำระหว่างพิมพ์ (0.3.0)
eq('F06', 'คั่นหลักพัน / ทศนิยม / ศูนย์นำหน้า / ตัวอักษรพิมพ์ไม่ติด / จุดซ้ำ',
   ['943310', '1234567.5', '007', 'a1b2c3', '1.2.3', '', '0.50'].map(F.groupDigits),
   ['943,310', '1,234,567.5', '7', '123', '1.23', '', '0.50']);
eq('F06', 'ข้อความที่มีลูกน้ำแล้วยังอ่านเป็นเงินได้ตรง', F.parseMoney(F.groupDigits('12345678.90')).value, 1234567890);

// F02 วันที่
eq('F02', 'แสดงวันที่ไทย', [F.thaiDate('2026-10-15'), F.thaiDateShort('2025-12-31')], ['15 ต.ค. 2569', '31 ธ.ค. 68']);
eq('F02', '30 ก.พ. ไม่มีจริง / วันในอนาคต (AC-06)', [F.checkDate('30', '2', '2569', TODAY).why, F.checkDate('21', '11', '2569', TODAY).why],
   ['วันที่นี้ไม่มีในปฏิทิน', 'วันที่ยังมาไม่ถึง ใช้วันที่ของข้อมูลใน My GPF']);
eq('F02', 'พ.ศ. → ค.ศ.', F.checkDate('29', '2', '2567', TODAY).iso, '2024-02-29');

// F03 บันทึกยอด
{ const r = F.checkBalance(base(), form({}), { today: TODAY });
  eq('F03', 'บันทึกปกติ ได้รายการเป็นสตางค์', r.rec, { date: '2026-11-15', v: b(943310), pm: b(322500), pg: b(322500), note: '' }); }
{ const r = F.checkBalance(base(), form({ pm: '', pg: '' }), { today: TODAY });
  eq('F03', 'ข้ามเงินต้นทั้ง 2 ช่องได้ (AC-01)', [r.rec.pm, r.rec.pg], [null, null]); }
{ const r = F.checkBalance(base(), form({ pg: '' }), { today: TODAY });
  eq('F03', 'กรอกเงินต้นช่องเดียว → บอกช่องที่ขาด', r.errors, { pg: 'กรอกให้ครบทั้ง 2 ช่อง หรือเว้นว่างทั้ง 2 ช่อง' }); }
{ const r = F.checkBalance(base(), form({ d: '15', m: '10' }), { today: TODAY });
  eq('F03', 'วันที่ซ้ำ → พาไปแก้รายการเดิม (AC-04)', [r.errors.date, r.duplicateOf], ['มีรายการวันที่นี้แล้ว', '2026-10-15']); }
{ const r = F.checkBalance(base(), form({ d: '15', m: '10', v: '936000' }), { editing: '2026-10-15', today: TODAY });
  eq('F03', 'แก้รายการเดิมวันเดียวกันได้ ไม่นับว่าซ้ำ', r.rec.v, b(936000)); }
{ const r = F.checkBalance(base(), form({ pm: '310000', pg: '310000' }), { today: TODAY });
  eq('F03', 'เงินต้นลดลง → เตือนแต่บันทึกได้ (AC-07)', [r.rec != null, r.principalDrop && r.principalDrop.vs], [true, '2026-10-15']); }
{ const r = F.checkBalance(base(), form({ v: '', d: '31', m: '11' }), { today: TODAY });
  eq('F03', 'หลายช่องผิดพร้อมกัน → บอกทุกช่อง', Object.keys(r.errors).sort(), ['date', 'v']); }

// F04 คำถามเงินต้น F-09 (0.4.3 ซันตัดสิน 22 พ.ย.: พลาด 1 รอบ → กล่องเตือนในฟอร์ม ไม่เด้ง / พลาด 2 รอบขึ้นไป → ถาม ไม่เกินรอบละครั้ง)
{ const st = base(); const r = F.checkBalance(st, form({ pm: '320250', pg: '320250' }), { today: TODAY });
  eq('F04', 'บันทึกยอดใหม่ 15 พ.ย. เงินต้นเท่า 15 ต.ค. (พลาด 1 รอบ) → ไม่เด้งถาม', F.principalQuestion(st, r.rec, null), null);
  eq('F04', '… แต่ขึ้นกล่องเตือนในฟอร์ม', F.principalHint(st, '2026-11-15', b(320250), b(320250)), { sameSince: '2026-10-15', rounds: 1 }); }
{ const st = base(); const rec = { date: '2026-12-15', v: b(950000), pm: b(320250), pg: b(320250), note: '' };
  eq('F04', '15 ธ.ค. เงินต้นยังเท่า 15 ต.ค. (พลาด 2 รอบ: 25 ต.ค., 25 พ.ย.) → ถาม', F.principalQuestion(st, rec, null), { sameSince: '2026-10-15', months: 2, rounds: 2 });
  const snoozed = Object.assign(base(), { meta: { principalSnoozeUntil: F.nextPayDay('2026-12-15') } });
  eq('F04', 'กด "ไว้ทีหลัง" 15 ธ.ค. → ไม่ถามจนถึง 25 ธ.ค.', [F.nextPayDay('2026-12-15'), F.principalQuestion(snoozed, Object.assign({}, rec, { date: '2026-12-20' }), null)], ['2026-12-25', null]);
  const q = F.principalQuestion(snoozed, Object.assign({}, rec, { date: '2026-12-26' }), null);
  eq('F04', '… 26 ธ.ค. (รอบใหม่) ยังไม่แก้ → ถามอีกครั้ง (นับรอบถึง 25 พ.ย. ตาม C-5 = 2 รอบ)', q && q.rounds, 2); }
{ const st = base();
  eq('F04', 'กล่องเตือนในฟอร์ม: เงินต้นใหม่ (แก้แล้ว) → ไม่ขึ้น', F.principalHint(st, '2026-11-15', b(322500), b(322500)), null);
  eq('F04', 'กล่องเตือนในฟอร์ม: บันทึก 20 ต.ค. (ยังไม่พลาดรอบ) → ไม่ขึ้น', F.principalHint(st, '2026-10-20', b(320250), b(320250)), null);
  eq('F04', 'นับรอบ: แก้ 15 ส.ค. → 20 ก.พ. = 6 รอบ / แก้ 26 ต.ค. → 20 พ.ย. = 0 รอบ', [F.missedRounds('2026-08-15', '2027-02-20'), F.missedRounds('2026-10-26', '2026-11-20')], [6, 0]);
  eq('F04', 'วันที่ 25 รอบถัดไป: 24 พ.ย. → 25 พ.ย. / 25 พ.ย. → 25 ธ.ค. / 26 ธ.ค. → 25 ม.ค.', [F.nextPayDay('2026-11-24'), F.nextPayDay('2026-11-25'), F.nextPayDay('2026-12-26')], ['2026-11-25', '2026-12-25', '2027-01-25']); }
{ const st = base(); const r = F.checkBalance(st, form({}), { today: TODAY });
  eq('F04', 'แก้เงินต้นแล้ว → ไม่ถาม', F.principalQuestion(st, r.rec, null), null); }
{ const st = base(); const r = F.checkBalance(st, form({ pm: '320250', pg: '320250' }), { today: TODAY });
  eq('F04', 'ตอนแก้รายการเดิม → ไม่ถาม', F.principalQuestion(st, r.rec, '2026-11-15'), null); }
{ const st = base(); const r = F.checkBalance(st, form({ d: '1', m: '9', pm: '', pg: '' }), { today: TODAY });
  eq('F04', 'บันทึกย้อนหลัง (ไม่ใช่รายการล่าสุด) → ไม่ถาม', F.principalQuestion(st, r.rec, null), null); }

// F05 ยอดสิ้นปี
{ const r = F.checkYearEnd(base(), form({ d: '31', m: '12', y: '2568', v: '850000', pm: '300000', pg: '300000' }), { editingYear: 2025, today: TODAY });
  eq('F05', 'ปีมาจากวันที่ (31 ธ.ค. 2568 → ปี 2025)', [r.ye.year, r.notDecember, r.allZero], [2025, false, false]); }
{ const r = F.checkYearEnd(base(), form({ d: '31', m: '12', y: '2568' }), { today: TODAY });
  eq('F05', 'ยอดสิ้นปีปีเดียวกันซ้ำ → พาไปแก้', r.duplicateOf, 2025); }
{ const r = F.checkYearEnd(base(), form({ d: '31', m: '12', y: '2568', pm: '' }), { editingYear: 2025, today: TODAY });
  eq('F05', 'ยอดสิ้นปีต้องมีเงินต้นทั้ง 2 ช่อง', r.errors, { pm: 'กรุณากรอกเงินต้น' }); }
{ const r = F.checkYearEnd({ records: [], yearEnds: [] }, form({ d: '31', m: '12', y: '2568', v: '0', pm: '0', pg: '0' }), { today: TODAY });
  eq('F05', 'กรอก 0 ทุกช่อง → ถามยืนยันสมาชิกใหม่ (C-2)', r.allZero, true); }
{ const r = F.checkYearEnd({ records: [], yearEnds: [] }, form({ d: '30', m: '11', y: '2568', v: '1', pm: '0', pg: '0' }), { today: TODAY });
  eq('F05', 'วันที่ไม่ใช่ ธ.ค. → เตือนแต่บันทึกได้', [r.ye != null, r.notDecember], [true, true]); }

// F07 วันที่เติมไว้ให้ของยอดเงิน = 2 วันก่อน (0.4.4 — ซันตัดสิน 22 พ.ย., AC-03)
const at = (y, m, d) => new Date(y, m - 1, d, 10, 0, 0);
eq('F07', 'วันปกติ / ข้ามต้นเดือน / ข้ามต้นปี / ปีอธิกสุรทิน',
   [F.defaultDataDate(at(2026, 11, 22)), F.defaultDataDate(at(2026, 12, 1)), F.defaultDataDate(at(2027, 1, 1)), F.defaultDataDate(at(2028, 3, 1))],
   ['2026-11-20', '2026-11-29', '2026-12-30', '2028-02-28']);
eq('F07', 'ใกล้เที่ยงคืน (23:59 และ 00:01) ใช้วันที่ตามเวลาในเครื่อง',
   [F.defaultDataDate(new Date(2026, 10, 22, 23, 59)), F.defaultDataDate(new Date(2026, 10, 23, 0, 1))], ['2026-11-20', '2026-11-21']);
eq('F07', 'วันที่ที่เติมไว้ผ่านกติกาวันที่ (ไม่ใช่วันในอนาคต)',
   (() => { const iso = F.defaultDataDate(at(2026, 11, 20)), [y, m, d] = iso.split('-'); return F.checkDate(String(+d), String(+m), String(+y + 543), TODAY).ok; })(), true);

console.log(rows.join('\n')); console.log(`\nรวม ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
if (fail) process.exitCode = 1;

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

// F04 คำถามเงินต้น F-09 (เงื่อนไข C-5)
{ const st = base(); const r = F.checkBalance(st, form({ pm: '320250', pg: '320250' }), { today: TODAY });
  eq('F04', 'บันทึกยอดใหม่ 15 พ.ย. เงินต้นเท่า 15 ต.ค. → ถาม', F.principalQuestion(st, r.rec, null), { sameSince: '2026-10-15', months: 1 }); }
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

console.log(rows.join('\n')); console.log(`\nรวม ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
if (fail) process.exitCode = 1;

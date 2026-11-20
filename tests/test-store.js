// ชุดทดสอบส่วนเก็บข้อมูลและไฟล์สำรอง — ตัวเลขสมมติทั้งหมด
// รัน: node tests/test-store.js
const S = require('../js/store');
const C = require('../js/calc');
let pass = 0, fail = 0; const rows = [];
const eq = (id, name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; rows.push(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'} | ${id} | ${name} | ได้ ${JSON.stringify(got)}${ok ? '' : ' | ต้องได้ ' + JSON.stringify(want)}`); };

// ที่เก็บจำลอง (แทน localStorage)
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; };
const full = () => ({ getItem: () => null, setItem: () => { const e = new Error('QuotaExceededError'); throw e; } });
const b = C.baht;
const sample = () => {
  const st = S.emptyState('2026-11-20');
  st.yearEnds.push({ year: 2025, date: '2025-12-31', v: b(850000), pm: b(300000), pg: b(300000) });
  st.records.push({ date: '2026-08-15', v: b(912400), pm: b(315750), pg: b(315750), note: '' });
  st.records.push({ date: '2026-10-15', v: b(935800), pm: b(320250), pg: b(320250), note: 'ทดสอบ' });
  st.ledger.push({ id: 'a1', type: 'deposit', date: '2026-09-27', a: b(4500), note: '' });
  st.ledger.push({ id: 'a2', type: 'plan', date: '2026-09-15', plan: 'แผนเชิงรุก 35', note: '' });
  st.ledger.push({ id: 'a3', type: 'saving', date: '2026-07-01', rate: 5, note: '' });
  return st;
};

// S01 เปิดครั้งแรก: ยังไม่มีข้อมูล
{ const r = S.load(mem()); eq('S01', 'เปิดครั้งแรก ไม่มีข้อมูล → state เป็น null (ไปหน้าเริ่มใช้)', [r.ok, r.state], [true, null]); }

// S02 เก็บแล้วเปิดใหม่ได้ข้อมูลเดิม (AC-20)
{ const s = mem(); const st = sample(); const w = S.save(s, st); const r = S.load(s);
  eq('S02', 'เก็บแล้วเปิดใหม่ ข้อมูลเหมือนเดิม', [w.ok, JSON.stringify(r.state) === JSON.stringify(st)], [true, true]); }

// S03 เก็บไม่สำเร็จต้องรู้ (AC-20)
{ const w = S.save(full(), sample()); eq('S03', 'พื้นที่เต็ม → แจ้งว่าไม่สำเร็จ ไม่บอกว่าสำเร็จ', w.ok, false); }

// S04 สำรอง → กู้คืน ได้ตัวเลขเท่าเดิมทุกตัว (AC-22, AC-31)
{ const st = sample(); const file = S.makeBackup(st, '2026-11-20'); const p = S.parseBackup(file);
  const st2 = S.stateFromBackup(p.data, '2026-11-21');
  eq('S04', 'กู้คืนแล้วผลคำนวณเท่าเดิมทุกตัว', JSON.stringify(C.compute(st2)) === JSON.stringify(C.compute(st)), true);
  eq('S04', 'สรุปไฟล์: ปี / ยอดเงิน / ยอดสิ้นปี / เงินนำส่ง / เปลี่ยนแผน / ออมเพิ่ม / ล่าสุด', p.summary,
     { years: 2, records: 2, yearEnds: 1, deposit: 1, plan: 1, saving: 1, latest: '2026-10-15' });
  eq('S04', 'ไฟล์มีหมายเลขรุ่นรูปแบบข้อมูล (N-06)', JSON.parse(file).schema, 1); }

// S05 ไฟล์ผิด → ไม่ผ่าน + บอกเหตุผล (ข้อมูลเดิมไม่ถูกแตะ เพราะ parseBackup ไม่เขียนอะไร) (AC-21)
eq('S05', 'ไฟล์ไม่ใช่ JSON', S.parseBackup('สวัสดี').why, 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอพเกษียณสุข');
eq('S05', 'ไฟล์ JSON ของแอพอื่น', S.parseBackup('{"a":1}').why, 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอพเกษียณสุข');
eq('S05', 'ไฟล์จากรุ่นใหม่กว่า', S.parseBackup(JSON.stringify({ format: S.FORMAT, schema: 99, data: {} })).ok, false);
{ const st = sample(); st.records[0].pm = null; const p = S.parseBackup(S.makeBackup(st, 'x'));
  eq('S05', 'เงินต้นไม่ครบ 2 ช่อง', p.why, 'มีรายการที่เงินต้นไม่ครบ 2 ช่อง'); }
{ const st = sample(); st.records[1].date = '2026-08-15'; const p = S.parseBackup(S.makeBackup(st, 'x'));
  eq('S05', 'วันที่ยอดเงินซ้ำ', p.why, 'มีรายการยอดเงินวันที่ซ้ำกัน'); }
{ const st = sample(); st.records[0].date = '2026-02-30'; const p = S.parseBackup(S.makeBackup(st, 'x'));
  eq('S05', 'วันที่ไม่มีจริง', p.ok, false); }
{ const st = sample(); st.records[0].v = 912400.5; const p = S.parseBackup(S.makeBackup(st, 'x'));
  eq('S05', 'เงินไม่ใช่สตางค์จำนวนเต็ม', p.ok, false); }

// S06 กู้คืนแล้วเก็บไม่สำเร็จ → ข้อมูลเดิมยังอยู่ (AC-21)
{ const s = mem(); S.save(s, sample()); const before = s._m[S.KEY];
  const bad = { getItem: s.getItem, setItem: () => { throw new Error('full'); } };
  const w = S.save(bad, S.emptyState('x'));
  eq('S06', 'เขียนทับไม่สำเร็จ → ข้อมูลเดิมไม่หาย', [w.ok, s._m[S.KEY] === before], [false, true]); }

// S07 ไฟล์สำรองไม่มีผลคำนวณ (เก็บแค่สิ่งที่ผู้ใช้กรอก)
{ const f = JSON.parse(S.makeBackup(sample(), 'x')); eq('S07', 'ไฟล์มีแค่ records / yearEnds / ledger', Object.keys(f.data), ['records', 'yearEnds', 'ledger']); }

console.log(rows.join('\n')); console.log(`\nรวม ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
if (fail) process.exitCode = 1;

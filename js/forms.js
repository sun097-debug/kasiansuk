// กติกาตรวจช่องกรอก และวันที่ภาษาไทย — แอพเกษียณสุข
// แยกจากหน้าจอเพื่อให้ทดสอบได้ (tests/test-forms.js)
(function (root, factory) {
  const api = factory(root.Calc || (typeof require === 'function' ? require('./calc') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Forms = api;
})(typeof self !== 'undefined' ? self : this, function (Calc) {

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const pad = n => String(n).padStart(2, '0');

// '2026-10-15' → '15 ต.ค. 2569'
const thaiDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y + 543}`; };
// '2026-10-15' → '15 ต.ค. 69' (สั้น สำหรับกราฟ)
const thaiDateShort = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${String(y + 543).slice(2)}`; };
const todayIso = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

// ข้อความเงิน → สตางค์จำนวนเต็ม (ไม่ใช้ทศนิยมคอมพิวเตอร์)
function parseMoney(text) {
  const s = String(text == null ? '' : text).replace(/[,\s]/g, '');
  if (s === '') return { ok: false, empty: true, why: 'กรุณากรอกจำนวนเงิน' };
  if (/^-/.test(s) || /^−/.test(s)) return { ok: false, why: 'จำนวนเงินติดลบไม่ได้' };
  if (/^\d+\.\d{3,}$/.test(s)) return { ok: false, why: 'ใส่สตางค์ได้ไม่เกิน 2 ตำแหน่ง' };
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { ok: false, why: 'กรอกเป็นตัวเลขเท่านั้น' };
  const [whole, frac = ''] = s.split('.');
  if (whole.length > 12) return { ok: false, why: 'ตัวเลขยาวเกินไป' };
  return { ok: true, value: Number(whole) * 100 + Number((frac + '00').slice(0, 2)) };
}
// สตางค์ → ข้อความในช่องกรอก (ไม่มีคอมมา — หน้าจอใส่คอมมาให้ด้วย groupDigits)
const moneyInput = s => (s == null ? '' : (Math.floor(s / 100) + (s % 100 ? '.' + pad(s % 100) : '')));

// ใส่ลูกน้ำคั่นหลักพันระหว่างพิมพ์ (0.3.0): '1234567.5' → '1,234,567.5'
// เก็บเฉพาะตัวเลขกับจุดทศนิยมจุดแรก (ตัวอักษร/เครื่องหมายลบพิมพ์ไม่ติด)
function groupDigits(text) {
  let raw = String(text == null ? '' : text).replace(/[^\d.]/g, '');
  const i = raw.indexOf('.');
  if (i >= 0) raw = raw.slice(0, i + 1) + raw.slice(i + 1).replace(/\./g, '');
  const [w, f] = raw.split('.');
  const whole = w.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return f !== undefined ? whole + '.' + f : whole;
}

// วัน / เดือน / ปี พ.ศ. → 'YYYY-MM-DD' (ค.ศ.)
function checkDate(d, m, yBE, today) {
  const y = Number(yBE) - 543, mm = Number(m), dd = Number(d);
  if (!y || !mm || !dd) return { ok: false, why: 'กรุณาเลือกวันที่' };
  const t = new Date(Date.UTC(y, mm - 1, dd));
  if (t.getUTCMonth() !== mm - 1) return { ok: false, why: 'วันที่นี้ไม่มีในปฏิทิน' };
  const iso = `${y}-${pad(mm)}-${pad(dd)}`;
  if (iso > today) return { ok: false, why: 'วันที่ยังมาไม่ถึง ใช้วันที่ของข้อมูลใน My GPF' };
  return { ok: true, iso };
}

// เงินต้น 2 ช่อง: กรอกครบทั้งคู่ หรือเว้นทั้งคู่
function parsePrincipal(pmText, pgText, required) {
  const a = parseMoney(pmText), b = parseMoney(pgText), errors = {};
  if (a.empty && b.empty) {
    if (required) { errors.pm = 'กรุณากรอกเงินต้น'; errors.pg = 'กรุณากรอกเงินต้น'; }
    return { errors, pm: null, pg: null };
  }
  const both = 'กรอกให้ครบทั้ง 2 ช่อง หรือเว้นว่างทั้ง 2 ช่อง';
  const msg = r => (r.empty ? (required ? 'กรุณากรอกเงินต้น' : both) : r.why);
  if (!a.ok) errors.pm = msg(a);
  if (!b.ok) errors.pg = msg(b);
  return { errors, pm: a.ok ? a.value : null, pg: b.ok ? b.value : null };
}

// ---------- บันทึกยอด / แก้รายการ (F-01, F-02, AC-04, AC-06, AC-07, F-09) ----------
// f = { d, m, y, v, pm, pg, note } เป็นข้อความจากช่องกรอก; editing = วันที่ของรายการที่กำลังแก้ (หรือ null)
function checkBalance(state, f, { editing = null, today }) {
  const errors = {};
  const dt = checkDate(f.d, f.m, f.y, today); if (!dt.ok) errors.date = dt.why;
  const v = parseMoney(f.v); if (!v.ok) errors.v = v.why;
  const p = parsePrincipal(f.pm, f.pg, false); Object.assign(errors, p.errors);
  if (Object.keys(errors).length) return { errors };
  const rec = { date: dt.iso, v: v.value, pm: p.pm, pg: p.pg, note: String(f.note || '').trim() };
  const dup = state.records.find(r => r.date === rec.date && r.date !== editing);
  if (dup) return { errors: { date: 'มีรายการวันที่นี้แล้ว' }, duplicateOf: dup.date };
  // AC-07: เงินต้นรวมน้อยกว่ารายการก่อนหน้า (ที่มีเงินต้น) → เตือน แต่ยืนยันบันทึกได้
  let principalDrop = null;
  if (rec.pm != null) {
    const before = Calc.byDate(state.records).filter(r => r.date < rec.date && r.date !== editing && r.pm != null);
    const prev = before[before.length - 1];
    if (prev && Calc.P(rec) < Calc.P(prev)) principalDrop = { vs: prev.date, prev: Calc.P(prev), now: Calc.P(rec) };
  }
  return { errors: {}, rec, principalDrop };
}

// F-09 (Calculation v1.0 หัวข้อ 5.2): ถามเฉพาะตอนบันทึกยอดใหม่ ที่จะเป็นรายการล่าสุด และเงินต้นไม่ทันสมัย
function principalQuestion(state, rec, editing) {
  if (editing) return null;
  const records = state.records.concat([rec]);
  const r = Calc.compute({ records, yearEnds: state.yearEnds });
  if (r.latest.date !== rec.date) return null;
  return r.principalNote;
}

// ---------- ยอดสิ้นปี (F-03, AC-08, AC-10, C-2) ----------
function checkYearEnd(state, f, { editingYear = null, today }) {
  const errors = {};
  const dt = checkDate(f.d, f.m, f.y, today); if (!dt.ok) errors.date = dt.why;
  const v = parseMoney(f.v); if (!v.ok) errors.v = v.why;
  const p = parsePrincipal(f.pm, f.pg, true); Object.assign(errors, p.errors);
  if (Object.keys(errors).length) return { errors };
  const year = +dt.iso.slice(0, 4);
  const ye = { year, date: dt.iso, v: v.value, pm: p.pm, pg: p.pg };
  const dup = state.yearEnds.find(e => e.year === year && e.year !== editingYear);
  if (dup) return { errors: { date: `มียอดสิ้นปี ${year + 543} แล้ว` }, duplicateOf: year };
  return { errors: {}, ye,
           notDecember: dt.iso.slice(5, 7) !== '12',                 // เตือน แต่บันทึกได้
           allZero: ye.v === 0 && ye.pm === 0 && ye.pg === 0 };      // ถามยืนยันสมาชิกใหม่ 1 ครั้ง
}

return { MONTHS, thaiDate, thaiDateShort, todayIso, parseMoney, moneyInput, groupDigits, checkDate, checkBalance, principalQuestion, checkYearEnd };
});

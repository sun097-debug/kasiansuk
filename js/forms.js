// กติกาตรวจช่องกรอก และวันที่ภาษาไทย — แอพเกษียณสุข
// แยกจากหน้าจอเพื่อให้ทดสอบได้ (tests/test-forms.js)
(function (root, factory) {
  const req = n => (typeof require === 'function' ? require(n) : null);
  const api = factory(root.Calc || req('./calc'), root.Plans || req('./plans'));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Forms = api;
})(typeof self !== 'undefined' ? self : this, function (Calc, Plans) {

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const pad = n => String(n).padStart(2, '0');

// '2026-10-15' → '15 ต.ค. 2569'
const thaiDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y + 543}`; };
// '2026-10-15' → '15 ต.ค. 69' (สั้น สำหรับกราฟ)
const thaiDateShort = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${String(y + 543).slice(2)}`; };
const todayIso = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
// 0.4.4 (AC-03): วันที่ที่เติมไว้ในหน้าเริ่มใช้และฟอร์มบันทึกยอดใหม่ = 2 วันก่อนวันนี้
// เพราะ "ยอดเงิน ณ วันที่" ใน My GPF มักย้อนหลังราว 2 วัน (ซันบอก 22 พ.ย.) — ไม่คิดข้ามวันหยุด ผู้ใช้แก้เองได้
const DATA_LAG_DAYS = 2;
const defaultDataDate = (now = new Date()) => todayIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - DATA_LAG_DAYS));

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

// ---------- คำถามเงินต้น F-09 (0.4.3 — ซันตัดสิน 22 พ.ย.: ไม่รีบถาม ไม่ถามทุกวัน) ----------
// "รอบที่พลาด" = จำนวนวันที่ 25 ที่ผ่านไปหลังเงินต้นเปลี่ยนครั้งล่าสุด นับถึงวันที่ 25 ของเดือนก่อนรายการ (ตาม C-5)
//   0 = ทันสมัย / 1 = พลาด 1 รอบ (ป้าย "อาจสูงเกินจริง" + กล่องเตือนในฟอร์ม ไม่เด้งถาม) / 2 ขึ้นไป = เด้งถาม ไม่เกินรอบละ 1 ครั้ง
const pad2 = n => String(n).padStart(2, '0');
function missedRounds(changedOn, recDate) {
  let [y, m] = recDate.split('-').map(Number), n = 0;
  for (;;) { m--; if (m === 0) { m = 12; y--; } if (`${y}-${pad2(m)}-${pad2(Calc.PAY_START)}` <= changedOn || n > 1200) return n; n++; }
}
// วันที่ 25 ของรอบถัดไป — กด "ไว้ทีหลัง" แล้วไม่ถามอีกจนถึงวันนี้
function nextPayDay(iso) {
  let [y, m, d] = iso.split('-').map(Number);
  if (d >= Calc.PAY_START) { m++; if (m === 13) { m = 1; y++; } }
  return `${y}-${pad2(m)}-${pad2(Calc.PAY_START)}`;
}
// ถามเฉพาะตอนบันทึกยอดใหม่ ที่จะเป็นรายการล่าสุด, เงินต้นพลาดตั้งแต่ 2 รอบ และไม่ได้กด "ไว้ทีหลัง" ในรอบนี้
function principalQuestion(state, rec, editing) {
  if (editing) return null;
  const records = state.records.concat([rec]);
  const r = Calc.compute({ records, yearEnds: state.yearEnds });
  if (r.latest.date !== rec.date || !r.principalNote) return null;
  const rounds = missedRounds(r.principalNote.sameSince, rec.date);
  if (rounds < 2) return null;
  const snooze = state.meta && state.meta.principalSnoozeUntil;
  if (snooze && rec.date < snooze) return null;
  return Object.assign({}, r.principalNote, { rounds });
}
// กล่องเตือนในฟอร์มบันทึกยอดใหม่ (ไม่เด้ง): ถ้าบันทึกวันที่ dateIso ด้วยเงินต้น pm/pg นี้ เงินต้นจะไม่ทันสมัยไหม
function principalHint(state, dateIso, pm, pg) {
  if (pm == null || pg == null || !dateIso) return null;
  const before = Calc.byDate(state.records).filter(r => r.date < dateIso);
  if (!before.length) return null;
  const hypo = { date: dateIso, v: before[before.length - 1].v, pm, pg, note: '' };
  const r = Calc.compute({ records: state.records.filter(x => x.date !== dateIso).concat([hypo]), yearEnds: state.yearEnds });
  if (r.latest.date !== dateIso || !r.principalNote) return null;
  return { sameSince: r.principalNote.sameSince, rounds: missedRounds(r.principalNote.sameSince, dateIso) };
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

// ---------- สมุดบันทึก: เงินนำส่ง / เปลี่ยนแผน / ออมเพิ่ม (F-13–F-15, Requirements v1.3 หัวข้อ 5.3) ----------
// หลัก: ผิดตามหลักตัวเลข → บันทึกไม่ได้ / ผิดเพดานของ กบข. (ทองคำ 25, ออมเพิ่ม 27) → บันทึกไม่ได้เช่นกัน
// (0.4.1 ซันตัดสิน 22 พ.ย.: My GPF ไม่ยอมให้เกินอยู่แล้ว ตัวเลขที่เกินจึงเป็นการพิมพ์ผิด — เดิม 0.4.0 เตือนแต่ยืนยันได้)
// สมุดไม่ใช้คำนวณ — ฟังก์ชันเหล่านี้ไม่แตะยอดเงินหรือยอดสิ้นปี
// วันละ 1 รายการต่อประเภท (ซันยืนยัน 21 พ.ย. 2569) → วันซ้ำพาไปแก้รายการเดิม (duplicateOf = id)
const ledgerDup = (state, type, date, editingId) =>
  (state.ledger || []).find(x => x.type === type && x.date === date && x.id !== editingId);
const cleanNote = t => String(t || '').trim();

// % เต็มจำนวน: '5' → 5 ; ว่าง → 0 เมื่อ emptyIsZero (ช่องในแผนผสม)
function parsePct(text, emptyIsZero) {
  const s = String(text == null ? '' : text).replace(/\s/g, '').replace(/%$/, '');
  if (s === '') return emptyIsZero ? { ok: true, value: 0 } : { ok: false, empty: true, why: 'กรุณากรอกอัตรา' };
  if (/^[-−]/.test(s)) return { ok: false, why: 'ติดลบไม่ได้' };
  if (/^\d*[.,]\d*$/.test(s) && /\d/.test(s)) return { ok: false, why: 'ใส่เป็นจำนวนเต็มเท่านั้น ไม่มีทศนิยม' };
  if (!/^\d+$/.test(s)) return { ok: false, why: 'กรอกเป็นตัวเลขเท่านั้น' };
  const v = Number(s);
  if (v > 100) return { ok: false, why: 'เกิน 100% ไม่ได้' };
  return { ok: true, value: v };
}

const goldWhy = () => `แผนทองคำเลือกได้ไม่เกิน ${Plans.GOLD_MAX}%`;
const savingWhy = () => `ออมเพิ่มได้ไม่เกิน ${Plans.SAVING_MAX}%`;
// ตรวจช่องเดียวระหว่างพิมพ์ (ใช้แสดงข้อความทันที) — คืน null ถ้าไม่มีปัญหา
function liveSaving(text) {
  if (String(text || '').trim() === '') return null;
  const r = parsePct(text, false); if (!r.ok) return r.why;
  return r.value > Plans.SAVING_MAX ? savingWhy() : null;
}
function liveMixPart(i, text) {
  const r = parsePct(text, true); if (!r.ok) return r.why;
  return Plans.MIX_PARTS[i] === Plans.GOLD && r.value > Plans.GOLD_MAX ? goldWhy() : null;
}

// เงินนำส่ง (F-13, AC-27): วันที่เงินเข้า + จำนวน (ยอดรวมช่องเดียว) + บันทึกเพิ่มเติม
function checkDeposit(state, f, { editingId = null, today }) {
  const errors = {};
  const dt = checkDate(f.d, f.m, f.y, today); if (!dt.ok) errors.date = dt.why;
  const a = parseMoney(f.a);
  if (!a.ok) errors.a = a.why; else if (a.value === 0) errors.a = 'จำนวนเงินต้องมากกว่า 0';
  if (Object.keys(errors).length) return { errors };
  const dup = ledgerDup(state, 'deposit', dt.iso, editingId);
  if (dup) return { errors: { date: 'มีเงินนำส่งวันที่นี้แล้ว' }, duplicateOf: dup.id };
  return { errors: {}, item: { type: 'deposit', date: dt.iso, a: a.value, note: cleanNote(f.note) } };
}

// เปลี่ยนแผน (F-14, AC-28): f.plan = ชื่อจากรายการ; f.other = ชื่อที่พิมพ์เอง; f['mix-0'..] = % ของแผนย่อย
function mixTotal(f) {
  return Plans.MIX_PARTS.reduce((s, _, i) => { const p = parsePct(f['mix-' + i], true); return s + (p.ok ? p.value : 0); }, 0);
}
function checkPlan(state, f, { editingId = null, today }) {
  const errors = {};
  const dt = checkDate(f.d, f.m, f.y, today); if (!dt.ok) errors.date = dt.why;
  const name = String(f.plan || '');
  const known = Plans.CURRENT.concat(Plans.CLOSED, [Plans.OTHER]);
  let item = null, total = null;
  if (!name) errors.plan = 'กรุณาเลือกแผน';
  else if (!known.includes(name)) errors.plan = 'ไม่พบแผนนี้ในรายชื่อ เลือกใหม่ หรือเลือก "แผนอื่น (พิมพ์เอง)"';
  else if (name === Plans.OTHER) {
    const t = String(f.other || '').trim().replace(/\s+/g, ' ');
    if (!t) errors.other = 'กรุณาพิมพ์ชื่อแผน';
    else if (t.length > 80) errors.other = 'ชื่อแผนยาวเกินไป (ไม่เกิน 80 ตัวอักษร)';
    else item = { plan: t, other: true };
  } else if (name === Plans.MIX) {
    const mix = []; total = 0; let partErr = false;
    Plans.MIX_PARTS.forEach((part, i) => {
      const p = parsePct(f['mix-' + i], true);
      if (!p.ok) { errors['mix-' + i] = p.why; partErr = true; return; }
      if (part === Plans.GOLD && p.value > Plans.GOLD_MAX) { errors['mix-' + i] = goldWhy(); partErr = true; return; }
      total += p.value; if (p.value > 0) mix.push({ plan: part, pct: p.value });
    });
    if (!partErr && total !== 100) errors.mix = total === 0 ? 'ใส่ % อย่างน้อย 1 แผน ให้รวมได้ 100%' : `ต้องรวมได้ 100% (ตอนนี้ ${total}%)`;
    item = { plan: name, mix };
  } else item = { plan: name };
  if (Object.keys(errors).length) return { errors, total };
  const dup = ledgerDup(state, 'plan', dt.iso, editingId);
  if (dup) return { errors: { date: 'มีการเปลี่ยนแผนวันที่นี้แล้ว' }, duplicateOf: dup.id, total };
  return { errors: {}, total, item: Object.assign({ type: 'plan', date: dt.iso }, item, { note: cleanNote(f.note) }) };
}

// ออมเพิ่ม (F-15, AC-29): อัตรา % ของเงินเดือน เต็มจำนวน; เกิน 27 → เตือนแต่ยืนยันได้
function checkSaving(state, f, { editingId = null, today }) {
  const errors = {};
  const dt = checkDate(f.d, f.m, f.y, today); if (!dt.ok) errors.date = dt.why;
  const r = parsePct(f.rate, false);
  if (!r.ok) errors.rate = r.why; else if (r.value > Plans.SAVING_MAX) errors.rate = savingWhy();
  if (Object.keys(errors).length) return { errors };
  const dup = ledgerDup(state, 'saving', dt.iso, editingId);
  if (dup) return { errors: { date: 'มีการออมเพิ่มวันที่นี้แล้ว' }, duplicateOf: dup.id };
  return { errors: {}, item: { type: 'saving', date: dt.iso, rate: r.value, note: cleanNote(f.note) } };
}

// รายการสมุดล่าสุดที่มีผลแล้ว (ไม่เกินวันนี้) ของแต่ละประเภท — ใช้กับ F-17
function latestLedger(state, type, today) {
  const xs = (state.ledger || []).filter(x => x.type === type && x.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  return xs.length ? xs[xs.length - 1] : null;
}

return { MONTHS, thaiDate, thaiDateShort, todayIso, defaultDataDate, DATA_LAG_DAYS, parseMoney, moneyInput, groupDigits, checkDate, checkBalance, principalQuestion, principalHint, missedRounds, nextPayDay, checkYearEnd,
         parsePct, mixTotal, liveSaving, liveMixPart, checkDeposit, checkPlan, checkSaving, latestLedger };
});

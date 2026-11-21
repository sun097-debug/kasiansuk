// ส่วนเก็บข้อมูลและไฟล์สำรอง — แอพเกษียณสุข
// ข้อมูลเก็บในเบราว์เซอร์ของเครื่องนี้เท่านั้น (localStorage) ไม่ส่งออกไปที่ใด (N-02)
// ไฟล์สำรองมีหมายเลขรุ่นของรูปแบบข้อมูล (N-06) — เก็บแค่รายการที่ผู้ใช้กรอก ไม่เก็บผลคำนวณ
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Store = api;
})(typeof self !== 'undefined' ? self : this, function () {

const KEY = 'kasiansuk.data';
const SCHEMA = 1;                       // รุ่นของรูปแบบข้อมูล — เพิ่มเมื่อเปลี่ยนโครงสร้าง
const FORMAT = 'kasiansuk-backup';      // ป้ายบอกว่าเป็นไฟล์สำรองของแอพนี้
const LEDGER_TYPES = ['deposit', 'plan', 'saving'];   // เงินนำส่ง / เปลี่ยนแผน / ออมเพิ่ม

function emptyState(nowIso) {
  return {
    schema: SCHEMA,
    records: [],     // บันทึกยอด: { date, v, pm, pg, note }  (pm/pg = null ถ้าข้ามเงินต้น)
    yearEnds: [],    // ยอดสิ้นปี:  { year, date, v, pm, pg }
    ledger: [],      // สมุด:       { id, type, date, ... }  ไม่ใช้คำนวณ
    meta: { createdAt: nowIso || null, lastBackupAt: null, changesSinceBackup: 0,
            bannerDismissedAt: null, bannerDismissedChanges: 0 },
  };
}

// ---------- ตรวจข้อมูล (ใช้ทั้งตอนเปิดแอพและตอนกู้คืน) ----------
const isIso = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && (() => {
  const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; })();
const isInt = x => Number.isInteger(x);
const isMoney = x => isInt(x) && x >= 0;

function checkData(d) {
  if (!d || typeof d !== 'object') return 'ไม่พบข้อมูลในไฟล์';
  for (const k of ['records', 'yearEnds', 'ledger']) if (!Array.isArray(d[k])) return 'ข้อมูลในไฟล์ไม่ครบ';
  const seen = new Set();
  for (const r of d.records) {
    if (!isIso(r.date) || !isMoney(r.v)) return 'มีรายการยอดเงินที่วันที่หรือจำนวนเงินไม่ถูกต้อง';
    if ((r.pm == null) !== (r.pg == null)) return 'มีรายการที่เงินต้นไม่ครบ 2 ช่อง';
    if (r.pm != null && (!isMoney(r.pm) || !isMoney(r.pg))) return 'มีรายการที่เงินต้นไม่ถูกต้อง';
    if (seen.has(r.date)) return 'มีรายการยอดเงินวันที่ซ้ำกัน'; seen.add(r.date);
  }
  const years = new Set();
  for (const e of d.yearEnds) {
    if (!isInt(e.year) || !isIso(e.date) || !isMoney(e.v) || !isMoney(e.pm) || !isMoney(e.pg)) return 'มียอดสิ้นปีที่ข้อมูลไม่ถูกต้อง';
    if (years.has(e.year)) return 'มียอดสิ้นปีของปีเดียวกันซ้ำ'; years.add(e.year);
  }
  // สมุด (0.4.0): ตรวจทุกช่องตามประเภท — รูปแบบข้อมูลยังเป็น schema 1 (ช่องเหล่านี้กำหนดไว้ตั้งแต่ช่วง A)
  //   deposit { id, type, date, a (สตางค์ > 0), note }
  //   plan    { id, type, date, plan (ชื่อ), other? (พิมพ์เอง), mix? [{ plan, pct }] รวม 100, note }
  //   saving  { id, type, date, rate (% เต็มจำนวน 0–100), note }
  const ids = new Set(), keys = new Set();
  for (const x of d.ledger) {
    if (!x || !LEDGER_TYPES.includes(x.type) || !isIso(x.date) || typeof x.id !== 'string' || !x.id || !isText(x.note) || !ledgerFieldsOk(x))
      return 'มีรายการในสมุดที่ข้อมูลไม่ถูกต้อง';
    if (ids.has(x.id)) return 'มีรายการในสมุดที่รหัสซ้ำกัน'; ids.add(x.id);
    const k = x.type + ' ' + x.date;
    if (keys.has(k)) return 'มีรายการในสมุดประเภทเดียวกันวันที่ซ้ำกัน'; keys.add(k);
  }
  return null;
}
const isText = x => x == null || typeof x === 'string';
function ledgerFieldsOk(x) {
  if (x.type === 'deposit') return isMoney(x.a) && x.a > 0;
  if (x.type === 'saving') return isInt(x.rate) && x.rate >= 0 && x.rate <= 100;
  if (typeof x.plan !== 'string' || !x.plan.trim()) return false;
  if (x.mix == null) return true;
  if (!Array.isArray(x.mix) || !x.mix.length) return false;
  let sum = 0;
  for (const p of x.mix) { if (!p || typeof p.plan !== 'string' || !isInt(p.pct) || p.pct < 1 || p.pct > 100) return false; sum += p.pct; }
  return sum === 100;
}

// ---------- อ่าน / เขียน ในเบราว์เซอร์ ----------
// storage = window.localStorage (ส่งเข้ามาเพื่อให้ทดสอบได้)
function load(storage) {
  let text;
  try { text = storage.getItem(KEY); }
  catch (e) { return { ok: false, why: 'เบราว์เซอร์ไม่ยอมให้อ่านข้อมูล (อาจเปิดโหมดส่วนตัวอยู่)' }; }
  if (text == null) return { ok: true, state: null };
  try {
    const st = JSON.parse(text);
    if (st.schema > SCHEMA) return { ok: false, why: 'ข้อมูลในเครื่องมาจากแอพรุ่นใหม่กว่า กรุณาโหลดหน้าใหม่' };
    const bad = checkData(st);
    if (bad) return { ok: false, why: bad };
    st.meta = Object.assign(emptyState().meta, st.meta || {});
    return { ok: true, state: st };
  } catch (e) { return { ok: false, why: 'ข้อมูลในเครื่องอ่านไม่ได้' }; }
}

// เขียนแล้วอ่านกลับมาเทียบ — ถ้าไม่ตรงถือว่าไม่สำเร็จ (AC-20)
function save(storage, state) {
  const text = JSON.stringify(state);
  try {
    storage.setItem(KEY, text);
    if (storage.getItem(KEY) !== text) return { ok: false, why: 'เก็บข้อมูลไม่สำเร็จ' };
    return { ok: true };
  } catch (e) {
    return { ok: false, why: 'เก็บข้อมูลไม่สำเร็จ (พื้นที่เต็ม หรือเบราว์เซอร์ไม่อนุญาต)' };
  }
}

// ---------- ไฟล์สำรอง ----------
function makeBackup(state, nowIso) {
  return JSON.stringify({
    format: FORMAT, schema: SCHEMA, app: 'เกษียณสุข', exportedAt: nowIso,
    data: { records: state.records, yearEnds: state.yearEnds, ledger: state.ledger },
  }, null, 1);
}

function summarize(d) {
  const years = new Set();
  d.records.forEach(r => years.add(+r.date.slice(0, 4)));
  d.yearEnds.forEach(e => years.add(e.year));
  d.ledger.forEach(x => years.add(+x.date.slice(0, 4)));
  const dates = d.records.map(r => r.date).concat(d.yearEnds.map(e => e.date), d.ledger.map(x => x.date)).sort();
  const n = t => d.ledger.filter(x => x.type === t).length;
  return { years: years.size, records: d.records.length, yearEnds: d.yearEnds.length,
           deposit: n('deposit'), plan: n('plan'), saving: n('saving'), latest: dates.length ? dates[dates.length - 1] : null };
}

// อ่านไฟล์สำรอง → ตรวจ → สรุป (ยังไม่แทนที่ข้อมูลในเครื่อง)
function parseBackup(text) {
  let f;
  try { f = JSON.parse(text); } catch (e) { return { ok: false, why: 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอพเกษียณสุข' }; }
  if (!f || f.format !== FORMAT) return { ok: false, why: 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอพเกษียณสุข' };
  if (!isInt(f.schema) || f.schema > SCHEMA) return { ok: false, why: 'ไฟล์นี้มาจากแอพรุ่นใหม่กว่า กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง' };
  const bad = checkData(f.data);
  if (bad) return { ok: false, why: bad };
  return { ok: true, data: f.data, summary: summarize(f.data), exportedAt: f.exportedAt || null };
}

// แทนที่ข้อมูลทั้งหมดด้วยข้อมูลจากไฟล์ (เรียกหลังผู้ใช้ยืนยันแล้วเท่านั้น)
function stateFromBackup(data, nowIso) {
  const st = emptyState(nowIso);
  st.records = data.records; st.yearEnds = data.yearEnds; st.ledger = data.ledger;
  st.meta.lastBackupAt = nowIso;   // เพิ่งกู้จากไฟล์ = มีไฟล์สำรองอยู่แล้ว
  return st;
}

return { KEY, SCHEMA, FORMAT, emptyState, checkData, load, save, makeBackup, parseBackup, summarize, stateFromBackup };
});

// ส่วนคำนวณ — แอพเกษียณสุข
// ย้ายจากโค้ดอ้างอิงขั้น Calculation (Calculation v1.0 อนุมัติ 19 พ.ย. 2569) — สูตรไม่เปลี่ยน
// สิ่งที่เปลี่ยนจากโค้ดอ้างอิง: ห่อให้ใช้ได้ทั้งในเบราว์เซอร์ (window.Calc) และใน Node (ชุดทดสอบ) เท่านั้น
//
// เงินทุกจำนวนเก็บเป็น "สตางค์จำนวนเต็ม" (1 บาท = 100) วันที่เก็บเป็น 'YYYY-MM-DD' (ค.ศ.)
// ชื่อช่องเงินต้น (ตั้งตามกล่องใน My GPF — ห้ามสลับ ดูชุดทดสอบ T27):
//   pm = เงินต้นของกล่อง "เงินสะสมของท่าน"
//   pg = เงินต้นของกล่อง "เงินจากภาครัฐ"
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof self !== 'undefined' ? self : this, function () {

// ป้ายของแต่ละกล่อง — ใช้ที่เดียวทั้งแอพ
const BOX = { pm: 'เงินสะสมของท่าน', pg: 'เงินจากภาครัฐ' };

const dayNum = iso => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const isoOf = n => new Date(n * 864e5).toISOString().slice(0, 10);
const yearOf = iso => +iso.slice(0, 4);
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad = n => String(n).padStart(2, '0');
const P = r => (r.pm == null ? null : r.pm + r.pg);          // เงินต้นรวม
const benefit = r => (P(r) == null ? null : r.v - P(r));    // ผลประโยชน์
const byDate = rs => rs.slice().sort((a, b) => dayNum(a.date) - dayNum(b.date));

// ---------- วางวันเงินเข้า (3 วิธีที่เทียบ — แอพใช้วิธี 1 monthEnd ตาม C-1) ----------
const METHODS = {
  // วิธี 1: แบ่งเท่า ๆ กันลงวันสิ้นเดือนในช่วง (นับเฉพาะเดือนของปีนี้)
  monthEnd(a, b, dP, Y) {
    const out = []; let [y, m] = a.date.split('-').map(Number);
    const by = yearOf(b.date), bm = +b.date.slice(5, 7);
    while (y < by || (y === by && m <= bm)) {
      const e = `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
      if (dayNum(e) > dayNum(a.date) && dayNum(e) <= dayNum(b.date) && yearOf(e) === Y) out.push(e);
      m++; if (m > 12) { m = 1; y++; }
    }
    if (!out.length) return [{ date: b.date, a: dP }];
    const base = Math.trunc(dP / out.length); let rem = dP - base * out.length;
    return out.map(d => { const x = base + (rem !== 0 ? Math.sign(rem) : 0); if (rem !== 0) rem -= Math.sign(rem); return { date: d, a: x }; });
  },
  midpoint(a, b, dP) { return [{ date: isoOf(Math.floor((dayNum(a.date) + dayNum(b.date)) / 2)), a: dP }]; },
  atRecord(a, b, dP) { return [{ date: b.date, a: dP }]; },
};

// ---------- Modified Dietz ----------
function dietz(B, V, flows, start, end) {
  const T = dayNum(end) - dayNum(start);
  if (T <= 0) return { ok: false, why: 'ช่วงวันที่สั้นเกินไป คำนวณ % ไม่ได้' };
  const sumC = flows.reduce((s, f) => s + f.a, 0);
  const G = V - B - sumC;
  const den = B + flows.reduce((s, f) => s + f.a * (dayNum(end) - dayNum(f.date)) / T, 0);
  if (den <= 0) return { ok: false, why: 'เงินในพอร์ตช่วงนี้ยังน้อยเกินกว่าจะคิดเป็น % ได้' };
  return { ok: true, pct: G / den * 100 };
}

// ---------- หาฐานของปี Y ----------
function baseFor(st, Y) {
  const ye = (st.yearEnds || []).find(e => e.year === Y - 1);
  if (ye) return { kind: ye.v === 0 ? 'zero' : 'yearEnd', date: ye.date, v: ye.v, pm: ye.pm, pg: ye.pg };
  return null;
}
function noBaseWhy(st, Y) {
  const hasOlder = st.records.some(r => yearOf(r.date) < Y) || (st.yearEnds || []).some(e => e.year < Y - 1);
  return hasOlder ? `รอยอดสิ้นปี ${Y - 1 + 543}` : 'ยังไม่มียอดสิ้นปีก่อน';
}

// ---------- ตัวเลขของปี สำหรับรายการ r ----------
function yearFigures(st, r, method = 'monthEnd') {
  const Y = yearOf(r.date);
  const base = baseFor(st, Y);
  if (!base) return { ok: false, why: noBaseWhy(st, Y), Y };
  if (P(r) == null) return { ok: false, why: 'ยังไม่มีเงินต้นของยอดล่าสุด', Y };
  const cm = r.pm - base.pm, cg = r.pg - base.pg;
  const profit = benefit(r) - (base.v - base.pm - base.pg);
  const pts = [base].concat(byDate(st.records).filter(x => yearOf(x.date) === Y && P(x) != null && dayNum(x.date) <= dayNum(r.date)));
  const flows = [];
  for (let i = 1; i < pts.length; i++) {
    const dP = P(pts[i]) - P(pts[i - 1]);
    if (dP !== 0) flows.push(...METHODS[method](pts[i - 1], pts[i], dP, Y));
  }
  const d = base.kind === 'zero' ? { ok: false, why: 'ปีแรกที่เป็นสมาชิก แอพคิด % ให้ไม่ได้ (ไม่รู้ว่าเริ่มส่งเงินเดือนไหน)' }
                                 : dietz(base.v, r.v, flows, base.date, r.date);
  return { ok: true, Y, base, contributed: { m: cm, g: cg, total: cm + cg }, profit, pct: d.ok ? d.pct : null, pctWhy: d.ok ? null : d.why, flows };
}

// ---------- ตัวเลขทั้งหมด (คำนวณใหม่ทั้งหมดจากรายการที่เก็บไว้ทุกครั้ง) ----------
function compute(st, method = 'monthEnd') {
  const recs = byDate(st.records);
  if (!recs.length) return { empty: true };
  const L = recs[recs.length - 1];
  const out = { latest: L, benefit: benefit(L) };
  const pp = prevPoint(st, recs, L, false);
  out.dV = pp ? { amount: L.v - pp.v, vs: pp.date, yearEnd: pp.yearEnd || null } : null;
  out.year = yearFigures(st, L, method);
  out.principalNote = principalNote(recs, L);
  const withP = recs.filter(r => P(r) != null);
  if (withP.length && P(L) != null) {
    let i = withP.length - 1; while (i > 0 && P(withP[i - 1]) === P(L)) i--;
    out.principalSince = withP[i].date;
  }
  out.history = recs.slice().reverse().map(r => historyRow(st, recs, r, method));
  out.graph = graph(st, recs);
  return out;
}

// ---------- เงินต้นไม่ทันสมัย (C-5) ----------
const PAY_START = 25;   // รอบเงินเข้าเริ่มวันที่ 25 — ค่าเดียว แก้ได้ที่นี่
function principalNote(recs, L) {
  if (P(L) == null) return null;
  let changedOn = null, prevPv = null;
  for (const x of recs.filter(x => P(x) != null && dayNum(x.date) <= dayNum(L.date))) {
    if (prevPv === null || P(x) !== prevPv) changedOn = x.date;
    prevPv = P(x);
  }
  let y = yearOf(L.date), m = +L.date.slice(5, 7) - 1; if (m === 0) { m = 12; y--; }
  const lastWindowStart = `${y}-${pad(m)}-${pad(PAY_START)}`;
  if (dayNum(changedOn) >= dayNum(lastWindowStart)) return null;
  const mon = iso => yearOf(iso) * 12 + +iso.slice(5, 7);
  return { sameSince: changedOn, months: mon(L.date) - mon(changedOn) };
}

// "ครั้งก่อน" (C-4): จุดที่ใกล้ที่สุดก่อนรายการ r นับทั้งรายการบันทึกยอดและยอดสิ้นปี
function prevPoint(st, recs, r, needP) {
  const earlierRecs = recs.filter(x => dayNum(x.date) < dayNum(r.date));
  if (!earlierRecs.length) return null;
  const cands = earlierRecs.map(x => ({ date: x.date, v: x.v, p: P(x), rec: true }))
    .concat((st.yearEnds || []).filter(e => e.v !== 0 && dayNum(e.date) < dayNum(r.date))
      .map(e => ({ date: e.date, v: e.v, p: e.pm + e.pg, yearEnd: e.year })))
    .filter(c => !needP || c.p != null)
    .sort((a, b) => dayNum(a.date) - dayNum(b.date) || (a.rec ? 1 : -1));
  return cands.length ? cands[cands.length - 1] : null;
}

function historyRow(st, recs, r, method) {
  const pp = prevPoint(st, recs, r, false), ppP = prevPoint(st, recs, r, true);
  const row = { date: r.date, v: r.v, principal: P(r), benefit: benefit(r) };
  row.dV = pp ? { amount: r.v - pp.v, vs: pp.date, yearEnd: pp.yearEnd || null } : null;
  row.principalUp = (P(r) != null && ppP) ? { amount: P(r) - ppP.p, vs: ppP.date, yearEnd: ppP.yearEnd || null, skipped: !pp || ppP.date !== pp.date } : null;
  const yf = yearFigures(st, r, method);
  row.yearProfit = yf.ok ? yf.profit : null; row.yearWhy = yf.ok ? null : yf.why;
  return row;
}

function graph(st, recs) {
  const pts = recs.map(r => ({ date: r.date, v: r.v, p: P(r) }))
    .concat((st.yearEnds || []).map(e => ({ date: e.date, v: e.v, p: e.pm + e.pg, yearEnd: e.year })));
  return pts.sort((a, b) => dayNum(a.date) - dayNum(b.date) || (a.yearEnd ? -1 : 1));
}

// ---------- การแสดงผล ----------
const fmtMoney = s => { const neg = s < 0; const a = Math.abs(s); const b = Math.floor(a / 100), st = a % 100;
  return (neg ? '−' : '') + b.toLocaleString('en-US') + '.' + pad(st); };
const fmtSigned = s => (s > 0 ? '+' : '') + fmtMoney(s);
const fmtPct = p => { const r = Math.round(Math.abs(p) * 100) / 100 * Math.sign(p);
  const t = Math.abs(r).toFixed(2); return (r < 0 && t !== '0.00' ? '−' : '') + t + '%'; };
const baht = x => Math.round(x * 100);

return { BOX, dayNum, isoOf, yearOf, METHODS, dietz, yearFigures, compute, principalNote, byDate,
         fmtMoney, fmtSigned, fmtPct, baht, P, PAY_START };
});

// หน้าจอของแอพเกษียณสุข — รุ่น 0.4.2 (ลายจุดระดับกลาง + กติกาชวนสำรองใหม่) · 0.4.1 (แก้ตามที่ซันลอง 0.4.0 รอบ 4) · ก่อนหน้า 0.4.0 (สมุด 3 หน้า), 0.3.2, 0.3.1, 0.2.0
// หน้าที่มีในรุ่นนี้: เริ่มใช้, หน้าหลัก (+ กราฟ + สรุปสมุด), เมนูบันทึก, บันทึกยอด/แก้, ยอดสิ้นปี,
// จดเงินนำส่ง / จดการเปลี่ยนแผน / จดการออมเพิ่ม (ไม่ใช้คำนวณ), ประวัติ (ทุกประเภท + ตัวกรอง),
// สำรองข้อมูล (สำรอง / กู้คืน / ข้อความสำคัญ)
(function () {
'use strict';
const { BOX, compute, fmtMoney, fmtSigned, fmtPct, P, byDate, dayNum } = Calc;
const { thaiDate, thaiDateShort, todayIso, moneyInput, groupDigits, MONTHS } = Forms;
const VERSION = '0.4.2';
const app = document.getElementById('app');

let state = null;          // ข้อมูลทั้งหมดในเครื่อง (null = ยังไม่เคยใช้)
let loadError = null;      // อ่านข้อมูลเดิมไม่ได้ → ห้ามเขียนทับเอง
let draft = null;          // ค่าที่กำลังกรอกในฟอร์ม (เก็บไว้เมื่อต้องแสดงข้อผิดพลาด)
let pendingRestore = null; // ไฟล์สำรองที่ตรวจแล้ว รอผู้ใช้ยืนยัน
let chartRange = 'year';

// ---------- เครื่องมือเล็ก ๆ ----------
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => todayIso();
const nowStamp = () => new Date().toISOString();
const be = y => y + 543;
const go = h => { if (location.hash === h) render(); else location.hash = h; };

const triUp = c => `<svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true"><polygon points="6,0 12,10 0,10" fill="${c}"></polygon></svg>`;
const triDown = c => `<svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true"><polygon points="0,0 12,0 6,10" fill="${c}"></polygon></svg>`;
// ขึ้น/ลง บอก 3 ทาง: สามเหลี่ยม + เครื่องหมาย + สี (UX 5.8) — ศูนย์ไม่มีสามเหลี่ยม
const signed = (s, txt) => s > 0 ? `<span class="up num">${triUp('#1F7A4D')} ${txt}</span>` : s < 0 ? `<span class="down-t num">${triDown('#B2413A')} ${txt}</span>` : `<span class="num">${txt}</span>`;

const LOGO = (w = 42, h = 44, label = true) => `<svg width="${w}" height="${h}" viewBox="0 0 42 44" ${label ? 'role="img" aria-label="โลโก้สมุดเกษียณสุข"' : 'aria-hidden="true"'}>
  <rect x="6" y="4" width="28" height="36" rx="6" fill="#CFE9DC"></rect><rect x="10" y="4" width="3" height="36" fill="#B2DCC7"></rect>
  <circle cx="24" cy="18" r="6" fill="#FFC9AE"></circle><ellipse cx="22" cy="31" rx="7" ry="3.5" fill="#8FCFB1" transform="rotate(-20 22 31)"></ellipse></svg>`;
// พระอาทิตย์ + เมฆฟ้า 2 ก้อน (แทนใบไม้ — ซันยืนยัน 20 พ.ย. 2569)
const cloud = (x, y, k, c) => `<g transform="translate(${x} ${y}) scale(${k})" fill="${c}"><circle cx="10" cy="10" r="8"></circle><circle cx="20" cy="7" r="10"></circle><circle cx="30" cy="11" r="7"></circle><rect x="4" y="10" width="30" height="8" rx="4"></rect></g>`;
const SUN = `<svg class="art" width="78" height="56" viewBox="0 0 78 56" aria-hidden="true"><circle cx="46" cy="22" r="17" fill="#FFD9C4"></circle>${cloud(2, 30, 0.95, '#CFE6F5')}${cloud(42, 36, 0.7, '#BFDDF2')}</svg>`;
const BACK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg>';

const IMPORTANT_3 = ['ไม่ใช่คำแนะนำการลงทุน', 'ไม่ใช่บริการทางการของ กบข.', 'ข้อมูลอยู่ในเครื่องคุณเท่านั้น ไม่ส่งออกไปที่ใด'];
const IMPORTANT_MORE = ['ตัวเลขทั้งหมดคุณกรอกเองจาก My GPF ของ กบข.', 'ผลคำนวณใช้ประกอบการตัดสินใจเท่านั้น'];


// ---------- เพิ่มไปหน้าจอโฮม (0.2.0 — ซันอยากให้ผู้ใช้ใช้แบบไอคอน) ----------
const isStandalone = () => (window.navigator.standalone === true) || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Safari จริง (ไม่ใช่ Chrome / Firefox / Edge บน iPhone ซึ่งใช้ป้าย CriOS / FxiOS / EdgiOS) — 0.4.1
const isIOSSafari = () => isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
const INSTALL_KEY = 'kasiansuk.installHidden';
const installHidden = () => { try { return localStorage.getItem(INSTALL_KEY) === '1'; } catch (e) { return false; } };
function installCard(dismissible) {
  if (isStandalone()) return '';
  if (dismissible && installHidden()) return '';
  // 0.4.1: ไม่พูดถึง Safari กับคนที่ไม่ได้ใช้ Safari (ซัน 22 พ.ย. — คนใช้ Android/Chrome จะงง)
  const steps = isIOS()
    ? `<li>แตะปุ่มแชร์${isIOSSafari() ? 'ของ Safari' : ''} (สี่เหลี่ยมมีลูกศรชี้ขึ้น — ถ้าไม่เห็น แตะ ••• ก่อน)</li><li>เลื่อนหา <b>เพิ่มไปยังหน้าจอโฮม</b> (Add to Home Screen)</li><li>แตะ <b>เพิ่ม</b> แล้วเปิดแอพจากไอคอนเกษียณสุข</li>`
    : `<li>แตะเมนูของเบราว์เซอร์ (⋮ มุมขวาบน)</li><li>เลือก <b>เพิ่มไปยังหน้าจอหลัก</b> หรือ <b>ติดตั้งแอพ</b></li><li>เปิดแอพจากไอคอนเกษียณสุข</li>`;
  const hasData = state && (state.records.length || state.yearEnds.length || state.ledger.length);
  return `<section class="install" aria-labelledby="install-h">
    <div class="install-head"><h2 id="install-h">ใช้แบบไอคอนบนหน้าจอโฮม</h2>${dismissible ? '<button type="button" class="icon-btn" id="hide-install" aria-label="ปิดกล่องแนะนำ">✕</button>' : ''}</div>
    <p>เปิดง่ายเหมือนแอพ และเสี่ยงข้อมูลหายน้อยกว่าเปิดในเบราว์เซอร์${isIOSSafari() ? ' (Safari อาจลบข้อมูลของเว็บที่ไม่ได้เปิดนานเกิน 7 วัน)' : ''}</p>
    <ol>${steps}</ol>
    ${hasData ? '<p><b>ข้อมูลที่จดในเบราว์เซอร์จะไม่ตามไปที่ไอคอน</b> — สำรองข้อมูลก่อน แล้วกู้คืนในแอพที่เปิดจากไอคอน <a href="#/data">ไปสำรอง</a></p>' : ''}
  </section>`;
}
function bindInstall() {
  const b = app.querySelector('#hide-install');
  if (b) b.addEventListener('click', () => { try { localStorage.setItem(INSTALL_KEY, '1'); } catch (e) {} const c = app.querySelector('.install'); if (c) c.remove(); });
}

// ---------- เก็บข้อมูล ----------
function persist(next, okMsg) {
  const res = Store.save(localStorage, next);
  if (!res.ok) { showAlert(res.why + ' — ข้อมูลยังไม่ถูกบันทึก ลองอีกครั้ง'); return false; }
  state = next;
  if (okMsg) toast(okMsg);
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ไม่เป็นไร */ }
  return true;
}
const clone = o => JSON.parse(JSON.stringify(o));
function changed(st) { st.meta.changesSinceBackup = (st.meta.changesSinceBackup || 0) + 1; return st; }

// ---------- ข้อความชั่วคราว / แผ่นเลื่อนขึ้น ----------
function toast(msg) {
  document.querySelectorAll('.toast').forEach(x => x.remove());   // ทีละข้อความ ไม่ซ้อนกัน
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
function showAlert(msg) {
  const box = document.getElementById('form-alert');
  if (box) { box.hidden = false; box.textContent = msg; box.focus(); } else toast(msg);
}
function openSheet(html, onReady) {
  closeSheet();
  const wrap = document.createElement('div'); wrap.className = 'sheet-wrap'; wrap.id = 'sheet';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) closeSheet(); });
  wrap.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  document.body.appendChild(wrap);
  const sh = wrap.querySelector('.sheet'); sh.focus();
  if (onReady) onReady(sh);
}
function closeSheet() { const s = document.getElementById('sheet'); if (s) s.remove(); }

// คำช่วยหาข้อมูล (F-07) — ข้อความเส้นทาง ไม่ใช้ภาพหน้าจอ My GPF
const HELP = {
  balance: `<h2>ดูได้จากไหนใน My GPF</h2>
    <ol><li>เปิดแอพ My GPF แตะ <b>My Account</b> (เมนูด้านล่าง)</li>
    <li>แตะ <b>ยอดเงิน กบข.</b> (ด้านบน)</li>
    <li><b>วันที่ข้อมูล</b> อยู่ตรง "ยอดเงิน ณ วันที่ ..."</li>
    <li><b>ยอดเงิน</b> คือตัวเลข "รวมเงินทั้งสิ้น"</li>
    <li>เลื่อนลงจะเห็น 2 กล่อง <b>"${BOX.pm}"</b> และ <b>"${BOX.pg}"</b> แต่ละกล่องมีบรรทัด "เงินต้น" และ "ผลประโยชน์" — กรอกเฉพาะบรรทัด <b>เงินต้น</b> ของแต่ละกล่อง</li></ol>`,
  yearend: `<h2>ยอดสิ้นปีดูได้จากไหน</h2>
    <ol><li>My GPF → <b>My Account</b> → <b>ยอดเงิน กบข.</b></li>
    <li>เลื่อนลง แตะ <b>ดูยอดเงินย้อนหลังรายปี</b> แล้วเลือกปี</li>
    <li>กรอกวันที่ ยอดเงิน และเงินต้นของ 2 กล่องตามที่แสดง</li></ol>
    <p class="small muted" style="margin:0">หรือใช้ใบแจ้งยอดสิ้นปีจาก กบข. ก็ได้</p>`,
  deposit: `<h2>เงินนำส่งดูได้จากไหน</h2>
    <ol><li>My GPF → <b>My Account</b> → <b>ยอดเงิน กบข.</b></li>
    <li>เลื่อนลง แตะ <b>รายการเคลื่อนไหวบัญชี</b></li>
    <li>ใส่ยอดรวมของบรรทัด <b>"เงินนำส่ง"</b> — ไม่ต้องแยกเงินสะสม / เงินสมทบ / เงินสะสมส่วนเพิ่ม / เงินชดเชย</li></ol>`,
  // 0.4.1: เส้นทางจากซัน (ผู้ใช้ยืนยันแล้ว 22 พ.ย. 2569 ดูใน My GPF)
  plan: `<h2>การเปลี่ยนแผนดูได้จากไหน</h2>
    <ol><li>My GPF → <b>My Account</b> → <b>ยอดเงิน กบข.</b></li>
    <li>เลื่อนลง แตะ <b>แผนการลงทุน</b></li>
    <li>แตะ <b>ประวัติ</b> (มุมขวาบน)</li>
    <li>ใช้วันที่ตรง <b>"ได้มูลค่าหน่วยลงทุนวันที่"</b> และชื่อแผน (แผนผสมสัดส่วนเอง: ใส่ % ของแต่ละแผนตามที่แสดง)</li></ol>`,
  saving: `<h2>การออมเพิ่มดูได้จากไหน</h2>
    <ol><li>My GPF → <b>My Account</b> → <b>ยอดเงิน กบข.</b></li>
    <li>เลื่อนลง แตะ <b>เปลี่ยนแปลงอัตราการออมเพิ่ม</b></li>
    <li>แตะ <b>ประวัติ</b> (มุมขวาบน)</li>
    <li>ใช้วันที่ตรง <b>"วันที่มีผล"</b> และอัตรา %</li></ol>`,
  pct: `<h2>% ของแอพต่างจาก My GPF อย่างไร</h2>
    <p style="margin:0">ของแอพ = ผลตอบแทนตั้งแต่ 1 ม.ค. ถึงวันที่ข้อมูล</p>
    <p style="margin:0">ของ My GPF = อัตราเฉลี่ยต่อปีหลายปี อัปเดตสัปดาห์ละครั้ง ตัวเลขจึงไม่เท่ากัน</p>
    <p style="margin:0">แอพไม่รู้วันที่เงินเข้าแน่นอน จึงถือว่าเงินเข้าปลายเดือน ตัวเลขจึงเป็นค่าประมาณ</p>`,
};
const helpNote = '<p class="xsmall muted" style="margin:0">ชื่อเมนูอาจเปลี่ยนเมื่อ My GPF อัปเดต</p><button type="button" class="btn btn-soft" data-close>ปิด</button>';
function openHelp(key) { openSheet(HELP[key] + (key === 'pct' ? '<button type="button" class="btn btn-soft" data-close>ปิด</button>' : helpNote)); }

// ---------- ส่วนประกอบของฟอร์ม ----------
function dateFields(id, iso, err, legend, hint) {
  const [y, m, d] = (iso || today()).split('-').map(Number);
  const nowY = new Date().getFullYear();
  let days = '', months = '', years = '';
  for (let i = 1; i <= 31; i++) days += `<option value="${i}"${i === d ? ' selected' : ''}>${i}</option>`;
  MONTHS.forEach((t, i) => { months += `<option value="${i + 1}"${i + 1 === m ? ' selected' : ''}>${t}</option>`; });
  for (let yy = nowY; yy >= 1997; yy--) years += `<option value="${be(yy)}"${yy === y ? ' selected' : ''}>${be(yy)}</option>`;
  const inv = err ? ' aria-invalid="true"' : '';
  return `<fieldset class="field"><legend>${legend}</legend>
    <div class="date3">
      <select id="${id}-d" name="d" aria-label="วัน"${inv}>${days}</select>
      <select id="${id}-m" name="m" aria-label="เดือน"${inv}>${months}</select>
      <select id="${id}-y" name="y" aria-label="ปี พ.ศ."${inv}>${years}</select>
    </div>${hint ? `<span class="hint">${hint}</span>` : ''}${err ? `<span class="err" id="${id}-err">${esc(err)}</span>` : ''}</fieldset>`;
}
function moneyField(name, label, value, err, hint, opt) {
  return `<div class="field"><label for="f-${name}">${label}${opt ? ` <span class="opt">${opt}</span>` : ''}</label>
    <input type="text" id="f-${name}" name="${name}" inputmode="decimal" autocomplete="off" data-money value="${esc(groupDigits(value))}"${err ? ' aria-invalid="true" aria-describedby="e-' + name + '"' : ''}>
    ${hint ? `<span class="hint">${hint}</span>` : ''}${err ? `<span class="err" id="e-${name}">${esc(err)}</span>` : ''}</div>`;
}
const readForm = form => Object.fromEntries(new FormData(form).entries());
const isoFromDraft = dr => (dr && dr.y ? `${+dr.y - 543}-${String(dr.m).padStart(2, '0')}-${String(dr.d).padStart(2, '0')}` : null);
function focusFirstError() { const el = app.querySelector('[aria-invalid="true"], .err, .warn-box'); if (el) { el.scrollIntoView({ block: 'center' }); if (el.focus) el.focus(); } }

// ---------- แถบล่าง ----------
function tabbar(cur) {
  const item = (k, href, icon, label) => `<a href="${href}"${cur === k ? ' aria-current="page"' : ''}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>${label}</a>`;
  return `<nav class="tabbar" aria-label="เมนูหลัก"><div class="tabbar-in">
    ${item('home', '#/home', '<path d="M3 11l9-7 9 7"></path><path d="M5 10v10h14V10"></path>', 'หน้าหลัก')}
    ${item('record', '#/record', '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"></path>', 'บันทึก')}
    ${item('history', '#/history', '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>', 'ประวัติ')}
    ${item('data', '#/data', '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"></path>', 'สำรองข้อมูล')}
  </div></nav>`;
}
function pageHead(title, back, backLabel, sub, notebook) {
  return `<header class="page-head">${back ? `<a class="back" href="${back}">${BACK_ICON}${backLabel}</a>` : ''}
    <div class="brand">${notebook ? LOGO(34, 36, false) : ''}<h1>${title}</h1></div>${sub ? `<span class="small muted">${sub}</span>` : ''}</header>`;
}
// ใส่ลูกน้ำระหว่างพิมพ์ โดยให้เคอร์เซอร์อยู่ตำแหน่งเดิม (นับตัวเลขก่อนเคอร์เซอร์)
function bindMoneyInputs() {
  app.querySelectorAll('input[data-money]').forEach(el => el.addEventListener('input', () => {
    const before = el.value, pos = el.selectionStart == null ? before.length : el.selectionStart;
    const keep = before.slice(0, pos).replace(/[^\d.]/g, '').length;
    const out = groupDigits(before);
    if (out === before) return;
    el.value = out;
    let n = 0, p = 0; while (p < out.length && n < keep) { if (/[\d.]/.test(out[p])) n++; p++; }
    try { el.setSelectionRange(p, p); } catch (e) { /* บางเครื่องไม่รองรับ */ }
  }));
}
function view(html, tab) {
  closeSheet();
  app.innerHTML = html + (tab ? tabbar(tab) : '');
  bindMoneyInputs();
  app.classList.toggle('has-nav', !!tab);
  document.body.classList.toggle('has-nav', !!tab);
  window.scrollTo(0, 0);
}

// =====================================================================
// เริ่มใช้ (F-01, AC-01, AC-03, AC-24)
// =====================================================================
function renderStart(errors = {}) {
  const dr = draft || {};
  view(`<header class="app-head"><div class="brand">${LOGO(50, 52)}<div><span class="brand-name">เกษียณสุข</span><span class="brand-sub">สมุดบันทึกเงิน กบข. ของคุณ</span></div></div>${SUN}</header>
  <main>
    ${installCard(false)}
    <section class="card">
      <h1 class="card-title" style="font-size:22px">ยินดีต้อนรับ</h1>
      <p style="margin:0">บอกกำไรปีนี้ของ กบข. แยกจากเงินที่ส่งเข้าไป</p>
      <div class="important"><b>ข้อความสำคัญ</b><ul>${IMPORTANT_3.map(t => `<li>${t}</li>`).join('')}</ul></div>
    </section>
    <section class="card">
      <h2 class="card-title">บันทึกยอดครั้งแรก</h2>
      <button type="button" class="link-btn" data-help="balance">ดูได้จากไหนใน My GPF</button>
      <div id="form-alert" class="alert" role="alert" tabindex="-1" hidden></div>
      <form id="start-form" novalidate>
        ${dateFields('date', isoFromDraft(dr) || today(), errors.date, 'วันที่ข้อมูลจาก กบข.', 'ใช้วันที่ตรง "ยอดเงิน ณ วันที่" ไม่ใช่วันที่กรอก')}
        ${moneyField('v', 'ยอดเงิน (บาท)', dr.v || '', errors.v, 'ตัวเลข "รวมเงินทั้งสิ้น"')}
        ${moneyField('pm', `${BOX.pm} · เงินต้น`, dr.pm || '', errors.pm, 'กรอกเฉพาะบรรทัดเงินต้น ไม่ใช่ผลประโยชน์', 'ข้ามได้')}
        ${moneyField('pg', `${BOX.pg} · เงินต้น`, dr.pg || '', errors.pg, null, 'ข้ามได้')}
        <p class="hint" style="margin:0">เงินต้นกรอกครบทั้ง 2 ช่อง หรือเว้นทั้ง 2 ช่องไว้เติมทีหลังก็ได้</p>
        <button type="submit" class="btn btn-primary">บันทึกและไปหน้าหลัก</button>
      </form>
    </section>
    <p class="small" style="text-align:center;margin:0">มีไฟล์สำรองอยู่แล้ว? <a href="#/data">กู้คืนจากไฟล์สำรอง</a></p>
  </main>`, null);
  bindHelp(); bindInstall();
  app.querySelector('#start-form').addEventListener('submit', e => {
    e.preventDefault();
    draft = readForm(e.target);
    // ใช้ข้อมูลเดิมถ้ามี (เช่น มียอดสิ้นปีแล้วแต่ลบยอดเงินหมด) ไม่เริ่มใหม่ทับ
    const next = state ? clone(state) : Store.emptyState(nowStamp());
    const r = Forms.checkBalance(next, draft, { today: today() });
    if (Object.keys(r.errors).length) { renderStart(r.errors); focusFirstError(); return; }
    next.records.push(r.rec); changed(next);
    if (persist(next, 'บันทึกแล้ว')) { draft = null; go('#/home'); }
  });
}

// =====================================================================
// หน้าหลัก (F-04, F-09, F-10, AC-05, AC-09, AC-11–15, AC-26)
// =====================================================================
function backupBannerNeeded() {
  if (!state || !state.records.length) return false;
  return Store.backupNudge(state.meta, nowStamp()).show;   // กติกา 0.4.2 อยู่ใน store.js
}

function renderHome() {
  const r = compute(state);
  const L = r.latest, yf = r.year, Y = yf.Y;
  const curY = new Date().getFullYear();
  const yw = Y === curY ? 'ปีนี้' : `ปี ${be(Y)}`;
  const hasBase = state.yearEnds.some(e => e.year === Y - 1);
  const steps = [];
  if (!hasBase) steps.push(`<li><a href="#/record/yearend?y=${Y - 1}"><span class="dot" aria-hidden="true"></span>เติมยอดสิ้นปี ${be(Y - 1)}</a></li>`);
  if (L.pm == null) steps.push(`<li><a href="#/record/balance/${L.date}"><span class="dot" aria-hidden="true"></span>เติมเงินต้นของยอดล่าสุด (${thaiDate(L.date)})</a></li>`);

  // ยอดเปลี่ยนจากครั้งก่อน
  let change;
  if (!r.dV) change = `<div class="change"><span>ยอดเปลี่ยนจากครั้งก่อน</span><span class="muted">ยังไม่มีครั้งก่อนให้เทียบ</span></div>`;
  else {
    const a = r.dV.amount;
    change = `<div class="change ${a > 0 ? 'is-up' : a < 0 ? 'is-down' : ''}"><span>ยอดเปลี่ยนจากครั้งก่อน</span><b>${signed(a, fmtSigned(a) + ' บาท')}</b></div>
      <span class="xsmall muted" style="padding-left:4px">${r.dV.yearEnd ? `เทียบยอดสิ้นปี ${be(r.dV.yearEnd)}` : `เทียบกับ ${thaiDate(r.dV.vs)}`}</span>`;
  }

  // การ์ดปีนี้
  let yearCard;
  if (!yf.ok) {
    const fix = yf.why === 'ยังไม่มีเงินต้นของยอดล่าสุด'
      ? `<a class="btn btn-soft" href="#/record/balance/${L.date}">เติมเงินต้นของยอดล่าสุด</a>`
      : `<a class="btn btn-soft" href="#/record/yearend?y=${Y - 1}">เติมยอดสิ้นปี ${be(Y - 1)}</a>`;
    yearCard = `<div class="empty-why"><span>ยังแสดงไม่ได้: ${esc(yf.why)}</span>${fix}</div>`;
  } else {
    const p = yf.profit, loss = p < 0;
    const note = r.principalNote;
    const pctTile = yf.pct != null
      ? `<span class="tile-value">${signed(Math.round(yf.pct * 100), fmtPct(yf.pct))}</span><span class="tile-sub">ประมาณ</span>`
      : `<span class="tile-why">${esc(yf.pctWhy)}</span>`;
    const pctDown = yf.pct != null && fmtPct(yf.pct).startsWith('−');
    const diff = L.v - yf.base.v;
    yearCard = `
      <div class="tiles">
        <div class="tile${loss ? ' down' : ''}"><span class="tile-label">${loss ? 'ขาดทุน' : 'กำไร'}${yw}</span>
          <span class="tile-value">${signed(p, fmtMoney(p))}</span><span class="tile-sub">บาท${note ? ' · <span class="tag tag-warn">อาจสูงเกินจริง</span>' : ''}</span></div>
        <div class="tile${pctDown ? ' down' : ''}"><span class="tile-label">ผลตอบแทน${yw}</span>${pctTile}</div>
      </div>
      ${note ? `<a class="note-line" href="#/record/balance/${L.date}">เงินต้นอาจยังไม่รวมเงินนำส่งรอบล่าสุด (ไม่เปลี่ยนตั้งแต่ ${thaiDate(note.sameSince)}) — แตะเพื่อแก้เงินต้น</a>` : ''}
      <button type="button" class="link-btn" data-help="pct">ต่างจาก My GPF อย่างไร</button>
      <div class="split">
        <div class="row"><span>เงินที่ส่งเข้าไป${yw}</span><b class="num">${fmtMoney(yf.contributed.total)} บาท</b></div>
        <div class="row sub"><span>${BOX.pm}</span><span class="num">${fmtMoney(yf.contributed.m)} บาท</span></div>
        <div class="row sub"><span>${BOX.pg}</span><span class="num">${fmtMoney(yf.contributed.g)} บาท</span></div>
      </div>
      <details class="why"><summary>${loss ? 'ขาดทุนมาจากไหน?' : 'กำไรมาจากไหน?'}</summary>
        <p class="explain">ยอดเงิน${diff < 0 ? 'ลดลง' : 'เพิ่ม'}จากสิ้นปี ${be(Y - 1)} <span class="num">${fmtMoney(Math.abs(diff))}</span> บาท = เงินที่ส่งเข้าไป <span class="num">${fmtMoney(yf.contributed.total)}</span> + ${loss ? 'ขาดทุน' : 'กำไร'} <span class="num">${fmtMoney(p)}</span></p>
        <p class="small muted" style="margin:6px 0 0">ยอดเงินที่เพิ่มขึ้นไม่ได้เป็นกำไรทั้งหมด ส่วนหนึ่งคือเงินที่คุณและรัฐส่งเข้าไปเอง</p>
      </details>
      ${r.principalSince ? `<span class="xsmall muted">เงินต้นอัปเดตล่าสุด ${thaiDate(r.principalSince)}</span>` : ''}`;
  }

  view(`<header class="app-head"><div class="brand">${LOGO(50, 52)}<div><span class="brand-name">เกษียณสุข</span><span class="brand-sub">สมุดบันทึกเงิน กบข. ของคุณ</span></div></div>${SUN}</header>
  <main>
    ${installCard(true)}
    ${backupBannerNeeded() ? `<div class="banner" role="note"><p>สำรองข้อมูลไว้กันหาย <a href="#/data">ไปสำรอง</a></p><button type="button" class="icon-btn" id="hide-banner" aria-label="ปิดแถบชวนสำรอง">✕</button></div>` : ''}
    <section class="card" style="gap:4px">
      <span class="card-kicker">วันนี้ในสมุด</span>
      <span class="small muted">ยอดเงิน</span>
      <div class="big-money num">${fmtMoney(L.v)}<span class="unit">บาท</span></div>
      <span class="small muted">ข้อมูลวันที่ ${thaiDate(L.date)}</span>
      ${ledgerSummaryLine()}
      <div style="margin-top:10px">${change}</div>
    </section>
    ${steps.length ? `<section class="card"><h2 class="card-title">อีก ${steps.length} ขั้นเพื่อดูกำไร${yw}</h2><ul class="checklist">${steps.join('')}</ul></section>` : ''}
    <section class="card" style="gap:14px">
      <div class="row"><h2 class="card-title">${yw}</h2><span class="xsmall muted">คำนวณถึง ${thaiDate(L.date)}</span></div>
      ${yearCard}
    </section>
    ${chartCard(r, Y)}
    <p class="footer-note">ไม่ใช่คำแนะนำการลงทุน · ไม่ใช่บริการทางการของ กบข.</p>
  </main>`, 'home');
  bindHelp(); bindInstall();
  const hb = app.querySelector('#hide-banner');
  if (hb) hb.addEventListener('click', () => {
    const next = clone(state); next.meta.bannerDismissedAt = nowStamp(); next.meta.bannerDismissedChanges = next.meta.changesSinceBackup || 0;
    if (persist(next)) renderHome();
  });
  app.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => { chartRange = b.dataset.range; renderHome(); }));
}

// สรุปสมุดบนหน้าหลัก (F-17 ควรมี) — แสดงเฉพาะเมื่อเคยจดเปลี่ยนแผนหรือออมเพิ่ม; ใช้รายการล่าสุดที่มีผลแล้ว
// 0.4.1 (ซัน 22 พ.ย.): บรรทัดเดียวในการ์ดบนสุด "วันนี้ในสมุด" ใต้วันที่ข้อมูล (เดิมเป็นการ์ดแยกท้ายหน้า)
function ledgerSummaryLine() {
  const t = today(), p = Forms.latestLedger(state, 'plan', t), s = Forms.latestLedger(state, 'saving', t);
  if (!p && !s) return '';
  const parts = [];
  if (p) parts.push(esc(p.plan));
  if (s) parts.push(`ออมเพิ่ม ${s.rate}%`);
  return `<a class="nb-line" href="#/history?f=${p ? 'plan' : 'saving'}"><span class="tag tag-jot">จดไว้</span><span>${parts.join(' · ')}</span></a>`;
}

// กราฟยอดเงินกับเงินต้น (F-10): 2 เส้น จุดเฉพาะวันที่บันทึกจริง + ยอดสิ้นปี; ช่องว่าง = ผลประโยชน์
function chartCard(r, Y) {
  const all = r.graph;
  if (all.length < 2) return '';
  const base = state.yearEnds.find(e => e.year === Y - 1);
  const yearPts = all.filter(p => base ? p.date >= base.date : +p.date.slice(0, 4) === Y);
  const pts = chartRange === 'year' ? yearPts : all;
  const toggle = `<div class="seg" role="group" aria-label="ช่วงของกราฟ">
      <button type="button" data-range="year" aria-pressed="${chartRange === 'year'}">ปีนี้</button>
      <button type="button" data-range="all" aria-pressed="${chartRange === 'all'}">ทั้งหมด</button></div>`;
  const body = pts.length < 2
    ? `<p class="small muted" style="margin:0">ช่วงนี้ยังมีจุดไม่ถึง 2 จุด ลองดู "ทั้งหมด"</p>`
    : chartSvg(pts);
  return `<section class="card chart">
    <div class="row" style="align-items:center"><h2 class="card-title" style="font-size:16px">เงินที่ค่อย ๆ โต</h2>${toggle}</div>
    ${body}
    <div class="legend"><span><span style="width:18px;height:3px;background:#2E7D63;border-radius:2px"></span>ยอดเงิน</span>
      <span><span style="width:18px;height:0;border-top:3px dashed #E39A78"></span>เงินต้น</span></div>
    <span class="xsmall muted">ช่องว่างระหว่างเส้น = ผลประโยชน์</span></section>`;
}
function chartSvg(pts) {
  const W = 320, H = 170, L = 12, R = 12, T = 12, B = 30;
  const xs = pts.map(p => dayNum(p.date)); const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const vals = []; pts.forEach(p => { vals.push(p.v); if (p.p != null) vals.push(p.p); });
  let lo = Math.min(...vals), hi = Math.max(...vals); const padY = (hi - lo) * 0.08 || Math.max(hi * 0.05, 100); lo -= padY; hi += padY;
  const X = d => L + (x1 === x0 ? (W - L - R) / 2 : (dayNum(d) - x0) / (x1 - x0) * (W - L - R));
  const Yp = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const f = n => n.toFixed(1);
  const vLine = pts.map(p => `${f(X(p.date))},${f(Yp(p.v))}`);
  const pp = pts.filter(p => p.p != null);
  const pLine = pp.map(p => `${f(X(p.date))},${f(Yp(p.p))}`);
  const fill = pp.length >= 2 ? `<polygon points="${pp.map(p => `${f(X(p.date))},${f(Yp(p.v))}`).concat(pLine.slice().reverse()).join(' ')}" fill="#FFE9DD"></polygon>` : '';
  const dots = (arr, key, col) => arr.map((p, i) => `<circle cx="${f(X(p.date))}" cy="${f(Yp(p[key]))}" r="${i === arr.length - 1 ? 5 : 4}" fill="${col}"></circle>`).join('');
  const first = pts[0], last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟยอดเงินและเงินต้น ${pts.length} จุด ตั้งแต่ ${thaiDate(first.date)} ถึง ${thaiDate(last.date)} ยอดเงินล่าสุด ${fmtMoney(last.v)} บาท">
    ${fill}
    <polyline points="${vLine.join(' ')}" fill="none" stroke="#2E7D63" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${pLine.length >= 2 ? `<polyline points="${pLine.join(' ')}" fill="none" stroke="#E39A78" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round"></polyline>` : ''}
    ${dots(pts, 'v', '#2E7D63')}${dots(pp, 'p', '#E39A78')}
    <text x="${L}" y="${H - 8}" font-size="11" fill="#54706A">${thaiDateShort(first.date)}</text>
    <text x="${W - R}" y="${H - 8}" font-size="11" fill="#54706A" text-anchor="end">${thaiDateShort(last.date)}</text>
  </svg>`;
}

// =====================================================================
// เมนูบันทึก (F-16) — บันทึกยอดใหม่เด่นสุด; สมุด 3 อย่างติดป้าย "ไม่บังคับ"
// =====================================================================
function renderRecordMenu() {
  const opt = '<span class="tag tag-opt">ไม่บังคับ</span>';
  // 0.4.1 (ซัน 22 พ.ย.): ยอดสิ้นปีย้ายไปท้ายสุด เพราะใช้ปีละครั้ง; คงหัว "บันทึก" + บรรทัดเล็กแนวสมุด
  view(`${pageHead('บันทึก', null, null, 'วันนี้จะจดอะไรลงสมุด')}
  <main><div class="menu-list">
    <a class="menu-item main" href="#/record/balance"><span><span class="t" style="font-size:18px">บันทึกยอดใหม่</span><span class="d">จากหน้ายอดเงิน กบข. ใน My GPF</span></span></a>
    <a class="menu-item" href="#/record/deposit"><span><span class="t">เงินนำส่ง ${opt}</span></span></a>
    <a class="menu-item" href="#/record/plan"><span><span class="t">เปลี่ยนแผน ${opt}</span></span></a>
    <a class="menu-item" href="#/record/saving"><span><span class="t">ออมเพิ่ม ${opt}</span></span></a>
  </div>
  <p class="small muted" style="margin:0">เงินนำส่ง เปลี่ยนแผน และออมเพิ่ม จดไว้ดูย้อนหลัง ไม่ใช้คำนวณกำไร</p>
  <div class="menu-list"><a class="menu-item" href="#/record/yearend"><span><span class="t">ยอดสิ้นปี</span><span class="d muted">ปีละครั้ง ช่วงต้นปี · จาก "ดูยอดเงินย้อนหลังรายปี"</span></span></a></div>
  </main>`, 'record');
}

// =====================================================================
// บันทึกยอดใหม่ / แก้รายการ (F-02, F-09, AC-02, AC-04, AC-06, AC-07, AC-16)
// =====================================================================
function renderBalance(editDate, errors = {}, extra = {}) {
  const editing = editDate ? state.records.find(r => r.date === editDate) : null;
  if (editDate && !editing) return go('#/history');
  let dr = draft;
  let prefillFrom = null;
  if (!dr) {
    if (editing) dr = { v: moneyInput(editing.v), pm: moneyInput(editing.pm), pg: moneyInput(editing.pg), note: editing.note || '' };
    else {
      const withP = byDate(state.records).filter(r => r.pm != null); const last = withP[withP.length - 1];
      dr = { v: '', pm: last ? moneyInput(last.pm) : '', pg: last ? moneyInput(last.pg) : '', note: '' };
      if (last) prefillFrom = last.date;
    }
  } else prefillFrom = dr._prefill || null;
  const dateIso = isoFromDraft(dr) || (editing ? editing.date : today());
  const title = editing ? `แก้ยอดวันที่ ${thaiDate(editing.date)}` : 'บันทึกยอดใหม่';
  const back = editing ? `#/history/b/${editing.date}` : '#/record';
  view(`${pageHead(title, back, editing ? 'รายละเอียด' : 'บันทึก')}
  <main><section class="card">
    <button type="button" class="link-btn" data-help="balance">ดูได้จากไหนใน My GPF</button>
    <div id="form-alert" class="alert" role="alert" tabindex="-1" hidden></div>
    <form id="bal-form" novalidate>
      ${dateFields('date', dateIso, errors.date, 'วันที่ข้อมูล', 'ใช้วันที่ตรง "ยอดเงิน ณ วันที่" ไม่ใช่วันที่กรอก')}
      ${extra.duplicateOf ? `<a class="btn btn-soft" href="#/record/balance/${extra.duplicateOf}">ไปแก้รายการเดิม</a>` : ''}
      ${moneyField('v', 'ยอดเงิน (บาท)', dr.v, errors.v, 'ตัวเลข "รวมเงินทั้งสิ้น"')}
      ${prefillFrom ? `<p class="prefill" style="margin:0">เติมเงินต้นจาก ${thaiDate(prefillFrom)} ไว้ให้ ถ้าใน My GPF เปลี่ยนแล้ว แก้ตรงนี้</p>` : ''}
      ${moneyField('pm', `${BOX.pm} · เงินต้น`, dr.pm, errors.pm, 'กรอกเฉพาะบรรทัดเงินต้น ไม่ใช่ผลประโยชน์')}
      ${moneyField('pg', `${BOX.pg} · เงินต้น`, dr.pg, errors.pg)}
      ${extra.drop ? `<div class="warn-box" role="alert" tabindex="-1"><p>เงินต้นรวม ${fmtMoney(extra.drop.now)} บาท น้อยกว่าครั้งก่อน (${thaiDate(extra.drop.vs)}: ${fmtMoney(extra.drop.prev)} บาท) ตรวจกับ My GPF อีกครั้ง ถ้าถูกแล้วกดยืนยัน</p>
         <button type="button" class="btn btn-primary" id="confirm-drop">ยืนยันบันทึก</button></div>` : ''}
      <div class="field"><label for="f-note">บันทึกเพิ่มเติม <span class="opt">ไม่บังคับ</span></label>
        <textarea id="f-note" name="note" rows="2" placeholder="เช่น เหตุผลที่บันทึก">${esc(dr.note)}</textarea></div>
      <button type="submit" class="btn btn-primary">${editing ? 'บันทึกการแก้ไข' : 'บันทึก'}</button>
    </form></section></main>`, 'record');
  bindHelp();
  const form = app.querySelector('#bal-form');
  const submit = (confirmDrop) => {
    const f = readForm(form); f._prefill = prefillFrom; draft = f;
    const r = Forms.checkBalance(state, f, { editing: editing ? editing.date : null, today: today() });
    if (Object.keys(r.errors).length) { renderBalance(editDate, r.errors, { duplicateOf: r.duplicateOf }); focusFirstError(); return; }
    if (r.principalDrop && !confirmDrop) { renderBalance(editDate, {}, { drop: r.principalDrop }); focusFirstError(); return; }
    const q = Forms.principalQuestion(state, r.rec, editing ? editing.date : null);
    if (q) return askPrincipal(q, () => saveBalance(r.rec, editing));
    saveBalance(r.rec, editing);
  };
  form.addEventListener('submit', e => { e.preventDefault(); submit(false); });
  const cd = app.querySelector('#confirm-drop'); if (cd) cd.addEventListener('click', () => submit(true));
}
// F-09: ถามตอนบันทึกยอดใหม่ เมื่อเงินต้นไม่ทันสมัย — ปุ่ม "แก้เงินต้น" / "ไว้ทีหลัง"
function askPrincipal(q, later) {
  openSheet(`<h2>เงินต้นเปลี่ยนแล้วหรือยัง</h2>
    <p style="margin:0">เงินต้นไม่เปลี่ยนตั้งแต่ ${thaiDate(q.sameSince)} เงินนำส่งรอบล่าสุดน่าจะเข้าแล้ว</p>
    <p class="small muted" style="margin:0">ถ้ายังไม่แก้ กำไรปีนี้อาจสูงเกินจริง</p>
    <div class="btn-row"><button type="button" class="btn btn-primary" id="q-fix">แก้เงินต้น</button><button type="button" class="btn btn-soft" id="q-later">ไว้ทีหลัง</button></div>`, sh => {
    sh.querySelector('#q-fix').addEventListener('click', () => { closeSheet(); const el = document.getElementById('f-pm'); if (el) { el.focus(); el.select(); } });
    sh.querySelector('#q-later').addEventListener('click', () => { closeSheet(); later(); });
  });
}
function saveBalance(rec, editing) {
  const next = clone(state);
  if (editing) next.records = next.records.filter(r => r.date !== editing.date);
  next.records.push(rec); changed(next);
  if (persist(next, editing ? 'แก้แล้ว ตัวเลขทุกจุดคำนวณใหม่แล้ว' : 'บันทึกแล้ว')) { draft = null; go(editing ? `#/history/b/${rec.date}` : '#/home'); }
}

// =====================================================================
// ยอดสิ้นปี (F-03, AC-08, AC-10, C-2)
// =====================================================================
function renderYearEnd(editYear, errors = {}, extra = {}, defYear) {
  const editing = editYear != null ? state.yearEnds.find(e => e.year === editYear) : null;
  if (editYear != null && !editing) return go('#/history');
  let dr = draft;
  if (!dr) dr = editing ? { v: moneyInput(editing.v), pm: moneyInput(editing.pm), pg: moneyInput(editing.pg) } : { v: '', pm: '', pg: '' };
  const y0 = defYear || (new Date().getFullYear() - 1);
  const dateIso = isoFromDraft(dr) || (editing ? editing.date : `${y0}-12-31`);
  const yearBE = be(+dateIso.slice(0, 4));
  view(`${pageHead(editing ? `แก้ยอดสิ้นปี ${be(editing.year)}` : `ยอดสิ้นปี ${yearBE}`, editing ? `#/history/y/${editing.year}` : '#/record', editing ? 'รายละเอียด' : 'บันทึก')}
  <main><section class="card">
    <button type="button" class="link-btn" data-help="yearend">ยอดสิ้นปีดูได้จากไหน</button>
    <div id="form-alert" class="alert" role="alert" tabindex="-1" hidden></div>
    <form id="ye-form" novalidate>
      ${dateFields('date', dateIso, errors.date, 'วันที่ (ตามที่ My GPF แสดง)', 'ปีของยอดสิ้นปีดูจากวันที่นี้')}
      ${extra.duplicateOf != null ? `<a class="btn btn-soft" href="#/record/yearend/${extra.duplicateOf}">ไปแก้ยอดสิ้นปี ${be(extra.duplicateOf)}</a>` : ''}
      ${moneyField('v', 'ยอดเงิน (บาท)', dr.v, errors.v)}
      ${moneyField('pm', `${BOX.pm} · เงินต้น`, dr.pm, errors.pm)}
      ${moneyField('pg', `${BOX.pg} · เงินต้น`, dr.pg, errors.pg)}
      <p class="hint" style="margin:0">ปีที่แล้วยังไม่ได้เป็นสมาชิก กบข.? กรอก 0 ทุกช่อง</p>
      ${extra.notDec ? `<div class="warn-box" role="alert" tabindex="-1"><p>ยอดสิ้นปีมักลงวันที่ปลาย ธ.ค. ตรวจวันที่อีกครั้ง ถ้าถูกแล้วกดยืนยัน</p><button type="button" class="btn btn-primary" id="confirm-ye">ยืนยันบันทึก</button></div>` : ''}
      <button type="submit" class="btn btn-primary">${editing ? 'บันทึกการแก้ไข' : 'บันทึก'}</button>
    </form></section></main>`, 'record');
  bindHelp();
  const form = app.querySelector('#ye-form');
  // เปลี่ยนวันที่แล้วหัวหน้าเปลี่ยนตามปี
  form.querySelector('#date-y').addEventListener('change', e => { if (!editing) app.querySelector('.page-head h1').textContent = `ยอดสิ้นปี ${e.target.value}`; });
  const submit = (okNotDec, okZero) => {
    draft = readForm(form);
    const r = Forms.checkYearEnd(state, draft, { editingYear: editing ? editing.year : null, today: today() });
    if (Object.keys(r.errors).length) { renderYearEnd(editYear, r.errors, { duplicateOf: r.duplicateOf }, defYear); focusFirstError(); return; }
    if (r.notDecember && !okNotDec) { renderYearEnd(editYear, {}, { notDec: true }, defYear); focusFirstError(); return; }
    if (r.allZero && !okZero) {
      return openSheet(`<h2>ปี ${be(r.ye.year)} ยังไม่ได้เป็นสมาชิก กบข. ใช่ไหม</h2>
        <p style="margin:0">แอพจะแสดงกำไรและเงินที่ส่งเข้าไปปีนี้ แต่ยังคิด % ให้ไม่ได้ในปีแรก</p>
        <div class="btn-row"><button type="button" class="btn btn-primary" id="z-yes">ใช่</button><button type="button" class="btn btn-soft" data-close>ไม่ใช่ แก้ตัวเลข</button></div>`,
        sh => sh.querySelector('#z-yes').addEventListener('click', () => { closeSheet(); submit(true, true); }));
    }
    const next = clone(state);
    if (editing) next.yearEnds = next.yearEnds.filter(e => e.year !== editing.year);
    next.yearEnds.push(r.ye); next.yearEnds.sort((a, b) => a.year - b.year); changed(next);
    if (persist(next, editing ? 'แก้แล้ว ตัวเลขทุกจุดคำนวณใหม่แล้ว' : 'บันทึกยอดสิ้นปีแล้ว')) { draft = null; go(editing ? `#/history/y/${r.ye.year}` : '#/home'); }
  };
  form.addEventListener('submit', e => { e.preventDefault(); submit(false, false); });
  const cy = app.querySelector('#confirm-ye'); if (cy) cy.addEventListener('click', () => submit(true, false));
}

// =====================================================================
// สมุดบันทึก 3 หน้า (F-13–F-15) — จดไว้ดูย้อนหลัง ไม่ใช้คำนวณ; หน้าตาแบบสมุด (UX 5.6)
// =====================================================================
const LEDGER_LABEL = { deposit: 'เงินนำส่ง', plan: 'เปลี่ยนแผน', saving: 'ออมเพิ่ม' };
const LEDGER_TITLE = { deposit: 'จดเงินนำส่ง', plan: 'จดการเปลี่ยนแผน', saving: 'จดการออมเพิ่ม' };
const findLedger = id => (state.ledger || []).find(x => x.id === id);
function newId() { let id; do { id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); } while (findLedger(id)); return id; }
const noteField = v => `<div class="field"><label for="f-note">บันทึกเพิ่มเติม <span class="opt">ไม่บังคับ</span></label>
  <textarea id="f-note" name="note" rows="2">${esc(v)}</textarea></div>`;
function ledgerPage(type, editing, body, after = '') {
  const title = editing ? `แก้${LEDGER_LABEL[type]} ${thaiDate(editing.date)}` : LEDGER_TITLE[type];
  view(`${pageHead(title, editing ? `#/history/l/${editing.id}` : '#/record', editing ? 'รายละเอียด' : 'บันทึก', null, true)}
  <main><section class="card notebook">${body}</section>${after}</main>`, 'record');
  bindHelp();
}
// เก็บรายการสมุด — 0.4.2: นับเป็นการเปลี่ยนแปลงที่ยังไม่ได้สำรองด้วย (กติกาชวนสำรองใหม่ไม่ชวนถี่ จึงไม่รบกวน)
function saveLedger(item, editing, after) {
  const next = changed(clone(state));
  const it = Object.assign({ id: editing ? editing.id : newId() }, item);
  next.ledger = editing ? next.ledger.map(x => (x.id === editing.id ? it : x)) : next.ledger.concat([it]);
  if (persist(next, editing ? 'แก้แล้ว' : 'จดลงสมุดแล้ว')) { draft = null; after(it); }
}
function bindLedgerForm(check, rerender, editing, afterNew) {
  const form = app.querySelector('#lg-form');
  const submit = () => {
    draft = readForm(form);
    const r = check(state, draft, { editingId: editing ? editing.id : null, today: today() });
    if (Object.keys(r.errors).length) { rerender(r.errors, { duplicateOf: r.duplicateOf }); focusFirstError(); return; }
    saveLedger(r.item, editing, it => (editing ? go(`#/history/l/${it.id}`) : afterNew(it)));
  };
  form.addEventListener('submit', e => { e.preventDefault(); submit(); });
  return form;
}
const editOf = (id, type) => { const x = id ? findLedger(id) : null; return x && x.type === type ? x : null; };

// ---------- จดเงินนำส่ง (F-13, AC-27) ----------
function renderDeposit(editId, errors = {}, extra = {}) {
  const editing = editOf(editId, 'deposit');
  if (editId && !editing) return go('#/history');
  const dr = draft || (editing ? { a: moneyInput(editing.a), note: editing.note || '' } : { a: '', note: '' });
  const dateIso = isoFromDraft(draft) || (editing ? editing.date : today());
  const recent = editing ? [] : state.ledger.filter(x => x.type === 'deposit').sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 3);
  ledgerPage('deposit', editing, `
    <p class="nb-note">จดไว้ดูย้อนหลัง กำไรคำนวณจากเงินต้น</p>
    <button type="button" class="link-btn" data-help="deposit">ดูได้จากไหนใน My GPF</button>
    <div id="form-alert" class="alert" role="alert" tabindex="-1" hidden></div>
    <form id="lg-form" novalidate>
      ${dateFields('date', dateIso, errors.date, 'วันที่เงินเข้า', 'ตามรายการเคลื่อนไหวบัญชีใน My GPF')}
      ${extra.duplicateOf ? `<a class="btn btn-soft" href="#/record/deposit/${extra.duplicateOf}">ไปแก้รายการเดิม</a>` : ''}
      ${moneyField('a', 'จำนวน (บาท)', dr.a, errors.a, 'ยอดรวมของบรรทัด "เงินนำส่ง"')}
      ${noteField(dr.note)}
      <button type="submit" class="btn btn-primary">${editing ? 'บันทึกการแก้ไข' : 'จดลงสมุด'}</button>
    </form>`,
    recent.length ? `<section class="recent" aria-labelledby="recent-h"><h2 id="recent-h" class="hist-year">จดล่าสุด</h2>${recent.map(ledgerRow).join('')}</section>` : '');
  bindLedgerForm(Forms.checkDeposit, (e, x) => renderDeposit(editId, e, x), editing, () => renderDeposit(null));
}

// ---------- จดการเปลี่ยนแผน (F-14, AC-28) ----------
function renderPlan(editId, errors = {}, extra = {}) {
  const editing = editOf(editId, 'plan');
  if (editId && !editing) return go('#/history');
  let dr = draft;
  if (!dr) {
    dr = { plan: '', other: '', note: '' };
    if (editing) {
      dr.note = editing.note || '';
      const known = Plans.CURRENT.concat(Plans.CLOSED).includes(editing.plan);
      if (editing.other || !known) { dr.plan = Plans.OTHER; dr.other = editing.plan; } else dr.plan = editing.plan;
      if (editing.mix) Plans.MIX_PARTS.forEach((pt, i) => { const m = editing.mix.find(x => x.plan === pt); dr['mix-' + i] = m ? String(m.pct) : ''; });
    }
  }
  const dateIso = isoFromDraft(draft) || (editing ? editing.date : today());
  const sel = dr.plan;
  const opt = (v, label) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(label || v)}</option>`;
  const options = `<option value=""${sel ? '' : ' selected'}>— เลือกแผน —</option>${Plans.CURRENT.map(v => opt(v)).join('')}
    <option disabled>──────────</option>${Plans.CLOSED.map(v => opt(v, v + ' · ปิดรับแล้ว')).join('')}${opt(Plans.OTHER)}`;
  const err = k => (errors[k] ? `<span class="err">${esc(errors[k])}</span>` : '');
  const inv = k => (errors[k] ? ' aria-invalid="true"' : '');
  const mixRows = Plans.MIX_PARTS.map((pt, i) => `<div class="mix-row">
      <label for="f-mix-${i}">${pt}${pt === Plans.GOLD ? ` <span class="opt">(ไม่เกิน ${Plans.GOLD_MAX})</span>` : ''}</label>
      <span class="pct-in"><input type="text" id="f-mix-${i}" name="mix-${i}" inputmode="numeric" autocomplete="off" value="${esc(dr['mix-' + i] || '')}"${inv('mix-' + i)}><span aria-hidden="true">%</span></span>
      <span class="err" id="mix-err-${i}"${errors['mix-' + i] ? '' : ' hidden'}>${esc(errors['mix-' + i] || '')}</span></div>`).join('');
  ledgerPage('plan', editing, `
    <p class="nb-note">จดไว้ดูย้อนหลัง ไม่ใช้คำนวณกำไร</p>
    <button type="button" class="link-btn" data-help="plan">ดูได้จากไหนใน My GPF</button>
    <div id="form-alert" class="alert" role="alert" tabindex="-1" hidden></div>
    <form id="lg-form" novalidate>
      ${dateFields('date', dateIso, errors.date, 'ได้มูลค่าหน่วยลงทุนวันที่', 'ใช้วันที่ตามที่ My GPF แสดง')}
      ${extra.duplicateOf ? `<a class="btn btn-soft" href="#/record/plan/${extra.duplicateOf}">ไปแก้รายการเดิม</a>` : ''}
      <div class="field"><label for="f-plan">แผน</label><select id="f-plan" name="plan"${inv('plan')}>${options}</select>${err('plan')}</div>
      <div class="field" id="other-box"${sel === Plans.OTHER ? '' : ' hidden'}><label for="f-other">ชื่อแผน</label>
        <input type="text" id="f-other" name="other" maxlength="80" autocomplete="off" value="${esc(dr.other || '')}"${inv('other')}>${err('other')}</div>
      <fieldset class="mix" id="mix-box"${sel === Plans.MIX ? '' : ' hidden'}><legend>สัดส่วนของแต่ละแผน</legend>
        <span class="hint">ใส่ % เต็มจำนวน ช่องที่เว้นว่าง = 0</span>
        ${mixRows}
        <div class="mix-total" id="mix-total" aria-live="polite"></div>${err('mix')}</fieldset>
      ${noteField(dr.note)}
      <button type="submit" class="btn btn-primary">${editing ? 'บันทึกการแก้ไข' : 'จดลงสมุด'}</button>
    </form>`);
  const form = bindLedgerForm(Forms.checkPlan, (e, x) => renderPlan(editId, e, x), editing, () => go('#/history?f=plan'));
  const selEl = form.querySelector('#f-plan'), btn = form.querySelector('button[type=submit]'), box = form.querySelector('#mix-total');
  const update = () => {
    const v = selEl.value;
    form.querySelector('#mix-box').hidden = v !== Plans.MIX;
    form.querySelector('#other-box').hidden = v !== Plans.OTHER;
    if (v !== Plans.MIX) { btn.disabled = false; return; }
    let bad = false;
    form.querySelectorAll('[name^="mix-"]').forEach((el, i) => {
      const why = Forms.liveMixPart(i, el.value), msg = form.querySelector('#mix-err-' + i);
      msg.hidden = !why; msg.textContent = why || '';
      if (why) { el.setAttribute('aria-invalid', 'true'); bad = true; } else el.removeAttribute('aria-invalid');
    });
    const t = Forms.mixTotal(readForm(form)), ok = !bad && t === 100;
    box.className = 'mix-total' + (ok ? ' ok' : '');
    box.innerHTML = bad ? 'แก้ช่องที่มีกรอบสีแดงก่อน'
      : ok ? `<span aria-hidden="true">✓</span> รวมตอนนี้ 100% ครบแล้ว` : `รวมตอนนี้ ${t}% — ต้องรวมได้ 100%`;
    btn.disabled = !ok;
  };
  selEl.addEventListener('change', update);
  form.querySelectorAll('[name^="mix-"]').forEach(el => el.addEventListener('input', update));
  update();
}

// ---------- จดการออมเพิ่ม (F-15, AC-29) ----------
function renderSaving(editId, errors = {}, extra = {}) {
  const editing = editOf(editId, 'saving');
  if (editId && !editing) return go('#/history');
  const dr = draft || (editing ? { rate: String(editing.rate), note: editing.note || '' } : { rate: '', note: '' });
  const dateIso = isoFromDraft(draft) || (editing ? editing.date : today());
  ledgerPage('saving', editing, `
    <p class="nb-note">จดไว้ดูย้อนหลัง ไม่ใช้คำนวณกำไร</p>
    <button type="button" class="link-btn" data-help="saving">ดูได้จากไหนใน My GPF</button>
    <div id="form-alert" class="alert" role="alert" tabindex="-1" hidden></div>
    <form id="lg-form" novalidate>
      ${dateFields('date', dateIso, errors.date, 'วันที่มีผล', 'ใช้วันที่ตามที่ My GPF แสดง')}
      ${extra.duplicateOf ? `<a class="btn btn-soft" href="#/record/saving/${extra.duplicateOf}">ไปแก้รายการเดิม</a>` : ''}
      <div class="field"><label for="f-rate">อัตราออมเพิ่ม (% ของเงินเดือน)</label>
        <span class="pct-in"><input type="text" id="f-rate" name="rate" inputmode="numeric" autocomplete="off" value="${esc(dr.rate)}"${errors.rate ? ' aria-invalid="true"' : ''}><span aria-hidden="true">%</span></span>
        <span class="hint">เต็มจำนวน 0–${Plans.SAVING_MAX} ไม่รวมเงินสะสมภาคบังคับ 3%</span><span class="err" id="rate-err"${errors.rate ? '' : ' hidden'}>${esc(errors.rate || '')}</span></div>
      ${noteField(dr.note)}
      <button type="submit" class="btn btn-primary">${editing ? 'บันทึกการแก้ไข' : 'จดลงสมุด'}</button>
    </form>`);
  const form = bindLedgerForm(Forms.checkSaving, (e, x) => renderSaving(editId, e, x), editing, () => go('#/history?f=saving'));
  // บอกทันทีระหว่างพิมพ์ (0.4.1 — ซันคาดว่าจะเห็นตั้งแต่พิมพ์)
  const rateEl = form.querySelector('#f-rate'), rateErr = form.querySelector('#rate-err');
  rateEl.addEventListener('input', () => {
    const why = Forms.liveSaving(rateEl.value);
    rateErr.hidden = !why; rateErr.textContent = why || '';
    if (why) rateEl.setAttribute('aria-invalid', 'true'); else rateEl.removeAttribute('aria-invalid');
  });
}

// =====================================================================
// ประวัติ (F-05, F-11, AC-17, AC-18, AC-30) — เส้นเวลารวมทุกประเภท + ตัวกรอง
// =====================================================================
const FILTERS = [['all', 'ทั้งหมด'], ['balance', 'ยอดเงิน'], ['deposit', 'เงินนำส่ง'], ['plan', 'เปลี่ยนแผน'], ['saving', 'ออมเพิ่ม']];
const KIND_ORDER = { balance: 0, deposit: 1, plan: 2, saving: 3 };   // วันเดียวกัน: เรียงตามนี้
const shortPlan = n => n.replace(/^แผน/, '');
function ledgerRow(x) {
  let body;
  if (x.type === 'deposit') body = `<b class="num">${fmtMoney(x.a)} บาท</b>`;
  else if (x.type === 'plan') body = `<b>→ ${esc(x.plan)}</b>${x.mix ? `<span class="xsmall muted">${x.mix.map(m => `${esc(shortPlan(m.plan))} ${m.pct}%`).join(' · ')}</span>` : ''}`;
  else body = `<b>→ ${x.rate}%</b><span class="xsmall muted">ของเงินเดือน</span>`;
  return `<a class="hist-item" href="#/history/l/${esc(x.id)}"><span class="row"><span>${thaiDate(x.date)}</span><span class="hist-type lg">${LEDGER_LABEL[x.type]}</span></span>${body}</a>`;
}
function balanceRow(x) {
  const pu = x.principalUp;
  const sub = x.principal != null
    ? `เงินต้นรวม <span class="num">${fmtMoney(x.principal)}</span>${pu ? ` · เพิ่มจากครั้งก่อน <span class="num">${fmtSigned(pu.amount)}</span>${pu.skipped ? ` (เทียบ ${pu.yearEnd ? 'ยอดสิ้นปี ' + be(pu.yearEnd) : thaiDate(pu.vs)})` : ''}` : ''}`
    : 'ยังไม่มีเงินต้น';
  return `<a class="hist-item" href="#/history/b/${x.date}"><span class="row"><span>${thaiDate(x.date)}</span><span class="hist-type">ยอดเงิน</span></span>
    <b class="num">${fmtMoney(x.v)} บาท</b><span class="xsmall muted">${sub}</span></a>`;
}
function renderHistory(filter) {
  const f = FILTERS.some(([k]) => k === filter) ? filter : 'all';
  const show = k => f === 'all' || f === k;
  const chips = `<nav class="chips" aria-label="กรองตามประเภท">${FILTERS.map(([k, l]) =>
    `<a href="#/history${k === 'all' ? '' : '?f=' + k}"${k === f ? ' aria-current="true"' : ''}>${l}</a>`).join('')}</nav>`;
  const r = compute(state);
  const entries = [];
  if (show('balance') && !r.empty) r.history.forEach(x => entries.push({ date: x.date, k: 0, html: balanceRow(x) }));
  state.ledger.forEach(x => { if (show(x.type)) entries.push({ date: x.date, k: KIND_ORDER[x.type], html: ledgerRow(x) }); });
  const yes = show('balance') ? state.yearEnds : [];
  const head = pageHead('ประวัติ', null, null, 'เรียงจากใหม่ไปเก่า แตะเพื่อดูรายละเอียด แก้ หรือลบ');
  if (!entries.length && !yes.length) {
    const label = FILTERS.find(([k]) => k === f)[1];
    const msg = f === 'all' ? 'ยังไม่มีรายการ' : `ยังไม่มีรายการ${label}`;
    const link = LEDGER_LABEL[f] ? ` <a href="#/record/${f}">จด${label}</a>` : '';
    return view(`${head}<main style="gap:10px">${chips}<p class="muted" style="margin:0">${msg}${link}</p></main>`, 'history');
  }
  entries.sort((a, b) => (a.date === b.date ? a.k - b.k : a.date < b.date ? 1 : -1));
  const years = new Set(entries.map(e => +e.date.slice(0, 4)).concat(yes.map(e => e.year)));
  const groups = [...years].sort((a, b) => b - a).map(y => {
    const items = entries.filter(e => +e.date.slice(0, 4) === y).map(e => e.html);
    const ye = yes.find(e => e.year === y);   // ยอดสิ้นปีอยู่ท้ายกลุ่มปีของตัวเอง (UX 3.5)
    if (ye) items.push(`<a class="hist-item" href="#/history/y/${y}"><span class="row"><span>${thaiDate(ye.date)}</span><span class="hist-type ye">ยอดสิ้นปี ${be(y)}</span></span>
        <b class="num">${fmtMoney(ye.v)} บาท</b><span class="xsmall muted">เงินต้นรวม <span class="num">${fmtMoney(ye.pm + ye.pg)}</span></span></a>`);
    return `<h2 class="hist-year">ปี ${be(y)}</h2>${items.join('')}`;
  });
  view(`${head}<main style="gap:10px">${chips}${groups.join('')}</main>`, 'history');
}

function renderLedgerDetail(id, askDelete) {
  const x = findLedger(id);
  if (!x) return go('#/history');
  const kv = [[{ deposit: 'วันที่เงินเข้า', plan: 'ได้มูลค่าหน่วยลงทุนวันที่', saving: 'วันที่มีผล' }[x.type], thaiDate(x.date)]];
  if (x.type === 'deposit') kv.push(['จำนวน', fmtMoney(x.a) + ' บาท']);
  if (x.type === 'plan') {
    kv.push(['แผน', esc(x.plan) + (x.other ? ' <span class="opt">(พิมพ์เอง)</span>' : '')]);
    if (x.mix) x.mix.forEach(m => kv.push([`<span class="mix-k">${esc(m.plan)}</span>`, m.pct + '%']));
  }
  if (x.type === 'saving') kv.push(['อัตราออมเพิ่ม', x.rate + '% ของเงินเดือน']);
  if (x.note) kv.push(['บันทึกเพิ่มเติม', esc(x.note)]);
  const label = LEDGER_LABEL[x.type];
  detailView(`${label} ${thaiDate(x.date)}`, kv, `#/record/${x.type}/${x.id}`, askDelete, `ลบรายการ${label}วันที่ ${thaiDate(x.date)} ใช่ไหม`, () => {
    const next = changed(clone(state)); next.ledger = next.ledger.filter(y => y.id !== id);
    if (persist(next, 'ลบแล้ว')) go('#/history');
  }, `#/history/l/${x.id}`, '<p class="small muted" style="margin:0">จดไว้ดูย้อนหลัง ไม่ใช้คำนวณกำไร</p>');
}

function renderBalanceDetail(date, askDelete) {
  const rec = state.records.find(r => r.date === date);
  if (!rec) return go('#/history');
  const row = compute(state).history.find(x => x.date === date);
  const vsTxt = o => o.yearEnd ? `เทียบยอดสิ้นปี ${be(o.yearEnd)}` : `เทียบ ${thaiDate(o.vs)}`;
  const kv = [['ยอดเงิน', fmtMoney(rec.v) + ' บาท']];
  if (rec.pm != null) {
    kv.push([`เงินต้น · ${BOX.pm}`, fmtMoney(rec.pm)], [`เงินต้น · ${BOX.pg}`, fmtMoney(rec.pg)], ['เงินต้นรวม', fmtMoney(P(rec))], ['ผลประโยชน์', fmtMoney(row.benefit)]);
  } else kv.push(['เงินต้น', 'ยังไม่ได้กรอก']);
  kv.push(['ยอดเปลี่ยนจากครั้งก่อน', row.dV ? `${fmtSigned(row.dV.amount)} (${vsTxt(row.dV)})` : 'ยังไม่มีครั้งก่อนให้เทียบ']);
  if (row.principalUp) kv.push(['เงินที่ส่งเข้าไปตั้งแต่ครั้งก่อน', `${fmtSigned(row.principalUp.amount)}${row.principalUp.skipped ? ` (${vsTxt(row.principalUp)})` : ''}`]);
  kv.push([`กำไรปี ${be(+date.slice(0, 4))} ถึงวันนั้น`, row.yearProfit != null ? fmtMoney(row.yearProfit) : row.yearWhy]);
  if (rec.note) kv.push(['บันทึกเพิ่มเติม', esc(rec.note)]);
  detailView(`ยอดเงิน ${thaiDate(date)}`, kv, `#/record/balance/${date}`, askDelete, `ลบรายการวันที่ ${thaiDate(date)} ใช่ไหม`, () => {
    const next = clone(state); next.records = next.records.filter(r => r.date !== date); changed(next);
    if (persist(next, 'ลบแล้ว')) go(next.records.length ? '#/history' : '#/start');
  }, `#/history/b/${date}`);
}
function renderYearEndDetail(year, askDelete) {
  const ye = state.yearEnds.find(e => e.year === year);
  if (!ye) return go('#/history');
  const kv = [['วันที่', thaiDate(ye.date)], ['ยอดเงิน', fmtMoney(ye.v) + ' บาท'], [`เงินต้น · ${BOX.pm}`, fmtMoney(ye.pm)], [`เงินต้น · ${BOX.pg}`, fmtMoney(ye.pg)],
              ['เงินต้นรวม', fmtMoney(ye.pm + ye.pg)], ['ผลประโยชน์', fmtMoney(ye.v - ye.pm - ye.pg)]];
  detailView(`ยอดสิ้นปี ${be(year)}`, kv, `#/record/yearend/${year}`, askDelete, `ลบยอดสิ้นปี ${be(year)} ใช่ไหม`, () => {
    const next = clone(state); next.yearEnds = next.yearEnds.filter(e => e.year !== year); changed(next);
    if (persist(next, 'ลบแล้ว')) go('#/history');
  }, `#/history/y/${year}`);
}
function detailView(title, kv, editHref, askDelete, delQ, onDelete, selfHref, extra = '') {
  view(`${pageHead(title, '#/history', 'ประวัติ')}
  <main><section class="card"><dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd class="num" style="white-space:normal">${v}</dd>`).join('')}</dl>${extra}</section>
  ${askDelete
    ? `<div class="warn-box" role="alert" tabindex="-1"><p>${delQ}</p><div class="btn-row"><button type="button" class="btn btn-danger" id="do-del">ลบ</button><a class="btn btn-soft" href="${selfHref}">ยกเลิก</a></div></div>`
    : `<div class="btn-row"><a class="btn btn-soft" href="${editHref}">แก้</a><a class="btn btn-danger" href="${selfHref}/delete">ลบ</a></div>`}
  </main>`, 'history');
  const d = app.querySelector('#do-del'); if (d) { d.addEventListener('click', onDelete); app.querySelector('.warn-box').focus(); }
}

// =====================================================================
// สำรองข้อมูล (F-06, F-08, AC-20–AC-22, AC-24)
// =====================================================================
function backupFileName() { const d = today(); return `kasiansuk-backup-${be(+d.slice(0, 4))}-${d.slice(5)}.json`; }
function markBackedUp() {
  const next = clone(state); next.meta.lastBackupAt = nowStamp(); next.meta.changesSinceBackup = 0; next.meta.bannerDismissedChanges = 0;
  persist(next); renderData();
}
// บรรทัดสถานะเงียบ ๆ ในหน้าสำรองข้อมูล (0.4.2) — บอกโดยไม่เด้งเตือน
function backupStatus(m) {
  const n = Store.backupNudge(m, nowStamp());
  const when = m.lastBackupAt ? `สำรองล่าสุด ${thaiDate(m.lastBackupAt.slice(0, 10))}${n.sinceBackup > 0 ? ` (${n.sinceBackup} วันก่อน)` : ' (วันนี้)'}` : 'ยังไม่เคยสำรอง';
  const what = n.pending > 0 ? ` · มีการเปลี่ยนแปลง ${n.pending} ครั้งที่ยังไม่ได้สำรอง` : (m.lastBackupAt ? ' · ข้อมูลทั้งหมดสำรองแล้ว' : '');
  return when + what;
}
function renderData() {
  const has = !!state;
  const m = has ? state.meta : null;
  view(`${pageHead('สำรองข้อมูล', has ? null : '#/start', 'เริ่มใช้')}
  <main>
    ${loadError ? `<div class="alert" role="alert">อ่านข้อมูลเดิมในเครื่องไม่ได้: ${esc(loadError)} — แอพจะไม่เขียนทับข้อมูลเดิมเอง ถ้ามีไฟล์สำรอง กู้คืนได้ด้านล่าง</div>` : ''}
    ${has ? `<section class="card">
      <h2 class="card-title">สำรองข้อมูล</h2>
      <p class="small muted" style="margin:0">${backupStatus(m)}</p>
      <p class="small" style="margin:0">กดแต่ละครั้งได้ไฟล์ใหม่ที่มีข้อมูลครบทุกปี เก็บไว้ในที่ที่ไม่หายเมื่อเปลี่ยนเครื่อง เช่น iCloud Drive หรือ Google Drive</p>
      <button type="button" class="btn btn-primary" id="do-backup">สำรองข้อมูล</button>
    </section>` : ''}
    <section class="card">
      <h2 class="card-title">กู้คืนจากไฟล์สำรอง</h2>
      <p class="small muted" style="margin:0">เลือกไฟล์ แล้วแอพจะสรุปให้ดูก่อน ยังไม่แทนที่จนกว่าจะยืนยัน</p>
      <div id="form-alert" class="alert" role="alert" tabindex="-1" hidden></div>
      <label class="btn btn-soft" for="restore-file">เลือกไฟล์สำรอง</label>
      <input type="file" id="restore-file" accept=".json,application/json" class="sr-only">
    </section>
    ${installCard(false)}
    <section class="card">
      <h2 class="card-title">ข้อความสำคัญ</h2>
      <ul style="margin:0;padding-left:20px">${IMPORTANT_3.concat(IMPORTANT_MORE).map(t => `<li>${t}</li>`).join('')}</ul>
    </section>
    <p class="footer-note">เกษียณสุข รุ่น ${VERSION} (รุ่นทดสอบ) · ตัวอักษร Mitr และ IBM Plex Sans Thai Looped ใช้ตามสัญญาอนุญาต <a href="fonts/OFL-Mitr.txt">OFL</a></p>
  </main>`, has ? 'data' : null);
  const bk = app.querySelector('#do-backup');
  if (bk) bk.addEventListener('click', backupFlow);
  app.querySelector('#restore-file').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      const p = Store.parseBackup(String(rd.result));
      if (!p.ok) { showAlert(p.why + ' — ข้อมูลเดิมไม่ถูกแตะต้อง'); e.target.value = ''; return; }
      pendingRestore = p; go('#/data/restore');
    };
    rd.onerror = () => showAlert('อ่านไฟล์ไม่สำเร็จ — ข้อมูลเดิมไม่ถูกแตะต้อง');
    rd.readAsText(file);
  });
}

// สำรองข้อมูล (0.2.0): กล่องข้อความของแอพบอกขั้นตอนก่อน → เปิดเมนูแชร์ของเครื่อง (มี "บันทึกไปยังไฟล์" ในหน้าแรก)
// เครื่องที่เปิดเมนูแชร์พร้อมไฟล์ไม่ได้ → ดาวน์โหลดไฟล์แบบเดิม พร้อมบอกวิธีบน iPhone
function backupFile() { return new File([Store.makeBackup(state, nowStamp())], backupFileName(), { type: 'application/json' }); }
function canShareFile() {
  try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })); } catch (e) { return false; }
}
function backupFlow() {
  const share = canShareFile();
  const steps = share
    ? (isIOS()
        ? '<li>หน้าถัดไปแตะ <b>บันทึกไปยังไฟล์</b> (Save to Files)</li><li>เลือกที่เก็บ เช่น <b>iCloud Drive</b> แล้วแตะ <b>บันทึก</b></li>'
        : '<li>หน้าถัดไปเลือกที่เก็บไฟล์ เช่น Google Drive หรือส่งเข้า LINE ของตัวเอง</li><li>ยืนยันการบันทึก</li>')
    : (isIOS()
        ? '<li>ถ้าเห็นหน้ารูปไฟล์พื้นดำ แตะ <b>More…</b> (หรือปุ่มแชร์)</li><li>แตะ <b>บันทึกไปยังไฟล์</b> (Save to Files) แล้วเลือกที่เก็บ</li>'
        : '<li>ไฟล์จะถูกบันทึกไว้ในโฟลเดอร์ดาวน์โหลด</li><li>ย้ายไฟล์ไปเก็บในที่ที่ไม่หายเมื่อเปลี่ยนเครื่อง</li>');
  openSheet(`<h2>สำรองข้อมูล</h2>
    <p style="margin:0">แอพจะสร้างไฟล์ใหม่ชื่อ <span class="num">${esc(backupFileName())}</span> — ในไฟล์มีข้อมูลทุกรายการ ทุกปี</p>
    <div class="steps-box"><ol>${steps}</ol></div>
    <p class="small muted" style="margin:0">กดสำรองแต่ละครั้งได้ไฟล์ใหม่ เก็บไฟล์ล่าสุดไว้ก็พอ (ไฟล์เก่าลบได้) · ไฟล์นี้มีตัวเลขพอร์ตของคุณ อย่าส่งให้คนอื่น</p>
    <div class="btn-row"><button type="button" class="btn btn-primary" id="bk-go">บันทึกไฟล์สำรอง</button><button type="button" class="btn btn-soft" data-close>ยกเลิก</button></div>`, sh => {
    sh.querySelector('#bk-go').addEventListener('click', async () => {
      if (share) {
        try { await navigator.share({ files: [backupFile()] }); closeSheet(); toast('สำรองแล้ว'); markBackedUp(); }
        catch (e) {
          if (e && e.name === 'AbortError') return;          // ผู้ใช้ปิดเมนูแชร์เอง — ยังไม่ถือว่าสำรอง
          closeSheet(); downloadBackup();
        }
      } else { closeSheet(); downloadBackup(); }
    });
  });
}
function downloadBackup() {
  const blob = new Blob([Store.makeBackup(state, nowStamp())], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = backupFileName();
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('สร้างไฟล์สำรองแล้ว เก็บไฟล์ไว้ให้ดี'); markBackedUp();
}

function renderRestore() {
  if (!pendingRestore) return go('#/data');
  const s = pendingRestore.summary;
  view(`${pageHead('กู้คืนจากไฟล์สำรอง', '#/data', 'สำรองข้อมูล')}
  <main><section class="card">
    <h2 class="card-title">ไฟล์นี้มี</h2>
    <dl class="kv"><dt>จำนวนปี</dt><dd>${s.years} ปี</dd><dt>ยอดเงิน</dt><dd>${s.records} รายการ</dd><dt>ยอดสิ้นปี</dt><dd>${s.yearEnds} รายการ</dd>
      <dt>เงินนำส่ง</dt><dd>${s.deposit} รายการ</dd><dt>เปลี่ยนแผน</dt><dd>${s.plan} รายการ</dd><dt>ออมเพิ่ม</dt><dd>${s.saving} รายการ</dd>
      <dt>ล่าสุด</dt><dd>${s.latest ? thaiDate(s.latest) : '—'}</dd></dl>
    ${state ? '<div class="warn-box"><p><b>ข้อมูลในเครื่องนี้จะถูกแทนที่ทั้งหมด</b></p></div>' : ''}
    <div id="form-alert" class="alert" role="alert" tabindex="-1" hidden></div>
    <div class="btn-row"><button type="button" class="btn btn-primary" id="do-restore">แทนที่ด้วยไฟล์นี้</button><a class="btn btn-soft" href="#/data">ยกเลิก</a></div>
  </section></main>`, state ? 'data' : null);
  app.querySelector('#do-restore').addEventListener('click', () => {
    const next = Store.stateFromBackup(pendingRestore.data, nowStamp());
    if (persist(next, 'กู้คืนแล้ว')) { pendingRestore = null; loadError = null; go(next.records.length ? '#/home' : '#/data'); }
  });
}

// ---------- ผูกปุ่มคำช่วย ----------
function bindHelp() { app.querySelectorAll('[data-help]').forEach(b => b.addEventListener('click', () => openHelp(b.dataset.help))); }

// ---------- เส้นทางหน้า ----------
function render() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, query] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  if (path !== (render.last || '')) draft = null;   // ไปหน้าอื่น = ล้างค่าที่ค้างในฟอร์ม
  render.last = path;
  const hasData = state && (state.records.length || state.yearEnds.length);
  if (parts[0] === 'data') return parts[1] === 'restore' ? renderRestore() : renderData();
  if (loadError) return renderData();
  if (!hasData) return parts[0] === 'data' ? renderData() : renderStart();
  if (!state.records.length && parts[0] !== 'record' && parts[0] !== 'history') return renderStart();
  switch (parts[0]) {
    case 'record':
      if (parts[1] === 'balance') return renderBalance(parts[2] || null);
      if (parts[1] === 'yearend') { const q = new URLSearchParams(query || ''); return renderYearEnd(parts[2] ? +parts[2] : null, {}, {}, q.get('y') ? +q.get('y') : null); }
      if (parts[1] === 'deposit') return renderDeposit(parts[2] || null);
      if (parts[1] === 'plan') return renderPlan(parts[2] || null);
      if (parts[1] === 'saving') return renderSaving(parts[2] || null);
      return renderRecordMenu();
    case 'history':
      if (parts[1] === 'b') return renderBalanceDetail(parts[2], parts[3] === 'delete');
      if (parts[1] === 'y') return renderYearEndDetail(+parts[2], parts[3] === 'delete');
      if (parts[1] === 'l') return renderLedgerDetail(decodeURIComponent(parts[2] || ''), parts[3] === 'delete');
      return renderHistory(new URLSearchParams(query || '').get('f'));
    case 'start': return state.records.length ? go('#/home') : renderStart();
    default: return renderHome();
  }
}

// ---------- เริ่มทำงาน ----------
const loaded = Store.load(localStorage);
if (loaded.ok) state = loaded.state; else loadError = loaded.why;
window.addEventListener('hashchange', render);
render();
})();

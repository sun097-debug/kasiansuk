// ทดสอบหน้าจออัตโนมัติขั้น Testing — 16 เกณฑ์ตรวจรับ (แผน Testing หัวข้อ 2) + ตัวเลขเช็กลิสต์ของซัน (หัวข้อ 7 ข้อ 0–5)
// AC-02, 03, 08, 09, 10, 12, 14, 15, 17, 18, 19, 23, 24, 26, 33, 35 · ตรวจค่าบนจอ ไม่ใช่ถ่ายภาพ · ตัวเลขสมมติทั้งหมด (ชุด T01)
// รัน: เปิดเซิร์ฟเวอร์ `python3 -m http.server 8765` ที่โฟลเดอร์แอพ แล้ว `node dev/e2e-testing.js`
// ใช้นาฬิกาจำลอง: 16 ธ.ค. 2569 (วันที่ซันจะทำเช็กลิสต์) และ 5 ม.ค. 2570 (ขึ้นปีใหม่)
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = 'http://localhost:8765/';
const ORIGIN = new globalThis.URL(URL).origin;
const T01 = path.join(__dirname, '..', 'test-data', 'testing-ledger.json');
let pass = 0, fail = 0;
const check = (id, name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'} | ${id} | ${name}${info ? ' | ' + info : ''}`); };
const has = (text, words) => words.every(w => text.includes(w));
const missing = (text, words) => words.filter(w => !text.includes(w)).join(', ');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const errs = [], requests = [];
  let n = 0;
  const newPage = async clockIso => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'th-TH', timezoneId: 'Asia/Bangkok', acceptDownloads: true });
    await ctx.addInitScript(() => localStorage.setItem('kasiansuk.installHidden', '1'));   // ปิดกล่องแนะนำไอคอน (ไม่ใช่เรื่องที่ตรวจในชุดนี้)
    ctx.on('request', r => requests.push(r.url()));
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.clock.setFixedTime(new Date(clockIso + 'T10:00:00+07:00'));
    return p;
  };
  const go = async (p, hash, wait) => { await p.goto(URL + '?r=' + (++n) + hash); if (wait) await p.waitForSelector(wait); };
  const main = p => p.innerText('main');
  const sel = async (p, d, m, yBE) => { await p.selectOption('#date-d', String(d)); await p.selectOption('#date-m', String(m)); await p.selectOption('#date-y', String(yBE)); };
  const formDate = async p => { const [d, m, y] = await Promise.all(['d', 'm', 'y'].map(k => p.inputValue('#date-' + k)));
    return `${+y - 543}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
  const submit = async (p, form) => { await p.click(`${form} button[type=submit]`); await p.waitForTimeout(250); };
  const dots = async p => p.$$eval('.chart svg[role=img] circle[fill="#2E7D63"]', c => c.length).catch(() => 0);
  const chartLabel = p => p.getAttribute('.chart svg[role=img]', 'aria-label').then(v => v || '').catch(() => '');
  const restore = async (p, file = T01) => {
    await go(p, '#/data', '#restore-file'); await p.setInputFiles('#restore-file', file); await p.waitForSelector('#do-restore');
    const summary = await main(p); await p.click('#do-restore'); await p.waitForSelector('.big-money'); return summary;
  };

  // =====================================================================
  // 1. ผู้ใช้ใหม่ (นาฬิกา 16 ธ.ค. 2569) — AC-24, AC-03, AC-09, AC-33
  // =====================================================================
  const a = await newPage('2026-12-16');
  await go(a, '#/start', '#start-form');
  const imp = await a.$$eval('.important li', l => l.map(x => x.innerText.trim()));
  check('AC-24', 'หน้าเริ่มใช้แสดงข้อความสำคัญ 3 ข้อก่อนกรอก', imp.length === 3 && has(imp.join('|'), ['ไม่ใช่คำแนะนำการลงทุน', 'ไม่ใช่บริการทางการของ กบข.', 'ข้อมูลอยู่ในเครื่องคุณเท่านั้น']), JSON.stringify(imp));
  check('AC-03', 'หน้าเริ่มใช้: วันที่เติมไว้ 2 วันก่อน (14 ธ.ค.) + คำช่วย "ไม่ใช่วันที่กรอก"', (await formDate(a)) === '2026-12-14' && (await a.innerText('#start-form')).includes('ไม่ใช่วันที่กรอก'), await formDate(a));
  await go(a, '#/data', '#restore-file');
  const impData = await a.$$eval('main ul li', l => l.map(x => x.innerText.trim()));
  check('AC-24', 'เปิดดูข้อความสำคัญซ้ำได้ในหน้าสำรองข้อมูล (3 ข้อ + อีก 2 ข้อ)', has(impData.join('|'), ['ไม่ใช่คำแนะนำการลงทุน', 'ไม่ใช่บริการทางการของ กบข.', 'ข้อมูลอยู่ในเครื่องคุณเท่านั้น', 'กรอกเองจาก My GPF', 'ใช้ประกอบการตัดสินใจเท่านั้น']));
  // สมาชิกใหม่: ยอดแรก 52,000 (เงินต้น 25,000 / 25,000)
  await go(a, '#/start', '#start-form');
  await a.fill('#f-v', '52000'); await a.fill('#f-pm', '25000'); await a.fill('#f-pg', '25000'); await submit(a, '#start-form'); await a.waitForSelector('.big-money');
  let t = await main(a);
  check('AC-09', 'ยังไม่มียอดสิ้นปี → "ยังไม่มียอดสิ้นปีก่อน" + ปุ่มเติม ไม่แสดงกำไร/%/0', t.includes('ยังไม่มียอดสิ้นปีก่อน') && !(await a.isVisible('.tiles')) && (await a.isVisible('.empty-why a[href="#/record/yearend?y=2025"]')));
  check('AC-33', 'ยังไม่กรอกยอดสิ้นปีเลย → แอพไม่ถือเป็น 0 เอง', !t.includes('ปีแรกที่เป็นสมาชิก') && !(await a.isVisible('.tiles')));
  await a.click('.empty-why a[href="#/record/yearend?y=2025"]'); await a.waitForSelector('#ye-form');
  await a.fill('#f-v', '0'); await a.fill('#f-pm', '0'); await a.fill('#f-pg', '0'); await submit(a, '#ye-form');
  const zSheet = await a.isVisible('#sheet') ? await a.innerText('#sheet') : '';
  check('AC-33', 'กรอกยอดสิ้นปี 0 ทุกช่อง → ถามยืนยัน "ปี 2568 ยังไม่ได้เป็นสมาชิก กบข. ใช่ไหม"', zSheet.includes('ปี 2568 ยังไม่ได้เป็นสมาชิก กบข. ใช่ไหม'), zSheet.split('\n')[0]);
  await a.click('#z-yes'); await a.waitForSelector('.tiles');
  t = await main(a);
  check('AC-33', 'ยืนยันครั้งเดียวแล้วบันทึกเลย ไม่ถามซ้ำ', !(await a.isVisible('#sheet')));
  check('AC-33', 'หน้าหลักแสดงกำไร 2,000.00 + เงินที่ส่งเข้าไป 50,000.00 แต่ % แสดงเหตุผล "ปีแรกที่เป็นสมาชิก" แทนตัวเลข',
    has(await a.innerText('.tiles'), ['2,000.00', 'ปีแรกที่เป็นสมาชิก']) && t.includes('50,000.00') && !/\d\.\d\d%/.test(await a.innerText('.tiles')), missing(t, ['2,000.00', '50,000.00', 'ปีแรกที่เป็นสมาชิก']));

  // =====================================================================
  // 2. กู้คืนไฟล์ทดสอบ testing-ledger.json (นาฬิกา 16 ธ.ค. 2569) — เช็กลิสต์ข้อ 0–1, AC-12, AC-14, AC-15, AC-26
  // =====================================================================
  const p = await newPage('2026-12-16');
  const sum = await restore(p);
  check('เช็กลิสต์ 0', 'สรุปก่อนกู้คืนบอกจำนวนแต่ละประเภท (ยอดเงิน 4 · ยอดสิ้นปี 1 · เงินนำส่ง 3 · เปลี่ยนแผน 3 · ออมเพิ่ม 2)',
    /ยอดเงิน\s*4 รายการ/.test(sum) && /ยอดสิ้นปี\s*1 รายการ/.test(sum) && /เงินนำส่ง\s*3 รายการ/.test(sum) && /เปลี่ยนแผน\s*3 รายการ/.test(sum) && /ออมเพิ่ม\s*2 รายการ/.test(sum));
  t = await main(p);
  const home1 = ['943,310.00', '+3,310.00', '48,310.00', '5.54%', '45,000.00', '22,500.00', 'คำนวณถึง 15 พ.ย. 2569'];
  check('เช็กลิสต์ 1', 'หน้าหลัก: 943,310.00 · +3,310.00 · กำไร 48,310.00 · 5.54% · 45,000.00 (22,500.00 / 22,500.00)', has(t, home1), missing(t, home1));
  check('เช็กลิสต์ 1', 'บรรทัด "จดไว้" = แผนผสมสัดส่วนเอง · ออมเพิ่ม 5%', (await p.innerText('.nb-line')).includes('แผนผสมสัดส่วนเอง · ออมเพิ่ม 5%'));
  check('เช็กลิสต์ 1', 'ยังไม่มีป้าย "อาจสูงเกินจริง" (ยอดล่าสุด 15 พ.ย. เงินต้นเพิ่งเปลี่ยน)', !t.includes('อาจสูงเกินจริง'));
  const change = await p.innerText('.change');
  check('AC-12', 'ยอดเปลี่ยน +3,310.00 ป้าย "ยอดเปลี่ยนจากครั้งก่อน" ไม่เรียกว่ากำไร ไม่มี "จากเมื่อวาน" + บอก "เทียบกับ 15 ต.ค. 2569"',
    change.includes('ยอดเปลี่ยนจากครั้งก่อน') && change.includes('+3,310.00') && !change.includes('กำไร') && !t.includes('เมื่อวาน') && t.includes('เทียบกับ 15 ต.ค. 2569'), change.replace(/\n/g, ' '));
  const pctTile = await p.innerText('.tiles .tile:nth-child(2)');
  check('AC-14', '% ปีนี้ทศนิยม 2 ตำแหน่ง ติดคำ "ประมาณ" ไม่แปลงต่อปี', /\b5\.54%/.test(pctTile) && pctTile.includes('ประมาณ') && !pctTile.includes('ต่อปี'), pctTile.replace(/\n/g, ' '));
  await p.click('button[data-help="pct"]'); await p.waitForSelector('#sheet');
  const pctHelp = await p.innerText('#sheet');
  check('AC-14', 'ลิงก์ "ต่างจาก My GPF อย่างไร" เปิดคำอธิบายเรื่องอัตราเฉลี่ยของ My GPF', has(pctHelp, ['My GPF', 'อัตราเฉลี่ยต่อปี']));
  await p.click('#sheet [data-close]');
  check('AC-15', 'แสดง "คำนวณถึง 15 พ.ย. 2569" และ "เงินต้นอัปเดตล่าสุด 15 พ.ย. 2569"', has(t, ['คำนวณถึง 15 พ.ย. 2569', 'เงินต้นอัปเดตล่าสุด 15 พ.ย. 2569']));
  // AC-26 กราฟ: จุดเฉพาะวันที่บันทึกจริง (ยอดเงิน + ยอดสิ้นปี) — ไฟล์มี 4 ยอดเงิน (1 ยอดอยู่ปี 2568) + ยอดสิ้นปี 2568
  check('AC-26', 'กราฟ "ปีนี้" 4 จุด = ยอดสิ้นปี 2568 + 3 ยอดปี 2569 (15 ส.ค. 15 ต.ค. 15 พ.ย.)', (await dots(p)) === 4 && (await chartLabel(p)).includes('ตั้งแต่ 31 ธ.ค. 2568 ถึง 15 พ.ย. 2569'), `${await dots(p)} จุด`);
  await p.click('[data-range="all"]'); await p.waitForTimeout(150);
  check('AC-26', 'กราฟ "ทั้งหมด" 5 จุด เริ่ม 15 มิ.ย. 2568 — ไม่มีจุดแทรกวันอื่น (เงินนำส่ง/สมุดไม่ขึ้นกราฟ)', (await dots(p)) === 5 && (await chartLabel(p)).includes('ตั้งแต่ 15 มิ.ย. 2568'), `${await dots(p)} จุด`);
  await p.click('[data-range="year"]');

  // =====================================================================
  // 3. บันทึกยอดใหม่โดยไม่แก้เงินต้น — เช็กลิสต์ข้อ 2, AC-02, AC-03, AC-16
  // =====================================================================
  await go(p, '#/record/balance', '#bal-form');
  check('AC-02', 'ช่องเงินต้นเติมค่าล่าสุดไว้ 322,500 ทั้ง 2 ช่อง', (await p.inputValue('#f-pm')) === '322,500' && (await p.inputValue('#f-pg')) === '322,500');
  check('AC-03', 'ฟอร์มบันทึกยอดใหม่: วันที่เติมไว้ 14 ธ.ค. 2569 (2 วันก่อน) + คำช่วย "ไม่ใช่วันที่กรอก"', (await formDate(p)) === '2026-12-14' && (await p.innerText('#bal-form')).includes('ไม่ใช่วันที่กรอก'), await formDate(p));
  check('AC-16', 'พลาด 1 รอบ (25 พ.ย.) → กล่องพีชในฟอร์ม บอก "ตั้งแต่ 15 พ.ย. 2569"', await p.isVisible('#principal-hint') && (await p.innerText('#principal-hint')).includes('15 พ.ย. 2569'));
  await p.fill('#f-v', '945000'); await submit(p, '#bal-form');
  check('AC-02 / AC-16', 'ไม่แก้เงินต้นก็บันทึกได้ และไม่เด้งถาม (พลาดแค่ 1 รอบ)', !(await p.isVisible('#sheet')) && (await p.isVisible('.big-money')));
  t = await main(p);
  const home2 = ['945,000.00', '+1,690.00', '50,000.00', 'อาจสูงเกินจริง', 'ข้อมูลวันที่ 14 ธ.ค. 2569'];
  check('เช็กลิสต์ 2', 'หน้าหลัก: 945,000.00 · +1,690.00 · กำไร 50,000.00 + ป้าย "อาจสูงเกินจริง"', has(t, home2), missing(t, home2));
  await go(p, '#/history/b/2026-12-14', '.kv');
  check('AC-02', 'รายการใหม่เก็บเงินต้นที่เติมไว้ (322,500.00 / 322,500.00 รวม 645,000.00)', has(await main(p), ['322,500.00', '645,000.00']));

  // =====================================================================
  // 4. แก้และลบรายการยอดเงิน — เช็กลิสต์ข้อ 3, AC-17, AC-18
  // =====================================================================
  await go(p, '#/history', '.hist-item');
  const first = await p.innerText('.hist-item >> nth=0');
  check('AC-17', 'ประวัติเรียงใหม่ → เก่า รายการแรกคือ 14 ธ.ค. 2569', first.includes('14 ธ.ค. 2569'), first.split('\n')[0]);
  await p.click('a[href="#/history/b/2026-12-14"]'); await p.waitForSelector('.kv');
  await p.click('a[href="#/record/balance/2026-12-14"]'); await p.waitForSelector('#bal-form');
  check('AC-17', 'แตะ "แก้" เปิดฟอร์มพร้อมวันที่เดิม (14 ธ.ค.) และค่าเดิม', (await formDate(p)) === '2026-12-14' && (await p.inputValue('#f-v')) === '945,000');
  await p.fill('#f-pm', '324750'); await p.fill('#f-pg', '324750'); await submit(p, '#bal-form'); await p.waitForSelector('.kv');
  await go(p, '#/', '.big-money'); t = await main(p);
  const home3 = ['45,500.00', '49,500.00'];
  check('AC-18', 'แก้เงินต้นแล้วหน้าหลักเปลี่ยนเอง: กำไร 45,500.00 · เงินที่ส่งเข้าไป 49,500.00 · ป้าย "อาจสูงเกินจริง" หาย', has(t, home3) && !t.includes('อาจสูงเกินจริง'), missing(t, home3));
  check('AC-18', 'กราฟเปลี่ยนตาม: 5 จุด ยอดล่าสุด 945,000.00', (await dots(p)) === 5 && (await chartLabel(p)).includes('945,000.00'), `${await dots(p)} จุด`);
  await go(p, '#/history', '.hist-item');
  check('AC-18', 'ประวัติเปลี่ยนตาม: เงินต้นรวม 649,500.00 · เพิ่มจากครั้งก่อน +4,500.00', has(await p.innerText('.hist-item >> nth=0'), ['649,500.00', '+4,500.00']));
  await go(p, '#/history/b/2026-12-14', '.kv');
  await p.click('main a.btn-danger'); await p.waitForSelector('#do-del');
  check('AC-17', 'ลบต้องยืนยัน: "ลบรายการวันที่ 14 ธ.ค. 2569 ใช่ไหม"', (await p.innerText('.warn-box')).includes('ลบรายการวันที่ 14 ธ.ค. 2569 ใช่ไหม'));
  await p.click('.warn-box a.btn-soft'); await p.waitForSelector('.kv');
  check('AC-17', 'กด "ยกเลิก" แล้วรายการยังอยู่', (await main(p)).includes('945,000.00'));
  await p.click('main a.btn-danger'); await p.waitForSelector('#do-del'); await p.click('#do-del'); await p.waitForSelector('.hist-item');
  check('AC-17', 'กด "ลบ" แล้วรายการหายจากประวัติ', !(await main(p)).includes('14 ธ.ค. 2569'));
  await go(p, '#/', '.big-money'); t = await main(p);
  check('AC-18 / เช็กลิสต์ 3', 'ลบแล้วหน้าหลักกลับเป็นตัวเลขข้อ 1 และกราฟกลับเป็น 4 จุด', has(t, home1) && (await dots(p)) === 4, missing(t, home1));

  // =====================================================================
  // 5. ยอดสิ้นปี: เข้าจากเมนู แก้ ลบ เติมใหม่ — เช็กลิสต์ข้อ 5, AC-08, AC-09, AC-17, AC-18
  // =====================================================================
  await go(p, '#/record', '.menu-list');
  check('AC-08', 'เมนูบันทึกมีปุ่มยอดสิ้นปี (เข้าได้ทุกเมื่อ ไม่ต้องผ่านเช็กลิสต์)', await p.isVisible('a[href="#/record/yearend"]'));
  await p.click('a[href="#/record/yearend"]'); await p.waitForSelector('#ye-form');
  await p.click('button[data-help="yearend"]'); await p.waitForSelector('#sheet');
  check('AC-08', 'คำช่วยบอกเส้นทาง "ดูยอดเงินย้อนหลังรายปี"', (await p.innerText('#sheet')).includes('ดูยอดเงินย้อนหลังรายปี'));
  await p.click('#sheet [data-close]');
  await go(p, '#/history/y/2025', '.kv'); await p.click('a[href="#/record/yearend/2025"]'); await p.waitForSelector('#ye-form');
  await p.fill('#f-v', '860000'); await submit(p, '#ye-form'); await p.waitForSelector('.kv');
  await go(p, '#/', '.big-money');
  check('AC-17 / AC-18', 'แก้ยอดสิ้นปีเป็น 860,000 → กำไรปีนี้เปลี่ยนเป็น 38,310.00 เอง', (await p.innerText('.tiles')).includes('38,310.00'));
  await go(p, '#/history/y/2025', '.kv'); await p.click('main a.btn-danger'); await p.waitForSelector('#do-del');
  check('AC-17', 'ลบยอดสิ้นปีต้องยืนยัน', (await p.innerText('.warn-box')).includes('ลบยอดสิ้นปี 2568 ใช่ไหม'));
  await p.click('#do-del'); await go(p, '#/', '.big-money'); t = await main(p);
  check('AC-09', 'ลบยอดสิ้นปีแล้ว → การ์ดปีนี้บอกเหตุผล ("ยังแสดงไม่ได้: รอยอดสิ้นปี 2568") ไม่แสดงกำไร/% เป็น 0', t.includes('ยังแสดงไม่ได้') && t.includes('รอยอดสิ้นปี 2568') && !(await p.isVisible('.tiles')));
  await go(p, '#/record', '.menu-list'); await p.click('a[href="#/record/yearend"]'); await p.waitForSelector('#ye-form');
  check('AC-08', 'ฟอร์มยอดสิ้นปีเติม 31 ธ.ค. 2568 ไว้ให้ หัวหน้า "ยอดสิ้นปี 2568"', (await formDate(p)) === '2025-12-31' && (await p.innerText('.page-head')).includes('ยอดสิ้นปี 2568'));
  await p.fill('#f-v', '850000'); await p.fill('#f-pm', '300000'); await p.fill('#f-pg', '300000'); await submit(p, '#ye-form'); await p.waitForSelector('.tiles');
  check('AC-08 / AC-18', 'เติมยอดสิ้นปีกลับ → ตัวเลขกลับเป็นข้อ 1', has(await main(p), home1));
  // ยอดล่าสุดไม่มีเงินต้น → ไม่ใช้เงินต้นของรายการเก่า
  await go(p, '#/record/balance', '#bal-form'); await p.fill('#f-v', '944000'); await p.fill('#f-pm', ''); await p.fill('#f-pg', ''); await submit(p, '#bal-form'); await p.waitForSelector('.big-money');
  t = await main(p);
  check('AC-09', 'ยอดล่าสุดไม่มีเงินต้น → "ยังไม่มีเงินต้นของยอดล่าสุด" ไม่คำนวณกำไรจากเงินต้นเก่า', t.includes('ยังไม่มีเงินต้นของยอดล่าสุด') && !(await p.isVisible('.tiles')));
  await go(p, '#/history/b/2026-12-14/delete', '#do-del'); await p.click('#do-del'); await p.waitForSelector('.hist-item');

  // ส่วนที่เหลือของแอพ — ใช้ทุกหน้าเพื่อดูการเชื่อมต่อ (AC-23, AC-35)
  for (const h of ['#/record/deposit', '#/record/plan', '#/record/saving', '#/history?f=deposit', '#/history?f=plan', '#/history?f=saving', '#/history/l/t01-plan-2607'])
    await go(p, h, 'main');
  for (const s of ['hot', 'rain', 'snow', 'mist']) { await p.goto(URL + '?season=' + s + '&r=' + (++n) + '#/'); await p.waitForSelector('.big-money'); }
  await go(p, '#/data', '#do-backup'); await p.click('#do-backup'); await p.waitForSelector('#bk-go');
  const dl = p.waitForEvent('download', { timeout: 3000 }).catch(() => null);
  await p.click('#bk-go'); const file = await dl;
  check('ประกอบ AC-23', 'กดสำรองแล้วได้ไฟล์ในเครื่อง (ไม่ได้ส่งไปที่ใด)', !!file && /^kasiansuk-backup-2569-12-16/.test(file.suggestedFilename()), file ? file.suggestedFilename() : 'ไม่มีไฟล์');

  // =====================================================================
  // 6. ขึ้นปีใหม่ (นาฬิกา 5 ม.ค. 2570) — AC-10, AC-19
  // =====================================================================
  const y = await newPage('2027-01-05');
  await restore(y);
  await go(y, '#/record/balance', '#bal-form'); await sel(y, 31, 12, 2569);
  await y.fill('#f-v', '955000'); await y.fill('#f-pm', '327000'); await y.fill('#f-pg', '327000'); await submit(y, '#bal-form'); await y.waitForSelector('.big-money');
  await go(y, '#/record/balance', '#bal-form');
  check('AC-03', 'ข้ามปี: เปิด 5 ม.ค. 2570 → วันที่เติมไว้ 3 ม.ค. 2570', (await formDate(y)) === '2027-01-03', await formDate(y));
  await y.fill('#f-v', '956000'); await submit(y, '#bal-form'); await y.waitForSelector('.big-money');
  t = await main(y);
  check('AC-10', 'มียอดวันที่ 31 ธ.ค. 2569 แต่ไม่มียอดสิ้นปี → แอพไม่ใช้ยอด 31 ธ.ค. แทนยอดสิ้นปีเอง', !(await y.isVisible('.tiles')) && t.includes('รอยอดสิ้นปี 2569'));
  check('AC-19', 'ขึ้นปีใหม่ยังไม่เติมยอดสิ้นปี 2569 → "รอยอดสิ้นปี 2569" + ปุ่มเติม ไม่แสดง 0', t.includes('รอยอดสิ้นปี 2569') && (await y.isVisible('.empty-why a[href="#/record/yearend?y=2026"]')) && !t.includes('ปี 2570'));
  await go(y, '#/history', '.hist-item'); t = await main(y);
  const y2569 = ['ปี 2569', '31 ธ.ค. 2569', '15 พ.ย. 2569', '15 ต.ค. 2569', '15 ส.ค. 2569', '27 ต.ค. 2569', '1 ก.ค. 2569', '1 เม.ย. 2569', 'ปี 2568', 'ยอดสิ้นปี 2568', 'ปี 2567'];
  check('AC-19', 'ประวัติปีก่อน ๆ อยู่ครบ (ยอดเงิน สมุด และยอดสิ้นปี ปี 2567–2569)', has(t, y2569) && t.indexOf('ปี 2570') < t.indexOf('ปี 2569'), missing(t, y2569));
  await go(y, '#/', '.big-money'); await y.click('.empty-why a[href="#/record/yearend?y=2026"]'); await y.waitForSelector('#ye-form');
  check('AC-19', 'ปุ่มเติมพาไปฟอร์มยอดสิ้นปี 2569 (31 ธ.ค. 2569)', (await formDate(y)) === '2026-12-31');
  await y.fill('#f-v', '955000'); await y.fill('#f-pm', '327000'); await y.fill('#f-pg', '327000'); await submit(y, '#ye-form'); await y.waitForSelector('.tiles');
  t = await main(y);
  check('AC-19', 'เติมยอดสิ้นปี 2569 แล้ว → กำไรปีนี้ (2570) 1,000.00 · เงินที่ส่งเข้าไป 0.00', has(await y.innerText('.tiles'), ['กำไรปีนี้', '1,000.00']) && /เงินที่ส่งเข้าไปปีนี้\s*0\.00/.test(t));

  // =====================================================================
  // 7. การเชื่อมต่อ (AC-23, AC-35) — ทุกหน้าในชุดนี้ติดต่อแค่ที่อยู่ของแอพ
  // =====================================================================
  const outside = [...new Set(requests.filter(u => !u.startsWith(ORIGIN + '/') && !u.startsWith('data:') && !u.startsWith('blob:')))];
  check('AC-23 / AC-35', `ทุกการเชื่อมต่อ (${requests.length} ครั้ง) ไปที่ที่อยู่ของแอพเท่านั้น ไม่มีเว็บอื่น`, requests.length > 0 && outside.length === 0, outside.slice(0, 5).join(' '));
  const appFiles = ['index.html', 'manifest.webmanifest', ...fs.readdirSync(path.join(__dirname, '..', 'js')).map(f => 'js/' + f), ...fs.readdirSync(path.join(__dirname, '..', 'css')).map(f => 'css/' + f)];
  const urls = appFiles.flatMap(f => (fs.readFileSync(path.join(__dirname, '..', f), 'utf8').match(/https?:\/\/[^\s'"`)<>]+/g) || []).map(u => `${f}: ${u}`));
  check('AC-35', `ในไฟล์ของแอพ (${appFiles.length} ไฟล์) ไม่มีที่อยู่เว็บอื่น`, urls.length === 0, urls.slice(0, 5).join(' '));

  check('—', 'ไม่มีข้อผิดพลาดในหน้า', errs.length === 0, errs.slice(0, 3).join(' / '));
  console.log(`\nรวม ผ่าน ${pass} / ไม่ผ่าน ${fail}`); await browser.close(); if (fail) process.exitCode = 1;
})();

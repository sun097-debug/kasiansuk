// ทดสอบหน้าจอสมุดบันทึกแบบอัตโนมัติ (0.4.0 · ปรับตาม 0.4.1) — ตัวเลขสมมติทั้งหมด
// รัน: เปิดเซิร์ฟเวอร์ `python3 -m http.server 8765` ที่โฟลเดอร์แอพ แล้ว `node dev/e2e-ledger.js`
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const SHOTS = process.env.SHOTS || '/tmp/shots'; fs.mkdirSync(SHOTS, { recursive: true });
const URL = 'http://localhost:8765/';
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'} | ${name}${info ? ' | ' + info : ''}`); };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const errs = [];
  const newPage = async (opts = devices['iPhone 13']) => {
    const ctx = await browser.newContext({ ...opts, locale: 'th-TH', timezoneId: 'Asia/Bangkok', acceptDownloads: true });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    return p;
  };
  const sel = async (p, d, m, y) => { await p.selectOption('#date-d', String(d)); await p.selectOption('#date-m', String(m)); await p.selectOption('#date-y', String(y)); };
  const shot = (p, n) => p.screenshot({ path: `${SHOTS}/L${n}.png`, fullPage: true });
  const restore = async (p, file) => { await p.goto(URL + '#/data'); await p.setInputFiles('#restore-file', file); await p.waitForSelector('#do-restore'); };

  // ---------- 1. ไฟล์สำรองรุ่นเก่า (ชุด T01) กู้คืนในรุ่นนี้ได้ ตัวเลขเท่าเดิม ----------
  const page = await newPage();
  await restore(page, path.join(__dirname, '..', 'test-data', 'h10-safari.json'));
  await page.click('#do-restore'); await page.waitForSelector('.tiles');
  const home0 = await page.innerText('main');
  check('H10 ไฟล์เก่ากู้คืนได้ หน้าหลักตรง T01 (943,310.00 / 48,310.00 / 5.54% / 45,000.00)', ['943,310.00', '48,310.00', '5.54%', '45,000.00'].every(w => home0.includes(w)));
  check('AC-32 ยังไม่เคยจดสมุด → หน้าหลักไม่มีสรุปสมุด ไม่ชวนให้จด', !(await page.isVisible('.nb-sum')) && !home0.includes('จดไว้'));
  const yearCard0 = await page.innerText('.tiles');

  // ---------- 2. เมนูบันทึก 5 อย่าง ----------
  await page.goto(URL + '#/record'); await page.waitForSelector('.menu-list');
  const items = await page.$$eval('.menu-item', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
  check('F-16 เมนูบันทึก 5 ปุ่ม บันทึกยอดใหม่บนสุด สมุด 3 อย่างติด "ไม่บังคับ" ยอดสิ้นปีท้ายสุด (0.4.1)', items.length === 5 && items[0].startsWith('บันทึกยอดใหม่') && items.slice(1, 4).every(t => t.includes('ไม่บังคับ')) && items[4].startsWith('ยอดสิ้นปี') && items[4].includes('ปีละครั้ง'), JSON.stringify(items));
  check('หัวหน้า "บันทึก" + บรรทัด "วันนี้จะจดอะไรลงสมุด" (0.4.1)', (await page.innerText('.page-head')).includes('วันนี้จะจดอะไรลงสมุด'));
  check('ไม่มีบรรทัด "เร็ว ๆ นี้" แล้ว', !(await page.innerText('main')).includes('เร็ว ๆ นี้'));
  await shot(page, '01-menu');

  // ---------- 3. เงินนำส่ง (AC-27) ----------
  await page.click('a[href="#/record/deposit"]'); await page.waitForSelector('#lg-form');
  check('หน้าจดเงินนำส่งใช้หน้าตาแบบสมุด + บอกว่าไม่ใช้คำนวณ', await page.isVisible('.card.notebook') && (await page.innerText('main')).includes('จดไว้ดูย้อนหลัง กำไรคำนวณจากเงินต้น'));
  await sel(page, 27, 10, 2569); await page.fill('#f-a', ''); await page.click('#lg-form button[type=submit]');
  check('ว่าง → บันทึกไม่ได้ บอกช่อง', (await page.innerText('#lg-form')).includes('กรุณากรอกจำนวนเงิน'));
  await sel(page, 27, 10, 2569); await page.fill('#f-a', '4500'); await page.click('#lg-form button[type=submit]');
  await page.waitForSelector('.recent');
  check('บันทึกแล้วอยู่หน้าเดิม ล้างช่อง และแสดงรายการล่าสุด', (await page.inputValue('#f-a')) === '' && (await page.innerText('.recent')).includes('4,500.00'));
  await sel(page, 25, 9, 2569); await page.fill('#f-a', '4500'); await page.click('#lg-form button[type=submit]'); await page.waitForTimeout(150);
  await sel(page, 27, 10, 2569); await page.fill('#f-a', '9999'); await page.click('#lg-form button[type=submit]');
  check('AC-27 วันซ้ำ → "มีเงินนำส่งวันที่นี้แล้ว" + ปุ่มไปแก้รายการเดิม', await page.isVisible('text=มีเงินนำส่งวันที่นี้แล้ว') && await page.isVisible('text=ไปแก้รายการเดิม'));
  await shot(page, '02-deposit');
  await page.goto(URL + '#/home'); await page.waitForSelector('.tiles');
  check('AC-27 จดเงินนำส่งแล้ว ตัวเลขบนหน้าหลักไม่เปลี่ยน', (await page.innerText('.tiles')) === yearCard0);

  // ---------- 4. เปลี่ยนแผน (AC-28) ----------
  await page.goto(URL + '#/record/plan'); await page.waitForSelector('#f-plan');
  const opts = await page.$$eval('#f-plan option', os => os.map(o => o.textContent));
  check('รายชื่อแผน 12 + ปิดรับแล้ว + แผนอื่น (พิมพ์เอง)', opts.length === 1 + 12 + 1 + 1 + 1 && opts.includes('แผนสมดุลตามอายุ (สัดส่วนเดิม) · ปิดรับแล้ว') && opts.includes('แผนอื่น (พิมพ์เอง)'));
  check('ยังไม่เลือกแผนผสม → ไม่เห็นช่อง %', !(await page.isVisible('#mix-box')));
  check('หัวช่องวันที่ใช้คำตาม My GPF "ได้มูลค่าหน่วยลงทุนวันที่" (0.4.1)', (await page.innerText('#lg-form legend')).includes('ได้มูลค่าหน่วยลงทุนวันที่'));
  await sel(page, 1, 10, 2569); await page.selectOption('#f-plan', 'แผนผสมสัดส่วนเอง');
  check('เลือกแผนผสม → เห็น 7 ช่อง %', await page.isVisible('#mix-box') && (await page.$$('#mix-box input')).length === 7);
  await page.fill('#f-mix-1', '30'); await page.fill('#f-mix-5', '20');
  check('รวมไม่ถึง 100 → แสดงผลรวม และปุ่มบันทึกกดไม่ได้', (await page.innerText('#mix-total')).includes('รวมตอนนี้ 50%') && await page.isDisabled('#lg-form button[type=submit]'));
  await page.fill('#f-mix-6', '20.5');
  check('ใส่ทศนิยม → ช่องกรอบแดง + ข้อความใต้ช่องว่าใส่ได้เฉพาะจำนวนเต็ม', (await page.getAttribute('#f-mix-6', 'aria-invalid')) === 'true' && (await page.innerText('#mix-err-6')).includes('จำนวนเต็ม') && (await page.innerText('#mix-total')).includes('กรอบสีแดง'));
  await page.fill('#f-mix-6', '20'); await page.fill('#f-mix-3', '30');
  check('ทองคำ 30 (รวม 100) → ขึ้นข้อความที่ช่องทองคำทันทีระหว่างพิมพ์ และปุ่มบันทึกกดไม่ได้ (0.4.1)', (await page.innerText('#mix-err-3')).includes('ไม่เกิน 25%') && await page.isDisabled('#lg-form button[type=submit]'));
  await shot(page, '03a-plan-gold-over');
  await page.fill('#f-mix-3', '20'); await page.fill('#f-mix-6', '30');
  check('ทองคำ 20 รวม 100 → "ครบแล้ว" และกดบันทึกได้', (await page.innerText('#mix-total')).includes('100% ครบแล้ว') && !(await page.isDisabled('#lg-form button[type=submit]')) && !(await page.isVisible('#mix-err-3')));
  await shot(page, '03-plan-mix');
  await page.click('#lg-form button[type=submit]'); await page.waitForSelector('.chips');
  check('บันทึกแล้ว → ไปประวัติกรองเปลี่ยนแผน', (await page.innerText('main')).includes('→ แผนผสมสัดส่วนเอง') && (await page.innerText('main')).includes('ทองคำ 20%'));
  // แผนอื่น (พิมพ์เอง)
  await page.goto(URL + '#/record/plan'); await page.waitForSelector('#f-plan');
  await sel(page, 1, 3, 2563); await page.selectOption('#f-plan', 'แผนอื่น (พิมพ์เอง)');
  check('เลือกแผนอื่น → เห็นช่องพิมพ์ชื่อ', await page.isVisible('#f-other'));
  await page.click('#lg-form button[type=submit]');
  check('ไม่พิมพ์ชื่อ → บันทึกไม่ได้', (await page.innerText('#lg-form')).includes('กรุณาพิมพ์ชื่อแผน'));
  await page.fill('#f-other', 'แผนหลัก'); await page.click('#lg-form button[type=submit]'); await page.waitForSelector('.chips');

  // ---------- 5. ออมเพิ่ม (AC-29) ----------
  await page.goto(URL + '#/record/saving'); await page.waitForSelector('#f-rate');
  check('มีคำอธิบาย "ไม่รวมเงินสะสมภาคบังคับ 3%"', (await page.innerText('main')).includes('ไม่รวมเงินสะสมภาคบังคับ 3%'));
  await sel(page, 1, 7, 2569); await page.fill('#f-rate', '2.5'); await page.click('#lg-form button[type=submit]');
  check('AC-29 ทศนิยม → บันทึกไม่ได้', (await page.innerText('#lg-form')).includes('จำนวนเต็ม'));
  await page.fill('#f-rate', '-3'); await page.click('#lg-form button[type=submit]');
  check('AC-29 ติดลบ → บันทึกไม่ได้', (await page.innerText('#lg-form')).includes('ติดลบไม่ได้'));
  await page.fill('#f-rate', ''); await page.type('#f-rate', '30');
  check('เกิน 27 → ขึ้นข้อความทันทีระหว่างพิมพ์ (ยังไม่กดบันทึก) (0.4.1)', await page.isVisible('#rate-err') && (await page.innerText('#rate-err')).includes('ไม่เกิน 27%'));
  await page.click('#lg-form button[type=submit]');
  check('เกิน 27 กดบันทึก → บันทึกไม่ได้ อยู่หน้าเดิม (0.4.1)', await page.isVisible('#f-rate') && (await page.innerText('#lg-form')).includes('ออมเพิ่มได้ไม่เกิน 27%'));
  await page.fill('#f-rate', ''); await page.type('#f-rate', '5');
  check('แก้เป็น 5 → ข้อความหายเอง', !(await page.isVisible('#rate-err')));
  await page.click('#lg-form button[type=submit]'); await page.waitForSelector('.chips');
  check('ออมเพิ่ม 5 → บันทึกได้ และไม่มี 30 ในสมุด', (await page.innerText('main')).includes('→ 5%') && !(await page.innerText('main')).includes('→ 30%'));
  await shot(page, '04-history-saving');

  // ---------- 6. ประวัติรวม + ตัวกรอง (AC-30) ----------
  await page.goto(URL + '#/history'); await page.waitForSelector('.chips');
  const tags = await page.$$eval('.hist-type', els => els.map(e => e.textContent.trim()));
  check('AC-30 ประวัติแสดงทุกประเภท ป้ายเป็นคำ', ['ยอดเงิน', 'เงินนำส่ง', 'เปลี่ยนแผน', 'ออมเพิ่ม'].every(t => tags.includes(t)) && tags.some(t => t.startsWith('ยอดสิ้นปี')), JSON.stringify(tags));
  const dates = await page.$$eval('.hist-item', els => els.map(e => e.querySelector('.row span').textContent));
  check('เรียงจากใหม่ไปเก่า (รายการแรกคือ 15 พ.ย. 2569)', dates[0] === '15 พ.ย. 2569', dates.slice(0, 4).join(', '));
  await shot(page, '05-history-all');
  for (const [k, label] of [['deposit', 'เงินนำส่ง'], ['plan', 'เปลี่ยนแผน'], ['saving', 'ออมเพิ่ม'], ['balance', 'ยอดเงิน']]) {
    await page.click(`.chips a[href="#/history?f=${k}"]`); await page.waitForSelector(`.chips a[aria-current="true"][href="#/history?f=${k}"]`);
    const t = await page.$$eval('.hist-type', els => els.map(e => e.textContent.trim()));
    const ok = t.length > 0 && t.every(x => (k === 'balance' ? (x === 'ยอดเงิน' || x.startsWith('ยอดสิ้นปี')) : x === label));
    check(`AC-30 ตัวกรอง "${label}" แสดงเฉพาะประเภทนั้น`, ok, JSON.stringify(t));
  }
  // ---------- 7. แก้ / ลบ รายการสมุด ----------
  await page.goto(URL + '#/history?f=deposit'); await page.click('.hist-item >> nth=0'); await page.waitForSelector('.kv');
  check('รายละเอียดเงินนำส่ง + ปุ่มแก้/ลบ + บอกว่าไม่ใช้คำนวณ', (await page.innerText('main')).includes('4,500.00') && await page.isVisible('text=ไม่ใช้คำนวณกำไร'));
  await page.click('.btn-row a:has-text("แก้")'); await page.waitForSelector('#lg-form');
  check('แก้รายการ: ช่องเติมค่าเดิมไว้', (await page.inputValue('#f-a')) === '4,500');
  await page.fill('#f-a', '4,600'); await page.click('#lg-form button[type=submit]'); await page.waitForSelector('.kv');
  check('แก้แล้วกลับไปหน้ารายละเอียด เห็นค่าใหม่', (await page.innerText('main')).includes('4,600.00'));
  await page.click('.btn-row a:has-text("ลบ")'); await page.waitForSelector('#do-del');
  check('ลบต้องยืนยัน "ลบรายการเงินนำส่งวันที่ ... ใช่ไหม"', (await page.innerText('.warn-box')).includes('ลบรายการเงินนำส่งวันที่'));
  await page.click('#do-del'); await page.waitForSelector('.chips');
  const depLeft = await page.evaluate(() => JSON.parse(localStorage.getItem('kasiansuk.data')).ledger.filter(x => x.type === 'deposit').length);
  check('ลบแล้วเหลือเงินนำส่ง 1 รายการ', depLeft === 1);
  // แก้แผนผสม: ค่า % เดิมกลับมาครบ
  await page.goto(URL + '#/history?f=plan'); await page.click('.hist-item:has-text("แผนผสม")'); await page.waitForSelector('.kv');
  check('รายละเอียดแผนผสมแสดงแต่ละแผนและ % + ป้ายวันที่ตาม My GPF', (await page.innerText('.kv')).includes('แผนทองคำ') && (await page.innerText('.kv')).includes('20%') && (await page.innerText('.kv')).includes('ได้มูลค่าหน่วยลงทุนวันที่'));
  await page.click('.btn-row a:has-text("แก้")'); await page.waitForSelector('#mix-box');
  check('แก้แผนผสม: % เดิมเติมไว้ครบ รวม 100', (await page.inputValue('#f-mix-3')) === '20' && (await page.innerText('#mix-total')).includes('100%'));

  // ---------- 8. หน้าหลัก: ตัวเลขไม่เปลี่ยน + สรุปสมุด (F-17) ----------
  await page.goto(URL + '#/home'); await page.waitForSelector('.tiles');
  check('หลังจดสมุดทั้ง 3 ประเภท ตัวเลขการ์ดปีนี้เท่าเดิมทุกตัว', (await page.innerText('.tiles')) === yearCard0);
  const sum = await page.isVisible('.card .nb-line') ? await page.innerText('.card .nb-line') : '';
  check('F-17 สรุปสมุด: บรรทัดเดียวในการ์ดบนสุด "จดไว้ แผนผสมสัดส่วนเอง · ออมเพิ่ม 5%" (0.4.1)', sum.includes('จดไว้') && sum.includes('แผนผสมสัดส่วนเอง') && sum.includes('ออมเพิ่ม 5%') && (await page.$('section.card:first-of-type .nb-line, main > section.card .nb-line')) !== null, sum.replace(/\s+/g, ' '));
  const firstCard = await page.$eval('main section.card', el => el.innerText);
  check('บรรทัดสรุปอยู่ในการ์ดแรก "วันนี้ในสมุด"', firstCard.includes('วันนี้ในสมุด') && firstCard.includes('ออมเพิ่ม 5%'));
  const banner = await page.isVisible('.banner');
  check('จดสมุดไม่ทำให้แถบชวนสำรองขึ้น (ซัน 21 พ.ย. — ไม่รบกวน)', !banner);
  await shot(page, '06-home');

  // ---------- 9. สำรอง → กู้คืนในเครื่องอื่น (AC-31) ----------
  await page.goto(URL + '#/data'); await page.click('#do-backup'); await page.waitForSelector('#bk-go');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bk-go')]);
  const bk = SHOTS + '/ledger-backup.json'; fs.copyFileSync(await dl.path(), bk);
  const p2 = await newPage(); await restore(p2, bk);
  const sumTxt = (await p2.innerText('.kv')).replace(/\s+/g, ' ');
  check('AC-31 สรุปก่อนกู้คืนบอกจำนวนแต่ละประเภท (เงินนำส่ง 1 / เปลี่ยนแผน 2 / ออมเพิ่ม 1)', /เงินนำส่ง 1 รายการ/.test(sumTxt) && /เปลี่ยนแผน 2 รายการ/.test(sumTxt) && /ออมเพิ่ม 1 รายการ/.test(sumTxt), sumTxt);
  await p2.screenshot({ path: SHOTS + '/L07-restore.png', fullPage: true });
  await p2.click('#do-restore'); await p2.waitForSelector('.tiles');
  const a = await page.evaluate(() => JSON.parse(localStorage.getItem('kasiansuk.data')).ledger);
  const b2 = await p2.evaluate(() => JSON.parse(localStorage.getItem('kasiansuk.data')).ledger);
  check('AC-31 กู้คืนแล้วสมุดเหมือนต้นทางทุกช่อง', JSON.stringify(a) === JSON.stringify(b2));
  check('กู้คืนแล้วตัวเลขการ์ดปีนี้เท่าเดิม', (await p2.innerText('.tiles')) === yearCard0);

  // ---------- 10. จอแคบ 320 ----------
  const p3 = await newPage({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await restore(p3, bk); await p3.click('#do-restore'); await p3.waitForSelector('.tiles');
  for (const h of ['#/record', '#/record/deposit', '#/record/plan', '#/record/saving', '#/history', '#/home']) {
    await p3.goto(URL + h); await p3.waitForTimeout(150);
    if (h === '#/record/plan') { await p3.selectOption('#f-plan', 'แผนผสมสัดส่วนเอง'); }
    const over = await p3.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(`จอ 320 ไม่ล้นแนวนอน: ${h}`, !over);
  }
  await p3.goto(URL + '#/record/plan'); await p3.selectOption('#f-plan', 'แผนผสมสัดส่วนเอง'); await p3.screenshot({ path: SHOTS + '/L08-plan-320.png', fullPage: true });
  await p3.goto(URL + '#/history'); await p3.screenshot({ path: SHOTS + '/L09-history-320.png', fullPage: true });

  // ---------- 11. กล่องแนะนำแบบไอคอน: ไม่พูดถึง Safari กับคนที่ไม่ได้ใช้ Safari (0.4.1) ----------
  const UA = {
    safari: devices['iPhone 13'].userAgent,
    chromeIOS: devices['iPhone 13'].userAgent.replace('Version/', 'CriOS/120.0.0.0 Version/'),
    android: devices['Pixel 7'].userAgent,
  };
  for (const [k, ua] of Object.entries(UA)) {
    const px = await newPage({ ...devices[k === 'android' ? 'Pixel 7' : 'iPhone 13'], userAgent: ua });
    await px.goto(URL); await px.waitForSelector('.install');
    const t = await px.innerText('.install');
    check(`กล่องแนะนำไอคอน (${k}): ${k === 'safari' ? 'พูดถึง Safari' : 'ไม่มีคำว่า Safari'}`, k === 'safari' ? t.includes('Safari') : !t.includes('Safari'), t.split('\n')[1]);
  }

  check('ไม่มีข้อผิดพลาดในหน้า', errs.length === 0, errs.join(' / '));
  console.log(`\nรวม ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
  await browser.close();
  if (fail) process.exitCode = 1;
})();

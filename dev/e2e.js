// ทดสอบหน้าจอแบบอัตโนมัติ — ตัวเลขสมมติทั้งหมด
const { chromium, devices } = require('playwright');
const SHOTS = process.env.SHOTS || '/tmp/shots'; require('fs').mkdirSync(SHOTS, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const shot = async n => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
  const sel = async (pre, d, m, y) => { await page.selectOption(`#${pre}-d`, String(d)); await page.selectOption(`#${pre}-m`, String(m)); await page.selectOption(`#${pre}-y`, String(y)); };
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#start-form'); await shot('01-start');
  // ผิด: ว่าง + เงินต้นช่องเดียว
  await page.fill('#f-pm', '315750'); await page.click('button[type=submit]'); await shot('02-start-errors');
  // ถูก: 15 ส.ค. 2569
  await sel('date', 15, 8, 2569); await page.fill('#f-v', '912,400'); await page.fill('#f-pg', '315750');
  await page.click('button[type=submit]'); await page.waitForSelector('.big-money'); await shot('03-home-first');
  // เติมยอดสิ้นปี 2568 จากเช็กลิสต์
  await page.click('.checklist a'); await page.waitForSelector('#ye-form');
  await page.fill('#f-v', '850000'); await page.fill('#f-pm', '300000'); await page.fill('#f-pg', '300000');
  await page.click('#ye-form button[type=submit]'); await page.waitForSelector('.tiles'); await shot('04-home-with-ye');
  // บันทึกยอดใหม่ 15 ต.ค. 2569 เงินต้นเดิม → ถาม F-09 → แก้เงินต้น
  await page.goto('http://localhost:8765/#/record'); await page.click('.menu-item.main');
  await page.waitForSelector('#bal-form'); await sel('date', 15, 10, 2569); await page.fill('#f-v', '935800');
  await shot('05-balance-prefill');
  await page.click('#bal-form button[type=submit]'); await page.waitForSelector('#sheet'); await shot('06-f09-sheet');
  await page.click('#q-fix'); await page.fill('#f-pm', '320250'); await page.fill('#f-pg', '320250');
  await page.click('#bal-form button[type=submit]'); await page.waitForSelector('.tiles'); await shot('07-home-T03');
  const txt = await page.innerText('main');
  const want = ['935,800.00', '+23,400.00', '45,300.00', '5.21%', '40,500.00', '20,250.00', 'เทียบกับ 15 ส.ค. 2569'];
  console.log('หน้าหลักตรงกับ T03:', want.map(w => `${w}:${txt.includes(w) ? 'ใช่' : 'ไม่'}`).join(' '));
  // วันที่ซ้ำ
  await page.goto('http://localhost:8765/#/record/balance'); await page.waitForSelector('#bal-form');
  await sel('date', 15, 10, 2569); await page.fill('#f-v', '1'); await page.click('#bal-form button[type=submit]');
  console.log('วันที่ซ้ำ:', await page.isVisible('text=ไปแก้รายการเดิม'));
  // ประวัติ
  await page.goto('http://localhost:8765/#/history'); await page.waitForSelector('.hist-item'); await shot('08-history');
  await page.click('.hist-item >> nth=0'); await page.waitForSelector('.kv'); await shot('09-detail');
  // กราฟ ทั้งหมด
  await page.goto('http://localhost:8765/#/home'); await page.click('[data-range=all]'); 
  // ปิดแล้วเปิดใหม่: ข้อมูลยังอยู่
  await page.reload(); await page.waitForSelector('.big-money');
  console.log('เปิดใหม่ข้อมูลยังอยู่:', (await page.innerText('.big-money')).includes('935,800.00'));
  // ข้อมูลและสำรอง
  await page.goto('http://localhost:8765/#/data'); await page.waitForSelector('#do-backup'); await shot('10-data');
  await page.click('#do-backup'); await page.waitForSelector('#bk-go'); const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bk-go')]);
  const p = await dl.path(); const fs = require('fs'); fs.copyFileSync(p, SHOTS + '/backup.json');
  console.log('ไฟล์สำรอง:', dl.suggestedFilename());
  // กู้คืนในเบราว์เซอร์ใหม่ (เหมือนเครื่องอื่น)
  const ctx2 = await browser.newContext({ ...devices['iPhone 13'], locale: 'th-TH' }); const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errs.push('p2 ' + e.message));
  await p2.goto('http://localhost:8765/#/data'); await p2.setInputFiles('#restore-file', SHOTS + '/backup.json');
  await p2.waitForSelector('#do-restore'); await p2.screenshot({ path: SHOTS + '/11-restore-summary.png', fullPage: true });
  await p2.click('#do-restore'); await p2.waitForSelector('.tiles');
  console.log('กู้คืนแล้วหน้าหลักเท่าเดิม:', (await p2.innerText('main')) === txt ? 'ใช่' : 'ต่าง (ตรวจ)');
  // ไฟล์ผิด
  fs.writeFileSync('/tmp/bad.json', '{"a":1}');
  await p2.goto('http://localhost:8765/#/data'); await p2.setInputFiles('#restore-file', '/tmp/bad.json');
  await p2.waitForSelector('#form-alert:not([hidden])'); console.log('ไฟล์ผิด:', await p2.innerText('#form-alert'));
  // จอแคบ 320 + ตัวอักษรใหญ่
  const ctx3 = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p3 = await ctx3.newPage(); await p3.goto('http://localhost:8765/#/data'); await p3.setInputFiles('#restore-file', SHOTS + '/backup.json');
  await p3.click('#do-restore'); await p3.waitForSelector('.tiles');
  await p3.screenshot({ path: SHOTS + '/12-home-320.png', fullPage: true });
  const overflow = await p3.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log('จอ 320 ล้นแนวนอน:', overflow);
  await p3.addStyleTag({ content: 'html{font-size:200%} body{font-size:30px}' });
  await p3.screenshot({ path: SHOTS + '/13-home-320-big.png', fullPage: true });
  console.log('ข้อผิดพลาดในหน้า:', errs.length ? errs : 'ไม่มี');
  await browser.close();
})();

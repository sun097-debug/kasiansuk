const { chromium, devices } = require('playwright');
const SHOTS = process.env.SHOTS || '/tmp/shots'; require('fs').mkdirSync(SHOTS, { recursive: true });
(async () => { const b = await chromium.launch({ channel: 'chrome' });
  const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage();
  const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/?v=3'); await p.waitForSelector('#f-v');
  await p.click('#f-v'); await p.keyboard.type('943310.5');
  console.log('พิมพ์ทีละตัว:', await p.inputValue('#f-v'));
  // แก้กลางตัวเลข: เลื่อนเคอร์เซอร์ไปหลัง "943" แล้วพิมพ์ 1
  await p.evaluate(() => { const el = document.querySelector('#f-v'); el.setSelectionRange(3, 3); });
  await p.keyboard.type('1');
  const v = await p.inputValue('#f-v'); const pos = await p.evaluate(() => document.querySelector('#f-v').selectionStart);
  console.log('แทรกกลาง:', v, 'เคอร์เซอร์ที่', pos);
  await p.keyboard.press('Backspace'); console.log('ลบกลับ:', await p.inputValue('#f-v'));
  await p.keyboard.type('abc-'); console.log('พิมพ์ตัวอักษร/ลบ:', await p.inputValue('#f-v'));
  console.log('ข้อผิดพลาด:', errs.length ? errs : 'ไม่มี'); await b.close(); })();

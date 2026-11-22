// ทดสอบหน้าจอคำถามเงินต้นแบบใหม่ (0.4.3) — เลื่อนนาฬิกาของเบราว์เซอร์ทดสอบไปวันอื่น · ตัวเลขสมมติ
// รัน: เปิดเซิร์ฟเวอร์ `python3 -m http.server 8765` ที่โฟลเดอร์แอพ แล้ว `node dev/e2e-principal.js`
const { chromium, devices } = require('playwright');
const path = require('path');
const URL = 'http://localhost:8765/';
let pass = 0, fail = 0;
const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'} | ${n}${info ? ' | ' + info : ''}`); };
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const at = async iso => { await p.clock.setFixedTime(new Date(iso + 'T10:00:00+07:00')); };
  let n = 0;   // เปลี่ยนที่อยู่ทุกครั้งเพื่อให้หน้าโหลดใหม่ (วันที่ในฟอร์มจะได้เป็นวันใหม่)
  const newBalance = async v => { await p.goto(URL + '?r=' + (++n) + '#/record/balance'); await p.waitForSelector('#bal-form'); await p.fill('#f-v', v); };
  await at('2026-11-22');
  await p.goto(URL + '#/data'); await p.setInputFiles('#restore-file', path.join(__dirname, '..', 'test-data', 'h10-homescreen.json')); await p.click('#do-restore'); await p.waitForSelector('.tiles');
  // ชุด T01: เงินต้นเปลี่ยนล่าสุด 15 พ.ย. 2569
  await at('2026-11-30'); await newBalance('944000');
  check('30 พ.ย. (ยังไม่พลาดรอบ) → ไม่มีกล่องเตือนในฟอร์ม', !(await p.isVisible('#principal-hint')));
  await at('2026-12-10'); await newBalance('945000');
  check('10 ธ.ค. (พลาด 1 รอบ: 25 พ.ย.) → กล่องเตือนในฟอร์มขึ้น', await p.isVisible('#principal-hint') && (await p.innerText('#principal-hint')).includes('15 พ.ย. 2569'));
  await p.screenshot({ path: (process.env.SHOTS || '/tmp/shots') + '/P01-hint.png', fullPage: true });
  await p.fill('#f-pm', '324750');
  check('แก้เงินต้นในฟอร์ม → กล่องเตือนหายทันที', !(await p.isVisible('#principal-hint')));
  await p.fill('#f-pm', '322,500');
  await p.click('#bal-form button[type=submit]'); await p.waitForTimeout(300);
  check('พลาด 1 รอบ กดบันทึก → ไม่เด้งถาม บันทึกเลย', !(await p.isVisible('#sheet')) && (await p.isVisible('.tiles')));
  check('หน้าหลักยังติดป้าย "อาจสูงเกินจริง"', (await p.innerText('main')).includes('อาจสูงเกินจริง'));
  await at('2027-01-10'); await newBalance('946000'); await p.click('#bal-form button[type=submit]'); await p.waitForTimeout(300);
  check('10 ม.ค. (พลาด 2 รอบ) → เด้งถาม บอกจำนวนรอบ', await p.isVisible('#sheet') && (await p.innerText('#sheet')).includes('2 รอบ'), (await p.isVisible('#sheet')) ? (await p.innerText('#sheet')).split('\n')[1] : '');
  await p.click('#q-later'); await p.waitForSelector('.big-money');
  await at('2027-01-12'); await newBalance('946500'); await p.click('#bal-form button[type=submit]'); await p.waitForTimeout(300);
  check('กด "ไว้ทีหลัง" แล้ว 12 ม.ค. (รอบเดิม) → ไม่ถามซ้ำ', !(await p.isVisible('#sheet')) && (await p.isVisible('.big-money')));
  await at('2027-01-26'); await newBalance('947000'); await p.click('#bal-form button[type=submit]'); await p.waitForTimeout(300);
  check('26 ม.ค. (รอบใหม่) ยังไม่แก้ → ถามอีกครั้ง', await p.isVisible('#sheet'));
  await p.click('#q-fix'); await p.fill('#f-pm', '327000'); await p.fill('#f-pg', '327000'); await p.click('#bal-form button[type=submit]'); await p.waitForSelector('.big-money');
  check('แก้เงินต้นแล้ว → ป้าย "อาจสูงเกินจริง" หาย', !(await p.innerText('main')).includes('อาจสูงเกินจริง'));
  check('ไม่มีข้อผิดพลาดในหน้า', errs.length === 0, errs.join(' / '));
  console.log(`\nรวม ผ่าน ${pass} / ไม่ผ่าน ${fail}`); await b.close(); if (fail) process.exitCode = 1;
})();

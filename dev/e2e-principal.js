// ทดสอบหน้าจอคำถามเงินต้นแบบใหม่ (0.4.3) + วันที่เติมไว้ 2 วันก่อน (0.4.4) — เลื่อนนาฬิกาของเบราว์เซอร์ทดสอบไปวันอื่น · ตัวเลขสมมติ
// รัน: เปิดเซิร์ฟเวอร์ `python3 -m http.server 8765` ที่โฟลเดอร์แอพ แล้ว `node dev/e2e-principal.js`
// 0.4.4: ฟอร์มบันทึกยอดใหม่เติมวันที่ = วันนี้ − 2 วัน → ชุดนี้ตั้งนาฬิกาเป็น "วันที่ของข้อมูล + 2 วัน"
//        เพื่อให้วันที่ของข้อมูลแต่ละข้อเท่ากับรุ่น 0.4.3 (ความหมายของการทดสอบเดิมไม่เปลี่ยน)
const { chromium, devices } = require('playwright');
const path = require('path');
const URL = 'http://localhost:8765/';
let pass = 0, fail = 0;
const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'} | ${n}${info ? ' | ' + info : ''}`); };
const plusDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const clockAt = async iso => { await p.clock.setFixedTime(new Date(iso + 'T10:00:00+07:00')); };
  const dataAt = iso => clockAt(plusDays(iso, 2));       // วันที่ของข้อมูล = iso (นาฬิกา = iso + 2 วัน)
  const formDate = async (pre = '#date') => {            // วันที่ที่ฟอร์มเลือกไว้ → 'YYYY-MM-DD' (ค.ศ.)
    const [d, m, y] = await Promise.all(['d', 'm', 'y'].map(k => p.inputValue(`${pre}-${k}`)));
    return `${+y - 543}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };
  let n = 0;   // เปลี่ยนที่อยู่ทุกครั้งเพื่อให้หน้าโหลดใหม่ (วันที่ในฟอร์มจะได้เป็นวันใหม่)
  const openBalance = async () => { await p.goto(URL + '?r=' + (++n) + '#/record/balance'); await p.waitForSelector('#bal-form'); };
  const newBalance = async v => { await openBalance(); await p.fill('#f-v', v); };

  // ---- 0.4.4: หน้าเริ่มใช้ (ยังไม่มีข้อมูล) เติมวันที่ 2 วันก่อน ----
  await clockAt('2026-11-22');
  await p.goto(URL + '?r=start'); await p.evaluate(() => localStorage.setItem('kasiansuk.installHidden', '1'));
  await p.goto(URL + '?r=start2#/start'); await p.waitForSelector('#start-form');
  check('0.4.4 หน้าเริ่มใช้: นาฬิกา 22 พ.ย. → วันที่เติมไว้ 20 พ.ย. 2569', (await formDate()) === '2026-11-20', await formDate());
  check('0.4.4 หน้าเริ่มใช้: คำช่วย "ไม่ใช่วันที่กรอก" ยังอยู่', (await p.innerText('#start-form')).includes('ไม่ใช่วันที่กรอก'));
  await clockAt('2027-01-01'); await p.goto(URL + '?r=start3#/start'); await p.waitForSelector('#start-form');
  check('0.4.4 หน้าเริ่มใช้: 1 ม.ค. 2570 → 30 ธ.ค. 2569 (ข้ามปี และมีปี 2569 ให้เลือก)', (await formDate()) === '2026-12-30', await formDate());

  await clockAt('2026-11-22');
  await p.goto(URL + '#/data'); await p.setInputFiles('#restore-file', path.join(__dirname, '..', 'test-data', 'h10-homescreen.json')); await p.click('#do-restore'); await p.waitForSelector('.tiles');

  // ---- 0.4.4: ฟอร์มบันทึกยอดใหม่ / ตอนแก้ / ฟอร์มอื่นที่ไม่เปลี่ยน ----
  await clockAt('2026-11-22'); await openBalance();
  check('0.4.4 บันทึกยอดใหม่: นาฬิกา 22 พ.ย. → วันที่เติมไว้ 20 พ.ย. 2569', (await formDate()) === '2026-11-20', await formDate());
  check('0.4.4 บันทึกยอดใหม่: คำช่วย "ไม่ใช่วันที่กรอก" ยังอยู่', (await p.innerText('#bal-form')).includes('ไม่ใช่วันที่กรอก'));
  await p.goto(URL + '?r=' + (++n) + '#/record/balance/2026-11-15'); await p.waitForSelector('#bal-form');
  check('0.4.4 ตอนแก้รายการเดิม: วันที่เป็นวันที่ของรายการ (15 พ.ย.) ไม่ใช่ 2 วันก่อน', (await formDate()) === '2026-11-15', await formDate());
  for (const [route, name] of [['deposit', 'เงินนำส่ง'], ['plan', 'เปลี่ยนแผน'], ['saving', 'ออมเพิ่ม']]) {
    await p.goto(URL + '?r=' + (++n) + '#/record/' + route); await p.waitForSelector('main form');
    const pre = await p.$eval('main form select[name=d]', el => '#' + el.id.replace(/-d$/, ''));
    check(`0.4.4 ฟอร์ม${name}: ไม่เปลี่ยน — ยังเติมวันนี้ (22 พ.ย.)`, (await formDate(pre)) === '2026-11-22', await formDate(pre));
  }

  // ---- 0.4.3: คำถามเงินต้น (วันที่ของข้อมูลเท่าเดิม) · ชุด T01: เงินต้นเปลี่ยนล่าสุด 15 พ.ย. 2569 ----
  await dataAt('2026-11-30'); await newBalance('944000');
  check('ข้อมูล 30 พ.ย. (ยังไม่พลาดรอบ) → ไม่มีกล่องเตือนในฟอร์ม', (await formDate()) === '2026-11-30' && !(await p.isVisible('#principal-hint')));
  await dataAt('2026-12-10'); await newBalance('945000');
  check('ข้อมูล 10 ธ.ค. (พลาด 1 รอบ: 25 พ.ย.) → กล่องเตือนในฟอร์มขึ้น', await p.isVisible('#principal-hint') && (await p.innerText('#principal-hint')).includes('15 พ.ย. 2569'));
  await p.screenshot({ path: (process.env.SHOTS || '/tmp/shots') + '/P01-hint.png', fullPage: true });
  await p.fill('#f-pm', '324750');
  check('แก้เงินต้นในฟอร์ม → กล่องเตือนหายทันที', !(await p.isVisible('#principal-hint')));
  await p.fill('#f-pm', '322,500');
  await p.click('#bal-form button[type=submit]'); await p.waitForTimeout(300);
  check('พลาด 1 รอบ กดบันทึก → ไม่เด้งถาม บันทึกเลย', !(await p.isVisible('#sheet')) && (await p.isVisible('.tiles')));
  check('หน้าหลักยังติดป้าย "อาจสูงเกินจริง"', (await p.innerText('main')).includes('อาจสูงเกินจริง'));
  await dataAt('2027-01-10'); await newBalance('946000'); await p.click('#bal-form button[type=submit]'); await p.waitForTimeout(300);
  check('ข้อมูล 10 ม.ค. (พลาด 2 รอบ) → เด้งถาม บอกจำนวนรอบ', await p.isVisible('#sheet') && (await p.innerText('#sheet')).includes('2 รอบ'), (await p.isVisible('#sheet')) ? (await p.innerText('#sheet')).split('\n')[1] : '');
  await p.click('#q-later'); await p.waitForSelector('.big-money');
  await dataAt('2027-01-12'); await newBalance('946500'); await p.click('#bal-form button[type=submit]'); await p.waitForTimeout(300);
  check('กด "ไว้ทีหลัง" แล้ว ข้อมูล 12 ม.ค. (รอบเดิม) → ไม่ถามซ้ำ', !(await p.isVisible('#sheet')) && (await p.isVisible('.big-money')));
  // 0.4.4 ผลพลอยได้ (แผน Testing 2.10): เปิดแอพวันที่ 26 แต่ข้อมูลเป็นของวันที่ 24 (เงินเดือนยังไม่เข้า) → ไม่ถาม
  await clockAt('2027-01-26'); await newBalance('946800');
  check('0.4.4 เปิดแอพ 26 ม.ค. → วันที่เติมไว้ 24 ม.ค.', (await formDate()) === '2027-01-24', await formDate());
  await p.click('#bal-form button[type=submit]'); await p.waitForTimeout(300);
  check('0.4.4 ข้อมูล 24 ม.ค. (ก่อนวันที่ 25) → ไม่ถาม แม้เปิดแอพวันที่ 26', !(await p.isVisible('#sheet')) && (await p.isVisible('.big-money')));
  await dataAt('2027-01-26'); await newBalance('947000'); await p.click('#bal-form button[type=submit]'); await p.waitForTimeout(300);
  check('ข้อมูล 26 ม.ค. (รอบใหม่) ยังไม่แก้ → ถามอีกครั้ง', await p.isVisible('#sheet'));
  await p.click('#q-fix'); await p.fill('#f-pm', '327000'); await p.fill('#f-pg', '327000'); await p.click('#bal-form button[type=submit]'); await p.waitForSelector('.big-money');
  check('แก้เงินต้นแล้ว → ป้าย "อาจสูงเกินจริง" หาย', !(await p.innerText('main')).includes('อาจสูงเกินจริง'));
  // วันที่ที่เติมไว้ซ้ำกับรายการเดิม (เช่น My GPF ยังไม่อัปเดตช่วงวันหยุด) → บอก "มีรายการวันที่นี้แล้ว"
  await clockAt('2027-01-28'); await newBalance('947100'); await p.click('#bal-form button[type=submit]'); await p.waitForTimeout(300);
  check('0.4.4 วันที่เติมไว้ (26 ม.ค.) ซ้ำรายการเดิม → บอก "มีรายการวันที่นี้แล้ว" + ปุ่มไปแก้รายการเดิม',
    (await p.innerText('#bal-form')).includes('มีรายการวันที่นี้แล้ว') && (await p.isVisible('a[href="#/record/balance/2027-01-26"]')));
  check('ไม่มีข้อผิดพลาดในหน้า', errs.length === 0, errs.join(' / '));
  console.log(`\nรวม ผ่าน ${pass} / ไม่ผ่าน ${fail}`); await b.close(); if (fail) process.exitCode = 1;
})();

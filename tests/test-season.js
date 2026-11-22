// ชุดทดสอบภาพหัวหน้าหลักตามฤดู (0.4.2) — ซันเสนอ 22 พ.ย.: เดือนรอยต่อใช้ภาพแรก เปลี่ยนวันที่ 1 ของเดือน
// รัน: node tests/test-season.js
const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
const WINTER = (src.match(/const WINTER = '(\w+)'/) || [])[1];
const seasonOf = new Function('WINTER', src.match(/const SEASON_BY_MONTH[^\n]*/)[0] + '\n' + src.match(/const seasonOf[^\n]*/)[0] + '\nreturn seasonOf;')(WINTER);
let pass = 0, fail = 0; const rows = [];
const eq = (id, name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; rows.push(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'} | ${id} | ${name} | ได้ ${JSON.stringify(got)}${ok ? '' : ' | ต้องได้ ' + JSON.stringify(want)}`); };
eq('W01', 'หน้าหนาวใช้แบบหมอกเย็น (ซันเลือกแบบ ข.)', WINTER, 'mist');
const want = { 1: 'mist', 2: 'sky', 3: 'hot', 4: 'hot', 5: 'sky', 6: 'rain', 7: 'rain', 8: 'rain', 9: 'rain', 10: 'sky', 11: 'mist', 12: 'mist' };
const names = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
for (let m = 1; m <= 12; m++) {
  const got = ['01', '15', '28'].map(d => seasonOf(`2027-${String(m).padStart(2, '0')}-${d}`));
  eq('W02', `${names[m]} ทั้งเดือน (วันที่ 1 / 15 / 28)`, got, [want[m], want[m], want[m]]);
}
eq('W03', 'เปลี่ยนวันที่ 1: 31 ม.ค. → หนาว / 1 ก.พ. → ภาพแรก', [seasonOf('2027-01-31'), seasonOf('2027-02-01')], ['mist', 'sky']);
console.log(rows.join('\n')); console.log(`\nรวม ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
if (fail) process.exitCode = 1;

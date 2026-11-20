// ชุดกรณีทดสอบส่วนคำนวณ (54 ข้อ) — ย้ายจากขั้น Calculation ไม่แก้คำตอบที่ต้องได้ — ตัวเลขสมมติทั้งหมด
// รัน: node tests/test-calc.js
// คำตอบ % คิดแยกด้วยสูตรเขียนมือ (ระบุวันเงินเข้าเอง) ไม่ใช้ฟังก์ชันเดียวกับที่ถูกทดสอบ
const C = require('../js/calc');
const { compute, yearFigures, dietz, fmtMoney, fmtSigned, fmtPct, baht } = C;
const M = 'monthEnd';
let pass = 0, fail = 0; const rows = [];
const eq = (id, name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; rows.push(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'} | ${id} | ${name} | ได้ ${JSON.stringify(got)}${ok ? '' : ' | ต้องได้ ' + JSON.stringify(want)}`); };
const pct2 = x => x == null ? null : fmtPct(x);
const days = (a, b) => (Date.UTC(...b.split('-').map((v, i) => i === 1 ? v - 1 : +v)) - Date.UTC(...a.split('-').map((v, i) => i === 1 ? v - 1 : +v))) / 864e5;
const handDietz = (B, V, flows, s, e) => { const T = days(s, e); const sum = flows.reduce((a, f) => a + f[1], 0); return (V - B - sum) / (B + flows.reduce((a, f) => a + f[1] * days(f[0], e) / T, 0)) * 100; };
const rec = (date, v, pm, pg = pm) => ({ date, v: baht(v), pm: pm == null ? null : baht(pm), pg: pg == null ? null : baht(pg) });
const ye = (year, date, v, pm, pg = pm) => ({ year, date, v: baht(v), pm: baht(pm), pg: baht(pg) });
const YE68 = ye(2025, '2025-12-31', 850000, 300000);
const me26 = ['2026-01-31','2026-02-28','2026-03-31','2026-04-30','2026-05-31','2026-06-30','2026-07-31','2026-08-31','2026-09-30','2026-10-31'];

// T01 ชุด AC-11/AC-12
{ const st = { yearEnds: [YE68], records: [rec('2026-10-15', 940000, 320250), rec('2026-11-15', 943310, 322500)] };
  const r = compute(st, M);
  eq('T01', 'เงินที่ส่งเข้าไปปีนี้ (สมาชิก/ภาครัฐ/รวม)', [r.year.contributed.m, r.year.contributed.g, r.year.contributed.total].map(fmtMoney), ['22,500.00', '22,500.00', '45,000.00']);
  eq('T01', 'กำไรปีนี้', fmtMoney(r.year.profit), '48,310.00');
  eq('T01', 'ยอดเปลี่ยนจากครั้งก่อน', fmtSigned(r.dV.amount), '+3,310.00');
  eq('T01', 'เงินต้นเพิ่มจากครั้งก่อน (F-11)', fmtSigned(r.history[0].principalUp.amount), '+4,500.00');
  eq('T01', '% ปีนี้', pct2(r.year.pct), fmtPct(handDietz(850000, 943310, me26.map(d => [d, 4500]), '2025-12-31', '2026-11-15'))); }

// T02–T03 ชุดจากแบบร่าง
const DRAFT = () => ({ yearEnds: [YE68], records: [rec('2026-08-15', 912400, 315750), rec('2026-10-15', 935800, 320250)] });
{ const st = DRAFT(); st.records.pop(); const r = compute(st, M);
  eq('T02', '15 ส.ค.: กำไร / ส่งเข้าไป / %', [fmtMoney(r.year.profit), fmtMoney(r.year.contributed.total), pct2(r.year.pct)], ['30,900.00', '31,500.00', '3.57%']); }
{ const r = compute(DRAFT(), M);
  eq('T03', '15 ต.ค.: กำไร / ส่งเข้าไป / ยอดเปลี่ยน / F-11 / %', [fmtMoney(r.year.profit), fmtMoney(r.year.contributed.total), fmtSigned(r.dV.amount), fmtSigned(r.history[0].principalUp.amount), pct2(r.year.pct)], ['45,300.00', '40,500.00', '+23,400.00', '+9,000.00', fmtPct(handDietz(850000, 935800, me26.slice(0, 9).map(d => [d, 4500]), '2025-12-31', '2026-10-15'))]);
  eq('T03', '% ปัดแล้วเท่าแบบร่าง', pct2(r.year.pct), '5.21%'); }

// T04–T06 กรณีทดสอบเดิม (TC-01, TC-02, TC-03)
{ const st = { yearEnds: [ye(2025, '2025-12-31', 100000, 25000)], records: [rec('2026-06-30', 110000, 25000)] }; const r = compute(st, M);
  eq('T04', 'TC-01 ไม่มีเงินเข้า: กำไร / %', [fmtMoney(r.year.profit), pct2(r.year.pct)], ['10,000.00', '10.00%']); }
{ const d = dietz(baht(100000), baht(115000), [{ date: '2026-03-01', a: baht(10000) }], '2025-12-31', '2026-03-31');
  eq('T05', 'TC-02 สูตรล้วน: 4.84%', pct2(d.pct), '4.84%'); }
{ const st = { yearEnds: [ye(2025, '2025-12-31', 100000, 25000)], records: [rec('2026-03-31', 108000, 25000), rec('2026-04-30', 115000, 30000)] }; const r = compute(st, M);
  eq('T06', 'TC-03 ยอดเปลี่ยน +7,000 แต่เงินที่ส่งเข้าไป 10,000 (ยอดเปลี่ยนไม่ใช่กำไร)', [fmtSigned(r.dV.amount), fmtMoney(r.year.contributed.total), fmtMoney(r.year.profit)], ['+7,000.00', '10,000.00', '5,000.00']); }

// T07 ไม่มียอดสิ้นปี / T08 ยอดล่าสุดไม่มีเงินต้น / T09 รายการเดียว
{ const r = compute({ yearEnds: [], records: [rec('2026-08-15', 912400, 315750), rec('2026-10-15', 935800, 320250)] }, M);
  eq('T07', 'ไม่มียอดสิ้นปี: ไม่คำนวณ + เหตุผล; ยอดเปลี่ยนยังแสดง', [r.year.ok, r.year.why, fmtSigned(r.dV.amount)], [false, 'ยังไม่มียอดสิ้นปีก่อน', '+23,400.00']); }
{ const st = DRAFT(); st.records[1] = rec('2026-10-15', 935800, null); const r = compute(st, M);
  eq('T08', 'AC-09 ยอดล่าสุดไม่มีเงินต้น: ไม่ใช้เงินต้นเก่า', [r.year.ok, r.year.why], [false, 'ยังไม่มีเงินต้นของยอดล่าสุด']); }
{ const r = compute({ yearEnds: [YE68], records: [rec('2026-08-15', 912400, 315750)] }, M);
  eq('T09', 'AC-13 รายการเดียว: ไม่มีครั้งก่อนให้เทียบ', r.dV, null); }

// T10–T11 ขึ้นปีใหม่ / ยอดสิ้นปีหลายปี (+ ขาดทุน)
{ const st = DRAFT(); st.records.push(rec('2027-01-10', 958000, 327000)); const r = compute(st, M);
  eq('T10', 'AC-19 ขึ้นปี 2570 ยังไม่มียอดสิ้นปี 2569 → รอยอดสิ้นปี', r.year.why, 'รอยอดสิ้นปี 2569');
  eq('T10', 'AC-19 ข้อมูลปี 2569 ยังอยู่: กำไรปีนั้นของ 15 ต.ค.', fmtMoney(r.history[1].yearProfit), '45,300.00');
  st.yearEnds.push(ye(2026, '2026-12-31', 960000, 327000)); const r2 = compute(st, M);
  eq('T11', 'เติมยอดสิ้นปี 2569: ม.ค. 2570 ขาดทุน / ส่งเข้าไป 0 / %', [fmtMoney(r2.year.profit), fmtMoney(r2.year.contributed.total), pct2(r2.year.pct)], ['−2,000.00', '0.00', '−0.21%']);
  eq('T11', 'รายการปี 2569 ยังใช้ยอดสิ้นปี 2568', fmtMoney(r2.history[1].yearProfit), '45,300.00'); }

// T12 สมาชิกใหม่ (C-2)
{ const st = { yearEnds: [ye(2025, '2025-12-31', 0, 0)], records: [rec('2026-10-15', 27800, 13500)] }; const r = compute(st, M);
  eq('T12', 'สมาชิกใหม่ (ยอดสิ้นปี 0): ส่งเข้าไป = เงินต้นทั้งหมด, กำไร = ผลประโยชน์ทั้งหมด', [fmtMoney(r.year.contributed.total), fmtMoney(r.year.profit)], ['27,000.00', '800.00']);
  eq('T12', 'สมาชิกใหม่: ไม่แสดง % แต่บอกเหตุผล', [r.year.pct, r.year.pctWhy], [null, 'ปีแรกที่เป็นสมาชิก แอพคิด % ให้ไม่ได้ (ไม่รู้ว่าเริ่มส่งเงินเดือนไหน)']);
  const r2 = compute({ yearEnds: [], records: [rec('2026-10-15', 27800, 13500)] }, M);
  eq('T12', 'ยังไม่กรอกยอดสิ้นปีเลย → ยังไม่มียอดสิ้นปีก่อน (ไม่ถือเป็น 0 เอง)', r2.year.why, 'ยังไม่มียอดสิ้นปีก่อน'); }

// T13 เงินต้นลดลง / T15 ตัวหาร ≤ 0
{ const r = compute({ yearEnds: [YE68], records: [rec('2026-03-15', 860000, 295000)] }, M);
  eq('T13', 'เงินต้นลดลง: ส่งเข้าไปติดลบ แต่ยังคำนวณ', [fmtMoney(r.year.contributed.total), fmtMoney(r.year.profit), r.year.pct != null], ['−10,000.00', '20,000.00', true]); }
{ const d = dietz(0, baht(1000), [], '2025-12-31', '2026-03-31');
  eq('T15', 'ตัวหาร = 0: % แสดงเหตุผล ไม่ใช่ 0%', [d.ok, d.why], [false, 'เงินในพอร์ตช่วงนี้ยังน้อยเกินกว่าจะคิดเป็น % ได้']); }

// T16–T18 บันทึกย้อนหลัง / แก้ / ลบ
{ const st = DRAFT(); st.records.reverse(); const a = compute(st, M), b = compute(DRAFT(), M);
  eq('T16', 'AC-05 กรอก 15 ต.ค. ก่อน 15 ส.ค.: หน้าหลักใช้วันที่ล่าสุด', [a.latest.date, a.year.profit], [b.latest.date, b.year.profit]); }
{ const st = DRAFT(); st.records[0] = rec('2026-08-15', 912400, 318000); const a = compute(st, M), b = compute(DRAFT(), M);
  eq('T17', 'แก้เงินต้นรายการกลาง: กำไรล่าสุดไม่เปลี่ยน แต่ % ขยับ', [a.year.profit === b.year.profit, a.year.pct !== b.year.pct, fmtMoney(a.history[1].yearProfit)], [true, true, '26,400.00']); }
{ const st = DRAFT(); st.records.pop(); const r = compute(st, M);
  eq('T18', 'ลบรายการล่าสุด: รายการก่อนหน้ากลายเป็นล่าสุด', [r.latest.date, fmtMoney(r.year.profit), r.dV], ['2026-08-15', '30,900.00', null]); }

// T19 สมุดบันทึกไม่เข้าสูตร
{ const st = DRAFT(); st.ledger = [{ type: 'เงินนำส่ง', date: '2026-08-27', a: baht(45000) }, { type: 'เปลี่ยนแผน', date: '2026-09-15', plan: 'แผนเชิงรุก 35' }, { type: 'ออมเพิ่ม', date: '2026-07-01', rate: 5 }];
  eq('T19', 'เพิ่ม/แก้/ลบสมุด ผลคำนวณเหมือนเดิมทุกตัว', JSON.stringify(compute(st, M)) === JSON.stringify(compute(DRAFT(), M)), true); }

// T20–T21 กรณีวันที่ที่แบบร่างพลาด
{ const st = DRAFT(); st.yearEnds = [ye(2025, '2025-12-30', 850000, 300000)]; const r = compute(st, M);
  eq('T20', 'ยอดสิ้นปีลงวันที่ 30 ธ.ค.: ไม่มีเงินเข้าวันที่ของปีก่อน / %', [r.year.flows.every(f => f.date >= '2026-01-01'), pct2(r.year.pct)], [true, '5.21%']); }
{ const st = { yearEnds: [YE68], records: [rec('2026-08-15', 912400, 315750), rec('2026-10-26', 938000, 320250), rec('2026-10-29', 940300, 322500)] }; const r = compute(st, M);
  eq('T21', 'ช่วงสั้นที่ไม่มีวันสิ้นเดือน (26→29 ต.ค.): เงินวางที่วันบันทึก ไม่หาย', [r.year.flows.reduce((s, f) => s + f.a, 0), r.year.flows.slice(-1)[0].date], [baht(45000), '2026-10-29']); }

// T22 F-11 เมื่อรายการก่อนหน้าไม่มีเงินต้น / T24 เงินต้นอัปเดตล่าสุด
{ const st = { yearEnds: [YE68], records: [rec('2026-08-15', 912400, 315750), rec('2026-09-15', 925000, null), rec('2026-10-15', 935800, 320250)] }; const r = compute(st, M);
  eq('T22', 'F-11 ข้ามรายการที่ไม่มีเงินต้น แล้วบอกวันที่ที่เทียบ', [fmtSigned(r.history[0].principalUp.amount), r.history[0].principalUp.vs, r.history[0].principalUp.skipped, r.history[1].principalUp], ['+9,000.00', '2026-08-15', true, null]);
  eq('T22', 'ยอดเปลี่ยนยังเทียบรายการติดกัน', [fmtSigned(r.history[0].dV.amount), r.history[0].dV.vs], ['+10,800.00', '2026-09-15']); }
{ const a = compute({ yearEnds: [YE68], records: [rec('2026-08-15', 912400, 315750), rec('2026-09-15', 925000, 315750), rec('2026-10-15', 935800, 320250)] }, M);
  const b = compute({ yearEnds: [YE68], records: [rec('2026-08-15', 912400, 315750), rec('2026-09-15', 925000, 315750), rec('2026-10-15', 935800, 315750)] }, M);
  eq('T24', 'วันที่เงินต้นเปลี่ยนล่าสุด (เปลี่ยน 15 ต.ค. / ไม่เปลี่ยนตั้งแต่ 15 ส.ค.)', [a.principalSince, b.principalSince], ['2026-10-15', '2026-08-15']); }

// T23 สตางค์และการแสดงผล
{ const r = compute({ yearEnds: [YE68], records: [rec('2026-11-15', 943310.10, 322500.10)] }, M);
  eq('T23', 'สตางค์ไม่คลาด: ส่งเข้าไป / กำไร', [fmtMoney(r.year.contributed.total), fmtMoney(r.year.profit)], ['45,000.20', '48,309.90']);
  eq('T23', 'รูปแบบ: 0 ไม่มีเครื่องหมาย, −0.00% ไม่แสดง, ยอดยาว', [fmtSigned(0), fmtPct(-0.001), fmtPct(-0.214), fmtMoney(baht(12345678.90)), fmtSigned(baht(-3310))], ['0.00', '0.00%', '−0.21%', '12,345,678.90', '−3,310.00']); }

// T25 กราฟ / T26 สำรองแล้วกู้คืน
{ const st = { yearEnds: [YE68], records: [rec('2026-08-15', 912400, 315750), rec('2026-09-15', 925000, null)] }; const g = compute(st, M).graph;
  eq('T25', 'กราฟ: มีจุดยอดสิ้นปี + จุดที่ไม่มีเงินต้นไม่มีค่าเส้นเงินต้น', g.map(p => [p.date, p.p == null ? null : fmtMoney(p.p)]), [['2025-12-31', '600,000.00'], ['2026-08-15', '631,500.00'], ['2026-09-15', null]]); }
{ const st = DRAFT(); const restored = JSON.parse(JSON.stringify(st));
  eq('T26', 'AC-22 สำรอง→กู้คืน ได้ตัวเลขเท่าเดิมทุกตัว', JSON.stringify(compute(restored, M)) === JSON.stringify(compute(st, M)), true); }

// T27 สองกล่องไม่เท่ากัน — pm = เงินสะสมของท่าน, pg = เงินจากภาครัฐ
{ const st = { yearEnds: [ye(2025, '2025-12-31', 850000, 280000, 320000)], records: [rec('2026-10-15', 960000, 316000, 342500)] }; const r = compute(st, M);
  eq('T27', 'สองกล่องไม่เท่ากัน: เงินสะสมของท่าน / เงินจากภาครัฐ / รวม / กำไร', [r.year.contributed.m, r.year.contributed.g, r.year.contributed.total, r.year.profit].map(fmtMoney), ['36,000.00', '22,500.00', '58,500.00', '51,500.00']);
  eq('T27', '% (วิธี 1)', pct2(r.year.pct), fmtPct(handDietz(850000, 960000, me26.slice(0, 9).map(d => [d, 6500]), '2025-12-31', '2026-10-15')));
  eq('T27', '% ตรงกับคำตอบที่คิดแยกไว้ 16 พ.ย.', pct2(r.year.pct), '5.87%'); }

// T28–T30 C-4
{ const st = DRAFT(); st.records.push(rec('2027-01-10', 958000, 327000)); const r = compute(st, M);
  eq('T28', 'ยังไม่มียอดสิ้นปี 2569: ม.ค. 2570 เทียบ 15 ต.ค. 2569', [fmtSigned(r.dV.amount), r.dV.vs], ['+22,200.00', '2026-10-15']);
  st.yearEnds.push(ye(2026, '2026-12-31', 960000, 327000)); const r2 = compute(st, M);
  eq('T28', 'มียอดสิ้นปี 2569 แล้ว: เทียบยอดสิ้นปี (ใกล้กว่า) ทั้งยอดเปลี่ยนและ F-11', [fmtSigned(r2.dV.amount), r2.dV.yearEnd, fmtSigned(r2.history[0].principalUp.amount), r2.history[0].principalUp.yearEnd], ['−2,000.00', 2026, '0.00', 2026]);
  eq('T28', 'รายการปี 2569 ยังเทียบกันเองตามเดิม (15 ต.ค. เทียบ 15 ส.ค.)', [fmtSigned(r2.history[1].dV.amount), r2.history[1].dV.vs], ['+23,400.00', '2026-08-15']); }
{ const r = compute({ yearEnds: [YE68], records: [rec('2026-08-15', 912400, 315750)] }, M);
  eq('T29', 'ผู้ใช้ใหม่: บันทึกครั้งแรก + เติมยอดสิ้นปี → ยังไม่มีครั้งก่อนให้เทียบ (ทั้งยอดเปลี่ยนและ F-11)', [r.dV, r.history[0].principalUp], [null, null]); }
{ const st = { yearEnds: [ye(2025, '2025-12-31', 0, 0)], records: [rec('2026-07-15', 13900, 6750), rec('2026-10-15', 27800, 13500)] }; const r = compute(st, M);
  eq('T30', 'ยอดสิ้นปี 0 (สมาชิกใหม่) ไม่ใช้เทียบ: 15 ต.ค. เทียบ 15 ก.ค. / รายการแรกไม่มีครั้งก่อน', [fmtSigned(r.dV.amount), r.dV.vs, r.history[1].dV], ['+13,900.00', '2026-07-15', null]); }

// T31 ข้อความเตือนเงินต้น (C-5)
{ const note = recs => compute({ yearEnds: [YE68], records: recs }, M).principalNote;
  const P0 = 318000, P1 = 320250, P2 = 322500;
  const daily = [rec('2026-10-27', 930000, P0), rec('2026-11-01', 931000, P0), rec('2026-11-15', 932000, P0), rec('2026-11-26', 933000, P0)];
  eq('T31', 'ก ขาประจำ: แก้ 27 ต.ค. แล้วกรอกแต่ยอดรวม 1–26 พ.ย. (ก่อนเงิน พ.ย. เข้า) → ไม่เตือน', note(daily), null);
  eq('T31', 'ก ขาประจำ: 27 พ.ย. แก้เงินต้น แล้ว 1 ธ.ค. กรอกแต่ยอดรวม → ไม่เตือน', note([...daily, rec('2026-11-27', 937000, P1), rec('2026-12-01', 938000, P1)]), null);
  eq('T31', 'ข แก้ 28 ต.ค. (หลังเงินเข้า) → 3 พ.ย. ยอดรวมอย่างเดียว → ไม่เตือน (ไม่ต้องกดปุ่ม)', note([rec('2026-10-28', 935000, P0), rec('2026-11-03', 936000, P0)]), null);
  const early = [rec('2026-11-03', 936000, P1), rec('2026-11-10', 937000, P1), rec('2026-11-20', 938000, P1), rec('2026-11-29', 940000, P1)];
  eq('T31', 'ค แก้ 3 พ.ย. แล้วกรอกแต่ยอดรวม 10, 20, 29 พ.ย. → ไม่เตือน', note(early), null);
  eq('T31', 'ค ... 5 ธ.ค. ยังเงินต้นเดิม → เตือน (ไม่เปลี่ยนตั้งแต่ 3 พ.ย.)', note([...early, rec('2026-12-05', 941000, P1)]), { sameSince: '2026-11-03', months: 1 });
  eq('T31', 'ง เปลี่ยนล่าสุด 15 ส.ค. กลับมา 20 ก.พ. ยอดรวมอย่างเดียว → เตือน 6 เดือน', note([rec('2026-08-15', 912400, P0), rec('2027-02-20', 980000, P0)]), { sameSince: '2026-08-15', months: 6 });
  eq('T31', 'ง ... กลับมาแล้วแก้เงินต้น → ไม่เตือน', note([rec('2026-08-15', 912400, P0), rec('2027-02-20', 980000, P2)]), null);
  eq('T31', 'จ แก้ 15 ก.ย. → 20 และ 26 ต.ค. ยอดรวมอย่างเดียว → ยังเตือน', note([rec('2026-09-15', 925000, P0), rec('2026-10-20', 935000, P0), rec('2026-10-26', 936000, P0)]), { sameSince: '2026-09-15', months: 1 });
  eq('T31', 'ฉ ข้อจำกัด: แก้ 22 ธ.ค. → 5 ม.ค. ยอดรวมอย่างเดียว → เตือน (เตือนผิดถ้าเงิน ธ.ค. เข้า 22 จริง)', note([rec('2026-12-22', 950000, P1), rec('2027-01-05', 951000, P1)]), { sameSince: '2026-12-22', months: 1 });
  const st = { yearEnds: [YE68], records: [rec('2026-09-15', 925000, P0), rec('2026-10-27', 935800, P0)] };
  eq('T31', 'ข้อความเตือนไม่เปลี่ยนกำไรและ %', [compute(st, M).principalNote != null, compute(st, M).year.profit], [true, baht(935800 - 636000 - 250000)]); }

console.log(rows.join('\n')); console.log(`\nรวม ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
if (fail) process.exitCode = 1;

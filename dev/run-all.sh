#!/usr/bin/env bash
# รันชุดทดสอบทั้งหมดในคำสั่งเดียว — ใช้ทุกครั้งก่อนขึ้นรุ่น (แผน Testing ข้อเสนอ 2.9 ค)
# รัน: bash dev/run-all.sh   (ต้องมี Node + playwright และ Python — ดู dev/README.md)
cd "$(dirname "$0")/.." || exit 1
PORT=8765
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  python3 -m http.server "$PORT" >/tmp/kasiansuk-server.log 2>&1 &
  SERVER=$!; trap 'kill $SERVER 2>/dev/null' EXIT; sleep 1
fi
export SHOTS="${SHOTS:-/tmp/shots}"; mkdir -p "$SHOTS"
failed=0
echo "== ชุดทดสอบส่วนคำนวณ / ช่องกรอก / สมุด / ฤดู / เก็บข้อมูล"
for t in tests/test-*.js; do
  line=$(node "$t" | tail -1); echo "$t: $line"
  node "$t" >/dev/null || failed=1
done
for t in dev/e2e-ledger.js dev/e2e-principal.js dev/e2e-testing.js; do
  echo "== $t"
  out=$(node "$t" 2>&1); code=$?
  echo "$out" | grep -E "^ไม่ผ่าน|^รวม|Error" ; [ $code -ne 0 ] && failed=1
done
# ชุดเก่า: พิมพ์ผลเป็นคำ ไม่นับผ่าน/ไม่ผ่าน — ดูทุกบรรทัดด้วยตา
for t in dev/e2e.js dev/typing.js; do
  echo "== $t (ชุดเก่า อ่านผลเอง)"; node "$t" 2>&1 || failed=1
done
echo
if [ $failed -eq 0 ]; then echo "สรุป: ผ่านทุกชุด"; else echo "สรุป: มีชุดที่ไม่ผ่าน — ห้ามขึ้นรุ่นจนกว่าจะดูสาเหตุ"; fi
exit $failed

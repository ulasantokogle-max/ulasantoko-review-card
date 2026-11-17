const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const input = fs.readFileSync(path.join(__dirname, "../lib/v1-bulk-csv.ts"),"utf8");
const js = ts.transpileModule(input, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const exportsObject = {};
new Function("exports", "module", js)(exportsObject, { exports: exportsObject });
const { parseV1BulkCsv } = exportsObject;

const expected = "https://app.ulasantoko.space/r-v1/ULAS-00202";
const valid = 'card_code,activation_pin,url\r\n"ULAS-00202","012345","' + expected + '"\r\n';

test("accepts V1 Bulk Create export and preserves card code",()=>{
  assert.deepEqual(parseV1BulkCsv(valid),["ULAS-00202"]);
});
test("rejects YukReview V3 source URL even for an overlapping ULAS code",()=>{
  const different = valid.replace(expected,"https://yukreview.id/ULAS-00202");
  assert.throws(()=>parseV1BulkCsv(different),/bukan milik V1/);
});
test("rejects V1 URL for a different code",()=>{
  assert.throws(()=>parseV1BulkCsv(valid.replace("r-v1/ULAS-00202","r-v1/ULAS-00203")) ,/tidak cocok/);
});
test("rejects duplicate codes without silently dropping entries",()=>{
  assert.throws(()=>parseV1BulkCsv(valid+ '"ULAS-00202","098765","'+expected+'"\r\n'),/duplikat/);
});
test("rejects malformed, unclosed or extra-column CSV",()=>{
  assert.throws(()=>parseV1BulkCsv('card_code,activation_pin,url\n"ULAS-00202,"123456",'+expected),/CSV/);
  assert.throws(()=>parseV1BulkCsv(valid+'"ULAS-00203","123456","https://app.ulasantoko.space/r-v1/ULAS-00203","extra"\n'),/kolom/);
});
test("rejects CSV without required V1 headers",()=>{
  assert.throws(()=>parseV1BulkCsv("Kode Kartu,PIN,URL\nULAS-00202,012345,"+expected),/Bulk Create V1/);
});

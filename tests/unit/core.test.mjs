import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// core.js 是給瀏覽器用的一般 script，這裡在沙盒裡執行後取出 Core
const ctx = {};
vm.runInNewContext(readFileSync(new URL("../../src/core.js", import.meta.url), "utf8") + "\nthis.Core = Core;", ctx);
const Core = ctx.Core;
const P = Core.PRODUCTS;
const byName = n => P.find(p => p.name === n);
const tomato = byName("淨食番茄"); // 箱盒袋
const algae = byName("藻一杯");    // 箱盒
const entry = (pid, sign, q, id = Math.random()) => ({ id, pid, sign, q, t: 0 });
const plain = v => JSON.parse(JSON.stringify(v)); // vm 物件與本地物件比較前先轉成一般物件

describe("商品清單", () => {
  test("共 44 項，名稱不重複", () => {
    assert.equal(P.length, 44);
    assert.equal(new Set(P.map(p => p.name)).size, 44);
  });
  test("id 與位置一致", () => P.forEach((p, i) => assert.equal(p.id, i)));
  test("金剛密碼與 12 種菌是兩項獨立商品", () => {
    assert.ok(byName("金剛密碼"));
    assert.ok(byName("12 種菌"));
  });
  test("盒袋分列的 4 項是三格", () => {
    for (const n of ["淨食番茄", "薑一壺", "禪滴咖啡", "禪滴紅茶拿鐵"]) assert.deepEqual(plain(byName(n).units), ["箱", "盒", "袋"]);
  });
  test("每項都以箱開頭", () => P.forEach(p => assert.equal(p.units[0], "箱")));
});

describe("搜尋", () => {
  test("空白回傳全部", () => assert.equal(Core.search(P, "  ").length, 44));
  test("打「薑」只剩薑一壺", () => assert.deepEqual(plain(Core.search(P, "薑").map(p => p.name)), ["薑一壺"]));
  test("英文不分大小寫", () => assert.deepEqual(plain(Core.search(P, "sod").map(p => p.name)), ["Super SOD-like"]));
  test("找不到回傳空陣列", () => assert.equal(Core.search(P, "不存在").length, 0));
});

describe("數量輸入整理", () => {
  test("去掉非數字", () => assert.equal(Core.sanitizeQty("1a2盒"), "12"));
  test("去掉開頭的 0", () => assert.equal(Core.sanitizeQty("02"), "2"));
  test("單一 0 保留", () => assert.equal(Core.sanitizeQty("0"), "0"));
  test("清空保持空白", () => assert.equal(Core.sanitizeQty(""), ""));
  test("最多 4 位", () => assert.equal(Core.sanitizeQty("123456"), "1234"));
  test("+ 從 0 變 1", () => assert.equal(Core.step("0", 1), "1"));
  test("− 不會低於 0", () => assert.equal(Core.step("0", -1), "0"));
  test("空格按 − 變 0", () => assert.equal(Core.step("", -1), "0"));
});

describe("合計", () => {
  test("沒有紀錄時全部是 0", () => assert.deepEqual(plain(Core.totals([], tomato)), { 箱: 0, 盒: 0, 袋: 0 }));
  test("分筆輸入合併：先 5 盒再 2 箱 = 2 箱 5 盒", () => {
    const es = [entry(tomato.id, 1, { 盒: 5 }), entry(tomato.id, 1, { 箱: 2 })];
    assert.deepEqual(plain(Core.totals(es, tomato)), { 箱: 2, 盒: 5, 袋: 0 });
  });
  test("10 盒減 3 盒 = 7 盒", () => {
    const es = [entry(algae.id, 1, { 盒: 10 }), entry(algae.id, -1, { 盒: 3 })];
    assert.deepEqual(plain(Core.totals(es, algae)), { 箱: 0, 盒: 7 });
  });
  test("不會算到別的商品", () => {
    const es = [entry(algae.id, 1, { 盒: 10 }), entry(tomato.id, 1, { 盒: 1 })];
    assert.equal(Core.totals(es, algae).盒, 10);
  });
  test("預覽這筆之後的結果", () => {
    const es = [entry(algae.id, 1, { 盒: 10 })];
    assert.deepEqual(plain(Core.preview(es, algae, { 箱: "0", 盒: "3" }, -1)), { 箱: 0, 盒: 7 });
  });
});

describe("檢查輸入", () => {
  const base = { who: "王阿姨", product: tomato, sign: 1, entries: [] };
  test("盤點人空白 → 指向名字欄", () => {
    const r = Core.validate({ ...base, who: "  ", raw: { 箱: "0", 盒: "2", 袋: "0" } });
    assert.equal(r.ok, false);
    assert.equal(r.error.field, "who");
  });
  test("預設 0 的格子可以直接送出", () => {
    const r = Core.validate({ ...base, raw: { 箱: "0", 盒: "2", 袋: "0" } });
    assert.equal(r.ok, true);
    assert.deepEqual(plain(r.q), { 盒: 2 });
  });
  test("清空的格子 → 列出是哪幾格", () => {
    const r = Core.validate({ ...base, raw: { 箱: "", 盒: "2", 袋: "" } });
    assert.equal(r.ok, false);
    assert.equal(r.error.field, "qty");
    assert.deepEqual(plain(r.error.units), ["箱", "袋"]);
    assert.match(r.error.message, /箱、袋/);
  });
  test("增加模式全部 0 可送出（代表庫存 0）", () => {
    const r = Core.validate({ ...base, raw: { 箱: "0", 盒: "0", 袋: "0" } });
    assert.equal(r.ok, true);
    assert.deepEqual(plain(r.q), {});
  });
  test("減少模式全部 0 → 錯誤", () => {
    const r = Core.validate({ ...base, sign: -1, raw: { 箱: "0", 盒: "0", 袋: "0" } });
    assert.equal(r.ok, false);
    assert.match(r.error.message, /減少的數量都是 0/);
  });
  test("減少超過現有數量 → 指出那一格", () => {
    const es = [entry(tomato.id, 1, { 盒: 2 })];
    const r = Core.validate({ ...base, sign: -1, entries: es, raw: { 箱: "0", 盒: "3", 袋: "0" } });
    assert.equal(r.ok, false);
    assert.deepEqual(plain(r.error.units), ["盒"]);
    assert.match(r.error.message, /盒目前只有 2，不能減 3/);
  });
  test("減少剛好等於現有數量可以", () => {
    const es = [entry(tomato.id, 1, { 盒: 3 })];
    assert.equal(Core.validate({ ...base, sign: -1, entries: es, raw: { 箱: "0", 盒: "3", 袋: "0" } }).ok, true);
  });
  test("名字檢查優先於空格檢查", () => {
    const r = Core.validate({ ...base, who: "", raw: { 箱: "", 盒: "", 袋: "" } });
    assert.equal(r.error.field, "who");
  });
});

describe("新增與刪除紀錄", () => {
  test("新增不改動原陣列", () => {
    const a = [];
    const b = Core.addEntry(a, { id: 1, pid: 0, sign: 1, q: { 盒: 1 }, t: 0 });
    assert.equal(a.length, 0);
    assert.equal(b.length, 1);
  });
  test("刪除單筆後合計重算", () => {
    const es = [entry(algae.id, 1, { 盒: 10 }, 1), entry(algae.id, -1, { 盒: 3 }, 2)];
    assert.equal(Core.totals(Core.removeEntry(es, 2), algae).盒, 10);
  });
  test("已盤點判斷", () => {
    assert.equal(Core.isCounted([entry(algae.id, 1, {})], algae.id), true);
    assert.equal(Core.isCounted([], algae.id), false);
  });
});

describe("摘要", () => {
  test("分成有庫存、庫存 0、沒盤點三區", () => {
    const es = [entry(algae.id, 1, { 盒: 4 }), entry(tomato.id, 1, {}), entry(1, 1, { 盒: 2 }), entry(1, -1, { 盒: 2 })];
    const s = Core.summarize(es, P);
    assert.deepEqual(plain(s.has), [algae.id]);
    assert.deepEqual(plain(s.zero).sort((a, b) => a - b), [1, tomato.id]);
    assert.equal(s.none.length, 44 - 3);
    assert.ok(!s.none.includes(algae.id));
  });
  test("依商品清單順序排列", () => {
    const es = [entry(tomato.id, 1, { 盒: 1 }), entry(algae.id, 1, { 盒: 1 })];
    assert.deepEqual(plain(Core.summarize(es, P).has), [algae.id, tomato.id]);
  });
});

describe("格式與暫存", () => {
  test("合計文字", () => assert.equal(Core.formatTotals({ 箱: 2, 盒: 5 }, ["箱", "盒"]), "2 箱　5 盒"));
  test("全部 0 的紀錄顯示「全部 0」", () => assert.equal(Core.formatEntry({ q: {} }), "全部 0"));
  test("日期補零", () => assert.equal(Core.dateStr(new Date(2026, 0, 5)), "2026/01/05"));
  test("壞掉的暫存當作空的", () => assert.deepEqual(plain(Core.loadState("{壞掉")), { who: "", entries: [] }));
  test("沒有暫存", () => assert.deepEqual(plain(Core.loadState(null)), { who: "", entries: [] }));
  test("正常暫存讀回", () => {
    const s = Core.loadState(JSON.stringify({ who: "王", entries: [{ id: 1 }] }));
    assert.equal(s.who, "王");
    assert.equal(s.entries.length, 1);
  });
});

/* 盤點核心邏輯：不碰畫面，只處理資料，方便單元測試 */
const Core = (() => {
  // 單位字串每個字一格，例如 "箱盒袋"。順序即下拉選單與摘要圖的順序。
  const RAW = [
    ["藻一杯", "箱盒"], ["抹茶 YOUNG 菌", "箱盒"], ["Super SOD-like", "箱盒"], ["金剛密碼", "箱盒"], ["12 種菌", "箱盒"],
    ["超級金剛", "箱盒"], ["金剛S膠囊", "箱盒"], ["蔓越莓酵素", "箱盒"], ["顏亮亮膠囊", "箱盒"], ["恆好睡膠囊", "箱盒"],
    ["優質螺旋藻", "箱罐"], ["優質 MCT 椰子油", "箱盒"], ["西芹蔬果青汁", "箱盒"], ["西芹羽衣", "箱盒"], ["西芹粉", "箱盒"],
    ["台灣香檬飲", "箱盒"], ["青汁達人", "箱盒"], ["甘露飲", "箱盒"], ["鈣離子養生湯", "箱盒"], ["布道咖哩", "箱袋"],
    ["淨食番茄", "箱盒袋"], ["薑一壺", "箱盒袋"], ["禪滴咖啡", "箱盒袋"], ["禪滴紅茶拿鐵", "箱盒袋"], ["寒天咖啡", "箱袋"],
    ["咖啡拿鐵", "箱袋"], ["咖啡達人", "箱盒"], ["黑藜麥拿鐵", "箱盒"], ["禪滴米蛋白", "箱袋"], ["綠咖啡 30 入", "箱盒"],
    ["禪滴綠原酸濾掛式咖啡", "箱盒"], ["神奇米胜肽", "箱盒"], ["覓玉黃金元素", "箱盒"], ["禪滴安心堅果", "箱盒"], ["南瓜鬆", "箱盒"],
    ["鈣離子養生餅", "箱盒"], ["明日葉脆餅", "箱盒"], ["雪蓮子穀麥脆片", "箱盒"], ["小米松子酥", "箱盒"],
    ["覓玉爆米花（芥末）", "箱盒"], ["覓玉爆米花（巧克力）", "箱盒"], ["覓玉爆米花（檸檬）", "箱盒"], ["檸檬薄片", "箱盒"],
    ["馬鈴薯脆片（芥末口味）", "箱盒"],
  ];
  const PRODUCTS = RAW.map(([name, u], id) => ({ id, name, units: [...u] }));
  // 商品清單有增減或換順序時，版本號要加一，讓手機上的舊暫存作廢
  const STORAGE_KEY = "mei-inventory-v2";

  const search = (products, text) => {
    const q = String(text || "").trim().toLowerCase();
    return q ? products.filter(p => p.name.toLowerCase().includes(q)) : products.slice();
  };

  const totals = (entries, product) => {
    const t = {};
    product.units.forEach(u => { t[u] = 0; });
    entries.filter(e => e.pid === product.id).forEach(e => {
      for (const u in e.q) t[u] = (t[u] || 0) + e.sign * e.q[u];
    });
    return t;
  };

  const isCounted = (entries, pid) => entries.some(e => e.pid === pid);

  // 輸入框內容整理：只留數字、去掉開頭多餘的 0、最多 4 位
  const sanitizeQty = s => String(s ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 4);

  const step = (s, delta) => String(Math.max(0, (parseInt(s, 10) || 0) + delta));

  const formatTotals = (t, units) => units.map(u => `${t[u] || 0} ${u}`).join("　");

  const formatEntry = e => Object.entries(e.q).map(([u, v]) => `${v} ${u}`).join(" ") || "全部 0";

  /**
   * 檢查一筆輸入。raw = { 箱: "2", 盒: "" }（輸入框原始字串）
   * 回傳 { ok, q, error: { field: "who" | "qty", units?, message } }
   */
  const validate = ({ who, product, raw, sign, entries }) => {
    if (!String(who || "").trim()) {
      return { ok: false, error: { field: "who", message: "請先填寫盤點人的名字。" } };
    }
    const empty = product.units.filter(u => String(raw[u] ?? "").trim() === "");
    if (empty.length) {
      return { ok: false, error: { field: "qty", units: empty, message: `「${empty.join("、")}」是空的，沒有的話請填 0。` } };
    }
    const q = {};
    product.units.forEach(u => { const v = parseInt(raw[u], 10) || 0; if (v) q[u] = v; });
    if (sign < 0) {
      if (!Object.keys(q).length) {
        return { ok: false, error: { field: "qty", units: product.units.slice(), message: "減少的數量都是 0，請填要減少幾個。" } };
      }
      const t = totals(entries, product);
      for (const u of product.units) {
        if ((q[u] || 0) > t[u]) {
          return { ok: false, error: { field: "qty", units: [u], message: `${u}目前只有 ${t[u]}，不能減 ${q[u]}。` } };
        }
      }
    }
    return { ok: true, q };
  };

  const preview = (entries, product, raw, sign) => {
    const t = totals(entries, product), after = {};
    product.units.forEach(u => { after[u] = t[u] + sign * (parseInt(raw[u], 10) || 0); });
    return after;
  };

  const addEntry = (entries, { pid, sign, q, t, id }) => entries.concat([{ id, pid, sign, q, t }]);
  const removeEntry = (entries, id) => entries.filter(e => e.id !== id);

  const countedIds = entries => [...new Set(entries.map(e => e.pid))].sort((a, b) => a - b);

  // 摘要圖的三個區塊
  const summarize = (entries, products) => {
    const ids = countedIds(entries);
    const has = ids.filter(id => Object.values(totals(entries, products[id])).some(v => v > 0));
    const zero = ids.filter(id => !has.includes(id));
    const none = products.filter(p => !ids.includes(p.id)).map(p => p.id);
    return { counted: ids, has, zero, none };
  };

  const dateStr = d => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;

  const loadState = raw => {
    try {
      const s = JSON.parse(raw || "null");
      if (s && Array.isArray(s.entries)) return { who: typeof s.who === "string" ? s.who : "", entries: s.entries };
    } catch (e) { /* 壞掉的暫存就當作沒有 */ }
    return { who: "", entries: [] };
  };

  return { PRODUCTS, STORAGE_KEY, search, totals, isCounted, sanitizeQty, step, formatTotals, formatEntry,
    validate, preview, addEntry, removeEntry, countedIds, summarize, dateStr, loadState };
})();
if (typeof module !== "undefined") module.exports = Core;

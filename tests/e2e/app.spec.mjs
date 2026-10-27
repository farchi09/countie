import { test, expect } from "@playwright/test";

const APP = new URL("../../dist/index.html", import.meta.url).href;

// 每個測試都是全新的瀏覽器（暫存是空的）；外部字型擋掉，測試不依賴網路
test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(APP);
});

const pick = async (page, name) => {
  await page.locator("#plist button", { hasText: name }).first().tap();
  await expect(page.locator("#chosenName")).toHaveText(name);
};
const setQty = (page, unit, v) => page.fill(`#q-${unit}`, v);
const add = page => page.locator("#addBtn").tap();
const row = (page, name) => page.locator("#rows .row", { hasText: name });
const signIn = page => page.fill("#who", "王阿姨");
const record = async (page, name, qty, mode = "add") => {
  await pick(page, name);
  if (mode === "sub") await page.locator("#mSub").tap();
  for (const [u, v] of Object.entries(qty)) await setQty(page, u, v);
  await add(page);
};

test.describe("初始畫面", () => {
  test("顯示今天日期、44 項商品與空的已盤點區", async ({ page }) => {
    await expect(page.locator("#today")).toHaveText(/^\d{4}\/\d{2}\/\d{2}$/);
    await expect(page.locator("#plist button")).toHaveCount(44);
    await expect(page.locator("#rows")).toContainText("還沒有資料");
    await expect(page.locator("#enter")).toBeHidden();
  });
  test("手機寬度不會左右捲動", async ({ page }) => {
    await signIn(page);
    await pick(page, "淨食番茄");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("搜尋商品", () => {
  test("打「薑」只剩薑一壺", async ({ page }) => {
    await page.fill("#q", "薑");
    await expect(page.locator("#plist button")).toHaveCount(1);
    await expect(page.locator("#plist button")).toContainText("薑一壺");
  });
  test("找不到時顯示提示", async ({ page }) => {
    await page.fill("#q", "不存在的商品");
    await expect(page.locator("#noMatch")).toBeVisible();
  });
  test("「看結果」按鈕收起鍵盤", async ({ page }) => {
    await page.locator("#q").tap();
    await expect(page.locator("#kbDone")).toBeVisible();
    await page.locator("#kbDone").tap();
    await expect(page.locator("#q")).not.toBeFocused();
    await expect(page.locator("#kbDone")).toBeHidden();
  });
  test("按 Enter 收起鍵盤", async ({ page }) => {
    await page.locator("#q").tap();
    await page.keyboard.type("咖啡");
    await page.keyboard.press("Enter");
    await expect(page.locator("#q")).not.toBeFocused();
    await expect(page.locator("#plist button").first()).toBeVisible();
  });
});

test.describe("選商品與輸入格", () => {
  test("三格商品顯示箱、盒、袋，預設都是 0", async ({ page }) => {
    await pick(page, "淨食番茄");
    for (const u of ["箱", "盒", "袋"]) await expect(page.locator(`#q-${u}`)).toHaveValue("0");
    await expect(page.locator("#qtys .qty")).toHaveCount(3);
  });
  test("每項商品都有箱、盒、袋三格，預設都是 0", async ({ page }) => {
    for (const name of ["藻一杯", "布道咖哩", "馬鈴薯脆片（芥末口味）"]) {
      await pick(page, name);
      await expect(page.locator("#qtys .qty")).toHaveCount(3);
      for (const u of ["箱", "盒", "袋"]) await expect(page.locator(`#q-${u}`)).toHaveValue("0");
      await page.locator("#change").tap();
    }
  });
  test("螺旋藻顯示箱、罐、袋", async ({ page }) => {
    await pick(page, "優質螺旋藻");
    for (const u of ["箱", "罐", "袋"]) await expect(page.locator(`#q-${u}`)).toHaveValue("0");
  });
  test("「換商品」回到清單", async ({ page }) => {
    await pick(page, "藻一杯");
    await page.locator("#change").tap();
    await expect(page.locator("#enter")).toBeHidden();
    await expect(page.locator("#plist button")).toHaveCount(44);
  });
  test("＋／− 按鈕增減，不會低於 0", async ({ page }) => {
    await pick(page, "藻一杯");
    const plus = page.locator('button[data-step="1"][data-u="盒"]'), minus = page.locator('button[data-step="-1"][data-u="盒"]');
    await plus.tap(); await plus.tap();
    await expect(page.locator("#q-盒")).toHaveValue("2");
    await minus.tap(); await minus.tap(); await minus.tap();
    await expect(page.locator("#q-盒")).toHaveValue("0");
  });
  test("點格子直接打數字會取代 0，非數字會被忽略", async ({ page }) => {
    await pick(page, "藻一杯");
    await page.locator("#q-盒").tap();
    await page.keyboard.type("2");
    await expect(page.locator("#q-盒")).toHaveValue("2");
    await page.locator("#q-箱").fill("1a");
    await expect(page.locator("#q-箱")).toHaveValue("1");
  });
});

test.describe("錯誤提示", () => {
  test("盤點人沒填：紅框、提示、跳到名字欄，輸入後消失", async ({ page }) => {
    await pick(page, "藻一杯");
    await setQty(page, "盒", "2");
    await add(page);
    await expect(page.locator("#who")).toHaveClass(/bad/);
    await expect(page.locator("#whoErr")).toBeVisible();
    await expect(page.locator("#who")).toBeFocused();
    await expect(page.locator("#rows")).toContainText("還沒有資料");
    await page.locator("#who").type("王");
    await expect(page.locator("#who")).not.toHaveClass(/bad/);
    await expect(page.locator("#whoErr")).toBeHidden();
  });
  test("只填盒、箱保持 0 可以直接送出", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 盒: "2" });
    await expect(row(page, "藻一杯")).toContainText("0 箱　2 盒　0 袋");
    await expect(page.locator("#err")).toBeHidden();
  });
  test("清空的格子：紅框、指出哪幾格、跳到第一格，輸入後消失", async ({ page }) => {
    await signIn(page);
    await pick(page, "淨食番茄");
    await setQty(page, "箱", "");
    await setQty(page, "袋", "");
    await add(page);
    await expect(page.locator("#err")).toHaveText("「箱、袋」是空的，沒有的話請填 0。");
    await expect(page.locator("#q-箱")).toHaveClass(/bad/);
    await expect(page.locator("#q-袋")).toHaveClass(/bad/);
    await expect(page.locator("#q-盒")).not.toHaveClass(/bad/);
    await expect(page.locator("#q-箱")).toBeFocused();
    await page.locator("#q-箱").fill("1");
    await expect(page.locator("#q-箱")).not.toHaveClass(/bad/);
    await expect(page.locator("#q-袋")).toHaveClass(/bad/);
  });
  test("用 − 按鈕把空格補成 0 也會清掉紅框", async ({ page }) => {
    await signIn(page);
    await pick(page, "藻一杯");
    await setQty(page, "箱", "");
    await add(page);
    await page.locator('button[data-step="-1"][data-u="箱"]').tap();
    await expect(page.locator("#q-箱")).toHaveValue("0");
    await expect(page.locator("#q-箱")).not.toHaveClass(/bad/);
  });
  test("減少的數量都是 0 不能送出", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 盒: "5" });
    await pick(page, "藻一杯");
    await page.locator("#mSub").tap();
    await add(page);
    await expect(page.locator("#err")).toContainText("減少的數量都是 0");
    await expect(row(page, "藻一杯").locator(".entry")).toHaveCount(1);
  });
  test("減少超過現有數量不能送出", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 盒: "2" });
    await pick(page, "藻一杯");
    await page.locator("#mSub").tap();
    await setQty(page, "盒", "3");
    await add(page);
    await expect(page.locator("#err")).toHaveText("盒目前只有 2，不能減 3。");
    await expect(page.locator("#q-盒")).toHaveClass(/bad/);
    await expect(row(page, "藻一杯")).toContainText("0 箱　2 盒　0 袋");
  });
});

test.describe("加入與合計", () => {
  test("加入後回到選商品，清單標示已盤點", async ({ page }) => {
    await signIn(page);
    await record(page, "南瓜鬆", { 箱: "1", 盒: "3" });
    await expect(page.locator("#enter")).toBeHidden();
    await expect(page.locator("#plist button", { hasText: "南瓜鬆" }).locator(".tag")).toHaveText("已盤點");
    await expect(page.locator("#cnt")).toHaveText("（1 項）");
  });
  test("分筆輸入合併：先 5 盒再 2 箱 = 2 箱 5 盒", async ({ page }) => {
    await signIn(page);
    await record(page, "淨食番茄", { 盒: "5" });
    await record(page, "淨食番茄", { 箱: "2" });
    await expect(row(page, "淨食番茄").locator(".row-head")).toContainText("2 箱　5 盒　0 袋");
    await expect(row(page, "淨食番茄").locator(".entry")).toHaveCount(2);
  });
  test("已盤點的商品顯示目前數字", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 箱: "1", 盒: "4" });
    await pick(page, "藻一杯");
    await expect(page.locator('[data-now="箱"]')).toHaveText("目前 1");
    await expect(page.locator('[data-now="盒"]')).toHaveText("目前 4");
  });
});

test.describe("增加／減少", () => {
  test("切換按鈕會改變選取狀態與送出按鈕", async ({ page }) => {
    await pick(page, "藻一杯");
    await expect(page.locator("#mAdd")).toHaveClass("on-add");
    await expect(page.locator("#mAdd")).toHaveText("✓ ＋ 增加");
    await page.locator("#mSub").tap();
    await expect(page.locator("#mSub")).toHaveClass("on-sub");
    await expect(page.locator("#mSub")).toHaveText("✓ － 減少");
    await expect(page.locator("#mAdd")).not.toHaveClass("on-add");
    await expect(page.locator("#addBtn")).toHaveText("確定減少");
    await page.locator("#mAdd").tap();
    await expect(page.locator("#mAdd")).toHaveClass("on-add");
    await expect(page.locator("#addBtn")).toHaveText("加入");
  });
  test("每次選商品都從「增加」開始", async ({ page }) => {
    await pick(page, "藻一杯");
    await page.locator("#mSub").tap();
    await page.locator("#change").tap();
    await pick(page, "藻一杯");
    await expect(page.locator("#mAdd")).toHaveClass("on-add");
  });
  test("10 盒有人買走 3 盒：預覽與結果都是 7 盒", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 盒: "10" });
    await pick(page, "藻一杯");
    await page.locator("#mSub").tap();
    await setQty(page, "盒", "3");
    await expect(page.locator("#result")).toHaveText("這筆之後：0 箱　7 盒　0 袋");
    await add(page);
    await expect(row(page, "藻一杯").locator(".row-head")).toContainText("0 箱　7 盒　0 袋");
    await expect(row(page, "藻一杯").locator(".entry .sub")).toContainText("減少 3 盒");
  });
});

test.describe("袋的增加／減少", () => {
  test("只填袋：箱盒保持 0 直接送出", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 袋: "6" });
    await expect(page.locator("#err")).toBeHidden();
    await expect(row(page, "藻一杯").locator(".row-head")).toContainText("0 箱　0 盒　6 袋");
    await expect(row(page, "藻一杯").locator(".entry")).toContainText("增加 6 袋");
  });
  test("袋用 ＋／− 按鈕增減", async ({ page }) => {
    await pick(page, "藻一杯");
    const plus = page.locator('button[data-step="1"][data-u="袋"]');
    await plus.tap(); await plus.tap(); await plus.tap();
    await expect(page.locator("#q-袋")).toHaveValue("3");
    await page.locator('button[data-step="-1"][data-u="袋"]').tap();
    await expect(page.locator("#q-袋")).toHaveValue("2");
  });
  test("箱盒袋一次填：1 箱 2 盒 3 袋", async ({ page }) => {
    await signIn(page);
    await record(page, "南瓜鬆", { 箱: "1", 盒: "2", 袋: "3" });
    await expect(row(page, "南瓜鬆").locator(".row-head")).toContainText("1 箱　2 盒　3 袋");
  });
  test("6 袋減 2 袋：預覽與結果都是 4 袋，箱盒不變", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 箱: "1", 袋: "6" });
    await pick(page, "藻一杯");
    await expect(page.locator('[data-now="袋"]')).toHaveText("目前 6");
    await page.locator("#mSub").tap();
    await setQty(page, "袋", "2");
    await expect(page.locator("#result")).toHaveText("這筆之後：1 箱　0 盒　4 袋");
    await add(page);
    await expect(row(page, "藻一杯").locator(".row-head")).toContainText("1 箱　0 盒　4 袋");
    await expect(row(page, "藻一杯").locator(".entry .sub")).toContainText("減少 2 袋");
  });
  test("減少袋超過現有數量：紅框在袋、不送出", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 盒: "5", 袋: "1" });
    await pick(page, "藻一杯");
    await page.locator("#mSub").tap();
    await setQty(page, "袋", "2");
    await add(page);
    await expect(page.locator("#err")).toHaveText("袋目前只有 1，不能減 2。");
    await expect(page.locator("#q-袋")).toHaveClass(/bad/);
    await expect(page.locator("#q-袋")).toBeFocused();
    await expect(page.locator("#q-盒")).not.toHaveClass(/bad/);
    await expect(row(page, "藻一杯").locator(".entry")).toHaveCount(1);
  });
  test("袋格被清空：紅框、提示、跳到袋", async ({ page }) => {
    await signIn(page);
    await pick(page, "藻一杯");
    await setQty(page, "盒", "1");
    await setQty(page, "袋", "");
    await add(page);
    await expect(page.locator("#err")).toHaveText("「袋」是空的，沒有的話請填 0。");
    await expect(page.locator("#q-袋")).toHaveClass(/bad/);
    await expect(page.locator("#q-袋")).toBeFocused();
  });
  test("摘要圖納入袋的數量", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 袋: "3" });
    await page.locator("#done").tap();
    await expect(page.locator("#summaryImg")).toBeVisible();
  });
});

test.describe("刪除紀錄", () => {
  test("要按兩次才刪除，刪除後合計重算", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 盒: "10" });
    await record(page, "藻一杯", { 盒: "3" }, "sub");
    const del = row(page, "藻一杯").locator(".entry button").nth(1);
    await del.tap();
    await expect(del).toHaveText("確定刪除");
    await expect(row(page, "藻一杯").locator(".entry")).toHaveCount(2);
    await del.tap();
    await expect(row(page, "藻一杯").locator(".entry")).toHaveCount(1);
    await expect(row(page, "藻一杯").locator(".row-head")).toContainText("0 箱　10 盒　0 袋");
  });
  test("刪掉最後一筆，商品回到未盤點", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 盒: "1" });
    const del = row(page, "藻一杯").locator(".entry button");
    await del.tap(); await del.tap();
    await expect(page.locator("#rows")).toContainText("還沒有資料");
    await expect(page.locator("#plist button", { hasText: "藻一杯" }).locator(".tag")).toHaveCount(0);
  });
});

test.describe("摘要圖", () => {
  test("沒有資料時提示先加入商品", async ({ page }) => {
    await page.locator("#done").tap();
    await expect(page.locator("#noData")).toBeVisible();
    await expect(page.locator("#summaryImg")).toHaveCount(0);
  });
  test("有資料但盤點人被清掉時，提示名字", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 盒: "1" });
    await page.fill("#who", "");
    await page.locator("#done").tap();
    await expect(page.locator("#whoErr")).toBeVisible();
    await expect(page.locator("#summaryImg")).toHaveCount(0);
  });
  test("產生直式摘要圖，寬 1080", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 箱: "1", 盒: "4" });
    await record(page, "南瓜鬆", { 箱: "0" });
    await page.locator("#done").tap();
    const img = page.locator("#summaryImg");
    await expect(img).toBeVisible();
    const size = await img.evaluate(el => el.complete && ({ w: el.naturalWidth, h: el.naturalHeight }));
    expect(size.w).toBe(1080);
    expect(size.h).toBeGreaterThan(size.w);
  });
  test("無法直接分享時提示長按圖片", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 盒: "1" });
    await page.locator("#done").tap();
    await expect(page.locator("#summaryImg")).toBeVisible();
    await page.evaluate(() => { Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }); });
    await page.locator("#share").tap();
    await expect(page.locator("#share")).toHaveText("請長按上面的圖片分享");
  });
  test("「繼續盤點」收起摘要區", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 盒: "1" });
    await page.locator("#done").tap();
    await page.locator("#back").tap();
    await expect(page.locator("#outCard")).toBeHidden();
    await expect(row(page, "藻一杯")).toBeVisible();
  });
});

test.describe("清空與暫存", () => {
  test("按一次只提示，按第二次才清空", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 盒: "1" });
    await page.locator("#done").tap();
    await page.locator("#reset").tap();
    await expect(page.locator("#reset")).toHaveText("再按一次確定清空");
    await expect(row(page, "藻一杯")).toBeVisible();
    await page.locator("#reset").tap();
    await expect(page.locator("#rows")).toContainText("還沒有資料");
    await expect(page.locator("#outCard")).toBeHidden();
  });
  test("清空不會刪掉盤點人名字", async ({ page }) => {
    await signIn(page);
    await record(page, "藻一杯", { 盒: "1" });
    await page.locator("#done").tap();
    await page.locator("#reset").tap(); await page.locator("#reset").tap();
    await page.reload();
    await expect(page.locator("#who")).toHaveValue("王阿姨");
  });
  test("重新整理後資料還在", async ({ page }) => {
    await signIn(page);
    await record(page, "淨食番茄", { 箱: "2", 盒: "5" });
    await page.reload();
    await expect(page.locator("#who")).toHaveValue("王阿姨");
    await expect(row(page, "淨食番茄").locator(".row-head")).toContainText("2 箱　5 盒　0 袋");
  });
  test("暫存壞掉時照常開啟", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("mei-inventory-v2", "{壞掉"));
    await page.reload();
    await expect(page.locator("#plist button")).toHaveCount(44);
    await expect(page.locator("#rows")).toContainText("還沒有資料");
  });
});

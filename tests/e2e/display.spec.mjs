import { test, expect } from "@playwright/test";

const APP = new URL("../../dist/index.html", import.meta.url).href;
const LIGHT_BG = "rgb(238, 242, 241)"; // --bg
const CARD_BG = "rgb(255, 255, 255)"; // --card
const INK = "rgb(21, 36, 42)";        // --ink

const open = async page => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(APP);
};
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("深色模式：手機設成深色也維持淺色", () => {
  test.use({ colorScheme: "dark" });

  test("背景、卡片、文字顏色與淺色模式相同", async ({ page }) => {
    await open(page);
    const c = await page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      card: getComputedStyle(document.querySelector(".card")).backgroundColor,
      ink: getComputedStyle(document.body).color,
      scheme: getComputedStyle(document.documentElement).colorScheme,
    }));
    expect(c.body).toBe(LIGHT_BG);
    expect(c.card).toBe(CARD_BG);
    expect(c.ink).toBe(INK);
    expect(c.scheme.split(" ").sort()).toEqual(["light", "only"]);
  });

  test("輸入框維持白底深字", async ({ page }) => {
    await open(page);
    await page.locator("#plist button").first().tap();
    const s = await page.locator("#q-盒").evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color }));
    expect(s.bg).toBe(LIGHT_BG);
    expect(s.fg).toBe(INK);
  });

  test("網頁宣告只用淺色", async ({ page }) => {
    await open(page);
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", "only light");
  });
});

test.describe("字體放大", () => {
  test("關閉手機自動放大字", async ({ page }) => {
    await open(page);
    const v = await page.evaluate(() => {
      const st = getComputedStyle(document.documentElement);
      return st.getPropertyValue("text-size-adjust") || st.getPropertyValue("-webkit-text-size-adjust");
    });
    expect(v).toBe("100%");
  });

  // 系統字體放大在新版 Chrome 會變成整頁縮放，等於畫面變窄：412 寬手機放大 130% ≈ 317、150% ≈ 275、200% = 206
  for (const zoom of [1.3, 1.5, 2]) {
    test(`整頁放大 ${Math.round(zoom * 100)}% 時，三格數量不會被擠出畫面`, async ({ page }) => {
      await page.setViewportSize({ width: Math.round(412 / zoom), height: Math.round(915 / zoom) });
      await open(page);
      await page.fill("#who", "王阿姨");
      await page.locator("#plist button", { hasText: "禪滴綠原酸濾掛式咖啡" }).tap();
      expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
      const vw = await page.evaluate(() => document.documentElement.clientWidth);
      for (const u of ["箱", "盒", "袋"]) {
        const plus = await page.locator(`button[data-step="1"][data-u="${u}"]`).boundingBox();
        expect(plus.x + plus.width).toBeLessThanOrEqual(vw + 1);
        expect(plus.width).toBeGreaterThanOrEqual(40);
      }
      // 放大後一樣能操作：＋ 按鈕、送出
      await page.locator('button[data-step="1"][data-u="袋"]').tap();
      await expect(page.locator("#q-袋")).toHaveValue("1");
      await page.locator("#addBtn").tap();
      await expect(page.locator("#rows")).toContainText("1 袋");
    });
  }

  test("小螢幕（320 寬）不會左右捲動", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page);
    await page.locator("#plist button", { hasText: "淨食番茄" }).tap();
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  });
});

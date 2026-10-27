import { test, expect } from "@playwright/test";

const APP = new URL("../../dist/index.html", import.meta.url).href;
test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(APP);
});

const openSettings = page => page.locator("#settingsBtn").tap();
const FONT_ID = { 小: "s", 標準: "m", 大: "l", 特大: "xl" };
const choose = (page, label) => page.locator(`#sizes button[data-font="${FONT_ID[label]}"]`).tap();
const zoom = page => page.evaluate(() => parseFloat(getComputedStyle(document.body).zoom));
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const titleHeight = page => page.locator("h1").evaluate(el => el.getBoundingClientRect().height);

test.describe("字體大小設定", () => {
  test("預設收起，按「字體大小」打開，按「好了」收起", async ({ page }) => {
    await expect(page.locator("#settings")).toBeHidden();
    await openSettings(page);
    await expect(page.locator("#settings")).toBeVisible();
    await expect(page.locator("#settingsBtn")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#sizes button")).toHaveCount(4);
    await page.locator("#settingsDone").tap();
    await expect(page.locator("#settings")).toBeHidden();
    await expect(page.locator("#settingsBtn")).toHaveAttribute("aria-expanded", "false");
  });

  test("預設是「標準」並打勾", async ({ page }) => {
    await openSettings(page);
    await expect(page.locator('#sizes button[aria-pressed="true"] small')).toHaveText("標準");
    expect(await zoom(page)).toBe(1);
  });

  test("選「特大」整個版面放大，選「小」縮小", async ({ page }) => {
    const base = await titleHeight(page);
    await openSettings(page);
    await choose(page, "特大");
    expect(await zoom(page)).toBeCloseTo(1.3);
    await expect(page.locator('#sizes button[aria-pressed="true"] small')).toHaveText("特大");
    await expect(page.locator('#sizes button[aria-pressed="true"]')).toHaveCount(1);
    const lines = await page.locator('#sizes button[aria-pressed="true"] small').evaluate(el => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || 20)));
    expect(lines).toBeLessThanOrEqual(1);
    expect(await titleHeight(page)).toBeGreaterThan(base * 1.2);
    await choose(page, "小");
    expect(await zoom(page)).toBeCloseTo(0.85);
    expect(await titleHeight(page)).toBeLessThan(base);
  });

  test("重新打開網頁後記得選擇", async ({ page }) => {
    await openSettings(page);
    await choose(page, "大");
    await page.reload();
    expect(await zoom(page)).toBeCloseTo(1.15);
    await openSettings(page);
    await expect(page.locator('#sizes button[aria-pressed="true"] small')).toHaveText("大");
  });

  test("清空盤點不會重設字體大小", async ({ page }) => {
    await openSettings(page);
    await choose(page, "特大");
    await page.fill("#who", "王阿姨");
    await page.locator("#plist button", { hasText: "藻一杯" }).tap();
    await page.locator("#addBtn").tap();
    await page.locator("#done").tap();
    await page.locator("#reset").tap();
    await page.locator("#reset").tap();
    await page.reload();
    expect(await zoom(page)).toBeCloseTo(1.3);
  });

  test("設定壞掉時回到標準", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("mei-inventory-font", "壞掉"));
    await page.reload();
    expect(await zoom(page)).toBe(1);
  });

  // 每種大小 × 不同手機寬度：完整走一次盤點，畫面不能左右捲動、按鈕都按得到
  for (const label of ["小", "標準", "大", "特大"]) {
    for (const width of [412, 360, 320]) {
      test(`「${label}」在 ${width} 寬：可完整盤點且不左右捲動`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await openSettings(page);
        await choose(page, label);
        await page.locator("#settingsDone").tap();
        expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
        await page.fill("#who", "王阿姨");
        await page.locator("#plist button", { hasText: "禪滴綠原酸濾掛式咖啡" }).tap();
        expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
        const vw = await page.evaluate(() => window.innerWidth);
        for (const u of ["箱", "盒", "袋"]) {
          const box = await page.locator(`button[data-step="1"][data-u="${u}"]`).boundingBox();
          expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
        }
        await page.locator('button[data-step="1"][data-u="袋"]').tap();
        await page.locator("#addBtn").tap();
        await expect(page.locator("#rows")).toContainText("0 箱　0 盒　1 袋");
        await page.locator("#plist button", { hasText: "禪滴綠原酸濾掛式咖啡" }).tap();
        await page.locator("#mSub").tap();
        await page.fill("#q-袋", "1");
        await page.locator("#addBtn").tap();
        await expect(page.locator("#rows .row-head")).toContainText("0 箱　0 盒　0 袋");
        await page.locator("#done").tap();
        await expect(page.locator("#summaryImg")).toBeVisible();
        expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
      });
    }
  }

  test("手機已整頁放大 150% 再選「特大」：仍可操作", async ({ page }) => {
    await page.setViewportSize({ width: 275, height: 610 });
    await openSettings(page);
    await choose(page, "特大");
    await page.locator("#settingsDone").tap();
    await page.fill("#who", "王阿姨");
    await page.locator("#plist button", { hasText: "淨食番茄" }).tap();
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
    await page.locator('button[data-step="1"][data-u="盒"]').tap();
    await page.locator("#addBtn").tap();
    await expect(page.locator("#rows")).toContainText("0 箱　1 盒　0 袋");
  });

  test("摘要圖大小不受字體設定影響", async ({ page }) => {
    await openSettings(page);
    await choose(page, "特大");
    await page.fill("#who", "王阿姨");
    await page.locator("#plist button", { hasText: "藻一杯" }).tap();
    await page.fill("#q-盒", "2");
    await page.locator("#addBtn").tap();
    await page.locator("#done").tap();
    const w = await page.locator("#summaryImg").evaluate(el => el.naturalWidth);
    expect(w).toBe(1080);
  });
});

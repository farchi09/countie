import { test, expect } from "@playwright/test";

// 模擬 Android Chrome 的「網頁內容強制深色」：瀏覽器自己把網頁反黑，CSS 讀不到，只能看實際畫面
test.use({ colorScheme: "dark", launchOptions: { args: ["--blink-settings=forceDarkModeEnabled=true", "--enable-features=WebContentsForceDark"] } });

const APP = new URL("../../dist/index.html", import.meta.url).href;

test("強制深色開啟時，畫面仍是淺色底", async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(APP);
  const png = await page.screenshot({ clip: { x: 2, y: 2, width: 4, height: 4 } });
  // 讀左上角背景的實際像素亮度
  const brightness = await page.evaluate(async b64 => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const [r, g, bl] = x.getImageData(1, 1, 1, 1).data;
    return (r + g + bl) / 3;
  }, png.toString("base64"));
  expect(brightness).toBeGreaterThan(200);
});

import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: { ...devices["Pixel 7"], browserName: "chromium", locale: "zh-TW", timezoneId: "Asia/Taipei" },
});

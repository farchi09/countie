// 只在 npm run package 裡、測試全部通過後執行：把 dist/index.html 與 README 打包成 zip
import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, rmSync } from "node:fs";
const out = "release/mei-inventory";
rmSync("release", { recursive: true, force: true });
mkdirSync(out, { recursive: true });
copyFileSync("dist/index.html", `${out}/index.html`);
copyFileSync("README.md", `${out}/README.md`);
execFileSync("zip", ["-qr", "mei-inventory.zip", "mei-inventory"], { cwd: "release" });
console.log("打包完成：release/mei-inventory.zip");

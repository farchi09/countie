// 把 src/ 組成可部署的 dist/index.html，以及預覽用的 dist/artifact.html
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const root = new URL("..", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
const scripts = `<script>\n${read("src/core.js")}</script>\n<script>\n${read("src/ui.js")}</script>\n`;
const body = read("src/app.html").replace("<!-- SCRIPTS -->", scripts);
const [head, rest] = body.split("</style>");
mkdirSync(new URL("dist/", root), { recursive: true });
writeFileSync(new URL("dist/artifact.html", root), body);
writeFileSync(new URL("dist/index.html", root),
  `<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${head}</style>\n</head>\n<body>${rest}</body>\n</html>\n`);
console.log("built dist/index.html");

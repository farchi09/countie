/* 畫面操作：所有計算交給 Core */
(() => {
  const P = Core.PRODUCTS;
  const $ = id => document.getElementById(id);
  const store = {
    get: () => { try { return localStorage.getItem(Core.STORAGE_KEY); } catch (e) { return null; } },
    set: v => { try { localStorage.setItem(Core.STORAGE_KEY, v); } catch (e) { /* 無法暫存時照常使用 */ } },
  };
  let S = Core.loadState(store.get()), cur = null, sign = 1, armed = null, resetArmed = false, resetTimer = null, lastBlob = null;
  const save = () => store.set(JSON.stringify(S));
  const dateStr = Core.dateStr(new Date());

  $("today").textContent = dateStr;
  $("who").value = S.who;
  $("who").addEventListener("input", e => {
    S.who = e.target.value.trim(); save();
    $("who").classList.remove("bad"); $("whoErr").hidden = true;
  });

  /* ---------- 選商品 ---------- */
  function renderList() {
    const items = Core.search(P, $("q").value);
    $("plist").innerHTML = items.length
      ? items.map(p => `<button data-id="${p.id}"><span>${p.name}</span>${Core.isCounted(S.entries, p.id) ? '<span class="tag">已盤點</span>' : ""}</button>`).join("")
      : '<p class="empty" id="noMatch" style="padding:14px">找不到這個商品，換個字試試。</p>';
  }
  const closeKb = () => $("q").blur();
  $("q").addEventListener("input", renderList);
  $("q").addEventListener("focus", () => { $("kbDone").hidden = false; setTimeout(() => $("pick").scrollIntoView({ behavior: "smooth", block: "start" }), 300); });
  $("q").addEventListener("blur", () => setTimeout(() => { $("kbDone").hidden = true; }, 150));
  $("q").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); closeKb(); } });
  $("q").addEventListener("search", closeKb);
  $("kbDone").addEventListener("click", closeKb);
  $("plist").addEventListener("touchstart", closeKb, { passive: true });
  $("plist").addEventListener("scroll", closeKb, { passive: true });
  $("plist").addEventListener("click", e => { const b = e.target.closest("button[data-id]"); if (b) choose(+b.dataset.id); });

  function choose(pid) {
    cur = pid; sign = 1;
    $("chosenName").textContent = P[pid].name;
    $("chosen").hidden = false; $("pickBox").hidden = true; $("plist").hidden = true; $("enter").hidden = false;
    $("qtys").innerHTML = P[pid].units.map(u => `<div class="qty"><span class="u">${u}</span><span class="now" data-now="${u}"></span>
      <input type="text" inputmode="numeric" id="q-${u}" data-u="${u}" value="0" aria-label="${u}數量">
      <button data-step="-1" data-u="${u}" aria-label="${u}減一">−</button><button data-step="1" data-u="${u}" aria-label="${u}加一">＋</button></div>`).join("");
    update();
    $("enter").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function backToPick() {
    cur = null; $("chosen").hidden = true; $("pickBox").hidden = false; $("plist").hidden = false; $("enter").hidden = true;
    $("q").value = ""; renderList();
  }
  $("change").addEventListener("click", backToPick);

  /* ---------- 填數量 ---------- */
  const raw = () => Object.fromEntries(P[cur].units.map(u => [u, $("q-" + u).value]));
  $("mAdd").addEventListener("click", () => { sign = 1; update(); });
  $("mSub").addEventListener("click", () => { sign = -1; update(); });
  $("qtys").addEventListener("click", e => {
    const b = e.target.closest("button[data-step]"); if (!b) return;
    const i = $("q-" + b.dataset.u); i.value = Core.step(i.value, +b.dataset.step); i.classList.remove("bad"); update();
  });
  $("qtys").addEventListener("input", e => {
    if (!e.target.matches("input")) return;
    e.target.value = Core.sanitizeQty(e.target.value); e.target.classList.remove("bad"); update();
  });
  $("qtys").addEventListener("focusin", e => { if (e.target.matches("input")) setTimeout(() => e.target.select(), 0); });

  function update() {
    if (cur == null) return;
    const p = P[cur], has = Core.isCounted(S.entries, cur), t = Core.totals(S.entries, p);
    $("mAdd").className = sign > 0 ? "on-add" : ""; $("mSub").className = sign < 0 ? "on-sub" : "";
    $("mAdd").textContent = (sign > 0 ? "✓ " : "") + "＋ 增加";
    $("mSub").textContent = (sign < 0 ? "✓ " : "") + "－ 減少";
    $("addBtn").classList.toggle("sub", sign < 0);
    $("addBtn").textContent = sign < 0 ? "確定減少" : "加入";
    document.querySelectorAll("[data-now]").forEach(el => { el.textContent = has ? `目前 ${t[el.dataset.now]}` : ""; });
    const r = raw(), anyQty = p.units.some(u => (parseInt(r[u], 10) || 0) > 0);
    if (has && anyQty) {
      $("result").hidden = false;
      $("result").innerHTML = `這筆之後：<b>${Core.formatTotals(Core.preview(S.entries, p, r, sign), p.units)}</b>`;
    } else $("result").hidden = true;
    $("err").hidden = true;
  }

  function showError(err) {
    if (err.field === "who") {
      $("who").classList.add("bad"); $("whoErr").textContent = err.message; $("whoErr").hidden = false;
      $("who").scrollIntoView({ behavior: "smooth", block: "center" }); $("who").focus({ preventScroll: true });
      return;
    }
    err.units.forEach(u => $("q-" + u).classList.add("bad"));
    $("err").textContent = err.message; $("err").hidden = false;
    const f = $("q-" + err.units[0]);
    f.scrollIntoView({ behavior: "smooth", block: "center" }); f.focus({ preventScroll: true });
  }

  $("addBtn").addEventListener("click", () => {
    const res = Core.validate({ who: $("who").value, product: P[cur], raw: raw(), sign, entries: S.entries });
    if (!res.ok) { showError(res.error); return; }
    S.entries = Core.addEntry(S.entries, { id: Date.now() + Math.random(), pid: cur, sign, q: res.q, t: Date.now() });
    save(); backToPick(); renderRows();
    $("pick").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------- 已盤點清單 ---------- */
  function renderRows() {
    const ids = Core.countedIds(S.entries);
    $("cnt").textContent = ids.length ? `（${ids.length} 項）` : "";
    if (!ids.length) { $("rows").innerHTML = '<p class="empty">還沒有資料。從上面選一個商品開始。</p>'; return; }
    $("rows").innerHTML = ids.map(pid => {
      const p = P[pid];
      const es = S.entries.filter(e => e.pid === pid).map(e => {
        const tm = new Date(e.t), hm = `${tm.getHours()}:${String(tm.getMinutes()).padStart(2, "0")}`;
        return `<div class="entry"><span class="${e.sign < 0 ? "sub" : ""}">${hm}　${e.sign < 0 ? "減少" : "增加"} ${Core.formatEntry(e)}</span>
          <button data-del="${e.id}" class="${armed === e.id ? "sure" : ""}">${armed === e.id ? "確定刪除" : "刪除"}</button></div>`;
      }).join("");
      return `<div class="row" data-pid="${pid}"><div class="row-head"><span>${p.name}</span><b>${Core.formatTotals(Core.totals(S.entries, p), p.units)}</b></div>${es}</div>`;
    }).join("");
  }
  $("rows").addEventListener("click", e => {
    const b = e.target.closest("button[data-del]"); if (!b) return;
    const id = +b.dataset.del;
    if (armed === id) { S.entries = Core.removeEntry(S.entries, id); armed = null; save(); renderList(); } else armed = id;
    renderRows();
  });

  /* ---------- 摘要圖 ---------- */
  function draw() {
    const sum = Core.summarize(S.entries, P);
    const W = 1080, pad = 64, rowH = 96, F = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
    const c = document.createElement("canvas"), x = c.getContext("2d");
    const wrap = (txt, max, font) => {
      x.font = font; const out = []; let line = "";
      for (const part of txt.split("、")) { const t = line ? line + "、" + part : part; if (x.measureText(t).width > max && line) { out.push(line + "、"); line = part; } else line = t; }
      if (line) out.push(line); return out;
    };
    const zLines = sum.zero.length ? wrap(sum.zero.map(i => P[i].name).join("、"), W - pad * 2 - 48, `36px ${F}`) : [];
    const nLines = sum.none.length ? wrap(sum.none.map(i => P[i].name).join("、"), W - pad * 2 - 48, `32px ${F}`) : [];
    let H = pad + 170 + rowH * Math.max(sum.has.length, 1) + 40;
    if (zLines.length) H += 120 + zLines.length * 54;
    if (nLines.length) H += 110 + nLines.length * 48;
    c.width = W; c.height = H + pad;
    const roundRect = (a, b, w, h, r) => { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.fill(); };
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, c.height);
    x.fillStyle = "#0d6b6e"; x.fillRect(0, 0, W, 16);
    let y = pad + 40;
    x.fillStyle = "#15242a"; x.font = `bold 64px ${F}`; x.fillText("倉庫盤點結果", pad, y + 20);
    x.font = `44px ${F}`; x.textAlign = "right"; x.fillStyle = "#52646b"; x.fillText(dateStr, W - pad, y + 20); x.textAlign = "left";
    y += 80; x.font = `36px ${F}`; x.fillText(`共 ${sum.counted.length} 項商品${S.who ? "・盤點人：" + S.who : ""}`, pad, y);
    y += 40; x.fillStyle = "#15242a"; x.fillRect(pad, y, W - pad * 2, 3);
    if (!sum.has.length) { x.fillStyle = "#52646b"; x.font = `40px ${F}`; x.fillText("沒有庫存大於 0 的商品", pad, y + rowH - 30); y += rowH; }
    sum.has.forEach((pid, i) => {
      const p = P[pid], t = Core.totals(S.entries, p);
      if (i % 2) { x.fillStyle = "#eef4f3"; x.fillRect(pad, y + 3, W - pad * 2, rowH); }
      const by = y + rowH / 2 + 18;
      x.fillStyle = "#15242a"; x.font = `44px ${F}`;
      let nm = p.name; while (x.measureText(nm).width > W - pad * 2 - 430 && nm.length > 2) nm = nm.slice(0, -1);
      if (nm !== p.name) nm += "…";
      x.fillText(nm, pad + 16, by);
      x.textAlign = "right"; let rx = W - pad - 16;
      [...p.units].reverse().forEach(u => {
        x.font = `32px ${F}`; x.fillStyle = "#52646b"; x.fillText(u, rx, by); rx -= 40;
        x.font = `bold 52px ${F}`; x.fillStyle = t[u] ? "#15242a" : "#9aa9ad"; x.fillText(String(t[u]), rx, by); rx -= x.measureText(String(t[u])).width + 28;
      });
      x.textAlign = "left"; y += rowH; x.fillStyle = "#cfd9d8"; x.fillRect(pad, y, W - pad * 2, 2);
    });
    y += 40;
    const box = (lines, title, bg, ink, font, lh) => {
      const h = 90 + lines.length * lh; x.fillStyle = bg; roundRect(pad, y, W - pad * 2, h, 20);
      x.fillStyle = ink; x.font = `bold 38px ${F}`; x.fillText(title, pad + 24, y + 60);
      x.font = font; lines.forEach((l, i) => x.fillText(l, pad + 24, y + 60 + lh * (i + 1))); y += h + 30;
    };
    if (zLines.length) box(zLines, `庫存為 0（${sum.zero.length} 項）`, "#fbefc9", "#6b4c00", `36px ${F}`, 54);
    if (nLines.length) box(nLines, `這次沒有盤點（${sum.none.length} 項）`, "#eef2f1", "#52646b", `32px ${F}`, 48);
    return c;
  }

  $("done").addEventListener("click", async () => {
    if (!S.entries.length) {
      $("outCard").hidden = false;
      $("out").innerHTML = '<p class="err" id="noData">還沒有盤點資料，先加入至少一項商品。</p>';
      $("outCard").scrollIntoView({ behavior: "smooth" }); return;
    }
    const res = Core.validate({ who: $("who").value, product: { units: [] }, raw: {}, sign: 1, entries: [] });
    if (!res.ok) { showError(res.error); return; }
    try { await Promise.race([document.fonts.load('44px "Noto Sans TC"'), new Promise(r => setTimeout(r, 1500))]); } catch (e) { /* 字型載不到就用系統字 */ }
    const c = draw();
    c.toBlob(b => { lastBlob = b; }, "image/png");
    $("out").innerHTML = `<img id="summaryImg" src="${c.toDataURL("image/png")}" alt="盤點摘要圖">`;
    $("outCard").hidden = false; $("outCard").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("share").addEventListener("click", async () => {
    try {
      if (!lastBlob || !navigator.canShare) throw 0;
      const f = new File([lastBlob], `盤點_${dateStr.replace(/\//g, "")}.png`, { type: "image/png" });
      if (!navigator.canShare({ files: [f] })) throw 0;
      await navigator.share({ files: [f], title: "倉庫盤點結果" });
    } catch (e) {
      $("share").textContent = "請長按上面的圖片分享";
      setTimeout(() => { $("share").textContent = "分享"; }, 3000);
    }
  });
  $("back").addEventListener("click", () => { $("outCard").hidden = true; $("pick").scrollIntoView({ behavior: "smooth" }); });

  const resetLabel = () => { resetArmed = false; $("reset").textContent = "清空，開始新的盤點"; $("reset").classList.remove("sure"); };
  $("reset").addEventListener("click", () => {
    clearTimeout(resetTimer);
    if (!resetArmed) {
      resetArmed = true; $("reset").textContent = "再按一次確定清空"; $("reset").classList.add("sure");
      resetTimer = setTimeout(resetLabel, 4000); return;
    }
    S.entries = []; save(); resetLabel();
    $("outCard").hidden = true; backToPick(); renderRows(); window.scrollTo({ top: 0, behavior: "smooth" });
  });

  renderList(); renderRows();
})();

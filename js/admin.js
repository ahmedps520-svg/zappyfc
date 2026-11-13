/* ZAPPY FC — admin HQ */
(function () {
  const api = window.ZappyAPI;
  const $ = (s, r = document) => r.querySelector(s);
  const toast = (m, bad) => window.zappyToast && window.zappyToast(m, bad);
  const SKILL = ["", "Absolute beginner", "Just started", "Still learning", "Casual", "Average",
    "Decent", "Good", "Very good", "Elite", "Absolute best"];
  const SEEN_KEY = "zappy_admin_seen";
  const REFRESH_MS = 20000;

  let apps = [], filter = "pending", timer = null, firstLoad = true, loading = false, unsub = null, liveTimer = null;
  let seen = new Set();
  try { seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { /* ignore */ }
  const hadSeen = seen.size > 0; // been here before → flag what's new since last visit
  const saveSeen = () => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-2000))); } catch { /* ignore */ } };

  // ---------- views ----------
  function showLogin() {
    stopTimer();
    if (unsub) { unsub(); unsub = null; }
    $("#dashView").hidden = true;
    $("#loginView").hidden = false;
    $("#demoHint").hidden = !api.demo;
    setTimeout(() => $("#user").focus(), 50);
    document.title = "Admin HQ · Zappy FC";
  }
  function showDash() {
    $("#loginView").hidden = true;
    $("#dashView").hidden = false;
    $("#whoName").textContent = api.adminName();
    load(true);
    startTimer();
    if (!unsub) unsub = api.subscribe(() => { clearTimeout(liveTimer); liveTimer = setTimeout(() => load(false), 400); });
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginBtn"), err = $("#loginErr");
    const u = $("#user").value.trim(), p = $("#pass").value;
    err.textContent = "";
    if (!u || !p) { err.textContent = "Enter your email and password."; return; }
    btn.classList.add("loading");
    try {
      await api.login(u, p);
      $("#pass").value = "";
      showDash();
    } catch (ex) {
      err.textContent = ex.message || "Login failed.";
    } finally { btn.classList.remove("loading"); }
  });

  $("#logoutBtn").addEventListener("click", async () => { await api.logout(); apps = []; firstLoad = true; showLogin(); });

  // ---------- data ----------
  // ForgeBase/SQLite may return "YYYY-MM-DD HH:MM:SS" (UTC, no zone) — make it ISO.
  function iso(v) {
    if (!v) return null;
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) return s.replace(" ", "T") + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? "" : "Z");
    return s;
  }
  function normalize(a) {
    return {
      id: String(a.id ?? a._id ?? ""),
      tiktok: String(a.tiktok ?? a.tiktok_handle ?? "").replace(/^@+/, ""),
      messages_open: a.messages_open !== false && a.messages_open !== 0,
      platform: a.platform || "—",
      region: a.region || "—",
      skill: Math.max(1, Math.min(10, parseInt(a.skill, 10) || 1)),
      reason: a.reason || "",
      status: ["accepted", "rejected"].includes(a.status) ? a.status : "pending",
      note: a.note || "",
      decided_by: a.decided_by || null,
      decided_at: iso(a.decided_at),
      created_at: iso(a.created_at || a.createdAt),
      sample: !!a.sample,
    };
  }

  async function load(showSpinner) {
    if (loading) return;
    loading = true;
    const rb = $("#refreshBtn");
    rb.classList.add("spin");
    if (showSpinner && !apps.length) $("#apps").innerHTML = '<div class="loading-row"><div class="loader"></div></div>';
    try {
      const list = (await api.listApplications()).map(normalize);
      const fresh = list.filter((a) => !seen.has(a.id));
      if (fresh.length && (!firstLoad || hadSeen)) {
        toast(fresh.length === 1 ? `New application from @${fresh[0].tiktok}` : `${fresh.length} new applications`);
      }
      apps = list;
      fillFilters();
      render();
      firstLoad = false;
    } catch (ex) {
      if (ex.status === 401) { toast("Session expired, please sign in again.", true); return showLogin(); }
      if (!apps.length) {
        $("#apps").innerHTML = "";
        const box = document.createElement("div"); box.className = "errbox";
        box.textContent = "Couldn't load applications: " + (ex.message || "unknown error");
        $("#apps").appendChild(box);
      } else toast("Refresh failed: " + (ex.message || "unknown error"), true);
    } finally {
      loading = false;
      setTimeout(() => rb.classList.remove("spin"), 400);
    }
  }

  function startTimer() { stopTimer(); timer = setInterval(() => { if (!document.hidden) load(false); }, REFRESH_MS); }
  function stopTimer() { if (timer) clearInterval(timer); timer = null; }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("#dashView").hidden) load(false); });
  $("#refreshBtn").addEventListener("click", () => load(false));

  // ---------- filters ----------
  function fillFilters() {
    const fill = (sel, key, label) => {
      const el = $(sel), cur = el.value;
      const vals = [...new Set(apps.map((a) => a[key]))].sort();
      el.innerHTML = "";
      el.append(new Option(label, ""));
      vals.forEach((v) => el.append(new Option(v, v)));
      el.value = vals.includes(cur) ? cur : "";
    };
    fill("#fPlatform", "platform", "All platforms");
    fill("#fRegion", "region", "All regions");
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    filter = t.dataset.f;
    document.querySelectorAll(".tab").forEach((x) => { x.classList.toggle("on", x === t); x.setAttribute("aria-selected", String(x === t)); });
    render();
  }));
  ["#q", "#fPlatform", "#fRegion", "#sort"].forEach((s) => $(s).addEventListener("input", render));

  // ---------- helpers ----------
  function ago(iso) {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    if (s < 86400 * 7) return Math.floor(s / 86400) + "d ago";
    return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  function skillColor(n) { const hue = Math.round(-6 + ((n - 1) / 9) * 146); return `hsl(${(hue + 360) % 360} 100% 58%)`; }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function icon(id) { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("aria-hidden", "true"); const u = document.createElementNS("http://www.w3.org/2000/svg", "use"); u.setAttribute("href", "#" + id); s.appendChild(u); return s; }
  function countUp(node, to) {
    const from = parseFloat(node.dataset.v || "0");
    node.dataset.v = to;
    if (typeof to !== "number" || isNaN(to)) { node.textContent = "–"; return; }
    const dec = Number.isInteger(to) ? 0 : 1, t0 = performance.now(), dur = 500;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), v = from + (to - from) * (1 - Math.pow(1 - k, 3));
      node.textContent = v.toFixed(dec);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- render ----------
  function render() {
    const c = { pending: 0, accepted: 0, rejected: 0 };
    apps.forEach((a) => c[a.status]++);
    countUp($("#sTotal"), apps.length);
    countUp($("#sPending"), c.pending);
    countUp($("#sAccepted"), c.accepted);
    countUp($("#sRejected"), c.rejected);
    countUp($("#sAvg"), apps.length ? Math.round((apps.reduce((s, a) => s + a.skill, 0) / apps.length) * 10) / 10 : NaN);
    $("#cPending").textContent = c.pending; $("#cAccepted").textContent = c.accepted;
    $("#cRejected").textContent = c.rejected; $("#cAll").textContent = apps.length;
    document.title = (c.pending ? `(${c.pending}) ` : "") + "Admin HQ · Zappy FC";

    const q = $("#q").value.trim().toLowerCase().replace(/^@/, "");
    const fp = $("#fPlatform").value, fr = $("#fRegion").value, sort = $("#sort").value;
    let list = apps.filter((a) =>
      (filter === "all" || a.status === filter) &&
      (!fp || a.platform === fp) && (!fr || a.region === fr) &&
      (!q || a.tiktok.toLowerCase().includes(q) || a.reason.toLowerCase().includes(q)));
    const time = (a) => new Date(a.created_at || 0).getTime() || 0;
    list.sort((a, b) =>
      sort === "old" ? time(a) - time(b) :
      sort === "skill-desc" ? b.skill - a.skill || time(b) - time(a) :
      sort === "skill-asc" ? a.skill - b.skill || time(b) - time(a) :
      time(b) - time(a));

    const host = $("#apps");
    host.textContent = "";
    if (!list.length) {
      const e = el("div", "empty");
      e.appendChild(icon("i-inbox"));
      e.appendChild(el("b", null, apps.length ? "Nothing here" : "No applications yet"));
      e.appendChild(el("span", null, apps.length ? "Try another tab or clear the filters." : "Share zappyfc.online on TikTok and they'll show up here."));
      host.appendChild(e);
      return;
    }
    list.forEach((a, i) => {
      const card = renderCard(a);
      card.style.animationDelay = Math.min(i, 12) * 35 + "ms";
      host.appendChild(card);
    });
    list.forEach((a) => seen.add(a.id));
    saveSeen();
  }

  function renderCard(a) {
    const card = el("article", `app hud s-${a.status}`);
    card.dataset.id = a.id;
    const g = skillColor(a.skill);
    card.style.setProperty("--g", g);

    // top
    const top = el("div", "app-top");
    top.appendChild(el("div", "avatar", (a.tiktok[0] || "?").toUpperCase()));
    const id = el("div", "app-id");
    const link = el("a", "handle");
    link.href = "https://www.tiktok.com/@" + encodeURIComponent(a.tiktok);
    link.target = "_blank"; link.rel = "noopener";
    link.title = "Open TikTok profile";
    link.appendChild(el("span", null, "@" + a.tiktok));
    link.appendChild(icon("i-tiktok"));
    id.appendChild(link);
    const when = el("div", "when", ago(a.created_at));
    if (a.created_at) when.title = new Date(a.created_at).toLocaleString();
    if (!seen.has(a.id) && (!firstLoad || hadSeen)) when.appendChild(el("span", "new-tag", "NEW"));
    if (a.sample) when.appendChild(el("span", "sample-tag", "SAMPLE"));
    id.appendChild(when);
    top.appendChild(id);
    top.appendChild(el("span", "status " + a.status, a.status));
    card.appendChild(top);

    // chips
    const chips = el("div", "chips");
    const chip = (ic, txt, cls) => { const c = el("span", "chip" + (cls ? " " + cls : "")); c.appendChild(icon(ic)); c.appendChild(document.createTextNode(txt)); chips.appendChild(c); };
    chip("i-pad", a.platform);
    chip("i-globe", a.region);
    chip("i-chat", a.messages_open ? "DMs on" : "DMs off", a.messages_open ? "ok" : "");
    card.appendChild(chips);

    // skill
    const sr = el("div", "skillrow");
    const n = el("div", "n"); n.textContent = a.skill; n.appendChild(el("small", null, "/10"));
    const meter = el("div", "meter");
    for (let i = 1; i <= 10; i++) meter.appendChild(el("i", i <= a.skill ? "on" : ""));
    sr.append(n, meter, el("div", "lbl", SKILL[a.skill]));
    card.appendChild(sr);

    // reason
    if (a.reason) card.appendChild(el("p", "why", a.reason));

    // note
    const note = el("input", "note");
    note.type = "text"; note.maxLength = 200; note.value = a.note;
    note.placeholder = "Private admin note (e.g. position, trial date)…";
    note.setAttribute("aria-label", "Admin note for @" + a.tiktok);
    note.addEventListener("change", async () => {
      try { await api.updateApplication(a.id, { note: note.value.trim() }); a.note = note.value.trim(); toast("Note saved"); }
      catch (ex) { toast("Couldn't save note: " + ex.message, true); }
    });
    card.appendChild(note);

    if (a.status !== "pending" && (a.decided_by || a.decided_at)) {
      const d = el("div", "decided");
      d.append(document.createTextNode(a.status === "accepted" ? "Accepted" : "Rejected"));
      if (a.decided_by) { d.append(document.createTextNode(" by ")); d.append(el("b", null, a.decided_by)); }
      if (a.decided_at) d.append(document.createTextNode(" · " + ago(a.decided_at)));
      card.appendChild(d);
    }

    // actions
    const act = el("div", "app-actions");
    const mk = (cls, ic, label, fn) => { const b = el("button", cls); b.type = "button"; b.appendChild(icon(ic)); b.appendChild(document.createTextNode(label)); b.addEventListener("click", () => fn(b)); return b; };
    if (a.status === "pending") {
      act.appendChild(mk("btn btn-primary btn-sm", "i-check", "Accept", (b) => setStatus(a, "accepted", b, card)));
      act.appendChild(mk("btn btn-ghost btn-danger btn-sm", "i-x", "Reject", (b) => setStatus(a, "rejected", b, card)));
    } else {
      act.appendChild(mk("btn btn-ghost btn-sm", "i-undo", "Back to pending", (b) => setStatus(a, "pending", b, card)));
    }
    const copy = el("button", "icon-btn"); copy.type = "button"; copy.title = "Copy username"; copy.setAttribute("aria-label", "Copy @" + a.tiktok);
    copy.appendChild(icon("i-copy"));
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText("@" + a.tiktok); toast("Copied @" + a.tiktok); }
      catch { toast("Couldn't copy, the username is @" + a.tiktok, true); }
    });
    const del = el("button", "icon-btn del"); del.type = "button"; del.title = "Delete application"; del.setAttribute("aria-label", "Delete application from @" + a.tiktok);
    del.appendChild(icon("i-trash"));
    del.addEventListener("click", async () => {
      if (!confirm(`Delete @${a.tiktok}'s application for good?`)) return;
      try { await api.deleteApplication(a.id); apps = apps.filter((x) => x.id !== a.id); fillFilters(); render(); toast("Application deleted"); }
      catch (ex) { toast("Couldn't delete: " + ex.message, true); }
    });
    act.append(copy, del);
    card.appendChild(act);
    return card;
  }

  async function setStatus(a, status, btn, card) {
    btn.classList.add("loading");
    try {
      const updated = await api.updateApplication(a.id, { status });
      const fresh = updated && updated.id !== undefined ? normalize(updated) : { ...a, status, decided_by: status === "pending" ? null : api.adminName(), decided_at: status === "pending" ? null : new Date().toISOString() };
      Object.assign(a, fresh);
      card.classList.add(status === "rejected" ? "flash-bad" : "flash-ok");
      toast(status === "accepted" ? `@${a.tiktok} accepted, DM them on TikTok!` : status === "rejected" ? `@${a.tiktok} rejected` : `@${a.tiktok} moved back to pending`, status === "rejected");
      setTimeout(render, 450);
    } catch (ex) {
      btn.classList.remove("loading");
      if (ex.status === 401) return showLogin();
      toast("Couldn't update: " + ex.message, true);
    }
  }

  // ---------- CSV ----------
  $("#exportBtn").addEventListener("click", () => {
    if (!apps.length) return toast("Nothing to export yet");
    const cols = ["created_at", "tiktok", "tiktok_url", "platform", "region", "skill", "reason", "status", "decided_by", "decided_at", "note"];
    const esc = (v) => {
      let s = v == null ? "" : String(v);
      if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(","), ...apps.map((a) => cols.map((c) => esc(c === "tiktok_url" ? "https://www.tiktok.com/@" + a.tiktok : a[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url; link.download = `zappyfc-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // ---------- boot ----------
  api.ready().then(() => { if (api.isLoggedIn()) showDash(); else showLogin(); });
})();

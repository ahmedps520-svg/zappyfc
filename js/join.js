/* ZAPPY FC — join wizard */
(function () {
  const api = window.ZappyAPI;
  const $ = (s, r = document) => r.querySelector(s);
  const join = $("#join");
  const shell = $(".join-shell", join);
  const form = $("#joinForm");
  const steps = [...form.querySelectorAll(".step")];
  const flow = steps.filter((s) => s.dataset.step !== "done");
  const nextBtn = $("#nextBtn"), backBtn = $("#backBtn");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const REGIONS = [
    ["Europe", "West, Central & East"],
    ["UK & Ireland", "England, Scotland, Wales, Ireland"],
    ["North America (East)", "US East, Canada East"],
    ["North America (West)", "US West, Canada West"],
    ["South America", "Brazil, Argentina, Chile…"],
    ["Middle East", "Gulf, Levant, Turkey"],
    ["Africa", "North, West & South Africa"],
    ["Asia", "East & South-East Asia, India"],
    ["Oceania", "Australia, New Zealand"],
    ["Not sure", "We'll figure it out"],
  ];
  const SKILL = ["", "Absolute beginner", "Just started", "Still learning", "Casual", "Average",
    "Decent", "Good", "Very good", "Elite", "Absolute best"];

  const state = { tiktok: "", messages_open: false, platform: "", region: "", skill: 5, reason: "" };
  let idx = 0, lastFocus = null, submitting = false, advanceTimer = null;

  // ---------- build dynamic bits ----------
  const regionWrap = $("#regionOpts");
  regionWrap.innerHTML = REGIONS.map(([name, sub]) => `
    <label class="opt"><input type="radio" name="region" value="${name}"><span class="opt-body">
      <svg aria-hidden="true"><use href="#i-globe"/></svg>
      <span><b>${name}</b><small>${sub}</small></span><span class="check"></span></span></label>`).join("");

  const progress = $("#progress");
  progress.style.setProperty("--n", flow.length);
  progress.innerHTML = flow.map(() => "<span></span>").join("");
  $("#stepTotal").textContent = flow.length;

  const bars = $("#skillBars");
  for (let i = 1; i <= 10; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", `${i} — ${SKILL[i]}`);
    b.dataset.v = i;
    b.innerHTML = `<span>${i}</span>`;
    bars.appendChild(b);
  }

  // ---------- skill ----------
  function skillColor(n) {
    const hue = Math.round(-6 + ((n - 1) / 9) * 146); // red → amber → green
    return `hsl(${(hue + 360) % 360} 100% 58%)`;
  }
  function setSkill(n, bump) {
    n = Math.max(1, Math.min(10, n));
    state.skill = n;
    const gauge = $("#gauge");
    gauge.style.setProperty("--g", skillColor(n));
    const num = $("#skillNum");
    num.textContent = n;
    $("#skillLabel").textContent = SKILL[n];
    [...bars.children].forEach((b) => {
      const v = +b.dataset.v;
      b.classList.toggle("lit", v <= n);
      b.setAttribute("aria-checked", String(v === n));
      b.tabIndex = v === n ? 0 : -1;
    });
    if (bump && !reduce) { num.classList.remove("bump"); void num.offsetWidth; num.classList.add("bump"); }
  }
  bars.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]");
    if (b) setSkill(+b.dataset.v, true);
  });
  bars.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setSkill(state.skill + 1, true); bars.children[state.skill - 1].focus(); }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); setSkill(state.skill - 1, true); bars.children[state.skill - 1].focus(); }
  });
  setSkill(5);

  // ---------- reason counter ----------
  const reason = $("#reason");
  reason.addEventListener("input", () => {
    $("#reasonCount").textContent = `${reason.value.length} / 140`;
    $("#reasonField").classList.remove("invalid");
    $("#reasonErr").textContent = "";
  });

  // ---------- tiktok ----------
  const tiktok = $("#tiktok");
  function cleanHandle(v) {
    v = String(v || "").trim();
    const m = v.match(/tiktok\.com\/@([^/?#\s]+)/i);
    if (m) v = m[1];
    return v.replace(/^@+/, "").trim();
  }
  tiktok.addEventListener("input", () => {
    $("#tiktokField").classList.remove("invalid");
    $("#tiktokErr").textContent = "";
  });
  tiktok.addEventListener("blur", () => { tiktok.value = cleanHandle(tiktok.value); });
  $("#msgOpen").addEventListener("change", () => $("#msgToggle").classList.remove("need"));

  // auto-advance after picking an option
  form.addEventListener("change", (e) => {
    if (e.target.type !== "radio") return;
    $("#" + e.target.name + "Err").textContent = "";
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(() => next(), 320);
  });

  // ---------- validation ----------
  function fail(fieldEl, errEl, msg) {
    errEl.textContent = msg;
    if (fieldEl) { fieldEl.classList.remove("invalid"); void fieldEl.offsetWidth; fieldEl.classList.add("invalid"); }
    return false;
  }
  function validate(name) {
    if (name === "tiktok") {
      const h = cleanHandle(tiktok.value);
      tiktok.value = h;
      if (!h) return fail($("#tiktokField"), $("#tiktokErr"), "Type your TikTok username.");
      if (!/^[A-Za-z0-9_.]{2,24}$/.test(h) || h.endsWith(".")) {
        return fail($("#tiktokField"), $("#tiktokErr"), "Usernames use 2–24 letters, numbers, _ or . (can't end with a dot).");
      }
      if (!$("#msgOpen").checked) {
        const t = $("#msgToggle"); t.classList.remove("need"); void t.offsetWidth; t.classList.add("need");
        $("#tiktokErr").textContent = "Turn on your TikTok messages so we can reach you, then tick the switch.";
        return false;
      }
      state.tiktok = h; state.messages_open = true;
      return true;
    }
    if (name === "platform" || name === "region") {
      const c = form.querySelector(`input[name="${name}"]:checked`);
      if (!c) return fail(null, $("#" + name + "Err"), name === "platform" ? "Pick your platform." : "Pick your server region.");
      state[name] = c.value;
      return true;
    }
    if (name === "reason") {
      const v = reason.value.trim().replace(/\s+/g, " ");
      if (v.length < 2) return fail($("#reasonField"), $("#reasonErr"), "Write a few words.");
      state.reason = v;
      return true;
    }
    return true;
  }

  // ---------- review ----------
  function renderReview() {
    const rows = [
      ["TikTok", "@" + state.tiktok, "tiktok"],
      ["Messages", "Turned on ✓", "tiktok"],
      ["Platform", state.platform, "platform"],
      ["Region", state.region, "region"],
      ["Skill", `${state.skill}/10 · ${SKILL[state.skill]}`, "skill"],
      ["Why", state.reason, "reason"],
    ];
    const dl = $("#review");
    dl.textContent = "";
    rows.forEach(([k, v, step]) => {
      const row = document.createElement("div"); row.className = "review-row";
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      const b = document.createElement("button"); b.type = "button"; b.textContent = "Edit";
      b.setAttribute("aria-label", "Edit " + k);
      b.addEventListener("click", () => go(flow.findIndex((s) => s.dataset.step === step), true));
      row.append(dt, dd, b); dl.appendChild(row);
    });
    $("#submitErr").hidden = true;
  }

  // ---------- navigation ----------
  function go(i, back) {
    clearTimeout(advanceTimer);
    const target = i === "done" ? steps.find((s) => s.dataset.step === "done") : flow[i];
    if (i !== "done") idx = i;
    steps.forEach((s) => s.classList.remove("active", "back"));
    if (back) target.classList.add("back");
    target.classList.add("active");

    const isDone = i === "done";
    const name = target.dataset.step;
    $("#joinNav").hidden = isDone;
    $("#kbdHint").hidden = isDone || name === "platform" || name === "region";
    $(".join-step-label").style.visibility = isDone ? "hidden" : "";
    progress.style.visibility = isDone ? "hidden" : "";
    if (!isDone) {
      $("#stepNum").textContent = idx + 1;
      [...progress.children].forEach((p, n) => { p.classList.toggle("on", n <= idx); p.classList.toggle("now", n === idx); });
      backBtn.style.visibility = idx === 0 ? "hidden" : "visible";
      const last = name === "review";
      nextBtn.innerHTML = last
        ? 'Submit application<svg aria-hidden="true"><use href="#i-bolt"/></svg>'
        : 'Next<svg aria-hidden="true"><use href="#i-arrow"/></svg>';
      if (name === "review") renderReview();
    }

    // focus management
    setTimeout(() => {
      let f = null;
      if (name === "tiktok") f = tiktok;
      else if (name === "reason") f = reason;
      else if (name === "skill") f = bars.children[state.skill - 1];
      else if (name === "platform" || name === "region") f = target.querySelector("input:checked") || target.querySelector("input");
      else if (name === "review") f = nextBtn;
      else if (isDone) f = target.querySelector(".btn");
      if (f) f.focus({ preventScroll: true });
    }, 60);
    join.scrollTop = 0;
  }

  function next() {
    if (submitting) return;
    const name = flow[idx].dataset.step;
    if (!validate(name)) return;
    if (name === "review") return submit();
    go(idx + 1);
  }
  function back() { if (idx > 0 && !submitting) go(idx - 1, true); }
  nextBtn.addEventListener("click", next);
  backBtn.addEventListener("click", back);

  form.addEventListener("submit", (e) => { e.preventDefault(); next(); });
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    const t = e.target;
    if (t.closest("button, a, summary")) return;
    e.preventDefault();
    next();
  });

  // ---------- submit ----------
  async function submit() {
    submitting = true;
    nextBtn.classList.add("loading");
    backBtn.disabled = true;
    const errBox = $("#submitErr");
    errBox.hidden = true;
    try {
      if (form.website.value) { await new Promise((r) => setTimeout(r, 600)); } // bot honeypot
      else {
        await api.submitApplication({
          tiktok: state.tiktok,
          messages_open: true,
          platform: state.platform,
          region: state.region,
          skill: state.skill,
          reason: state.reason,
        });
      }
      $("#doneMsg").textContent = `The Zappy FC admins will check it soon. Keep your TikTok DMs open, we'll message @${state.tiktok} there.`;
      go("done");
      burst();
    } catch (err) {
      errBox.textContent = err && err.message ? err.message : "Something went wrong. Please try again.";
      errBox.hidden = false;
    } finally {
      submitting = false;
      nextBtn.classList.remove("loading");
      backBtn.disabled = false;
    }
  }

  function burst() {
    if (reduce || !Element.prototype.animate) return;
    const ring = $(".done-ring");
    const r = ring.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 34; i++) {
      const p = document.createElement("div");
      p.className = "burst";
      p.style.left = cx + "px"; p.style.top = cy + "px";
      if (i % 3 === 0) p.style.background = "#b6ff3c";
      document.body.appendChild(p);
      const ang = (Math.PI * 2 * i) / 34 + Math.random() * 0.3;
      const dist = 90 + Math.random() * 170;
      p.animate([
        { transform: "translate(-50%,-50%) rotate(45deg) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) rotate(225deg) scale(0.2)`, opacity: 0 },
      ], { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.1,.8,.3,1)", delay: 500 }).onfinish = () => p.remove();
    }
  }

  // ---------- open / close ----------
  function reset() {
    form.reset();
    Object.assign(state, { tiktok: "", messages_open: false, platform: "", region: "", skill: 5, reason: "" });
    setSkill(5);
    $("#reasonCount").textContent = "0 / 140";
    form.querySelectorAll(".err").forEach((e) => (e.textContent = ""));
  }
  let finished = false;
  function open() {
    if (!join.hidden) return;
    lastFocus = document.activeElement;
    if (finished) { reset(); finished = false; }
    join.hidden = false;
    join.classList.remove("closing");
    join.classList.add("opening");
    document.body.classList.add("locked");
    go(idx);
    if (location.hash !== "#join") history.replaceState(null, "", "#join");
  }
  function close() {
    if (join.hidden) return;
    if ($(".step.done.active")) { finished = true; idx = 0; }
    join.classList.remove("opening");
    join.classList.add("closing");
    setTimeout(() => {
      join.hidden = true;
      join.classList.remove("closing");
      document.body.classList.remove("locked");
    }, reduce ? 0 : 230);
    history.replaceState(null, "", location.pathname + location.search);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  document.querySelectorAll("[data-open-join]").forEach((b) => b.addEventListener("click", open));
  join.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-join]")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (join.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab") { // keep focus inside the dialog
      const f = [...shell.querySelectorAll("button, a[href], input:not(.hp), textarea, summary, [tabindex='0']")]
        .filter((el) => !el.disabled && el.offsetParent !== null && el.tabIndex >= 0);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener("hashchange", () => { if (location.hash === "#join") open(); });
  if (location.hash === "#join") open();
})();

/*
 * ZAPPY FC — data layer.
 * Talks to the ForgeBase project (Supabase-compatible) with supabase-js.
 * Every backend call lives here; with no ForgeBase config it runs in demo mode.
 *
 * Table: applications (see forgebase/schema.sql)
 *   public (anon key)   → INSERT only
 *   signed-in admins    → SELECT / UPDATE / DELETE
 */
(function () {
  const cfg = window.ZAPPY_CONFIG || {};
  const URL_ = String(cfg.FORGEBASE_URL || "").trim().replace(/\/+$/, "");
  const KEY = String(cfg.FORGEBASE_ANON_KEY || "").trim();
  const DEMO = !URL_ || !KEY || !(window.supabase && window.supabase.createClient);
  const TABLE = "applications";
  const NAME_KEY = "zappy_admin_name";
  const DEMO_TOKEN_KEY = "zappy_admin_token";
  const DEMO_KEY = "zappy_demo_applications";
  const DEMO_PASSWORD = "zappy-demo";

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
  };

  class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }

  const db = DEMO ? null : window.supabase.createClient(URL_, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "zappyfc-admin-auth" },
  });
  let session = null;

  // Turn a supabase-js / network error into a friendly ApiError.
  function toError(err, fallback) {
    if (!err) return new ApiError(fallback || "Something went wrong.", 500);
    const msg = String(err.message || err.error_description || err.msg || "");
    const code = String(err.code || "");
    const status = Number(err.status || err.statusCode || 0);
    if (code === "23505" || /unique|duplicate/i.test(msg)) {
      return new ApiError("This TikTok already has an application waiting for review.", 409);
    }
    if (code === "23514" || /check constraint|constraint failed/i.test(msg)) {
      return new ApiError("Some answers weren't accepted. Go back, check them and try again.", 400);
    }
    if (status === 401 || code === "PGRST301" || /jwt|not authenticated|invalid token/i.test(msg)) {
      return new ApiError("Your session expired. Please sign in again.", 401);
    }
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return new ApiError("Can't reach the Zappy FC server. Check your connection and try again.", 0);
    }
    return new ApiError(msg || fallback || "Something went wrong.", status || 500);
  }

  // Run a ForgeBase call; on a dropped connection wait a moment and try once more.
  async function attempt(fn, fallback) {
    let res;
    try { res = await fn(); } catch (e) { res = { error: e }; }
    if (res && res.error) {
      const err = toError(res.error, fallback);
      if (err.status !== 0) throw err;
      await wait(900);
      try { res = await fn(); } catch (e) { throw toError(e, fallback); }
      if (res && res.error) { const e2 = toError(res.error, fallback); e2.retried = true; throw e2; }
    }
    return res;
  }

  // ---------- demo mode (browser-only storage) ----------
  function demoLoad() {
    const raw = store.get(DEMO_KEY);
    if (raw) { try { return JSON.parse(raw); } catch { /* fall through */ } }
    const now = Date.now();
    const seed = [
      { tiktok: "sample.striker", platform: "PlayStation 5", region: "Europe", skill: 8, reason: "Clinical finisher, love a 1-2", ago: 26 },
      { tiktok: "sample_cdm", platform: "Xbox Series X|S", region: "North America (East)", skill: 6, reason: "I hold position and talk", ago: 190 },
      { tiktok: "sample.keeper", platform: "PC", region: "Europe", skill: 4, reason: "Want a chill team to grind with", ago: 1500 },
    ].map((a, i) => ({
      id: "demo-" + (i + 1), tiktok: a.tiktok, messages_open: true, platform: a.platform,
      region: a.region, skill: a.skill, reason: a.reason, status: "pending", note: "",
      decided_by: null, decided_at: null, created_at: new Date(now - a.ago * 60000).toISOString(),
      sample: true,
    }));
    demoSave(seed);
    return seed;
  }
  function demoSave(list) { store.set(DEMO_KEY, JSON.stringify(list)); }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- public API ----------
  const api = {
    demo: DEMO,
    demoPassword: DEMO_PASSWORD,
    ApiError,

    /** Resolve the saved admin session (call once before isLoggedIn). */
    async ready() {
      if (DEMO) return;
      try {
        const { data } = await db.auth.getSession();
        session = data && data.session;
      } catch { session = null; }
      db.auth.onAuthStateChange((_evt, s) => { session = s; });
    },

    async submitApplication(app) {
      const row = {
        tiktok: app.tiktok,
        messages_open: true,
        platform: app.platform,
        region: app.region,
        skill: app.skill,
        reason: app.reason,
      };
      if (DEMO) {
        await wait(700);
        const list = demoLoad();
        const handle = row.tiktok.toLowerCase();
        if (list.some((a) => a.tiktok.toLowerCase() === handle && a.status === "pending")) {
          throw new ApiError("This TikTok already has an application waiting for review.", 409);
        }
        list.unshift({ id: "demo-" + Date.now().toString(36), ...row, status: "pending", note: "",
          decided_by: null, decided_at: null, created_at: new Date().toISOString() });
        demoSave(list);
        return { ok: true };
      }
      try {
        await attempt(() => db.from(TABLE).insert(row), "Couldn't send your application.");
      } catch (err) {
        // The first try may have landed before the connection dropped: then the retry sees our own row.
        if (err.status === 409 && err.retried) return { ok: true };
        throw err;
      }
      return { ok: true };
    },

    isLoggedIn() { return DEMO ? !!store.get(DEMO_TOKEN_KEY) : !!session; },
    adminName() {
      if (!DEMO && session && session.user) {
        const u = session.user, m = u.user_metadata || {};
        return m.name || m.full_name || m.username || (u.email ? u.email.split("@")[0] : "Admin");
      }
      return store.get(NAME_KEY) || "Admin";
    },

    async login(email, password) {
      if (DEMO) {
        await wait(500);
        if (password !== DEMO_PASSWORD) throw new ApiError("Wrong email or password.", 401);
        store.set(DEMO_TOKEN_KEY, "demo");
        store.set(NAME_KEY, (email || "Admin").split("@")[0]);
        return { name: api.adminName() };
      }
      let res;
      try { res = await attempt(() => db.auth.signInWithPassword({ email, password }), "Sign-in failed."); }
      catch (err) {
        if (err.status !== 0 && /invalid|credentials|password|grant/i.test(err.message)) throw new ApiError("Wrong email or password.", 401);
        throw err;
      }
      session = res.data.session;
      return { name: api.adminName() };
    },

    async logout() {
      store.del(DEMO_TOKEN_KEY); store.del(NAME_KEY);
      if (!DEMO) { try { await db.auth.signOut(); } catch { /* ignore */ } session = null; }
    },

    async listApplications() {
      if (DEMO) { await wait(250); return demoLoad(); }
      const res = await attempt(() => db.from(TABLE).select("*").order("created_at", { ascending: false }), "Couldn't load applications.");
      return res.data || [];
    },

    async updateApplication(id, patch) {
      const p = { ...patch };
      if ("status" in p) {
        const decided = p.status !== "pending";
        p.decided_by = decided ? api.adminName() : null;
        p.decided_at = decided ? new Date().toISOString() : null;
      }
      if (DEMO) {
        await wait(200);
        const list = demoLoad();
        const rec = list.find((a) => a.id === id);
        if (!rec) throw new ApiError("Application not found.", 404);
        Object.assign(rec, p);
        demoSave(list);
        return rec;
      }
      const res = await attempt(() => db.from(TABLE).update(p).eq("id", id).select(), "Couldn't update.");
      if (Array.isArray(res.data) && res.data.length === 0) throw new ApiError("Application not found or no permission.", 404);
      return Array.isArray(res.data) ? res.data[0] : res.data;
    },

    async deleteApplication(id) {
      if (DEMO) {
        await wait(150);
        demoSave(demoLoad().filter((a) => a.id !== id));
        return { ok: true };
      }
      await attempt(() => db.from(TABLE).delete().eq("id", id), "Couldn't delete.");
      return { ok: true };
    },

    /** Live updates for the admin dashboard. Returns an unsubscribe function. */
    subscribe(onChange) {
      if (DEMO) {
        const h = (e) => { if (e.key === DEMO_KEY) onChange(); };
        window.addEventListener("storage", h);
        return () => window.removeEventListener("storage", h);
      }
      try {
        const ch = db.channel("zappy-applications")
          .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => onChange())
          .subscribe();
        return () => { try { db.removeChannel(ch); } catch { /* ignore */ } };
      } catch { return () => {}; }
    },
  };

  window.ZappyAPI = api;
})();

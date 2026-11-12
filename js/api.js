/*
 * ZAPPY FC — API adapter.
 * Every call to the backend goes through here, so if the Forgebase API ever
 * looks different, this is the only file that needs to change.
 *
 * Contract (see FORGEBASE_PROMPT.md):
 *   POST   /api/applications                 public   -> { id }
 *   POST   /api/admin/login                  public   -> { token, name }
 *   GET    /api/admin/applications           bearer   -> [ application ]
 *   PATCH  /api/admin/applications/:id       bearer   -> application
 *   DELETE /api/admin/applications/:id       bearer   -> { ok: true }
 */
(function () {
  const cfg = window.ZAPPY_CONFIG || {};
  const BASE = String(cfg.API_BASE_URL || "").trim().replace(/\/+$/, "");
  const DEMO = !BASE;
  const TOKEN_KEY = "zappy_admin_token";
  const NAME_KEY = "zappy_admin_name";
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

  async function request(path, { method = "GET", body, auth = false } = {}) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
      const token = store.get(TOKEN_KEY);
      if (token) headers.Authorization = "Bearer " + token;
    }
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError("Can't reach the Zappy FC server. Check your connection and try again.", 0);
    }
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = { message: text }; } }
    if (!res.ok) {
      if (res.status === 401 && auth) { store.del(TOKEN_KEY); store.del(NAME_KEY); }
      const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
      throw new ApiError(typeof msg === "string" ? msg : "Request failed", res.status);
    }
    return data;
  }

  // Accept a bare array or common wrappers like {applications:[…]} / {data:[…]}.
  function unwrapList(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.applications)) return data.applications;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }
  function unwrapOne(data) {
    if (data && data.application) return data.application;
    if (data && data.data && !Array.isArray(data.data)) return data.data;
    return data;
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

    async submitApplication(app) {
      if (DEMO) {
        await wait(700);
        const list = demoLoad();
        const handle = app.tiktok.toLowerCase();
        if (list.some((a) => a.tiktok.toLowerCase() === handle && a.status === "pending")) {
          throw new ApiError("This TikTok already has an application waiting for review.", 409);
        }
        const rec = {
          id: "demo-" + Date.now().toString(36), ...app, status: "pending", note: "",
          decided_by: null, decided_at: null, created_at: new Date().toISOString(),
        };
        list.unshift(rec);
        demoSave(list);
        return { id: rec.id };
      }
      return request("/api/applications", { method: "POST", body: app });
    },

    isLoggedIn() { return !!store.get(TOKEN_KEY); },
    adminName() { return store.get(NAME_KEY) || "Admin"; },

    async login(username, password) {
      if (DEMO) {
        await wait(500);
        if (password !== DEMO_PASSWORD) throw new ApiError("Wrong username or password.", 401);
        store.set(TOKEN_KEY, "demo");
        store.set(NAME_KEY, username || "Admin");
        return { name: username || "Admin" };
      }
      const data = await request("/api/admin/login", { method: "POST", body: { username, password } });
      const token = data && (data.token || data.access_token);
      if (!token) throw new ApiError("Login worked but the server sent no token.", 500);
      store.set(TOKEN_KEY, token);
      store.set(NAME_KEY, (data.name || data.username || username || "Admin"));
      return { name: store.get(NAME_KEY) };
    },

    logout() { store.del(TOKEN_KEY); store.del(NAME_KEY); },

    async listApplications() {
      if (DEMO) { await wait(250); return demoLoad(); }
      return unwrapList(await request("/api/admin/applications", { auth: true }));
    },

    async updateApplication(id, patch) {
      if (DEMO) {
        await wait(200);
        const list = demoLoad();
        const rec = list.find((a) => a.id === id);
        if (!rec) throw new ApiError("Application not found.", 404);
        Object.assign(rec, patch);
        if ("status" in patch) {
          rec.decided_by = patch.status === "pending" ? null : api.adminName();
          rec.decided_at = patch.status === "pending" ? null : new Date().toISOString();
        }
        demoSave(list);
        return rec;
      }
      return unwrapOne(await request("/api/admin/applications/" + encodeURIComponent(id), {
        method: "PATCH", body: patch, auth: true,
      }));
    },

    async deleteApplication(id) {
      if (DEMO) {
        await wait(150);
        demoSave(demoLoad().filter((a) => a.id !== id));
        return { ok: true };
      }
      return request("/api/admin/applications/" + encodeURIComponent(id), { method: "DELETE", auth: true });
    },
  };

  window.ZappyAPI = api;
})();

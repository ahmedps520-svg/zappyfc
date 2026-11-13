-- Zappy FC applications (ForgeBase project "Zappy FC", SQLite dialect)
CREATE TABLE IF NOT EXISTS applications (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tiktok        TEXT NOT NULL CHECK (
                  length(tiktok) BETWEEN 2 AND 24
                  AND tiktok NOT GLOB '*[^A-Za-z0-9_.]*'
                  AND substr(tiktok, -1) <> '.'),
  messages_open INTEGER NOT NULL DEFAULT 1 CHECK (messages_open IN (1, 'true', 1.0)),
  platform      TEXT NOT NULL CHECK (platform IN ('PlayStation 5','Xbox Series X|S','PC','Other')),
  region        TEXT NOT NULL CHECK (region IN ('Europe','UK & Ireland','North America (East)','North America (West)',
                  'South America','Middle East','Africa','Asia','Oceania','Not sure')),
  skill         INTEGER NOT NULL CHECK (skill BETWEEN 1 AND 10),
  reason        TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 2 AND 140),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  note          TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  decided_by    TEXT CHECK (decided_by IS NULL OR length(decided_by) <= 60),
  decided_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- one waiting application per TikTok (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS applications_one_pending
  ON applications (lower(tiktok)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS applications_created ON applications (created_at);

-- emails allowed into Admin HQ (not exposed through the API: RLS on, no policies)
CREATE TABLE IF NOT EXISTS admins (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  name  TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Applied with the ForgeBase tools (recorded here for reference):
--   RLS ON for applications and admins (admins has no policies → unreachable via API)
--   applications policies:
--     insert  [anon, authenticated]  check: status = 'pending' AND note = '' AND decided_by IS NULL AND decided_at IS NULL
--     select  [authenticated]        using: EXISTS (SELECT 1 FROM admins WHERE admins.email = auth.email())
--     update  [authenticated]        using + check: same admin expression
--     delete  [authenticated]        using: same admin expression
--   realtime ON for applications
--   project settings: production mode, CORS = https://zappyfc.online, https://www.zappyfc.online, http://localhost:8765
--                     auth sign-ups OFF, magic links OFF, min password length 10
--
-- Add an admin (the person also needs a ForgeBase Auth user with the same email):
--   INSERT INTO admins (email, name) VALUES ('someone@example.com', 'Their name');

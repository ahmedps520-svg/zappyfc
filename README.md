# Zappy FC · zappyfc.online

Recruitment site for the Zappy FC **FC 27 Clubs** team, plus an admin dashboard.
It is plain HTML/CSS/JS with no build step. Every page works on phones.

| URL | What it is |
|---|---|
| `zappyfc.online` | Landing page. "I want to join" opens the application wizard |
| `zappyfc.online/join` | Opens the wizard straight away (good link for the TikTok bio) |
| `zappyfc.online/admin` | Admin HQ: review, accept or reject applicants |

**Application steps:** TikTok username + confirm DMs are on → platform → server region → skill 1–10 → why join (a few words) → review → submit.

**Admin HQ:** live stats, Pending / Accepted / Rejected tabs, search, platform, region and skill filters, accept / reject / undo, private notes, "accepted by X" history, TikTok profile links, CSV export. It refreshes every 20 seconds and pops a toast when new applications come in.

## Database: ForgeBase project "Zappy FC"

The site is connected to the ForgeBase project **Zappy FC** (`cqjaqhvwolwpzvmsdbuv`) at
`https://api.forgebase.art/p/cqjaqhvwolwpzvmsdbuv`. The URL and public `anon` key are in [`js/config.js`](js/config.js).
Never put the `service_role` key in the site.

- Table `applications` ([`forgebase/schema.sql`](forgebase/schema.sql)). The database itself checks the TikTok format, platform, region, skill 1–10, reason length, and allows only one pending application per TikTok.
- Visitors can only **submit**. Only emails listed in the `admins` table can read, accept, reject, add notes or delete.
- Realtime is on, so new applications appear in Admin HQ within seconds.
- Public sign-ups are off. Admin accounts are created in the ForgeBase dashboard.

**Adding an admin**
1. Create a user with email and password in ForgeBase → Zappy FC → **Auth → Users**.
2. Add their email to the `admins` table with **Database** or the SQL editor:
   ```sql
   INSERT INTO admins (email, name) VALUES ('them@example.com', 'Name');
   ```
   The name is what shows as "Accepted by …".

**Demo mode:** if `FORGEBASE_URL` or `FORGEBASE_ANON_KEY` in `js/config.js` is empty, the site runs offline in demo mode (password `zappy-demo`).

## Hosting on GitHub Pages (free, no wake-up delay, custom domain)

1. Repo → **Settings → Pages** → *Build and deployment* → Source **Deploy from a branch**. Pick the branch with this code and the **/ (root)** folder, then save.
2. On the same page, set **Custom domain** to `zappyfc.online`. The `CNAME` file already sets it. After the check passes, tick **Enforce HTTPS**.
3. At your domain registrar's DNS settings for `zappyfc.online`, add:

   | Type | Name | Value |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | AAAA | @ | 2606:50c0:8000::153 |
   | AAAA | @ | 2606:50c0:8001::153 |
   | AAAA | @ | 2606:50c0:8002::153 |
   | AAAA | @ | 2606:50c0:8003::153 |
   | CNAME | www | ahmedps520-svg.github.io |

   Delete any old "parking" A/CNAME records for `@` or `www` first. DNS can take from a few minutes up to a few hours.

## Run locally

```bash
python3 -m http.server 8765
```
Then open http://localhost:8765.

## Files

- `index.html`: landing page and join wizard
- `admin/index.html`: Admin HQ
- `css/style.css`, `css/admin.css`: theme
- `js/config.js`: **ForgeBase URL + anon key go here**
- `js/api.js`: every ForgeBase call (supabase-js), plus demo mode
- `js/join.js`, `js/admin.js`, `js/site.js`, `js/bg.js`: wizard, dashboard, page effects, animated background

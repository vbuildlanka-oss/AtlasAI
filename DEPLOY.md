# Put Atlas Online — Free, Step by Step

This guide assumes you know nothing about deployment. You'll use **two free
websites**: one for the database, one for the app. Total cost: **$0**. No credit
card needed for the free tiers, and no AI key required (it runs in free
"offline mock" mode until you add one).

You'll do this in ~15 minutes. Have your project on **GitHub** first (it already is).

---

## Part 1 — The database (Neon)

This is the "filing cabinet" that stores your documents and answers.

1. Go to **https://neon.tech** and click **Sign up** (use your GitHub or Google login).
2. Click **Create project**. Give it any name (e.g. `atlas`). Leave the defaults and create it.
3. On the project dashboard, find the **Connection string** box. Click **Copy**.
   - It looks like: `postgresql://user:password@ep-something.aws.neon.tech/dbname?sslmode=require`
4. **Paste it somewhere safe** (a notes app) — you'll need it in Part 2.

> That's the whole database setup. Neon already supports the "vector" feature
> Atlas needs — nothing else to configure. Atlas creates its own tables
> automatically the first time it starts.

---

## Part 2 — The app (Render)

This runs the brain **and** the website together, as one free service.

1. Go to **https://render.com** and click **Get Started** / **Sign up** (log in with GitHub).
2. Click **New +** (top right) → **Blueprint**.
3. Connect your GitHub and pick the **AtlasAI** repository.
   - Render finds the included `render.yaml` file and sets everything up for you.
4. Render will ask you to fill in one value: **`DATABASE_URL`**.
   - Paste the Neon connection string you copied in Part 1.
   - (Leave `OPENAI_API_KEY` blank for now — free mode.)
5. Click **Apply** / **Create**. Render starts building. This takes ~3–5 minutes
   the first time (it's compiling the app).
6. When it finishes, Render shows a public link like
   **`https://atlas-intelligence.onrender.com`**. Click it — that's your live app! 🎉

---

## That's it

Open your link, add a source (paste text / a URL / a PDF) on the left, ask a
question at the bottom, and you'll get a cited answer. Share the link with anyone.

### Two things to know
- **First load is slow.** Free apps "go to sleep" when idle. The first visit after
  a quiet spell takes ~30–60 seconds to wake up, then it's fast. This is normal.
- **Want real GPT-4-class answers?** In Render, open your service → **Environment**
  → add `OPENAI_API_KEY` with your OpenAI key → save. It redeploys and switches
  from mock mode to real AI automatically. (This part costs money on OpenAI's side.)

---

## If something goes wrong

- **Build failed?** Open the Render **Logs** tab and read the last lines. The most
  common cause is a typo in `DATABASE_URL` — re-copy it from Neon.
- **App loads but says "db unavailable"?** Double-check `DATABASE_URL` in Render →
  Environment. It must be the full Neon string including `?sslmode=require`.
- **Still stuck?** Copy the error from the Logs tab and share it — it's usually a
  one-line fix.

## Prefer to click manually instead of using the Blueprint?

You can skip `render.yaml` and set it up by hand:
1. Render → **New +** → **Web Service** → pick the repo.
2. **Build Command:** `npm run build`
3. **Start Command:** `npm run start`
4. **Environment variables:** `NODE_ENV=production`, `SERVE_FRONTEND=true`,
   `AUTO_MIGRATE=true`, `DATABASE_URL=<your Neon string>`, and optionally `OPENAI_API_KEY`.
5. Choose the **Free** plan and create.

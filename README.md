# Parsh CA Tracker

Preparation command centre for CA Intermediate (September 2027, both groups): daily study log, syllabus, lectures, revision, tests, planner, backlog, weekly and monthly reviews, and a live comparison with a friend.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # calculation tests
npm run build      # production build in dist/
```

### On your phone, from your computer

Phone and computer on the same Wi-Fi:

```bash
npm run phone
```

It prints a `Network:` address such as `http://192.168.1.20:5173`. Open that in the phone's browser. Data is kept in that phone browser only. Over plain `http` the browser will not allow notifications or a proper Home Screen install; those need the deployed `https` site.

With no configuration the app runs in **local mode**: data is saved in the browser on that device only (several local profiles can exist, which is enough to try the friend comparison). For phone access, sync and a real friend account, connect Supabase.

## Go live (about 15 minutes, free tiers)

1. **Supabase** – create a project at supabase.com. In *SQL Editor*, paste and run `supabase/schema.sql`.
2. In *Authentication → Sign In / Providers → Email*, either turn off "Confirm email" or leave it on and confirm via the e-mail link when signing up.
3. In *Project Settings → API*, copy the **Project URL** and the **anon public** key.
4. **Vercel** – import this GitHub repository at vercel.com (framework: Vite) and deploy. The public Supabase URL, anon key and push key are read from `.env.production`, so no environment variables are needed; variables set in Vercel override that file.
5. Open the site, create your account, and have your friend create theirs. In *Compare with Friend*, one of you enters the other's friend code.

For local development against Supabase, copy `.env.example` to `.env.local` and fill the two `VITE_SUPABASE_*` values.

### Phone reminders

Reminders are sent by Supabase, not by the website host:

- `supabase/functions/remind` is an Edge Function that sends Web Push to every registered device whose reminder time has come.
- `supabase/reminders.sql` schedules it every 5 minutes with pg_cron.
- The push private key and the scheduler secret are stored in Supabase (Edge Function secrets and Vault). The public push key is in `.env.production`.

On each phone: open the site, add it to the Home Screen, open it from the Home Screen icon, then *Menu → Settings → Daily alerts → Enable alerts on this device*. On iPhone this works only from the Home Screen icon (iOS 16.4 or later), not from a Safari tab.

## Syllabus source

Chapter titles follow ICAI's Board of Studies study material pages for the Intermediate course (New Scheme), as listed on icai.org in November 2026. Income-tax uses the edition marked applicable for May 2027, September 2027 and January 2028; its Chapter 3 (Heads of Income) is tracked as five rows, one per head. Not confirmed from ICAI's pages: Advanced Accounting chapters 13 to 15, the units inside Financial Management chapter 9, and whether GST still has a separate "Returns" chapter (the newest listing seen showed 14 chapters). Check those three against the study material and edit them in the Syllabus Tracker.

## How the numbers are calculated

- **Chapter progress** = 50% lectures + 25% practice + 25% revision. Practice is half question target, half RTP/MTP/PYQ. A chapter is **Completed** only when all lectures are done, practice is done, and the required number of revisions (Settings, default 1) is done. Lectures alone never complete a chapter.
- **Paper** = average of its chapters (Taxation pools DT + GST, FM-SM pools FM + SM). **Group** = average of its three papers. **Overall** = average of six papers.
- **Lectures done** = lectures recorded in logged sessions + lectures marked with the + button.
- **Questions practised** = attempts in sessions + attempts in tests + any manual figure on the chapter. Correct answers are tracked separately and accuracy uses only attempts where a result was recorded.
- **Active day** = a day with more than zero logged minutes. Overlapping sessions are rejected so hours are never double-counted.
- **Lecture backlog** = lectures expected by today on a straight line from the preparation start to the subject's "finish lectures by" date, minus lectures done.

## Structure

```
src/lib/analytics.ts   every calculation (pure functions, unit-tested)
src/lib/store.tsx      state, autosave queue, offline retry
src/lib/backend.ts     storage: Supabase (cloud) or localStorage (local mode)
src/lib/seed.ts        subjects, faculty and ICAI chapter lists
src/pages/             one file per screen
supabase/functions/    push-reminder sender (Supabase Edge Function)
supabase/schema.sql    tables, row-level security, friend linking
```

Data model: each record is one row `(user_id, collection, id) → JSON`. Row-level security lets an owner read and write their rows and lets a linked friend read them; nobody else sees anything.

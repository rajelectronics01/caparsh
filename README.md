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

## Daily lecture plan

Every day: one lecture from each Group 1 subject. A "lecture" is all its recordings: Advanced Accounting lecture 01 is Part 1 + Part 2 (a few have three), a Direct Tax Day can be two parts, a Law lecture is one. The home screen's Today's lectures card shows the next lecture per subject with the combined time, a Log it button that pre-selects every part, a Done today tick, and how many days behind you are (counted from the preparation start; GST counts from the day after Direct Tax is finished). Catch-up lectures appear in the Backlog Manager. The grouping is in `unitOf` in `src/lib/lectureLists.ts`; the plan is `dailyLectures` in `src/lib/analytics.ts`.

## Friend alerts

When someone logs a new study session, their linked friends get a push notification: "Rohan did DT for 2h 30m. Tum bhi padho, warna tum gaye!". It is sent by `supabase/functions/notify-friends`, triggered by the database (`supabase/friend-alerts.sql`). At most one alert per friend every 15 minutes, only for sessions dated yesterday to tomorrow (so restoring a backup stays silent), and each person can switch it off in Settings. Friends need alerts enabled on their phone (see Phone reminders). It does not work in local mode.

## Lecture lists

Each chapter can hold the faculty's recorded lectures with their real lengths. Ticking a lecture updates progress and the exact time left. The Lecture Tracker has buttons that load the Advanced Accounting (Akash Kandoi), Direct Tax (BB Sir) and Corporate and Other Laws (Shubham Singhal) lists; running them again keeps what you have ticked. The source text is in `src/lib/data/`, and the mapping of lectures to chapters is in `src/lib/lectureLists.ts`. Logging a lecture session in a chapter with a list ticks the next lectures in order. A subject can be set to start after another (GST after Direct Tax): until the earlier one's lectures are all watched it has no pace target and no suggestions.

## Parked features

Revision Manager, Question Practice and Tests & Performance are out of the app for now. The full version is saved on the branch `backup/full-features-2026-11-17`. See [docs/PARKED_FEATURES.md](docs/PARKED_FEATURES.md) for what was parked, how progress is counted meanwhile, and how to restore it.

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

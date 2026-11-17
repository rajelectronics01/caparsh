# Parked features

On 17 Nov 2026 these were taken out of the app so the focus stays on **lectures and daily study hours**. Nothing was deleted: the complete app, exactly as it was before, is saved on GitHub.

## Where the full version is

- Branch: **`backup/full-features-2026-11-17`**
- Commit: `d880d36`
- Browse it: `https://github.com/rajelectronics01/caparsh/tree/backup/full-features-2026-11-17`

## What was parked

| Feature | What it did | Where the code is (on the backup branch) |
|---|---|---|
| **Revision Manager** | Three revision cycles per chapter with date, duration, confidence 1 to 5, weak areas, and a "due for revision" list | `src/pages/Revision.tsx` |
| **Question Practice** | Questions attempted versus answered correctly, per subject and chapter, with a target per chapter | `src/pages/Practice.tsx` |
| **Tests & Performance** | PYQ, RTP, MTP, mock and chapter tests with marks, accuracy, score trend, weak and strong chapters | `src/pages/Tests.tsx` |
| Chapter columns | Questions practised, RTP/MTP/PYQ tick, Revision 1 to 3 ticks in the Syllabus Tracker | `src/pages/Syllabus.tsx` |
| Practice and revision backlog | Backlog items for chapters with lectures done but no practice or revision | `src/lib/analytics.ts` (`backlog`) |
| Practice and revision log types | Activities "Question practice", "Revision", "RTP/MTP/PYQ" and "Mock test" in the study log | `src/lib/types.ts`, `src/components/QuickLog.tsx`, `src/components/SessionForm.tsx` |
| Home, weekly and monthly tiles | Question practice and revision hours, revision progress, tests taken, question accuracy, test trend | `src/pages/Overview.tsx`, `Weekly.tsx`, `Monthly.tsx` |

## What changed in how progress is counted

While these are parked the setting `focus` is `lectures` (the default):

- A chapter's progress is its **lectures watched ÷ total lectures**.
- A chapter counts as **done** when all its lectures are watched. Its status reads "Lectures Completed", never "Completed".
- Group and overall percentages are built from that.

In the full version a chapter was Completed only when lectures, practice **and** revision were all done, and progress was 50% lectures, 25% practice, 25% revision. That logic is still in `src/lib/analytics.ts`; it switches on when `focus` is `full`.

## Your data is safe

Tests, revision records, practice counts and earlier study sessions are **still stored** in the database and still included in exports and backups. They are just not shown. Old study-log entries of any type remain visible in the Daily Study Log.

## How to bring them back

1. Restore the files from the backup branch:
   ```bash
   git checkout backup/full-features-2026-11-17 -- src/pages/Practice.tsx src/pages/Revision.tsx src/pages/Tests.tsx
   ```
2. Re-add the three routes in `src/App.tsx` and the three entries in `NAV` in `src/components/Layout.tsx`.
3. Set `focus: 'full'` in the settings (default in `src/lib/seed.ts`) to restore the full completion rules.
4. For the Syllabus Tracker columns, home and review tiles, and the extra log types, copy the matching parts from the files listed above.

Or ask Claude to "restore the parked features from `backup/full-features-2026-11-17`".

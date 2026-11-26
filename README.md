# Hardwood Daily / Gridiron Daily

A daily NBA and NFL trivia game: guess where pro players went to college (or which country they came from). It's a plain static site with no build step and no backend. Progress and streaks are saved in each player's browser (`localStorage`).

| File | What it is |
| --- | --- |
| `index.html` | Page shell and all CSS |
| `app.js` | UI, saving, league switching |
| `game.js` | Pure game logic: daily picks, answer matching, multiple-choice options. Also holds a `HINTS` table (conference/region per place) that the game doesn't currently show |
| `data.js` | NBA player pool (`window.PLAYERS`) |
| `data_nfl.js` | NFL player pool (`window.PLAYERS_NFL`) |
| `tools/serve.js` | Local dev server (not used by the live site) |
| `tools/check-data.js` | Validates the data files after a refresh |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is |

## Run it locally

You need [Node.js](https://nodejs.org) (any recent version). From this folder:

```
node tools/serve.js
```

Then open http://localhost:8080. Opening `index.html` straight from disk also works, but the server matches the live site more closely.

## Refreshing the roster data

Each league's data file is one JavaScript array, one player per row:

```js
// data.js (NBA)
["Jamal Murray", "Kentucky", "c", "G", "Denver Nuggets"],
// data_nfl.js (NFL), with an optional 6th field
["Khalil Shakir", "Boise State", "c", "WR", "Buffalo Bills", 1],
```

| Field | Meaning |
| --- | --- |
| 1. name | Player's display name. It must be unique within the file. |
| 2. place | Last college attended, or home country if he skipped US college. This is the answer. Spell it the same way every time (e.g. always `"USC"`, never `"Southern California"`), because players are grouped by exact text. |
| 3. kind | `"c"` college, `"n"` country, `"x"` for the place `"No College"` (prep-to-pro, G League Ignite, etc.) |
| 4. position | NBA: `G` `F` `C`. NFL: `QB` `RB` `WR` `TE` `OL` `DL` `LB` `DB` `ST` |
| 5. team | Current team's full name, or `""` for a free agent (the team line is then hidden) |
| 6. starter (NFL only) | `1` if he's first or second string on the depth chart (QBs included: flag each team's QB1 and QB2), otherwise leave it off. NFL "Where'd He Go" only picks flagged players, except kickers/punters/long snappers (`ST`), who can appear in the 5th "wildcard" slot. NFL Connections only shows flagged players. Pipeline counts everyone. |

### Steps

1. **Update the data file(s).** Edit rows by hand, or regenerate the whole array from your source. The current pools came from Basketball Reference (NBA) and lineups.com rosters plus ESPN depth charts (NFL), with QB1/QB2 flags from Ourlads (https://www.ourlads.com/nfldepthcharts/depthchartpos/QB). Starting QBs change often with injuries, so re-check those flags whenever you refresh. Update the source/date comment on the file's first line too.
2. **Bump the slate salt** for each league you changed, in `app.js`:
   ```js
   var SALT = { nba: '-r6', nfl: '-r8' };   // e.g. change '-r6' to '-r7'
   ```
   The daily picks are seeded from the date plus this salt. Bumping it makes today's puzzles come from the new pool and clears anyone's half-finished game for today, so saved answers don't point at the wrong questions. Streaks and past days are kept. If you skip this step, today's puzzles still change, but anyone mid-game keeps progress saved against the old questions. Tomorrow's set is unaffected either way.
3. **Update the footer note** if needed. In `app.js`, `note()` describes each pool (e.g. "2026-27 rosters", "full rosters incl. practice squads, Nov 2026").
4. **Check the data:**
   ```
   node tools/check-data.js
   ```
   It flags malformed rows, bad kinds or positions, places marked as both college and country, and any day in the next year where a game couldn't be built. Errors (exit code 1) must be fixed. Warnings are fine to ship.
5. **Play it locally** (`node tools/serve.js`) in both leagues.
6. **Publish:**
   ```
   git add -A
   git commit -m "Refresh rosters"
   git push
   ```
   GitHub Pages redeploys automatically, usually within a minute or two. Browsers may keep the old files for up to 10 minutes after that (GitHub Pages caching), so a player who refreshes immediately may still see the previous pool.

## Deploying (GitHub Pages)

The site is served straight from the `main` branch, with no build step. The live URL is `https://<your-username>.github.io/hardwood-daily/`.

**First-time setup:**

1. Create an **empty, public** repository named `hardwood-daily` at https://github.com/new. Don't add a README, .gitignore or license, because this folder already has its own files. GitHub Pages is free for public repos.
2. From this folder, connect it and push (replace `<your-username>`):
   ```
   git remote add origin https://github.com/<your-username>/hardwood-daily.git
   git push -u origin main
   ```
   The first push opens a GitHub sign-in window.
3. On GitHub, open the repo's **Settings → Pages**. Under **Build and deployment**, set **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**, then **Save**.
4. After a minute or two, the **Pages** settings page shows "Your site is live at ...". The **Actions** tab shows each deploy's progress.

**Updating:** every `git push` to `main` redeploys.

**Custom domain (optional):** in **Settings → Pages → Custom domain**, enter your domain, then follow GitHub's DNS instructions. Tick **Enforce HTTPS** once it's available.

## Notes

- Saves are per-browser. Clearing site data, or switching device or browser, starts a player fresh.
- The saved-data key is `hd1`, versioned by `VER` in `app.js`. Changing `VER` wipes everyone's saved progress and streaks, so only change it if you change the save format.
- A new puzzle set unlocks at each player's local midnight.

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

## Difficulty: Rookie and Veteran

A small "Rookie | Veteran" switch on the right of the puzzle header (in Where'd He Go and Connections) changes difficulty. New visitors start on **Rookie**, and each league remembers the last choice.

| | Rookie (easier) | Veteran (harder) |
| --- | --- | --- |
| NBA Where'd He Go / Connections | Starters only | Anyone on a roster |
| NFL Where'd He Go | 2 QBs, then 3 RB/WR/TE (all flagged) | QB, 2 RB/WR/TE, 1 OL or defense, 1 wildcard (any flagged non-OL, or a kicker/punter/long snapper) |
| NFL Connections | Flagged QBs, RBs, WRs, TEs | Any flagged player |
| Pipeline | Same round for both | Same round for both |

Each difficulty has its own daily puzzles and saved progress. The streak is per league, and playing either difficulty counts.

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
| 6. starter | `1` to mark a starter, otherwise leave it off. **NBA:** the 5 players in each team's starting lineup (150 total); Rookie mode only uses these in Where'd He Go and Connections. **NFL:** depth-chart players, as follows. **QB:** each team's QB1 and QB2. **WR:** the first-string player at each of the team's three WR spots (3 per team). **RB/TE:** first and second string. **OL/DL/LB/DB:** starters. NFL "Where'd He Go" only picks flagged players, except kickers/punters/long snappers (`ST`), who can appear in the 5th "wildcard" slot. NFL Connections only shows flagged players. Pipeline counts everyone. |

### Steps

1. **Update the data file(s).** Edit rows by hand, or regenerate the whole array from your source. The current pools came from Basketball Reference (NBA, with starting lineups from https://www.espn.com/nba/depth) and lineups.com rosters plus ESPN depth charts (NFL), with QB and WR flags from Ourlads (https://www.ourlads.com/nfldepthcharts/depthchartpos/QB and .../depthchartpos/WR). Starting QBs and WRs change often with injuries, so re-check those flags whenever you refresh. Update the source/date comment on the file's first line too.
2. **Bump the slate salt** for each league you changed, in `app.js`:
   ```js
   var SALT = { nba: '-r6', nfl: '-r8' };   // e.g. change '-r6' to '-r7'
   ```
   The daily picks are seeded from the date plus this salt. Bumping it makes today's puzzles come from the new pool and clears anyone's half-finished game for today, so saved answers don't point at the wrong questions. Streaks and past days are kept. If you skip this step, today's puzzles still change, but anyone mid-game keeps progress saved against the old questions. Tomorrow's set is unaffected either way.
3. **Update "How to play"** if needed. It's the `<details class="about">` block in `index.html`; its last line says when the rosters are from ("Rosters as of November 2026"). While you're in `index.html`, change the `?v=` value on the four `<script>` tags (any new value, e.g. today's date) so browsers load the new files together instead of mixing cached old ones with new ones.
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

- Sharing: each finished game has its own "Copy result" button. The "All of today" box at the bottom copies every game finished today, in both leagues and both difficulties, and leaves out anything not finished.
- Saves are per-browser. Clearing site data, or switching device or browser, starts a player fresh.
- Light/dark: the "Theme: Light | Dark | Auto" switch at the bottom of the page. Auto (the default) follows the device. That choice is saved under its own key (`hdTheme`), so changing `VER` doesn't reset it.
- The saved-data key is `hd1`, versioned by `VER` in `app.js`. Changing `VER` wipes everyone's saved progress and streaks, so only change it if you change the save format.
- A new puzzle set unlocks at each player's local midnight.

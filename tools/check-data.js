// Sanity-checks data.js and data_nfl.js after a roster refresh. No dependencies.
// Usage: node tools/check-data.js
// Exits with code 1 if anything would break the game; prints warnings for things that only degrade it.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const ctx = { window: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['data.js', 'data_nfl.js', 'game.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const H = ctx.window.HD;
let errors = 0, warnings = 0;
const err = (m) => { errors++; console.log('  ERROR   ' + m); };
const warn = (m) => { warnings++; console.log('  warning ' + m); };

const leagues = [
  { lg: 'nba', file: 'data.js', list: ctx.window.PLAYERS, positions: ['G', 'F', 'C'] },
  { lg: 'nfl', file: 'data_nfl.js', list: ctx.window.PLAYERS_NFL, positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'ST'] },
];

for (const L of leagues) {
  console.log(`\n${L.file} (${L.lg.toUpperCase()})`);
  if (!Array.isArray(L.list) || !L.list.length) { err('player list missing or empty'); continue; }
  const seen = {};
  L.list.forEach((p, i) => {
    const where = `row ${i + 1} (${JSON.stringify(p && p[0])})`;
    if (!Array.isArray(p) || p.length < 5) return err(`${where}: expected [name, place, kind, pos, team${L.lg === 'nfl' ? ', starter?' : ''}]`);
    if (!p[0] || !p[1]) err(`${where}: name and place must be non-empty`);
    if (typeof p[4] !== 'string') err(`${where}: team must be a string ("" for a free agent)`);
    if (['c', 'n', 'x'].indexOf(p[2]) < 0) err(`${where}: kind must be "c" (college), "n" (country) or "x" (No College), got ${JSON.stringify(p[2])}`);
    if (p[2] === 'x' && p[1] !== 'No College') warn(`${where}: kind "x" is meant for place "No College"`);
    if (L.positions.indexOf(p[3]) < 0) err(`${where}: position must be one of ${L.positions.join('/')}, got ${JSON.stringify(p[3])}`);
    if (p[1] !== p[1].trim() || p[0] !== p[0].trim()) warn(`${where}: stray spaces in name or place`);
    if (seen[p[0]]) warn(`${where}: duplicate name (also row ${seen[p[0]]}); autocomplete will show it once`);
    seen[p[0]] = i + 1;
  });

  const groups = H.groupBy(L.list);
  const places = Object.keys(groups);
  const kinds = {};
  places.forEach((pl) => groups[pl].forEach((p) => { (kinds[pl] = kinds[pl] || new Set()).add(p[2]); }));
  places.filter((pl) => kinds[pl].size > 1).forEach((pl) => err(`"${pl}" is marked both college and country; pick one`));
  const connPlaces = places.filter((pl) => groups[pl].length >= 3).length;
  const pipeMin = H.PIPELINE_MIN[L.lg];
  const pipePlaces = places.filter((pl) => groups[pl].length >= pipeMin).length;
  if (connPlaces < 3) err(`Common Ground needs at least 3 places with 3+ players, found ${connPlaces}`);
  if (pipePlaces < 1) err(`Pipeline needs at least 1 place with ${pipeMin}+ players, found 0`);

  // Simulate a year of daily games to catch anything that would crash on a given day.
  const d = new Date();
  let crashes = 0;
  for (let i = 0; i < 366 && crashes < 3; i++) {
    const k = H.dateKey(d) + '-check' + (L.lg === 'nfl' ? '-nfl' : '');
    try {
      for (const lv of ['rookie', 'veteran']) {
        const A = L.lg === 'nfl' ? H.dailyPlayersNFL(L.list, k + lv, lv) : H.dailyPlayers(L.list, k + lv, 5, lv);
        if (A.length !== 5 || A.some((p) => !p)) throw new Error(`${lv}: could not fill 5 players`);
        const B = H.dailyConnections(L.list, k + lv, 3, L.lg, lv);
        if (B.length !== 3) throw new Error(`${lv}: could not build 3 Common Ground puzzles`);
      }
      const C = H.dailyPipeline(L.list, k, L.lg);
      if (!C || !C.pool || !C.pool.length) throw new Error('empty pipeline');
    } catch (e) { crashes++; err(`daily game for ${H.dateKey(d)} fails: ${e.message}`); }
    d.setDate(d.getDate() + 1);
  }
  if (L.lg === 'nfl') {
    ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'].forEach((pos) => {
      const n = L.list.filter((p) => p[3] === pos && p[5]).length;
      if (n < 5) warn(`only ${n} ${pos} rows carry the starter flag (6th field = 1); Roots draws from these`);
    });
  } else {
    const n = L.list.filter((p) => p[5]).length;
    if (n < 100) warn(`only ${n} NBA rows carry the starter flag (6th field = 1); Rookie mode only uses these (expect 150: 5 per team)`);
  }
  console.log(`  ${L.list.length} players, ${places.length} schools/countries, ${connPlaces} usable for Common Ground, ${pipePlaces} for Pipeline`);
}

console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);

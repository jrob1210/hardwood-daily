// Pure game logic. No DOM.
(function (root) {
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, r) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[.'’\-]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var ALIASES = {
    'uconn': 'UConn', 'connecticut': 'UConn', 'unc': 'North Carolina', 'tar heels': 'North Carolina',
    'usc': 'USC', 'southern cal': 'USC', 'southern california': 'USC', 'lsu': 'LSU', 'tcu': 'TCU',
    'msu': 'Michigan State', 'michigan st': 'Michigan State', 'ohio st': 'Ohio State', 'osu': 'Ohio State',
    'uk': 'Kentucky', 'wildcats': 'Kentucky', 'ucla': 'UCLA', 'florida st': 'Florida State', 'fsu': 'Florida State',
    'arizona st': 'Arizona State', 'asu': 'Arizona State', 'wsu': 'Washington State', 'sdsu': 'San Diego State',
    'bosnia': 'Bosnia and Herzegovina', 'wake': 'Wake Forest', 'nova': 'Villanova', 'oklahoma st': 'Oklahoma State',
    'okstate': 'Oklahoma State', 'iowa st': 'Iowa State', 'murray': 'Murray State', 'weber': 'Weber State',
    'wichita': 'Wichita State', 'pitt': 'Pittsburgh', 'none': 'No College', 'no school': 'No College', 'straight to nba': 'No College', 'miami': 'Miami (FL)', 'ucf': 'UCF', 'central florida': 'UCF', 'st johns': "St. John's", 'saint johns': "St. John's", 'smu': 'SMU', 'vcu': 'VCU', 'unlv': 'UNLV', 'ole miss': 'Ole Miss', 'mississippi': 'Ole Miss', 'loyola': 'Loyola Maryland', 'st marys': "Saint Mary's", 'texas am': 'Texas A&M', 'bosnia herzegovina': 'Bosnia and Herzegovina', 'czech republic': 'Czechia', 'congo': 'DR Congo', 'drc': 'DR Congo', 'fresno': 'Fresno State', 'nc state': 'NC State', 'ncsu': 'NC State', 'byu': 'BYU', 'utsa': 'UTSA', 'utep': 'UTEP', 'uab': 'UAB', 'umass': 'UMass', 'usf': 'South Florida', 'app state': 'Appalachian State', 'appalachian st': 'Appalachian State', 'ndsu': 'North Dakota State', 'sdsu bison': 'South Dakota State', 'penn st': 'Penn State', 'bama': 'Alabama', 'cal': 'California', 'berkeley': 'California'
  };
  function sameAnswer(guess, answer) {
    var g = norm(guess), a = norm(answer);
    if (!g) return false;
    if (g === a) return true;
    return ALIASES[g] ? norm(ALIASES[g]) === a : false;
  }
  function dateKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function groupBy(players) {
    var g = {};
    players.forEach(function (p) { (g[p[1]] = g[p[1]] || []).push(p); });
    return g;
  }
  // Mode A: five players, fixed order for the day.
  function dailyPlayers(players, key, n) {
    return shuffle(players, rng(hash('A' + key))).slice(0, n || 5);
  }
  // NFL Mode A: five players. 1 QB (any string); 2-3 skill (RB/WR/TE, first or second string); 4 an OL or defensive starter (position group picked first, evenly: OL/DL/LB/DB); 5 wildcard (QB, skill, defense or special teams; no OL). Everyone except QB and special teams must carry the depth-chart flag p[5].
  var NFL_SLOTS = [['QB'], ['RB', 'WR', 'TE'], ['RB', 'WR', 'TE'], ['OL', 'DL', 'LB', 'DB'], ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB', 'ST']];
  function dailyPlayersNFL(players, key) {
    var r = rng(hash('A' + key)), used = {}, out = [];
    NFL_SLOTS.forEach(function (allowed, slot) {
      if (slot === 3) allowed = [allowed[Math.floor(r() * allowed.length)]];
      var pool = shuffle(players.filter(function (p) { return allowed.indexOf(p[3]) >= 0 && !used[p[0]] && (!/^(RB|WR|TE|OL|DL|LB|DB)$/.test(p[3]) || p[5]); }), r);
      var pick = pool[0];
      used[pick[0]] = 1; out.push(pick);
    });
    return out;
  }
  // Mode B: three puzzles. Each has two players sharing a place.
  function dailyConnections(players, key, n) {
    var g = groupBy(players), r = rng(hash('B' + key));
    var places = Object.keys(g).filter(function (k) { return g[k].length >= 3; }).sort();
    var picked = shuffle(places, r).slice(0, n || 3);
    return picked.map(function (place) {
      var kind = g[place][0][2];
      var four = shuffle(g[place], r).slice(0, 2);
      var pool = Object.keys(g).filter(function (k) { return k !== place && g[k][0][2] === kind; }).sort();
      var opts = shuffle([place].concat(shuffle(pool, r).slice(0, 3)), r);
      return { place: place, kind: kind, four: four, options: opts };
    });
  }
  // Mode C: one place with at least five players.
  function dailyPipeline(players, key) {
    var g = groupBy(players), r = rng(hash('C' + key));
    var places = Object.keys(g).filter(function (k) { return g[k].length >= 6 && g[k].length <= 18; }).sort();
    var place = shuffle(places, r)[0];
    return { place: place, pool: g[place] };
  }
  // Match typed text to a pool player: full name, or a last name that is unique in the pool.
  function matchPlayer(text, pool) {
    var t = norm(text).replace(/ (jr|sr|ii|iii)$/, '');
    if (!t) return null;
    var i;
    var strip = function (s) { return norm(s).replace(/ (jr|sr|ii|iii)$/, ''); };
    for (i = 0; i < pool.length; i++) if (strip(pool[i][0]) === t) return pool[i];
    for (i = 0; i < pool.length; i++) if (norm(pool[i][0]) === t) return pool[i];
    var hits = pool.filter(function (p) {
      var parts = norm(p[0]).split(' ');
      var last = parts[parts.length - 1];
      if (/^(jr|sr|ii|iii)$/.test(last) && parts.length > 1) last = parts[parts.length - 2];
      return last === t;
    });
    return hits.length === 1 ? hits[0] : null;
  }
  // Dropdown suggestions: prefix matches first, then substring matches, plus any alias hit.
  function suggest(text, places, max) {
    var q = norm(text);
    if (!q) return [];
    var out = [];
    function add(p) { if (out.indexOf(p) < 0) out.push(p); }
    if (ALIASES[q] && places.indexOf(ALIASES[q]) >= 0) add(ALIASES[q]);
    places.forEach(function (p) { if (norm(p).indexOf(q) === 0) add(p); });
    places.forEach(function (p) { if (norm(p).split(' ').some(function (w) { return w.indexOf(q) === 0; })) add(p); });
    places.forEach(function (p) { if (norm(p).indexOf(q) >= 0) add(p); });
    return out.slice(0, max || 8);
  }
  // Player-name suggestions: full-name prefix, then any word prefix, then substring.
  function suggestNames(text, players, max) {
    var q = norm(text);
    if (!q) return [];
    var scored = [];
    players.forEach(function (p) {
      var n = norm(p[0]), s = -1;
      if (n.indexOf(q) === 0) s = 0;
      else if (n.split(' ').some(function (w) { return w.indexOf(q) === 0; }) || (' ' + n).indexOf(' ' + q) >= 0) s = 1;
      else if (n.indexOf(q) >= 0) s = 2;
      if (s >= 0) scored.push([s, p[0]]);
    });
    scored.sort(function (a, b) { return a[0] - b[0] || (a[1] < b[1] ? -1 : 1); });
    return scored.slice(0, max || 8).map(function (x) { return x[1]; });
  }
  var HINTS = {"Radford": "College conference: Big South", "Air Force": "College conference: Mountain West", "Akron": "College conference: MAC", "Alabama": "College conference: SEC", "Alabama A&M": "College conference: SWAC", "Alabama State": "College conference: SWAC", "Albany State": "A small college, below Division I", "Alcorn State": "College conference: SWAC", "Appalachian State": "College conference: Sun Belt", "Arizona": "College conference: Big 12", "Arizona State": "College conference: Big 12", "Arkansas": "College conference: SEC", "Arkansas State": "College conference: Sun Belt", "Army": "College conference: American (AAC)", "Auburn": "College conference: SEC", "Austin Peay": "College conference: ASUN (UAC in football)", "Australia": "A country in Oceania", "Azusa Pacific": "A small college, below Division I", "BYU": "College conference: Big 12", "Ball State": "College conference: MAC", "Barton": "A small college, below Division I", "Baylor": "College conference: Big 12", "Belmont": "College conference: Missouri Valley", "Bemidji State": "A small college, below Division I", "Boise State": "College conference: Pac-12", "Bosnia and Herzegovina": "A country in Europe", "Boston College": "College conference: ACC", "Bowling Green": "College conference: MAC", "Bradley": "College conference: Missouri Valley", "Brazil": "A country in South America", "British Columbia": "A school outside the US, in Canada", "Brown": "College conference: Ivy League", "Bryant": "College conference: America East (Big South-OVC in football)", "Buffalo": "College conference: MAC", "Butler": "College conference: Big East", "Cal Poly": "College conference: Big West (Big Sky in football)", "California": "College conference: ACC", "Campbell": "College conference: CAA", "Canada": "A country in North America", "Canisius College": "College conference: MAAC", "Central Arkansas": "College conference: UAC / WAC", "Central Michigan": "College conference: MAC", "Central Missouri": "A small college, below Division I", "Charlotte": "College conference: American (AAC)", "Chattanooga": "College conference: Southern Conference", "China": "A country in Asia", "Cincinnati": "College conference: Big 12", "Clemson": "College conference: ACC", "Coastal Carolina": "College conference: Sun Belt", "Colorado": "College conference: Big 12", "Colorado State": "College conference: Pac-12", "Creighton": "College conference: Big East", "Croatia": "A country in Europe", "Culver-Stockton": "A small college, below Division I", "Czechia": "A country in Europe", "DR Congo": "A country in Africa", "Davidson": "College conference: Atlantic 10", "Dayton": "College conference: Atlantic 10", "DePaul": "College conference: Big East", "Delaware": "College conference: Conference USA", "Delta State": "A small college, below Division I", "Drake": "College conference: Missouri Valley", "Duke": "College conference: ACC", "Duquesne": "College conference: Atlantic 10", "East Carolina": "College conference: American (AAC)", "East Central": "A small college, below Division I", "East Tennessee State": "College conference: Southern Conference", "East Texas A&M": "College conference: Southland", "Eastern Michigan": "College conference: MAC", "Eastern Washington": "College conference: Big Sky", "Elon": "College conference: CAA", "Fayetteville State": "A small college, below Division I", "Ferris State": "A small college, below Division I", "Findlay": "A small college, below Division I", "Florida": "College conference: SEC", "Florida A&M": "College conference: SWAC", "Florida Atlantic": "College conference: American (AAC)", "Florida International": "College conference: Conference USA", "Florida State": "College conference: ACC", "Fordham": "College conference: Atlantic 10 (Patriot League in football)", "Fort Hays State": "A small college, below Division I", "Fort Valley State": "A small college, below Division I", "France": "A country in Europe", "Fresno State": "College conference: Pac-12", "Friends": "A small college, below Division I", "Furman": "College conference: Southern Conference", "George Washington": "College conference: Atlantic 10", "Georgetown": "College conference: Big East", "Georgia": "College conference: SEC", "Georgia (country)": "A country in the Caucasus (Europe/Asia border)", "Georgia Southern": "College conference: Sun Belt", "Georgia State": "College conference: Sun Belt", "Georgia Tech": "College conference: ACC", "Germany": "A country in Europe", "Gonzaga": "College conference: Pac-12", "Grambling State": "College conference: SWAC", "Greece": "A country in Europe", "Harvard": "College conference: Ivy League", "Hawaii": "College conference: Mountain West", "Holy Cross": "College conference: Patriot League", "Houston": "College conference: Big 12", "Houston Christian": "College conference: Southland", "Idaho": "College conference: Big Sky", "Idaho State": "College conference: Big Sky", "Illinois": "College conference: Big Ten", "Illinois State": "College conference: Missouri Valley", "Indiana": "College conference: Big Ten", "Indiana (PA)": "A small college, below Division I", "Indiana State": "College conference: Missouri Valley", "Innsbruck": "A school outside the US, in Europe", "Iowa": "College conference: Big Ten", "Iowa State": "College conference: Big 12", "Ireland": "A country in Europe", "Israel": "A country in the Middle East", "Italy": "A country in Europe", "Jackson State": "College conference: SWAC", "Jacksonville State": "College conference: Conference USA", "James Madison": "College conference: Sun Belt", "John Carroll": "A small college, below Division I", "Kansas": "College conference: Big 12", "Kansas State": "College conference: Big 12", "Kentucky": "College conference: SEC", "Kutztown": "A small college, below Division I", "LSU": "College conference: SEC", "Lane College": "A small college, below Division I", "Latvia": "A country in Europe", "Lehigh": "College conference: Patriot League", "Lenoir-Rhyne": "A small college, below Division I", "Liberty": "College conference: Conference USA", "Little Rock": "College conference: Ohio Valley", "Loughborough": "A school outside the US, in Europe", "Louisiana": "College conference: Sun Belt", "Louisiana Tech": "College conference: Sun Belt", "Louisiana-Monroe": "College conference: Sun Belt", "Louisville": "College conference: ACC", "Loyola Maryland": "College conference: Patriot League", "Maine": "College conference: America East (CAA in football)", "Malone": "A small college, below Division I", "Manitoba": "A school outside the US, in Canada", "Marist": "College conference: MAAC", "Marquette": "College conference: Big East", "Marshall": "College conference: Sun Belt", "Maryland": "College conference: Big Ten", "Memphis": "College conference: American (AAC)", "Mexico": "A country in North America", "Miami (FL)": "College conference: ACC", "Miami (OH)": "College conference: MAC", "Michigan": "College conference: Big Ten", "Michigan State": "College conference: Big Ten", "Middle Tennessee State": "College conference: Conference USA", "Minnesota": "College conference: Big Ten", "Minnesota State Moorhead": "A small college, below Division I", "Mississippi State": "College conference: SEC", "Missouri": "College conference: SEC", "Missouri S&T": "A small college, below Division I", "Missouri State": "College conference: Conference USA", "Missouri Western": "A small college, below Division I", "Missouri Western State": "A small college, below Division I", "Monmouth": "College conference: CAA", "Montana": "College conference: Big Sky", "Montana State": "College conference: Big Sky", "Monterrey Tech": "A school outside the US, in Mexico", "Morgan State": "College conference: MEAC", "Murray State": "College conference: Missouri Valley", "NC State": "College conference: ACC", "Navy": "College conference: American (AAC)", "Nebraska": "College conference: Big Ten", "Nevada": "College conference: Mountain West", "New Hampshire": "College conference: CAA", "New Mexico": "College conference: Mountain West", "New Mexico State": "College conference: Conference USA", "Nigeria": "A country in Africa", "No College": "", "North Carolina": "College conference: ACC", "North Carolina Central": "College conference: MEAC", "North Dakota": "College conference: Summit League", "North Dakota State": "College conference: Mountain West (Summit League in basketball)", "North Texas": "College conference: American (AAC)", "Northern Arizona": "College conference: Big Sky", "Northern Illinois": "College conference: MAC (Mountain West in football)", "Northern Iowa": "College conference: Missouri Valley", "Northwest Missouri State": "A small college, below Division I", "Northwestern": "College conference: Big Ten", "Notre Dame": "College conference: ACC (Independent in football)", "Oakland": "College conference: Horizon League", "Ohio": "College conference: MAC", "Ohio State": "College conference: Big Ten", "Oklahoma": "College conference: SEC", "Oklahoma State": "College conference: Big 12", "Old Dominion": "College conference: Sun Belt", "Ole Miss": "College conference: SEC", "Oregon": "College conference: Big Ten", "Oregon State": "College conference: Pac-12", "Penn State": "College conference: Big Ten", "Pennsylvania": "College conference: Ivy League", "Pittsburg State": "A small college, below Division I", "Pittsburgh": "College conference: ACC", "Prairie View A&M": "College conference: SWAC", "Princeton": "College conference: Ivy League", "Providence": "College conference: Big East", "Purdue": "College conference: Big Ten", "Queens": "College conference: ASUN", "Rice": "College conference: American (AAC)", "Rutgers": "College conference: Big Ten", "SMU": "College conference: ACC", "SUNY-Cortland": "A small college, below Division I", "Sacramento State": "College conference: Big Sky (MAC in football)", "Sacred Heart": "College conference: MAAC", "Saginaw Valley State": "A small college, below Division I", "Saint Joseph's": "College conference: Atlantic 10", "Saint Louis": "College conference: Atlantic 10", "Saint Mary's": "College conference: West Coast Conference", "Sam Houston State": "College conference: Conference USA", "Samford": "College conference: Southern Conference", "San Diego": "College conference: West Coast Conference", "San Diego State": "College conference: Pac-12", "San Francisco": "College conference: West Coast Conference", "San Jose State": "College conference: Mountain West", "Santa Clara": "College conference: West Coast Conference", "Senegal": "A country in Africa", "Serbia": "A country in Europe", "Seton Hall": "College conference: Big East", "Shepherd": "A small college, below Division I", "Sioux Falls": "A small college, below Division I", "Slovenia": "A country in Europe", "South Alabama": "College conference: Sun Belt", "South Carolina": "College conference: SEC", "South Carolina State": "College conference: MEAC", "South Dakota": "College conference: Summit League", "South Dakota State": "College conference: Summit League", "South Florida": "College conference: American (AAC)", "Southeast Missouri State": "College conference: Ohio Valley", "Southeastern Louisiana": "College conference: Southland", "Southern Arkansas": "A small college, below Division I", "Southern Illinois": "College conference: Missouri Valley", "Southern Miss": "College conference: Sun Belt", "Southern Utah": "College conference: UAC / WAC", "Spain": "A country in Europe", "St. John's": "College conference: Big East", "St. John's (MN)": "A small college, below Division I", "Stanford": "College conference: ACC", "Stellenbosch": "A school outside the US, in Africa", "Stephen F. Austin": "College conference: Southland", "Stony Brook": "College conference: CAA", "Switzerland": "A country in Europe", "Syracuse": "College conference: ACC", "TCU": "College conference: Big 12", "Tarleton State": "College conference: UAC / WAC", "Temple": "College conference: American (AAC)", "Tennessee": "College conference: SEC", "Texas": "College conference: SEC", "Texas A&M": "College conference: SEC", "Texas State": "College conference: Pac-12", "Texas Tech": "College conference: Big 12", "Toledo": "College conference: MAC", "Towson": "College conference: CAA", "Troy": "College conference: Sun Belt", "Tulane": "College conference: American (AAC)", "Tulsa": "College conference: American (AAC)", "Turkey": "A country in Europe or Asia", "Tusculum College": "A small college, below Division I", "UAB": "College conference: American (AAC)", "UC Davis": "College conference: Big Sky / Big West", "UC Santa Barbara": "College conference: Big West", "UCF": "College conference: Big 12", "UCLA": "College conference: Big Ten", "UConn": "College conference: Big East", "UMass": "College conference: MAC / Atlantic 10", "UNLV": "College conference: Mountain West", "USC": "College conference: Big Ten", "UTEP": "College conference: Mountain West", "UTSA": "College conference: American (AAC)", "Utah": "College conference: Big 12", "Utah State": "College conference: Pac-12", "VCU": "College conference: Atlantic 10", "Valdosta State": "A small college, below Division I", "Vanderbilt": "College conference: SEC", "Villanova": "College conference: Big East", "Virginia": "College conference: ACC", "Virginia Commonwealth": "College conference: Atlantic 10", "Virginia Tech": "College conference: ACC", "Wagner": "College conference: Northeast Conference", "Wake Forest": "College conference: ACC", "Washburn": "A small college, below Division I", "Washington": "College conference: Big Ten", "Washington State": "College conference: Pac-12", "Weber State": "College conference: Big Sky", "West Virginia": "College conference: Big 12", "Western Colorado": "A small college, below Division I", "Western Illinois": "College conference: Ohio Valley", "Western Kentucky": "College conference: Conference USA", "Western Michigan": "College conference: MAC", "Wichita State": "College conference: American (AAC)", "William & Mary": "College conference: CAA", "Wingate": "A small college, below Division I", "Wisconsin": "College conference: Big Ten", "Wisconsin-Whitewater": "A small college, below Division I", "Wofford": "College conference: Southern Conference", "Wyoming": "College conference: Mountain West", "Xavier": "College conference: Big East", "Yale": "College conference: Ivy League", "York (Canada)": "A school outside the US, in Canada", "Youngstown State": "College conference: Horizon League (Missouri Valley in football)", "Zambia": "A country in Africa"};
  function hintFor(place, lg) {
    if (!Object.prototype.hasOwnProperty.call(HINTS, place)) return 'Starts with ' + place.charAt(0).toUpperCase() + ' · ' + place.length + ' characters';
    var h = HINTS[place], pre = 'College conference: ';
    if (h.indexOf(pre) !== 0) return h.replace(/^A (country|school|small)/, function (m, w) { return w.charAt(0).toUpperCase() + w.slice(1); });
    var c = h.slice(pre.length), m;
    if ((m = c.match(/^(.+?) \((.+?) in (football|basketball)\)$/))) {
      return (m[3] === 'football') === (lg === 'nfl') ? m[2] : m[1];
    }
    if (c.indexOf(' / ') > 0) { var parts = c.split(' / '); return lg === 'nfl' ? parts[0] : parts[1]; }
    return c;
  }
  root.HD = { hash: hash, rng: rng, shuffle: shuffle, norm: norm, sameAnswer: sameAnswer, dateKey: dateKey,
    groupBy: groupBy, dailyPlayers: dailyPlayers, dailyPlayersNFL: dailyPlayersNFL, NFL_SLOTS: NFL_SLOTS, dailyConnections: dailyConnections,
    dailyPipeline: dailyPipeline, matchPlayer: matchPlayer, hintFor: hintFor, suggest: suggest, suggestNames: suggestNames };
})(typeof window !== 'undefined' ? window : globalThis);

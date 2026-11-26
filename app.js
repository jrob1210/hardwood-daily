(function () {
  var H = window.HD, P, ALL_PLACES, A, B, C, LG = 'nba';
  var KEY = H.dateKey();
  var VER = 'v5'; // save-format version: changing it wipes every player's saved results and streaks
  // Slate salt per league. It seeds the daily picks, so bumping one (e.g. '-r3' -> '-r4') gives that league a new set
  // for today and drops any results saved against the old set. Bump it whenever you change that league's data file.
  var SALT = { nba: '-r6', nfl: '-r9' };
  var S = { days: {}, v: VER };
  var mode = 'a';
  var run = null; // live Pipeline run: {end, timer, found:[]}
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function setLeague(lg) {
    LG = lg; S.lg = lg;
    P = lg === 'nfl' ? window.PLAYERS_NFL : window.PLAYERS;
    ALL_PLACES = Object.keys(H.groupBy(P)).sort();
    var k = KEY + SALT[lg] + (lg === 'nfl' ? '-nfl' : '');
    A = lg === 'nfl' ? H.dailyPlayersNFL(P, k) : H.dailyPlayers(P, k, 5);
    B = H.dailyConnections(P, k, 3, lg); C = H.dailyPipeline(P, k, lg);
    document.documentElement.setAttribute('data-league', lg); // switches the color scheme (see index.html)
    var h1 = document.getElementById('brand'); if (h1) h1.innerHTML = brand() + ' <span>Daily</span>';
    document.title = brand() + ' Daily';
  }
  function dk(date) { return (date || KEY) + (LG === 'nfl' ? '|nfl5' : ''); }
  function brand() { return LG === 'nfl' ? 'Gridiron' : 'Hardwood'; }
  function title() { return brand() + ' Daily ' + LG.toUpperCase() + ' ' + KEY; }

  // Progress lives only in this browser's localStorage (key 'hd1').
  function save() { S.v = VER; try { localStorage.setItem('hd1', JSON.stringify(S)); } catch (e) {} }
  function load() { try { var d = JSON.parse(localStorage.getItem('hd1')); if (d && d.days && d.v === VER) S = d; } catch (e) {} }
  function day() {
    var k = dk();
    if (S.days[k] && S.days[k].slate !== SALT[LG]) delete S.days[k]; // new slate: drop results saved against the old one
    return S.days[k] || (S.days[k] = { slate: SALT[LG], a: { i: 0, tries: 0, res: [], done: false }, b: { i: 0, tries: 0, res: [], done: false }, c: { found: [], done: false } });
  }
  function streak() {
    var d = new Date(), n = 0, first = true;
    for (var i = 0; i < 400; i++) {
      var rec = S.days[dk(H.dateKey(d))];
      var played = rec && (rec.a.done || rec.b.done || rec.c.done);
      if (played) n++; else if (!first) break;
      first = false; d.setDate(d.getDate() - 1);
    }
    return n;
  }
  var EMO = { g: '🟩', y: '🟨', r: '🟥' };
  function pips(res, i, total) {
    var h = '<div class="pips" aria-hidden="true">';
    for (var k = 0; k < total; k++) h += '<div class="pip ' + (res[k] || '') + (k === i && !res[k] ? ' now' : '') + '"></div>';
    return h + '</div>';
  }
  function shareBlock(text) {
    return '<div class="result"><pre id="sharetxt">' + esc(text) + '</pre><button class="btn" id="copy">Copy result</button> <span class="msg" id="copymsg"></span></div>';
  }
  function bindCopy(text) {
    var b = $('copy'); if (!b) return;
    b.onclick = function () {
      var m = $('copymsg');
      try { navigator.clipboard.writeText(text).then(function () { m.textContent = 'Copied.'; }, function () { m.textContent = 'Copy blocked. Select the text above.'; }); }
      catch (e) { m.textContent = 'Copy blocked. Select the text above.'; }
    };
  }
  function shareText(m) {
    var d = day();
    if (m === 'a') return title() + "\nWhere'd He Go " + d.a.res.map(function (x) { return EMO[x]; }).join('');
    if (m === 'b') return title() + '\nConnections ' + d.b.res.map(function (x) { return EMO[x]; }).join('');
    return title() + '\nPipeline: ' + C.place + ' ' + d.c.found.length + '/' + C.pool.length;
  }

  /* ---------- Mode A ---------- */
  function renderA() {
    var s = day().a, el = $('panel');
    if (s.done) {
      var score = s.res.filter(function (x) { return x !== 'r'; }).length;
      el.innerHTML = '<div class="rule"><span>Final</span><span>' + score + ' of ' + A.length + '</span></div>' + pips(s.res, -1, A.length) +
        A.map(function (p, i) { return '<p><span class="chip">' + p[3] + '</span>' + esc(p[0]) + ' · <b>' + esc(p[1]) + '</b> ' + EMO[s.res[i]] + '</p>'; }).join('') +
        shareBlock(shareText('a'));
      bindCopy(shareText('a')); return;
    }
    var p = A[s.i], mc = s.tries === 1;
    el.innerHTML = '<div class="rule"><span>Player ' + (s.i + 1) + ' of ' + A.length + '</span><span>' + (mc ? 'Last guess' : '2 guesses left') + '</span></div>' + pips(s.res, s.i, A.length) +
      '<span class="chip">' + p[3] + '</span><span class="sub">Where did he come from?</span>' +
      '<div class="big">' + esc(p[0]) + '</div>' + (p[4] ? '<div class="team">' + esc(p[4]) + '</div>' : '') +
      (mc ? choiceButtons(H.choices(p[1], P, KEY + LG + 'A' + s.i, s.wrong)) : guessForm()) +
      '<button type="button" class="btn alt pass" id="pass">I don\'t know</button>' +
      '<div class="msg' + (mc ? ' bad' : '') + '" id="msg" aria-live="polite">' + (mc ? esc(missMsg(p[1], s.wrong)) : '') + '</div><div id="after"></div>';
    $('pass').onclick = function () { finishA(p, 'r', false); };
    if (mc) { bindChoices(p[1], function (ok) { finishA(p, ok ? 'y' : 'r', ok); }); return; }
    $('g').focus();
    var chosen = bindPicker($('g'), $('lb'), $('go'));
    $('f').onsubmit = function (e) {
      e.preventDefault();
      var v = chosen(); if (!v) return;
      if (v === p[1]) finishA(p, 'g', true);
      else { s.tries = 1; s.wrong = v; save(); renderA(); }
    };
  }
  // After a wrong first guess the text box is swapped for four buttons (see H.choices).
  function guessForm() {
    return '<form class="row" id="f" autocomplete="off"><div class="combo"><input type="text" id="g" role="combobox" aria-expanded="false" aria-controls="lb" aria-autocomplete="list" placeholder="Start typing your answer" aria-label="Your answer"><ul id="lb" class="lb" role="listbox" hidden></ul></div><button class="btn" id="go" disabled>Guess</button></form>';
  }
  // No conference/region hint here: with four choices it usually gives the answer away.
  // (H.hintFor and the HINTS table in game.js are kept in case hints come back.)
  function missMsg(place, wrong) {
    return (wrong ? 'Not ' + wrong + '. ' : 'Not it. ') + 'Pick one of these four.';
  }
  function choiceButtons(opts) {
    return '<div class="opts" id="opts">' + opts.map(function (o) { return '<button type="button" class="btn" data-o="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>';
  }
  function bindChoices(answer, done) {
    var btns = document.querySelectorAll('#opts button');
    Array.prototype.forEach.call(btns, function (b) {
      b.onclick = function () {
        var pick = b.getAttribute('data-o');
        Array.prototype.forEach.call(btns, function (x) {
          x.disabled = true;
          if (x.getAttribute('data-o') === answer) x.className = 'btn right';
        });
        if (pick !== answer) b.className = 'btn wrong';
        done(pick === answer);
      };
    });
  }
  // Combobox: the guess button stays disabled until a suggestion is picked, so typos cannot be submitted.
  function bindPicker(input, list, btn, suggestFn, onPick) {
    suggestFn = suggestFn || function (t) { return H.suggest(t, ALL_PLACES, 8); };
    var picked = null, items = [], active = -1;
    function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
    function paint() {
      list.innerHTML = items.map(function (x, i) {
        return '<li role="option" id="o' + i + '" data-i="' + i + '"' + (i === active ? ' aria-selected="true"' : '') + '>' + esc(x) + '</li>';
      }).join('');
      list.hidden = !items.length; input.setAttribute('aria-expanded', items.length ? 'true' : 'false');
    }
    function pick(i) {
      picked = items[i]; input.value = picked; if (btn) btn.disabled = false; close();
      if (onPick) { var v = picked; picked = null; input.value = ''; items = []; if (btn) btn.disabled = true; onPick(v); }
    }
    input.addEventListener('input', function () {
      picked = null; if (btn) btn.disabled = true; items = suggestFn(input.value); active = items.length ? 0 : -1; paint();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); active = (active + 1) % items.length; paint(); }
      else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
      else if (e.key === 'Escape') close();
      else if (e.key === 'Enter') { if (!list.hidden && active >= 0) { e.preventDefault(); pick(active); } else if (!picked) e.preventDefault(); }
    });
    list.addEventListener('mousedown', function (e) {
      var li = e.target.closest('li'); if (li) { e.preventDefault(); pick(+li.getAttribute('data-i')); }
    });
    input.addEventListener('blur', function () { setTimeout(close, 120); });
    return function () { return picked; };
  }
  function finishA(p, code, win) {
    var s = day().a;
    s.res.push(code); s.tries = 0; s.i++;
    if (s.i >= A.length) s.done = true;
    save(); head();
    var msg = win ? 'Correct: ' + p[1] : 'It was ' + p[1];
    var el = $('panel');
    var f = el.querySelector('form'); if (f) f.style.display = 'none'; $('pass').style.display = 'none';
    $('msg').className = 'msg ' + (win ? 'ok' : 'bad'); $('msg').textContent = msg;
    $('after').innerHTML = '<button class="btn" id="next">' + (s.done ? 'See results' : 'Next player') + '</button>';
    $('next').focus(); $('next').onclick = renderA;
  }

  /* ---------- Mode B ---------- */
  function renderB() {
    var s = day().b, el = $('panel');
    if (s.done) {
      var score = s.res.filter(function (x) { return x !== 'r'; }).length;
      el.innerHTML = '<div class="rule"><span>Final</span><span>' + score + ' of 3</span></div>' + pips(s.res, -1, 3) +
        B.map(function (q, i) { return '<p>' + EMO[s.res[i]] + ' <b>' + esc(q.place) + '</b>: ' + q.four.map(function (p) { return esc(p[0]); }).join(', ') + '</p>'; }).join('') +
        shareBlock(shareText('b'));
      bindCopy(shareText('b')); return;
    }
    var q = B[s.i], mc = s.tries === 1;
    el.innerHTML = '<div class="rule"><span>Puzzle ' + (s.i + 1) + ' of 3</span><span>' + (mc ? 'Last try' : '2 tries left') + '</span></div>' + pips(s.res, s.i, 3) +
      '<p class="sub">What do these two players have in common?</p>' +
      '<div class="four">' + q.four.map(function (p) { return '<div>' + esc(p[0]) + (p[4] ? '<small>' + esc(p[4]) + '</small>' : '') + '</div>'; }).join('') + '</div>' +
      (mc ? choiceButtons(H.choices(q.place, P, KEY + LG + 'B' + s.i, s.wrong)) : guessForm()) +
      '<button type="button" class="btn alt pass" id="pass">I don\'t know</button>' +
      '<div class="msg' + (mc ? ' bad' : '') + '" id="msg" aria-live="polite">' + (mc ? esc(missMsg(q.place, s.wrong)) : '') + '</div><div id="after"></div>';
    $('pass').onclick = function () { endB('r', false); };
    if (mc) { bindChoices(q.place, function (ok) { endB(ok ? 'y' : 'r', ok); }); return; }
    $('g').focus();
    var chosen = bindPicker($('g'), $('lb'), $('go'));
    $('f').onsubmit = function (e) {
      e.preventDefault();
      var v = chosen(); if (!v) return;
      if (v === q.place) endB('g', true);
      else { s.tries = 1; s.wrong = v; save(); renderB(); }
    };
  }
  function endB(code, win) {
    var s = day().b, q = B[s.i];
    s.res.push(code); s.tries = 0; s.i++;
    if (s.i >= B.length) s.done = true;
    save(); head();
    var f = $('panel').querySelector('form'); if (f) f.style.display = 'none'; $('pass').style.display = 'none';
    $('msg').className = 'msg ' + (win ? 'ok' : 'bad'); $('msg').textContent = win ? 'Correct: ' + q.place : 'It was ' + q.place;
    $('after').innerHTML = '<button class="btn" id="next">' + (s.done ? 'See results' : 'Next puzzle') + '</button>';
    $('next').focus(); $('next').onclick = renderB;
  }

  /* ---------- Mode C ---------- */
  function renderC() {
    var s = day().c, el = $('panel'), n = C.pool.length;
    if (s.done) {
      el.innerHTML = '<div class="rule"><span>Final</span><span>' + s.found.length + ' of ' + n + '</span></div>' +
        '<div class="big">' + esc(C.place) + '</div>' +
        '<div class="found">' + C.pool.map(function (p) { var hit = s.found.indexOf(p[0]) >= 0; return '<span class="' + (hit ? '' : 'miss') + '">' + esc(p[0]) + '</span>'; }).join('') + '</div>' +
        shareBlock(shareText('c'));
      bindCopy(shareText('c')); return;
    }
    // A run that was started earlier (then reloaded, or the league/tab was switched) keeps its original clock.
    if (!run && s.start) {
      if (Date.now() < s.start + 60000) beginRun(s);
      else { s.done = true; save(); head(); renderC(); return; }
    }
    if (!run) {
      // The school/country and its size stay hidden until the clock starts, so nobody can plan ahead.
      el.innerHTML = '<div class="rule"><span>Pipeline</span><span>60 seconds</span></div>' +
        '<div class="big">Mystery ' + (LG === 'nfl' ? 'school' : 'school or country') + '</div>' +
        '<p class="sub">Name as many current ' + LG.toUpperCase() + ' players as you can who came from today\'s mystery place. It\'s revealed when you start the clock. Pick each name from the list. You get one run a day, and the clock keeps running if you leave.</p>' +
        '<button class="btn" id="start">Start the clock</button>';
      $('start').onclick = startC; return;
    }
    el.innerHTML = '<div class="rule"><span>Pipeline</span><span id="cnt"></span></div>' +
      '<div class="big">' + esc(C.place) + '</div><div class="timer" id="clock"></div>' +
      '<form class="row" id="f" autocomplete="off"><div class="combo"><input type="text" id="g" role="combobox" aria-expanded="false" aria-controls="lb" aria-autocomplete="list" placeholder="Start typing a player" aria-label="Player name"><ul id="lb" class="lb" role="listbox" hidden></ul></div></form>' +
      '<button type="button" class="btn alt pass" id="giveup">Give up</button>' +
      '<div class="msg" id="msg" aria-live="polite"></div><div class="found" id="fl"></div>';
    var g = $('g'); g.focus(); paintC();
    $('f').onsubmit = function (e) { e.preventDefault(); };
    // Two taps to give up, so a stray tap doesn't end the day's only run.
    var armed = null;
    $('giveup').onclick = function () {
      var b = $('giveup');
      if (armed) { clearTimeout(armed); endC(); return; }
      b.textContent = 'Tap again to give up';
      armed = setTimeout(function () { armed = null; if ($('giveup')) $('giveup').textContent = 'Give up'; }, 3000);
    };
    bindPicker(g, $('lb'), null, function (t) { return H.suggestNames(t, P, 8); }, function (name) {
      var hit = C.pool.filter(function (p) { return p[0] === name; })[0], msg = $('msg');
      if (!hit) { msg.className = 'msg bad'; msg.textContent = name + ' is not from here.'; }
      else if (run.found.indexOf(hit[0]) >= 0) { msg.className = 'msg'; msg.textContent = 'Already got ' + hit[0] + '.'; }
      else { run.found.push(hit[0]); save(); msg.className = 'msg ok'; msg.textContent = hit[0] + ' ✓'; paintC(); if (run.found.length === n) endC(); }
      if (run) g.focus();
    });
  }
  function paintC() {
    if (!run) return;
    var left = Math.max(0, Math.ceil((run.end - Date.now()) / 1000));
    var c = $('clock'), k = $('cnt'), fl = $('fl');
    if (c) { c.textContent = left + 's'; c.className = 'timer' + (left <= 10 ? ' low' : ''); }
    if (k) k.textContent = run.found.length + ' of ' + C.pool.length;
    if (fl) fl.innerHTML = run.found.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('');
  }
  function startC() {
    var s = day().c; s.start = Date.now(); s.found = []; save();
    beginRun(s); renderC();
  }
  // The live run shares its found list with the saved day record, so every hit is saved as it happens.
  function beginRun(s) {
    run = { end: s.start + 60000, found: s.found };
    run.timer = setInterval(function () { if (Date.now() >= run.end) endC(); else paintC(); }, 250);
  }
  function endC() {
    if (!run) return;
    clearInterval(run.timer);
    var s = day().c; s.found = run.found.slice(); s.done = true; run = null;
    save(); head(); if (mode === 'c') renderC();
  }

  /* ---------- Share all ---------- */
  function allText() {
    var d = day(), L = [title()];
    L.push("Where'd He Go " + (d.a.done ? d.a.res.map(function (x) { return EMO[x]; }).join('') : '-'));
    L.push('Connections ' + (d.b.done ? d.b.res.map(function (x) { return EMO[x]; }).join('') : '-'));
    L.push('Pipeline ' + (d.c.done ? C.place + ' ' + d.c.found.length + '/' + C.pool.length : '-'));
    return L.join('\n');
  }
  function renderAll() {
    var d = day(), box = $('all');
    if (!(d.a.done || d.b.done || d.c.done)) { box.innerHTML = ''; return; }
    var t = allText(), left = [d.a, d.b, d.c].filter(function (x) { return !x.done; }).length;
    box.innerHTML = '<div class="result"><h2>All of today</h2><pre>' + esc(t) + '</pre>' +
      '<button class="btn" id="allcopy">Copy all results</button> <span class="msg" id="allmsg"></span>' +
      (left ? '<div class="sub" style="margin:8px 0 0">' + left + ' of 3 still to play. A dash means not played yet.</div>' : '') + '</div>';
    $('allcopy').onclick = function () {
      var m = $('allmsg');
      try { navigator.clipboard.writeText(allText()).then(function () { m.textContent = 'Copied.'; }, function () { m.textContent = 'Copy blocked. Select the text above.'; }); }
      catch (e) { m.textContent = 'Copy blocked. Select the text above.'; }
    };
  }

  /* ---------- Shell ---------- */
  function head() {
    renderAll();
    var d = day();
    $('meta').innerHTML = LG.toUpperCase() + ' · ' + KEY + '<br>Streak <b>' + streak() + '</b>';
    Array.prototype.forEach.call(document.querySelectorAll('#league button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lg') === LG ? 'true' : 'false'); });
    note();
    var tabs = document.querySelectorAll('#tabs button');
    Array.prototype.forEach.call(tabs, function (b) {
      var m = b.getAttribute('data-m');
      b.setAttribute('aria-selected', m === mode ? 'true' : 'false');
      b.className = d[m].done ? 'done' : '';
    });
  }
  function note() {
    var n = $('note');
    n.textContent = 'Pool: ' + P.length + ' current ' + LG.toUpperCase() + ' players (' + (LG === 'nfl' ? 'full rosters incl. practice squads, Nov 2026' : '2026-27 rosters') + ') across ' + ALL_PLACES.length + ' schools and countries. A new set unlocks at local midnight.';
    var rb = document.createElement('button');
    rb.className = 'btn alt'; rb.textContent = 'Reset today'; rb.style.cssText = 'margin-left:8px;padding:4px 10px;font-size:12px';
    rb.onclick = function () { if (run) { clearInterval(run.timer); run = null; } delete S.days[dk()]; day(); save(); render(); };
    n.appendChild(rb);
  }
  function render() { head(); (mode === 'a' ? renderA : mode === 'b' ? renderB : renderC)(); }
  function start() {
    load();
    setLeague(S.lg === 'nfl' ? 'nfl' : 'nba');
    day(); save();
    Array.prototype.forEach.call(document.querySelectorAll('#league button'), function (b) {
      b.onclick = function () {
        var lg = b.getAttribute('data-lg'); if (lg === LG) return;
        if (run) { clearInterval(run.timer); run = null; }
        setLeague(lg); day(); save(); render();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      b.onclick = function () { mode = b.getAttribute('data-m'); render(); };
    });
    render();
  }
  start();
})();

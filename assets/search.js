/* ============================================================
   AniimoData — the front page's search box
   ------------------------------------------------------------
   NOTHING HERE BUILDS TEXT A READER READS. Every string this file
   puts on screen was written by build.js and is already in the page:
   the result rows come out of <template id="search-index">, and the
   three status lines are <p>s that ship in the markup with their own
   translations. Nothing is re-rendered on a language switch either —
   each result carries both languages as .t-en/.t-zh spans and one CSS
   rule decides which shows. That is the same split assets/app.js and
   assets/map.js work under, and it is why there is no dataset here:
   the index is markup, not JSON.

   The box is invisible until this file runs (see .hero-search in
   styles.css). So a build that forgot to publish this file fails in
   the quiet direction — the hero simply looks the way it did before —
   rather than offering a field that swallows what you type.

   This file is only loaded by index.html. Every lookup below returns
   early on any other page, so it is inert there rather than absent.
   ============================================================ */
(function () {
  "use strict";

  var rootEl = document.documentElement;

  function isZh() { return rootEl.getAttribute("data-lang") === "zh"; }

  /* Only for the result counter, which is the one line that is not a
     pair of spans. It reads its two templates off the element, the same
     way the dex counter in app.js does. */
  function pick(en, zh) { return isZh() && zh ? zh : en; }

  var box     = document.querySelector(".hero-search");
  var tpl     = document.getElementById("search-index");
  var input   = document.getElementById("siteSearch");
  var panel   = document.getElementById("searchResults");
  if (!box || !tpl || !input || !panel) return;

  /* No `scopeEl`. The sentence under the box is static markup since
     2026-10-08 — it used to be revealed here whenever the field was empty
     and hidden again on a keystroke, which meant the one line saying what
     this box can search was only legible to a reader who had already
     committed to using it. Nothing toggles it now, so there is nothing to
     look up. The three lines below it in render() are what remains of that
     state machine, and they are all inside the panel. */
  var emptyEl = box.querySelector(".search-empty");
  var countEl = box.querySelector(".search-count");
  var list    = document.getElementById("searchList");
  if (!emptyEl || !countEl || !list) return;

  /* How many results the panel shows before it stops listing and starts
     counting. The index is 259 entries; a one-letter query matches most
     of them, and past a screenful the list stops being a list. */
  var MAX = 8;

  /* ── read the index ──────────────────────────────────────────
     Once, on load. Four badge spans (one per kind) and 259 links.

     `name`, `meta` and `sub` are the lowercased text of the three
     spans, kept separately rather than as one haystack because their
     order matters: a query that names an item should outrank a query
     that only appears somewhere inside a FAQ answer. Each of them
     holds BOTH languages, so a reader who switched to Chinese searches
     Chinese. The badge is deliberately not in any of them — it is the
     one word on the row that is the same for every result of its kind,
     and matching it would make "aniimo" return all 86 species. */
  var ENTRY = [];
  (function () {
    var badges = {};
    Array.prototype.forEach.call(tpl.content.querySelectorAll(".search-kind"), function (b) {
      badges[b.dataset.kind] = b;
    });
    Array.prototype.forEach.call(tpl.content.querySelectorAll(".search-hit"), function (a) {
      var n = a.querySelector(".search-hit-name");
      var m = a.querySelector(".search-hit-meta");
      var s = a.querySelector(".search-hit-sub");
      ENTRY.push({
        el: a,
        badge: badges[a.dataset.kind] || null,
        name: n ? n.textContent.toLowerCase() : "",
        meta: m ? m.textContent.toLowerCase() : "",
        sub: s ? s.textContent.toLowerCase() : ""
      });
    });
  })();

  /* Does `q` appear in `hay` starting a word? Both are already lowercased.
     A Latin character before it means no: "ember" is in "September" but does
     not start anything there, and a query for a species should not come back
     with every answer that happens to mention September.

     Chinese needs no help from this — no CJK character is in the class
     below, so a Chinese query always reads as starting a word, which is the
     right answer for a language that has no spaces. */
  function startsWord(hay, q) {
    var i = hay.indexOf(q);
    while (i > -1) {
      if (i === 0 || !/[0-9a-z]/.test(hay.charAt(i - 1))) return true;
      i = hay.indexOf(q, i + 1);
    }
    return false;
  }

  /* Four tiers, lowest wins. -1 is "no match".
     Names take a plain substring — they are one or two words long, and
     typing a piece of one should find it. The two prose tiers take the word
     test above instead, because they are long and a stray syllable inside a
     longer word is noise, not an answer. */
  function score(e, q) {
    if (e.name.indexOf(q) === 0) return 0;
    if (e.name.indexOf(q) > -1) return 1;
    if (e.meta && startsWord(e.meta, q)) return 2;
    if (e.sub && startsWord(e.sub, q)) return 3;
    return -1;
  }

  /* Ties keep index order, which is the order build.js emits: species by
     dex number, then items, then bosses, then the FAQ by question number.
     So a tie is never arbitrary, and it never reshuffles between two
     keystrokes that match the same set. */
  function rank(q) {
    var out = [];
    for (var i = 0; i < ENTRY.length; i++) {
      var s = score(ENTRY[i], q);
      if (s > -1) out.push({ e: ENTRY[i], s: s, i: i });
    }
    out.sort(function (a, b) { return a.s - b.s || a.i - b.i; });
    return out;
  }

  var shown = [];
  var active = -1;

  function setActive(i) {
    if (active > -1 && shown[active]) shown[active].classList.remove("is-active");
    active = i;
    if (active > -1 && shown[active]) {
      shown[active].classList.add("is-active");
      shown[active].scrollIntoView({ block: "nearest" });
    }
  }

  function render(q) {
    list.innerHTML = "";
    setActive(-1);
    shown = [];

    if (!q) {
      /* Idle: nothing but the box. What it can find is said by the static
         sentence under the field, which is on screen either way. */
      panel.hidden = true;
      emptyEl.hidden = true;
      countEl.hidden = true;
      return;
    }

    var ranked = rank(q);

    /* "No matches" is a panel with one line in it rather than no panel at
       all — a box that quietly does nothing looks like the box is broken. */
    panel.hidden = false;
    emptyEl.hidden = ranked.length > 0;

    ranked.slice(0, MAX).forEach(function (r, i) {
      var a = r.e.el.cloneNode(true);
      a.id = "searchResult" + i;
      /* The badge is written once per kind in the template and cloned
         here, rather than written into all 259 entries. */
      if (r.e.badge) a.insertBefore(r.e.badge.cloneNode(true), a.firstChild);
      list.appendChild(a);
      shown.push(a);
    });

    /* The count is the only line this file writes. {n} is what is listed
       and {total} is what matched, and both templates came off the
       element, so the sentence is still authored in content.js. */
    countEl.hidden = ranked.length <= MAX;
    if (ranked.length > MAX) {
      countEl.textContent = pick(countEl.dataset.all, countEl.dataset.allZh)
        .replace("{n}", String(shown.length))
        .replace("{total}", String(ranked.length));
    }
  }

  /* Everything but the box goes away. Used by Escape and by a click
     outside, and it leaves the query in the field — a reader who closed
     the panel has not asked to lose what they typed. */
  function close() {
    panel.hidden = true;
    setActive(-1);
    emptyEl.hidden = true;
    countEl.hidden = true;
  }

  var timer;
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      render(input.value.trim().toLowerCase());
    }, 120);
  });

  /* Focusing an empty box is the one moment to say what is in there;
     focusing a filled one is a request to see the results again. */
  input.addEventListener("focus", function () {
    var q = input.value.trim().toLowerCase();
    if (!panel.hidden) return;
    render(q);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!shown.length) return;
      setActive(active + 1 >= shown.length ? 0 : active + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!shown.length) return;
      setActive(active - 1 < 0 ? shown.length - 1 : active - 1);
    } else if (e.key === "Enter") {
      /* Most queries answer with exactly one thing, and having to press
         Down first to open it would be a small tax on the common case. */
      var target = active > -1 ? shown[active] : (shown.length === 1 ? shown[0] : null);
      if (target) { e.preventDefault(); target.click(); }
    } else if (e.key === "Escape" || e.key === "Esc") {
      /* Escape closes the panel; a second one clears the field. */
      if (panel.hidden) { input.value = ""; render(""); }
      else close();
    }
  });

  /* A click anywhere else puts the box back the way it was. Clicks on a
     result are inside .hero-search, so they are left alone to navigate. */
  document.addEventListener("click", function (e) {
    if (!box.contains(e.target)) close();
  });

  /* "/" focuses the box, the same shortcut the dex table uses. Skipped
     while something is being typed into, so a slash can still be typed. */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "/") return;
    var t = document.activeElement;
    if (!t) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
    e.preventDefault();
    input.focus();
    input.select();
  });

  /* The result counter is the one string CSS cannot switch, so the
     panel is rebuilt if the language changes while it is open. Nothing
     else here depends on the language. */
  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (panel.hidden) return;
      render(input.value.trim().toLowerCase());
    }).observe(rootEl, { attributes: true, attributeFilter: ["data-lang"] });
  }

  /* Last line: the box only exists from here on. Everything above this
     either ran or returned, so there is no half-wired field. */
  box.classList.add("search-on");
})();

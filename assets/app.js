/* ============================================================
   AniimoData — table interaction + language toggle
   ------------------------------------------------------------
   The table is rendered by build.js, not here. This file only hides
   and shows rows that are already in the HTML, so the full dex is
   present in the page source for anything that doesn't run JS.

   Each row carries its own matching data (data-types / data-role /
   data-tier / data-hay), which is why there is no dataset in here.
   The search blob carries both languages, so a reader who switched to
   Chinese can search in Chinese.

   The table is on all-aniimo.html. It used to be on the homepage, and
   its search box and filters used to be in the homepage hero, which is
   why the file looks up controls by id rather than assuming they sit
   next to the rows — that split is what moved, and this file did not
   have to change to follow it.
   ============================================================ */
(function () {
  "use strict";

  /* ── language ──────────────────────────────────────────────
     This sits ABOVE the `if (!rows.length) return;` guard on purpose.
     Only all-aniimo.html carries the table; the homepage, the species
     pages and the form pages have none, and the toggle has to work on
     all of them.

     Both languages are already in the markup; all this does is change
     which one CSS shows. Nothing is re-rendered, so there is no flash of
     the wrong language on load, and there is no translation table here
     for the copy to drift out of. */
  var LANG_KEY = "aniimo:lang";
  var rootEl = document.documentElement;
  var langListeners = [];

  function isZh() { return rootEl.getAttribute("data-lang") === "zh"; }

  /* For the handful of strings that are re-rendered by script rather than
     switched by CSS — the result counter, and nothing else so far. */
  function pick(en, zh) { return isZh() && zh ? zh : en; }

  function onLangChange(fn) { langListeners.push(fn); }

  function applyLang(zh) {
    if (zh) rootEl.setAttribute("data-lang", "zh");
    else rootEl.removeAttribute("data-lang");
    rootEl.lang = zh ? "zh-CN" : "en";

    /* The toggle is hidden until this class lands, so a browser running
       with scripting off never shows a control that does nothing. It
       cannot be [hidden] — an author `display` rule beats the browser's
       [hidden] rule; see the note in assets/styles.css. */
    rootEl.classList.add("lang-on");

    /* Attribute-backed strings. CSS switches element text, but it cannot
       switch an attribute, so placeholder and aria-label are written
       twice in the markup and copied across here. */
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-en][data-zh]"),
      function (el) {
        var val = el.getAttribute(zh ? "data-zh" : "data-en");
        if (!val) return;
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.placeholder = val;
        if (el.hasAttribute("aria-label")) el.setAttribute("aria-label", val);
      }
    );

    /* One URL, one indexable <title>, and it is the English one — so the
       markup stays English and only the tab is swapped. */
    var enTitle = rootEl.getAttribute("data-title-en");
    var zhTitle = rootEl.getAttribute("data-title-zh");
    if (enTitle && zhTitle) document.title = zh ? zhTitle : enTitle;

    langListeners.forEach(function (fn) { fn(); });
  }

  var toggleEl = document.getElementById("langToggle");
  if (toggleEl) {
    toggleEl.addEventListener("click", function () {
      var zh = !isZh();
      try { localStorage.setItem(LANG_KEY, zh ? "zh" : "en"); } catch (e) { /* private mode */ }
      applyLang(zh);
      toggleEl.focus();
    });
  }

  /* An explicit past choice is honoured; a first visit is not auto-switched
     on navigator.language. The site's canonical language is English — its
     <title>, its meta description and its inbound links all are — so
     guessing Chinese from the browser and landing a reader on a page whose
     address they cannot find again is not a kindness. */
  var stored = null;
  try { stored = localStorage.getItem(LANG_KEY); } catch (e) { /* private mode */ }
  applyLang(stored === "zh");

  /* ── the nav menu ────────────────────────────────────────────
     The grouped nav button opens a menu instead of leaving the page.
     This sits above the table guard below for the same reason the
     language toggle does: the bar is on every page, and only
     all-aniimo.html has the table.

     With scripting off there is nothing here to open a menu, which is
     exactly why the trigger in the markup is still an <a href> — a
     reader without script gets the section's page rather than a control
     that does nothing. The click is only intercepted once this file is
     certain it can replace what it takes away.

     Everything below is on the item, not on the trigger: the menu is a
     child of the item, so the pointer crossing from the button into the
     menu never leaves the item and never closes what it just opened. */
  var navItems = document.querySelectorAll(".nav-item");
  var hasHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;

  function setMenu(item, open) {
    item.classList.toggle("is-open", open);
    var trigger = item.querySelector("[aria-haspopup]");
    if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (navItems.length) {
    /* Turns off the stylesheet's :hover and :focus-within channel. Two
       openers on one element look fine until they disagree: with the
       mouse parked on the button, a menu closed by a click would be
       undone by :hover on the same frame, and Escape would look broken
       for the same reason. Once this class lands, this file is the only
       thing that opens or closes the menu. */
    rootEl.classList.add("nav-on");

    Array.prototype.forEach.call(navItems, function (item) {
      var trigger = item.querySelector("[aria-haspopup]");
      if (!trigger) return;

      /* Hover, preserved by hand on the pointers that have it. A touch
         screen does not have it, and there the click below is the only
         way in and the only way out. */
      if (hasHover) {
        item.addEventListener("mouseenter", function () { setMenu(item, true); });
        item.addEventListener("mouseleave", function () { setMenu(item, false); });
      }

      /* Nothing here opens the menu on focus, and that is deliberate.
         On a touch screen focus arrives between the finger going down
         and the click that ends the tap, so a focus opener would have
         already opened the menu by the time the click decided what to
         do — and the click, reading a menu it had just been handed
         rather than the one the finger found, would close it again.
         Keyboard has Enter instead, which on a link fires a click and
         lands in the handler below; from there Tab walks into the menu.
         The stylesheet keeps :focus-within for the reader without
         scripting, where there is no click to conflict with. */

      /* A click never follows the href once this file is running, and it
         opens the menu when it is closed and closes it when it is open.

         On a pointer with hover, the first click after arriving usually
         closes: the pointer opened the menu on its way to the button, so
         there was nothing left for that click to open. Every click still
         does something visible, and leaving the button reopens nothing
         until the pointer comes back — mouseenter fires on entry, not on
         every move, so a menu closed by a click stays closed under the
         pointer that closed it. */
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        setMenu(item, !item.classList.contains("is-open"));
      });
    });

    /* Escape closes. It works because the :focus-within channel is off:
       the button still has focus, and a stylesheet that reopened on that
       would make this line do nothing visible. */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" && e.key !== "Esc") return;
      Array.prototype.forEach.call(navItems, function (item) { setMenu(item, false); });
    });

    /* Anything outside closes: another click, or a Tab that leaves the
       group. Both are the same question — is the target still inside a
       menu that is open — so both ask it the same way. */
    function closeOthers(e) {
      Array.prototype.forEach.call(navItems, function (item) {
        if (!item.contains(e.target)) setMenu(item, false);
      });
    }
    document.addEventListener("click", closeOthers);
    document.addEventListener("focusin", closeOthers);
  }

  /* ── the dex table ───────────────────────────────────────────
     Everything below is inert on any page without the table. It is scoped
     to #dexBody and not to .row, and that is what keeps it off the front
     page: the front page now carries the first ten rows of the same table,
     as plain rows with no data-hay and no ids of their own, and none of
     them is inside #dexBody. So the early return still fires there, which
     is what the search box, the chips and the counter would otherwise be
     missing as they searched markup that has no filter UI to match. */

  var rows     = Array.prototype.slice.call(document.querySelectorAll("#dexBody .row"));
  var qEl      = document.getElementById("q");
  var countEl  = document.getElementById("count");
  var resetEl  = document.getElementById("reset");
  var emptyEl  = document.getElementById("empty");
  var dexEl    = document.getElementById("dex");

  if (!rows.length) return;

  var TOTAL = rows.length;
  var state = { q: "", types: [], roles: [], tiers: [] };

  /* Split the type list once rather than on every keystroke. */
  rows.forEach(function (r) {
    r._types = (r.dataset.types || "").split(" ").filter(Boolean);
  });

  function matches(row) {
    if (state.q && row.dataset.hay.indexOf(state.q) === -1) return false;
    if (state.types.length && !state.types.some(function (t) { return row._types.indexOf(t) > -1; })) return false;
    if (state.roles.length && state.roles.indexOf(row.dataset.role) === -1) return false;
    if (state.tiers.length && state.tiers.indexOf(row.dataset.tier) === -1) return false;
    return true;
  }

  function update() {
    var shown = 0;
    rows.forEach(function (r) {
      var ok = matches(r);
      r.classList.toggle("is-hidden", !ok);
      if (ok) shown++;
    });

    emptyEl.hidden = shown > 0;

    countEl.textContent = shown === TOTAL
      ? pick(countEl.dataset.all, countEl.dataset.allZh).replace("{n}", TOTAL)
      : pick(countEl.dataset.some, countEl.dataset.someZh)
          .replace("{n}", shown).replace("{total}", TOTAL);

    var active = state.q || state.types.length || state.roles.length || state.tiers.length;
    resetEl.hidden = !active;

    Array.prototype.forEach.call(document.querySelectorAll(".chip[data-key]"), function (btn) {
      var on = state[btn.dataset.key].indexOf(btn.dataset.val) > -1;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  onLangChange(update);

  /* ── filters ── */
  function toggle(key, val) {
    var arr = state[key], i = arr.indexOf(val);
    if (i > -1) arr.splice(i, 1); else arr.push(val);
    update();
  }

  ["elementChips", "roleChips", "tierChips"].forEach(function (id) {
    var box = document.getElementById(id);
    if (!box) return;
    box.addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (btn) toggle(btn.dataset.key, btn.dataset.val);
    });
  });

  var timer;
  qEl.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      state.q = qEl.value.trim().toLowerCase();
      update();
    }, 120);
  });

  resetEl.addEventListener("click", function () {
    state = { q: "", types: [], roles: [], tiers: [] };
    qEl.value = "";
    update();
    qEl.focus();
  });

  /* ── filter presets ──
     Links carry data-preset="<key>:<value>". A preset replaces the
     whole filter set rather than adding to it — predictable, and it
     means one click always lands you in a known state.

     DORMANT since 2026-10-04: the only things that ever carried
     data-preset were the four columns of the all-aniimo.html footer,
     and those went so that every page's footer could match. Nothing on
     the site emits the attribute today, so this finds no link and
     returns — it is kept as the working half of a feature the build's
     verifier still checks for. See the footer note in build.js.

     The listener is only attached when JS is running, so with JS off
     the plain href="#dex" took you to the table instead. */
  document.addEventListener("click", function (e) {
    var link = e.target.closest("[data-preset]");
    if (!link) return;
    e.preventDefault();

    var raw = link.dataset.preset;
    var split = raw.indexOf(":");
    var key = raw.slice(0, split), val = raw.slice(split + 1);

    state = { q: "", types: [], roles: [], tiers: [] };
    qEl.value = "";

    if (key === "q")          { state.q = val.toLowerCase(); qEl.value = val; }
    else if (key === "type")  state.types = [val];
    else if (key === "role")  state.roles = [val];
    else if (key === "tier")  state.tiers = [val];

    update();
    dexEl.scrollIntoView();
  });

  /* "/" focuses the search box */
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      qEl.focus();
    }
  });

  update();
})();

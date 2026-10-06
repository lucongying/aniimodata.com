/* ============================================================
   AniimoData — the interactive map on map.html
   ------------------------------------------------------------
   Leaflet, vendored in vendor/leaflet/, over one image. There is a vendor
   directory now where there wasn't one before; the reason is in that
   directory's own note.

   Leaflet does the geometry, so what is left here is the four things it
   does not know about:

     · WHICH AREAS EXIST. The panel beside the map is plain anchors emitted
       by the build, in both languages, so the page is whole with scripting
       off. This file reads those same anchors for their coordinates —
       `data-x` / `data-y` — and keeps no second copy of the list.

     · WHAT A PIN SAYS. A pin's popup is the area's own card from further
       down this page, cloned. Not a copy of its text: the element. So the
       popup is bilingual for free, because both language spans are already
       inside it, and a species link in a popup works. It cannot drift from
       the list it came from, because it IS the list it came from.

     · SEARCH. A filter over those same rows.

     · THE READER'S OWN MARKERS. The only thing on this page the build did
       not emit, because it is the only thing the build cannot know. They
       live in localStorage and never leave the browser.

   NOTHING HERE BUILDS TEXT A READER READS, with one exception: a marker
   name the reader typed themselves, which is set with `textContent` on the
   way in and on the way out. Everything else is a class name or a clone of
   markup the build already paired in two languages.

   ── gestures ─────────────────────────────────────────────────
   The site's rule is that at 1x the map does not swallow gestures it has
   no use for: the page has to keep scrolling under the reader's thumb and
   under the wheel. Leaflet's defaults are the opposite. Its stylesheet
   puts `touch-action: none` on the container as soon as drag is on, and
   with wheel zoom on, one flick of the wheel over a map that already fills
   its frame zooms it for no reason and traps the reader.

   So: drag is on always, because it means something at every zoom. Wheel
   zoom is off until the reader has zoomed in, clicked the map or tabbed
   into it — the same three ways the hand-written map used. And the
   `touch-action` override at the end of assets/styles.css hands the
   gesture back at 1x; that file loads after Leaflet's sheet on purpose,
   which is what PAGE_HEAD in build.js is for.

   Arrow keys move the view, but only once there is somewhere to move to.
   At 1x the whole map is already on screen, so the arrows are left to the
   page. Same rule as everything else here.
   ============================================================ */
(function () {
  "use strict";

  var stage = document.getElementById("mapStage");
  var host = document.getElementById("mapCanvas");
  var imgEl = document.getElementById("mapImg");
  if (!stage || !host || !imgEl || typeof L === "undefined") return;
  if (!host.clientWidth || !host.clientHeight) return;

  /* ── the space ─────────────────────────────────────────────
     Image pixels of assets/map/world-map.jpg. The <img> the build emits
     carries the size, so this file does not keep a third copy of it beside
     the one in src/view-pages.js and the one in src/map-pins.js — and an
     image swapped for a different one moves the overlay with it.

     Leaflet's CRS.Simple counts y UP from the bottom; the pin table counts
     it DOWN from the top, because that is how anyone reads a coordinate
     off a picture. One sign, flipped once, here. */
  var W = parseInt(imgEl.getAttribute("width"), 10) || imgEl.naturalWidth || 1110;
  var H = parseInt(imgEl.getAttribute("height"), 10) || imgEl.naturalHeight || 874;
  var BOUNDS = [[-H, 0], [0, W]];
  var SRC = imgEl.getAttribute("src");

  var toLatLng = function (x, y) { return [-y, x]; };

  /* ── the map ───────────────────────────────────────────────
     `keyboard: false` because the arrow keys are handled below, once,
     rather than by Leaflet's handler plus ours. `scrollWheelZoom: false`
     for the reason in the header. */
  var map = L.map(host, {
    crs: L.CRS.Simple,
    minZoom: -6,
    maxZoom: 6,
    zoomSnap: 0,
    zoomDelta: 0.5,
    maxBounds: L.latLngBounds([[-H - 40, -40], [40, W + 40]]),
    maxBoundsViscosity: 1,
    attributionControl: false,
    zoomControl: false,
    keyboard: false,
    scrollWheelZoom: false,
    doubleClickZoom: true,
    boxZoom: false
  });

  L.imageOverlay(SRC, BOUNDS).addTo(map);

  /* The reader can zoom out to exactly the whole map and in to MAX_TIMES
     times that, and no further in either direction: further out is grey
     nothing, and further in is a blurry JPEG. Derived from the fit rather
     than written down, because the fit depends on the window, and a phone
     held sideways fits at a different zoom than a desktop. */
  var MAX_TIMES = 5;
  function fitZoom() {
    var z = map.getBoundsZoom(BOUNDS);
    return isFinite(z) ? z : 0;
  }
  function applyZoomRange() {
    map.setMinZoom(fitZoom());
    map.setMaxZoom(fitZoom() + Math.log2(MAX_TIMES));
  }

  applyZoomRange();
  map.setView([-H / 2, W / 2], fitZoom(), { animate: false });

  /* ── chrome ────────────────────────────────────────────────── */
  var scaleEl = document.getElementById("mapScale");
  var btnIn = document.getElementById("mapIn");
  var btnOut = document.getElementById("mapOut");
  var btnReset = document.getElementById("mapReset");

  /* How many times the image's own pixels are being magnified. This is the
     number the reader cares about — "1x" means the map is at its native
     size in the frame, not that some internal zoom variable is zero. */
  function timesNow() { return Math.pow(2, map.getZoom() - fitZoom()); }

  /* Whether the reader is looking at the map rather than past it. Drives
     both the readout and whether a gesture is worth taking. */
  function engaged() {
    return timesNow() > 1.001 || stage.contains(document.activeElement);
  }

  function syncChrome() {
    var t = timesNow();

    /* At 1x the map has nothing to do with a swipe or an arrow key. The
       class is what assets/styles.css hangs the touch-action override on,
       so it is the single switch for all of it — not a display detail. */
    stage.classList.toggle("is-zoomed", t > 1.001);

    if (scaleEl) scaleEl.textContent = (t < 1.05 ? "1" : t.toFixed(1)) + "×";

    /* Wheel zoom, but only for a reader who has arrived: the rest of the
       page keeps its scroll. */
    var want = engaged();
    if (want && !map.scrollWheelZoom.enabled()) map.scrollWheelZoom.enable();
    if (!want && map.scrollWheelZoom.enabled()) map.scrollWheelZoom.disable();
  }

  function zoomBy(times) {
    map.setZoom(map.getZoom() + Math.log2(times));
  }

  function resetView() {
    map.closePopup();
    map.setView([-H / 2, W / 2], fitZoom(), { animate: true, duration: 0.4 });
  }

  var STEP = 1.4;   /* one press of + or − */

  if (btnIn) btnIn.addEventListener("click", function () { zoomBy(STEP); });
  if (btnOut) btnOut.addEventListener("click", function () { zoomBy(1 / STEP); });
  if (btnReset) btnReset.addEventListener("click", resetView);

  map.on("zoom zoomend moveend", syncChrome);
  stage.addEventListener("focusin", syncChrome);
  stage.addEventListener("focusout", syncChrome);

  /* Clicking the map is how a reader says "I am working in here" — which is
     what arms the wheel and what the hint above the map tells them to do.
     It is also how a popup gets dismissed, which is what every map does. */
  map.on("click", function () {
    map.closePopup();
    /* preventScroll: focusing scrolls the element into view, and the reader
       has just aimed at a point on the map — a page that jumps under them
       at that moment has undone the thing they were doing. */
    if (document.activeElement !== stage) stage.focus({ preventScroll: true });
    syncChrome();
  });

  /* Arrow keys move the view; +/- zoom; 0 goes back to the whole map. Only
     once zoomed in, for the reason in the header. */
  var ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  var PAN_PX = 120;

  stage.addEventListener("keydown", function (e) {
    /* The marker-name field lives inside the stage, so its own typing has
       to come through untouched — otherwise naming a spot "0" resets the
       map under the reader's hands. */
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if (e.altKey || e.ctrlKey || e.metaKey || !e.key) return;

    var dir = ARROWS[e.key];
    if (dir) {
      if (timesNow() <= 1.001) return;
      /* Positive pans the view right or down, which is the direction the
         arrow points — the same way a page moves under the scroll wheel. */
      map.panBy([dir[0] * PAN_PX, dir[1] * PAN_PX]);
    } else if (e.key === "+" || e.key === "=") {
      zoomBy(STEP);
    } else if (e.key === "-" || e.key === "_") {
      zoomBy(1 / STEP);
    } else if (e.key === "0") {
      resetView();
    } else {
      return;
    }
    e.preventDefault();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (favPanel && !favPanel.hidden) { closeFavForm(); return; }
    map.closePopup();
  });

  /* ── cloning the page into a popup ─────────────────────────
     `copyChildren` moves the inside of a node without moving the node, so
     a <span> can hold what an <h3> held. Both halves of every pair travel,
     and assets/styles.css decides which one shows — which means a popup
     changes language with the page, because it is the page. */
  function copyChildren(from, to) {
    for (var n = from.firstChild; n; n = n.nextSibling) to.appendChild(n.cloneNode(true));
  }

  /* The label a fav popup's delete button wears. It is on the page, hidden,
     because it is not this file's text — see the header. Returns false if
     the page does not carry it, and the caller then leaves the control out
     rather than showing a button with nothing on it. A control the reader
     cannot read is worse than a control that is not there. */
  function hiddenLabel(id, into) {
    var el = document.getElementById(id);
    if (!el) return false;
    copyChildren(el, into);
    return true;
  }

  function cardFor(key) { return document.getElementById("area-" + key); }

  /* ── the area pins ─────────────────────────────────────────── */
  var picks = document.querySelectorAll(".map-pick[data-area]");
  var pins = {};

  var pinIcon = L.divIcon({
    className: "map-pin-tip",
    html: '<span class="map-pin"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -11]
  });

  function popupFor(key) {
    var tpl = document.getElementById("mapPop");
    var card = cardFor(key);
    if (!tpl || !card) return null;

    var box = tpl.cloneNode(true);
    box.removeAttribute("hidden");

    /* The template's ids come off the copy. A copy that keeps them is how
       one id ends up on two elements, which is a bug the build checks for
       in the emitted markup and cannot see here. */
    var tagged = box.querySelectorAll("[id]");
    for (var i = 0; i < tagged.length; i++) tagged[i].removeAttribute("id");

    var title = box.querySelector(".map-pop-title");
    var name = card.querySelector(".area-name");
    if (title && name) copyChildren(name, title);

    var count = card.querySelector(".area-count");
    if (title && count) title.appendChild(count.cloneNode(true));

    var list = box.querySelector(".map-pop-list");
    var rows = card.querySelectorAll(".area-entry");
    if (list) {
      for (var j = 0; j < rows.length; j++) {
        var li = document.createElement("li");
        li.className = "map-pop-row";
        li.appendChild(rows[j].cloneNode(true));
        list.appendChild(li);
      }
    }

    return box;
  }

  /* Both halves of "which area is the reader looking at" — the row in the
     panel and the pin on the map — because they are two views of one
     selection and a highlight on one of them is a highlight the reader has
     to go looking for. */
  function markPicked(key) {
    for (var i = 0; i < picks.length; i++) {
      picks[i].classList.toggle("is-on", picks[i].getAttribute("data-area") === key);
    }
    for (var k in pins) {
      if (!Object.prototype.hasOwnProperty.call(pins, k)) continue;
      var el = pins[k].getElement();
      if (el && el.classList) el.classList.toggle("is-on", k === key);
    }
  }

  /* "Go and look at this point", written once, so the pin list, the search
     results and the reader's own markers all behave the same way. The zoom
     has a floor of 2x whatever the fit is, because a popup the size of a
     third of the viewport over a map that is also the size of the viewport
     tells the reader nothing about where they just went.

     `after` waits for the move to finish. Opening a popup first would run
     its own autoPan — which measures where things are right now — against
     a map still in flight, and the two animations would pull the same map
     in different directions for the length of the trip. */
  function flyTo(latlng, after) {
    var z = Math.max(map.getZoom(), fitZoom() + 1);
    if (Math.abs(map.getZoom() - z) < 0.01 && map.getCenter().equals(latlng, 1e-6)) {
      after();
      return;
    }
    map.once("moveend", after);
    map.setView(latlng, z, { animate: true, duration: 0.4 });
  }

  function goTo(key) {
    var m = pins[key];
    if (!m) return false;
    markPicked(key);
    flyTo(m.getLatLng(), function () { m.openPopup(); });
    return true;
  }

  for (var p = 0; p < picks.length; p++) {
    (function (a) {
      var key = a.getAttribute("data-area");
      var x = parseFloat(a.getAttribute("data-x"));
      var y = parseFloat(a.getAttribute("data-y"));
      var card = cardFor(key);
      if (!isFinite(x) || !isFinite(y) || !card) return;

      /* `keyboard: false`: a pin is a divIcon, and the keyboard path to an
         area is the list in the panel, which is real anchors with real
         names in both languages. Making these focusable too would add
         sixteen tab stops that duplicate sixteen others. */
      var m = L.marker(toLatLng(x, y), { icon: pinIcon, keyboard: false, riseOnHover: true });
      m.addTo(map);

      var pop = popupFor(key);
      if (pop) {
        m.bindPopup(pop, {
          className: "map-pop-wrap",
          maxWidth: 320,
          minWidth: 240,
          closeButton: true,
          autoPan: true,
          offset: [0, -12]
        });
        /* So popupopen can put the highlight in the list without a second
           lookup table. */
        m.getPopup().areaKey = key;
      }

      /* A hovered pin names itself, in whichever language is showing —
         another clone, so it costs nothing and needs no pairing here. */
      var tip = document.createElement("span");
      tip.className = "map-tip";
      copyChildren(card.querySelector(".area-name") || card, tip);
      m.bindTooltip(tip, {
        className: "map-tip-box", direction: "top", offset: [0, -10], opacity: 1
      });

      m.on("click", function () { markPicked(key); });
      pins[key] = m;
    })(picks[p]);
  }

  map.on("popupopen", function (e) {
    var key = (e.popup && e.popup.areaKey) || null;
    if (key) markPicked(key);
  });
  map.on("popupclose", function () { markPicked(null); });

  /* `preventDefault` only where a pin exists, so with scripting half-broken
     the anchor still jumps to the card rather than doing nothing. */
  for (var q = 0; q < picks.length; q++) {
    picks[q].addEventListener("click", function (e) {
      if (goTo(this.getAttribute("data-area"))) e.preventDefault();
    });
  }

  /* ── search ──────────────────────────────────────────────────
     A filter over rows already on the page, and the haystack is each row's
     own `textContent`. That reads BOTH languages, because the hidden one is
     hidden with `display: none` and still has text — which is exactly right
     here: 小炭犬 finds the row while the page is in English, and Emberpup
     finds it while the page is in Chinese. Neither name had to be written
     down in this file for that to work, and neither can go stale. */
  var qEl = document.getElementById("mapQ");
  var qClear = document.getElementById("mapQX");
  var results = document.getElementById("mapResults");
  var emptyRow = document.getElementById("mapEmpty");
  var searchBox = document.querySelector(".map-search");
  var MAX_RESULTS = 40;

  var index = [];
  if (results) {
    var cards = document.querySelectorAll(".area-card[id^='area-']");
    for (var c = 0; c < cards.length; c++) {
      (function (card) {
        var name = card.querySelector(".area-name");
        var rows = card.querySelectorAll(".area-entry");
        var entries = [];
        for (var r = 0; r < rows.length; r++) {
          entries.push({ el: rows[r], text: rows[r].textContent.toLowerCase() });
        }
        index.push({
          key: card.id.slice(5),
          name: name,
          text: name ? name.textContent.toLowerCase() : "",
          rows: entries
        });
      })(cards[c]);
    }
  }

  /* An <a> inside an <a> is not markup the parser keeps, and a species link
     inside a result that already goes somewhere would be a second answer to
     one click. The clone loses its link and keeps its words. */
  function unlink(node) {
    var as = node.querySelectorAll("a");
    for (var i = 0; i < as.length; i++) {
      var a = as[i];
      while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a);
      a.parentNode.removeChild(a);
    }
    return node;
  }

  function resultRow(area, entryEl) {
    var li = document.createElement("li");
    var link = document.createElement("a");
    link.className = "map-result";
    link.setAttribute("href", "#area-" + area.key);
    link.setAttribute("data-area", area.key);

    var main = document.createElement("span");
    main.className = "map-result-main";
    if (entryEl) {
      main.appendChild(unlink(entryEl.cloneNode(true)));
    } else if (area.name) {
      copyChildren(area.name, main);
    }
    link.appendChild(main);

    /* Which area a row belongs to, shown only when the row is a species —
       an area-name hit is already the name of an area. */
    if (entryEl && area.name) {
      var where = document.createElement("span");
      where.className = "map-result-where";
      copyChildren(area.name, where);
      link.appendChild(where);
    }

    li.appendChild(link);
    return li;
  }

  function runSearch(term) {
    if (!results) return;
    var needle = term.replace(/^\s+|\s+$/g, "").toLowerCase();

    /* Everything except the "nothing matches" row, which is markup the build
       emitted and this file only ever un-hides. Removing the `.map-result`
       anchors instead would leave one empty <li> per result behind on every
       keystroke — a list that grows by its own history. */
    for (var i = results.childNodes.length - 1; i >= 0; i--) {
      if (results.childNodes[i] !== emptyRow) results.removeChild(results.childNodes[i]);
    }

    if (!needle) {
      results.hidden = true;
      return;
    }

    var out = [];
    for (var a = 0; a < index.length && out.length < MAX_RESULTS; a++) {
      var area = index[a];
      /* The area's own name first, so the sixteen are reachable by typing
         one — then its rows. */
      if (area.text.indexOf(needle) !== -1) out.push(resultRow(area, null));
      for (var r = 0; r < area.rows.length && out.length < MAX_RESULTS; r++) {
        if (area.rows[r].text.indexOf(needle) !== -1) out.push(resultRow(area, area.rows[r].el));
      }
    }

    for (var k = 0; k < out.length; k++) results.appendChild(out[k]);
    results.hidden = false;
    if (emptyRow) emptyRow.hidden = out.length > 0;
  }

  function clearSearch() {
    if (qEl) qEl.value = "";
    if (qClear) qClear.hidden = true;
    if (results) results.hidden = true;
  }

  if (qEl) {
    qEl.addEventListener("input", function () {
      runSearch(qEl.value);
      if (qClear) qClear.hidden = !qEl.value;
    });
    qEl.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { clearSearch(); qEl.blur(); return; }
      if (e.key !== "Enter") return;
      var first = results && results.querySelector(".map-result");
      if (!first) return;
      e.preventDefault();
      if (goTo(first.getAttribute("data-area"))) clearSearch();
    });
  }
  if (qClear) {
    qClear.addEventListener("click", function () {
      clearSearch();
      if (qEl) qEl.focus();
    });
  }

  /* Clicking anywhere outside the search closes the list but keeps what was
     typed, so tabbing away and back does not lose the reader's query. */
  document.addEventListener("click", function (e) {
    if (results && !results.hidden && searchBox && !searchBox.contains(e.target)) {
      results.hidden = true;
    }
  });
  if (results) {
    /* Delegated, because the rows are replaced on every keystroke and
       binding each one would be binding a node that is about to be thrown
       away. Walks up rather than using `closest` — this file is written for
       the browsers that can run the rest of the site, and that walk is four
       lines. */
    results.addEventListener("click", function (e) {
      var node = e.target;
      while (node && node !== results && !(node.classList &&
             node.classList.contains("map-result"))) {
        node = node.parentNode;
      }
      if (!node || node === results) return;
      e.preventDefault();
      if (goTo(node.getAttribute("data-area"))) clearSearch();
    });
  }

  /* ── the reader's own markers ────────────────────────────────
     The only state on this page that outlives the tab. It is kept in
     localStorage and nowhere else — no request, no account, nothing to
     delete on a server because nothing was ever sent to one.

     Every access is wrapped, because the read itself can throw rather than
     return null: a browser with storage switched off, and Chrome on a
     file:// URL, both raise a SecurityError on the property access. A map
     that stops working because a reader has cookies blocked is worse than
     a map that forgets. */
  var STORE = "aniimo:map-pins";
  var favPanel = document.getElementById("mapFav");
  var favGrid = document.getElementById("mapFavGrid");
  var favInput = document.getElementById("mapFavInput");
  var favSave = document.getElementById("mapFavSave");
  var favCancel = document.getElementById("mapFavCancel");
  var favList = document.getElementById("mapFavList");

  /* Language-neutral, so the one list of strings on this page that does not
     need a Chinese twin. */
  var EMOJI = ["⭐", "📍", "🎯", "🏠",
    "🌿", "💎", "🔥", "❄️",
    "🌙", "🐾"];

  function loadFavs() {
    try {
      var list = JSON.parse(window.localStorage.getItem(STORE) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function saveFavs() {
    try { window.localStorage.setItem(STORE, JSON.stringify(favs)); } catch (err) { /* full, or off */ }
  }

  var favs = loadFavs();
  var favPins = [];
  var pending = null;

  function favIcon() {
    return L.divIcon({
      className: "map-fav-tip",
      html: '<span class="map-fav-pin"></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -12]
    });
  }

  function removeFav(id) {
    favs = favs.filter(function (f) { return f.id !== id; });
    saveFavs();
    paintFavs();
  }

  function paintFavs() {
    var i;
    for (i = 0; i < favPins.length; i++) map.removeLayer(favPins[i]);
    favPins = [];
    if (favList) favList.innerHTML = "";

    for (i = 0; i < favs.length; i++) {
      (function (f) {
        var m = L.marker(toLatLng(f.x, f.y), { icon: favIcon(), keyboard: false, zIndexOffset: 400 });
        m.addTo(map);

        /* The emoji goes in as text, not as markup. It comes off a list this
           file owns either way, but a string that is inserted as HTML is a
           string that is one edit away from being inserted wrongly, and
           there is nothing here that needs HTML. */
        var dot = m.getElement().querySelector(".map-fav-pin");
        if (dot) dot.textContent = f.emoji;

        var box = document.createElement("div");
        box.className = "map-fav-pop";
        var h = document.createElement("p");
        h.className = "map-pop-title";
        h.textContent = f.name;
        box.appendChild(h);

        var del = document.createElement("button");
        del.type = "button";
        del.className = "map-fav-del";
        if (hiddenLabel("mapFavDelLabel", del)) {
          del.addEventListener("click", function () { removeFav(f.id); });
          box.appendChild(del);
        }

        m.bindPopup(box, {
          className: "map-pop-wrap", maxWidth: 260, minWidth: 180, offset: [0, -12]
        });
        m.on("click", function () { markPicked(null); });
        favPins.push(m);

        if (!favList) return;
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "map-fav-item";
        var mark = document.createElement("span");
        mark.className = "map-fav-item-dot";
        mark.textContent = f.emoji;
        var label = document.createElement("span");
        label.className = "map-fav-item-name";
        label.textContent = f.name;
        btn.appendChild(mark);
        btn.appendChild(label);
        btn.addEventListener("click", function () {
          flyTo(m.getLatLng(), function () { m.openPopup(); });
        });
        li.appendChild(btn);
        favList.appendChild(li);
      })(favs[i]);
    }
  }

  function paintEmoji() {
    if (!favGrid || !pending) return;
    favGrid.innerHTML = "";
    for (var i = 0; i < EMOJI.length; i++) {
      (function (ch) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "map-fav-emoji";
        b.textContent = ch;
        /* aria-pressed rather than a class, which is how the rest of the
           site marks a chosen chip — see .chip in assets/styles.css. */
        b.setAttribute("aria-pressed", pending.emoji === ch ? "true" : "false");
        b.addEventListener("click", function () { pending.emoji = ch; paintEmoji(); });
        favGrid.appendChild(b);
      })(EMOJI[i]);
    }
  }

  function openFavForm(x, y) {
    if (!favPanel) return;
    pending = { x: x, y: y, emoji: EMOJI[0] };
    if (favInput) favInput.value = "";
    paintEmoji();
    favPanel.hidden = false;
    if (favInput) favInput.focus();
  }

  function closeFavForm() {
    pending = null;
    if (favPanel) favPanel.hidden = true;
  }

  function saveFav() {
    if (!pending) return;
    var typed = favInput ? favInput.value.replace(/^\s+|\s+$/g, "") : "";
    var name = typed;
    if (!name) {
      /* No name typed. The label the page already carries says what an
         unnamed one is called, rather than this file inventing one. */
      var fallback = document.getElementById("mapFavDefaultLabel");
      name = fallback ? fallback.textContent : EMOJI[0];
    }
    favs.push({
      id: "m" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      x: pending.x, y: pending.y, emoji: pending.emoji, name: name
    });
    saveFavs();
    paintFavs();
    closeFavForm();
  }

  if (favSave) favSave.addEventListener("click", saveFav);
  if (favCancel) favCancel.addEventListener("click", closeFavForm);
  if (favInput) {
    favInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); saveFav(); }
    });
  }

  /* Right-click. `map.mouseEventToLatLng` is the only correct way to turn a
     point in the window into a point in the image — it accounts for the
     panes' transform and the container's own offset, which a hand-rolled
     getBoundingClientRect calculation gets subtly wrong on a scrolled page. */
  host.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    var p = map.mouseEventToLatLng(e);
    openFavForm(p.lng, -p.lat);
  });

  /* A phone has no right-click, so a press held still for half a second is
     the gesture every map on it uses. Movement cancels: a reader dragging
     the map has not asked for anything. */
  var LONG_PRESS = 500;
  var pressTimer = null, pressAt = null;

  function cancelPress() {
    if (pressTimer) window.clearTimeout(pressTimer);
    pressTimer = null;
    pressAt = null;
  }

  host.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) { cancelPress(); return; }
    pressAt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    pressTimer = window.setTimeout(function () {
      pressTimer = null;
      var rect = host.getBoundingClientRect();
      var p = map.containerPointToLatLng([pressAt.x - rect.left, pressAt.y - rect.top]);
      openFavForm(p.lng, -p.lat);
    }, LONG_PRESS);
  }, { passive: true });

  host.addEventListener("touchmove", function (e) {
    if (!pressAt || !e.touches.length) return;
    if (Math.abs(e.touches[0].clientX - pressAt.x) > 12 ||
        Math.abs(e.touches[0].clientY - pressAt.y) > 12) cancelPress();
  }, { passive: true });

  host.addEventListener("touchend", cancelPress, { passive: true });
  host.addEventListener("touchcancel", cancelPress, { passive: true });

  paintFavs();
  syncChrome();

  /* ── the window changing size ────────────────────────────────
     `fit` is a property of the frame, so every resize changes what 1x
     means. A reader at 1x has asked for the whole map and gets the whole
     map at the new size; a reader at 3x has asked for a place, so their
     magnification is carried across to the new fit rather than reset. */
  var rTimer = null;
  window.addEventListener("resize", function () {
    if (rTimer) window.clearTimeout(rTimer);
    rTimer = window.setTimeout(function () {
      rTimer = null;
      var keep = timesNow();
      map.invalidateSize({ animate: false });
      applyZoomRange();
      if (keep <= 1.001) map.setView([-H / 2, W / 2], fitZoom(), { animate: false });
      else map.setZoom(fitZoom() + Math.log2(keep));
      syncChrome();
    }, 150);
  });

  /* The first layout can settle after this file runs — a webfont arriving
     changes the height of everything above the map. One correction, once. */
  window.addEventListener("load", function () {
    map.invalidateSize({ animate: false });
    applyZoomRange();
    syncChrome();
  });
})();

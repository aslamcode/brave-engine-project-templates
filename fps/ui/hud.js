// The HUD page of the FPS kit. The game side is the `Hud` service (assets/services/hud.service.ts): its `state` is read once (a Signal delivers changes, not state, so a page that loads late would
// show placeholders), then `onChange` keeps it fresh; `onHit` and `onDamaged` are events. A plain script: `BraveUiBridge` is a global because vendor/ui-bridge.global.js is loaded before this file.
BraveUiBridge.enablePointerBridging();
var hud = BraveUiBridge.remote('Hud');

// The words of the page. The language is the game's, read from the same entries the game reads (`BraveUiBridge.Translate`): a text that comes from the game and holds {{ key }} (a pickup's name, a journal
// entry) is resolved here, so the HUD follows the language by itself; a label of this page that has an entry in the language files (assets/languages) takes its words, and one that has none (a project that took
// the files out) stays as it is written here, in English. Static labels are marked in index.html with data-translate and need nothing in this file.
var T = BraveUiBridge.Translate;
function tr(text) { return typeof text === 'string' && text.indexOf('{{') !== -1 ? T.resolve(text) : text; }
function word(path, fallback, params) { return T.has(path) ? T.get(path, params) : fallback; }
// A name that starts a line of its own (a notice of what was picked up) starts with a capital, in whatever language it was said: the game cannot capitalize it, it only has the key (`{{ items.key.name }}`).
function capital(text) { var said = tr(text); return typeof said === 'string' ? said.charAt(0).toUpperCase() + said.slice(1) : said; }
var redraw = [];   // what to draw again when the language changes (each part adds its own)
T.onChange.on(function () { redraw.forEach(function (draw) { draw(); }); });

var el = function (id) { return document.getElementById(id); };
var crosshair = el('crosshair'), prompt = el('prompt'), promptText = el('promptText'), promptCaption = el('promptCaption'), promptTitle = el('promptTitle'), promptBody = el('promptBody'), message = el('message'), damage = el('damage'), hitmarker = el('hitmarker');
var healthFill = el('healthFill'), healthText = el('healthText'), ammo = el('ammo'), reserve = el('reserve'), stance = el('stance'), noticesEl = el('notices'), weapons = el('weapons');
var staminaBox = el('stamina'), staminaFill = el('staminaFill'), staminaMark = el('staminaMark');
var markersEl = el('markers'), markerNodes = {};
var hitTimer, damageTimer, indicatorTimer, indicator = el('indicator');

var lastState = null;
function render(state) {
  lastState = state;
  // The text stays while the prompt fades out, so that the key chip is never left alone on the screen. What the thing looked at says about itself (its title and its text) is over the line and stays with it.
  // A thing that only describes itself (a painting: no prompt, a caption) is the same card without the line of E (`-caption-only`; it is set where the text is, so that it does not change while the card fades out).
  var captioned = !!(state.captionTitle || state.captionBody);
  if (state.prompt !== '' || captioned) {
    promptText.textContent = tr(state.prompt);
    promptTitle.textContent = tr(state.captionTitle || '');
    promptBody.textContent = tr(state.captionBody || '');
    promptCaption.classList.toggle('-show', captioned);
    prompt.classList.toggle('-caption-only', state.prompt === '');
  }
  prompt.classList.toggle('-show', state.prompt !== '' || captioned);
  message.textContent = tr(state.message);
  message.classList.toggle('-show', state.message !== '');

  var share = state.maxHealth > 0 ? Math.max(0, Math.min(1, state.health / state.maxHealth)) : 0;
  healthFill.style.width = (share * 100) + '%';
  healthFill.classList.toggle('-low', share < 0.3);
  healthText.textContent = Math.max(0, Math.round(state.health));

  // The stamina of the run: the bar only while it matters, red and with the mark of where the run comes back while the player is out of breath.
  staminaFill.style.width = (Math.max(0, Math.min(1, state.stamina)) * 100) + '%';
  staminaMark.style.left = (Math.max(0, Math.min(1, state.staminaResume)) * 100) + '%';
  staminaBox.classList.toggle('-show', !!state.staminaShown);
  staminaBox.classList.toggle('-exhausted', !!state.staminaExhausted);

  ammo.textContent = state.ammo;
  ammo.classList.toggle('-empty', state.magazine > 0 && state.ammo === 0);
  reserve.textContent = state.reserve;
  // A reserve below zero is a gear that is only counted (a grenade, a medkit): the count alone, with no magazine and no slash.
  ammo.parentNode.classList.toggle('-single', state.reserve < 0);
  stance.textContent = state.stance === 'alert' ? word('hud.stance.alert', 'Alert') : word('hud.stance.relaxed', 'Relaxed');
  crosshair.classList.toggle('-alert', state.stance === 'alert');
  crosshair.classList.toggle('-target', !!state.target);
  crosshair.classList.toggle('-arcs', state.crosshair === 'arcs');
  crosshair.classList.toggle('-twin-arcs', state.crosshair === 'twin-arcs');
  crosshair.classList.toggle('-aiming', !!state.aiming);
  // The cone of the weapon on this window: a share of half the height, in pixels. The ticks and the arcs open by it.
  crosshair.style.setProperty('--spread', (state.spread * window.innerHeight / 2).toFixed(1) + 'px');
  if (state.crosshair === 'twin-arcs') drawTwinArcs(Math.min(90, Math.max(18, state.spread * window.innerHeight / 2)));

  // The weapons the player carries: the number of the key and the name, the one in hand lit.
  weapons.innerHTML = '';
  (state.weapons || []).forEach(function (name, index) {
    var chip = document.createElement('span');
    chip.className = 'weapons__chip' + (index === state.weapon ? ' -current' : '');
    chip.textContent = (index + 1) + ' ' + tr(name);
    weapons.appendChild(chip);
  });

  renderNotices(state);
}

// What was picked up or spent: a notice at the corner for a few seconds (`+ Key`, `-2 Grenade`), one for each kind (a second key a moment later makes it `+2 Key`, in the same notice), three at most (a fourth
// pushes the oldest out). The game says them in `state.notices`, each with a number that only grows: the page draws the ones after the last it drew, so none is lost between two readings and none is drawn twice.
// The notices from before the page came are not news. What the player carries is not on the screen as a list (it grew with the game and ran under the weapons panel): the Journal has it, under Items. They
// move like the lines of the subtitles: the one that comes fades in, the one that goes fades out alone, and the ones that stay glide to their new place.
var NOTICE_MAX = 3, NOTICE_FADE_MS = 300, noticeNodes = [], lastNoticeSeq = null;

function noticeText(node) {
  var amount = Math.abs(node.delta);
  return (node.delta > 0 ? '+' : '\u2212') + (amount > 1 ? amount + ' ' : ' ') + capital(node.name);
}

// Runs `change` (it adds, takes away or marks notices) and glides every notice that was there and is somewhere else now: from where it was seen to where it is.
function glideNotices(change) {
  var was = noticeNodes.map(function (node) { return { root: node.root, top: node.root.getBoundingClientRect().top }; });
  was.forEach(function (line) { line.root.style.transition = 'none'; line.root.style.transform = ''; });
  change();
  var moving = [];
  was.forEach(function (line) {
    if (!line.root.parentNode) return;
    var delta = line.top - line.root.getBoundingClientRect().top;
    if (Math.abs(delta) < 0.5) { line.root.style.transition = ''; return; }
    line.root.style.transform = 'translateY(' + delta + 'px)';
    moving.push(line.root);
  });
  if (moving.length) {
    void noticesEl.offsetHeight;
    moving.forEach(function (root) { root.style.transition = ''; root.style.transform = ''; });
  }
}

function dropNotice(node) {
  clearTimeout(node.timer);
  var place = noticeNodes.indexOf(node);
  if (place >= 0) noticeNodes.splice(place, 1);
  if (node.root.parentNode) noticesEl.removeChild(node.root);
}

// The notice goes: it fades where it is and is taken away when the fade is over (at once with reduced motion).
function leaveNotice(node) {
  if (node.leaving) return;
  node.leaving = true;
  clearTimeout(node.timer);
  if (reducedMotion.matches) { glideNotices(function () { dropNotice(node); }); return; }
  node.root.classList.add('-leaving');
  node.timer = setTimeout(function () { glideNotices(function () { dropNotice(node); }); }, NOTICE_FADE_MS);
}

function showNotice(notice, seconds) {
  var node = noticeNodes.filter(function (other) { return !other.leaving && other.id === notice.id && (other.delta > 0) === (notice.delta > 0); })[0];
  glideNotices(function () {
    if (node) {
      node.delta += notice.delta;
      node.name = notice.name;
      node.root.textContent = noticeText(node);
      node.root.classList.remove('-bump');
      void node.root.offsetWidth;
      node.root.classList.add('-bump');
      return;
    }

    var root = document.createElement('div');
    root.className = 'notice' + (notice.delta < 0 ? ' -spent' : '');
    node = { root: root, id: notice.id, name: notice.name, delta: notice.delta, leaving: false, timer: 0 };
    root.textContent = noticeText(node);
    noticesEl.appendChild(root);
    noticeNodes.push(node);
    var staying = noticeNodes.filter(function (other) { return !other.leaving; });
    while (staying.length > NOTICE_MAX) leaveNotice(staying.shift());
  });
  clearTimeout(node.timer);
  if (seconds > 0) node.timer = setTimeout(function () { leaveNotice(node); }, seconds * 1000);
}

function renderNotices(state) {
  var notices = state.notices || [], newest = notices.length ? notices[notices.length - 1].seq : 0;
  var seconds = typeof state.itemsSeconds === 'number' ? state.itemsSeconds : 4;
  if (lastNoticeSeq === null) { lastNoticeSeq = newest; return; }
  if (newest < lastNoticeSeq) lastNoticeSeq = 0;
  notices.filter(function (notice) { return notice.seq > lastNoticeSeq; }).forEach(function (notice) { showNotice(notice, seconds); });
  lastNoticeSeq = Math.max(lastNoticeSeq, newest);
}

// The twin arcs, drawn for the right side (the left one is the same mirrored by the markup): one hairline arc at the radius of the cone, the edge of where the pellets may land. The path is set as the CSS
// property `d`, so that it glides when the cone opens or closes.
var strokes = [].slice.call(document.querySelectorAll('.crosshair__stroke')), lastRadius = -1;
function arcPoint(radius, degrees) { var angle = degrees * Math.PI / 180; return (radius * Math.cos(angle)).toFixed(1) + ' ' + (radius * Math.sin(angle)).toFixed(1); }
function arcPath(radius, half) { return 'M ' + arcPoint(radius, -half) + ' A ' + radius.toFixed(1) + ' ' + radius.toFixed(1) + ' 0 0 1 ' + arcPoint(radius, half); }
function drawTwinArcs(radius) {
  if (Math.abs(radius - lastRadius) < 0.05) return;
  lastRadius = radius;
  var path = "path('" + arcPath(radius, 38) + "')";
  strokes.forEach(function (stroke) { stroke.style.setProperty('d', path); });
}

hud.state().then(render);
hud.onChange.on(render, { sampleEvery: 50 });
redraw.push(function () {
  if (lastState) render(lastState);
  // The notices on the screen keep their place, so only the words are set again.
  noticeNodes.forEach(function (node) { node.root.textContent = noticeText(node); });
});

hud.onHit.on(function (hit) {
  hitmarker.classList.toggle('-kill', !!hit.kill);
  hitmarker.classList.add('-show');
  clearTimeout(hitTimer);
  hitTimer = setTimeout(function () { hitmarker.classList.remove('-show'); }, 90);
}, { sampleEvery: 0 });

hud.onDamaged.on(function (event) {
  // The mark of the side it came from: the ring turned by the angle (positive: to the right), shown and let go.
  if (event && typeof event.angle === 'number') {
    indicator.style.transform = 'rotate(' + event.angle + 'deg)';
    indicator.classList.add('-show');
    clearTimeout(indicatorTimer);
    indicatorTimer = setTimeout(function () { indicator.classList.remove('-show'); }, 120);
  }
  damage.classList.add('-hit');
  clearTimeout(damageTimer);
  damageTimer = setTimeout(function () { damage.classList.remove('-hit'); }, 60);
}, { sampleEvery: 0 });

// The things that can be used, over them on the screen. Every frame they move there is a list: one element for each id is kept (made when it first comes, taken out when it goes), moved by a transform. The one
// looked at (`focused`) shows a glass box with what E does, tied to the thing by a line when its marker is `line`; the others are a small mark, and the one of them nearest to where the player looks says the name of its
// thing next to it (`peek`). While a box says what E does, the line under the crosshair is hidden.
function makeMarker() {
  var root = document.createElement('div');
  root.className = 'marker';
  root.innerHTML = '<div class="marker__line"></div><div class="marker__box"><div class="caption"><div class="caption__title"></div><div class="caption__body"></div></div><div class="marker__row"><span class="marker__key">E</span><span class="marker__text"></span></div></div><div class="marker__dot"></div><div class="marker__peek"></div>';
  markersEl.appendChild(root);
  return { root: root, box: root.querySelector('.marker__box'), text: root.querySelector('.marker__text'), peek: root.querySelector('.marker__peek'), caption: root.querySelector('.caption'), title: root.querySelector('.caption__title'), body: root.querySelector('.caption__body') };
}

// Where a marker is drawn is worked out on every frame the screen draws, not only when a reading arrives. A reading comes from the game through the Bridge on a timer of its own (16 ms), which is not the screen's
// (60, 120, 144 Hz): a label put where the last reading says moves in uneven steps (two frames with the same place, then a double step) and trembles when the camera turns. The game stamps each reading with the time
// of its frame (`at`), so the page knows how fast the marker moves (the last two readings) and carries it on from the last reading to the frame being drawn: `markerAt()`. The motion is only carried on for a few
// frames (MARKER_LEAD_MAX) and fades if nothing new comes; a jump (a cut, a teleport) is not a motion.
var MARKER_LEAD_MAX = 48, MARKER_STALE = 120, MARKER_JUMP = 0.25, markerLoop = 0;
function clockNow() { return performance.timeOrigin + performance.now(); }

function markerAt(node, now) {
  var a = node.last, b = node.before;
  if (!b) return a;
  var span = a.at - b.at, dx = a.x - b.x, dy = a.y - b.y, ahead = now - a.at;
  if (!(span > 0) || span > MARKER_STALE || !(ahead > 0) || Math.abs(dx) > MARKER_JUMP || Math.abs(dy) > MARKER_JUMP) return a;
  var lead = Math.min(ahead, MARKER_LEAD_MAX) * (ahead < MARKER_STALE ? 1 : Math.max(0, 1 - (ahead - MARKER_STALE) / 150));
  return { x: a.x + dx * lead / span, y: a.y + dy * lead / span };
}

function placeMarker(node, now) {
  var at = markerAt(node, now);
  node.root.style.transform = 'translate(' + (at.x * window.innerWidth).toFixed(1) + 'px,' + (at.y * window.innerHeight).toFixed(1) + 'px)';
}

function moveMarkers() {
  markerLoop = 0;
  var ids = Object.keys(markerNodes);
  if (!ids.length) return;
  var now = clockNow();
  ids.forEach(function (id) { placeMarker(markerNodes[id], now); });
  markerLoop = requestAnimationFrame(moveMarkers);
}

var lastMarkers = null;
function renderMarkers(list) {
  lastMarkers = list;
  var width = window.innerWidth, height = window.innerHeight, seen = {}, boxShown = false;
  list.forEach(function (m) {
    var node = markerNodes[m.id] || (markerNodes[m.id] = makeMarker());
    var x = m.x * width, y = m.y * height;
    seen[m.id] = true;
    var reading = { x: m.x, y: m.y, at: typeof m.at === 'number' ? m.at : clockNow() };
    if (!node.last || reading.at > node.last.at) { node.before = node.last; node.last = reading; }
    placeMarker(node, clockNow());
    node.root.classList.toggle('-focused', m.focused);
    node.root.classList.toggle('-line', m.focused && m.line);
    node.root.classList.toggle('-below', y < 150);
    node.root.classList.toggle('-peek', !m.focused && m.peek !== '');
    node.root.classList.toggle('-left', x > width - 220);
    var promptWords = tr(m.prompt), peekWords = tr(m.peek);
    if (m.focused && node.text.textContent !== promptWords) node.text.textContent = promptWords;
    if (!m.focused && node.peek.textContent !== peekWords) node.peek.textContent = peekWords;
    // What it says about itself, over what E does: the box of the one looked at.
    var titleWords = m.focused ? tr(m.title || '') : '', bodyWords = m.focused ? tr(m.body || '') : '';
    if (node.title.textContent !== titleWords) node.title.textContent = titleWords;
    if (node.body.textContent !== bodyWords) node.body.textContent = bodyWords;
    node.caption.classList.toggle('-show', titleWords !== '' || bodyWords !== '');
    // The box stays on the screen sideways: it is the box that is moved, never the point it is tied to.
    node.box.style.setProperty('--shift', (Math.max(0, 110 - x) - Math.max(0, x - (width - 110))).toFixed(1) + 'px');
    if (m.focused && m.prompt !== '') boxShown = true;
  });
  Object.keys(markerNodes).forEach(function (id) {
    if (seen[id]) return;
    markersEl.removeChild(markerNodes[id].root);
    delete markerNodes[id];
  });
  prompt.classList.toggle('-hidden', boxShown);
  if (!markerLoop && Object.keys(markerNodes).length) markerLoop = requestAnimationFrame(moveMarkers);
}

hud.onMarkers.on(renderMarkers, { sampleEvery: 0 });
redraw.push(function () { if (lastMarkers) renderMarkers(lastMarkers); });

// The subtitles. The engine only says which lines show now ({ id, speaker, text }, already in the language in use and in time with the sound that plays: it follows the sound itself, so a pause, a skip or the
// end of the clip is a change of the list) and the page draws them. One element for each id stays while its line stays and is never taken out of the page and put back (that restarts a CSS animation: the whole
// list used to fade again whenever one line came or went). Each line moves like the item of a list: the one that comes fades in alone, the one that goes fades out alone (it keeps its place until it is gone,
// and is taken away when its fade ends), and the lines that stay glide to their new place (`.subtitle` transition, 200 ms). The place is `.subtitle`, the fade is `.subtitle__box`, so that one never cuts the other.
// When lines overlap, the player has to know which one to read first: the one that started last is shown whole and the others are dimmed (`-older`), so the eye goes to the newest and the rest are still readable.
var S = BraveUiBridge.Subtitles, subtitlesEl = el('subtitles'), subtitleNodes = {}, subtitlesToggle = el('subtitlesToggle'), subtitleCount = 0;
var SUBTITLE_FADE_MS = 200, SUBTITLE_EDGE = 56, reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Runs `change` (it adds, takes away or moves lines) and glides every line that was there before and is somewhere else now: it starts from the place it was seen in (a line still gliding is seen where it is) and
// eases to the place it has. The place is read twice, before and after, with the line's own transform out of the way.
function glideSubtitles(change) {
  var was = [];
  Object.keys(subtitleNodes).forEach(function (id) {
    var root = subtitleNodes[id].root;
    was.push({ root: root, top: root.getBoundingClientRect().top });
    root.style.transition = 'none';
    root.style.transform = '';
  });
  change();
  var moving = [];
  was.forEach(function (line) {
    if (!line.root.parentNode) return;
    var delta = line.top - line.root.getBoundingClientRect().top;
    if (Math.abs(delta) < 0.5) { line.root.style.transition = ''; return; }
    line.root.style.transform = 'translateY(' + delta + 'px)';
    moving.push(line.root);
  });
  if (moving.length) {
    void subtitlesEl.offsetHeight;
    moving.forEach(function (root) { root.style.transition = ''; root.style.transform = ''; });
  }
}

function createSubtitle(id) {
  var root = document.createElement('div');
  root.className = 'subtitle';
  root.innerHTML = '<div class="subtitle__box"><span class="subtitle__speaker"></span><span class="subtitle__text"></span></div>';
  var box = root.firstChild;
  var node = subtitleNodes[id] = { root: root, speaker: box.firstChild, text: box.lastChild, leaving: false, timer: 0, order: ++subtitleCount };
  box.addEventListener('transitionend', function (event) { if (event.propertyName === 'opacity') finishSubtitle(id); });
  return node;
}

// The line is not said any more: it fades where it is, and goes when the fade is over (the end of the transition, or a little after it, in case there is none to end).
function leaveSubtitle(id) {
  var node = subtitleNodes[id];
  if (node.leaving) return;
  if (reducedMotion.matches) { removeSubtitle(id); return; }
  node.leaving = true;
  node.root.classList.add('-leaving');
  node.timer = setTimeout(function () { finishSubtitle(id); }, SUBTITLE_FADE_MS + 80);
}

// A line that was fading out is said again (the same id): it stays.
function stayingSubtitle(node) {
  node.leaving = false;
  clearTimeout(node.timer);
  node.root.classList.remove('-leaving');
}

function finishSubtitle(id) {
  var node = subtitleNodes[id];
  if (node && node.leaving) { glideSubtitles(function () { removeSubtitle(id); }); fitSubtitles(); }
}

function removeSubtitle(id) {
  var node = subtitleNodes[id];
  clearTimeout(node.timer);
  if (node.root.parentNode) subtitlesEl.removeChild(node.root);
  delete subtitleNodes[id];
}

// The lines in the order the engine gives them, each right after the one before it. A line that is fading out stays where it is, so a line that comes goes after it and the ones that stay are never moved.
function placeSubtitle(root, previous) {
  var before = root.previousElementSibling;
  while (before && before.classList.contains('-leaving')) before = before.previousElementSibling;
  if (root.parentNode === subtitlesEl && before === previous) return;

  var next = previous ? previous.nextElementSibling : subtitlesEl.firstElementChild;
  while (next && next.classList.contains('-leaving')) next = next.nextElementSibling;
  subtitlesEl.insertBefore(root, next);
}

// The newest line is the one the page saw first most recently (`order`; lines that come in one change count in the order the engine lists them), and a line that is fading out is not a candidate: when the newest
// goes, the one before it is the newest again, and a line that is alone is never dimmed.
function markNewestSubtitle() {
  var newest = null;
  Object.keys(subtitleNodes).forEach(function (id) {
    var node = subtitleNodes[id];
    if (!node.leaving && (!newest || node.order > newest.order)) newest = node;
  });
  Object.keys(subtitleNodes).forEach(function (id) {
    var node = subtitleNodes[id];
    node.root.classList.toggle('-older', node !== newest);
  });
}

// The lane has a height it never passes (see hud.css): when the lines are taller than it, the oldest are cut at the top edge, and the edge fades so that they go out instead of ending half a line. The newest is the
// lowest and is never cut. Read from the layout (`offsetTop`), which a gliding line's transform does not change: the first line starts above the lane when it overflows.
function fitSubtitles() {
  var first = subtitlesEl.firstElementChild;
  subtitlesEl.classList.toggle('-clipped', !!first && first.offsetTop < -1);
  var clipped = subtitlesEl.classList.contains('-clipped');
  Array.prototype.forEach.call(subtitlesEl.children, function (root) { fadeSubtitleEdge(root.firstChild, clipped ? root.offsetTop : SUBTITLE_EDGE); });
}

// The fade at the lane's top edge is on each BOX (a gradient from nothing at the edge to whole SUBTITLE_EDGE px below it, laid in the box's own coordinates from where it sits in the lane), never on the lane: a mask
// or an opacity on an ancestor is the backdrop root of the glass (`backdrop-filter`), and the boxes would blur nothing, which is exactly when the lines are crowded.
function fadeSubtitleEdge(box, top) {
  var mask = '';
  if (top < SUBTITLE_EDGE) mask = 'linear-gradient(to bottom, rgba(0, 0, 0, ' + Math.max(0, top) / SUBTITLE_EDGE + ') ' + Math.max(0, -top) + 'px, #000 ' + (SUBTITLE_EDGE - top) + 'px)';
  box.style.webkitMaskImage = mask;
  box.style.maskImage = mask;
}
// The lane's height is a share of the window's (hud.css): a window that changes size (the editor's viewport dragged, the fullscreen toggled) changes what fits, and the edge's fade must follow.
window.addEventListener('resize', fitSubtitles);

function renderSubtitles(lines) {
  var seen = {};
  lines.forEach(function (line) { seen[line.id] = true; });

  glideSubtitles(function () {
    Object.keys(subtitleNodes).forEach(function (id) { if (!seen[id]) leaveSubtitle(id); });
    var previous = null;
    lines.forEach(function (line) {
      var node = subtitleNodes[line.id] || createSubtitle(line.id);
      if (node.leaving) stayingSubtitle(node);
      if (node.speaker.textContent !== line.speaker) node.speaker.textContent = line.speaker;
      node.speaker.hidden = line.speaker === '';
      if (node.text.textContent !== line.text) node.text.textContent = line.text;
      placeSubtitle(node.root, previous);
      previous = node.root;
    });
  });
  markNewestSubtitle();
  fitSubtitles();
  subtitlesToggle.checked = S.enabled;
}
S.onChange.on(renderSubtitles);
S.ready.then(function () { renderSubtitles(S.lines); });
// The choice is the `PauseMenu` service's to keep and to apply to the engine; the page hears of it through `Subtitles` like everyone else.
subtitlesToggle.addEventListener('change', function () { pause.setSubtitles(subtitlesToggle.checked); });

// The pause menu: the `PauseMenu` service says whether it is open and what the three settings are; the controls say what the player changed. The sliders are not moved by the state while one is being dragged.
var pause = BraveUiBridge.remote('PauseMenu');
var menu = el('menu'), sliders = { sensitivity: el('sensitivity'), fieldOfView: el('fieldOfView'), volume: el('volume') };
var shown = { sensitivity: function (v) { return Number(v).toFixed(2) + 'x'; }, fieldOfView: function (v) { return Math.round(v) + '\u00b0'; }, volume: function (v) { return Math.round(v * 100) + '%'; } };

function renderMenu(state) {
  menu.classList.toggle('-open', !!state.open);
  // The voices of a new language are being loaded: the list and Continue wait, and the row says so, so that the game is given back already speaking it.
  el('language').disabled = !!state.languageBusy;
  el('languageLoading').hidden = !state.languageBusy;
  el('resume').disabled = !!state.languageBusy;
  menu.setAttribute('aria-hidden', state.open ? 'false' : 'true');
  Object.keys(sliders).forEach(function (key) {
    if (document.activeElement !== sliders[key]) sliders[key].value = state[key];
    el(key + 'Value').textContent = shown[key](state[key]);
  });
}

sliders.sensitivity.addEventListener('input', function () { pause.setSensitivity(Number(sliders.sensitivity.value)); el('sensitivityValue').textContent = shown.sensitivity(sliders.sensitivity.value); });
sliders.fieldOfView.addEventListener('input', function () { pause.setFieldOfView(Number(sliders.fieldOfView.value)); el('fieldOfViewValue').textContent = shown.fieldOfView(sliders.fieldOfView.value); });
sliders.volume.addEventListener('input', function () { pause.setVolume(Number(sliders.volume.value)); el('volumeValue').textContent = shown.volume(sliders.volume.value); });
el('resume').addEventListener('click', function () { pause.resume(); });

pause.state().then(renderMenu);
pause.onChange.on(renderMenu, { sampleEvery: 0 });

// The language of the game: the row is there when the game has two or more, with each in its own words. The choice is the `PauseMenu` service's to keep (the next start begins with it) and to apply to the engine; the
// page then hears of it like everyone else, through `Translate`. The service is asked, never the engine's `Translate` directly, so that what the player chose is also what is saved.
var languageRow = el('languageRow'), languageSelect = el('language'), drawnLanguages = '';
function renderLanguages() {
  var languages = T.languages || [], signature = JSON.stringify(languages);
  languageRow.hidden = languages.length < 2;
  if (signature !== drawnLanguages) {
    drawnLanguages = signature;
    languageSelect.textContent = '';
    languages.forEach(function (language) {
      var option = document.createElement('option');
      option.value = language.code;
      option.textContent = language.name;
      languageSelect.appendChild(option);
    });
  }
  languageSelect.value = T.language;
}
languageSelect.addEventListener('change', function () { pause.setLanguage(languageSelect.value); });
redraw.push(renderLanguages);
renderLanguages();

// The saves of the pause menu: the `SaveGame` service says what each slot holds and what the last save or load said; the buttons send the player's choice back. The rows are rebuilt only when what they show
// changes, so that a state sent again does not take a button from under the pointer.
(function () {
  var saves = BraveUiBridge.remote('SaveGame');
  var list = el('saves'), note = el('savesNote'), drawn = '';

  function addButton(row, label, disabled, action) {
    var button = document.createElement('button');
    button.className = 'save__button';
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener('click', action);
    row.appendChild(button);
  }

  var lastSaves = null;
  function renderSaves(state) {
    lastSaves = state;
    var signature = JSON.stringify(state.slots) + '|' + state.busy;
    note.textContent = tr(state.message || '');
    if (signature === drawn) return;
    drawn = signature;
    list.textContent = '';
    state.slots.forEach(function (slot) {
      var row = document.createElement('div');
      row.className = 'save';
      var name = document.createElement('span');
      name.textContent = tr(slot.name);
      var info = document.createElement('span');
      info.className = 'save__info';
      info.textContent = tr(slot.info);
      row.appendChild(name);
      row.appendChild(info);
      addButton(row, word('menu.save', 'Save'), state.busy, function () { saves.save(slot.id); });
      addButton(row, word('menu.load', 'Load'), state.busy || slot.empty, function () { saves.load(slot.id); });
      list.appendChild(row);
    });
  }

  saves.state().then(renderSaves);
  saves.onChange.on(renderSaves, { sampleEvery: 0 });
  redraw.push(function () { drawn = ''; if (lastSaves) renderSaves(lastSaves); });
})();

// Restart and Quit ask twice: the first click turns the button into "Click again to confirm" for three seconds and the second does it; the time running out, a click anywhere else, the other button and the menu
// closing put it back. Restart is the `SaveGame` service's (the game as it was on its first frame), Quit the `PauseMenu`'s (what it does depends on where the game runs, and the service says whether it can: a browser
// tab cannot close itself, so the button is not there).
(function () {
  var CONFIRM_MS = 3000, saves = BraveUiBridge.remote('SaveGame');
  var restart = el('restart'), quit = el('quit'), armed = null;

  function disarm() {
    if (!armed) return;
    clearTimeout(armed.timer);
    armed.button.classList.remove('-confirm');
    armed.button.textContent = armed.label;
    armed = null;
  }

  function confirmable(button, action) {
    button.addEventListener('click', function () {
      if (armed && armed.button === button) {
        disarm();
        action();
        return;
      }
      disarm();
      // The label is taken when the question is asked, so that it is the one of the language in use.
      var label = button.textContent;
      button.classList.add('-confirm');
      button.textContent = word('menu.confirm', 'Click again to confirm');
      armed = { button: button, label: label, timer: setTimeout(disarm, CONFIRM_MS) };
    });
  }

  confirmable(restart, function () { saves.restart(); });
  confirmable(quit, function () { pause.quit(); });

  // A press on anything but the armed button (the page's other controls and the empty space, which the game gets) takes the question back.
  document.addEventListener('mousedown', function (event) { if (armed && event.target !== armed.button) disarm(); }, true);

  function renderQuit(state) {
    quit.hidden = !state.canQuit;
    if (!state.open) disarm();
  }
  pause.state().then(renderQuit);
  pause.onChange.on(renderQuit, { sampleEvery: 0 });

  function renderRestart(state) { restart.disabled = !state.canRestart || state.busy; }
  saves.state().then(renderRestart);
  saves.onChange.on(renderRestart, { sampleEvery: 0 });
})();

// The Journal (Datapad, Journal... its name comes from the game, never from this page): the `Journal` service says what is shown; the page draws it and sends the choices back. Tab opens and closes it;
// while it is open the arrows move through the entries (up and down) and the categories (left and right). The lists are rebuilt only when their content changes, so a state sent again does not flicker.
(function () {
  var journal = BraveUiBridge.remote('Journal');
  var backdrop = el('journal'), heading = el('journalTitle'), categoriesList = el('journalCategories'), entriesList = el('journalEntries'), drawing = el('journalObject');
  var entryTitle = el('journalEntryTitle'), entryStatus = el('journalEntryStatus'), entryBody = el('journalEntryBody'), audioButton = el('journalAudio');
  var emptyNote = el('journalEmpty'), hint = el('journalHint'), hintTitle = el('journalHintTitle');
  var current = { open: false, title: '', categories: [], entries: [], category: '', selected: '', playing: '', news: 0, hintSeconds: 5 };
  var signatures = {}, drawnCategory = null;

  var STATUS_TEXT = { active: 'Active', done: 'Done', failed: 'Failed', unused: 'Not used yet', used: 'Used' };
  function statusWords(status) { return word('journal.status.' + status, STATUS_TEXT[status]); }
  var STATUS_TONE = { active: '-accent', unused: '-accent', done: '-ok', used: '-ok', failed: '-danger' };
  // The drawings, one per category of the entry: 120 by 120, drawn with the stroke of the colour of the page's accent.
  var DRAWINGS = {
    notes: '<rect x="30" y="16" width="60" height="88" rx="4"/><path d="M42 40 H78 M42 56 H78 M42 72 H78 M42 88 H66"/>',
    audio: '<path d="M18 46 H36 L60 26 V94 L36 74 H18 Z"/><path d="M74 44 Q84 60 74 76 M86 34 Q104 60 86 86"/>',
    access: '<rect x="18" y="36" width="84" height="48" rx="6"/><path d="M18 50 H102"/><rect x="32" y="62" width="16" height="12" rx="2"/>',
    objectives: '<path d="M34 16 V104"/><path d="M34 20 H92 L80 42 L92 64 H34"/>',
    passwords: '<rect x="28" y="54" width="64" height="48" rx="6"/><path d="M42 54 V40 A18 18 0 0 1 78 40 V54"/>',
    items: '<path d="M60 16 L100 38 V82 L60 104 L20 82 V38 Z"/><path d="M20 38 L60 60 L100 38 M60 60 V104"/>'
  };
  var PLAIN_DRAWING = '<rect x="24" y="24" width="72" height="72" rx="14"/>';

  function drawingFor(category) {
    var shape = DRAWINGS.hasOwnProperty(category) ? DRAWINGS[category] : PLAIN_DRAWING;
    return '<svg viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + shape + '</svg>';
  }

  function changed(name, signature) {
    if (signatures[name] === signature) return false;
    signatures[name] = signature;
    return true;
  }

  function makeRow(isCurrent) {
    var row = document.createElement('li');
    row.className = 'journal__row' + (isCurrent ? ' -current' : '');
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '-1');
    return row;
  }

  function addText(parent, className, text) {
    var span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    parent.appendChild(span);
    return span;
  }

  function renderCategories(data) {
    if (!changed('categories', data.category + '|' + JSON.stringify(data.categories))) return;
    categoriesList.textContent = '';
    data.categories.forEach(function (category) {
      var row = makeRow(category.id === data.category);
      addText(row, 'journal__row-name', tr(category.name));
      addText(row, 'journal__row-count', category.count);
      if (category.news > 0) {
        var dot = document.createElement('span');
        dot.className = 'journal__dot';
        row.appendChild(dot);
      }
      row.addEventListener('click', function () { journal.select(category.id); });
      categoriesList.appendChild(row);
    });
  }

  function renderEntries(data) {
    if (!changed('entries', data.category + '|' + data.selected + '|' + JSON.stringify(data.entries))) return;
    entriesList.textContent = '';
    data.entries.forEach(function (entry) {
      var row = makeRow(entry.id === data.selected);
      row.classList.toggle('-new', !!entry.isNew);
      addText(row, 'journal__row-name', tr(entry.title));
      if (STATUS_TEXT.hasOwnProperty(entry.status)) addText(row, 'journal__badge ' + STATUS_TONE[entry.status], statusWords(entry.status));
      if (entry.count > 1) addText(row, 'journal__badge', '\u00d7' + entry.count);
      row.addEventListener('click', function () { journal.choose(entry.id); });
      entriesList.appendChild(row);
    });
  }

  function selectedEntry(data) {
    var index = data.entries.map(function (entry) { return entry.id; }).indexOf(data.selected);
    return index === -1 ? null : data.entries[index];
  }

  function renderDrawing(entry) {
    var category = entry ? entry.category : null;
    if (category !== drawnCategory) {
      drawing.innerHTML = entry ? drawingFor(entry.category) : '';
      drawnCategory = category;
    }
    var status = entry ? entry.status : '';
    drawing.classList.toggle('-done', status === 'done' || status === 'used');
    drawing.classList.toggle('-failed', status === 'failed');
  }

  function renderDetail(data, entry) {
    if (!changed('detail', entry ? JSON.stringify(entry) + '|' + data.playing : '')) return;
    var known = !!entry && STATUS_TEXT.hasOwnProperty(entry.status);
    entryTitle.textContent = entry ? tr(entry.title) : '';
    // An item is not given a status: it says how many of it are carried.
    var carrying = !!entry && typeof entry.count === 'number';
    entryStatus.textContent = known ? statusWords(entry.status) : carrying ? (entry.limit > 0 ? word('journal.carryingOf', 'Carrying {count} of {limit}', { count: entry.count, limit: entry.limit }) : word('journal.carrying', 'Carrying {count}', { count: entry.count })) : '';
    entryStatus.className = 'journal__status' + (known ? ' ' + STATUS_TONE[entry.status] : carrying ? ' -accent' : '');
    entryBody.textContent = entry ? tr(entry.body) : '';
    audioButton.hidden = !(entry && entry.audio);
    audioButton.textContent = entry && data.playing === entry.id ? word('journal.stop', 'Stop') : word('journal.play', 'Play');
  }

  // The chip is not always there: it fades in when something new goes into the menu, stays `hintSeconds` and fades out (0: it stays). What was new before the page came (a game that was loaded) does not show it,
  // and it is gone while the menu is open.
  var hintTimer, lastNews = -1;

  function showHint(on) {
    hint.classList.toggle('-shown', on);
  }

  function renderHint(data) {
    hintTitle.textContent = tr(data.title);
    hint.classList.toggle('-new', data.news > 0);
    if (data.open) {
      clearTimeout(hintTimer);
      showHint(false);
    } else if (data.hintSeconds <= 0) {
      showHint(true);
    } else if (lastNews >= 0 && data.news > lastNews) {
      showHint(true);
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () { showHint(false); }, data.hintSeconds * 1000);
    }
    lastNews = data.news;
  }

  var lastJournal = null;
  function renderJournal(state) {
    lastJournal = state;
    var data = {
      open: !!state.open, title: state.title || '', categories: state.categories || [], entries: state.entries || [],
      category: state.category || '', selected: state.selected || '', playing: state.playing || '', news: state.news || 0,
      hintSeconds: typeof state.hintSeconds === 'number' ? state.hintSeconds : 5
    };
    current = data;
    backdrop.classList.toggle('-open', data.open);
    // The Journal has the whole screen: the pause menu is not seen under it (see `body.-journal .menu`).
    document.body.classList.toggle('-journal', data.open);
    backdrop.setAttribute('aria-hidden', data.open ? 'false' : 'true');
    heading.textContent = tr(data.title);
    emptyNote.classList.toggle('-show', data.categories.length === 0);
    renderCategories(data);
    renderEntries(data);
    var entry = selectedEntry(data);
    renderDrawing(entry);
    renderDetail(data, entry);
    renderHint(data);
  }

  // The item after (direction 1) or before (-1) the one with this id, held at the ends of the list; the first one when none is chosen yet.
  function neighbour(list, id, direction) {
    if (list.length === 0) return null;
    var index = list.map(function (item) { return item.id; }).indexOf(id);
    return list[Math.max(0, Math.min(list.length - 1, index + direction))];
  }

  document.addEventListener('keydown', function (event) {
    if (event.code === 'Tab') {
      event.preventDefault();
      journal.toggle();
      return;
    }
    if (!current.open) return;
    var direction = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1 }[event.code];
    if (!direction) return;
    event.preventDefault();
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      var entry = neighbour(current.entries, current.selected, direction);
      if (entry && entry.id !== current.selected) journal.choose(entry.id);
      return;
    }
    var category = neighbour(current.categories, current.category, direction);
    if (category && category.id !== current.category) journal.select(category.id);
  });

  el('journalClose').addEventListener('click', function () { journal.close(); });
  audioButton.addEventListener('click', function () {
    if (current.playing !== '' && current.playing === current.selected) journal.stop();
    else if (current.selected !== '') journal.play(current.selected);
  });

  journal.state().then(renderJournal);
  journal.onChange.on(renderJournal, { sampleEvery: 0 });
  // The lists and the detail are rebuilt only when what they show changes, so a new language asks for all of them again.
  redraw.push(function () { signatures = {}; if (lastJournal) renderJournal(lastJournal); });
})();


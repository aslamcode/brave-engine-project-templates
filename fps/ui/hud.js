// The HUD page of the FPS kit. The game side is the `Hud` service (assets/services/hud.service.ts): its `state` is read once (a Signal delivers changes, not state, so a page that loads late would
// show placeholders), then `onChange` keeps it fresh; `onHit` and `onDamaged` are events. A plain script: `BraveUiBridge` is a global because vendor/ui-bridge.global.js is loaded before this file.
BraveUiBridge.enablePointerBridging();
var hud = BraveUiBridge.remote('Hud');

var el = function (id) { return document.getElementById(id); };
var crosshair = el('crosshair'), prompt = el('prompt'), promptText = el('promptText'), message = el('message'), damage = el('damage'), hitmarker = el('hitmarker');
var healthFill = el('healthFill'), healthText = el('healthText'), ammo = el('ammo'), reserve = el('reserve'), stance = el('stance'), items = el('items'), weapons = el('weapons');
var markersEl = el('markers'), markerNodes = {};
var hitTimer, damageTimer, indicatorTimer, indicator = el('indicator');

function render(state) {
  // The text stays while the prompt fades out, so that the key chip is never left alone on the screen.
  if (state.prompt !== '') promptText.textContent = state.prompt;
  prompt.classList.toggle('-show', state.prompt !== '');
  message.textContent = state.message;
  message.classList.toggle('-show', state.message !== '');

  var share = state.maxHealth > 0 ? Math.max(0, Math.min(1, state.health / state.maxHealth)) : 0;
  healthFill.style.width = (share * 100) + '%';
  healthFill.classList.toggle('-low', share < 0.3);
  healthText.textContent = Math.max(0, Math.round(state.health));

  ammo.textContent = state.ammo;
  ammo.classList.toggle('-empty', state.magazine > 0 && state.ammo === 0);
  reserve.textContent = state.reserve;
  // A reserve below zero is a gear that is only counted (a grenade, a medkit): the count alone, with no magazine and no slash.
  ammo.parentNode.classList.toggle('-single', state.reserve < 0);
  stance.textContent = state.stance === 'alert' ? 'Alert' : 'Relaxed';
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
    chip.textContent = (index + 1) + ' ' + name;
    weapons.appendChild(chip);
  });

  renderItems(state);
}

// What the player carries is not always on the screen: the list fades in when it changes (something was picked up, used or spent), stays `itemsSeconds` and fades out (0: it stays). What is new in it is lit. The
// list that was there before the page came (a game that was loaded) does not show it, and an empty list is let go of with its last content, so that it fades out whole. The Journal has the whole list, under Items.
var itemsTimer, lastItems = null;
function renderItems(state) {
  var names = state.items || [];
  var signature = JSON.stringify(names);
  var seconds = typeof state.itemsSeconds === 'number' ? state.itemsSeconds : 4;

  if (signature !== lastItems) {
    var before = lastItems === null ? [] : JSON.parse(lastItems);
    var first = lastItems === null;
    lastItems = signature;
    if (names.length > 0) {
      items.innerHTML = '';
      names.forEach(function (name) {
        var chip = document.createElement('div');
        chip.className = 'item' + (!first && before.indexOf(name) === -1 ? ' -new' : '');
        chip.textContent = name;
        items.appendChild(chip);
      });
    }
    clearTimeout(itemsTimer);
    if (names.length === 0) {
      items.classList.remove('-shown');
    } else if (!first && seconds > 0) {
      items.classList.add('-shown');
      itemsTimer = setTimeout(function () { items.classList.remove('-shown'); }, seconds * 1000);
    }
  }
  if (seconds <= 0) items.classList.toggle('-shown', names.length > 0);
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
// looked at (`focused`) shows a glass box with what E does, tied to the thing by a line when its marker is `line`; the others are a small mark. While a box says what E does, the line under the crosshair is hidden.
function makeMarker() {
  var root = document.createElement('div');
  root.className = 'marker';
  root.innerHTML = '<div class="marker__line"></div><div class="marker__box"><span class="marker__key">E</span><span class="marker__text"></span></div><div class="marker__dot"></div>';
  markersEl.appendChild(root);
  return { root: root, box: root.querySelector('.marker__box'), text: root.querySelector('.marker__text') };
}

function renderMarkers(list) {
  var width = window.innerWidth, height = window.innerHeight, seen = {}, boxShown = false;
  list.forEach(function (m) {
    var node = markerNodes[m.id] || (markerNodes[m.id] = makeMarker());
    var x = m.x * width, y = m.y * height;
    seen[m.id] = true;
    node.root.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    node.root.classList.toggle('-focused', m.focused);
    node.root.classList.toggle('-line', m.focused && m.line);
    node.root.classList.toggle('-below', y < 150);
    if (m.focused && node.text.textContent !== m.prompt) node.text.textContent = m.prompt;
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
}

hud.onMarkers.on(renderMarkers, { sampleEvery: 0 });

// The pause menu: the `PauseMenu` service says whether it is open and what the three settings are; the controls say what the player changed. The sliders are not moved by the state while one is being dragged.
var pause = BraveUiBridge.remote('PauseMenu');
var menu = el('menu'), sliders = { sensitivity: el('sensitivity'), fieldOfView: el('fieldOfView'), volume: el('volume') };
var shown = { sensitivity: function (v) { return Number(v).toFixed(2) + 'x'; }, fieldOfView: function (v) { return Math.round(v) + '\u00b0'; }, volume: function (v) { return Math.round(v * 100) + '%'; } };

function renderMenu(state) {
  menu.classList.toggle('-open', !!state.open);
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

  function renderSaves(state) {
    var signature = JSON.stringify(state.slots) + '|' + state.busy;
    note.textContent = state.message || '';
    if (signature === drawn) return;
    drawn = signature;
    list.textContent = '';
    state.slots.forEach(function (slot) {
      var row = document.createElement('div');
      row.className = 'save';
      var name = document.createElement('span');
      name.textContent = slot.name;
      var info = document.createElement('span');
      info.className = 'save__info';
      info.textContent = slot.info;
      row.appendChild(name);
      row.appendChild(info);
      addButton(row, 'Save', state.busy, function () { saves.save(slot.id); });
      addButton(row, 'Load', state.busy || slot.empty, function () { saves.load(slot.id); });
      list.appendChild(row);
    });
  }

  saves.state().then(renderSaves);
  saves.onChange.on(renderSaves, { sampleEvery: 0 });
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
      addText(row, 'journal__row-name', category.name);
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
      addText(row, 'journal__row-name', entry.title);
      if (STATUS_TEXT.hasOwnProperty(entry.status)) addText(row, 'journal__badge ' + STATUS_TONE[entry.status], STATUS_TEXT[entry.status]);
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
    entryTitle.textContent = entry ? entry.title : '';
    // An item is not given a status: it says how many of it are carried.
    var carrying = !!entry && typeof entry.count === 'number';
    entryStatus.textContent = known ? STATUS_TEXT[entry.status] : carrying ? 'Carrying ' + entry.count + (entry.limit > 0 ? ' of ' + entry.limit : '') : '';
    entryStatus.className = 'journal__status' + (known ? ' ' + STATUS_TONE[entry.status] : carrying ? ' -accent' : '');
    entryBody.textContent = entry ? entry.body : '';
    audioButton.hidden = !(entry && entry.audio);
    audioButton.textContent = entry && data.playing === entry.id ? 'Stop' : 'Play';
  }

  // The chip is not always there: it fades in when something new goes into the menu, stays `hintSeconds` and fades out (0: it stays). What was new before the page came (a game that was loaded) does not show it,
  // and it is gone while the menu is open.
  var hintTimer, lastNews = -1;

  function showHint(on) {
    hint.classList.toggle('-shown', on);
  }

  function renderHint(data) {
    hintTitle.textContent = data.title;
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

  function renderJournal(state) {
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
    heading.textContent = data.title;
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
})();


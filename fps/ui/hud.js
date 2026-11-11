// The HUD page of the FPS kit. The game side is the `Hud` service (assets/services/hud.service.ts): its `state` is read once (a Signal delivers changes, not state, so a page that loads late would
// show placeholders), then `onChange` keeps it fresh; `onHit` and `onDamaged` are events. A plain script: `BraveUiBridge` is a global because vendor/ui-bridge.global.js is loaded before this file.
BraveUiBridge.enablePointerBridging();
var hud = BraveUiBridge.remote('Hud');

var el = function (id) { return document.getElementById(id); };
var crosshair = el('crosshair'), prompt = el('prompt'), promptText = el('promptText'), message = el('message'), damage = el('damage'), hitmarker = el('hitmarker');
var healthFill = el('healthFill'), healthText = el('healthText'), ammo = el('ammo'), reserve = el('reserve'), stance = el('stance'), items = el('items'), weapons = el('weapons');
var markersEl = el('markers'), markerNodes = {};
var hitTimer, damageTimer;

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
  stance.textContent = state.stance === 'alert' ? 'Alert' : 'Relaxed';
  crosshair.classList.toggle('-alert', state.stance === 'alert');
  crosshair.classList.toggle('-target', !!state.target);
  crosshair.classList.toggle('-arcs', state.crosshair === 'arcs');
  crosshair.classList.toggle('-aiming', !!state.aiming);
  // The cone of the weapon on this window: a share of half the height, in pixels. The ticks and the arcs open by it.
  crosshair.style.setProperty('--spread', (state.spread * window.innerHeight / 2).toFixed(1) + 'px');

  // The weapons the player carries: the number of the key and the name, the one in hand lit.
  weapons.innerHTML = '';
  (state.weapons || []).forEach(function (name, index) {
    var chip = document.createElement('span');
    chip.className = 'weapons__chip' + (index === state.weapon ? ' -current' : '');
    chip.textContent = (index + 1) + ' ' + name;
    weapons.appendChild(chip);
  });

  items.innerHTML = '';
  state.items.forEach(function (name) {
    var chip = document.createElement('div');
    chip.className = 'item';
    chip.textContent = name;
    items.appendChild(chip);
  });
}

hud.state().then(render);
hud.onChange.on(render, { sampleEvery: 50 });

hud.onHit.on(function (hit) {
  hitmarker.classList.toggle('-kill', !!hit.kill);
  hitmarker.classList.add('-show');
  clearTimeout(hitTimer);
  hitTimer = setTimeout(function () { hitmarker.classList.remove('-show'); }, 90);
}, { sampleEvery: 0 });

hud.onDamaged.on(function () {
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

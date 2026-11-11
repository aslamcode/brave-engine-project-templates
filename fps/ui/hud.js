// The HUD page of the FPS kit. The game side is the `Hud` service (assets/services/hud.service.ts): its `state` is read once (a Signal delivers changes, not state, so a page that loads late would
// show placeholders), then `onChange` keeps it fresh; `onHit` and `onDamaged` are events. A plain script: `BraveUiBridge` is a global because vendor/ui-bridge.global.js is loaded before this file.
BraveUiBridge.enablePointerBridging();
var hud = BraveUiBridge.remote('Hud');

var el = function (id) { return document.getElementById(id); };
var crosshair = el('crosshair'), prompt = el('prompt'), promptText = el('promptText'), message = el('message'), damage = el('damage'), hitmarker = el('hitmarker');
var healthFill = el('healthFill'), healthText = el('healthText'), ammo = el('ammo'), reserve = el('reserve'), stance = el('stance'), items = el('items');
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

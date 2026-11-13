// Cinderdeep — a small top-down action roguelike.
// Climb six chambers of the underworld, take a blessing after each, defeat the Hollow Warden.
(() => {
'use strict';

// ---------------------------------------------------------------- strings
const STR = {
  title: 'CINDERDEEP',
  tagline: 'Climb out of the underworld. Six chambers. One warden.',
  start: 'Press Enter, Space or click to begin',
  controls: [
    'Move  WASD / Arrows / Left stick',
    'Strike  J / Left click / X   (3-hit combo)',
    'Cast  K / Right click / B',
    'Dash  Space / Shift / A   (invulnerable)',
  ],
  chamber: n => `Chamber ${n} / 6`,
  bossName: 'THE HOLLOW WARDEN',
  chooseBlessing: 'Choose a blessing',
  chooseHint: '1 / 2 / 3, click, or arrows + Enter',
  doorOpen: 'The way up is open — step through the door',
  died: 'THE DEEP CLAIMS YOU',
  won: 'YOU REACH THE LIGHT',
  again: 'Press Enter or click to rise again',
  reached: (n, t) => `Reached chamber ${n}  ·  ${t}s`,
  best: n => `Best: chamber ${n}`,
  wins: n => `Escapes: ${n}`,
  lv: l => `Lv ${l}`,
  heal: 'Restore 35 health',
  shield: 'WARD',
};

// ---------------------------------------------------------------- config (all tuning lives here)
const W = 1280, H = 720;
const ROOM = { x0: 90, y0: 110, x1: 1190, y1: 670 };
const CFG = {
  dt: 1 / 60,
  player: { hp: 100, speed: 270, r: 14, drawH: 100,
    dashSpeed: 980, dashTime: 0.16, dashCd: 0.42, dashIframes: 0.22,
    strikeTime: 0.24, strikeActive: 0.12, strikeCd: 0.06, comboWindow: 0.45,
    strikeDmg: [14, 14, 26], strikeRange: [92, 92, 118], strikeArc: 2.1,
    castCd: 1.1, castDmg: 22, castSpeed: 760, hurtIframes: 0.7 },
  hitstop: 0.05, shakeHit: 5, shakeHurt: 12,
};

const ENEMY = {
  wisp:    { hp: 32,  r: 22, speed: 135, dmg: 10, drawH: 84,  img: 'wisp',    flip: true },
  slinger: { hp: 28,  r: 22, speed: 105, dmg: 10, drawH: 92,  img: 'slinger', flip: true },
  brute:   { hp: 120, r: 36, speed: 72,  dmg: 22, drawH: 136, img: 'brute',   flip: false },
  warden:  { hp: 950, r: 58, speed: 82,  dmg: 25, drawH: 240, img: 'warden',  flip: true },
};

const ROOMS = [
  [['wisp', 'wisp', 'wisp']],
  [['wisp', 'wisp', 'slinger'], ['wisp', 'wisp', 'slinger']],
  [['brute', 'wisp', 'wisp'], ['wisp', 'slinger']],
  [['slinger', 'slinger', 'wisp', 'wisp'], ['brute', 'slinger', 'wisp']],
  [['brute', 'brute', 'slinger'], ['wisp', 'wisp', 'wisp', 'slinger', 'slinger']],
  [['warden']],
];

const GODS = {
  pyre: { name: 'Pyre', color: '#ff7a2f', icon: 'icon_flame' },
  tide: { name: 'Tide', color: '#6fd3ff', icon: 'icon_frost' },
  gale: { name: 'Gale', color: '#ffe35a', icon: 'icon_storm' },
};
const BOONS = [
  { id: 'pyre_strike', god: 'pyre', name: 'Searing Edge',  desc: l => `Strikes ignite foes: ${6 * l} burn/s for 3s` },
  { id: 'pyre_trail',  god: 'pyre', name: 'Ashen Wake',    desc: l => `Dashing leaves fire that deals ${10 * l}/s` },
  { id: 'pyre_might',  god: 'pyre', name: 'Kindled Might', desc: l => `+${20 * l}% strike damage` },
  { id: 'tide_strike', god: 'tide', name: 'Chilling Edge', desc: l => `Strikes slow foes by ${25 + 10 * l}% for 2s` },
  { id: 'tide_cast',   god: 'tide', name: 'Shard Volley',  desc: l => `Cast fires ${1 + 2 * l} frost shards in a fan` },
  { id: 'tide_ward',   god: 'tide', name: 'Tidal Ward',    desc: l => `Dashing raises a ward that blocks a hit (${Math.max(2, 6 - l * 1.5)}s cd)` },
  { id: 'gale_strike', god: 'gale', name: 'Storm Edge',    desc: l => `Strikes arc lightning to ${1 + l} foes for ${8 * l}` },
  { id: 'gale_cast',   god: 'gale', name: 'Piercing Gale', desc: l => `Cast pierces and deals +${40 * l}% damage` },
  { id: 'gale_haste',  god: 'gale', name: 'Tailwind',      desc: l => `+${12 * l}% move and strike speed` },
];
const MAX_LV = 3;

// ---------------------------------------------------------------- seeded rng (logic) + visual rng
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rng = mulberry32(Date.now() & 0xffffffff);
const vrand = Math.random; // visual-only randomness
const rr = (a, b) => a + rng() * (b - a);

// ---------------------------------------------------------------- canvas
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = (W * s) + 'px'; canvas.style.height = (H * s) + 'px';
}
addEventListener('resize', fit); fit();

// ---------------------------------------------------------------- assets
const IMG = {};
const WHITE = {};
const names = ['hero', 'wisp', 'slinger', 'brute', 'warden', 'icon_flame', 'icon_frost', 'icon_storm'];
let toLoad = names.length + 2;
function loaded() { if (--toLoad === 0) onAssets(); }
for (const n of names) { const i = new Image(); i.onload = loaded; i.onerror = loaded; i.src = `assets/${n}.png`; IMG[n] = i; }
for (const n of ['floor', 'title']) { const i = new Image(); i.onload = loaded; i.onerror = loaded; i.src = `assets/${n}.jpg`; IMG[n] = i; }
let floorPattern = null;
function onAssets() {
  for (const n of names) {
    const i = IMG[n]; if (!i.naturalWidth) continue;
    const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(i, 0, 0); x.globalCompositeOperation = 'source-atop';
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); WHITE[n] = c;
  }
  if (IMG.floor.naturalWidth) floorPattern = ctx.createPattern(IMG.floor, 'repeat');
}

// ---------------------------------------------------------------- audio (synth sfx, no files)
let AC = null, master = null;
function audioInit() {
  if (AC) return;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.35; master.connect(AC.destination); drone(); } catch (e) { AC = null; }
}
function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0) {
  if (!AC) return; const t = AC.currentTime; const o = AC.createOscillator(); const g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
}
function noise(dur, vol = 0.3, hp = 800) {
  if (!AC) return; const t = AC.currentTime; const len = Math.floor(AC.sampleRate * dur);
  const b = AC.createBuffer(1, len, AC.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = AC.createBufferSource(); s.buffer = b; const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = AC.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
function drone() {
  const o1 = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
  o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 55.6; f.type = 'lowpass'; f.frequency.value = 260;
  g.gain.value = 0.06; o1.connect(f); o2.connect(f); f.connect(g); g.connect(master); o1.start(); o2.start();
}
const SFX = {
  swing: () => noise(0.09, 0.22, 2500), hit: () => { tone(180, 0.12, 'square', 0.18, -90); noise(0.05, 0.2, 1200); },
  dash: () => noise(0.14, 0.15, 400), cast: () => tone(520, 0.2, 'triangle', 0.2, 380),
  hurt: () => { tone(120, 0.25, 'sawtooth', 0.3, -60); }, kill: () => tone(300, 0.25, 'triangle', 0.18, -200),
  boon: () => { tone(440, 0.4, 'sine', 0.2); setTimeout(() => tone(660, 0.5, 'sine', 0.2), 90); },
  door: () => tone(220, 0.6, 'sine', 0.2, 220), zap: () => noise(0.06, 0.15, 4000), slam: () => { tone(70, 0.4, 'sine', 0.5, -30); noise(0.2, 0.25, 200); },
};

// ---------------------------------------------------------------- input (physical key codes)
const BIND = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  strike: ['KeyJ'], cast: ['KeyK'], dash: ['Space', 'ShiftLeft', 'ShiftRight'], confirm: ['Enter', 'Space', 'NumpadEnter'],
  one: ['Digit1', 'Numpad1'], two: ['Digit2', 'Numpad2'], three: ['Digit3', 'Numpad3'],
};
const keys = new Set(); const pressed = new Set();
const isDown = a => BIND[a].some(k => keys.has(k));
const wasPressed = a => BIND[a].some(k => pressed.has(k));
addEventListener('keydown', e => {
  audioInit();
  if (!keys.has(e.code)) pressed.add(e.code); keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouse.l = mouse.r = false; });

const mouse = { x: W / 2, y: H / 2, l: false, r: false, lp: false, rp: false, lastMove: -10 };
function toWorld(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
canvas.addEventListener('mousemove', e => { [mouse.x, mouse.y] = toWorld(e); mouse.lastMove = clock; });
canvas.addEventListener('mousedown', e => { audioInit(); [mouse.x, mouse.y] = toWorld(e); if (e.button === 0) { mouse.l = true; mouse.lp = true; } if (e.button === 2) { mouse.r = true; mouse.rp = true; } mouse.lastMove = clock; });
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// gamepad
const pad = { mx: 0, my: 0, ax: 0, ay: 0, btn: [], prev: [] };
function pollPad() {
  pad.prev = pad.btn; pad.btn = []; pad.mx = pad.my = pad.ax = pad.ay = 0;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null; if (!gp) return;
  const dz = v => Math.abs(v) < 0.2 ? 0 : v;
  pad.mx = dz(gp.axes[0] || 0); pad.my = dz(gp.axes[1] || 0); pad.ax = dz(gp.axes[2] || 0); pad.ay = dz(gp.axes[3] || 0);
  pad.btn = gp.buttons.map(b => b.pressed);
}
const padDown = i => !!pad.btn[i]; const padPressed = i => !!pad.btn[i] && !pad.prev[i];

// touch
const touch = { on: false, mx: 0, my: 0, atk: false, dashP: false, castP: false, atkP: false, id: null };
(function setupTouch() {
  const ui = document.getElementById('touch'), stick = document.getElementById('stick'), knob = document.getElementById('knob');
  addEventListener('touchstart', () => { if (!touch.on) { touch.on = true; ui.classList.add('on'); } audioInit(); }, { passive: true });
  const moveStick = t => { const r = stick.getBoundingClientRect(); let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy), max = r.width / 2; if (m > max) { dx *= max / m; dy *= max / m; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; touch.mx = dx / max; touch.my = dy / max; };
  stick.addEventListener('touchstart', e => { e.preventDefault(); touch.id = e.changedTouches[0].identifier; moveStick(e.changedTouches[0]); });
  stick.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === touch.id) moveStick(t); });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.id = null; touch.mx = touch.my = 0; knob.style.transform = ''; } };
  stick.addEventListener('touchend', end); stick.addEventListener('touchcancel', end);
  const btn = (id, f) => { const el = document.getElementById(id); el.addEventListener('touchstart', e => { e.preventDefault(); f(true); }); el.addEventListener('touchend', e => { e.preventDefault(); f(false); }); };
  btn('tAtk', v => { touch.atk = v; if (v) touch.atkP = true; });
  btn('tDash', v => { if (v) touch.dashP = true; });
  btn('tCast', v => { if (v) touch.castP = true; });
  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; [mouse.x, mouse.y] = toWorld(t); mouse.lp = true; }, { passive: true });
})();

// one command object per tick, merged from every input method
function readCommand() {
  let mx = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0) + pad.mx + touch.mx;
  let my = (isDown('down') ? 1 : 0) - (isDown('up') ? 1 : 0) + pad.my + touch.my;
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  return {
    mx, my,
    strike: isDown('strike') || mouse.l || padDown(2) || touch.atk,
    strikeP: wasPressed('strike') || mouse.lp || padPressed(2) || touch.atkP,
    cast: wasPressed('cast') || mouse.rp || padPressed(1) || touch.castP,
    dash: wasPressed('dash') || padPressed(0) || touch.dashP,
    aimPad: Math.hypot(pad.ax, pad.ay) > 0.3 ? Math.atan2(pad.ay, pad.ax) : null,
  };
}
function clearPressed() { pressed.clear(); mouse.lp = mouse.rp = false; touch.atkP = touch.dashP = touch.castP = false; }

// ---------------------------------------------------------------- persistence (convenience only)
const store = {
  get(k, d) { try { const v = localStorage.getItem('cinderdeep_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cinderdeep_' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};

// ---------------------------------------------------------------- game state
let state = 'title';
let clock = 0, runTime = 0, hitstop = 0, shake = 0;
let player, enemies, shots, parts, texts, fires, spawns, roomIdx, waveIdx, roomCleared, doorOpen, offers, offerSel, banner, bannerT, boss;
let deathT = 0;
const debug = /[?&]debug/.test(location.search);

function newPlayer() {
  return { x: W / 2, y: ROOM.y1 - 80, vx: 0, vy: 0, r: CFG.player.r, hp: CFG.player.hp, maxHp: CFG.player.hp,
    aim: -Math.PI / 2, face: 1, dashT: 0, dashCd: 0, dashDx: 0, dashDy: 0, iframes: 0,
    strikeT: 0, strikeCd: 0, combo: 0, comboT: 0, hitSet: null, castCd: 0, ward: false, wardCd: 0,
    flash: 0, moveAnim: 0, boons: {}, trailT: 0 };
}
const lv = id => player.boons[id] || 0;

function startRun() {
  rng = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
  player = newPlayer(); runTime = 0; roomIdx = 0; enterRoom(0); state = 'play';
}
function enterRoom(i) {
  roomIdx = i; waveIdx = 0; enemies = []; shots = []; parts = []; texts = []; fires = []; spawns = [];
  roomCleared = false; doorOpen = false; boss = null;
  player.x = W / 2; player.y = ROOM.y1 - 70; player.vx = player.vy = 0;
  banner = i === 5 ? STR.bossName : STR.chamber(i + 1); bannerT = 2.2;
  queueWave();
}
function queueWave() {
  const wave = ROOMS[roomIdx][waveIdx];
  for (const type of wave) {
    let x, y, tries = 0;
    do { x = rr(ROOM.x0 + 80, ROOM.x1 - 80); y = rr(ROOM.y0 + 60, ROOM.y1 - 160); tries++; }
    while (Math.hypot(x - player.x, y - player.y) < 260 && tries < 30);
    if (type === 'warden') { x = W / 2; y = ROOM.y0 + 160; }
    spawns.push({ type, x, y, t: type === 'warden' ? 1.6 : rr(0.7, 1.1) });
  }
}
function spawnEnemy(type, x, y) {
  const d = ENEMY[type];
  const e = { type, x, y, vx: 0, vy: 0, r: d.r, hp: d.hp, maxHp: d.hp, st: 'move', t: rr(0.5, 1.2),
    flash: 0, burn: 0, burnDps: 0, slow: 0, slowAmt: 0, face: 1, dx: 0, dy: 0, stun: 0, phase: 1, atkIdx: 0, anim: rng() * 6 };
  if (type === 'warden') { boss = e; e.t = 1.2; }
  enemies.push(e); burst(x, y, '#b56cff', 18, 220);
}

// ---------------------------------------------------------------- helpers
const clampRoom = (o, pad = 0) => {
  o.x = Math.max(ROOM.x0 + o.r + pad, Math.min(ROOM.x1 - o.r - pad, o.x));
  o.y = Math.max(ROOM.y0 + o.r + pad, Math.min(ROOM.y1 - o.r - pad, o.y));
};
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function burst(x, y, color, n, spd, life = 0.5, size = 4) {
  for (let i = 0; i < n; i++) { const a = vrand() * 6.283, s = spd * (0.3 + vrand() * 0.7);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + vrand() * 0.6), max: life, color, size: size * (0.5 + vrand()) }); }
}
function floatText(x, y, txt, color = '#fff', size = 22) { texts.push({ x, y, txt, color, size, t: 0.8 }); }

function damageEnemy(e, dmg, kx = 0, ky = 0, opts = {}) {
  if (e.hp <= 0) return;
  if (e.stun > 0) dmg *= 1.5;
  dmg = Math.round(dmg); e.hp -= dmg; e.flash = e.type === 'warden' ? 0.05 : 0.1;
  const kb = e.type === 'warden' ? 0.15 : e.type === 'brute' ? 0.4 : 1;
  e.vx += kx * kb; e.vy += ky * kb;
  floatText(e.x + rr(-10, 10), e.y - ENEMY[e.type].drawH * 0.7, dmg, opts.color || '#ffe7c2', opts.big ? 28 : 22);
  if (opts.strike) {
    if (lv('pyre_strike')) { e.burn = 3; e.burnDps = 6 * lv('pyre_strike'); }
    if (lv('tide_strike')) { e.slow = 2; e.slowAmt = (25 + 10 * lv('tide_strike')) / 100; }
  }
  if (e.hp <= 0) {
    SFX.kill(); burst(e.x, e.y, '#b56cff', e.type === 'warden' ? 80 : 26, 300, 0.7, 5); burst(e.x, e.y, '#ffcf5a', 10, 200);
    shake = Math.max(shake, e.type === 'warden' ? 30 : 6);
  }
}
function hurtPlayer(dmg, sx, sy) {
  if (player.iframes > 0 || player.dashT > 0 || state !== 'play') return;
  if (player.ward) { player.ward = false; player.iframes = 0.4; burst(player.x, player.y, '#6fd3ff', 24, 260); floatText(player.x, player.y - 90, STR.shield, '#6fd3ff'); tone(800, 0.2, 'sine', 0.2); return; }
  player.hp -= dmg; player.iframes = CFG.player.hurtIframes; player.flash = 0.15;
  const a = Math.atan2(player.y - sy, player.x - sx); player.vx += Math.cos(a) * 380; player.vy += Math.sin(a) * 380;
  shake = Math.max(shake, CFG.shakeHurt); hitstop = 0.08; SFX.hurt();
  floatText(player.x, player.y - 100, '-' + dmg, '#ff5a5a', 26); burst(player.x, player.y, '#ff5a5a', 14, 220);
  if (player.hp <= 0) { player.hp = 0; die(); }
}
function die() {
  state = 'dead'; deathT = 0;
  const best = store.get('best', 0); if (roomIdx + 1 > best) store.set('best', roomIdx + 1);
}
function win() {
  state = 'win'; deathT = 0; store.set('wins', store.get('wins', 0) + 1); store.set('best', 6);
}

// ---------------------------------------------------------------- player update
function updatePlayer(cmd, dt) {
  const P = CFG.player, p = player;
  const haste = 1 + 0.12 * lv('gale_haste');
  // aim
  if (cmd.aimPad != null) p.aim = cmd.aimPad;
  else if (clock - mouse.lastMove < 2.5 && !touch.on) p.aim = Math.atan2(mouse.y - (p.y - 40), mouse.x - p.x);
  else if (cmd.mx || cmd.my) p.aim = Math.atan2(cmd.my, cmd.mx);
  if (touch.on) { // auto-aim nearest enemy on touch
    let best = null, bd = 1e9; for (const e of enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
    if (best && bd < 500) p.aim = Math.atan2(best.y - p.y, best.x - p.x);
  }
  p.face = Math.cos(p.aim) >= 0 ? 1 : -1;

  p.dashCd -= dt; p.castCd -= dt; p.strikeCd -= dt; p.comboT -= dt; p.iframes -= dt; p.flash -= dt; p.wardCd -= dt;

  // dash
  if (cmd.dash && p.dashCd <= 0 && p.dashT <= 0) {
    let dx = cmd.mx, dy = cmd.my; if (!dx && !dy) { dx = Math.cos(p.aim); dy = Math.sin(p.aim); }
    const m = Math.hypot(dx, dy); p.dashDx = dx / m; p.dashDy = dy / m;
    p.dashT = P.dashTime; p.dashCd = P.dashCd + P.dashTime; p.iframes = Math.max(p.iframes, P.dashIframes);
    p.strikeT = 0; SFX.dash(); burst(p.x, p.y, '#ff9a4a', 10, 160, 0.35);
    if (lv('tide_ward') && p.wardCd <= 0 && !p.ward) { p.ward = true; p.wardCd = Math.max(2, 6 - lv('tide_ward') * 1.5); }
  }
  if (p.dashT > 0) {
    p.dashT -= dt; p.vx = p.dashDx * P.dashSpeed; p.vy = p.dashDy * P.dashSpeed;
    if (vrand() < 0.7) parts.push({ x: p.x + rr(-8, 8), y: p.y + rr(-30, 0), vx: 0, vy: -20, life: 0.3, max: 0.3, color: '#ff7a2f', size: 5 });
    if (lv('pyre_trail')) { p.trailT -= dt; if (p.trailT <= 0) { p.trailT = 0.03; fires.push({ x: p.x, y: p.y, r: 26, t: 1.6, dps: 10 * lv('pyre_trail') }); } }
  } else {
    const target = P.speed * haste * (p.strikeT > 0 ? 0.35 : 1);
    p.vx += (cmd.mx * target - p.vx) * Math.min(1, dt * 14);
    p.vy += (cmd.my * target - p.vy) * Math.min(1, dt * 14);
  }
  p.x += p.vx * dt; p.y += p.vy * dt; clampRoom(p);
  if (Math.hypot(p.vx, p.vy) > 40) p.moveAnim += dt * 12; else p.moveAnim *= 0.9;

  // strike (3-hit combo; hold to keep swinging)
  if (p.strikeT > 0) {
    p.strikeT -= dt * haste;
    const elapsed = P.strikeTime - p.strikeT;
    if (elapsed <= P.strikeActive) strikeHits();
    if (p.strikeT <= 0) { p.strikeCd = P.strikeCd; p.comboT = P.comboWindow; }
  } else if ((cmd.strikeP || cmd.strike) && p.strikeCd <= 0 && p.dashT <= 0) {
    p.combo = p.comboT > 0 ? (p.combo + 1) % 3 : 0;
    p.strikeT = P.strikeTime; p.hitSet = new Set(); p.strikeAim = p.aim; SFX.swing();
    p.vx += Math.cos(p.aim) * 160; p.vy += Math.sin(p.aim) * 160;
  }

  // cast
  if (cmd.cast && p.castCd <= 0) {
    p.castCd = P.castCd; SFX.cast();
    const n = lv('tide_cast') ? 1 + 2 * lv('tide_cast') : 1, spread = n > 1 ? 0.5 : 0;
    const pierce = lv('gale_cast') > 0, dmg = P.castDmg * (1 + 0.4 * lv('gale_cast'));
    for (let i = 0; i < n; i++) {
      const a = p.aim + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
      shots.push({ x: p.x + Math.cos(a) * 30, y: p.y - 30 + Math.sin(a) * 30, vx: Math.cos(a) * P.castSpeed, vy: Math.sin(a) * P.castSpeed,
        r: 10, dmg, friendly: true, pierce, hit: new Set(), life: 1.2, color: lv('tide_cast') ? '#8fe3ff' : '#ffb347' });
    }
  }
}
function strikeHits() {
  const P = CFG.player, p = player, c = p.combo;
  const range = P.strikeRange[c], dmg = P.strikeDmg[c] * (1 + 0.2 * lv('pyre_might'));
  for (const e of enemies) {
    if (e.hp <= 0 || p.hitSet.has(e)) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    if (d > range + e.r) continue;
    if (Math.abs(angDiff(Math.atan2(dy, dx), p.strikeAim)) > P.strikeArc / 2 && d > e.r + 10) continue;
    p.hitSet.add(e);
    const k = c === 2 ? 520 : 300;
    damageEnemy(e, dmg, Math.cos(p.strikeAim) * k, Math.sin(p.strikeAim) * k, { strike: true, big: c === 2 });
    hitstop = Math.max(hitstop, CFG.hitstop * (c === 2 ? 1.8 : 1)); shake = Math.max(shake, CFG.shakeHit * (c === 2 ? 1.6 : 1));
    SFX.hit(); burst(e.x, e.y - 20, '#ffcf5a', 8, 260, 0.3, 3);
    if (lv('gale_strike')) chain(e, 1 + lv('gale_strike'), 8 * lv('gale_strike'));
  }
}
function chain(from, count, dmg) {
  let cur = from; const hit = new Set([from]);
  for (let i = 0; i < count; i++) {
    let best = null, bd = 260;
    for (const e of enemies) { if (hit.has(e) || e.hp <= 0) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; best = e; } }
    if (!best) break; hit.add(best);
    parts.push({ bolt: true, x: cur.x, y: cur.y - 30, x2: best.x, y2: best.y - 30, life: 0.15, max: 0.15 });
    damageEnemy(best, dmg, 0, 0, { color: '#ffe35a' }); SFX.zap(); cur = best;
  }
}

// ---------------------------------------------------------------- enemy AI
function updateEnemy(e, dt) {
  const D = ENEMY[e.type], p = player;
  e.flash -= dt; e.anim += dt;
  if (e.burn > 0) { e.burn -= dt; e.burnTick = (e.burnTick || 0) - dt; if (e.burnTick <= 0) { e.burnTick = 0.5; damageEnemy(e, e.burnDps * 0.5, 0, 0, { color: '#ff9a4a' }); }
    if (vrand() < 0.3) parts.push({ x: e.x + rr(-12, 12), y: e.y - rr(10, 50), vx: 0, vy: -50, life: 0.4, max: 0.4, color: '#ff7a2f', size: 4 }); }
  if (e.slow > 0) e.slow -= dt;
  const sp = D.speed * (e.slow > 0 ? 1 - e.slowAmt : 1);
  const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist;
  e.face = dx >= 0 ? 1 : -1;
  e.t -= dt * (e.slow > 0 ? 1 - e.slowAmt * 0.5 : 1);
  if (e.stun > 0) { e.stun -= dt; e.vx *= 0.8; e.vy *= 0.8; integrate(e, dt); return; }

  let mvx = 0, mvy = 0;
  switch (e.type) {
    case 'wisp':
      if (e.st === 'move') { mvx = ux * sp; mvy = uy * sp; if (dist < 150 && e.t <= 0) { e.st = 'wind'; e.t = 0.45; e.dx = ux; e.dy = uy; } }
      else if (e.st === 'wind') { if (e.t <= 0) { e.st = 'lunge'; e.t = 0.26; } }
      else if (e.st === 'lunge') { e.vx = e.dx * 560; e.vy = e.dy * 560; if (dist < e.r + p.r + 6) hurtPlayer(D.dmg, e.x, e.y); if (e.t <= 0) { e.st = 'move'; e.t = rr(0.8, 1.3); } }
      break;
    case 'slinger': {
      const want = dist < 280 ? -1 : dist > 420 ? 1 : 0;
      if (e.st === 'move') { mvx = ux * sp * want + -uy * sp * 0.5 * Math.sin(e.anim); mvy = uy * sp * want + ux * sp * 0.5 * Math.sin(e.anim);
        if (e.t <= 0) { e.st = 'wind'; e.t = 0.55; } }
      else if (e.st === 'wind') { if (e.t <= 0) {
        const a = Math.atan2(dy, dx); for (const o of [-0.18, 0, 0.18]) shots.push({ x: e.x, y: e.y - 40, vx: Math.cos(a + o) * 300, vy: Math.sin(a + o) * 300, r: 11, dmg: D.dmg, friendly: false, life: 3, color: '#c77dff' });
        tone(260, 0.15, 'triangle', 0.12, 120); e.st = 'move'; e.t = rr(1.8, 2.4); } }
      break;
    }
    case 'brute':
      if (e.st === 'move') { mvx = ux * sp; mvy = uy * sp; if (dist < 460 && e.t <= 0) { e.st = 'wind'; e.t = 0.85; e.dx = ux; e.dy = uy; } }
      else if (e.st === 'wind') { e.dx += (ux - e.dx) * dt * 2; e.dy += (uy - e.dy) * dt * 2; const m = Math.hypot(e.dx, e.dy); e.dx /= m; e.dy /= m; if (e.t <= 0) { e.st = 'charge'; e.t = 0.75; SFX.slam(); } }
      else if (e.st === 'charge') {
        e.vx = e.dx * 640; e.vy = e.dy * 640; if (dist < e.r + p.r + 6) hurtPlayer(D.dmg, e.x, e.y);
        const hitWall = e.x <= ROOM.x0 + e.r + 1 || e.x >= ROOM.x1 - e.r - 1 || e.y <= ROOM.y0 + e.r + 1 || e.y >= ROOM.y1 - e.r - 1;
        if (hitWall) { e.stun = 1.4; e.st = 'move'; e.t = 1.8; shake = Math.max(shake, 10); SFX.slam(); burst(e.x, e.y, '#8a94a6', 20, 240); floatText(e.x, e.y - 150, 'STUNNED', '#ffcf5a'); }
        else if (e.t <= 0) { e.st = 'move'; e.t = rr(1.4, 2); }
      }
      break;
    case 'warden': updateWarden(e, dt, ux, uy, dist); mvx = e.mvx || 0; mvy = e.mvy || 0; break;
  }
  if (e.st === 'move' || e.type === 'warden') { e.vx += (mvx - e.vx) * Math.min(1, dt * 6); e.vy += (mvy - e.vy) * Math.min(1, dt * 6); }
  else if (e.st === 'wind') { e.vx *= 0.85; e.vy *= 0.85; }
  // contact damage (soft)
  if (e.st !== 'lunge' && e.st !== 'charge' && dist < e.r + p.r - 4) hurtPlayer(Math.round(D.dmg * 0.5), e.x, e.y);
  integrate(e, dt);
}
function integrate(e, dt) { e.x += e.vx * dt; e.y += e.vy * dt; clampRoom(e); if (e.st !== 'lunge' && e.st !== 'charge') { e.vx *= 0.96; e.vy *= 0.96; } }

function updateWarden(e, dt, ux, uy, dist) {
  const p = player;
  if (e.phase === 1 && e.hp < e.maxHp * 0.5) { e.phase = 2; e.st = 'roar'; e.t = 1.2; shake = 20; SFX.slam(); floatText(e.x, e.y - 260, 'ENRAGED', '#c77dff', 30); }
  e.mvx = e.mvy = 0;
  const pattern = e.phase === 1 ? ['sweep', 'nova', 'sweep', 'summon'] : ['charge', 'sweep', 'nova', 'sweep', 'summon', 'charge'];
  switch (e.st) {
    case 'move': e.mvx = ux * ENEMY.warden.speed * (e.phase === 2 ? 1.3 : 1); e.mvy = uy * ENEMY.warden.speed * (e.phase === 2 ? 1.3 : 1);
      if (e.t <= 0) { e.st = pattern[e.atkIdx++ % pattern.length]; e.t = { sweep: 0.75, nova: 0.9, summon: 0.8, charge: 0.9 }[e.st]; e.dx = ux; e.dy = uy; e.aimA = Math.atan2(uy, ux); e.sub = 0; }
      break;
    case 'roar': if (e.t <= 0) { e.st = 'move'; e.t = 0.6; } break;
    case 'sweep':
      if (dist > 120) { e.mvx = ux * 40; e.mvy = uy * 40; }
      e.aimA += angDiff(Math.atan2(uy, ux), e.aimA) * dt * 1.5;
      if (e.t <= 0) {
        SFX.slam(); shake = Math.max(shake, 14); burst(e.x + Math.cos(e.aimA) * 140, e.y + Math.sin(e.aimA) * 140, '#c77dff', 30, 300);
        const pdx = p.x - e.x, pdy = p.y - e.y, pd = Math.hypot(pdx, pdy);
        if (pd < 220 && Math.abs(angDiff(Math.atan2(pdy, pdx), e.aimA)) < 1.25) hurtPlayer(ENEMY.warden.dmg, e.x, e.y);
        e.sub++; if (e.phase === 2 && e.sub < 2) { e.t = 0.55; } else { e.st = 'move'; e.t = rr(0.9, 1.4) / (e.phase === 2 ? 1.4 : 1); }
      }
      break;
    case 'nova':
      if (e.t <= 0) {
        const n = e.phase === 2 ? 20 : 14, off = e.sub * 0.15;
        for (let i = 0; i < n; i++) { const a = i / n * 6.283 + off; shots.push({ x: e.x, y: e.y - 80, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, r: 12, dmg: 12, friendly: false, life: 4, color: '#c77dff' }); }
        tone(180, 0.4, 'triangle', 0.2, 200); e.sub++;
        if (e.sub < (e.phase === 2 ? 3 : 2)) e.t = 0.5; else { e.st = 'move'; e.t = rr(1, 1.5); }
      }
      break;
    case 'summon':
      if (e.t <= 0) { const n = e.phase === 2 ? 3 : 2; for (let i = 0; i < n; i++) spawns.push({ type: i === 2 ? 'slinger' : 'wisp', x: rr(ROOM.x0 + 100, ROOM.x1 - 100), y: rr(ROOM.y0 + 100, ROOM.y1 - 120), t: 0.9 }); e.st = 'move'; e.t = 1.6; }
      break;
    case 'charge':
      if (e.t > 0) { e.dx += (ux - e.dx) * dt * 3; e.dy += (uy - e.dy) * dt * 3; const m = Math.hypot(e.dx, e.dy); e.dx /= m; e.dy /= m; }
      else {
        if (e.sub === 0) { e.sub = 1; e.ct = 0.7; SFX.slam(); }
        e.ct -= dt; e.mvx = e.dx * 700; e.mvy = e.dy * 700; e.vx = e.mvx; e.vy = e.mvy;
        if (dist < e.r + p.r + 10) hurtPlayer(ENEMY.warden.dmg, e.x, e.y);
        const hitWall = e.x <= ROOM.x0 + e.r + 1 || e.x >= ROOM.x1 - e.r - 1 || e.y <= ROOM.y0 + e.r + 1 || e.y >= ROOM.y1 - e.r - 1;
        if (hitWall || e.ct <= 0) { if (hitWall) { e.stun = 1.2; shake = 18; burst(e.x, e.y, '#8a94a6', 30, 280); floatText(e.x, e.y - 260, 'STUNNED', '#ffcf5a', 28); } e.st = 'move'; e.t = 1.5; e.mvx = e.mvy = 0; }
      }
      break;
  }
}

// ---------------------------------------------------------------- boons
function makeOffers() {
  const pool = BOONS.filter(b => lv(b.id) < MAX_LV);
  const out = [], gods = new Set();
  const shuffled = pool.map(b => [rng(), b]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  for (const b of shuffled) { if (out.length >= 3) break; if (!gods.has(b.god)) { out.push(b); gods.add(b.god); } }
  for (const b of shuffled) { if (out.length >= 3) break; if (!out.includes(b)) out.push(b); }
  if (player.hp < player.maxHp * 0.6 && out.length) out[out.length - 1] = { id: 'heal', god: null, name: 'Ember Draught', desc: () => STR.heal };
  return out;
}
function takeBoon(b) {
  if (b.id === 'heal') player.hp = Math.min(player.maxHp, player.hp + 35);
  else player.boons[b.id] = lv(b.id) + 1;
  SFX.boon(); burst(player.x, player.y - 40, b.god ? GODS[b.god].color : '#ff5a5a', 40, 300, 0.8, 5);
  state = 'play'; doorOpen = true; SFX.door(); banner = STR.doorOpen; bannerT = 3;
}

// ---------------------------------------------------------------- main update
function update(dt) {
  clock += dt;
  pollPad();
  const cmd = readCommand();
  const confirm = wasPressed('confirm') || mouse.lp || padPressed(0) || padPressed(9) || touch.atkP;

  if (state === 'title') { if (confirm) startRun(); clearPressed(); return; }
  if (state === 'dead' || state === 'win') { deathT += dt; tickFx(dt); if (deathT > 0.8 && confirm) startRun(); clearPressed(); return; }
  if (state === 'boon') {
    tickFx(dt);
    if (wasPressed('left') || (pad.mx < -0.5 && !pad.navLock)) offerSel = (offerSel + offers.length - 1) % offers.length;
    if (wasPressed('right') || (pad.mx > 0.5 && !pad.navLock)) offerSel = (offerSel + 1) % offers.length;
    pad.navLock = Math.abs(pad.mx) > 0.5;
    if (wasPressed('one')) takeBoon(offers[0]); else if (wasPressed('two') && offers[1]) takeBoon(offers[1]); else if (wasPressed('three') && offers[2]) takeBoon(offers[2]);
    else if (mouse.lp) { const i = cardAt(mouse.x, mouse.y); if (i >= 0) takeBoon(offers[i]); }
    else if (wasPressed('confirm') || padPressed(0)) takeBoon(offers[offerSel]);
    clearPressed(); return;
  }

  // play
  if (hitstop > 0) { hitstop -= dt; clearPressed(); return; }
  runTime += dt; bannerT -= dt;
  updatePlayer(cmd, dt);

  for (const s of spawns) s.t -= dt;
  for (let i = spawns.length - 1; i >= 0; i--) if (spawns[i].t <= 0) { const s = spawns[i]; spawns.splice(i, 1); spawnEnemy(s.type, s.x, s.y); }

  for (const e of enemies) updateEnemy(e, dt);
  // separation
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = a.r + b.r;
    if (d < min) { const push = (min - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
  }
  // shots
  for (const s of shots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.x < ROOM.x0 || s.x > ROOM.x1 || s.y < ROOM.y0 - 40 || s.y > ROOM.y1) { s.life = 0; burst(s.x, s.y, s.color, 5, 120, 0.25, 3); }
    if (s.life <= 0) continue;
    if (s.friendly) {
      for (const e of enemies) { if (e.hp <= 0 || s.hit.has(e)) continue;
        if (Math.hypot(e.x - s.x, (e.y - 30) - s.y) < e.r + s.r + 10) { s.hit.add(e); damageEnemy(e, s.dmg, s.vx * 0.3, s.vy * 0.3, { color: s.color });
          if (lv('tide_cast')) { e.slow = 1.5; e.slowAmt = 0.35; } SFX.hit(); burst(s.x, s.y, s.color, 8, 200, 0.3); if (!s.pierce) { s.life = 0; break; } } }
    } else if (Math.hypot(player.x - s.x, (player.y - 30) - s.y) < player.r + s.r) { hurtPlayer(s.dmg, s.x, s.y); s.life = 0; }
  }
  shots = shots.filter(s => s.life > 0);
  // fire trail
  for (const f of fires) { f.t -= dt; for (const e of enemies) if (e.hp > 0 && Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.r) { e.fireTick = (e.fireTick || 0) - dt; if (e.fireTick <= 0) { e.fireTick = 0.4; damageEnemy(e, f.dps * 0.4, 0, 0, { color: '#ff9a4a' }); } } }
  fires = fires.filter(f => f.t > 0);
  enemies = enemies.filter(e => e.hp > 0);
  if (boss && boss.hp <= 0) { boss = null; enemies.forEach(e => damageEnemy(e, 9999)); enemies = []; spawns = []; shots = []; setTimeout(win, 1200); state = 'play'; roomCleared = true; }

  // wave / room flow
  if (!roomCleared && enemies.length === 0 && spawns.length === 0) {
    if (waveIdx + 1 < ROOMS[roomIdx].length) { waveIdx++; queueWave(); }
    else if (roomIdx < 5) { roomCleared = true; offers = makeOffers(); offerSel = 0; state = 'boon'; shots = []; }
  }
  if (doorOpen && Math.abs(player.x - W / 2) < 50 && player.y < ROOM.y0 + 40) { enterRoom(roomIdx + 1); }

  tickFx(dt);
  clearPressed();
}
function tickFx(dt) {
  for (const p of parts) { p.life -= dt; if (!p.bolt) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; } }
  parts = parts.filter(p => p.life > 0);
  for (const t of texts) { t.t -= dt; t.y -= 40 * dt; }
  texts = texts.filter(t => t.t > 0);
  shake *= Math.pow(0.001, dt);
}

// ---------------------------------------------------------------- rendering
function drawSprite(name, x, y, h, flip, flashing, sx = 1, sy = 1, rot = 0, alpha = 1) {
  const img = IMG[name]; if (!img || !img.naturalWidth) return;
  const w = h * img.naturalWidth / img.naturalHeight;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot); ctx.scale((flip ? -1 : 1) * sx, sy);
  ctx.drawImage(img, -w / 2, -h, w, h);
  if (flashing && WHITE[name]) { ctx.globalAlpha = 0.6 * alpha; ctx.drawImage(WHITE[name], -w / 2, -h, w, h); }
  ctx.restore();
}
function shadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r * 0.45, 0, 0, 6.283); ctx.fill(); }

function drawRoom() {
  ctx.fillStyle = '#0b0e13'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath(); ctx.rect(ROOM.x0, ROOM.y0, ROOM.x1 - ROOM.x0, ROOM.y1 - ROOM.y0); ctx.clip();
  if (floorPattern) { ctx.fillStyle = floorPattern; ctx.fillRect(ROOM.x0, ROOM.y0, ROOM.x1 - ROOM.x0, ROOM.y1 - ROOM.y0); }
  ctx.fillStyle = `rgba(10,14,22,${0.25 + roomIdx * 0.03})`; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // walls
  const g = ctx.createLinearGradient(0, ROOM.y0 - 60, 0, ROOM.y0); g.addColorStop(0, '#05070a'); g.addColorStop(1, '#1c2430');
  ctx.fillStyle = g; ctx.fillRect(ROOM.x0 - 20, ROOM.y0 - 60, ROOM.x1 - ROOM.x0 + 40, 60);
  ctx.fillStyle = '#141a23'; ctx.fillRect(ROOM.x0 - 20, ROOM.y0, 20, ROOM.y1 - ROOM.y0); ctx.fillRect(ROOM.x1, ROOM.y0, 20, ROOM.y1 - ROOM.y0); ctx.fillRect(ROOM.x0 - 20, ROOM.y1, ROOM.x1 - ROOM.x0 + 40, 16);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeRect(ROOM.x0, ROOM.y0, ROOM.x1 - ROOM.x0, ROOM.y1 - ROOM.y0);
  // door
  const dx = W / 2, dy = ROOM.y0;
  ctx.fillStyle = '#05070a'; ctx.beginPath(); ctx.moveTo(dx - 52, dy); ctx.lineTo(dx - 52, dy - 40); ctx.arc(dx, dy - 40, 52, Math.PI, 0); ctx.lineTo(dx + 52, dy); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#3a4352'; ctx.stroke();
  if (doorOpen) {
    const pulse = 0.6 + 0.4 * Math.sin(clock * 5);
    const rg = ctx.createRadialGradient(dx, dy - 30, 5, dx, dy - 30, 120); rg.addColorStop(0, `rgba(255,207,90,${0.8 * pulse})`); rg.addColorStop(1, 'rgba(255,207,90,0)');
    ctx.fillStyle = rg; ctx.fillRect(dx - 140, dy - 150, 280, 220);
  } else { ctx.fillStyle = 'rgba(199,125,255,0.25)'; ctx.fillRect(dx - 46, dy - 40, 92, 40); }
  // torches
  for (const tx of [ROOM.x0 + 120, ROOM.x0 + 400, ROOM.x1 - 400, ROOM.x1 - 120]) {
    const f = 0.8 + 0.2 * Math.sin(clock * 11 + tx) + 0.1 * vrand();
    const rg = ctx.createRadialGradient(tx, ROOM.y0 - 20, 2, tx, ROOM.y0 - 20, 170 * f); rg.addColorStop(0, 'rgba(255,150,60,0.55)'); rg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = rg; ctx.fillRect(tx - 180, ROOM.y0 - 200, 360, 380);
    ctx.fillStyle = '#ffcf5a'; ctx.beginPath(); ctx.ellipse(tx, ROOM.y0 - 26, 6 * f, 12 * f, 0, 0, 6.283); ctx.fill();
  }
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (state === 'title') { drawTitle(); return; }
  const sx = (vrand() - 0.5) * shake, sy = (vrand() - 0.5) * shake;
  ctx.setTransform(1, 0, 0, 1, sx, sy);
  drawRoom();

  // fire trail
  for (const f of fires) { const a = Math.min(1, f.t); const rg = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r * 1.4);
    rg.addColorStop(0, `rgba(255,170,60,${0.5 * a})`); rg.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.4, 0, 6.283); ctx.fill(); }

  // spawn telegraphs
  for (const s of spawns) { const k = Math.max(0, Math.min(1, 1 - s.t)); ctx.strokeStyle = `rgba(199,125,255,${0.4 + 0.5 * k})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 40 * (0.5 + k), 16 * (0.5 + k), 0, 0, 6.283); ctx.stroke(); }

  // enemy telegraphs (drawn under sprites)
  for (const e of enemies) drawTelegraph(e);

  // depth-sorted actors
  const actors = enemies.slice(); actors.push(player); actors.sort((a, b) => a.y - b.y);
  for (const a of actors) a === player ? drawPlayer() : drawEnemy(a);

  // shots
  for (const s of shots) { ctx.fillStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.45, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; }
  // particles
  for (const p of parts) {
    const a = Math.max(0, p.life / p.max);
    if (p.bolt) { ctx.strokeStyle = `rgba(255,240,140,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y);
      for (let i = 1; i < 6; i++) { const t = i / 6; ctx.lineTo(p.x + (p.x2 - p.x) * t + (vrand() - 0.5) * 24, p.y + (p.y2 - p.y) * t + (vrand() - 0.5) * 24); } ctx.lineTo(p.x2, p.y2); ctx.stroke(); continue; }
    ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  // vignette
  const vg = ctx.createRadialGradient(player.x, player.y - 40, 160, player.x, player.y - 40, 820); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(-20, -20, W + 40, H + 40);
  // floating text
  ctx.textAlign = 'center';
  for (const t of texts) { ctx.globalAlpha = Math.min(1, t.t * 2); ctx.font = `bold ${t.size}px Georgia`; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(t.txt, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.txt, t.x, t.y); }
  ctx.globalAlpha = 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHud();
  if (state === 'boon') drawBoons();
  if (state === 'dead' || state === 'win') drawEnd();
  if (debug) { ctx.fillStyle = '#0f0'; ctx.font = '14px monospace'; ctx.textAlign = 'left'; ctx.fillText(`fps ${fps.toFixed(0)}  ents ${enemies.length} shots ${shots.length} parts ${parts.length}`, 10, H - 10); }
}

function drawPlayer() {
  const p = player, P = CFG.player;
  shadow(p.x, p.y, 20);
  if (p.ward) { ctx.strokeStyle = `rgba(111,211,255,${0.5 + 0.3 * Math.sin(clock * 8)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y - 45, 46, 60, 0, 0, 6.283); ctx.stroke(); }
  const moving = Math.abs(p.moveAnim) > 0.05;
  const bob = moving ? Math.abs(Math.sin(p.moveAnim)) * 6 : Math.sin(clock * 3) * 1.5;
  const squash = moving ? 1 + Math.sin(p.moveAnim * 2) * 0.04 : 1 + Math.sin(clock * 3) * 0.015;
  const lean = p.dashT > 0 ? 0.35 * p.face : (moving ? Math.max(-1, Math.min(1, p.vx / 300)) * 0.12 : 0);
  const blink = p.iframes > 0 && p.dashT <= 0 && Math.floor(clock * 20) % 2 === 0;
  // dash afterimage
  if (p.dashT > 0) for (let i = 1; i <= 3; i++) drawSprite('hero', p.x - p.vx * 0.012 * i, p.y - p.vy * 0.012 * i, P.drawH, p.face < 0, false, 1, 1, lean, 0.25 / i);
  drawSprite('hero', p.x, p.y - bob, P.drawH, p.face < 0, p.flash > 0, 2 - squash, squash, lean, blink ? 0.4 : 1);
  // strike arc
  if (p.strikeT > 0) {
    const prog = 1 - p.strikeT / P.strikeTime, c = p.combo, range = P.strikeRange[c], half = P.strikeArc / 2;
    const dir = c === 1 ? -1 : 1, a0 = p.strikeAim - half * dir, a1 = a0 + (P.strikeArc * Math.min(1, prog * 2.2)) * dir;
    ctx.save(); ctx.translate(p.x, p.y - 36); ctx.globalAlpha = Math.max(0, 1 - prog * 1.1);
    ctx.strokeStyle = c === 2 ? '#fff2b0' : '#ffb347'; ctx.lineWidth = c === 2 ? 16 : 10; ctx.lineCap = 'round'; ctx.shadowColor = '#ff7a2f'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(0, 0, range * 0.85, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke(); ctx.restore();
  }
}
function drawEnemy(e) {
  const D = ENEMY[e.type];
  shadow(e.x, e.y, e.r);
  let sx = 1, sy = 1, yo = 0, rot = 0;
  if (e.type === 'wisp') { yo = 10 + Math.sin(e.anim * 3) * 6; }
  else { const b = Math.sin(e.anim * (e.type === 'warden' ? 2 : 6)); sy = 1 + b * 0.025; sx = 1 - b * 0.02; }
  if (e.st === 'wind') { const s = Math.sin(clock * 40) * 0.03; sx += s; rot = -0.1 * e.face; }
  if (e.st === 'lunge' || e.st === 'charge') rot = 0.2 * e.face;
  if (e.stun > 0) rot = Math.sin(clock * 20) * 0.08;
  const flashing = e.flash > 0 || (e.st === 'wind' && Math.floor(clock * 14) % 2 === 0);
  drawSprite(D.img, e.x, e.y - yo, D.drawH, D.flip && e.face < 0, flashing, sx, sy, rot);
  if (e.slow > 0) { ctx.fillStyle = 'rgba(111,211,255,0.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.3, e.r * 0.5, 0, 0, 6.283); ctx.fill(); }
  if (e.stun > 0) { for (let i = 0; i < 3; i++) { const a = clock * 5 + i * 2.09; ctx.fillStyle = '#ffcf5a'; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * 24, e.y - D.drawH - 6 + Math.sin(a) * 6, 4, 0, 6.283); ctx.fill(); } }
  if (e.type !== 'warden' && e.hp < e.maxHp) { const w = 50; ctx.fillStyle = '#000'; ctx.fillRect(e.x - w / 2 - 1, e.y - D.drawH - 14, w + 2, 6); ctx.fillStyle = '#c77dff'; ctx.fillRect(e.x - w / 2, e.y - D.drawH - 13, w * e.hp / e.maxHp, 4); }
}
function drawTelegraph(e) {
  ctx.save();
  if (e.type === 'wisp' && e.st === 'wind') { ctx.strokeStyle = 'rgba(255,90,90,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + e.dx * 150, e.y + e.dy * 150); ctx.stroke(); }
  if ((e.type === 'brute' || (e.type === 'warden' && e.st === 'charge' && e.t > 0)) && e.st === (e.type === 'brute' ? 'wind' : 'charge')) {
    const len = e.type === 'warden' ? 900 : 700; ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(e.dy, e.dx));
    ctx.fillStyle = `rgba(255,60,60,${0.15 + 0.15 * Math.sin(clock * 20)})`; ctx.fillRect(0, -e.r, len, e.r * 2);
    ctx.strokeStyle = 'rgba(255,90,90,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(0, -e.r, len, e.r * 2);
  }
  if (e.type === 'warden' && e.st === 'sweep') {
    const k = 1 - Math.max(0, e.t) / 0.75; ctx.fillStyle = `rgba(255,60,60,${0.12 + 0.3 * k})`; ctx.strokeStyle = 'rgba(255,90,90,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, 220, e.aimA - 1.25, e.aimA + 1.25); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (e.type === 'warden' && e.st === 'nova') { ctx.strokeStyle = `rgba(199,125,255,${0.3 + 0.4 * Math.sin(clock * 25)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(e.x, e.y - 80, 70, 0, 6.283); ctx.stroke(); }
  if (e.type === 'slinger' && e.st === 'wind') { ctx.fillStyle = 'rgba(199,125,255,0.7)'; ctx.beginPath(); ctx.arc(e.x, e.y - 50, 8 + (0.55 - e.t) * 20, 0, 6.283); ctx.fill(); }
  ctx.restore();
}

function bar(x, y, w, h, frac, col, bg = '#1a0f0f') {
  ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4); ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, frac), h);
}
function drawHud() {
  const p = player;
  // health
  bar(24, H - 44, 260, 20, p.hp / p.maxHp, '#d9452b');
  ctx.font = 'bold 16px Georgia'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 32, H - 29);
  // dash & cast readiness
  const dashReady = p.dashCd <= 0, castFrac = 1 - Math.max(0, p.castCd) / CFG.player.castCd;
  ctx.fillStyle = dashReady ? '#ff9a4a' : '#4a3020'; ctx.beginPath(); ctx.arc(310, H - 34, 12, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(370, H - 34, 12, -Math.PI / 2, -Math.PI / 2 + castFrac * 6.283); ctx.stroke();
  ctx.font = '12px Georgia'; ctx.fillStyle = '#c9b89a'; ctx.textAlign = 'center'; ctx.fillText('DASH', 310, H - 10); ctx.fillText('CAST', 370, H - 10);
  // boons
  let bx = 410;
  for (const b of BOONS) { const l = lv(b.id); if (!l) continue; const ic = IMG[GODS[b.god].icon];
    if (ic.naturalWidth) ctx.drawImage(ic, bx, H - 58, 42, 42);
    ctx.font = 'bold 12px Georgia'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(l, bx + 36, H - 18); bx += 48; }
  // chamber label
  ctx.textAlign = 'right'; ctx.font = 'bold 18px Georgia'; ctx.fillStyle = '#c9b89a'; ctx.fillText(STR.chamber(roomIdx + 1), W - 24, H - 24);
  // boss bar
  if (boss) { bar(W / 2 - 300, 24, 600, 16, boss.hp / boss.maxHp, '#9b4dff', '#120a1a');
    ctx.textAlign = 'center'; ctx.font = 'bold 16px Georgia'; ctx.fillStyle = '#e8d8ff'; ctx.fillText(STR.bossName, W / 2, 62); }
  // banner
  if (bannerT > 0 && state === 'play') { ctx.globalAlpha = Math.min(1, bannerT); ctx.textAlign = 'center'; ctx.font = 'bold 34px Georgia';
    ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(banner, W / 2, H / 2 - 120); ctx.fillStyle = '#ffcf5a'; ctx.fillText(banner, W / 2, H / 2 - 120); ctx.globalAlpha = 1; }
}

const CARD = { w: 320, h: 360, gap: 40, y: 200 };
function cardRect(i) { const n = offers.length, total = n * CARD.w + (n - 1) * CARD.gap, x = (W - total) / 2 + i * (CARD.w + CARD.gap); return { x, y: CARD.y, w: CARD.w, h: CARD.h }; }
function cardAt(x, y) { for (let i = 0; i < offers.length; i++) { const r = cardRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i; } return -1; }
function wrapText(t, x, y, maxW, lh) { const words = t.split(' '); let line = ''; for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; } else line = test; } ctx.fillText(line, x, y); }
function drawBoons() {
  ctx.fillStyle = 'rgba(4,5,8,0.78)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.font = 'bold 38px Georgia'; ctx.fillStyle = '#ffcf5a'; ctx.fillText(STR.chooseBlessing, W / 2, 130);
  ctx.font = '16px Georgia'; ctx.fillStyle = '#8a94a6'; ctx.fillText(STR.chooseHint, W / 2, 162);
  const hover = cardAt(mouse.x, mouse.y); if (hover >= 0) offerSel = hover;
  offers.forEach((b, i) => {
    const r = cardRect(i), sel = i === offerSel, col = b.god ? GODS[b.god].color : '#ff5a5a';
    ctx.fillStyle = sel ? '#1d1712' : '#120f0c'; ctx.fillRect(r.x, r.y - (sel ? 8 : 0), r.w, r.h);
    ctx.strokeStyle = col; ctx.lineWidth = sel ? 4 : 2; ctx.strokeRect(r.x, r.y - (sel ? 8 : 0), r.w, r.h);
    const oy = r.y - (sel ? 8 : 0);
    if (b.god) { const ic = IMG[GODS[b.god].icon]; if (ic.naturalWidth) ctx.drawImage(ic, r.x + r.w / 2 - 56, oy + 24, 112, 112); }
    else { ctx.fillStyle = '#d9452b'; ctx.beginPath(); ctx.arc(r.x + r.w / 2, oy + 80, 44, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px Georgia'; ctx.fillText('+', r.x + r.w / 2, oy + 94); }
    ctx.font = 'bold 15px Georgia'; ctx.fillStyle = col; ctx.fillText(b.god ? `BLESSING OF ${GODS[b.god].name.toUpperCase()}` : 'RESPITE', r.x + r.w / 2, oy + 170);
    ctx.font = 'bold 26px Georgia'; ctx.fillStyle = '#f3e6d0'; ctx.fillText(b.name, r.x + r.w / 2, oy + 206);
    const next = b.id === 'heal' ? 1 : lv(b.id) + 1;
    if (b.id !== 'heal') { ctx.font = '14px Georgia'; ctx.fillStyle = '#ffcf5a'; ctx.fillText(lv(b.id) ? `${STR.lv(lv(b.id))} → ${next}` : 'NEW', r.x + r.w / 2, oy + 232); }
    ctx.font = '18px Georgia'; ctx.fillStyle = '#c9b89a'; wrapText(b.desc(next), r.x + r.w / 2, oy + 268, r.w - 40, 24);
    ctx.font = 'bold 18px Georgia'; ctx.fillStyle = '#5c6370'; ctx.fillText(String(i + 1), r.x + r.w / 2, oy + r.h - 16);
  });
}
function drawTitle() {
  if (IMG.title.naturalWidth) ctx.drawImage(IMG.title, 0, 0, W, H); else { ctx.fillStyle = '#0b0e13'; ctx.fillRect(0, 0, W, H); }
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0.85)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.font = 'bold 96px Georgia'; ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.strokeText(STR.title, W / 2, 250);
  const tg = ctx.createLinearGradient(0, 170, 0, 260); tg.addColorStop(0, '#ffe39a'); tg.addColorStop(1, '#ff7a2f'); ctx.fillStyle = tg; ctx.fillText(STR.title, W / 2, 250);
  ctx.font = 'italic 24px Georgia'; ctx.fillStyle = '#f3e6d0'; ctx.fillText(STR.tagline, W / 2, 300);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 330, 548, 660, 150);
  ctx.font = 'bold 22px Georgia'; ctx.fillStyle = `rgba(255,207,90,${0.6 + 0.4 * Math.sin(clock * 3)})`; ctx.fillText(STR.start, W / 2, 580);
  ctx.font = '16px Georgia'; ctx.fillStyle = '#c9b89a'; STR.controls.forEach((c, i) => ctx.fillText(c, W / 2, 618 + i * 22));
  const best = store.get('best', 0), wins = store.get('wins', 0);
  if (best) { ctx.textAlign = 'right'; ctx.fillStyle = '#8a94a6'; ctx.fillText(`${STR.best(best)}   ${STR.wins(wins)}`, W - 20, 30); }
}
function drawEnd() {
  const a = Math.min(1, deathT * 1.5); ctx.fillStyle = `rgba(0,0,0,${0.75 * a})`; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = a;
  ctx.textAlign = 'center'; ctx.font = 'bold 64px Georgia'; ctx.fillStyle = state === 'win' ? '#ffcf5a' : '#d9452b'; ctx.fillText(state === 'win' ? STR.won : STR.died, W / 2, H / 2 - 40);
  ctx.font = '22px Georgia'; ctx.fillStyle = '#f3e6d0'; ctx.fillText(STR.reached(roomIdx + 1, runTime.toFixed(0)), W / 2, H / 2 + 10);
  let bx = W / 2 - Object.keys(player.boons).length * 24;
  for (const b of BOONS) { const l = lv(b.id); if (!l) continue; const ic = IMG[GODS[b.god].icon]; if (ic.naturalWidth) ctx.drawImage(ic, bx, H / 2 + 34, 40, 40); bx += 48; }
  if (deathT > 0.8) { ctx.font = 'bold 22px Georgia'; ctx.fillStyle = '#ffcf5a'; ctx.fillText(STR.again, W / 2, H / 2 + 120); }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- loop (fixed timestep, render decoupled)
let last = performance.now(), acc = 0, fps = 60;
function frame(now) {
  const elapsed = Math.min(0.1, (now - last) / 1000); last = now; acc += elapsed; fps = fps * 0.95 + (1 / Math.max(elapsed, 1e-4)) * 0.05;
  requestAnimationFrame(frame);
  try { while (acc >= CFG.dt) { update(CFG.dt); acc -= CFG.dt; } render(); }
  catch (err) { acc = 0; console.error(err); }
}
// test hook: lets automated checks drive the game
window.__cinder = { get state() { return state; }, get player() { return player; }, get enemies() { return enemies; }, get room() { return roomIdx; },
  startRun, skipRoom: () => { enemies = []; spawns = []; }, takeBoon: i => takeBoon(offers[i]) };
requestAnimationFrame(frame);
})();

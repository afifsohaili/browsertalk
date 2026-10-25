const FPS = 30;
const BPM = 140;
const BEAT = 60 / BPM;
const B = (n) => n * BEAT;
const DURATION = B(71);

const stage = document.getElementById('stage');
const flashEl = document.getElementById('flash');
const grainEl = document.getElementById('grain');
const cursorEl = document.getElementById('cursor');
const rippleEl = cursorEl.querySelector('.click-ripple');

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
const typed = (text, t, start, dur) => text.slice(0, Math.floor(text.length * clamp((t - start) / dur, 0, 1)));

const M = {};

function rectOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
}

function relative(r, base) {
  return { x: r.x - base.x, y: r.y - base.y, w: r.w, h: r.h, cx: r.cx - base.x, cy: r.cy - base.y };
}

function measure() {
  document.querySelectorAll('.shot').forEach((s) => { s.style.display = 'block'; s.style.visibility = 'hidden'; });
  document.querySelectorAll('.scene').forEach((s) => { s.style.transform = 'none'; });

  const browser = rectOf(document.querySelector('#s-loop .loop-browser'));
  M.browser = browser;
  const bugBrowser = rectOf(document.querySelector('.bug-browser'));
  M.bugBtn = relative(rectOf(document.getElementById('upgrade-btn')), bugBrowser);
  M.bugBtnAbs = rectOf(document.getElementById('upgrade-btn'));
  M.arm = relative(rectOf(document.getElementById('arm-btn')), browser);
  M.upgrade = relative(rectOf(document.getElementById('upgrade-btn-2')), browser);
  M.panel = rectOf(document.getElementById('loop-panel'));

  document.querySelectorAll('.shot').forEach((s) => { s.style.display = ''; s.style.visibility = ''; });
}

const SHOT_IDS = ['s-bug', 's-blind', 's-pain', 's-breather', 's-logo', 's-tagline', 's-loop', 's-agent', 's-prompt', 's-end'];
const shots = {};
SHOT_IDS.forEach((id) => { shots[id] = document.getElementById(id); });

const SHOTS = [
  { id: 's-bug', start: B(0), end: B(4), render: renderBug },
  { id: 's-blind', start: B(4), end: B(7), render: renderBlind },
  { id: 's-pain', start: B(7), end: B(14), render: renderPain },
  { id: 's-breather', start: B(14), end: B(21), render: renderBreather },
  { id: 's-logo', start: B(21), end: B(23), render: renderLogo },
  { id: 's-tagline', start: B(23), end: B(27), render: renderTagline },
  { id: 's-loop', start: B(27), end: B(48), render: renderLoop },
  { id: 's-agent', start: B(48), end: B(55), render: renderAgent },
  { id: 's-prompt', start: B(55), end: B(65), render: renderPrompt },
  { id: 's-end', start: B(65), end: B(71), render: renderEnd },
];

function setCamera(shot, s, cx, cy, shakeAmount = 1) {
  const scene = shot.querySelector('.scene');
  const sh = shakeAt(globalTime, shakeAmount);
  const tx = 640 - cx * s + sh.x;
  const ty = 360 - cy * s + sh.y;
  scene.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
}

function cameraKeys(shot, keys, local, shakeAmount = 1) {
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (local >= keys[i].t && local <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
  }
  const p = a === b ? 0 : easeInOut(clamp((local - a.t) / (b.t - a.t), 0, 1));
  setCamera(shot, lerp(a.s, b.s, p), lerp(a.x, b.x, p), lerp(a.y, b.y, p), shakeAmount);
}

function shakeAt(t, amount = 1) {
  const hits = [B(21), B(23), B(48), B(55), B(65)];
  let x = 0;
  let y = 0;
  hits.forEach((h) => {
    if (t < h) return;
    const d = t - h;
    const decay = Math.exp(-d * 11) * amount;
    x += Math.sin(d * 95) * 9 * decay;
    y += Math.cos(d * 130) * 7 * decay;
  });
  return { x, y };
}

function animateIn(shot, local) {
  shot.querySelectorAll('[data-start]').forEach((node) => {
    const s = parseFloat(node.dataset.start);
    const e = node.dataset.end ? parseFloat(node.dataset.end) : 1e9;
    if (local < s || local >= e) { node.style.opacity = '0'; return; }
    const p = clamp((local - s) / 0.08, 0, 1);
    const base = node.dataset.base || '';
    const fade = node.dataset.fade === '1' && node.dataset.end
      ? clamp((parseFloat(node.dataset.end) - local) / 0.2, 0, 1)
      : 1;
    node.style.opacity = String(Math.min(1, p * 3) * fade);
    node.style.transform = `${base} scale(${0.78 + 0.22 * easeOutBack(p)})`;
  });
}

function showCursor(x, y, visible = true, scale = 1.15) {
  cursorEl.style.display = visible ? 'block' : 'none';
  if (!visible) return;
  cursorEl.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function clickRipple(local, clicks) {
  let active = null;
  clicks.forEach((c) => { if (local >= c && local < c + 0.32) active = c; });
  if (active === null) { rippleEl.style.opacity = '0'; return; }
  const p = clamp((local - active) / 0.32, 0, 1);
  rippleEl.style.opacity = String(1 - p);
  rippleEl.style.transform = `translate(-50%,-50%) scale(${0.25 + p * 2.6})`;
}

function setPanelState(step) {
  const outbox = document.getElementById('p-outbox');
  const sent = document.getElementById('p-sent');
  const note = document.getElementById('p-note');
  if (step === 0) {
    outbox.className = 'p-empty';
    outbox.textContent = 'Nothing waiting.';
    sent.className = 'p-empty';
    sent.textContent = 'Nothing sent yet.';
    note.textContent = '';
  } else if (step === 1) {
    outbox.className = '';
    outbox.innerHTML = '<div class="p-item"><span class="t">this overlaps the badge on mobile</span><span class="m">10:42 · acme.supply/pricing</span></div>';
    sent.className = 'p-empty';
    sent.textContent = 'Nothing sent yet.';
    note.textContent = 'Queued';
  } else if (step === 2) {
    outbox.className = 'p-empty';
    outbox.textContent = 'Nothing waiting.';
    sent.className = '';
    sent.innerHTML = '<div class="p-item sent"><span class="t">this overlaps the badge on mobile</span><span class="m">10:42 · Browsertalk · acme-web · 2026-10-19</span></div>';
    note.textContent = 'Queued';
  }
}

let panelStep = -1;
let globalTime = 0;
let activeId = null;

function renderFrame(t) {
  globalTime = t;
  const shot = SHOTS.find((s) => t >= s.start && t < s.end) || SHOTS[SHOTS.length - 1];
  const local = t - shot.start;
  const hud = document.getElementById('preview-hud');
  if (hud.style.display !== 'none') hud.textContent = `${t.toFixed(2)}s · ${shot.id.replace('s-', '')} · beat ${(t / BEAT).toFixed(1)}`;

  if (activeId !== shot.id) {
    SHOT_IDS.forEach((id) => { shots[id].classList.toggle('active', id === shot.id); });
    const scene = shots[shot.id].querySelector('.scene');
    if (cursorEl.parentElement !== scene) scene.appendChild(cursorEl);
    activeId = shot.id;
  }

  shot.render(local, clamp(local / (shot.end - shot.start), 0, 1));
  animateIn(shots[shot.id], local);

  const clean = shot.id === 's-tagline';
  document.getElementById('scanlines').style.opacity = clean ? '0.03' : '0.12';
  document.getElementById('vignette').style.opacity = clean ? '0' : '1';

  flashEl.style.opacity = String(flashAt(t));
  grainEl.style.backgroundPosition = `${(Math.floor(t * FPS) * 37) % 160}px ${(Math.floor(t * FPS) * 73) % 160}px`;
}

function flashAt(t) {
  const hits = [B(21), B(23), B(48), B(55), B(65)];
  let v = 0;
  hits.forEach((h) => {
    if (t >= h && t < h + 0.07) v = Math.max(v, 1 - (t - h) / 0.07);
  });
  return v * 0.45;
}

function renderBug(local, u) {
  const shot = shots['s-bug'];
  setCamera(shot, 1 + 0.035 * easeOutCubic(clamp(local / 1.7, 0, 1)), 640, 360, 0.4);

  const anno = document.getElementById('bug-anno');
  anno.style.display = local > 0.28 ? 'block' : 'none';
  anno.style.left = `${M.bugBtn.cx - 168}px`;
  anno.style.top = `${M.bugBtn.cy - 96}px`;
  const p = clamp((local - 0.28) / 0.45, 0, 1);
  anno.querySelectorAll('path, ellipse').forEach((el) => {
    const len = 420;
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len * (1 - p));
  });

  const start = { x: 1120, y: 690 };
  const end = { x: M.bugBtnAbs.cx + 24, y: M.bugBtnAbs.cy + 8 };
  const q = easeInOut(clamp((local - 0.05) / 0.7, 0, 1));
  showCursor(lerp(start.x, end.x, q), lerp(start.y, end.y, q), local < 1.55);
  clickRipple(local, [1.5]);
}

function renderBlind(local, u) {
  const shot = shots['s-blind'];
  setCamera(shot, 1 + 0.03 * easeOutCubic(clamp(local / 1.28, 0, 1)), 640, 360, 0.2);

  const win = shot.querySelector('.mini-term');
  win.style.transform = `translateY(${lerp(18, 0, easeOutCubic(clamp(local / 0.16, 0, 1)))}px)`;
  win.style.opacity = String(clamp(local / 0.1, 0, 1));

  const text = typed('Which button?', local, 0.05, 0.4);
  document.getElementById('blind-text').textContent = text;
  const caretOn = Math.floor(local * 4) % 2 === 0 || text.length < 12;
  shot.querySelector('.caret').style.opacity = caretOn ? '1' : '0';
  showCursor(0, 0, false);
}

function renderPain(local, u) {
  const shot = shots['s-pain'];
  const panel = clamp(Math.floor(local / 0.5), 0, 5);
  shot.querySelectorAll('.pain-panel').forEach((p) => p.classList.toggle('on', Number(p.dataset.panel) === panel));

  const phase = (local % 0.5) / 0.5;
  const kick = 1 + 0.045 * (1 - easeOutCubic(Math.min(phase / 0.18, 1)));
  setCamera(shot, kick, 640, 360, 0.8);

  if (panel === 3) {
    const lines = document.getElementById('paste-lines');
    const txt = '## Browser feedback — acme-web\nComment: the button looks weird\nElement: button.upgrade\n  selector  main > .card.pro > button.upgrade\n  box       184×44 @ (652,498)\nPage: https://acme.supply/pricing?plan=pro';
    lines.textContent = typed(txt, phase, 0, 0.55);
  }
  showCursor(0, 0, false);
}

function renderBreather(local, u) {
  const shot = shots['s-breather'];
  const text = document.getElementById('breather-text');
  const rule = document.getElementById('breather-rule');

  const p = easeOutCubic(clamp(local / 0.35, 0, 1));
  text.style.opacity = String(p);
  text.style.transform = `translateY(${(1 - p) * 18}px)`;

  const r = easeOutCubic(clamp((local - 0.12) / 0.4, 0, 1));
  rule.style.opacity = String(r);
  rule.style.transform = `scaleX(${r})`;

  setCamera(shot, 1 + 0.02 * easeOutCubic(clamp(local / 3, 0, 1)), 640, 360, 0);
  showCursor(0, 0, false);
}

function renderLogo(local, u) {
  const shot = shots['s-logo'];
  const p = clamp(local / 0.4, 0, 1);
  const icon = document.getElementById('logo-icon');
  icon.style.transform = `scale(${0.3 + 0.7 * easeOutBack(p)}) rotate(${lerp(-12, 0, p)}deg)`;

  const word = shot.querySelector('.logo-word');
  const wp = clamp((local - 0.04) / 0.22, 0, 1);
  word.style.opacity = String(clamp(wp * 3, 0, 1));
  word.style.transform = `scale(${0.82 + 0.18 * easeOutBack(wp)})`;
  word.style.letterSpacing = `${lerp(0.18, -0.055, easeOutCubic(wp))}em`;

  const rays = shot.querySelector('.rays');
  rays.style.transform = `rotate(${local * 12}deg) scale(1.05)`;
  setCamera(shot, 1 + 0.03 * easeOutCubic(local / 0.85), 640, 360, 1.6);
  showCursor(0, 0, false);
}

function renderTagline(local, u) {
  const shot = shots['s-tagline'];
  const step = Math.min(2, Math.floor(local / (BEAT * 1.333)));
  const words = [0, 1, 2].map((i) => document.getElementById(`tag-word-${i}`));
  words.forEach((w, i) => {
    const start = i * BEAT * 1.333;
    const p = clamp((local - start) / 0.14, 0, 1);
    w.style.opacity = i === step && local >= start ? '1' : '0';
    w.style.transform = `scale(${0.7 + 0.3 * easeOutBack(p)}) translateY(${(1 - p) * 24}px)`;
  });
  const sub = document.getElementById('tag-sub');
  const sp = clamp((local - BEAT * 2.2) / 0.2, 0, 1);
  sub.style.opacity = String(sp);
  sub.style.transform = `translateY(${(1 - sp) * 18}px)`;
  const hue = local * 20;
  shot.querySelector('.scene').style.background = `radial-gradient(circle at 50% 40%, hsl(${250 + Math.sin(local * 2) * 12} 70% 28%), #0b0b10 62%)`;
  setCamera(shot, 1 + 0.02 * easeOutCubic(local / 1.7), 640, 360, 0.2);
  showCursor(0, 0, false);
}

function renderLoop(local, u) {
  const shot = shots['s-loop'];
  const panel = document.getElementById('loop-panel');
  const arm = document.getElementById('arm-btn');
  const picker = document.getElementById('picker');
  const box = document.getElementById('picker-box');
  const tag = document.getElementById('picker-tag');
  const composer = document.getElementById('composer');
  const composerText = document.getElementById('composer-text');
  const sendBtn = document.getElementById('composer-send');
  const up = M.upgrade;

  const slide = easeOutCubic(clamp(local / 0.35, 0, 1));
  panel.style.transform = `translateX(${lerp(340, 0, slide)}px)`;
  panel.style.opacity = String(slide);

  const armHot = local > 1.2 && local < 2.05;
  arm.classList.toggle('pulse', armHot);

  const pickerOn = local > 2.05 && local < 3.4;
  picker.style.display = pickerOn ? 'block' : 'none';
  if (pickerOn) {
    box.style.left = `${up.x - 4}px`;
    box.style.top = `${up.y - 4}px`;
    box.style.width = `${up.w + 8}px`;
    box.style.height = `${up.h + 8}px`;
    tag.style.left = `${up.x}px`;
    tag.style.top = `${up.y - 24}px`;
  }

  const composerOn = local > 3.0 && local < 5.5;
  composer.style.display = composerOn ? 'block' : 'none';
  if (composerOn) {
    const w = 300;
    const h = 132;
    const left = clamp(up.x - w - 18, 12, 880 - w - 12);
    const top = clamp(up.y - 46, 50, 606 - h - 10);
    composer.style.left = `${left}px`;
    composer.style.top = `${top}px`;
    composerText.textContent = typed('this overlaps the badge on mobile', local, 3.2, 1.5);
    sendBtn.classList.toggle('hot', local > 5.1 && local < 5.5);
  }

  const step = local < 5.45 ? 0 : local < 6.6 ? 1 : 2;
  if (step !== panelStep) { setPanelState(step); panelStep = step; }

  const armPos = { x: M.browser.x + M.arm.cx, y: M.browser.y + M.arm.cy };
  const upPos = { x: M.browser.x + up.cx, y: M.browser.y + up.cy };
  const sendPos = { x: M.browser.x + composer.offsetLeft + 250, y: M.browser.y + composer.offsetTop + 104 };

  let cx = 1120;
  let cy = 700;
  if (local > 0.8 && local < 2.05) {
    const q = easeInOut(clamp((local - 0.8) / 1.2, 0, 1));
    cx = lerp(1120, armPos.x + 8, q); cy = lerp(700, armPos.y + 8, q);
  } else if (local >= 2.05 && local < 3.0) {
    const q = easeInOut(clamp((local - 2.05) / 0.85, 0, 1));
    cx = lerp(armPos.x + 8, upPos.x + 10, q); cy = lerp(armPos.y + 8, upPos.y + 10, q);
  } else if (local >= 3.0 && local < 5.3) {
    const q = easeInOut(clamp((local - 3.0) / 2.0, 0, 1));
    cx = lerp(upPos.x + 10, sendPos.x, q); cy = lerp(upPos.y + 10, sendPos.y, q);
  } else if (local >= 5.3) {
    cx = sendPos.x; cy = sendPos.y;
  }
  showCursor(cx, cy, local < 5.7);
  clickRipple(local, [2.0, 2.9, 5.3]);

  const pk = (x, y) => ({ x, y });
  const anchorX = (s) => 1240 - 640 / s;
  cameraKeys(shot, [
    { t: 0, s: 1, ...pk(640, 360) },
    { t: 0.675, s: 1, ...pk(640, 360) },
    { t: 1.35, s: 1.2, ...pk(anchorX(1.2), 330) },
    { t: 2.0, s: 1.2, ...pk(anchorX(1.2), 330) },
    { t: 2.4, s: 1.25, ...pk(anchorX(1.25), 420) },
    { t: 3.0, s: 1.25, ...pk(anchorX(1.25), 420) },
    { t: 3.75, s: 1.25, ...pk(anchorX(1.25), 380) },
    { t: 4.95, s: 1.25, ...pk(anchorX(1.25), 380) },
    { t: 5.475, s: 1, ...pk(640, 360) },
    { t: 6.15, s: 1, ...pk(640, 360) },
    { t: 6.675, s: 1.3, ...pk(anchorX(1.3), 420) },
    { t: 7.65, s: 1.3, ...pk(anchorX(1.3), 420) },
    { t: 8.175, s: 1.1, ...pk(anchorX(1.1), 380) },
    { t: 9.0, s: 1.1, ...pk(anchorX(1.1), 380) },
  ], local, 1);

  const facts = document.querySelectorAll('.fact');
  const positions = [
    { x: 455, y: 170 }, { x: 720, y: 135 }, { x: 430, y: 248 },
    { x: 800, y: 285 }, { x: 500, y: 360 }, { x: 900, y: 400 },
  ];
  facts.forEach((f, i) => {
    const start = 7.8 + i * 0.1;
    const p = clamp((local - start) / 0.16, 0, 1);
    if (local < start) { f.style.opacity = '0'; return; }
    const pos = positions[i];
    const from = { x: 1030, y: 470 };
    f.style.opacity = String(clamp(p * 2, 0, 1));
    f.style.transform = `translate(${lerp(from.x, pos.x, easeOutBack(p))}px, ${lerp(from.y, pos.y, easeOutBack(p))}px) rotate(${(i % 2 === 0 ? -1 : 1) * 3}deg) scale(${0.8 + 0.2 * p})`;
  });
}

const AGENT_TEXT = 'found it. the badge is absolutely positioned over the button.';

function renderAgent(local, u) {
  const shot = shots['s-agent'];
  const reply = document.getElementById('agent-reply');
  const line1 = document.getElementById('agent-line-1');
  const line2 = document.getElementById('agent-line-2');
  const pip = document.getElementById('bg-pip');

  const pp = clamp(local / 0.3, 0, 1);
  pip.style.opacity = String(pp);
  pip.style.transform = `translateY(${(1 - pp) * 16}px) scale(${0.96 + 0.04 * pp})`;

  const p = clamp((local - 0.45) / 0.7, 0, 1);
  reply.style.opacity = String(p);
  reply.style.transform = `translateY(${(1 - p) * 12}px)`;
  line1.textContent = typed(AGENT_TEXT, local, 0.45, 0.7);
  line2.textContent = local > 1.15 ? 'components/UpgradeButton.vue:42' : '';
  line2.style.opacity = local > 1.15 ? '1' : '0';

  cameraKeys(shot, [
    { t: 0, s: 1, x: 640, y: 360 },
    { t: 0.5, s: 1.02, x: 640, y: 360 },
    { t: 3.0, s: 1.02, x: 640, y: 360 },
  ], local, 0.4);
  showCursor(0, 0, false);
}

const PROMPT_LINES = [
  '<span class="k">## Browser feedback — acme-web</span>',
  '',
  'Comment: <span class="k">this overlaps the badge on mobile</span>',
  '',
  'Element: <span class="k">button.upgrade</span> — "Upgrade"',
  '<span class="d">  selector</span>  main &gt; .card.pro &gt; button.upgrade',
  '<span class="d">  box</span>       184×44 @ (652,498) · viewport 1440×900',
  '<span class="d">  attrs</span>     class="upgrade" data-testid="upgrade"',
  '',
  'Page: <span class="g">https://acme.supply/pricing?plan=pro</span>',
  '<span class="d">  title</span>     Pricing — acme',
  '',
  '<span class="d">Sent by Browsertalk · 10:42</span>',
];

function renderPrompt(local, u) {
  const shot = shots['s-prompt'];
  const card = shot.querySelector('.prompt-card');
  const pre = document.getElementById('prompt-pre');
  if (pre.dataset.built !== '1') {
    pre.innerHTML = PROMPT_LINES.map((l, i) => `<div class="pline" data-line="${i}">${l || '&nbsp;'}</div>`).join('');
    pre.dataset.built = '1';
  }
  pre.querySelectorAll('.pline').forEach((line, i) => {
    const q = clamp((local - 0.05 - i * 0.06) / 0.12, 0, 1);
    line.style.opacity = String(q);
    line.style.transform = `translateY(${(1 - q) * 8}px)`;
  });

  const lines = pre.querySelectorAll('.pline');
  if (lines[2]) lines[2].style.background = local > 1.5 && local < 2.4 ? 'rgba(255,225,77,.14)' : 'transparent';
  if (lines[5]) lines[5].style.background = local > 2.4 ? 'rgba(109,92,255,.22)' : 'transparent';

  const chip = document.getElementById('prompt-chip');
  const cp = clamp((local - 2.55) / 0.15, 0, 1);
  chip.style.opacity = String(cp);
  chip.style.transform = `scale(${0.7 + 0.3 * easeOutBack(cp)})`;

  card.style.transform = `translateY(${(1 - easeOutCubic(clamp(local / 0.35, 0, 1))) * 18}px)`;
  card.style.opacity = String(clamp(local / 0.2, 0, 1));

  setCamera(shot, 1 + 0.03 * easeOutCubic(clamp(local / 4.2, 0, 1)), 640, 360, 0.3);
  showCursor(0, 0, false);
}

function renderEnd(local, u) {
  const shot = shots['s-end'];
  const p = clamp(local / 0.25, 0, 1);
  const icon = shot.querySelector('.end-icon');
  const word = shot.querySelector('.end-word');
  const tag = shot.querySelector('.end-tag');
  const meta = shot.querySelector('.end-meta');
  const stamp = document.getElementById('end-stamp');

  icon.style.transform = `translateX(-50%) scale(${0.7 + 0.3 * easeOutBack(p)})`;
  word.style.opacity = String(clamp((local - 0.06) / 0.18, 0, 1));
  word.style.transform = `translateY(${(1 - clamp((local - 0.06) / 0.22, 0, 1)) * 14}px)`;

  const tp = clamp((local - 0.45) / 0.2, 0, 1);
  tag.style.opacity = String(tp);
  tag.style.transform = `translateY(${(1 - tp) * 10}px)`;
  meta.style.opacity = String(clamp((local - 0.55) / 0.2, 0, 1));

  const sp = clamp((local - 0.78) / 0.12, 0, 1);
  stamp.style.opacity = String(sp);
  stamp.style.transform = `translateX(-50%) rotate(${lerp(-8, -2, easeOutBack(sp))}deg) scale(${0.7 + 0.3 * easeOutBack(sp)})`;

  setCamera(shot, 1 + 0.02 * easeOutCubic(clamp(local / 1.7, 0, 1)), 640, 360, 0.8);
  showCursor(0, 0, false);
}

async function initPromo() {
  await document.fonts.ready;
  await Promise.all(Array.from(document.images).map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
  }));
  measure();
  renderFrame(0);
  return { duration: DURATION, fps: FPS, shots: SHOTS.map((s) => ({ id: s.id, start: s.start, end: s.end })) };
}

function setPreviewHud(on) {
  document.getElementById('preview-hud').style.display = on ? 'block' : 'none';
}

window.renderFrame = renderFrame;
window.initPromo = initPromo;
window.setPreviewHud = setPreviewHud;
window.PROMO = { DURATION, FPS, BEAT, SHOTS: SHOTS.map((s) => ({ id: s.id, start: s.start, end: s.end })) };

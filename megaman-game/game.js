// ============================================================
// MEGA MAN — Parallax Platformer
// HTML5 Canvas game with real Mega Man sprites + procedural parallax background.
// ============================================================

(() => {
  'use strict';

  // ---------- Canvas & constants ----------
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const VIEW_W = canvas.width;   // 960
  const VIEW_H = canvas.height;  // 540

  const GRAVITY = 0.55;
  const JUMP_VEL = -11.5;
  const MOVE_SPEED = 3.6;
  const MAX_FALL = 14;
  const BULLET_SPEED = 9;
  const PLAYER_W = 38;
  const PLAYER_H = 48;
  const SPRITE_SIZE = 50;   // source sprite cell size
  const SPRITE_DRAW = 70;   // drawn size
  const GROUND_Y = 460;     // floor in world coords

  // World extends well past viewport so we can scroll
  const WORLD_W = 4800;

  // ---------- Assets ----------
  const assets = {};
  function loadImage(name, src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { assets[name] = img; res(img); };
      img.onerror = () => rej(new Error('Failed: ' + src));
      img.src = src;
    });
  }

  function loadAudio(name, src, opts = {}) {
    const a = new Audio(src);
    if (opts.loop) a.loop = true;
    if (opts.volume != null) a.volume = opts.volume;
    a.preload = 'auto';
    assets[name] = a;
    return a;
  }

  // ---------- Input ----------
  const keys = Object.create(null);
  const keyMap = {
    left:  ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    jump:  ['Space', 'KeyW', 'ArrowUp'],
    shoot: ['KeyJ', 'KeyX', 'KeyZ'],
  };
  function pressed(action) {
    return keyMap[action].some(c => keys[c]);
  }
  // edge-trigger storage
  const justPressed = Object.create(null);

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
    if (e.code === 'KeyM') toggleMusic();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  canvas.addEventListener('click', () => canvas.focus());

  function consumeJustPressed(codes) {
    for (const c of codes) if (justPressed[c]) { justPressed[c] = false; return true; }
    return false;
  }

  // ---------- Parallax layers (procedurally rendered to offscreen canvases) ----------
  // Each layer scrolls at a different rate vs the camera.

  function makeOffscreen(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function makeStarLayer(w, h) {
    const c = makeOffscreen(w, h);
    const g = c.getContext('2d');
    // night sky gradient
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0,    '#0a0420');
    grad.addColorStop(0.55, '#1b1450');
    grad.addColorStop(1,    '#341866');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // stars
    let seed = 1337;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (let i = 0; i < 220; i++) {
      const x = rnd() * w;
      const y = rnd() * h * 0.85;
      const r = rnd() * 1.6 + 0.3;
      const a = 0.4 + rnd() * 0.6;
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.fillRect(Math.floor(x), Math.floor(y), Math.ceil(r), Math.ceil(r));
    }
    // a moon
    g.fillStyle = '#f7e7b0';
    g.beginPath();
    g.arc(w * 0.78, h * 0.22, 34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#332244';
    g.beginPath();
    g.arc(w * 0.78 + 12, h * 0.22 - 6, 30, 0, Math.PI * 2);
    g.fill();
    return c;
  }

  function makeMountainLayer(w, h, baseY, color, shadowColor, count, amp) {
    const c = makeOffscreen(w, h);
    const g = c.getContext('2d');
    let seed = 4242;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    // back silhouette
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    const step = w / count;
    g.lineTo(0, baseY);
    for (let i = 0; i <= count; i++) {
      const x = i * step;
      const peak = baseY - (amp * 0.6 + rnd() * amp);
      const mid  = baseY - (amp * 0.3 + rnd() * amp * 0.4);
      g.lineTo(x - step / 2, mid);
      g.lineTo(x, peak);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    // highlight strip
    g.fillStyle = shadowColor;
    g.beginPath();
    g.moveTo(0, baseY + 8);
    for (let i = 0; i <= count; i++) {
      const x = i * step;
      const peak = baseY - (amp * 0.6 + rnd() * amp) + 12;
      g.lineTo(x - step / 2, baseY - 6);
      g.lineTo(x, peak);
    }
    g.lineTo(w, baseY + 8);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fill();
    return c;
  }

  function makeCityLayer(w, h, baseY) {
    const c = makeOffscreen(w, h);
    const g = c.getContext('2d');
    let seed = 9999;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    let x = 0;
    while (x < w) {
      const bw = 40 + Math.floor(rnd() * 90);
      const bh = 60 + Math.floor(rnd() * 160);
      const bx = x;
      const by = baseY - bh;
      // building body
      g.fillStyle = '#1a1238';
      g.fillRect(bx, by, bw, bh);
      // edge highlight
      g.fillStyle = '#2a1f55';
      g.fillRect(bx, by, 2, bh);
      g.fillStyle = '#0d0820';
      g.fillRect(bx + bw - 2, by, 2, bh);
      // windows
      for (let wy = by + 10; wy < baseY - 6; wy += 12) {
        for (let wx = bx + 6; wx < bx + bw - 6; wx += 10) {
          if (rnd() > 0.45) {
            g.fillStyle = rnd() > 0.7 ? '#ffd23f' : '#5588ff';
            g.fillRect(wx, wy, 4, 5);
          }
        }
      }
      // roof feature
      if (rnd() > 0.6) {
        const aw = 6 + Math.floor(rnd() * 12);
        g.fillStyle = '#1a1238';
        g.fillRect(bx + bw / 2 - aw / 2, by - 12, aw, 12);
        g.fillStyle = '#ff3a3a';
        g.fillRect(bx + bw / 2 - 1, by - 14, 2, 2);
      }
      x += bw + 2;
    }
    return c;
  }

  function makePipeLayer(w, h, baseY) {
    // Mid-distance industrial pipes/structures
    const c = makeOffscreen(w, h);
    const g = c.getContext('2d');
    let seed = 13579;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    let x = 0;
    while (x < w) {
      const skip = 90 + Math.floor(rnd() * 180);
      x += skip;
      if (x >= w) break;
      // pipe stack
      const stackW = 22 + Math.floor(rnd() * 12);
      const stackH = 80 + Math.floor(rnd() * 110);
      const sx = x;
      const sy = baseY - stackH;
      g.fillStyle = '#5a1a1a';
      g.fillRect(sx, sy, stackW, stackH);
      g.fillStyle = '#8b2828';
      g.fillRect(sx, sy, 3, stackH);
      g.fillStyle = '#330a0a';
      g.fillRect(sx + stackW - 3, sy, 3, stackH);
      // cap
      g.fillStyle = '#3a0a0a';
      g.fillRect(sx - 3, sy, stackW + 6, 6);
      // bands
      for (let by = sy + 20; by < baseY - 10; by += 28) {
        g.fillStyle = '#330a0a';
        g.fillRect(sx, by, stackW, 3);
      }
      // glow at top
      g.fillStyle = 'rgba(255,210,63,0.4)';
      g.fillRect(sx - 6, sy - 10, stackW + 12, 10);
    }
    return c;
  }

  // Layers will be created in init()
  const parallax = {
    sky: null,
    mountainsFar: null,
    city: null,
    pipes: null,
  };

  // ---------- Level ----------
  // Platforms in world coordinates. {x, y, w, h, kind}
  // kind: 'ground' = solid floor, 'block' = pillar/box
  const platforms = [
    // Main ground sections with gaps
    { x: 0,    y: GROUND_Y, w: 700,  h: 80, kind: 'ground' },
    { x: 820,  y: GROUND_Y, w: 380,  h: 80, kind: 'ground' },
    { x: 1320, y: GROUND_Y, w: 540,  h: 80, kind: 'ground' },
    { x: 1980, y: GROUND_Y, w: 720,  h: 80, kind: 'ground' },
    { x: 2820, y: GROUND_Y, w: 360,  h: 80, kind: 'ground' },
    { x: 3320, y: GROUND_Y, w: 1500, h: 80, kind: 'ground' },
    // Floating platforms
    { x: 360,  y: 370, w: 110, h: 18, kind: 'block' },
    { x: 540,  y: 290, w: 110, h: 18, kind: 'block' },
    { x: 720,  y: 350, w: 90,  h: 18, kind: 'block' },
    { x: 1080, y: 350, w: 130, h: 18, kind: 'block' },
    { x: 1240, y: 270, w: 90,  h: 18, kind: 'block' },
    { x: 1500, y: 360, w: 140, h: 18, kind: 'block' },
    { x: 1700, y: 280, w: 100, h: 18, kind: 'block' },
    { x: 2150, y: 360, w: 150, h: 18, kind: 'block' },
    { x: 2400, y: 280, w: 120, h: 18, kind: 'block' },
    { x: 2600, y: 200, w: 120, h: 18, kind: 'block' },
    { x: 2920, y: 360, w: 120, h: 18, kind: 'block' },
    { x: 3120, y: 290, w: 130, h: 18, kind: 'block' },
    { x: 3400, y: 360, w: 110, h: 18, kind: 'block' },
    { x: 3580, y: 280, w: 110, h: 18, kind: 'block' },
    { x: 3780, y: 220, w: 110, h: 18, kind: 'block' },
    { x: 4000, y: 320, w: 200, h: 18, kind: 'block' },
    { x: 4280, y: 240, w: 200, h: 18, kind: 'block' },
  ];

  // ---------- Player ----------
  const player = {
    x: 80,
    y: 100,
    vx: 0,
    vy: 0,
    w: PLAYER_W,
    h: PLAYER_H,
    facing: 1, // 1 = right, -1 = left
    onGround: false,
    hp: 28,
    maxHp: 28,
    lives: 3,
    invuln: 0,
    score: 0,
    // animation
    anim: 'idle', // idle | run | jump | shoot | runshoot | jumpshoot
    animTimer: 0,
    animFrame: 0,
    shootCooldown: 0,
    shootFlash: 0,
    dead: false,
  };

  // sprite frames: each entry { fx, fy } -> column/row in sprite sheet
  const FRAMES = {
    idle:      [{ fx: 0, fy: 0 }, { fx: 1, fy: 0 }],
    run:       [{ fx: 3, fy: 0 }, { fx: 4, fy: 0 }, { fx: 5, fy: 0 }, { fx: 4, fy: 0 }],
    shoot:     [{ fx: 2, fy: 1 }],
    runshoot:  [{ fx: 3, fy: 1 }, { fx: 4, fy: 1 }, { fx: 5, fy: 1 }, { fx: 4, fy: 1 }],
    jump:      [{ fx: 6, fy: 0 }],
    jumpshoot: [{ fx: 6, fy: 1 }],
    hit:       [{ fx: 7, fy: 0 }],
  };
  const ANIM_DELAYS = { idle: 24, run: 6, shoot: 8, runshoot: 6, jump: 8, jumpshoot: 8, hit: 4 };

  // ---------- Bullets & enemies ----------
  /** @type {{x:number,y:number,vx:number,owner:'player'|'enemy',life:number}[]} */
  const bullets = [];

  /** @type {{x:number,y:number,vx:number,hp:number,kind:string,timer:number,state:string,facing:number,dead:boolean,homeX:number}[]} */
  const enemies = [];

  function spawnEnemies() {
    enemies.length = 0;
    // Walker enemies on the ground sections
    const walkerSpawns = [
      { x: 460,  patrol: 120 },
      { x: 900,  patrol: 150 },
      { x: 1480, patrol: 180 },
      { x: 2100, patrol: 200 },
      { x: 2380, patrol: 180 },
      { x: 3050, patrol: 100 },
      { x: 3500, patrol: 140 },
      { x: 3900, patrol: 200 },
      { x: 4400, patrol: 180 },
    ];
    for (const s of walkerSpawns) {
      enemies.push({
        kind: 'walker', x: s.x, y: GROUND_Y - 28, vx: -0.8, hp: 2,
        homeX: s.x, patrol: s.patrol,
        timer: 0, state: 'walk', facing: -1, dead: false,
        w: 30, h: 28,
      });
    }
    // Met-style sitter that pops up and shoots
    const metSpawns = [
      { x: 600,  y: GROUND_Y - 24 },
      { x: 1380, y: GROUND_Y - 24 },
      { x: 1720, y: 280 - 24 },
      { x: 2250, y: GROUND_Y - 24 },
      { x: 2620, y: 200 - 24 },
      { x: 3180, y: GROUND_Y - 24 },
      { x: 3620, y: 280 - 24 },
      { x: 4100, y: 320 - 24 },
      { x: 4500, y: GROUND_Y - 24 },
    ];
    for (const s of metSpawns) {
      enemies.push({
        kind: 'met', x: s.x, y: s.y, vx: 0, hp: 3,
        timer: 0, state: 'hidden', facing: -1, dead: false,
        w: 28, h: 24,
      });
    }
    // Flying drone enemies
    const flyerSpawns = [
      { x: 1100, y: 200 },
      { x: 2050, y: 160 },
      { x: 2750, y: 130 },
      { x: 3500, y: 180 },
      { x: 4200, y: 140 },
    ];
    for (const s of flyerSpawns) {
      enemies.push({
        kind: 'flyer', x: s.x, y: s.y, vx: -1.4, hp: 2,
        homeX: s.x, baseY: s.y,
        timer: 0, state: 'fly', facing: -1, dead: false,
        w: 30, h: 24,
      });
    }
  }

  // ---------- Particles (explosions, hit sparks) ----------
  const particles = [];
  function addExplosion(x, y, color = '#ffd23f', count = 14) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const sp = 2 + Math.random() * 3;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 28 + Math.random() * 10, color, size: 3 + Math.random() * 2,
      });
    }
  }
  function addHitSpark(x, y) {
    for (let i = 0; i < 6; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 12, color: '#fff', size: 2,
      });
    }
  }

  // ---------- Camera ----------
  const camera = { x: 0, y: 0 };
  function updateCamera() {
    const targetX = player.x + player.w / 2 - VIEW_W / 2;
    camera.x += (targetX - camera.x) * 0.12;
    camera.x = Math.max(0, Math.min(WORLD_W - VIEW_W, camera.x));
  }

  // ---------- Audio control ----------
  let musicOn = true;
  function toggleMusic() {
    musicOn = !musicOn;
    if (!assets.music) return;
    if (musicOn) {
      assets.music.play().catch(() => {});
    } else {
      assets.music.pause();
    }
  }
  function playSfx(name) {
    const src = assets[name];
    if (!src) return;
    try {
      // clone for overlap
      const s = src.cloneNode();
      s.volume = 0.5;
      s.play().catch(() => {});
    } catch (_) {}
  }

  // ---------- Collision helpers ----------
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function collidePlatforms(entity) {
    // Move X then Y, resolving against platforms
    entity.x += entity.vx;
    for (const p of platforms) {
      if (aabb(entity, p)) {
        if (entity.vx > 0) entity.x = p.x - entity.w;
        else if (entity.vx < 0) entity.x = p.x + p.w;
        entity.vx = 0;
      }
    }
    entity.y += entity.vy;
    entity.onGround = false;
    for (const p of platforms) {
      if (aabb(entity, p)) {
        if (entity.vy > 0) {
          entity.y = p.y - entity.h;
          entity.vy = 0;
          entity.onGround = true;
        } else if (entity.vy < 0) {
          entity.y = p.y + p.h;
          entity.vy = 0;
        }
      }
    }
    // world bounds
    if (entity.x < 0) { entity.x = 0; entity.vx = 0; }
    if (entity.x + entity.w > WORLD_W) { entity.x = WORLD_W - entity.w; entity.vx = 0; }
    // pit
    if (entity.y > VIEW_H + 200) {
      entity.fellOff = true;
    }
  }

  // ---------- Update loop ----------
  let running = false;
  let gameOver = false;

  function update() {
    if (!running) return;

    // ----- Player input -----
    if (!player.dead) {
      const left = pressed('left');
      const right = pressed('right');
      const shoot = pressed('shoot');

      if (left && !right)  { player.vx = -MOVE_SPEED; player.facing = -1; }
      else if (right && !left) { player.vx = MOVE_SPEED; player.facing = 1; }
      else player.vx = 0;

      // Jump (edge-triggered)
      if (consumeJustPressed(keyMap.jump) && player.onGround) {
        player.vy = JUMP_VEL;
        player.onGround = false;
        playSfx('jump');
      }

      // Shoot
      if (player.shootCooldown > 0) player.shootCooldown--;
      if (shoot && player.shootCooldown <= 0) {
        const muzzleX = player.x + (player.facing === 1 ? player.w + 2 : -8);
        const muzzleY = player.y + 22;
        bullets.push({
          x: muzzleX, y: muzzleY,
          vx: BULLET_SPEED * player.facing,
          owner: 'player', life: 80,
        });
        player.shootCooldown = 14;
        player.shootFlash = 8;
        playSfx('shoot');
      }
      if (player.shootFlash > 0) player.shootFlash--;

      // Gravity
      player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
      collidePlatforms(player);

      if (player.fellOff) {
        damagePlayer(99, true);
        player.fellOff = false;
      }

      // Animation state machine
      const shooting = player.shootFlash > 0;
      let anim = 'idle';
      if (!player.onGround) anim = shooting ? 'jumpshoot' : 'jump';
      else if (Math.abs(player.vx) > 0.1) anim = shooting ? 'runshoot' : 'run';
      else anim = shooting ? 'shoot' : 'idle';
      if (player.anim !== anim) {
        // preserve run frame across run<->runshoot
        const preserve = (player.anim === 'run' && anim === 'runshoot') ||
                         (player.anim === 'runshoot' && anim === 'run');
        if (!preserve) { player.animFrame = 0; player.animTimer = 0; }
        player.anim = anim;
      }
      player.animTimer++;
      const set = FRAMES[player.anim];
      const delay = ANIM_DELAYS[player.anim] || 12;
      if (player.animTimer >= delay) {
        player.animTimer = 0;
        player.animFrame = (player.animFrame + 1) % set.length;
      }

      if (player.invuln > 0) player.invuln--;
    } else {
      // death sequence
      player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
      player.y += player.vy;
    }

    // ----- Bullets -----
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.life--;
      if (b.life <= 0 || b.x < camera.x - 60 || b.x > camera.x + VIEW_W + 60) {
        bullets.splice(i, 1); continue;
      }
      // Collide with platforms (so shots can't pass through walls)
      for (const p of platforms) {
        if (b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) {
          addHitSpark(b.x, b.y);
          bullets.splice(i, 1);
          break;
        }
      }
    }

    // ----- Enemies -----
    for (const e of enemies) {
      if (e.dead) continue;
      const dxPlayer = (player.x + player.w / 2) - (e.x + e.w / 2);
      e.timer++;
      if (e.kind === 'walker') {
        e.x += e.vx;
        if (e.x < e.homeX - e.patrol) { e.x = e.homeX - e.patrol; e.vx = Math.abs(e.vx); e.facing = 1; }
        if (e.x > e.homeX + e.patrol) { e.x = e.homeX + e.patrol; e.vx = -Math.abs(e.vx); e.facing = -1; }
      } else if (e.kind === 'met') {
        // hidden -> peek -> shoot -> hide
        if (e.state === 'hidden') {
          if (Math.abs(dxPlayer) < 320 && e.timer > 50) {
            e.state = 'peek'; e.timer = 0;
            e.facing = dxPlayer > 0 ? 1 : -1;
          }
        } else if (e.state === 'peek') {
          if (e.timer > 28) {
            e.state = 'shoot'; e.timer = 0;
            // fire 3 spread shots
            const sx = e.x + e.w / 2;
            const sy = e.y + 6;
            for (const ang of [-0.25, 0, 0.25]) {
              bullets.push({
                x: sx, y: sy,
                vx: 4.5 * e.facing,
                vy: ang * 3,
                owner: 'enemy', life: 100, spread: true,
              });
            }
            playSfx('shoot');
          }
        } else if (e.state === 'shoot') {
          if (e.timer > 30) { e.state = 'hidden'; e.timer = 0; }
        }
      } else if (e.kind === 'flyer') {
        e.x += e.vx;
        e.y = e.baseY + Math.sin(e.timer * 0.06) * 26;
        if (e.x < e.homeX - 220) { e.vx = Math.abs(e.vx); e.facing = 1; }
        if (e.x > e.homeX + 220) { e.vx = -Math.abs(e.vx); e.facing = -1; }
        if (e.timer % 110 === 0 && Math.abs(dxPlayer) < 360) {
          bullets.push({
            x: e.x + e.w / 2, y: e.y + e.h,
            vx: 3 * Math.sign(dxPlayer || 1),
            vy: 2.5,
            owner: 'enemy', life: 120,
          });
        }
      }
    }

    // ----- Bullet vs enemy / player collisions -----
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.vy != null) b.y += b.vy;
      if (b.owner === 'player') {
        for (const e of enemies) {
          if (e.dead) continue;
          if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
            // Met in hidden state is invincible
            if (e.kind === 'met' && e.state === 'hidden') {
              addHitSpark(b.x, b.y);
              bullets.splice(i, 1);
              break;
            }
            e.hp--;
            addHitSpark(b.x, b.y);
            bullets.splice(i, 1);
            if (e.hp <= 0) {
              e.dead = true;
              addExplosion(e.x + e.w / 2, e.y + e.h / 2, '#ffd23f');
              player.score += 100;
              updateHud();
            }
            break;
          }
        }
      } else {
        // enemy bullet vs player
        if (player.invuln <= 0 && !player.dead &&
            b.x > player.x + 4 && b.x < player.x + player.w - 4 &&
            b.y > player.y + 4 && b.y < player.y + player.h - 4) {
          damagePlayer(2, false);
          bullets.splice(i, 1);
        }
      }
    }

    // ----- Enemy contact damage -----
    if (player.invuln <= 0 && !player.dead) {
      for (const e of enemies) {
        if (e.dead) continue;
        if (e.kind === 'met' && e.state === 'hidden') continue;
        if (aabb(player, e)) {
          damagePlayer(3, false);
          break;
        }
      }
    }

    // Remove dead enemies fully off-screen after explosion has fully played
    // (we keep them to render the explosion frame; the explosion is via particles)
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].dead) enemies.splice(i, 1);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    updateCamera();
  }

  function damagePlayer(dmg, instaKill) {
    player.hp = Math.max(0, player.hp - dmg);
    player.invuln = 60;
    addHitSpark(player.x + player.w / 2, player.y + player.h / 2);
    updateHud();
    if (player.hp <= 0 || instaKill) {
      player.dead = true;
      player.vy = -8;
      player.lives--;
      addExplosion(player.x + player.w / 2, player.y + player.h / 2, '#2a8cff', 22);
      updateHud();
      setTimeout(() => {
        if (player.lives <= 0) {
          endGame();
        } else {
          respawn();
        }
      }, 1300);
    }
  }

  function respawn() {
    player.x = Math.max(80, camera.x + 80);
    player.y = 100;
    player.vx = 0; player.vy = 0;
    player.hp = player.maxHp;
    player.invuln = 90;
    player.dead = false;
    updateHud();
  }

  function endGame() {
    running = false;
    gameOver = true;
    const ov = document.getElementById('overlay');
    const h1 = ov.querySelector('h1');
    h1.textContent = 'GAME OVER';
    h1.classList.add('game-over');
    const tag = ov.querySelector('.tagline');
    tag.textContent = `Final score: ${String(player.score).padStart(6, '0')}`;
    const btn = document.getElementById('start-btn');
    btn.textContent = 'TRY AGAIN';
    ov.classList.add('visible');
  }

  // ---------- Rendering ----------
  function clear() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function drawParallax() {
    // Sky: doesn't scroll (or very slow)
    if (parallax.sky) {
      const off = -camera.x * 0.02;
      const w = parallax.sky.width;
      const x = ((off % w) + w) % w;
      ctx.drawImage(parallax.sky, -x, 0, w, VIEW_H);
      ctx.drawImage(parallax.sky, -x + w, 0, w, VIEW_H);
    }
    // Mountains: 0.18 scroll
    drawTiledLayer(parallax.mountainsFar, 0.18);
    // City: 0.42 scroll
    drawTiledLayer(parallax.city, 0.42);
    // Pipes: 0.7 scroll
    drawTiledLayer(parallax.pipes, 0.7);
  }

  function drawTiledLayer(img, factor) {
    if (!img) return;
    const off = -camera.x * factor;
    const w = img.width;
    const x = ((off % w) + w) % w;
    ctx.drawImage(img, -x, 0, w, VIEW_H);
    ctx.drawImage(img, -x + w, 0, w, VIEW_H);
  }

  function drawPlatforms() {
    for (const p of platforms) {
      const sx = p.x - camera.x;
      if (sx + p.w < -20 || sx > VIEW_W + 20) continue;
      drawBrickPlatform(sx, p.y, p.w, p.h, p.kind);
    }
  }

  function drawBrickPlatform(x, y, w, h, kind) {
    // Body
    ctx.fillStyle = '#9b1f1f';
    ctx.fillRect(x, y, w, h);
    // Top highlight band
    ctx.fillStyle = '#ffbcbc';
    ctx.fillRect(x, y, w, 6);
    ctx.fillStyle = '#ff5959';
    ctx.fillRect(x, y + 6, w, 4);
    // Side shadows
    ctx.fillStyle = '#5a0d0d';
    ctx.fillRect(x, y + h - 4, w, 4);
    // Brick lines
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let by = y + 10; by < y + h - 4; by += 12) {
      ctx.fillRect(x, by, w, 1);
    }
    const offset = (Math.floor((x / 24)) % 2) * 12;
    for (let by = y + 10; by < y + h - 4; by += 12) {
      for (let bx = x + offset; bx < x + w; bx += 24) {
        ctx.fillRect(bx, by, 1, 12);
      }
    }
    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawPlayer() {
    const sx = Math.floor(player.x - camera.x + player.w / 2);
    const sy = Math.floor(player.y + player.h / 2);

    // flicker when invulnerable
    if (player.invuln > 0 && Math.floor(player.invuln / 4) % 2 === 0) {
      // skip drawing this frame
    } else {
      ctx.save();
      ctx.translate(sx, sy);
      if (player.facing < 0) ctx.scale(-1, 1);
      const f = FRAMES[player.anim][player.animFrame] || FRAMES.idle[0];
      // draw the megaman sprite centered
      ctx.drawImage(
        assets.megaman,
        f.fx * SPRITE_SIZE, f.fy * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE,
        -SPRITE_DRAW / 2, -SPRITE_DRAW / 2, SPRITE_DRAW, SPRITE_DRAW
      );
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      const sx = b.x - camera.x;
      if (sx < -10 || sx > VIEW_W + 10) continue;
      if (b.owner === 'player') {
        // bright blue/white player shot
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx - 5, b.y - 3, 10, 6);
        ctx.fillStyle = '#2a8cff';
        ctx.fillRect(sx - 7, b.y - 2, 14, 4);
        ctx.fillStyle = '#b8e0ff';
        ctx.fillRect(sx - 3, b.y - 1, 6, 2);
      } else {
        // orange enemy shot
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(sx, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff7700';
        ctx.beginPath();
        ctx.arc(sx, b.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawEnemies() {
    for (const e of enemies) {
      const sx = Math.floor(e.x - camera.x);
      const sy = Math.floor(e.y);
      if (sx + e.w < -20 || sx > VIEW_W + 20) continue;
      if (e.kind === 'walker') drawWalker(sx, sy, e);
      else if (e.kind === 'met') drawMet(sx, sy, e);
      else if (e.kind === 'flyer') drawFlyer(sx, sy, e);
    }
  }

  // Pixel-art-style procedural enemies (drawn to match NES Mega Man aesthetic)
  function drawWalker(x, y, e) {
    // Spike crab-walker enemy
    const f = (Math.floor(e.timer / 8) % 2 === 0) ? 0 : 1;
    // Body
    ctx.fillStyle = '#aa00cc';
    ctx.fillRect(x + 4, y + 8, 22, 14);
    ctx.fillStyle = '#dd44ff';
    ctx.fillRect(x + 6, y + 10, 18, 4);
    ctx.fillStyle = '#660088';
    ctx.fillRect(x + 4, y + 20, 22, 2);
    // Eye
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + (e.facing > 0 ? 18 : 6), y + 12, 5, 5);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(x + (e.facing > 0 ? 20 : 8), y + 13, 2, 3);
    // Spikes on top
    ctx.fillStyle = '#aaaaaa';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 6 + i * 5, y + 8);
      ctx.lineTo(x + 8 + i * 5, y + 2);
      ctx.lineTo(x + 10 + i * 5, y + 8);
      ctx.fill();
    }
    // Legs
    ctx.fillStyle = '#660088';
    if (f === 0) {
      ctx.fillRect(x + 4, y + 22, 4, 6);
      ctx.fillRect(x + 22, y + 22, 4, 6);
      ctx.fillRect(x + 13, y + 24, 4, 4);
    } else {
      ctx.fillRect(x + 2, y + 22, 4, 6);
      ctx.fillRect(x + 24, y + 22, 4, 6);
      ctx.fillRect(x + 13, y + 22, 4, 6);
    }
  }

  function drawMet(x, y, e) {
    // Helmet enemy
    const hidden = e.state === 'hidden';
    // Helmet (always visible)
    ctx.fillStyle = '#ffd23f';
    // dome
    ctx.beginPath();
    ctx.arc(x + 14, y + 14, 13, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.fillRect(x + 1, y + 14, 26, 8);
    // helmet detail
    ctx.fillStyle = '#b87000';
    ctx.fillRect(x + 1, y + 20, 26, 3);
    ctx.fillRect(x + 12, y + 4, 4, 4);
    // helmet shine
    ctx.fillStyle = '#fff5b8';
    ctx.fillRect(x + 6, y + 8, 4, 3);
    if (!hidden) {
      // Face peeking
      ctx.fillStyle = '#ff5050';
      ctx.fillRect(x + 8, y + 14, 12, 6);
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 10, y + 15, 3, 3);
      ctx.fillRect(x + 16, y + 15, 3, 3);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 11 + (e.facing > 0 ? 1 : -1), y + 16, 1, 2);
      ctx.fillRect(x + 17 + (e.facing > 0 ? 1 : -1), y + 16, 1, 2);
    }
  }

  function drawFlyer(x, y, e) {
    // Drone/sniper joe-style flying enemy
    const wing = (Math.floor(e.timer / 4) % 2 === 0) ? 0 : 1;
    // Body
    ctx.fillStyle = '#1e9e1e';
    ctx.fillRect(x + 6, y + 8, 18, 12);
    ctx.fillStyle = '#5cdc5c';
    ctx.fillRect(x + 8, y + 9, 14, 3);
    ctx.fillStyle = '#0a5a0a';
    ctx.fillRect(x + 6, y + 18, 18, 2);
    // Eye/scanner
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(x + (e.facing > 0 ? 18 : 8), y + 12, 4, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + (e.facing > 0 ? 19 : 9), y + 12, 1, 1);
    // Wings
    ctx.fillStyle = '#b8e0ff';
    if (wing === 0) {
      ctx.fillRect(x + 0, y + 4, 8, 3);
      ctx.fillRect(x + 22, y + 4, 8, 3);
    } else {
      ctx.fillRect(x - 2, y + 6, 10, 2);
      ctx.fillRect(x + 22, y + 6, 10, 2);
    }
    // Glow underneath
    ctx.fillStyle = 'rgba(255,210,63,0.5)';
    ctx.fillRect(x + 10, y + 22, 10, 2);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(
        Math.floor(p.x - camera.x - p.size / 2),
        Math.floor(p.y - p.size / 2),
        p.size, p.size
      );
    }
  }

  function drawForegroundTint() {
    // subtle vignette
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.5,
                                       VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function render() {
    clear();
    drawParallax();
    drawPlatforms();
    drawEnemies();
    drawBullets();
    drawPlayer();
    drawParticles();
    drawForegroundTint();
  }

  // ---------- HUD ----------
  const hpFill = document.getElementById('hp-fill');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  function updateHud() {
    hpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
    scoreEl.textContent = String(player.score).padStart(6, '0');
    livesEl.textContent = `×${Math.max(0, player.lives)}`;
    if (player.hp < player.maxHp * 0.3) {
      hpFill.style.background = 'linear-gradient(90deg, #ff3a3a, #ffd23f)';
    } else {
      hpFill.style.background = 'linear-gradient(90deg, #2a8cff, #b8e0ff)';
    }
  }

  // ---------- Game loop ----------
  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }

  // ---------- Init ----------
  function resetGame() {
    player.x = 80; player.y = 100;
    player.vx = 0; player.vy = 0;
    player.facing = 1;
    player.hp = player.maxHp;
    player.lives = 3;
    player.score = 0;
    player.invuln = 60;
    player.dead = false;
    bullets.length = 0;
    particles.length = 0;
    camera.x = 0;
    spawnEnemies();
    updateHud();
  }

  async function init() {
    // Build parallax layers
    parallax.sky = makeStarLayer(960, VIEW_H);
    parallax.mountainsFar = makeMountainLayer(1280, VIEW_H, VIEW_H - 110, '#241650', '#160a3a', 8, 130);
    parallax.city = makeCityLayer(1500, VIEW_H, VIEW_H - 60);
    parallax.pipes = makePipeLayer(1100, VIEW_H, VIEW_H - 40);

    // Load images
    try {
      await Promise.all([
        loadImage('megaman', 'assets/megamansheet.png'),
        loadImage('extras',  'assets/megamanbullet.png'),
        loadImage('bg',      'assets/MegaMan2HeatManMapBG.png'),
      ]);
    } catch (e) {
      console.error(e);
      const ov = document.getElementById('overlay');
      ov.querySelector('h1').textContent = 'LOAD FAILED';
      return;
    }
    // Load audio (lazy / non-blocking)
    loadAudio('music', 'assets/music.mp3', { loop: true, volume: 0.35 });
    loadAudio('jump',  'assets/jump.wav',  { volume: 0.45 });
    loadAudio('shoot', 'assets/shoot.wav', { volume: 0.35 });

    spawnEnemies();
    updateHud();
    requestAnimationFrame(loop);

    const startBtn = document.getElementById('start-btn');
    const overlay = document.getElementById('overlay');
    startBtn.addEventListener('click', () => {
      if (gameOver) {
        gameOver = false;
        const h1 = overlay.querySelector('h1');
        h1.classList.remove('game-over');
        h1.innerHTML = 'MEGA <span>MAN</span>';
        overlay.querySelector('.tagline').textContent = 'Parallax Platformer';
        startBtn.textContent = 'PRESS START';
        resetGame();
      }
      overlay.classList.remove('visible');
      canvas.focus();
      running = true;
      if (musicOn && assets.music) {
        assets.music.play().catch(() => { /* autoplay block; user gesture above usually unlocks */ });
      }
    });

    // Allow Enter/Space on the overlay to start
    window.addEventListener('keydown', (e) => {
      if (overlay.classList.contains('visible') &&
          (e.code === 'Enter' || e.code === 'Space')) {
        startBtn.click();
      }
    });
  }

  init();
})();

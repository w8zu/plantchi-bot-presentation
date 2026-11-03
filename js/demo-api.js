// 체험 모드: 주소 끝에 ?demo를 붙이면 서버와 로봇 없이 브라우저 안에서 둘을 흉내 낸다.
// ?demo가 없으면 아무것도 하지 않는다(실제 서버에 연결된 평소 화면).
// 판단 규칙은 backend/plantchi_server/state_logic.py, 조종·이동 기록 규칙은 docs/api.md와 같다.
// '/api/'로 시작하는 fetch만 가로채고, 나머지 요청은 그대로 보낸다.
// 실제 라즈봇에는 위치 센서가 없으므로 "가상 방 지도"는 체험 모드에서만 보여 준다.

const PlantchiDemo = (() => {
  // 공유용 복사본: 서버 없이 링크로 열기 때문에 체험 모드를 항상 켠다

  const ROOM = { w: 400, h: 260 };           // 방 크기(cm), 위쪽 벽 오른편에 창문
  const WINDOW = { x1: 250, x2: 370 };
  const ROBOT_R = 16;
  const LEASE_MS = 400;                      // 이동 명령 하나로 움직이는 시간
  const DRIVE_TTL_MS = 700;                  // 마지막 이동 명령 뒤 이 시간이 지나면 이동이 끝난 것으로 본다
  const SETTLE_MS = 3000;                    // 정지 후 도착한 자리의 값을 기록하기까지 기다리는 시간
  const OBSTACLE_STOP_CM = 20;
  const DARK_THRESHOLD = 0.6;
  const DRY_BELOW = 30;
  const HUMID_ABOVE = 80;
  const MESSAGES = {
    happy: '빛이 충분해요! 기분 좋아요',
    sleepy: '너무 어두워요… 졸려요',
    dry: '공기가 너무 건조해요… 목말라요',
    humid: '너무 눅눅해요… 바람이 필요해요',
  };
  const START = { x: 70, y: 200, heading: -90 };

  const sim = {
    ...START,
    humidity: 48,
    handBlock: false,
    affection: 0,
    estop: false,
    motion: null,               // { action, speed, until }
    lastDrive: null,            // { action, at } 마지막 이동 명령
    endedAt: null,              // stop·비상 정지로 이동이 끝난 시각. null이면 TTL로 판단
    move: { state: 'none', before: null, after: null },
    wiggleUntil: 0,
    noise: { light: 0, hum: 0 },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const iso = (t = Date.now()) => new Date(t).toISOString();
  const cmdId = () => `cmd-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;

  function lightAt(x, y) {
    const d = Math.hypot(x - (WINDOW.x1 + WINDOW.x2) / 2, y);
    return clamp(0.95 - d / 260, 0.04, 0.95);
  }

  // 로봇 앞쪽 벽까지 거리(cm). 손으로 막으면 10cm
  function obstacleAhead() {
    if (sim.handBlock) return 10;
    const rad = (sim.heading * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const ts = [];
    if (dx > 1e-6) ts.push((ROOM.w - sim.x) / dx);
    if (dx < -1e-6) ts.push(-sim.x / dx);
    if (dy > 1e-6) ts.push((ROOM.h - sim.y) / dy);
    if (dy < -1e-6) ts.push(-sim.y / dy);
    return Math.max(0, Math.min(...ts) - ROBOT_R);
  }

  function reading() {
    return {
      light_level: Math.round(clamp(lightAt(sim.x, sim.y) + sim.noise.light, 0, 1) * 100) / 100,
      humidity_percent: Math.round((sim.humidity + sim.noise.hum) * 10) / 10,
      at: iso(),
    };
  }

  function plantState() {
    const r = reading();
    const lightCat = r.light_level < DARK_THRESHOLD ? 'dark' : 'normal';
    const humCat = r.humidity_percent < DRY_BELOW ? 'dry' : r.humidity_percent > HUMID_ABOVE ? 'humid' : 'normal';
    const mood = lightCat !== 'normal' ? 'sleepy' : humCat === 'normal' ? 'happy' : humCat;
    return {
      plant_id: 'plantchi-01',
      mood,
      light_category: lightCat,
      light_level: r.light_level,
      humidity_category: humCat,
      humidity_percent: r.humidity_percent,
      obstacle_cm: Math.round(obstacleAhead() * 10) / 10,
      affection: sim.affection,
      message: MESSAGES[mood],
      sensor_online: true,
      last_reading_at: r.at,
      updated_at: iso(),
    };
  }

  function command(action, speed, status = 'pending', detail = '') {
    return { command_id: cmdId(), action, speed, duration_ms: action === 'wiggle' ? 1500 : LEASE_MS, status, detail, expires_in_ms: 700 };
  }

  // 이동 전후 기록: 서버(backend/plantchi_server/drive.py)처럼 정지 후 SETTLE_MS가 지나야 after를 기록한다
  const endAt = () => (sim.endedAt !== null ? sim.endedAt : sim.lastDrive.at + DRIVE_TTL_MS);

  function halt() {
    if (sim.move.state === 'moving' && sim.endedAt === null) sim.endedAt = Math.min(Date.now(), endAt());
  }

  function latestMove() {
    if (sim.move.state === 'moving' && Date.now() >= endAt() + SETTLE_MS) {
      sim.move = { ...sim.move, state: 'done', after: reading() };
    }
    return sim.move;
  }

  function drive(action, speed = 0.3) {
    if (sim.estop) return { estop: true, command: null };
    if (action === 'stop') {
      sim.motion = null;
      halt();
      return { estop: false, command: command('stop', 0) };
    }
    const now = Date.now();
    if (sim.move.state !== 'moving' || now >= endAt() + SETTLE_MS) {
      sim.move = { state: 'moving', before: reading(), after: null };
    }
    sim.lastDrive = { action, at: now };
    sim.endedAt = null;
    if (action === 'forward' && obstacleAhead() < OBSTACLE_STOP_CM) {
      sim.motion = null;
      return { estop: false, command: command(action, speed, 'aborted', 'obstacle') };
    }
    sim.motion = { action, speed: clamp(speed, 0, 0.5), until: now + LEASE_MS };
    return { estop: false, command: command(action, speed) };
  }

  // 50ms마다 로봇 위치를 갱신한다. 리스가 끝나면 스스로 멈춘다(앱이 stop을 못 보내도 안전).
  setInterval(() => {
    const m = sim.motion;
    if (m && Date.now() > m.until) sim.motion = null;
    if (sim.motion) {
      const dt = 0.05;
      const v = m.speed * 110;
      const rad = (sim.heading * Math.PI) / 180;
      if (m.action === 'forward') {
        if (obstacleAhead() < OBSTACLE_STOP_CM) sim.motion = null;
        else { sim.x += Math.cos(rad) * v * dt; sim.y += Math.sin(rad) * v * dt; }
      } else if (m.action === 'backward') {
        sim.x -= Math.cos(rad) * v * dt; sim.y -= Math.sin(rad) * v * dt;
      } else if (m.action === 'turn_left') {
        sim.heading -= m.speed * 320 * dt;
      } else if (m.action === 'turn_right') {
        sim.heading += m.speed * 320 * dt;
      }
      sim.x = clamp(sim.x, ROBOT_R, ROOM.w - ROBOT_R);
      sim.y = clamp(sim.y, ROBOT_R, ROOM.h - ROBOT_R);
    }
  }, 50);

  setInterval(() => {
    sim.noise.light = (Math.random() - 0.5) * 0.02;
    sim.noise.hum = (Math.random() - 0.5) * 1.2;
  }, 1000);

  function robotStatus() {
    const active = sim.motion ? { ...command(sim.motion.action, sim.motion.speed, 'dispatched') }
      : Date.now() < sim.wiggleUntil ? command('wiggle', 0.3, 'dispatched') : null;
    const driving = sim.move.state === 'moving' && Date.now() < endAt();
    return {
      estop: sim.estop, robot_online: true, last_poll_at: iso(), active_command: active,
      drive: { action: driving ? sim.lastDrive.action : null },
    };
  }

  function route(method, path, body) {
    if (method === 'GET' && path === '/api/plant') return plantState();
    if (method === 'GET' && path === '/api/robot/status') return robotStatus();
    if (method === 'GET' && path === '/api/moves/latest') return latestMove();
    if (method === 'GET' && path === '/api/health') return { status: 'ok', version: 'demo' };
    if (method === 'POST' && path === '/api/robot/drive') return drive(body.action, body.speed);
    if (method === 'POST' && path === '/api/robot/stop') { sim.estop = true; sim.motion = null; halt(); return robotStatus(); }
    if (method === 'POST' && path === '/api/robot/resume') { sim.estop = false; return robotStatus(); }
    if (method === 'POST' && path === '/api/care') {
      sim.affection = clamp(sim.affection + 10, 0, 100);
      let cmd = null;
      if (!sim.estop) { sim.wiggleUntil = Date.now() + 1500; cmd = command('wiggle', 0.3); }
      return { plant: plantState(), command: cmd };
    }
    return null;
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return realFetch(input, init);
    await new Promise((r) => setTimeout(r, 25));
    const method = (init.method || 'GET').toUpperCase();
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch { /* 빈 본문 */ }
    const data = route(method, url.pathname, body);
    const status = data === null ? 404 : 200;
    const payload = data === null ? { error: { code: 'HTTP_404', message: 'Not Found' } } : data;
    return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
  };

  // ---------------------------------------------------------------- 방 지도

  function mountMap() {
    document.getElementById('demo-strip').hidden = false;
    document.getElementById('demo-card').hidden = false;
    const svg = document.getElementById('demo-map');
    svg.innerHTML = `
      <defs>
        <radialGradient id="demo-light" cx="${(WINDOW.x1 + WINDOW.x2) / 2}" cy="0" r="260" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#ffe9a3" stop-opacity="0.95"/>
          <stop offset="0.5" stop-color="#fbf0cf" stop-opacity="0.5"/>
          <stop offset="1" stop-color="#3b4470" stop-opacity="0.35"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="${ROOM.w}" height="${ROOM.h}" fill="#efe2c2"/>
      <rect x="0" y="0" width="${ROOM.w}" height="${ROOM.h}" fill="url(#demo-light)"/>
      <rect x="1.5" y="1.5" width="${ROOM.w - 3}" height="${ROOM.h - 3}" fill="none" stroke="#2c4a2a" stroke-width="3" rx="6"/>
      <rect x="${WINDOW.x1}" y="-2" width="${WINDOW.x2 - WINDOW.x1}" height="9" fill="#9fd6f5" stroke="#2c4a2a" stroke-width="2.5" rx="2"/>
      <text x="${(WINDOW.x1 + WINDOW.x2) / 2}" y="26" text-anchor="middle" class="map-label">창가 ☀️</text>
      <text x="14" y="${ROOM.h - 12}" class="map-label">어두운 구석</text>
      <g id="demo-robot">
        <circle r="${ROBOT_R + 3}" fill="#fffdf7" stroke="#2c4a2a" stroke-width="3"/>
        <path d="M ${ROBOT_R + 4} 0 L ${ROBOT_R - 6} -7 L ${ROBOT_R - 6} 7 Z" fill="#2f7d4f"/>
        <image id="demo-robot-img" x="-15" y="-15" width="30" height="30"/>
      </g>
      <g id="demo-hand" visibility="hidden"><text font-size="20" text-anchor="middle" dominant-baseline="middle">✋</text></g>`;

    const robot = svg.querySelector('#demo-robot');
    const img = svg.querySelector('#demo-robot-img');
    const hand = svg.querySelector('#demo-hand');
    function frame() {
      const wiggle = Date.now() < sim.wiggleUntil ? Math.sin(Date.now() / 60) * 8 : 0;
      robot.setAttribute('transform', `translate(${sim.x.toFixed(1)} ${sim.y.toFixed(1)}) rotate(${(sim.heading + wiggle).toFixed(1)})`);
      img.setAttribute('transform', `rotate(${(-sim.heading - wiggle).toFixed(1)})`);
      const species = typeof ui !== 'undefined' ? ui.species : 'basil';
      const ch = PlantchiArt.CHARACTERS[species];
      const src = ch ? ch.stages[PlantchiGrowth.seenStage(species)].src : '';
      if (img.getAttribute('href') !== src) img.setAttribute('href', src);
      const rad = (sim.heading * Math.PI) / 180;
      hand.setAttribute('visibility', sim.handBlock ? 'visible' : 'hidden');
      hand.setAttribute('transform', `translate(${(sim.x + Math.cos(rad) * 38).toFixed(1)} ${(sim.y + Math.sin(rad) * 38).toFixed(1)})`);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    const slider = document.getElementById('demo-humidity');
    const out = document.getElementById('demo-humidity-out');
    slider.value = sim.humidity;
    out.textContent = `${sim.humidity}%`;
    slider.addEventListener('input', () => {
      sim.humidity = Number(slider.value);
      out.textContent = `${sim.humidity}%`;
    });
    const handBtn = document.getElementById('demo-hand-btn');
    handBtn.addEventListener('click', () => {
      sim.handBlock = !sim.handBlock;
      handBtn.setAttribute('aria-pressed', String(sim.handBlock));
      handBtn.textContent = sim.handBlock ? '✋ 손 치우기' : '✋ 앞을 손으로 막기';
    });
    document.getElementById('demo-reset').addEventListener('click', () => {
      Object.assign(sim, START, { motion: null, lastDrive: null, endedAt: null, move: { state: 'none', before: null, after: null } });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountMap);
  else mountMap();

  return { active: true, sim };
})();

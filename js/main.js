// 화면 갱신과 버튼 동작. 1초마다 식물 상태·로봇 상태·이동 기록을 다시 받아 온다.
// 조종 규칙은 docs/api.md "POST /api/robot/drive"를 따른다: 누르는 동안 0.2초마다 같은 방향, 떼면 stop.

const POLL_MS = 1000;
const DRIVE_REPEAT_MS = 200;
const HISTORY_MS = 5 * 60 * 1000;     // 센서 카드 작은 그래프에 보여 줄 기간
const OBSTACLE_STOP_CM = 20;          // 로봇이 전진을 거부하는 거리(robot/safety.py와 같은 값, 표시용)
const OBSTACLE_SCALE_CM = 100;        // 거리 막대의 오른쪽 끝

const ACTION_NAMES = {
  forward: '전진', backward: '후진', turn_left: '좌회전', turn_right: '우회전', stop: '정지', wiggle: '흔들기',
};
// 돌봄 상태일 때 상태 칩과 말풍선 문구
const CARE_UI = {
  thirsty:   { chip: '배고파요', tone: 'warn', message: '배고파요… 물 주세요! 💧' },
  full:      { chip: '배불러요', tone: 'good', message: '꿀꺽꿀꺽… 배불러요~' },
  sick:      { chip: '아파요', tone: 'bad', message: '몸이 안 좋아요… 영양이 부족해요' },
  cared:     { chip: '영양 보충', tone: 'good', message: '영양제 고마워요!' },
  recovered: { chip: '회복했어요', tone: 'good', message: '다 나았어요! 기운이 나요 ✨' },
};
const LIGHT_CATS ={ dark: '어두움', normal: '밝음', unknown: '측정 전' };
const HUMIDITY_CATS = { dry: '건조', normal: '적당', humid: '눅눅', unknown: '센서 없음' };
const KEY_ACTIONS = {
  ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'backward', KeyS: 'backward',
  ArrowLeft: 'turn_left', KeyA: 'turn_left', ArrowRight: 'turn_right', KeyD: 'turn_right',
};

const $ = (id) => document.getElementById(id);

// localStorage는 막혀 있을 수 있어 항상 try로 감싼다(캐릭터 선택 같은 화면 설정만 저장).
const local = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 못 해도 화면은 동작 */ }
  },
};

const ui = {
  species: local.get('plantchi.species', 'basil'),
  speed: local.get('plantchi.speed', 0.3),
  serverOk: null,
  plant: null,
  estop: false,
  driveAction: undefined, // 서버가 본 지금 이동 방향(/api/robot/status의 drive.action). 멈춰 있으면 null
  history: [],          // { t, light, humidity }
  lastPollAt: 0,
  needs: { thirsty: false, sick: false }, // 물·영양이 필요한 상태(지금은 시연 버튼으로만 바뀜)
};

// ---------------------------------------------------------------- 공통

function showToast(text) {
  const toast = $('toast');
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2200);
}

function setBadge(el, text, kind) {
  el.textContent = text;
  el.className = `badge badge-${kind}`;
}

const pct = (level) => `${Math.round(level * 100)}%`;
const hum = (percent) => `${Math.round(percent)}%`;
const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');

// ---------------------------------------------------------------- 캐릭터

const stage = PlantchiArt.createStage($('stage'));

function currentMood() {
  if (ui.serverOk === false) return 'offline';
  const plant = ui.plant;
  if (!plant || plant.light_category === 'unknown') return 'waiting';
  return plant.mood;
}

function renderStage() {
  const mood = currentMood();
  const species = ui.species;
  const seen = PlantchiGrowth.seenStage(species);
  // 자랄 때가 됐으면 한 단계씩 진화 연출을 보여 준다(한 번에 여러 단계를 건너뛰면 차례로)
  if (PlantchiGrowth.stageOf(species) > seen && !PlantchiArt.isEvolving(stage)) {
    const onReveal = () => {
      PlantchiGrowth.markSeen(species, seen + 1);
      PlantchiShop.refresh();
      renderGrowth();
    };
    PlantchiArt.evolve(stage, { species, from: seen, to: seen + 1, onReveal }).then(renderStage);
  }
  const care = ui.needs.sick ? 'sick' : ui.needs.thirsty ? 'thirsty' : null;
  PlantchiArt.updateStage(stage, {
    species, stage: PlantchiGrowth.seenStage(species), mood, equipped: PlantchiShop.equipped(), care,
  });
  renderGrowth();

  // 돌봄 상태가 있으면 말풍선·상태 칩도 그 상태로 바꾼다
  const shownCare = PlantchiArt.careOf(stage);
  if (shownCare) {
    const c = CARE_UI[shownCare];
    $('message').textContent = c.message;
    $('mood-chip').textContent = c.chip;
    $('mood-chip').dataset.tone = c.tone;
    return;
  }
  if (ui.plant && ui.serverOk) $('message').textContent = ui.plant.message;
  const info = PlantchiArt.MOODS[mood] || PlantchiArt.MOODS.happy;
  const chip = $('mood-chip');
  chip.textContent = info.label;
  chip.dataset.tone = info.tone;
  if (mood === 'offline') $('message').textContent = '서버와 연결이 끊겼어요…';
}

function renderSpeciesList() {
  const list = $('species-list');
  list.innerHTML = '';
  for (const [id, ch] of Object.entries(PlantchiArt.CHARACTERS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'species';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(id === ui.species));
    btn.title = ch.name;
    btn.innerHTML = `<img src="${ch.src}" alt=""><span>${ch.name}</span>`;
    btn.addEventListener('click', () => {
      if (PlantchiArt.isEvolving(stage)) { showToast('진화하는 중이에요. 끝나면 바꿀 수 있어요'); return; }
      if (!PlantchiGrowth.isPlanted(id)) showToast(`${ch.name} 씨앗을 심었어요! 🌱`);
      PlantchiGrowth.plant(id);
      ui.species = id;
      local.set('plantchi.species', id);
      renderSpeciesList();
      renderStage();
      PlantchiShop.setSpecies(id);
    });
    list.append(btn);
  }
}

// 성장 단계 표시: 지금 단계, 심은 지 며칠째, 단계별 날짜, 다음 단계까지 남은 날
function renderGrowth() {
  const species = ui.species;
  const ch = PlantchiArt.CHARACTERS[species];
  const shown = PlantchiGrowth.seenStage(species);
  const age = Math.floor(PlantchiGrowth.ageDays(species)) + 1;
  $('growth-title').textContent = `${ch.name} · ${PlantchiArt.STAGE_NAMES[shown]}`;
  $('growth-age').textContent = `심은 지 ${age}일째`;

  const steps = $('growth-steps');
  const marks = [0, ...ch.days];
  const count = PlantchiArt.STAGE_NAMES.length;
  if (steps.childElementCount !== count) steps.innerHTML = '<li></li>'.repeat(count);
  [...steps.children].forEach((li, i) => {
    li.className = i < shown ? 'is-done' : i === shown ? 'is-now' : '';
    li.innerHTML = `<span>${PlantchiArt.STAGE_NAMES[i]}</span><small>${i === 0 ? '심은 날' : `${marks[i]}일`}</small>`;
  });

  const left = PlantchiGrowth.daysToNext(species);
  const stageNow = PlantchiGrowth.stageOf(species);
  let text;
  if (stageNow > shown) text = '자라는 중이에요…!';
  else if (left === null) text = '다 자랐어요! 🎉';
  else text = `${PlantchiArt.STAGE_NAMES[stageNow + 1]}까지 약 ${left < 1 ? '1일 미만' : `${Math.ceil(left)}일`} 남았어요`;
  $('growth-next').textContent = text;
}

// ---- 개발용: 상태 시연 (나중에 index.html의 #dev-care와 함께 지울 것)
// 토양 수분·영양 센서가 붙으면 ui.needs를 센서 값으로 정하고, 물·영양제는 실제로 준 뒤 기록 버튼으로 반응을 보여 주면 된다.
document.querySelectorAll('[data-care-demo]').forEach((button) => {
  button.addEventListener('click', () => {
    const what = button.dataset.careDemo;
    if (what === 'thirsty') { ui.needs.thirsty = true; showToast('흙이 말랐어요. 물이 필요해요'); }
    if (what === 'sick') { ui.needs.sick = true; showToast('영양이 부족해요'); }
    if (what === 'water') {
      ui.needs.thirsty = false;
      PlantchiArt.playCare(stage, [['full', 4200]], renderStage);
      showToast('물을 줬어요 💧');
    }
    if (what === 'nutrient') {
      ui.needs.sick = false;
      PlantchiArt.playCare(stage, [['cared', 2200], ['recovered', 2800]], renderStage);
      showToast('영양제를 줬어요 🧪');
    }
    if (what === 'reset') {
      ui.needs = { thirsty: false, sick: false };
      PlantchiArt.playCare(stage, [], renderStage);
    }
    renderStage();
  });
});

// ---- 개발용: 시간 건너뛰기 (나중에 index.html의 #dev-time과 함께 지울 것)
document.querySelectorAll('[data-skip-days]').forEach((button) => {
  button.addEventListener('click', () => {
    PlantchiGrowth.skipDays(Number(button.dataset.skipDays));
    showToast(`${button.textContent} 지났어요`);
    renderStage();
  });
});
$('btn-skip-next').addEventListener('click', () => {
  if (PlantchiGrowth.daysToNext(ui.species) === null) { showToast('이미 다 자랐어요'); return; }
  PlantchiGrowth.skipToNext(ui.species);
  renderStage();
});
$('btn-replant').addEventListener('click', () => {
  if (PlantchiArt.isEvolving(stage)) return;
  PlantchiGrowth.replant(ui.species);
  showToast(`${PlantchiArt.CHARACTERS[ui.species].name} 씨앗을 다시 심었어요`);
  PlantchiShop.refresh();
  renderStage();
});

function burstHearts() {
  const fx = stage.querySelector('.pet-fx');
  for (let i = 0; i < 5; i += 1) {
    const heart = document.createElement('span');
    heart.className = 'heart';
    heart.textContent = '♥';
    heart.style.left = `${38 + Math.random() * 24}%`;
    heart.style.animationDelay = `${i * 0.09}s`;
    fx.append(heart);
    setTimeout(() => heart.remove(), 1600);
  }
  PlantchiArt.react(stage, 'jump');
}

// ---------------------------------------------------------------- 센서 카드

function renderPlant(plant) {
  ui.plant = plant;
  $('message').textContent = plant.message;

  const light = plant.light_level;
  $('light-text').textContent = light === null ? '센서 없음' : pct(light);
  $('light-bar').style.width = light === null ? '0%' : pct(light);
  setCat($('light-cat'), LIGHT_CATS[plant.light_category] || '–', plant.light_category === 'dark' ? 'calm' : plant.light_category === 'normal' ? 'good' : 'muted');

  const humidity = plant.humidity_percent;
  $('humidity-text').textContent = humidity === null ? '센서 없음' : hum(humidity);
  $('humidity-bar').style.width = humidity === null ? '0%' : `${Math.max(0, Math.min(100, humidity))}%`;
  const hc = plant.humidity_category;
  setCat($('humidity-cat'), HUMIDITY_CATS[hc] || '–', hc === 'normal' ? 'good' : hc === 'unknown' ? 'muted' : 'warn');

  const cm = plant.obstacle_cm;
  $('obstacle-text').textContent = cm === null ? '센서 없음' : `${Math.round(cm)} cm`;
  const blocked = cm !== null && cm < OBSTACLE_STOP_CM;
  setCat($('obstacle-cat'), cm === null ? '측정 안 됨' : blocked ? '전진 불가' : '안전', cm === null ? 'muted' : blocked ? 'bad' : 'good');
  const dot = $('obstacle-dot');
  dot.hidden = cm === null;
  if (cm !== null) dot.style.left = `${Math.min(100, (cm / OBSTACLE_SCALE_CM) * 100)}%`;
  document.querySelector('.pad-up').classList.toggle('is-blocked', blocked);

  $('affection-bar').style.width = `${plant.affection}%`;
  $('affection-text').textContent = plant.affection;

  const banner = $('sensor-status');
  banner.hidden = plant.sensor_online;
  banner.textContent = plant.last_reading_at
    ? `센서 값이 ${clock(plant.last_reading_at)} 이후로 들어오지 않고 있어요. 로봇 프로그램이 켜져 있는지 확인하세요.`
    : '아직 센서 값을 받지 못했어요. 로봇 프로그램(python -m plantchi_robot)을 켜 주세요.';

  if (plant.sensor_online) {
    const now = Date.now();
    ui.history.push({ t: now, light, humidity });
    while (ui.history.length && ui.history[0].t < now - HISTORY_MS) ui.history.shift();
  }
  drawSpark($('light-spark'), 'light', (v) => pct(v), 0, 1);
  drawSpark($('humidity-spark'), 'humidity', hum, 0, 100);
}

function setCat(el, text, tone) {
  el.textContent = text;
  el.dataset.tone = tone;
}

// 작은 추이 그래프(최근 5분). 마우스를 올리면 그 시각의 값을 보여 준다.
function drawSpark(el, key, fmt, min, max) {
  const points = ui.history.filter((p) => p[key] !== null && p[key] !== undefined);
  el._spark = { points, key, fmt, min, max };
  if (points.length < 2) {
    el.innerHTML = '<span class="spark-empty">최근 5분 추이를 모으는 중…</span>';
    return;
  }
  const w = el.clientWidth || 200;
  const h = 44;
  const t0 = points[0].t;
  const span = Math.max(1, points[points.length - 1].t - t0);
  const x = (p) => ((p.t - t0) / span) * (w - 8) + 4;
  const y = (v) => h - 4 - ((v - min) / (max - min)) * (h - 8);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');
  const last = points[points.length - 1];
  el.innerHTML = `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <path d="${d}" class="spark-line"/>
      <circle cx="${x(last)}" cy="${y(last[key])}" r="3.5" class="spark-end"/>
      <line class="spark-cross" y1="2" y2="${h - 2}" hidden/>
      <circle class="spark-dot" r="4" hidden/>
    </svg>
    <span class="spark-tip" hidden></span>
    <span class="spark-caption">최근 ${Math.max(1, Math.round(span / 60000))}분</span>`;
  el._spark.geom = { x, y, w };
  if (el._hoverX !== undefined) showSparkHover(el, el._hoverX);
}

function showSparkHover(el, px) {
  const s = el._spark;
  if (!s || !s.geom) return;
  let best = s.points[0];
  for (const p of s.points) if (Math.abs(s.geom.x(p) - px) < Math.abs(s.geom.x(best) - px)) best = p;
  const cx = s.geom.x(best);
  const cy = s.geom.y(best[s.key]);
  const cross = el.querySelector('.spark-cross');
  const dot = el.querySelector('.spark-dot');
  const tip = el.querySelector('.spark-tip');
  // SVG 요소는 .hidden 속성이 없어서 hidden 특성을 직접 지운다
  cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.removeAttribute('hidden');
  dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.removeAttribute('hidden');
  tip.hidden = false;
  tip.innerHTML = `<b>${s.fmt(best[s.key])}</b> ${new Date(best.t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  tip.style.left = `${Math.min(Math.max(cx, 50), s.geom.w - 50)}px`;
}

for (const id of ['light-spark', 'humidity-spark']) {
  const el = $(id);
  el.addEventListener('pointermove', (e) => {
    el._hoverX = e.clientX - el.getBoundingClientRect().left;
    showSparkHover(el, el._hoverX);
  });
  el.addEventListener('pointerleave', () => {
    el._hoverX = undefined;
    el.querySelectorAll('.spark-cross, .spark-dot, .spark-tip').forEach((n) => n.setAttribute('hidden', ''));
  });
}

// ---------------------------------------------------------------- 로봇 상태

function renderRobot(status) {
  ui.estop = status.estop;
  ui.driveAction = status.drive ? status.drive.action : undefined;
  if (status.estop) {
    setBadge($('robot-status'), '정지됨', 'warn');
  } else if (status.robot_online) {
    setBadge($('robot-status'), '연결됨', 'on');
  } else {
    setBadge($('robot-status'), '오프라인', 'off');
  }
  $('btn-stop').hidden = status.estop;
  $('btn-resume').hidden = !status.estop;
  $('estop-cover').hidden = !status.estop;
  $('dpad').classList.toggle('is-disabled', status.estop);
  if (status.estop) endDriveLocally();

  const cmd = status.active_command;
  let detail;
  if (status.estop) detail = '비상 정지 중';
  else if (cmd) detail = `${ACTION_NAMES[cmd.action] || cmd.action} 명령 처리 중`;
  else detail = status.robot_online ? '대기 중' : '로봇 프로그램이 꺼져 있어요';
  $('robot-detail').textContent = detail;
}

// ---------------------------------------------------------------- 이동 전후 비교

function renderMove(move) {
  const card = $('move-card');
  // 서버는 정지 후 도착한 자리의 값을 기록하기까지(약 3~5초) 계속 moving을 보낸다.
  // 그동안 로봇이 멈춰 있으면 '측정 중'으로 보여 준다
  const measuring = move.state === 'moving' && !driving && ui.driveAction === null;
  const phase = measuring ? 'measuring' : move.state;
  card.dataset.state = phase;
  const { before, after } = move;
  $('move-state').textContent = { none: '기록 없음', moving: '이동 중…', measuring: '측정 중…', done: `완료 · ${clock(after && after.at)}` }[phase] || phase;
  $('move-before-light').textContent = before && before.light_level !== null ? pct(before.light_level) : '–';
  $('move-before-hum').textContent = before && before.humidity_percent !== null ? hum(before.humidity_percent) : '–';
  $('move-after-light').textContent = after && after.light_level !== null ? pct(after.light_level) : '–';
  $('move-after-hum').textContent = after && after.humidity_percent !== null ? hum(after.humidity_percent) : '–';

  let verdict = '조종 버튼으로 화분을 옮기면 전·후 환경을 비교해 줘요';
  if (phase === 'moving') verdict = '움직이는 중이에요. 정지하면 도착한 자리의 값을 기록해요';
  if (phase === 'measuring') {
    verdict = ui.plant && !ui.plant.sensor_online
      ? '센서 값이 들어오지 않아 도착한 자리를 아직 재지 못했어요'
      : '도착한 자리의 값을 재고 있어요. 몇 초만 기다려 주세요';
  }
  if (move.state === 'done' && before && after) {
    const parts = [];
    if (before.light_level !== null && after.light_level !== null) {
      const dl = Math.round((after.light_level - before.light_level) * 100);
      if (dl >= 10) parts.push(`밝기 +${dl}%p, 더 밝은 자리예요 ☀️`);
      else if (dl <= -10) parts.push(`밝기 ${dl}%p, 더 어두운 자리예요 🌙`);
      else parts.push('밝기는 비슷해요');
    }
    if (before.humidity_percent !== null && after.humidity_percent !== null) {
      const dh = Math.round(after.humidity_percent - before.humidity_percent);
      parts.push(`습도 ${dh >= 0 ? '+' : ''}${dh}%p`);
    }
    if (parts.length) verdict = parts.join(' · ');
  }
  $('move-verdict').textContent = verdict;
}

// ---------------------------------------------------------------- 주기적 갱신

async function refresh() {
  const [plant, robot, move] = await Promise.allSettled([
    PlantchiApi.getPlant(), PlantchiApi.getRobotStatus(), PlantchiApi.getLatestMove(),
  ]);
  const now = Date.now();
  const dt = ui.lastPollAt ? now - ui.lastPollAt : 0;
  ui.lastPollAt = now;

  if (plant.status === 'fulfilled') {
    ui.serverOk = true;
    setBadge($('connection'), '연결됨', 'on');
    renderPlant(plant.value);
    if (plant.value.mood === 'happy' && plant.value.sensor_online) PlantchiShop.tickHappy(dt);
  } else {
    ui.serverOk = false;
    setBadge($('connection'), '끊김', 'warn');
    setBadge($('robot-status'), '확인 불가', 'off');
    $('robot-detail').textContent = '서버에 연결할 수 없어요';
  }
  if (robot.status === 'fulfilled') renderRobot(robot.value);
  if (move.status === 'fulfilled') renderMove(move.value);
  renderStage();
  setTimeout(refresh, POLL_MS);
}

// ---------------------------------------------------------------- 원격 조종 (누르는 동안만 이동)

let driving = null; // { action, source, timer }

function sendDrive(action) {
  const speed = action === 'stop' ? undefined : ui.speed;
  return PlantchiApi.drive(action, speed)
    .then((res) => {
      if (res.estop && action !== 'stop') {
        endDriveLocally();
        showToast('비상 정지 중이라 움직이지 않아요');
      }
    })
    .catch((err) => {
      if (action === 'stop') return;
      endDriveLocally();
      showToast(`조종 실패: ${err.message} (로봇은 0.4초 안에 스스로 멈춰요)`);
    });
}

function startDrive(action, source) {
  if (ui.estop) {
    showToast('비상 정지 중이에요. “정지 해제” 후 조종하세요');
    return;
  }
  if (driving && driving.action === action) return;
  if (driving) clearInterval(driving.timer);
  driving = { action, source, timer: setInterval(() => sendDrive(action), DRIVE_REPEAT_MS) };
  document.querySelectorAll('[data-drive]').forEach((b) => b.classList.toggle('is-pressed', b.dataset.drive === action));
  const cm = ui.plant && ui.plant.obstacle_cm;
  if (action === 'forward' && cm !== null && cm !== undefined && cm < OBSTACLE_STOP_CM) {
    showToast(`앞 ${Math.round(cm)}cm에 장애물이 있어서 로봇이 전진하지 않아요`);
  }
  sendDrive(action);
}

function endDriveLocally() {
  if (!driving) return false;
  clearInterval(driving.timer);
  driving = null;
  document.querySelectorAll('[data-drive]').forEach((b) => b.classList.remove('is-pressed'));
  return true;
}

function stopDrive() {
  if (endDriveLocally()) sendDrive('stop');
}

document.querySelectorAll('[data-drive]').forEach((button) => {
  const action = button.dataset.drive;
  button.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    startDrive(action, 'pointer');
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    button.addEventListener(type, () => { if (driving && driving.source === 'pointer') stopDrive(); });
  }
  button.addEventListener('contextmenu', (e) => e.preventDefault());
});

$('btn-drive-stop').addEventListener('click', () => {
  endDriveLocally();
  sendDrive('stop');
});

document.addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
  if (e.code === 'Escape') { e.preventDefault(); emergencyStop(); return; }
  if (!document.querySelector('.view[data-view="dashboard"]').classList.contains('is-active')) return;
  // 개발용: 숫자 키로 상태 시연(#dev-care 버튼과 같음)
  const careDemo = { Digit1: 'thirsty', Digit2: 'water', Digit3: 'sick', Digit4: 'nutrient', Digit0: 'reset' }[e.code];
  if (careDemo) { document.querySelector(`[data-care-demo="${careDemo}"]`).click(); return; }
  if (e.code === 'Space') { e.preventDefault(); endDriveLocally(); sendDrive('stop'); return; }
  const action = KEY_ACTIONS[e.code];
  if (!action) return;
  e.preventDefault();
  if (!e.repeat) startDrive(action, 'key');
});

document.addEventListener('keyup', (e) => {
  const action = KEY_ACTIONS[e.code];
  if (action && driving && driving.action === action) stopDrive();
});

// 창을 벗어나거나 화면이 가려지면 무조건 멈춘다.
window.addEventListener('blur', stopDrive);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopDrive(); });
window.addEventListener('pagehide', () => {
  if (!endDriveLocally()) return;
  fetch('/api/robot/drive', {
    method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }),
  }).catch(() => {});
});

document.querySelectorAll('[data-speed]').forEach((button) => {
  const value = Number(button.dataset.speed);
  button.classList.toggle('is-active', value === ui.speed);
  button.addEventListener('click', () => {
    ui.speed = value;
    local.set('plantchi.speed', value);
    document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('is-active', b === button));
  });
});

// ---------------------------------------------------------------- 비상 정지

async function emergencyStop() {
  endDriveLocally();
  try {
    renderRobot(await PlantchiApi.stopRobot());
    showToast('로봇을 비상 정지했어요');
  } catch (err) {
    showToast(`정지 요청 실패: ${err.message}`);
  }
}

$('btn-stop').addEventListener('click', emergencyStop);

$('btn-resume').addEventListener('click', async () => {
  try {
    renderRobot(await PlantchiApi.resumeRobot());
    showToast('정지를 해제했어요');
  } catch (err) {
    showToast(`해제 실패: ${err.message}`);
  }
});

// ---------------------------------------------------------------- 돌봄 인터랙션 (추가 기능)

$('btn-pet').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await PlantchiApi.care('pet');
    renderPlant(result.plant);
    burstHearts();
    PlantchiShop.addPoints(10);
    showToast(result.command ? '돌봄 인터랙션 완료! 로봇이 반응해요 (+10P)' : '돌봄 인터랙션 완료! (로봇 정지 중, +10P)');
  } catch (err) {
    showToast(`돌봄 인터랙션 실패: ${err.message}`);
  } finally {
    button.disabled = false;
  }
});

// ---------------------------------------------------------------- 화면 전환

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    stopDrive();
    const view = tab.dataset.view;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('is-active', v.dataset.view === view));
    if (view === 'dashboard') {
      drawSpark($('light-spark'), 'light', (v) => pct(v), 0, 1);
      drawSpark($('humidity-spark'), 'humidity', hum, 0, 100);
    }
  });
});

if (!PlantchiArt.CHARACTERS[ui.species]) ui.species = 'basil';
PlantchiGrowth.plant(ui.species);
PlantchiShop.init({ species: ui.species, toast: showToast, onChange: renderStage });
renderSpeciesList();
renderStage();
refresh();

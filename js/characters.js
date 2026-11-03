// 캐릭터·성장 단계·표정·꾸미기 아이템 정의와 무대(stage) 그리기.
// 표정(mood)은 서버의 PlantState.mood(happy / sleepy / dry / humid)를 그대로 쓴다.
// 그림은 식물·성장 단계별 픽셀 이미지 1장 + 표정 효과(CSS)로 만들고, 다 자란 모습은 표정 그림 4가지를 함께 쓴다.

const PlantchiArt = (() => {
  const STAGE_NAMES = ['씨앗', '새싹', '다 자란 모습'];

  // days: 심은 날부터 [새싹, 다 자란 모습]이 되는 날. 실내 재배 기준 대략값:
  // 새싹 = 발아까지, 다 자란 모습 = 첫 수확·성체(몬스테라·선인장은 실제로 몇 년이라 1년으로 줄임)
  // stages: 단계별 그림과 위치(이미지 기준 %). w·top: 그림이 차지하는 너비·윗부분, eye: 두 눈의 가운데,
  // eyeW: 두 눈을 덮는 너비, head·neck: 모자·목 아이템 자리. 눈이 없는 단계는 얼굴·목 아이템과 수면 안대를 숨긴다.
  // 단계 그림은 같은 식물끼리 같은 배율·같은 캔버스로 잘랐다(원본 시트의 크기 비율 그대로).
  const CHARACTERS = {
    basil: { name: '바질', days: [5, 50], stages: [
      { src: 'basil-seed.png', w: 30.7, top: 65.4, eye: [50.5, 84.5], eyeW: 19.6, head: [50.5, 65.4], neck: [50.5, 90.6] },
      { src: 'basil-sprout.png', w: 49.0, top: 58.8, eye: [50.3, 86.6], eyeW: 17.6, head: [50.3, 67.3], neck: [50.3, 91.7] },
      { src: 'basil-adult.png', w: 71.2, top: 35.9, head: [50.0, 35.9] }] },
    monstera: { name: '몬스테라', days: [10, 365], stages: [
      { src: 'monstera-seed.png', w: 28.7, top: 68.8, eye: [50.0, 83.0], eyeW: 18.2, head: [50.0, 68.8], neck: [50.0, 89.9] },
      { src: 'monstera-sprout.png', w: 42.0, top: 54.1, eye: [48.9, 86.6], eyeW: 14.3, head: [48.9, 58.6], neck: [48.9, 91.7] },
      { src: 'monstera-adult.png', w: 78.3, top: 39.5, head: [50.0, 39.5] }] },
    cactus: { name: '선인장', days: [7, 365], stages: [
      { src: 'cactus-seed.png', w: 30.4, top: 63.5, eye: [49.6, 83.5], eyeW: 19.3, head: [49.6, 63.5], neck: [49.6, 90.4] },
      { src: 'cactus-sprout.png', w: 36.5, top: 54.7, eye: [49.7, 84.5], eyeW: 19.3, head: [49.7, 57.4], neck: [49.7, 90.9] },
      { src: 'cactus-adult.png', w: 67.6, top: 33.1, head: [50.0, 33.1] }] },
    strawberry: { name: '딸기', days: [10, 120], stages: [
      { src: 'strawberry-seed.png', w: 31.2, top: 65.6, eye: [50.5, 84.4], eyeW: 18.5, head: [50.5, 65.6], neck: [50.5, 90.6] },
      { src: 'strawberry-sprout.png', w: 53.9, top: 48.1, eye: [48.4, 80.1], eyeW: 18.5, head: [48.4, 59.7], neck: [48.4, 88.4] },
      { src: 'strawberry-adult.png', w: 77.9, top: 37.0, head: [50.0, 37.0] }] },
    succulent: { name: '다육이', days: [7, 180], stages: [
      { src: 'succulent-seed.png', w: 32.0, top: 64.7, eye: [50.3, 84.7], eyeW: 19.0, head: [50.3, 64.7], neck: [50.3, 91.0] },
      { src: 'succulent-sprout.png', w: 44.0, top: 56.7, eye: [48.5, 84.7], eyeW: 19.0, head: [48.5, 56.7], neck: [48.5, 90.7] },
      { src: 'succulent-adult.png', w: 65.3, top: 36.0, head: [50.0, 36.0] }] },
    sunflower: { name: '해바라기', days: [5, 70], stages: [
      { src: 'sunflower-seed.png', w: 29.1, top: 63.0 },
      { src: 'sunflower-sprout.png', w: 52.7, top: 49.1, eye: [50.1, 86.5], eyeW: 17.3, head: [50.1, 59.4], neck: [50.1, 91.7] },
      { src: 'sunflower-adult.png', w: 55.8, top: 27.3, head: [50.0, 27.3] }] },
    lettuce: { name: '상추', days: [3, 30], stages: [
      { src: 'lettuce-seed.png', w: 29.9, top: 65.9, eye: [50.3, 83.8], eyeW: 17.4, head: [50.3, 66.5], neck: [50.3, 90.4] },
      { src: 'lettuce-sprout.png', w: 53.7, top: 54.9, eye: [50.0, 85.7], eyeW: 17.4, head: [50.0, 64.6], neck: [50.0, 91.3] },
      { src: 'lettuce-adult.png', w: 70.7, top: 41.5, head: [50.0, 41.5] }] },
    tomato: { name: '방울토마토', days: [5, 80], stages: [
      { src: 'tomato-seed.png', w: 31.6, top: 67.1, eye: [50.3, 85.2], eyeW: 19.9, head: [50.3, 67.1], neck: [50.3, 91.0] },
      { src: 'tomato-sprout.png', w: 50.0, top: 51.9, eye: [48.1, 86.3], eyeW: 17.1, head: [48.1, 61.4], neck: [48.1, 91.6] },
      { src: 'tomato-adult.png', w: 73.4, top: 35.4, head: [50.0, 35.4] }] },
    pepper: { name: '고추', days: [7, 100], stages: [
      { src: 'pepper-seed.png', w: 29.4, top: 67.6, eye: [50.2, 84.2], eyeW: 17.6, head: [50.2, 67.6], neck: [50.2, 90.6] },
      { src: 'pepper-sprout.png', w: 46.5, top: 52.4, eye: [48.2, 87.1], eyeW: 14.1, head: [48.2, 64.7], neck: [48.2, 92.1] },
      { src: 'pepper-adult.png', w: 62.9, top: 38.8, head: [50.0, 38.8] }] },
    perilla: { name: '깻잎', days: [5, 45], stages: [
      { src: 'perilla-seed.png', w: 27.7, top: 69.4, eye: [50.4, 86.7], eyeW: 18.2, head: [50.4, 69.4], neck: [50.4, 91.9] },
      { src: 'perilla-sprout.png', w: 50.9, top: 57.2, eye: [49.9, 88.0], eyeW: 13.9, head: [49.9, 63.6], neck: [49.9, 92.5] },
      { src: 'perilla-adult.png', w: 74.6, top: 41.0, head: [50.0, 41.0] }] },
    scallion: { name: '대파', days: [7, 100], stages: [
      { src: 'scallion-seed.png', w: 28.4, top: 63.6, eye: [50.0, 86.1], eyeW: 17.6, head: [50.0, 63.6], neck: [50.0, 91.5] },
      { src: 'scallion-sprout.png', w: 40.7, top: 38.3, eye: [50.5, 85.4], eyeW: 14.8, head: [50.5, 40.7], neck: [50.5, 91.2] },
      { src: 'scallion-adult.png', w: 55.6, top: 27.8, head: [50.0, 27.8] }] },
    arugula: { name: '루꼴라', days: [3, 25], stages: [
      { src: 'arugula-seed.png', w: 30.3, top: 67.9, eye: [50.5, 84.4], eyeW: 18.2, head: [50.5, 67.9], neck: [50.5, 90.7] },
      { src: 'arugula-sprout.png', w: 49.7, top: 50.3, eye: [49.4, 87.6], eyeW: 15.5, head: [49.4, 52.7], neck: [49.4, 92.3] },
      { src: 'arugula-adult.png', w: 77.6, top: 33.3, head: [50.0, 33.3] }] },
  };
  for (const ch of Object.values(CHARACTERS)) {
    for (const st of ch.stages) st.src = `assets/characters/${st.src}`;
    ch.src = ch.stages[2].src; // 목록·지도에 쓰는 대표 그림(다 자란 모습)
  }

  // 표정 그림: assets/characters/poses/<식물>-<묶음>-<표정>.png
  // 씨앗·새싹: hungry(배고픔) · cold(추움). 단계 그림과 같은 캔버스·배율이라 그대로 겹쳐 보여 준다.
  // 다 자란 모습: sick(아픈) · sad(슬픈) · happy(행복한) · hungry(배고픈). 별도 시트라 POSE_H로 크기를 맞춘다.
  // POSE_H: 다 자란 모습 표정 그림 속 몸통 높이(%, 4가지의 중앙값).
  const GROWN = 2;
  const POSE_GROUPS = ['seed', 'sprout', 'grown'];
  const POSE_NAMES = {
    seed: ['hungry', 'cold'],
    sprout: ['hungry', 'cold'],
    grown: ['sick', 'sad', 'happy', 'hungry'],
  };
  const POSE_H = {
    basil: 55.9,
    monstera: 52.9,
    cactus: 50.5,
    strawberry: 54.7,
    succulent: 56.6,
    sunflower: 55.9,
    lettuce: 55.4,
    tomato: 52.5,
    pepper: 51.0,
    perilla: 60.4,
    scallion: 60.8,
    arugula: 58.2,
  };

  function poseFor(species, stageIdx, pose) {
    const group = POSE_GROUPS[stageIdx];
    if (!group || !POSE_NAMES[group].includes(pose)) return null;
    const st = CHARACTERS[species].stages[stageIdx];
    const k = stageIdx === GROWN ? (97 - st.top) / POSE_H[species] : 1;
    return { src: `assets/characters/poses/${species}-${group}-${pose}.png`, k };
  }

  // 기분별 표정 그림. 졸려요(어두움)는 표정 그림 없이 수면 안대·Zzz 효과로 보여 준다.
  // 씨앗·새싹은 눅눅해요(습도 높음)일 때 추운 모습(목도리)을 쓴다.
  // 표정 그림을 보여 주는 동안은 꾸미기 아이템이 숨겨지므로, 아이템을 입고 있으면 기본 그림 + 아이템으로 둔다.
  const MOOD_POSES = {
    seed: { humid: 'cold' },
    sprout: { humid: 'cold' },
    grown: { happy: 'happy', dry: 'sad', humid: 'sad' },
  };

  // 돌봄 상태. 이 상태일 때는 걷거나 뛰지 않고 제자리에서만 움직인다(모양은 style.css의 .pet[data-care]).
  // pose: 쓸 표정 그림, bubble: 포즈 그림이 없을 때 머리 옆에 띄울 아이콘, texts: 번갈아 떠오르는 말
  const CARE = {
    thirsty:   { pose: 'hungry',    bubble: '💧', texts: ['꼬르륵…', '배고파요…', '물 주세요…'] },
    full:      { pose: 'happy',     bubble: '💙', texts: ['꿀꺽꿀꺽', '배불러요~', '꺼억!'] },
    sick:      { pose: 'sick',      bubble: '🤒', texts: ['끙…', '어지러워요…', '기운이 없어요'] },
    cared:     { pose: 'happy',     bubble: '🧪', texts: ['영양 보충!', '냠냠'] },
    recovered: { pose: 'happy',     bubble: '✨', texts: ['다 나았어요!', '기운 나요!'] },
  };

  // 화면 문구. 서버가 주는 message가 우선이고, 이 표는 상태 칩과 연결이 끊겼을 때만 쓴다.
  const MOODS = {
    happy:   { label: '행복해요', tone: 'good' },
    sleepy:  { label: '졸려요',   tone: 'calm' },
    dry:     { label: '건조해요', tone: 'warn' },
    humid:   { label: '눅눅해요', tone: 'warn' },
    waiting: { label: '기다리는 중', tone: 'muted' },
    offline: { label: '연결 끊김', tone: 'muted' },
  };

  const LINE = '#2c4a2a';

  // 꾸미기 아이템(추가 기능). svg는 해당 위치(slot)의 상자를 꽉 채우도록 그린다.
  const ITEMS = [
    { id: 'hat-crown', slot: 'hat', name: '반짝 왕관', price: { gem: 30 },
      svg: `<svg viewBox="0 0 100 70"><path d="M12 60 8 18l22 20L50 8l20 30 22-20-4 42Z" fill="#f6c945" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="44" r="7" fill="#e86a8d" stroke="${LINE}" stroke-width="3"/><circle cx="27" cy="50" r="4" fill="#7fb3e8"/><circle cx="73" cy="50" r="4" fill="#7fb3e8"/></svg>` },
    { id: 'hat-straw', slot: 'hat', name: '밀짚모자', price: { pt: 120 },
      svg: `<svg viewBox="0 0 100 70"><ellipse cx="50" cy="52" rx="46" ry="13" fill="#f3d38a" stroke="${LINE}" stroke-width="4"/><path d="M26 50c0-26 10-40 24-40s24 14 24 40Z" fill="#f3d38a" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/><path d="M27 42h46v8H27Z" fill="#e86a6a"/></svg>` },
    { id: 'hat-ribbon', slot: 'hat', name: '분홍 리본', price: { pt: 60 },
      svg: `<svg viewBox="0 0 100 70"><path d="M50 35 14 14c-6 10-6 32 0 42Z" fill="#f4a6b8" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/><path d="M50 35 86 14c6 10 6 32 0 42Z" fill="#f4a6b8" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="35" r="10" fill="#e86a8d" stroke="${LINE}" stroke-width="4"/></svg>` },
    { id: 'hat-party', slot: 'hat', name: '파티 모자', price: { pt: 90 },
      svg: `<svg viewBox="0 0 100 70"><path d="M28 64 50 10l22 54Z" fill="#9ed2f0" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/><path d="M37 42h26M32 54h36" stroke="#f6c945" stroke-width="6"/><circle cx="50" cy="9" r="7" fill="#e86a8d" stroke="${LINE}" stroke-width="3"/></svg>` },
    { id: 'hat-beanie', slot: 'hat', name: '털모자', price: { gem: 15 },
      svg: `<svg viewBox="0 0 100 70"><path d="M16 58c0-26 14-42 34-42s34 16 34 42Z" fill="#e86a6a" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/><rect x="12" y="52" width="76" height="14" rx="7" fill="#fff6e8" stroke="${LINE}" stroke-width="4"/><circle cx="50" cy="13" r="9" fill="#fff6e8" stroke="${LINE}" stroke-width="4"/></svg>` },
    { id: 'face-sun', slot: 'face', name: '선글라스', price: { pt: 150 },
      svg: `<svg viewBox="0 0 100 40"><rect x="4" y="6" width="38" height="26" rx="12" fill="#2b2b33" stroke="${LINE}" stroke-width="3"/><rect x="58" y="6" width="38" height="26" rx="12" fill="#2b2b33" stroke="${LINE}" stroke-width="3"/><path d="M42 16q8-6 16 0" fill="none" stroke="${LINE}" stroke-width="4"/><path d="M12 12l8 0" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>` },
    { id: 'face-round', slot: 'face', name: '동글 안경', price: { pt: 80 },
      svg: `<svg viewBox="0 0 100 40"><circle cx="24" cy="20" r="16" fill="rgba(255,255,255,.25)" stroke="#a0603a" stroke-width="4"/><circle cx="76" cy="20" r="16" fill="rgba(255,255,255,.25)" stroke="#a0603a" stroke-width="4"/><path d="M40 18q10-6 20 0" fill="none" stroke="#a0603a" stroke-width="4"/></svg>` },
    { id: 'neck-bow', slot: 'neck', name: '나비넥타이', price: { pt: 70 },
      svg: `<svg viewBox="0 0 100 40"><path d="M50 20 18 4v32Z" fill="#e86a6a" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/><path d="M50 20 82 4v32Z" fill="#e86a6a" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/><rect x="42" y="12" width="16" height="16" rx="5" fill="#c84b4b" stroke="${LINE}" stroke-width="4"/></svg>` },
    { id: 'neck-scarf', slot: 'neck', name: '줄무늬 목도리', price: { gem: 12 },
      svg: `<svg viewBox="0 0 100 40"><path d="M6 10q44 14 88 0v14q-44 14-88 0Z" fill="#7fb3e8" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/><path d="M66 22l4 16h12l-4-18" fill="#7fb3e8" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/><path d="M28 15v13M50 17v13" stroke="#fff6e8" stroke-width="5"/></svg>` },
    // 배경: 아늑한 방은 기본(무료), 나머지는 젬으로 산다. 그림은 BACKGROUNDS
    { id: 'bg-room', slot: 'bg', name: '아늑한 방', free: true },
    { id: 'bg-greenhouse', slot: 'bg', name: '유리 온실', price: { gem: 30 } },
    { id: 'bg-garden', slot: 'bg', name: '꽃 정원', price: { gem: 25 } },
    { id: 'bg-rainroom', slot: 'bg', name: '비 오는 방', price: { gem: 20 } },
    { id: 'bg-forest', slot: 'bg', name: '숲속 공터', price: { gem: 25 } },
    { id: 'bg-ruins', slot: 'bg', name: '숲속 유적', price: { gem: 40 } },
  ];

  const SLOT_NAMES = { hat: '모자', face: '얼굴', neck: '목', bg: '배경' };

  // 배경 그림: assets/backgrounds/<장소>-day.png / -night.png (큰 픽셀 16색). 어두워서 졸릴 때(sleepy)는 밤 그림을 쓴다.
  const DEFAULT_BG = 'bg-room';
  const BACKGROUNDS = {};
  for (const id of ['room', 'greenhouse', 'garden', 'rainroom', 'forest', 'ruins']) {
    BACKGROUNDS[`bg-${id}`] = { day: `assets/backgrounds/${id}-day.png`, night: `assets/backgrounds/${id}-night.png` };
  }
  const bgOf = (id) => BACKGROUNDS[id] || BACKGROUNDS[DEFAULT_BG]; // 예전 배경 아이템(별밤 방 등)은 기본 배경으로

  // 무대 뼈대. 표정 효과는 모두 미리 그려 두고 CSS의 [data-mood]로 켜고 끈다(애니메이션이 매번 다시 시작되지 않게).
  const STAGE_HTML = `
    <div class="scene">
      <div class="window"><div class="sky"></div><span class="sun"></span><span class="moon"></span>
        <span class="stars"></span><span class="rain"></span><span class="frame"></span></div>
      <div class="floor"><span class="cracks"></span></div>
    </div>
    <div class="pet" title="눌러 보세요">
      <div class="pet-fx">
        <div class="cloud"><svg viewBox="0 0 120 70"><path d="M30 56a20 20 0 0 1 2-40 26 26 0 0 1 48-4 20 20 0 0 1 12 44Z" fill="#cfd9e6" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/></svg>
          <i></i><i></i><i></i></div>
        <span class="z z1">Z</span><span class="z z2">z</span><span class="z z3">z</span>
        <span class="step-dust"></span><span class="step-dust"></span>
        <span class="thirst"><svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" fill="none" stroke="#5aa7d8" stroke-width="2.4" stroke-dasharray="3 3"/></svg></span>
        <span class="care-bubble"></span>
        <span class="care-text"></span>
        <span class="water-fall"><i></i><i></i><i></i></span>
        <span class="nutri-bottle"><svg viewBox="0 0 24 32"><path d="M9 2h6v5l3 4v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V11l3-4Z" fill="#c9f0d0" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/><path d="M6 17h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" fill="#5fc27a"/><path d="M8 1h8v4H8Z" fill="#e86a8d" stroke="${LINE}" stroke-width="2"/></svg></span>
      </div>
      <div class="pet-dir"><div class="pet-move"><div class="pet-body">
        <img class="pet-img" alt="">
        <img class="pet-pose" alt="">
        <div class="acc acc-neck"></div>
        <div class="acc acc-face"></div>
        <div class="acc acc-hat"></div>
        <svg class="sleep-mask" viewBox="0 0 100 34"><rect x="2" y="3" width="96" height="28" rx="14" fill="#a9c4ef" stroke="${LINE}" stroke-width="3.5"/><path d="M18 16q8 7 16 0M66 16q8 7 16 0" fill="none" stroke="${LINE}" stroke-width="3.5" stroke-linecap="round"/></svg>
        <svg class="sweat" viewBox="0 0 20 28"><path d="M10 2s8 10 8 16a8 8 0 0 1-16 0c0-6 8-16 8-16Z" fill="#9ed2f0" stroke="${LINE}" stroke-width="2.5"/></svg>
      </div></div></div>
      <div class="pet-shadow"></div>
    </div>
    <div class="fx">
      <span class="glint s1"></span><span class="glint s2"></span><span class="glint s3"></span>
      <span class="dust d1"></span><span class="dust d2"></span><span class="dust d3"></span><span class="dust d4"></span>
      <span class="drop p1"></span><span class="drop p2"></span><span class="drop p3"></span><span class="drop p4"></span><span class="drop p5"></span>
    </div>
    <div class="evo" aria-hidden="true"><span class="evo-rays"></span><span class="evo-white"></span></div>
    <p class="evo-banner" role="status"></p>`;

  // ---------------------------------------------------------------- 모션
  // 기분마다 할 수 있는 동작 목록. 몇 초마다 하나를 골라 한 번 재생한다(같은 이름이 여러 번이면 더 자주 나옴).
  // 동작의 모양은 style.css의 .pet[data-act="..."] 규칙에 있다.
  const MOTIONS = {
    happy:   ['walk', 'walk', 'jump', 'hop3', 'spin', 'dance', 'look'],
    sleepy:  [],   // 햇빛이 없으면 자는 중: 숨쉬기와 Zzz만 하고 가만히 있는다
    dry:     ['wilt', 'fan', 'shuffle'],
    humid:   ['shake', 'lookup', 'shuffle'],
    waiting: ['look', 'hop'],
    offline: [],
  };
  const ACT_MS = {
    jump: 900, hop3: 1300, spin: 1000, dance: 1700, look: 1900, hop: 600,
    wilt: 2600, fan: 1200, shake: 900, lookup: 1900,
  };
  const WALK_SPEED = { walk: 16, shuffle: 6 }; // 초당 이동 거리(무대 너비 %)
  const REACTIONS = { happy: 'jump', dry: 'wilt', humid: 'shake' };
  const STILL_MOODS = ['sleepy', 'offline'];   // 누르거나 돌봄 인터랙션을 해도 움직이지 않는 상태
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  function stopAct(el) {
    const st = el._motion;
    clearTimeout(st.actTimer);
    const pet = el.querySelector('.pet');
    if (pet.dataset.act === 'walk' || pet.dataset.act === 'shuffle') {
      // 걷던 자리에서 멈춘다
      // .pet은 translateX(-50%)로 가운데를 맞추므로 offsetLeft가 곧 가운데 위치
      st.x = (pet.offsetLeft / el.clientWidth) * 100;
      pet.style.transition = 'none';
      pet.style.left = `${st.x}%`;
    }
    delete pet.dataset.act;
  }

  function play(el, act) {
    const st = el._motion;
    const pet = el.querySelector('.pet');
    stopAct(el);
    void pet.offsetWidth; // 같은 동작을 연달아 해도 애니메이션이 처음부터 다시 시작되게
    let ms = ACT_MS[act] || 1000;
    if (WALK_SPEED[act]) {
      let target = 30 + Math.random() * 40;
      if (Math.abs(target - st.x) < 10) target = st.x < 50 ? Math.min(70, st.x + 18) : Math.max(30, st.x - 18);
      ms = (Math.abs(target - st.x) / WALK_SPEED[act]) * 1000;
      const dir = target < st.x ? -1 : 1;
      pet.style.setProperty('--dir', dir);    // 가는 방향(기울기·발먼지)
      pet.style.setProperty('--face', -dir);  // 바라보는 방향: 원본 그림을 뒤집어야 가는 쪽을 본다
      pet.style.transition = `left ${ms}ms ease-in-out`;
      pet.style.left = `${target}%`;
      st.x = target;
    }
    pet.dataset.act = act;
    return new Promise((resolve) => {
      st.actTimer = setTimeout(() => { delete pet.dataset.act; resolve(); }, ms);
    });
  }

  function scheduleNext(el) {
    const st = el._motion;
    clearTimeout(st.idleTimer);
    st.idleTimer = setTimeout(async () => {
      if (el._evolving) return; // 진화가 끝나면 evolve()가 다시 예약한다
      // 돌봄 상태(배고픔·아픔 등)일 때는 제자리에 있는다
      const list = el.querySelector('.pet').dataset.care ? [] : MOTIONS[el.dataset.mood] || [];
      if (list.length && !document.hidden && !reducedMotion.matches) await play(el, pick(list));
      scheduleNext(el);
    }, 800 + Math.random() * 1800);
  }

  // 지금 하던 동작을 멈추고 바로 반응한다(눌렀을 때, 기분이 바뀌었을 때, 돌봄 인터랙션).
  function react(el, act) {
    if (reducedMotion.matches || !el._motion || el._evolving || STILL_MOODS.includes(el.dataset.mood)) return;
    if (el.querySelector('.pet').dataset.care) return;
    clearTimeout(el._motion.idleTimer);
    play(el, act).then(() => scheduleNext(el));
  }

  function createStage(el) {
    el.innerHTML = STAGE_HTML;
    el._motion = { x: 50, idleTimer: 0, actTimer: 0 };
    el.querySelector('.pet').addEventListener('click', () => react(el, pick(['jump', 'spin', 'hop3'])));
    scheduleNext(el);
    return el;
  }

  // 그림과 아이템 위치를 성장 단계에 맞춘다. 위치 값은 .pet에 CSS 변수로 두어 그림·효과가 함께 쓴다.
  function applyStageArt(el, species, stageIdx) {
    const ch = CHARACTERS[species] || CHARACTERS.basil;
    const st = ch.stages[stageIdx];
    const img = el.querySelector('.pet-img');
    if (img.getAttribute('src') !== st.src) img.setAttribute('src', st.src);
    const pet = el.querySelector('.pet');
    pet.dataset.stage = stageIdx;
    pet.toggleAttribute('data-noface', !st.eye);
    const eye = st.eye || [50, st.top + 20];
    const vars = {
      '--obj-w': st.w, '--obj-top': st.top,
      '--eye-x': eye[0], '--eye-y': eye[1], '--eye-w': st.eyeW || 20,
      '--head-x': (st.head || eye)[0], '--head-y': (st.head || [50, st.top + 4])[1],
      '--neck-x': (st.neck || eye)[0], '--neck-y': (st.neck || eye)[1],
    };
    for (const [k, v] of Object.entries(vars)) pet.style.setProperty(k, `${v}%`);
  }

  // ---------------------------------------------------------------- 돌봄 상태(배고픔·배부름·아픔·회복)
  // 계속되는 상태(el._care: 'thirsty' | 'sick')는 updateStage()로, 잠깐 보여 주는 반응(el._transient)은 playCare()로 정한다.
  function applyCare(el) {
    if (!el._last) return;
    const { species, stage, mood } = el._last;
    const pet = el.querySelector('.pet');
    const care = el._transient || el._care || '';
    const prev = pet.dataset.care || '';
    if (care !== prev) {
      if (care) {
        if (!prev) { clearTimeout(el._motion.idleTimer); stopAct(el); } // 하던 동작을 그 자리에서 멈춘다
        pet.dataset.care = care;
        startCareText(el, care);
      } else {
        delete pet.dataset.care;
        clearInterval(el._careTextTimer);
        scheduleNext(el);
      }
    }
    el.querySelector('.care-bubble').textContent = care ? CARE[care].bubble : '';

    // 표정 그림: 돌봄 상태의 그림, 아니면 기분에 맞는 그림(아이템을 입고 있지 않을 때)
    const poseKey = care ? CARE[care].pose : (!el._dressed && MOOD_POSES[POSE_GROUPS[stage]][mood]) || '';
    const pose = poseKey && !el._evolving ? poseFor(species, stage, poseKey) : null;
    const img = el.querySelector('.pet-pose');
    if (pose) {
      if (img.getAttribute('src') !== pose.src) img.setAttribute('src', pose.src);
      pet.style.setProperty('--pose-k', pose.k.toFixed(3));
      pet.dataset.pose = poseKey;
    } else {
      delete pet.dataset.pose;
    }
  }

  function startCareText(el, care) {
    const text = el.querySelector('.care-text');
    const lines = CARE[care].texts;
    let i = 0;
    const show = () => {
      text.textContent = lines[i % lines.length];
      text.classList.remove('is-pop');
      void text.offsetWidth;
      text.classList.add('is-pop');
      i += 1;
    };
    clearInterval(el._careTextTimer);
    show();
    el._careTextTimer = setInterval(show, 1700);
  }

  // steps: [['full', 4000]]처럼 [상태, 보여 줄 시간(ms)]을 차례로 보여 준 뒤 원래 상태로 돌아간다.
  // 빈 배열이면 보여 주던 반응을 바로 끝낸다. onChange는 상태가 바뀔 때마다 부른다(말풍선·칩 갱신용).
  async function playCare(el, steps, onChange = () => {}) {
    const token = (el._careToken || 0) + 1;
    el._careToken = token;
    for (const [care, ms] of steps) {
      el._transient = care;
      applyCare(el);
      if (care === 'recovered') burstStars(el);
      onChange();
      await wait(ms);
      if (el._careToken !== token) return; // 그 사이 다른 반응이 시작됨
    }
    el._transient = null;
    applyCare(el);
    onChange();
  }

  // ---------------------------------------------------------------- 진화
  // 가운데로 와서 빛나는 실루엣이 옛 모습 ↔ 새 모습을 점점 빠르게 오가다가 번쩍! 하고 새 모습이 나온다.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // onReveal: 새 모습이 나오는 순간 부른다(성장 기록 갱신용). 반환값은 연출이 모두 끝날 때 끝난다.
  async function evolve(el, { species, from, to, onReveal = () => {} }) {
    const st = el._motion;
    el._evolving = true;
    clearTimeout(st.idleTimer);
    stopAct(el);
    const pet = el.querySelector('.pet');
    const ch = CHARACTERS[species] || CHARACTERS.basil;
    const banner = el.querySelector('.evo-banner');
    const fast = reducedMotion.matches;

    pet.style.transition = 'left 500ms ease-in-out';
    pet.style.left = '50%';
    st.x = 50;
    el.classList.add('is-evolving');
    banner.innerHTML = `<small>어라…?</small>${ch.name}의 모습이 변하고 있어요!`;
    banner.classList.add('is-shown');
    if (!fast) {
      await wait(1100);
      let show = to;
      for (const ms of [420, 340, 270, 210, 160, 120, 95, 75, 60, 50, 45]) {
        applyStageArt(el, species, show);
        show = show === to ? from : to;
        await wait(ms);
      }
    }
    el.classList.add('evo-flash');
    applyStageArt(el, species, to);
    if (el._last) el._last.stage = to;
    applyCare(el); // 진화 중에는 표정 그림을 내리고 새 단계 기본 그림을 보여 준다
    await wait(fast ? 50 : 220);
    el.classList.remove('is-evolving');
    pet.dataset.act = 'evo-pop';
    onReveal();
    burstStars(el);
    banner.innerHTML = `<small>진화!</small>${ch.name} ${STAGE_NAMES[from]} → <b>${STAGE_NAMES[to]}</b>`;
    await wait(80);
    el.classList.remove('evo-flash');
    await wait(fast ? 1500 : 2600);
    banner.classList.remove('is-shown');
    delete pet.dataset.act;
    el._evolving = false;
    scheduleNext(el);
  }

  function burstStars(el) {
    const fx = el.querySelector('.fx');
    for (let i = 0; i < 14; i += 1) {
      const s = document.createElement('span');
      s.className = 'evo-star';
      const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 90 + Math.random() * 70;
      s.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
      s.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
      s.style.animationDelay = `${Math.random() * 0.12}s`;
      fx.append(s);
      setTimeout(() => s.remove(), 1400);
    }
  }

  // opts: { species, stage, mood, equipped: {hat, face, neck, bg}, care: null | 'thirsty' | 'sick' }
  function updateStage(el, { species, stage = GROWN, mood, equipped = {}, care = null }) {
    const ch = CHARACTERS[species] || CHARACTERS.basil;
    el._care = care;
    el._dressed = ['hat', 'face', 'neck'].some((slot) => equipped[slot]);
    const prevMood = el.dataset.mood;
    el.dataset.mood = mood;
    if (prevMood && prevMood !== mood && el._motion && !el._evolving) {
      if (STILL_MOODS.includes(mood)) {
        // 하던 동작(걷기 포함)을 그 자리에서 멈춘다. 기다리던 다음 동작 예약도 다시 건다.
        stopAct(el);
        scheduleNext(el);
      } else if (REACTIONS[mood]) {
        react(el, REACTIONS[mood]);
      }
    }
    const bg = bgOf(equipped.bg);
    const bgSrc = mood === 'sleepy' ? bg.night : bg.day;
    if (el._bgSrc !== bgSrc) {
      el._bgSrc = bgSrc;
      // CSS 변수 속 url()은 style.css 위치(css/) 기준으로 풀리므로 페이지 기준 전체 주소로 넣는다
      el.style.setProperty('--bg-img', `url("${new URL(bgSrc, document.baseURI).href}")`);
      new Image().src = mood === 'sleepy' ? bg.day : bg.night; // 낮↔밤이 바뀔 때 깜빡이지 않게 미리 받아 둔다
    }

    // 진화하는 동안에는 evolve()가 그림을 바꾼다
    if (!el._evolving) applyStageArt(el, species, stage);
    el.querySelector('.pet-img').alt = `${ch.name} ${STAGE_NAMES[stage]} (${(MOODS[mood] || MOODS.happy).label})`;
    el._last = { species, stage, mood };
    applyCare(el);

    for (const slot of ['hat', 'face', 'neck']) {
      const holder = el.querySelector(`.acc-${slot}`);
      const id = equipped[slot] || '';
      if (holder.dataset.item === id) continue;
      holder.dataset.item = id;
      const item = ITEMS.find((it) => it.id === id);
      holder.innerHTML = item ? item.svg : '';
    }
  }

  return {
    CHARACTERS, STAGE_NAMES, MOODS, ITEMS, SLOT_NAMES, BACKGROUNDS, DEFAULT_BG,
    createStage, updateStage, react, evolve, playCare,
    isEvolving: (el) => Boolean(el._evolving),
    careOf: (el) => el._transient || el._care || null,
  };
})();

// 성장 기록(추가 기능). 식물마다 심은 시각과 마지막으로 보여 준 단계를 이 브라우저에 저장한다.
// 단계는 심은 지 며칠 지났는지로 정한다(기준 날짜는 characters.js의 days).
// offsetMs는 개발용 "시간 건너뛰기"로 앞당긴 시간이다. 건너뛰기 버튼을 지울 때 함께 지워도 된다.

const PlantchiGrowth = (() => {
  const KEY = 'plantchi.garden';
  const DAY_MS = 24 * 60 * 60 * 1000;

  let data = { offsetMs: 0, plants: {} };
  try { data = { ...data, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* 처음 상태로 시작 */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 저장 못 해도 이번 화면에서는 동작 */ }
  }

  const now = () => Date.now() + data.offsetMs;
  const days = (species) => PlantchiArt.CHARACTERS[species].days;

  function record(species) {
    if (!data.plants[species]) {
      data.plants[species] = { plantedAt: now(), seenStage: 0 };
      save();
    }
    return data.plants[species];
  }

  function ageDays(species) {
    return (now() - record(species).plantedAt) / DAY_MS;
  }

  function stageOf(species) {
    const age = ageDays(species);
    return days(species).filter((d) => age >= d).length;
  }

  return {
    isPlanted: (species) => Boolean(data.plants[species]),
    plant: record,
    ageDays,
    stageOf,
    // 화면에 지금 보여 주는 단계(진화 연출이 끝나야 올라간다)
    seenStage: (species) => Math.min(record(species).seenStage, stageOf(species)),
    markSeen(species, stage) { record(species).seenStage = stage; save(); },
    // 다음 단계까지 남은 날. 다 자랐으면 null
    daysToNext(species) {
      const next = days(species)[stageOf(species)];
      return next === undefined ? null : next - ageDays(species);
    },
    // ---- 개발용: 시간 건너뛰기 (나중에 지울 것)
    skipDays(n) { data.offsetMs += n * DAY_MS; save(); },
    skipToNext(species) {
      const left = this.daysToNext(species);
      if (left !== null) this.skipDays(left + 0.01);
    },
    replant(species) { data.plants[species] = { plantedAt: now(), seenStage: 0 }; save(); },
  };
})();

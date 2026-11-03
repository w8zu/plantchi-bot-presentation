// 백엔드 API 호출 모음. 주소와 JSON 형식은 docs/api.md, shared/examples/를 따른다.
// 앱은 백엔드가 같은 주소에서 제공하므로 상대 경로('/api/...')로 호출한다.

const PlantchiApi = (() => {
  async function request(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message = data && data.error ? data.error.message : `HTTP ${res.status}`;
      throw new Error(message);
    }
    return data;
  }

  return {
    getPlant: () => request('GET', '/api/plant'),
    care: (action) => request('POST', '/api/care', { action, from: 'app' }),
    getRobotStatus: () => request('GET', '/api/robot/status'),
    stopRobot: () => request('POST', '/api/robot/stop'),
    resumeRobot: () => request('POST', '/api/robot/resume'),
    // 원격 조종: 버튼을 누르는 동안 0.2초마다 drive(방향), 떼면 drive('stop'). docs/api.md "원격 조종"
    // speed(0~0.5)를 생략하면 서버 기본값 0.3
    drive: (action, speed) => request('POST', '/api/robot/drive', speed === undefined ? { action } : { action, speed }),
    getLatestMove: () => request('GET', '/api/moves/latest'),
  };
})();

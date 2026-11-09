// <head>에서 실행: 화면을 그리기 전에 배경 장면을 먼저 적용해
// 페이지를 옮길 때 기본 파란 배경이 보이지 않게 합니다. 실제 장면 판단은 weather-scene.js가 합니다.
(() => {
  const root = document.documentElement;
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem("weatherScene"));
  } catch {
    saved = null;
  }

  root.classList.add("has-sky-scene");
  if (saved && Date.now() < saved.expiresAt) {
    // 최근 장면(배경 사진과 박스 색)을 그대로 적용
    root.dataset.sky = saved.name;
    Object.entries(saved.tones || {}).forEach(([name, value]) => root.style.setProperty(name, value));
    return;
  }

  // 저장된 장면이 없으면 날씨를 받기 전까지 한국 시간 기준 하늘을 보여줍니다.
  // (weather-scene.js의 시간대 기준과 같음: 17~19시 노을, 19~6시 밤)
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(new Date()),
  );
  root.dataset.sky = hour >= 17 && hour < 19 ? "sunset" : hour >= 19 || hour < 6 ? "night" : "sunny";
})();

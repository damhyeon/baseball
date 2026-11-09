// 현재 날씨와 한국 시간에 맞춰 배경 사진, 구름, 별, 빗줄기를 표시합니다.
// 날씨 데이터는 weather-service.js가 선택 구장 예보를 받으면 weatherScene.update(data)로 넘겨줍니다.
(() => {
  // 장면별 구름 양(opacity), 이동 시간(초), 밝기 (사진과 어둡게 처리는 weather-scene.css의 html[data-sky])
  const scenes = {
    sunny: { far: [0.3, 260, 1], near: [0, 200, 1] },
    sunset: { far: [0.22, 240, 0.92], near: [0, 190, 0.92] },
    night: { far: [0.12, 280, 0.5], near: [0, 220, 0.5] },
    cloudy: { far: [0.5, 190, 0.92], near: [0.4, 130, 0.85] },
    rain: { far: [0.45, 160, 0.68], near: [0.4, 105, 0.6] },
  };
  // 강수량별 빗줄기: 1440×900 화면 기준 개수, 속도(px/s), 길이(px), 투명도
  const rainLevels = {
    light: { count: 90, speed: [620, 860], length: [10, 18], alpha: [0.12, 0.26] },
    moderate: { count: 170, speed: [820, 1120], length: [14, 24], alpha: [0.14, 0.3] },
    heavy: { count: 300, speed: [1080, 1450], length: [18, 30], alpha: [0.16, 0.36] },
  };
  const rainSlant = 0.12;
  // 빗줄기는 초당 30번, 화면 배율 1로 그려 GPU 부담을 줄입니다 (빠르게 지나가서 눈으로는 차이가 거의 없음).
  const rainFrameMs = 1000 / 30;
  // 박스 색조: 기존 파란 계열 색(--sky-tone-N)의 밝기·투명도는 유지하고 색상과 채도만 바꿉니다.
  // 맑은 낮(sunny)은 원래 색 그대로 둡니다.
  const tones = {
    sunset: { hue: 262, saturation: 0.4, lightness: 1 },
    night: { hue: 228, saturation: 0.5, lightness: 0.7 },
    cloudy: { hue: 210, saturation: 0.22, lightness: 1.08 },
    rain: { hue: 210, saturation: 0.26, lightness: 0.98 },
  };
  const cacheKey = "weatherScene";
  // 저장한 장면을 다음 페이지에서 바로 쓰는 기간 (새 날씨 데이터가 오면 다시 판단합니다)
  const cacheLifetimeMs = 6 * 60 * 60 * 1000;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const scene = document.createElement("div");
  scene.className = "sky-scene";
  scene.setAttribute("aria-hidden", "true");
  scene.innerHTML =
    '<div class="sky-photo"></div><div class="sky-photo"></div>' +
    '<div class="sky-glow"></div><div class="sky-stars"></div><div class="sky-stars"></div>' +
    '<div class="sky-clouds sky-clouds-far"></div><div class="sky-clouds sky-clouds-near"></div>' +
    '<div class="sky-scrim"></div><canvas class="sky-rain"></canvas>';
  document.body.prepend(scene);
  document.documentElement.classList.add("has-sky-scene");

  const photos = [...scene.querySelectorAll(".sky-photo")];
  const clouds = { far: scene.querySelector(".sky-clouds-far"), near: scene.querySelector(".sky-clouds-near") };
  const canvas = scene.querySelector(".sky-rain");
  const context = canvas.getContext("2d");

  const random = (min, max) => min + Math.random() * (max - min);

  // 별: 화면 위쪽 65%에 흩어진 점들을 box-shadow로 한 번만 생성
  scene.querySelectorAll(".sky-stars").forEach((stars) => {
    stars.style.boxShadow = Array.from({ length: 45 }, () => {
      const size = random(0.2, 1.1).toFixed(1);
      return `${random(0, 100).toFixed(1)}vw ${random(0, 65).toFixed(1)}vh 0 ${size}px rgba(255, 255, 255, ${random(0.5, 0.95).toFixed(2)})`;
    }).join(",");
  });

  function getSeoulHour() {
    return Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(new Date()),
    );
  }

  // 일출·일몰 정보가 있으면 사용하고, 없으면 한국 시간 기준(17~19시 노을, 19~6시 밤)
  function getPeriod(data) {
    const sunrise = data?.city?.sunrise;
    const sunset = data?.city?.sunset;
    if (Number.isFinite(sunrise) && Number.isFinite(sunset)) {
      const now = Date.now() / 1000;
      if (now >= sunset - 3600 && now < sunset + 1800) return "sunset";
      return now >= sunrise && now < sunset ? "day" : "night";
    }
    const hour = getSeoulHour();
    if (hour >= 17 && hour < 19) return "sunset";
    return hour >= 19 || hour < 6 ? "night" : "day";
  }

  function getCondition(item) {
    const weather = item?.weather?.[0];
    if (!weather) return "clear";
    if (["Rain", "Drizzle", "Thunderstorm"].includes(weather.main)) return "rain";
    // 구름 조금(801)·약간(802)은 맑은 하늘로, 그 이상과 눈·안개 등은 흐림으로 표시
    if (weather.main === "Clear" || weather.id === 801 || weather.id === 802) return "clear";
    return "cloudy";
  }

  function getRainLevel(item) {
    const main = item?.weather?.[0]?.main;
    if (main === "Thunderstorm") return "heavy";
    if (main === "Drizzle") return "light";
    const amount = Number(item?.rain?.["3h"]);
    if (!Number.isFinite(amount)) return "moderate";
    return amount < 1.5 ? "light" : amount < 7.5 ? "moderate" : "heavy";
  }

  // ---------- 박스 색조 ----------
  function parseColor(value) {
    const hex = value.match(/^#([0-9a-f]{6})$/i);
    if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1);
    const rgb = value.match(/rgba?\(([^)]+)\)/);
    if (!rgb) return null;
    const [r, g, b, a = 1] = rgb[1].split(",").map(Number);
    return [r, g, b, a];
  }

  function toHsl(r, g, b) {
    [r, g, b] = [r / 255, g / 255, b / 255];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    return [0, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l];
  }

  function fromHsl(h, s, l) {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return [0, 8, 4].map((n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))));
  }

  const rootElement = document.documentElement;
  const baseTones = [];
  for (let i = 1; ; i += 1) {
    const value = getComputedStyle(rootElement).getPropertyValue(`--sky-tone-${i}`).trim();
    if (!value) break;
    baseTones.push(parseColor(value));
  }

  // 장면에 맞춘 색 목록을 만듭니다. 맑은 낮은 빈 목록(원래 색 그대로)입니다.
  function getToneValues(name) {
    const tone = tones[name];
    const values = {};
    if (!tone) return values;
    baseTones.forEach((color, index) => {
      if (!color) return;
      const [, s, l] = toHsl(...color);
      const [r, g, b] = fromHsl(tone.hue, s * tone.saturation, Math.min(l * tone.lightness, 0.92));
      values[`--sky-tone-${index + 1}`] = `rgba(${r}, ${g}, ${b}, ${color[3]})`;
    });
    return values;
  }

  function applyTones(values) {
    baseTones.forEach((_, index) => {
      const property = `--sky-tone-${index + 1}`;
      if (values[property]) rootElement.style.setProperty(property, values[property]);
      else rootElement.style.removeProperty(property);
    });
  }

  // ---------- 배경 사진 (미리 불러온 뒤 교차 페이드) ----------
  let frontPhoto = 0;
  let shownPhoto = "";
  function showPhoto(name, instant) {
    if (name === shownPhoto) return;
    shownPhoto = name;
    const url = `images/${name}.jpg`;
    const swap = () => {
      if (shownPhoto !== name) return;
      const next = photos[1 - frontPhoto];
      next.style.backgroundImage = `url("${url}")`;
      next.dataset.scene = name;
      next.classList.add("is-visible");
      photos[frontPhoto].classList.remove("is-visible");
      frontPhoto = 1 - frontPhoto;
    };
    if (instant) {
      swap();
      return;
    }
    const image = new Image();
    image.onload = image.onerror = swap;
    image.src = url;
  }

  function setClouds(layer, [opacity, speed, brightness], extra = 0) {
    layer.style.setProperty("--opacity", String(Math.min(opacity + extra, 0.7)));
    layer.style.setProperty("--speed", `${speed}s`);
    layer.style.setProperty("--steps", String(speed * 10));
    layer.style.setProperty("--brightness", String(brightness));
  }

  // ---------- 빗줄기 (canvas) ----------
  let rain = null;
  let drops = [];
  let frameId = 0;
  let lastFrame = 0;
  let stopTimer = 0;
  let width = 0;
  let height = 0;

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    if (rain) createDrops();
  }

  function createDrop(anywhere) {
    const length = random(...rain.length);
    return {
      x: random(-0.1 * width, width),
      y: anywhere ? random(-length, height) : random(-0.3 * height, -length),
      length,
      speed: random(...rain.speed),
      alpha: random(...rain.alpha),
    };
  }

  function createDrops() {
    const count = Math.round(rain.count * Math.min(Math.max((width * height) / (1440 * 900), 0.35), 1.6));
    drops = Array.from({ length: count }, () => createDrop(true));
  }

  function drawRain(elapsed) {
    context.clearRect(0, 0, width, height);
    context.lineCap = "round";
    // 투명도를 3단계로 묶어 한 번에 그립니다.
    for (const [low, high, lineWidth] of [[0, 0.2, 1], [0.2, 0.28, 1.1], [0.28, 1, 1.3]]) {
      context.beginPath();
      let alphaSum = 0;
      let alphaCount = 0;
      for (const drop of drops) {
        if (drop.alpha < low || drop.alpha >= high) continue;
        drop.y += drop.speed * elapsed;
        drop.x += drop.speed * rainSlant * elapsed;
        if (drop.y - drop.length > height || drop.x > width + 40) Object.assign(drop, createDrop(false));
        context.moveTo(drop.x, drop.y);
        context.lineTo(drop.x - drop.length * rainSlant, drop.y - drop.length);
        alphaSum += drop.alpha;
        alphaCount += 1;
      }
      if (!alphaCount) continue;
      context.strokeStyle = `rgba(222, 234, 246, ${(alphaSum / alphaCount).toFixed(3)})`;
      context.lineWidth = lineWidth;
      context.stroke();
    }
  }

  function animateRain(time) {
    frameId = requestAnimationFrame(animateRain);
    if (lastFrame && time - lastFrame < rainFrameMs - 1) return;
    // 탭 전환 등으로 프레임이 늦어져도 빗줄기가 순간이동하지 않도록 최대 50ms로 제한
    const elapsed = lastFrame ? Math.min(time - lastFrame, 50) / 1000 : 0;
    lastFrame = time;
    drawRain(elapsed);
  }

  function startRain(level) {
    clearTimeout(stopTimer);
    const next = rainLevels[level];
    if (rain !== next) {
      rain = next;
      createDrops();
    }
    canvas.classList.add("is-active");
    if (reducedMotion.matches) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      drawRain(0);
    } else if (!frameId) {
      lastFrame = 0;
      frameId = requestAnimationFrame(animateRain);
    }
  }

  function stopRain() {
    if (!rain) return;
    canvas.classList.remove("is-active");
    // 페이드아웃이 끝난 뒤 애니메이션을 멈춥니다.
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
      cancelAnimationFrame(frameId);
      frameId = 0;
      rain = null;
      drops = [];
      context.clearRect(0, 0, width, height);
    }, 1600);
  }

  // ---------- 장면 적용 ----------
  let lastData = null;
  let updated = false;

  function getSceneState(data) {
    const item = data?.list?.[0];
    const condition = getCondition(item);
    const period = getPeriod(data);
    return {
      name: condition === "clear" ? { day: "sunny", sunset: "sunset", night: "night" }[period] : condition,
      period,
      rainLevel: condition === "rain" ? getRainLevel(item) : null,
      // 맑은 하늘이라도 구름량(%)이 많으면 구름을 조금 더 보여줍니다.
      cloudCover: condition === "clear" && Number.isFinite(item?.clouds?.all) ? item.clouds.all / 100 : 0,
    };
  }

  function applyScene({ name, period, rainLevel, cloudCover, tones: toneValues }, instant) {
    const config = scenes[name];
    scene.dataset.scene = name;
    scene.dataset.period = period;
    rootElement.dataset.sky = name;
    setClouds(clouds.far, config.far, cloudCover * 0.2);
    setClouds(clouds.near, config.near, cloudCover * 0.15);
    showPhoto(name, instant);
    applyTones(toneValues);

    if (rainLevel) startRain(rainLevel);
    else stopRain();
  }

  function render(data) {
    const state = getSceneState(data);
    state.tones = getToneValues(state.name);
    applyScene(state);
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ ...state, expiresAt: Date.now() + cacheLifetimeMs }));
    } catch {
      // 저장소를 쓸 수 없어도 배경 표시는 계속합니다.
    }
  }

  function update(data) {
    updated = true;
    lastData = data || null;
    render(lastData);
  }

  // 페이지를 옮길 때 원래 색이 잠깐 보이지 않도록, 최근 장면이 있으면 바로 적용합니다.
  let cached = null;
  try {
    cached = JSON.parse(localStorage.getItem(cacheKey));
  } catch {
    cached = null;
  }
  const hasRecentCache = Boolean(cached && scenes[cached.name] && Date.now() < cached.expiresAt);
  if (hasRecentCache) {
    scene.classList.add("is-instant");
    applyScene({ ...cached, tones: cached.tones || {} }, true);
    requestAnimationFrame(() => requestAnimationFrame(() => scene.classList.remove("is-instant")));
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  // 날씨 응답이 늦거나 오지 않아도 시간대에 맞는 배경을 먼저 보여줍니다.
  setTimeout(() => {
    if (!updated && !hasRecentCache) render(null);
  }, 2500);
  // 페이지를 오래 열어둘 때 낮 → 노을 → 밤 전환을 반영합니다.
  setInterval(() => render(lastData), 5 * 60 * 1000);

  window.weatherScene = { update };
})();

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "127.0.0.1";
const cacheDurationMs = 5 * 60 * 1000;
const requestLimit = 120;
const requestWindowMs = 5 * 60 * 1000;
const weatherCache = new Map();
const requestCounts = new Map();

const stadiums = {
  "인천 SSG랜더스필드": { lat: 37.4371, lon: 126.6933 },
  잠실야구장: { lat: 37.5122, lon: 127.0719 },
  수원KT위즈파크: { lat: 37.2997, lon: 127.0098 },
  "대전 한화생명 볼파크": { lat: 36.317, lon: 127.428 },
  "대구 삼성 라이온즈 파크": { lat: 35.841, lon: 128.681 },
  광주기아챔피언스필드: { lat: 35.1681, lon: 126.8891 },
  창원NC파크: { lat: 35.2228, lon: 128.5822 },
  사직야구장: { lat: 35.1941, lon: 129.0615 },
};

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
};

// 이 목록에 있는 파일만 제공합니다. (.env, 서버 코드 등은 노출되지 않습니다.)
const publicFiles = new Map([
  ["/", "html/index.html"],
  ["/index.html", "html/index.html"],
  ["/weather.html", "html/weather.html"],
  ["/history.html", "html/history.html"],
  ["/style.css", "css/style.css"],
  ["/weather.css", "css/weather.css"],
  ["/history.css", "css/history.css"],
  ["/weather-list-shuffle.js", "js/weather-list-shuffle.js"],
  ["/weather-service.js", "js/weather-service.js"],
  ["/weather-scene.css", "css/weather-scene.css"],
  ["/weather-scene.js", "js/weather-scene.js"],
  ["/weather-scene-boot.js", "js/weather-scene-boot.js"],
  ["/assets/korea-map.svg", "assets/korea-map.svg"],
  ["/images/clouds.svg", "images/clouds.svg"],
  ...["sunny", "sunset", "night", "cloudy", "rain"].map((name) => [
    `/images/${name}.jpg`,
    `images/${name}.jpg`,
  ]),
]);

function loadLocalEnv() {
  try {
    process.loadEnvFile(path.join(root, ".env"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(data));
}

function findStadium(stadiumName) {
  return Object.hasOwn(stadiums, stadiumName) ? stadiums[stadiumName] : null;
}

function isRateLimited(ipAddress) {
  const now = Date.now();
  for (const [ip, entry] of requestCounts) {
    if (now - entry.startedAt >= requestWindowMs) requestCounts.delete(ip);
  }

  const entry = requestCounts.get(ipAddress);
  if (!entry) {
    requestCounts.set(ipAddress, { startedAt: now, count: 1 });
    return false;
  }
  if (entry.count >= requestLimit) return true;

  entry.count += 1;
  return false;
}

async function handleWeatherRequest(url, request, response) {
  const stadiumName = url.searchParams.get("stadium");
  const place = findStadium(stadiumName);
  if (!place) {
    sendJson(response, 400, { error: "지원하지 않는 야구장입니다." });
    return;
  }

  const cached = weatherCache.get(stadiumName);
  if (cached && Date.now() - cached.cachedAt < cacheDurationMs) {
    sendJson(response, 200, cached.data);
    return;
  }

  // 실제 외부 API를 호출하는 경우에만 요청 제한을 적용합니다.
  // 캐시 응답까지 제한에 포함하면 새로고침만으로 429가 발생할 수 있습니다.
  if (isRateLimited(request.socket.remoteAddress || "unknown")) {
    sendJson(response, 429, { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });
    return;
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    sendJson(response, 503, {
      error: "서버에 OPENWEATHER_API_KEY 환경변수가 설정되지 않았습니다.",
    });
    return;
  }

  const upstreamUrl = new URL("https://api.openweathermap.org/data/2.5/forecast");
  upstreamUrl.search = new URLSearchParams({
    lat: String(place.lat),
    lon: String(place.lon),
    appid: apiKey,
    units: "metric",
    lang: "kr",
  }).toString();

  try {
    const upstreamResponse = await fetch(upstreamUrl);
    if (!upstreamResponse.ok) {
      console.error(`OpenWeather request failed: HTTP ${upstreamResponse.status}`);
      const errorMessage =
        upstreamResponse.status === 401
          ? "OpenWeather API 인증 실패. 키와 활성화 상태를 확인해 주세요."
          : upstreamResponse.status === 429
            ? "OpenWeather API 요청 한도 초과입니다."
            : `OpenWeather API 요청 실패 (HTTP ${upstreamResponse.status}).`;
      sendJson(response, 502, { error: errorMessage });
      return;
    }

    const data = await upstreamResponse.json();
    weatherCache.set(stadiumName, { cachedAt: Date.now(), data });
    sendJson(response, 200, data);
  } catch (error) {
    console.error("OpenWeather request failed:", error.message);
    sendJson(response, 502, { error: "날씨 정보를 불러오지 못했습니다." });
  }
}

async function handleHistoryRequest(url, response) {
  const place = findStadium(url.searchParams.get("stadium"));
  const date = url.searchParams.get("date");
  if (!place || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    sendJson(response, 400, { error: "야구장 또는 날짜가 올바르지 않습니다." });
    return;
  }

  const upstreamUrl = new URL("https://archive-api.open-meteo.com/v1/archive");
  upstreamUrl.search = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    start_date: date,
    end_date: date,
    daily: "temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum,weather_code",
    timezone: "Asia/Seoul",
  }).toString();

  try {
    const upstreamResponse = await fetch(upstreamUrl);
    const data = await upstreamResponse.json();
    if (!upstreamResponse.ok || !data.daily?.time?.length) {
      sendJson(response, 502, { error: "해당 날짜의 과거 관측 데이터를 제공받지 못했습니다." });
      return;
    }
    sendJson(response, 200, data);
  } catch (error) {
    console.error("Historical weather request failed:", error.message);
    sendJson(response, 502, { error: "과거 날씨 정보를 불러오지 못했습니다." });
  }
}

async function handleRequest(request, response) {
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/api/weather" || url.pathname === "/api/history") {
    if (request.method === "HEAD") {
      response.writeHead(405, { Allow: "GET" });
      response.end();
    } else if (url.pathname === "/api/weather") {
      await handleWeatherRequest(url, request, response);
    } else {
      await handleHistoryRequest(url, response);
    }
    return;
  }

  const relativePath = publicFiles.get(url.pathname);
  if (!relativePath) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const filePath = path.join(root, relativePath);
  response.writeHead(200, {
    "Content-Type": contentTypes[path.extname(filePath)],
    // 배경 사진은 페이지를 옮길 때마다 다시 받지 않도록 브라우저에 하루 동안 보관합니다.
    ...(relativePath.startsWith("images/") && { "Cache-Control": "public, max-age=86400" }),
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  fs.createReadStream(filePath).pipe(response);
}

loadLocalEnv();
http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error("Request failed:", error instanceof Error ? error.message : "unknown error");
    if (!response.headersSent) {
      sendJson(response, 500, { error: "서버 내부 오류가 발생했습니다." });
    } else {
      response.destroy();
    }
  });
}).listen(port, host, () => {
  console.log(`Weather app listening on http://${host}:${port}`);
});

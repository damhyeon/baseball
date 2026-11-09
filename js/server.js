// ============================================================
// 우천 취소 지킴이 - 웹 서버
//
// 이 서버가 하는 일은 두 가지입니다.
//   (1) html, css, js, 이미지 파일을 브라우저에 보내주기
//   (2) 브라우저 대신 OpenWeather 에 날씨를 물어보기
//
// (2)를 서버가 대신 하는 이유는 API 키를 숨기기 위해서입니다.
// 브라우저가 직접 물어보면 개발자도구에서 키가 그대로 보입니다.
// ============================================================

// ------------------------------------------------------------
// 1단계. 필요한 기능 불러오기
// ------------------------------------------------------------
// Node.js 에 원래 들어있는 기능들입니다. 따로 설치할 필요가 없습니다.

const fs = require("node:fs"); // 파일 읽기
const http = require("node:http"); // 서버 만들기
const path = require("node:path"); // 파일 경로 다루기

// ------------------------------------------------------------
// 2단계. 설정값 정하기
// ------------------------------------------------------------
// 나중에 바꾸고 싶을 때 여기만 고치면 되도록 위쪽에 모아둡니다.

// 이 파일(js/server.js)에서 한 칸 위로 올라간 폴더가 프로젝트 폴더입니다.
const root = path.resolve(__dirname, "..");

// 서버 주소와 포트입니다.
// PORT=4000 node js/server.js 처럼 실행하면 다른 포트로 켤 수도 있습니다.
// 그렇게 정해준 값이 없으면 || 뒤에 있는 기본값을 씁니다.
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "127.0.0.1";

// 한 번 받아온 날씨를 몇 밀리초 동안 다시 쓸지 (5분)
const cacheDuration = 5 * 60 * 1000;

// 한 사람이 5분 동안 날씨를 몇 번까지 물어볼 수 있는지
const requestLimit = 120;
const requestWindow = 5 * 60 * 1000;

// ------------------------------------------------------------
// 3단계. 데이터 준비하기
// ------------------------------------------------------------

// 구장 8곳의 위도와 경도입니다.
// OpenWeather 는 "잠실야구장" 이라는 이름을 모르기 때문에
// 위도, 경도로 물어봐야 합니다.
const stadiums = {
  "인천 SSG랜더스필드": { lat: 37.4371, lon: 126.6933 },
  "잠실야구장": { lat: 37.5122, lon: 127.0719 },
  "수원KT위즈파크": { lat: 37.2997, lon: 127.0098 },
  "대전 한화생명 볼파크": { lat: 36.317, lon: 127.428 },
  "대구 삼성 라이온즈 파크": { lat: 35.841, lon: 128.681 },
  "광주기아챔피언스필드": { lat: 35.1681, lon: 126.8891 },
  "창원NC파크": { lat: 35.2228, lon: 128.5822 },
  "사직야구장": { lat: 35.1941, lon: 129.0615 },
};

// 브라우저에 파일을 보낼 때 "이건 무슨 종류의 파일이다" 라고 알려줘야 합니다.
// 확장자별로 알려줄 이름을 적어둡니다.
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
};

// 브라우저에 보내줘도 되는 파일 목록입니다.
// 왼쪽은 브라우저가 요청하는 주소, 오른쪽은 실제 파일 위치입니다.
//
// 이 목록에 없는 파일은 무조건 404 가 됩니다.
// 그래서 .env 파일이나 server.js 같은 파일은 주소를 입력해도 볼 수 없습니다.
const publicFiles = {
  "/": "html/index.html",
  "/index.html": "html/index.html",
  "/weather.html": "html/weather.html",
  "/history.html": "html/history.html",

  "/style.css": "css/style.css",
  "/weather.css": "css/weather.css",
  "/history.css": "css/history.css",
  "/weather-scene.css": "css/weather-scene.css",

  "/weather-service.js": "js/weather-service.js",
  "/weather-list-shuffle.js": "js/weather-list-shuffle.js",
  "/weather-scene.js": "js/weather-scene.js",
  "/weather-scene-boot.js": "js/weather-scene-boot.js",
  "/js/calculator.js": "js/calculator.js",

  "/assets/korea-map.svg": "assets/korea-map.svg",
  "/images/clouds.svg": "images/clouds.svg",
  "/images/sunny.jpg": "images/sunny.jpg",
  "/images/sunset.jpg": "images/sunset.jpg",
  "/images/night.jpg": "images/night.jpg",
  "/images/cloudy.jpg": "images/cloudy.jpg",
  "/images/rain.jpg": "images/rain.jpg",
};

// 날씨를 저장해두는 상자입니다. (구장 이름 -> 저장한 시각과 날씨 데이터)
const weatherCache = {};

// 누가 몇 번 요청했는지 세어두는 상자입니다. (IP 주소 -> 시작 시각과 횟수)
const requestCounts = {};

// ------------------------------------------------------------
// 4단계. API 키 읽어오기
// ------------------------------------------------------------
// 프로젝트 폴더의 .env 파일에서 OPENWEATHER_API_KEY 를 읽어옵니다.
// .env 파일은 깃허브에 올라가지 않기 때문에 키가 공개되지 않습니다.

function loadApiKey() {
  try {
    process.loadEnvFile(path.join(root, ".env"));
  } catch (error) {
    // .env 파일이 없어도 서버는 켜지게 둡니다.
    // 대신 날씨를 물어볼 때 "키가 없다" 고 알려줍니다.
    console.log(".env 파일을 찾지 못했습니다.");
  }
}

// ------------------------------------------------------------
// 5단계. 자주 쓰는 기능 미리 만들어두기
// ------------------------------------------------------------

// 브라우저에 JSON 을 보내는 함수입니다.
// 날씨 데이터도, 오류 메시지도 전부 이 함수로 보냅니다.
function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

// 오류를 보낼 때 쓰는 함수입니다.
function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

// 구장 이름으로 위도, 경도를 찾습니다. 없으면 null 을 돌려줍니다.
function findStadium(stadiumName) {
  const place = stadiums[stadiumName];

  // 목록에 없는 이름이면 undefined 가 나옵니다.
  // lat 까지 확인하는 이유는, 자바스크립트 객체에 원래부터 들어있는
  // 이름("constructor" 같은 것)이 구장으로 오해받지 않게 하기 위해서입니다.
  if (!place || !place.lat) {
    return null;
  }
  return place;
}

// ------------------------------------------------------------
// 6단계. 날씨 저장해두기 (캐시)
// ------------------------------------------------------------
// 같은 구장을 계속 물어볼 때마다 OpenWeather 를 부르면
// 무료 사용 한도를 금방 다 씁니다. 그래서 5분 동안은 저장해둔 걸 다시 씁니다.

// 저장해둔 날씨가 아직 쓸 만하면 돌려주고, 아니면 null 을 돌려줍니다.
function getCachedWeather(stadiumName) {
  const saved = weatherCache[stadiumName];

  if (!saved) {
    return null; // 저장된 적이 없음
  }

  const passedTime = Date.now() - saved.savedAt;
  if (passedTime >= cacheDuration) {
    return null; // 저장은 되어 있지만 5분이 지나서 오래됨
  }

  return saved.data;
}

// 새로 받아온 날씨를 저장합니다.
function saveWeatherToCache(stadiumName, data) {
  weatherCache[stadiumName] = {
    savedAt: Date.now(),
    data: data,
  };
}

// ------------------------------------------------------------
// 7단계. 너무 많이 요청하는 것 막기
// ------------------------------------------------------------
// 한 사람이 5분에 120번 넘게 요청하면 막습니다.
// true 를 돌려주면 "막아야 한다" 는 뜻입니다.

function isRateLimited(ip) {
  const now = Date.now();
  const record = requestCounts[ip];

  // 처음 온 사람이거나, 5분이 지났으면 0부터 다시 셉니다.
  if (!record || now - record.startedAt >= requestWindow) {
    requestCounts[ip] = { startedAt: now, count: 1 };
    return false;
  }

  // 이미 한도를 다 썼으면 막습니다.
  if (record.count >= requestLimit) {
    return true;
  }

  // 아직 여유가 있으면 1 더하고 통과시킵니다.
  record.count = record.count + 1;
  return false;
}

// ------------------------------------------------------------
// 8단계. 날씨 요청 처리하기  (/api/weather)
// ------------------------------------------------------------
// 브라우저가 /api/weather?stadium=잠실야구장 으로 물어보면 이 함수가 처리합니다.
// 위에서부터 순서대로 확인하고, 문제가 있으면 바로 돌려보냅니다.

async function handleWeatherRequest(url, request, response) {
  // (1) 어느 구장인지 확인합니다.
  const stadiumName = url.searchParams.get("stadium");
  const place = findStadium(stadiumName);

  if (!place) {
    sendError(response, 400, "지원하지 않는 야구장입니다.");
    return;
  }

  // (2) 저장해둔 날씨가 있으면 그걸 바로 보냅니다.
  //     OpenWeather 를 부르지 않으므로 아래 횟수 제한도 건너뜁니다.
  //     (새로고침만 했는데 횟수가 깎이면 안 되기 때문입니다.)
  const cached = getCachedWeather(stadiumName);
  if (cached) {
    sendJson(response, 200, cached);
    return;
  }

  // (3) API 키가 있는지 확인합니다. 없으면 물어볼 방법이 없습니다.
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    sendError(response, 503, "서버에 OPENWEATHER_API_KEY 환경변수가 설정되지 않았습니다.");
    return;
  }

  // (4) 너무 많이 요청하는 사람인지 확인합니다.
  const ip = request.socket.remoteAddress;
  if (isRateLimited(ip)) {
    sendError(response, 429, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }

  // (5) 여기까지 통과했으면 OpenWeather 에 실제로 물어봅니다.

  // 물어볼 주소를 만듭니다. 여기서 처음으로 API 키가 사용됩니다.
  const apiUrl =
    "https://api.openweathermap.org/data/2.5/forecast" +
    "?lat=" + place.lat +
    "&lon=" + place.lon +
    "&appid=" + apiKey +
    "&units=metric" + // 온도를 섭씨로
    "&lang=kr"; // 설명을 한국어로

  try {
    const apiResponse = await fetch(apiUrl);

    // OpenWeather 가 오류를 돌려준 경우입니다.
    if (!apiResponse.ok) {
      console.log("OpenWeather 오류: HTTP " + apiResponse.status);

      let message = "OpenWeather API 요청 실패 (HTTP " + apiResponse.status + ").";
      if (apiResponse.status === 401) {
        // 키를 막 발급받으면 아직 활성화 전이라 401 이 납니다.
        message = "OpenWeather API 인증 실패. 키와 활성화 상태를 확인해 주세요.";
      } else if (apiResponse.status === 429) {
        message = "OpenWeather API 요청 한도 초과입니다.";
      }

      sendError(response, 502, message);
      return;
    }

    // 정상적으로 받아왔습니다.
    const data = await apiResponse.json();

    saveWeatherToCache(stadiumName, data); // 다음 요청을 위해 저장해두고
    sendJson(response, 200, data); // 브라우저에 보냅니다.
  } catch (error) {
    // 인터넷이 끊겼거나 OpenWeather 에 연결하지 못한 경우입니다.
    console.log("날씨 요청 실패:", error.message);
    sendError(response, 502, "날씨 정보를 불러오지 못했습니다.");
  }
}

// ------------------------------------------------------------
// 9단계. 파일 요청 처리하기  (html, css, js, 이미지)
// ------------------------------------------------------------

function handleFileRequest(url, request, response) {
  // (1) 요청한 주소가 목록에 있는지 확인합니다. 없으면 404 입니다.
  const filePath = publicFiles[url.pathname];

  if (!filePath) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("페이지를 찾을 수 없습니다.");
    return;
  }

  // (2) 파일 종류를 확장자로 정합니다.
  const extension = path.extname(filePath);
  let contentType = contentTypes[extension];
  if (!contentType) {
    contentType = "application/octet-stream";
  }

  const headers = { "Content-Type": contentType };

  // 배경 사진은 페이지를 옮길 때마다 다시 받지 않도록
  // 브라우저에 하루(86400초) 동안 보관하라고 알려줍니다.
  if (filePath.startsWith("images/")) {
    headers["Cache-Control"] = "public, max-age=86400";
  }

  // (3) HEAD 요청은 "파일이 있는지만 알려줘" 라는 뜻이라 내용은 보내지 않습니다.
  if (request.method === "HEAD") {
    response.writeHead(200, headers);
    response.end();
    return;
  }

  // (4) 파일을 읽어서 브라우저에 보냅니다.
  const fullPath = path.join(root, filePath);

  fs.readFile(fullPath, function (error, content) {
    if (error) {
      // 목록에는 있는데 실제 파일이 없는 경우입니다.
      console.log("파일을 읽지 못했습니다:", filePath);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("파일을 읽을 수 없습니다.");
      return;
    }

    response.writeHead(200, headers);
    response.end(content);
  });
}

// ------------------------------------------------------------
// 10단계. 들어온 요청을 알맞은 곳으로 보내기
// ------------------------------------------------------------

async function handleRequest(request, response) {
  // 브라우저가 파일 종류를 멋대로 추측하지 않도록 하는 안전장치입니다.
  response.setHeader("X-Content-Type-Options", "nosniff");

  // 이 서버는 보여주기만 하므로 GET 과 HEAD 만 받습니다.
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  // 요청 주소를 분석합니다.
  // 예: "/api/weather?stadium=잠실야구장"
  //     -> pathname 은 "/api/weather", searchParams 로 stadium 을 꺼낼 수 있습니다.
  const url = new URL(request.url, "http://localhost");

  // 주소가 /api/weather 이면 날씨 요청, 아니면 파일 요청입니다.
  if (url.pathname === "/api/weather") {
    if (request.method === "HEAD") {
      // 날씨 API 는 내용이 핵심이라 HEAD 로는 받지 않습니다.
      response.writeHead(405, { Allow: "GET" });
      response.end();
      return;
    }

    await handleWeatherRequest(url, request, response);
    return;
  }

  handleFileRequest(url, request, response);
}

// ------------------------------------------------------------
// 11단계. 서버 켜기
// ------------------------------------------------------------

loadApiKey();

const server = http.createServer(function (request, response) {
  // handleRequest 안에서 예상치 못한 오류가 나도
  // 서버 전체가 꺼지지 않도록 여기서 한 번 더 받아둡니다.
  handleRequest(request, response).catch(function (error) {
    console.log("요청 처리 중 오류:", error.message);

    if (!response.headersSent) {
      sendError(response, 500, "서버 내부 오류가 발생했습니다.");
    }
  });
});

server.listen(port, host, function () {
  console.log("Weather app listening on http://" + host + ":" + port);
});

# 우천 취소 지킴이 (Rain Cancel Guard)

KBO 8개 구장의 날씨를 가져와, 경기가 **우천 취소될 확률**을 계산해서 보여주는 웹사이트입니다.

---

## 1. 요구 환경

| 항목 | 버전 |
|---|---|
| Node.js | **20.12 이상** (권장 24.x) |
| npm 패키지 | 없음 (`npm install` 불필요) |

서버는 Node 내장 모듈(`node:http`, `node:fs`, `node:path`)만 사용합니다.
`process.loadEnvFile()` 을 쓰기 때문에 Node 20.12 미만에서는 `.env` 가 읽히지 않습니다.

```bash
node -v
```

---

## 2. 환경 변수 설정

저장소에는 실제 키가 들어있지 않습니다. 템플릿을 복사해서 직접 채워야 합니다.

```bash
cp .env.example .env
```

그다음 `.env` 를 열어 `OPENWEATHER_API_KEY` 에 발급받은 키를 붙여 넣습니다.

```
OPENWEATHER_API_KEY=여기에_발급받은_키
```

| 변수 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `OPENWEATHER_API_KEY` | ✅ | — | OpenWeather 5일/3시간 예보 API 키 |
| `HOST` | ❌ | `127.0.0.1` | 서버 바인딩 주소 |
| `PORT` | ❌ | `3000` | 서버 포트 |

**API 키 발급 방법**

1. https://openweathermap.org/api 에서 무료 회원가입
2. https://home.openweathermap.org/api_keys 에서 키 복사
3. 새로 만든 키는 **활성화까지 10분~2시간** 걸립니다. 그 전에는 서버가 `401` 오류를 돌려줍니다.

> `.env` 는 `.gitignore` 에 등록되어 있습니다. 절대 커밋하지 마세요.
> 키는 브라우저로 내려가지 않고, 서버가 프록시로 대신 호출합니다.

---

## 3. 실행

```bash
npm start
```

또는

```bash
node js/server.js
```

터미널에 아래가 뜨면 성공입니다.

```
Weather app listening on http://127.0.0.1:3000
```

브라우저에서 **http://127.0.0.1:3000** 으로 접속합니다.
종료는 터미널에서 `Ctrl + C`.

포트를 바꾸려면:

```bash
PORT=4000 node js/server.js
```

---

## 4. 테스트 계정

**로그인 기능이 없으므로 테스트 계정은 필요하지 않습니다.** 접속하면 바로 모든 기능을 쓸 수 있습니다.

로그인 대신 확인해야 할 것은 **API 키 설정 여부**입니다. 아래 표로 점검하세요.

| 증상 | 원인 | 해결 |
|---|---|---|
| 확률 칸이 "정보 없음" / "확인 불가" | `.env` 가 없거나 키가 비어 있음 (서버가 `503`) | 2번 항목대로 `.env` 작성 후 서버 재시작 |
| "OpenWeather API 인증 실패" | 키가 틀렸거나 아직 활성화 전 (`401`) | 키 확인, 또는 발급 후 1~2시간 대기 |
| "요청이 너무 많습니다" | 5분간 120회 제한 초과 (`429`) | 5분 대기 |
| 지도가 안 뜸 | Leaflet 을 CDN(unpkg)에서 받아오므로 인터넷 필요 | 네트워크 연결 확인 |

> 선택한 구장은 서버가 아니라 브라우저 `localStorage` 의 `selectedStadium` 키에 저장됩니다.
> 초기화하려면 개발자도구 → Application → Local Storage 에서 지우면 됩니다.

### 동작 확인용 명령

서버만 따로 확인하려면:

```bash
curl "http://127.0.0.1:3000/api/weather?stadium=잠실야구장"
```

---

## 5. 화면 구성

| 경로 | 화면 | 내용 |
|---|---|---|
| `/` | 구장 선택 | 대한민국 지도에서 8개 구장 중 하나를 고릅니다 |
| `/weather.html` | 날씨 | 선택 구장의 현재 날씨, 우천취소 확률, 시간별 예보, 날씨 지도 |
| `/history.html` | 날씨 기록 | 향후 5일 우천취소 확률 |

지원 구장 8곳: 인천 SSG랜더스필드 · 잠실야구장 · 수원KT위즈파크 · 대전 한화생명 볼파크 · 대구 삼성 라이온즈 파크 · 광주기아챔피언스필드 · 창원NC파크 · 사직야구장

---

## 6. 폴더 구조

```
baseball/
├── .env.example        환경 변수 템플릿 (복사해서 .env 로 사용)
├── package.json        의존성 없음, start 스크립트만 있음
├── html/               index.html / weather.html / history.html
├── css/                style.css / weather.css / history.css / weather-scene.css
├── js/
│   ├── server.js           정적 파일 서버 + OpenWeather 프록시
│   ├── calculator.js       우천취소 확률 계산식
│   ├── weather-service.js  구장 좌표, 예보 호출, 구장 패널
│   ├── weather-scene.js    비·구름 배경 애니메이션
│   └── weather-list-shuffle.js
├── assets/korea-map.svg
└── images/             배경 사진 (sunny / sunset / night / cloudy / rain)
```

---

## 7. 우천취소 확률 계산식

[js/calculator.js](js/calculator.js) 의 `calculateCancelRisk(rain3h, pop, code)` 한 함수가 모든 화면의 확률을 계산합니다.

```
총점 = 강수량 점수 × 0.8 + 강수확률 × 0.2 + 보너스
```

- **강수량 점수**: 3시간 강수량을 시간당으로 환산해 구간별 환산 (시간당 10mm 이상이면 100점)
- **강수확률**: OpenWeather 의 `pop` 값
- **보너스**: 뇌우(코드 200번대) +20, 폭우(코드 502~504) +15
- 결과는 0~100 으로 자릅니다.

날씨 기록 화면의 하루 대표값은 그날 3시간 예보 중 **가장 높은 위험도**입니다.

---

## 8. 서버 동작 방식

- **화이트리스트 방식 정적 서버** — `js/server.js` 의 `publicFiles` 에 등록된 경로만 응답합니다. 따라서 `.env` 나 서버 코드는 URL 로 접근할 수 없습니다.
- **API 프록시** — 브라우저는 `/api/weather?stadium=...` 만 호출하고, 서버가 키를 붙여 OpenWeather 를 대신 호출합니다.
- **캐시** — 구장별 응답을 5분간 보관해 같은 요청을 반복 호출하지 않습니다.
- **요청 제한** — IP 당 5분에 120회. 캐시로 응답한 요청은 제한에 포함되지 않습니다.

---

## 9. 외부 의존성

| 종류 | 대상 | 비고 |
|---|---|---|
| 라이브러리 | Leaflet 1.9.4 (unpkg CDN) | 날씨 페이지 지도 전용. 타일 서버는 안 쓰고 자체 SVG 만 올립니다 |
| 외부 API | api.openweathermap.org | 서버에서만 호출 |

npm 의존성은 하나도 없습니다.

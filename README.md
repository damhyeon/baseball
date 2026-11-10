# 우천 취소 지킴이 (Rain Cancel Guard)

KBO 8개 구장의 날씨를 가져와, 경기가 **우천 취소될 확률**을 계산해서 보여주는 웹사이트입니다.

2026년도 정규시즌 경기 데이터를 사용하였음.

---

## 1. 어떤 구조인가

**서버가 없는 순수 정적 웹사이트입니다.** 빌드 과정도, 설치할 패키지도 없습니다.

```
브라우저  ──직접 요청──>  OpenWeather API
   │                          │
   │   <──── 예보 데이터 ──────┘
   ↓
calculateCancelRisk()  →  우천취소 확률 표시
```

브라우저가 OpenWeather에 직접 물어보고, 받은 데이터를 자바스크립트로 계산해서 화면에 그립니다. 중간에 거치는 서버가 없기 때문에 Cloudflare Pages, GitHub Pages 같은 정적 호스팅에 파일만 올리면 바로 동작합니다.

---

## 2. API 키 설정

[js/config.js](js/config.js) 한 곳에만 들어갑니다.

```js
window.APP_CONFIG = {
  OPENWEATHER_API_KEY: "여기에_발급받은_키",
};
```

**발급 방법**

1. https://openweathermap.org/api 에서 무료 회원가입
2. https://home.openweathermap.org/api_keys 에서 키 복사
3. 새로 만든 키는 **활성화까지 10분~2시간** 걸립니다. 그 전에는 "API 키 인증 실패"가 뜹니다.

### ⚠️ 이 키는 공개됩니다

`js/config.js`는 브라우저로 그대로 내려가는 파일입니다. 개발자도구(F12)를 열면 누구나 키를 볼 수 있습니다. **정적 웹사이트에는 키를 숨길 곳이 없습니다.**

그래서 반드시 이렇게 하세요.

- OpenWeather 홈페이지에서 이 키에 **호출 한도(Calls per minute / day)를 걸어둡니다.** 누가 가져다 써도 요금이 발생하지 않습니다.
- 다른 서비스에 쓰는 키를 재사용하지 않습니다. 이 사이트 전용 키를 따로 발급받으세요.

키를 숨겨야 한다면 정적 배포로는 불가능하고, 요청을 대신 보내 줄 서버나 Cloudflare Pages의 `functions/` 기능이 필요합니다.

---

## 3. 로컬에서 실행하기

파일을 더블클릭해서 여는 방식(`file://`)은 **동작하지 않습니다.** 우천취소 계산식을 ES 모듈(`import`)로 불러오는데, 브라우저가 `file://`에서는 모듈 로딩을 막기 때문입니다.

프로젝트 폴더에서 아래 명령을 실행하고 브라우저에서 http://localhost:3000 을 엽니다. 종료는 `Ctrl + C`입니다.

```
npm start
```

`npm start`는 `js/dev-server.js`(의존성 없는 작은 정적 파일 서버)를 띄울 뿐이라 `npm install`이 필요 없습니다. 포트를 바꾸려면 `PORT=4000 npm start`처럼 실행합니다.

또는 VS Code의 **Live Server** 확장을 설치하고, `index.html`에서 우클릭 → **Open with Live Server** 해도 됩니다. 파일을 저장할 때마다 브라우저가 자동으로 새로고침됩니다.

배포하는 Cloudflare Pages가 하는 일도 똑같이 "파일을 주소로 꺼내주는 것"뿐이라, 여기서 정상이면 배포해도 똑같이 동작합니다.

> 설치할 것이 없습니다. `npm install`도, 빌드도 없습니다.

---

## 4. 배포하기 (Cloudflare Pages)

저장소를 연결하고 아래처럼 설정하면 끝입니다.

| 항목 | 값 |
|---|---|
| Framework preset | None |
| Build command | *(비워둠)* |
| Build output directory | `/` |

빌드할 게 없으므로 저장소 내용이 그대로 올라갑니다. `index.html`이 최상단에 있어서 `/`로 접속하면 바로 열립니다.

GitHub Pages도 같은 방식으로 됩니다. Settings → Pages에서 브랜치와 `/ (root)`를 고르면 됩니다.

---

## 5. 테스트 계정

**로그인 기능이 없으므로 테스트 계정은 필요하지 않습니다.** 접속하면 바로 모든 기능을 쓸 수 있습니다.

대신 확인할 것은 **API 키 설정**입니다.

| 화면에 보이는 것 | 원인 | 해결 |
|---|---|---|
| "API 키 설정 필요" | `js/config.js`의 키가 비어 있음 | 2번 항목대로 키 입력 |
| "API 키 인증 실패" | 키가 틀렸거나 아직 활성화 전 | 키 확인, 또는 발급 후 1~2시간 대기 |
| "API 요청 한도 초과" | OpenWeather 호출 한도 소진 | 잠시 후 재시도 |
| "네트워크 연결 실패" | 인터넷 끊김 | 연결 확인 |
| 지도가 안 뜸 | Leaflet을 CDN에서 받아옴 | 인터넷 연결 확인 |

> 선택한 구장은 브라우저 `localStorage`의 `selectedStadium` 키에 저장됩니다.
> 받아온 날씨는 `sessionStorage`에 5분간 저장됩니다(탭을 닫으면 사라짐).
> 초기화하려면 개발자도구 → Application → Storage에서 지우면 됩니다.

---

## 6. 화면 구성

| 파일 | 화면 | 내용 |
|---|---|---|
| `index.html` | 구장 선택 | 대한민국 지도에서 8개 구장 중 하나를 고릅니다 |
| `weather.html` | 날씨 | 현재 날씨, 우천취소 확률, 시간별 예보, 날씨 지도 |
| `history.html` | 날씨 기록 | 향후 5일 우천취소 확률, 구장별 환불하기 버튼 |

지원 구장 8곳: 인천 SSG랜더스필드 · 잠실야구장 · 수원KT위즈파크 · 대전 한화생명 볼파크 · 대구 삼성 라이온즈 파크 · 광주기아챔피언스필드 · 창원NC파크 · 사직야구장

---

## 7. 폴더 구조

```
baseball/
├── index.html          구장 선택
├── weather.html        날씨
├── history.html        날씨 기록
├── css/                style.css / weather.css / history.css / weather-scene.css
├── js/
│   ├── config.js           API 키 (브라우저로 내려감)
│   ├── weather-service.js  구장 좌표, OpenWeather 호출, 캐시, 구장 패널
│   ├── calculator.js       우천취소 확률 계산식
│   ├── weather-scene.js    비·구름 배경 애니메이션
│   └── weather-list-shuffle.js
├── assets/korea-map.svg
└── images/             배경 사진 (sunny / sunset / night / cloudy / rain)
```

HTML이 참조하는 경로와 실제 폴더 구조가 같습니다. 정적 호스팅은 파일 위치가 곧 URL이기 때문에, 둘이 어긋나면 404가 납니다.

---

## 8. 날씨를 가져오는 방법

[js/weather-service.js](js/weather-service.js)의 `loadForecast()` 하나가 담당합니다.

```js
const url =
  FORECAST_API +
  "?lat=" + place.lat +
  "&lon=" + place.lon +
  "&appid=" + apiKey +
  "&units=metric" +  // 온도를 섭씨로
  "&lang=kr";        // 설명을 한국어로
```

OpenWeather는 구장 이름을 모르므로 위도·경도로 물어봅니다. 좌표는 `weather-service.js`의 `stadiums` 표에 들어 있습니다.

호출을 아끼기 위해 두 가지 장치가 있습니다.

- **캐시** — 받아온 날씨를 `sessionStorage`에 5분간 저장하고 재사용합니다.
- **중복 요청 합치기** — 날씨 화면은 본문과 오른쪽 목록이 같은 구장을 거의 동시에 요청합니다. 진행 중인 요청이 있으면 그 결과를 같이 기다려서, 한 번만 호출합니다.

---

## 9. 우천취소 확률 계산식

[js/calculator.js](js/calculator.js)의 `calculateCancelRisk(rain3h, pop, code)` 한 함수가 모든 화면의 확률을 계산합니다.

```
총점 = 강수량 점수 × 0.8 + 강수확률 × 0.2 + 보너스
```

- **강수량 점수**: 3시간 강수량을 시간당으로 환산해 구간별로 점수화 (시간당 10mm 이상이면 100점)
- **강수확률**: OpenWeather의 `pop` 값 (0~1을 0~100으로 변환해서 전달)
- **보너스**: 뇌우(코드 200번대) +20, 폭우(코드 502~504) +15
- 결과는 0~100으로 자릅니다.

3시간 누적 강수량을 시간당으로 나누는 이유는, 같은 3mm라도 한 시간에 쏟아진 것과 세 시간에 걸쳐 내린 것이 경기에 주는 영향이 다르기 때문입니다.

날씨 기록 화면의 하루 대표값은 그날 3시간 예보 중 **가장 높은 위험도**입니다. 하루 중 한 번이라도 폭우가 예보되면 경기가 취소되므로, 평균을 내면 그 위험이 희석됩니다.

---

## 10. 외부 의존성

| 종류 | 대상 | 비고 |
|---|---|---|
| 라이브러리 | Leaflet 1.9.4 (unpkg CDN) | 날씨 페이지 지도 전용 |
| 외부 API | api.openweathermap.org | 브라우저가 직접 호출 |

npm 의존성은 없습니다. 지도는 타일 서버를 쓰지 않고 `assets/korea-map.svg`를 올려서 그립니다.

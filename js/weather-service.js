(() => {
  const icons = {
    Clear: "☀️",
    Clouds: "☁️",
    Rain: "🌧️",
    Drizzle: "🌦️",
    Thunderstorm: "⛈️",
    Snow: "❄️",
    Mist: "🌫️",
  };

  const stadiums = {
    "인천 SSG랜더스필드": { city: "인천", label: "인천 SSG랜더스필드", lat: 37.4371, lon: 126.6933 },
    잠실야구장: { city: "서울", label: "잠실야구장", lat: 37.5122, lon: 127.0719 },
    수원KT위즈파크: { city: "수원", label: "수원 KT 위즈파크", lat: 37.2997, lon: 127.0098 },
    "대전 한화생명 볼파크": { city: "대전", label: "대전 한화생명 볼파크", lat: 36.317, lon: 127.428 },
    "대구 삼성 라이온즈 파크": { city: "대구", label: "대구 삼성 라이온즈 파크", lat: 35.841, lon: 128.681 },
    광주기아챔피언스필드: { city: "광주", label: "광주-기아 챔피언스 필드", lat: 35.1681, lon: 126.8891 },
    창원NC파크: { city: "창원", label: "창원 NC파크", lat: 35.2228, lon: 128.5822 },
    사직야구장: { city: "부산", label: "부산 사직야구장", lat: 35.1941, lon: 129.0615 },
  };

  const getCityName = (stadiumName) => stadiums[stadiumName]?.city || "서울";

  // ----------------------------------------------------------
  // OpenWeather 에 직접 물어보기
  // ----------------------------------------------------------
  // 이 사이트는 정적 웹사이트라 서버가 없습니다.
  // 그래서 브라우저가 OpenWeather 에 직접 요청합니다.
  // (예전에는 우리 서버(/api/weather)가 대신 물어봐 주었습니다.)

  const FORECAST_API = "https://api.openweathermap.org/data/2.5/forecast";

  // 같은 구장을 5분 안에 다시 물어보면 저장해둔 값을 씁니다.
  const CACHE_DURATION = 5 * 60 * 1000;

  // 저장해둔 날씨가 아직 쓸 만하면 돌려주고, 아니면 null 을 돌려줍니다.
  // sessionStorage 는 탭을 닫으면 지워지는 저장 공간입니다.
  function readCache(stadiumName) {
    try {
      const saved = sessionStorage.getItem("weather:" + stadiumName);
      if (!saved) return null;

      const parsed = JSON.parse(saved);
      if (Date.now() - parsed.savedAt >= CACHE_DURATION) return null;

      return parsed.data;
    } catch (error) {
      // 저장된 값이 깨졌으면 없는 셈 치고 새로 받아옵니다.
      return null;
    }
  }

  function saveCache(stadiumName, data) {
    try {
      sessionStorage.setItem(
        "weather:" + stadiumName,
        JSON.stringify({ savedAt: Date.now(), data: data }),
      );
    } catch (error) {
      // 저장 공간이 꽉 찬 경우입니다. 캐시가 없어도 동작하므로 그냥 넘어갑니다.
    }
  }

  // 지금 요청 중인 구장을 기억해 둡니다.
  // 날씨 화면은 본문과 오른쪽 목록에서 같은 구장을 거의 동시에 요청하는데,
  // 이게 없으면 OpenWeather 를 두 번 부르게 됩니다.
  const inFlight = {};

  async function loadForecast(stadiumName) {
    // (1) 등록된 구장인지 확인합니다.
    const place = stadiums[stadiumName];
    if (!place || !place.lat) {
      throw new Error("지원하지 않는 야구장입니다.");
    }

    // (2) 저장해둔 날씨가 있으면 그걸 씁니다.
    const cached = readCache(stadiumName);
    if (cached) return cached;

    // (3) 이미 같은 구장을 요청 중이면 그 결과를 같이 기다립니다.
    if (inFlight[stadiumName]) return inFlight[stadiumName];

    const request = requestForecast(stadiumName, place);
    inFlight[stadiumName] = request;

    try {
      return await request;
    } finally {
      // 성공이든 실패든 지웁니다. 남겨두면 다음에 다시 시도하지 못합니다.
      delete inFlight[stadiumName];
    }
  }

  async function requestForecast(stadiumName, place) {
    const apiKey = window.APP_CONFIG && window.APP_CONFIG.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error("API 키가 설정되지 않았습니다. js/config.js 를 확인하세요.");
    }

    const url =
      FORECAST_API +
      "?lat=" + place.lat +
      "&lon=" + place.lon +
      "&appid=" + apiKey +
      "&units=metric" + // 온도를 섭씨로
      "&lang=kr"; // 설명을 한국어로

    let response;
    try {
      response = await fetch(url);
    } catch (error) {
      // 인터넷이 끊겼거나 OpenWeather 에 닿지 못한 경우입니다.
      throw new Error("OpenWeather 에 연결하지 못했습니다.");
    }

    // OpenWeather 는 오류일 때도 JSON 으로 답을 줍니다.
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        // 키를 막 발급받으면 아직 활성화 전이라 401 이 납니다.
        throw new Error("API 키 인증 실패. 키와 활성화 상태를 확인해 주세요.");
      }
      if (response.status === 429) {
        throw new Error("OpenWeather API 요청 한도 초과입니다.");
      }
      throw new Error(data.message || "HTTP " + response.status);
    }

    saveCache(stadiumName, data);
    return data;
  }

  // 구장 목록 한 줄에 보여줄 짧은 실패 문구입니다.
  function getFailureMessage(error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("API 키가 설정")) {
      return "API 키 설정 필요";
    }
    if (message.includes("인증 실패")) {
      return "API 키 인증 실패";
    }
    if (message.includes("한도")) {
      return "API 요청 한도 초과";
    }
    if (message.includes("연결하지 못")) {
      return "네트워크 연결 실패";
    }
    return "조회 실패";
  }

  // sceneStadium: 배경(weather-scene.js)에 반영할 선택 구장
  async function loadPanelWeather(buttons, sceneStadium) {
    await Promise.all(
      buttons.map(async (button) => {
        const icon = button.querySelector(".stadium-weather-icon");
        const description = button.querySelector(".stadium-weather-name small");
        const temperature = button.querySelector("b");
        icon.textContent = "…";
        description.textContent = "불러오는 중";
        temperature.textContent = "--°";
        button.setAttribute("aria-busy", "true");

        try {
          const data = await loadForecast(button.dataset.stadium);
          const current = data.list?.[0];
          if (!current?.weather?.[0] || !Number.isFinite(current.main?.temp)) {
            throw new Error("날씨 예보 데이터가 올바르지 않습니다.");
          }

          icon.textContent = icons[current.weather[0].main] || "☁️";
          description.textContent = current.weather[0].description;
          temperature.textContent = `${Math.round(current.main.temp)}°`;
          if (button.dataset.stadium === sceneStadium) window.weatherScene?.update(data);
        } catch (error) {
          console.error(`${button.dataset.stadium} 날씨 조회 실패:`, error);
          icon.textContent = "⚠️";
          description.textContent = getFailureMessage(error);
          button.title =
            error instanceof Error ? error.message : "날씨 조회에 실패했습니다.";
          if (button.dataset.stadium === sceneStadium) window.weatherScene?.update(null);
        }
        button.removeAttribute("aria-busy");
      }),
    );
  }

  // 오른쪽 "전국 주요 날씨" 패널: 구장 목록 생성, 검색, 날씨 조회, 클릭 처리
  function initStadiumPanel(onSelect, buttonClass) {
    const list = document.querySelector(".weather-panel-list");
    const buttons = Object.entries(stadiums).map(([stadiumName, { label }]) => {
      const button = document.createElement("button");
      if (buttonClass) button.className = buttonClass;
      button.type = "button";
      button.dataset.stadium = stadiumName;
      button.innerHTML =
        `<span class="stadium-weather-icon" aria-hidden="true"></span>` +
        `<span class="stadium-weather-name">${label}<small></small></span>` +
        `<b></b><i aria-hidden="true">›</i>`;
      button.addEventListener("click", () => onSelect(stadiumName));
      return button;
    });
    list.replaceChildren(...buttons);

    const selectedStadium = localStorage.getItem("selectedStadium");
    document.getElementById("panelCity").textContent = getCityName(selectedStadium);

    const search = document.getElementById("stadiumSearch");
    search.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase("ko");
      let visibleCount = 0;

      buttons.forEach((button) => {
        const isMatch = button.textContent.toLocaleLowerCase("ko").includes(query);
        button.hidden = !isMatch;
        if (isMatch) visibleCount += 1;
      });
      document.querySelector(".weather-panel-empty").hidden = visibleCount > 0;
    });

    loadPanelWeather(
      buttons,
      Object.hasOwn(stadiums, selectedStadium) ? selectedStadium : "잠실야구장",
    );
  }

  window.weatherService = {
    icons,
    stadiums,
    getCityName,
    loadForecast,
    initStadiumPanel,
  };
})();

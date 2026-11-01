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

  async function loadForecast(stadiumName) {
    const response = await fetch(
      `/api/weather?stadium=${encodeURIComponent(stadiumName)}`,
    );

    if (!response.headers.get("content-type")?.includes("application/json")) {
      if (response.status === 404) {
        throw new Error(
          "Live Server에서는 날씨 API를 사용할 수 없습니다. npm start 실행 후 http://localhost:3000 에서 접속하세요.",
        );
      }
      throw new Error(`날씨 서버에서 예상하지 못한 응답을 받았습니다 (HTTP ${response.status}).`);
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  }

  function getFailureMessage(error) {
    const message = error instanceof Error ? error.message : "";
    if (error instanceof TypeError || message.includes("npm start")) {
      return "서버 실행 필요 · npm start";
    }
    if (message.includes("OPENWEATHER_API_KEY")) {
      return "서버 API 키 설정 필요";
    }
    if (message.includes("인증 실패")) {
      return "API 키 인증 실패";
    }
    if (message.includes("요청 한도")) {
      return "API 요청 한도 초과";
    }
    return "조회 실패";
  }

  async function loadPanelWeather(buttons) {
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
        } catch (error) {
          console.error(`${button.dataset.stadium} 날씨 조회 실패:`, error);
          icon.textContent = "⚠️";
          description.textContent = getFailureMessage(error);
          button.title =
            error instanceof Error ? error.message : "날씨 조회에 실패했습니다.";
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

    document.getElementById("panelCity").textContent = getCityName(
      localStorage.getItem("selectedStadium"),
    );

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

    loadPanelWeather(buttons);
  }

  window.weatherService = {
    icons,
    stadiums,
    getCityName,
    loadForecast,
    initStadiumPanel,
  };
})();

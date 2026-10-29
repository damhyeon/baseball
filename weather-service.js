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

  async function loadPanelWeather() {
    const buttons = [
      ...document.querySelectorAll(".weather-panel-list button[data-stadium]"),
    ];

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
          button.removeAttribute("title");
          button.removeAttribute("aria-busy");
        } catch (error) {
          console.error(`${button.dataset.stadium} 날씨 조회 실패:`, error);
          icon.textContent = "⚠️";
          description.textContent = getFailureMessage(error);
          button.title =
            error instanceof Error ? error.message : "날씨 조회에 실패했습니다.";
          temperature.textContent = "--°";
          button.removeAttribute("aria-busy");
        }
      }),
    );
  }

  window.weatherService = { loadForecast, loadPanelWeather, icons };
})();

function calculateRainoutRisk(item) {
    const pop = (item.pop || 0) * 100; // 강수확률 (%)
    const rain3h = item.rain?.['3h'] || 0; // 3시간 누적 강수량 (mm)
    const hourlyRain = rain3h / 3; // 시간당 강수량 (mm/h)
    const weatherId = item.weather[0]?.id || 800; // 날씨 ID

    let weight = 0;
    if (hourlyRain === 0) weight = 0;
    else if (hourlyRain < 1) weight = 0.2;
    else if (hourlyRain < 3) weight = 0.5;
    else if (hourlyRain < 8) weight = 0.85;
    else weight = 1.0;

    let bonus = 0;
    if (weatherId >= 200 && weatherId < 300) {
        bonus = 20; // 뇌우
    } else if ([502, 503, 504, 522].includes(weatherId)) {
        bonus = 15; // 폭우
    }

    const cancelRisk = Math.min(100, Math.round((pop * weight) + bonus));

    return {
        취소위험도: cancelRisk + "%",
        시간당강수량: hourlyRain.toFixed(1) + "mm/h",
        판정: cancelRisk >= 70 ? "취소 유력" : cancelRisk >= 40 ? "취소 가능성 있음" : "정상 진행 예상"
    };
}
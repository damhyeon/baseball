
export function calculateCancelRisk(rain3h, pop, code) {

    const hour_Rain = rain3h / 3;

    let rainScore = 0;
    if (hour_Rain >= 10) {
        rainScore = 100; 
    } 
    else if (hour_Rain >= 5) {
        rainScore = 70 + ((hour_Rain - 5) / 5) * 29;
    } 
    else if (hour_Rain >= 1.5) {
        rainScore = 30 + ((hour_Rain - 1.5) / 3.5) * 39;
    } 
    else if (hour_Rain > 0) {
        rainScore = (hour_Rain / 1.5) * 29;
    }

    let bonusScore = 0;
    if (code >= 200 && code < 300) bonusScore += 20; // 날씨 코드 200~300은 번개맨
    if (code >= 502 && code <=504) bonusScore += 15; // 날씨 코드 502~504는 폭우


    let totalScore = (rainScore * 0.8) + (pop * 0.2) + bonusScore;

    return Math.min(Math.max(Math.round(totalScore), 0), 100);
    
    
    
}
import { calculateCancelRisk } from "./calculator.js";
import { getStadiumForecast } from "./api.js";
 
async function main(name) {
    const forecast = await getStadiumForecast(name);

    if (forecast.error) {
        console.error(forecast.error);
        return;
    }

    const target = forecast[0];

    const pop = target.강수확률;
    const rain3h = target.강수량_3h;
    const weatherCode = target.날씨코드;

    return 100;
}

window.main = main;

import { calculateCancelRisk } from "./calculator.js";
import { getStadiumForecast } from "./api.js";
import { getBackgroundColor } from "./color.js";
 
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

    let str= getBackgroundColor(calculateCancelRisk(rain3h, pop, weatherCode));
    let int=calculateCancelRisk(rain3h, pop, weatherCode);

    const arr = [str, int];
    console.log("이거 시간 테스트임" + getStadiumForecast('대구'))
    return arr;
}

window.main = main;

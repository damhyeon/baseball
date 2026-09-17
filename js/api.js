const STADIUMS = {
    "잠실": { lat: 37.5122, lon: 127.0719 },
    "문학": { lat: 37.4371, lon: 126.6933 },
    "수원": { lat: 37.2998, lon: 127.0102 },
    "대전": { lat: 36.3172, lon: 127.4292 },
    "대구": { lat: 35.8412, lon: 128.6815 },
    "광주": { lat: 35.1682, lon: 126.8893 },
    "사직": { lat: 35.1941, lon: 129.0614 },
    "창원": { lat: 35.2217, lon: 128.5807 }
};

const API_KEY = "f83e46782ad87604233b2e8c5294753b";

export async function getStadiumForecast(stadiumName) {
    const coords = STADIUMS[stadiumName];

    if (!coords) {
        return { error: "등록되지 않은 구장입니다. (예: '잠실', '문학')" };
    }

    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${API_KEY}&units=metric&lang=kr`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("예보 정보를 가져오는데 실패했습니다.");
        
        const data = await response.json();

        const forecastList = data.list.map(item => {
            return {
                시간: item.dt_txt,                  
                날씨코드: item.weather[0].id,       
                강수확률: item.pop * 100,            
                강수량_3h: item.rain?.['3h'] || 0    
            };
        });

        return  forecastList;

    } catch (error) {
        return { error: error.message };
    }
}
export function getBackgroundColor(risk) {
            let backgroundColor = "";

            if (risk >= 75) {
                backgroundColor = "#ff4d4d"; //빨강
            } 
            else if (risk >= 50) {
                backgroundColor = "#ffa500"; // 주황
            } 
            else if (risk >= 25) {
                backgroundColor = "#ffeb3b"; // 노랑
            } 
            else {
                backgroundColor = "#4caf50"; // 초록
            }

            document.body.style.backgroundColor = backgroundColor
        }
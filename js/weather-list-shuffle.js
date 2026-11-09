(() => {
  const stadiumIds = new Set([
    "잠실야구장",
    "수원KT위즈파크",
    "대전 한화생명 볼파크",
    "대구 삼성 라이온즈 파크",
    "광주기아챔피언스필드",
    "인천 SSG랜더스필드",
    "사직야구장",
  ]);
  const list = document.querySelector(".weather-panel-list");

  if (!list) return;

  function shuffleStadiumCards() {
    const children = [...list.children];
    const targetSlots = [];
    const cards = [];

    children.forEach((child, index) => {
      if (stadiumIds.has(child.dataset.stadium)) {
        targetSlots.push(index);
        cards.push(child);
      }
    });

    if (cards.length < 2) return;

    const previousPositions = new Map(
      cards.map((card) => [card, card.getBoundingClientRect()]),
    );
    const shuffledCards = [...cards];

    for (let index = shuffledCards.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffledCards[index], shuffledCards[randomIndex]] = [
        shuffledCards[randomIndex],
        shuffledCards[index],
      ];
    }

    if (shuffledCards.every((card, index) => card === cards[index])) {
      shuffledCards.push(shuffledCards.shift());
    }

    targetSlots.forEach((slot, index) => {
      children[slot] = shuffledCards[index];
    });
    list.replaceChildren(...children);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    shuffledCards.forEach((card) => {
      if (card.hidden) return;

      const previousPosition = previousPositions.get(card);
      const currentPosition = card.getBoundingClientRect();
      const offsetY = previousPosition.top - currentPosition.top;

      if (offsetY === 0) return;

      card.animate(
        [
          { transform: `translateY(${offsetY}px)` },
          { transform: "translateY(0)" },
        ],
        {
          duration: 650,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        },
      );
    });
  }

  window.setInterval(shuffleStadiumCards, 10_000);
})();

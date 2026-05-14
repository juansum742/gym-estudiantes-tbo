(function () {
  const motherDayWinners = [
    { image: "assets/mothers-day-winners/ganadora-1.jpg", label: "Ganadora" },
    { image: "assets/mothers-day-winners/ganadora-2.jpg", label: "Ganadora" },
    { image: "assets/mothers-day-winners/ganadora-3.jpg", label: "Ganadora" },
    { image: "assets/mothers-day-winners/ganadora-4.jpg", label: "Ganadora" },
    { image: "assets/mothers-day-winners/ganadora-5.jpg", label: "Ganadora" },
    { image: "assets/mothers-day-winners/ganadora-6.jpg", label: "Ganadora" },
    { image: "assets/mothers-day-winners/ganadora-7.jpg", label: "Ganadora" },
    { image: "assets/mothers-day-winners/ganadora-8.jpg", label: "Ganadora" },
    { image: "assets/mothers-day-winners/ganadora-9.jpg", label: "Ganadora" },
  ];

  function renderMotherDayWinners() {
    const gallery = document.querySelector("[data-mothers-winners-gallery]");

    if (!gallery) {
      return;
    }

    gallery.innerHTML = motherDayWinners
      .map((winner, index) => {
        const delay = 80 + index * 45;
        const featuredClass = index === 0 ? " mothers-winner-card-featured" : "";
        const number = index + 1;

        return `
          <article class="mothers-winner-card${featuredClass}" data-reveal="up" style="--delay: ${delay}ms;">
            <figure class="mothers-winner-media">
              <img src="${winner.image}" alt="Ganadora ${number} del Sorteo Día de la Madre con premio entregado" loading="lazy" decoding="async">
            </figure>
            <div class="mothers-winner-copy">
              <span>${winner.label}</span>
              <strong>Premio entregado</strong>
            </div>
          </article>
        `;
      })
      .join("");
  }

  window.motherDayWinners = motherDayWinners;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderMotherDayWinners);
  } else {
    renderMotherDayWinners();
  }
})();

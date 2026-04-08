const THEME_BY_COMPETITION = (compRaw) => {
  const c = (compRaw || "").toLowerCase().trim();

  if (c.includes("champions") || c.includes("ucl") || c.includes("uefa champions")) return "ucl";
  if (c.includes("europa") || c.includes("uel")) return "uel";
  if (c.includes("premier") || c.includes("epl") || c.includes("pl")) return "premier";
  if (c.includes("serie a") || c === "seriea" || c.includes("italia")) return "seriea";

  return "seriea";
};

function pickOne(arr) {
  if (!arr || !arr.length) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function goalLabel(type, diff) {
  const section = type === "match" ? "MATCH GOALS" : "LIVE GOALS";
  return `${section} • ${diff.toUpperCase()}`;
}

function renderFixedDifficulties(targetEl, pools, type) {
  const bronze = pickOne(pools.bronze || []);
  const silver = pickOne(pools.silver || []);
  const gold = pickOne(pools.gold || []);

  const items = [
    { diff: "bronze", rule: bronze },
    { diff: "silver", rule: silver },
    { diff: "gold", rule: gold },
  ];

  targetEl.innerHTML = items.map(({ diff, rule }) => `
    <article class="goal-card">
      <div class="goal-top">
        <div class="pack ${diff}">
          <div class="brand">
            <div class="title">PACCHETTO ${diff.toUpperCase()}</div>
            <div class="sub">FANTABALLA</div>
          </div>
        </div>
      </div>
      <div class="goal-bottom">
        <div class="goal-rule ${diff}">${escapeHtml(rule || "—")}</div>
        <div class="goal-label">${goalLabel(type, diff)}</div>
      </div>
    </article>
  `).join("");
}

async function init() {
  const res = await fetch("./data.json", { cache: "no-store" });
  const data = await res.json();

  document.body.dataset.theme = THEME_BY_COMPETITION(data.competition || "Serie A");
  document.querySelector("#pageTitle").textContent = data.dateLabel || "MATCH GOALS & LIVE GOALS";

  const goals = data.goals || {};
  const matchPools = goals.match || {};
  const livePools = goals.live || {};

  const matchOut = document.querySelector("#matchGoalsOut");
  const liveOut = document.querySelector("#liveGoalsOut");

  renderFixedDifficulties(matchOut, matchPools, "match");
  renderFixedDifficulties(liveOut, livePools, "live");

  document.querySelectorAll("[data-generate]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.generate;
      if (type === "match") {
        renderFixedDifficulties(matchOut, matchPools, "match");
      } else {
        renderFixedDifficulties(liveOut, livePools, "live");
      }
    });
  });
}

init().catch((err) => {
  console.error(err);
  alert("Errore nel caricamento di data.json");
});

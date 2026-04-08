function pickOne(arr){
  if (!arr || !arr.length) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function goalLabel(type, diff){
  const map = {
    match: "MATCH GOALS",
    live: "LIVE GOALS",
    cursed: "CURSED GOALS"
  };
  const t = map[type] || "GOALS";
  const d = diff.toUpperCase();
  return `${t} • ${d}`;
}

function renderFixedDifficulties(targetEl, pools, type){
  const bronze = pickOne(pools.bronze || []);
  const silver = pickOne(pools.silver || []);
  const gold   = pickOne(pools.gold || []);

  const items = [
    { diff: "bronze", rule: bronze },
    { diff: "silver", rule: silver },
    { diff: "gold",   rule: gold },
  ];

  targetEl.innerHTML = items.map(({diff, rule}) => `
    <article class="goal-card">
      <div class="goal-top">
        <div class="pack ${type === "cursed" ? "cursed" : diff}">
          ${type === "cursed" ? '<div class="corruption" aria-hidden="true"></div>' : ""}
          <div class="brand">
            <div class="title">PACCHETTO ${diff.toUpperCase()}</div>
            <div class="sub">FANTABALLA</div>
          </div>
        </div>
      </div>
      <div class="goal-bottom">
        <div class="goal-rule ${type === "cursed" ? "cursed" : diff}">${escapeHtml(rule || "—")}</div>
        <div class="goal-label ${type === "cursed" ? "cursed" : ""}">${goalLabel(type, diff)}</div>
      </div>
    </article>
  `).join("");
}

async function init(){
  const res = await fetch("./data.json", { cache: "no-store" });
  const data = await res.json();

  document.querySelector("#pageTitle").textContent = data.dateLabel || "LE PARTITE DI OGGI";

  const goals = data.goals || {};
  const matchPools = goals.match || {};
  const livePools = goals.live || {};
  const cursedPools = goals.cursed || {};

  const matchOut = document.querySelector("#matchGoalsOut");
  const liveOut = document.querySelector("#liveGoalsOut");
  const cursedOut = document.querySelector("#cursedGoalsOut");

  renderFixedDifficulties(matchOut, matchPools, "match");
  renderFixedDifficulties(liveOut, livePools, "live");
  renderFixedDifficulties(cursedOut, cursedPools, "cursed");

  document.querySelectorAll("[data-generate]").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.generate;
      if (type === "match") renderFixedDifficulties(matchOut, matchPools, "match");
      else if (type === "live") renderFixedDifficulties(liveOut, livePools, "live");
      else if (type === "cursed") renderFixedDifficulties(cursedOut, cursedPools, "cursed");
    });
  });
}

init().catch(err => {
  console.error(err);
  alert("Errore nel caricamento di data.json");
});

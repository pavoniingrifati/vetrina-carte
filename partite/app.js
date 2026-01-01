
const THEME_BY_COMPETITION = (compRaw) => {
  const c = (compRaw || "").toLowerCase().trim();

  // Puoi aggiungere qui altre competizioni / alias.
  if (c.includes("champions") || c.includes("ucl") || c.includes("uefa champions")) return "ucl";
  if (c.includes("europa") || c.includes("uel")) return "uel";
  if (c.includes("premier") || c.includes("epl") || c.includes("pl")) return "premier";
  if (c.includes("serie a") || c === "seriea" || c.includes("italia")) return "seriea";

  return "seriea"; // default
};

const ICONS = {
  home: `
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M8 30.5 32 10l24 20.5V56a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V30.5Z" stroke="white" stroke-width="4" stroke-linejoin="round"/>
      <path d="M24 60V40a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v20" stroke="white" stroke-width="4" stroke-linecap="round"/>
    </svg>`,
  away: `
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M6 40c10-12 18-18 26-18s16 6 26 18" stroke="white" stroke-width="4" stroke-linecap="round"/>
      <path d="M10 46c8-7 14-10 22-10s14 3 22 10" stroke="white" stroke-width="4" stroke-linecap="round" opacity=".85"/>
      <path d="M14 52c6-4 10-6 18-6s12 2 18 6" stroke="white" stroke-width="4" stroke-linecap="round" opacity=".7"/>
    </svg>`
};

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
  const t = type === "match" ? "MATCH GOALS" : "LIVE GOALS";
  const d = diff.toUpperCase();
  return `${t} • ${d}`;
}

/**
 * Output: 3 cards always in this order:
 * 1) BRONZE (random from bronze pool)
 * 2) SILVER (random from silver pool)
 * 3) GOLD (random from gold pool)
 */
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

async function init(){
  const res = await fetch("./data.json", { cache: "no-store" });
  const data = await res.json();

  // Mixed competitions: set page theme as:
  // - if all matches have the same competition -> use it
  // - otherwise use "seriea" (neutral default) and theme per-card
  const comps = (data.matches || []).map(m => (m.competition || data.competition || "").toLowerCase().trim());
  const unique = [...new Set(comps.filter(Boolean))];
  const pageComp = unique.length === 1 ? unique[0] : (data.competition || "Serie A");
  document.body.dataset.theme = THEME_BY_COMPETITION(pageComp);

  // Title
  document.querySelector("#pageTitle").textContent = data.dateLabel || "LE PARTITE DI OGGI";

  // Render matches (each match has its own competition)
  const matchesGrid = document.querySelector("#matchesGrid");
  matchesGrid.innerHTML = (data.matches || []).map((m, i) => {
    const venue = (m.venue || "home").toLowerCase() === "away" ? "away" : "home";
    const venueText = venue === "home" ? "CASA" : "TRASFERTA";
    const matchComp = m.competition || data.competition || "Competizione";
    const matchTheme = THEME_BY_COMPETITION(matchComp);

    return `
      <section class="match-card" data-theme="${matchTheme}">
        <div>
          <div class="match-top">
            <div class="team-name">${escapeHtml(m.team || "SQUADRA")}</div>
            <div class="comp-pill" title="Competizione">
              <span class="comp-dot"></span>
              <span>${escapeHtml(matchComp)}</span>
            </div>
          </div>

          <div class="points-wrap" aria-label="Punti">
            <div class="points">
              <div class="num">${Number(m.points ?? 0)}</div>
              <div class="lbl">PUNTI</div>
            </div>
          </div>
        </div>

        <div class="match-bottom">
          <div class="venue" title="${venueText}">
            ${ICONS[venue]}
          </div>
          <div class="badge">MATCH ${i+1}</div>
        </div>
      </section>
    `;
  }).join("");

  // Goals
  const goals = data.goals || {};
  const matchPools = (goals.match || {});
  const livePools = (goals.live || {});

  const matchOut = document.querySelector("#matchGoalsOut");
  const liveOut = document.querySelector("#liveGoalsOut");

  // Default render
  renderFixedDifficulties(matchOut, matchPools, "match");
  renderFixedDifficulties(liveOut, livePools, "live");

  // Buttons
  document.querySelectorAll("[data-generate]").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.generate; // match | live
      if (type === "match") renderFixedDifficulties(matchOut, matchPools, "match");
      else renderFixedDifficulties(liveOut, livePools, "live");
    });
  });
}

init().catch(err => {
  console.error(err);
  alert("Errore nel caricamento di data.json");
});

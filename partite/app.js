
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

function sampleUnique(arr, n){
  const copy = [...arr];
  const out = [];
  while(copy.length && out.length < n){
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx,1)[0]);
  }
  return out;
}

function goalLabel(type, diff){
  const t = type === "match" ? "MATCH GOALS" : "LIVE GOALS";
  const d = diff.toUpperCase();
  return `${t} • ${d}`;
}

function renderGoalCards(targetEl, goals, type, diff){
  const picked = sampleUnique(goals, 3);
  targetEl.innerHTML = picked.map(rule => {
    return `
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
          <div class="goal-rule ${diff}">${escapeHtml(rule)}</div>
          <div class="goal-label">${goalLabel(type, diff)}</div>
        </div>
      </article>
    `;
  }).join("");
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function init(){
  const res = await fetch("./data.json", { cache: "no-store" });
  const data = await res.json();

  // Theme from competition
  document.body.dataset.theme = THEME_BY_COMPETITION(data.competition);

  // Title
  document.querySelector("#pageTitle").textContent = data.dateLabel || "LE PARTITE DI OGGI";

  // Render matches
  const matchesGrid = document.querySelector("#matchesGrid");
  matchesGrid.innerHTML = (data.matches || []).map((m, i) => {
    const venue = (m.venue || "home").toLowerCase() === "away" ? "away" : "home";
    const venueText = venue === "home" ? "CASA" : "TRASFERTA";
    return `
      <section class="match-card">
        <div>
          <div class="match-top">
            <div class="team-name">${escapeHtml(m.team || "SQUADRA")}</div>
            <div class="comp-pill" title="Competizione">
              <span class="comp-dot"></span>
              <span>${escapeHtml(data.competition || "Competizione")}</span>
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

  // Goals buttons wiring
  const goals = data.goals || {};
  const matchGoals = goals.match || {};
  const liveGoals = goals.live || {};

  const matchOut = document.querySelector("#matchGoalsOut");
  const liveOut = document.querySelector("#liveGoalsOut");

  // Default render
  renderGoalCards(matchOut, matchGoals.bronze || [], "match", "bronze");
  renderGoalCards(liveOut, liveGoals.bronze || [], "live", "bronze");

  // Buttons
  document.querySelectorAll("[data-goals]").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.goals;   // match | live
      const diff = btn.dataset.diff;    // bronze | silver | gold

      const pool = (type === "match" ? matchGoals : liveGoals)[diff] || [];
      const target = type === "match" ? matchOut : liveOut;

      renderGoalCards(target, pool, type, diff);
    });
  });
}

init().catch(err => {
  console.error(err);
  alert("Errore nel caricamento di data.json");
});

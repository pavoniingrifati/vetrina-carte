
const THEME_BY_COMPETITION = (compRaw) => {
  const c = (compRaw || "").toLowerCase().trim();
  if (c.includes("champions") || c.includes("ucl") || c.includes("uefa champions")) return "ucl";
  if (c.includes("europa") || c.includes("uel")) return "uel";
  if (c.includes("premier") || c.includes("epl") || c.includes("pl")) return "premier";
  if (c.includes("serie a") || c === "seriea" || c.includes("italia")) return "seriea";
  return "seriea";
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

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function pickOneNotSame(arr, prev){
  if (!arr || !arr.length) return "";
  if (arr.length === 1) return arr[0];
  for (let i=0;i<8;i++){
    const c = arr[Math.floor(Math.random() * arr.length)];
    if (c !== prev) return c;
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

const lastPicked = { match:{bronze:"",silver:"",gold:""}, live:{bronze:"",silver:"",gold:""} };

function renderFixedDifficulties(targetEl, pools, type, packImages){
  const bronze = pickOneNotSame(pools.bronze || [], lastPicked[type].bronze);
  const silver = pickOneNotSame(pools.silver || [], lastPicked[type].silver);
  const gold   = pickOneNotSame(pools.gold   || [], lastPicked[type].gold);

  lastPicked[type].bronze = bronze;
  lastPicked[type].silver = silver;
  lastPicked[type].gold   = gold;

  const items = [
    { diff: "bronze", rule: bronze },
    { diff: "silver", rule: silver },
    { diff: "gold",   rule: gold },
  ];

  targetEl.innerHTML = items.map(({diff, rule}) => {
    const img = (packImages && packImages[diff]) ? packImages[diff] : "";
    const imgTag = img
      ? `<img class="pack-img" src="${img}" alt="Pacchetto ${diff}">`
      : `<div style="font-weight:900;opacity:.7">Carica immagine ${diff}</div>`;

    return `
      <article class="goal-card">
        <div class="goal-top">${imgTag}</div>
        <div class="goal-bottom">
          <div class="goal-rule ${diff}">${escapeHtml(rule || "—")}</div>
          <div class="goal-label">${type === "match" ? "MATCH GOALS" : "LIVE GOALS"} • ${diff.toUpperCase()}</div>
        </div>
      </article>
    `;
  }).join("");
}

async function init(){
  const res = await fetch("./data.json?v=" + Date.now(), { cache: "no-store" });
  const data = await res.json();

  const comps = (data.matches || []).map(m => (m.competition || data.competition || "").toLowerCase().trim());
  const unique = [...new Set(comps.filter(Boolean))];
  const pageComp = unique.length === 1 ? unique[0] : (data.competition || "Serie A");
  document.body.dataset.theme = THEME_BY_COMPETITION(pageComp);

  document.querySelector("#pageTitle").textContent = data.dateLabel || "LE PARTITE DI OGGI";

  const matchesGrid = document.querySelector("#matchesGrid");
  matchesGrid.innerHTML = (data.matches || []).map((m, i) => {
    const venue = (m.venue || "home").toLowerCase() === "away" ? "away" : "home";
    const matchComp = m.competition || data.competition || "Competizione";
    const matchTheme = THEME_BY_COMPETITION(matchComp);

    return `
      <section class="match-card" data-theme="${matchTheme}">
        <div>
          <div class="match-top">
            <div class="team-name">${escapeHtml(m.team || "SQUADRA")}</div>
            <div class="comp-pill"><span class="comp-dot"></span><span>${escapeHtml(matchComp)}</span></div>
          </div>
          <div class="points-wrap">
            <div class="points"><div class="num">${Number(m.points ?? 0)}</div><div class="lbl">PUNTI</div></div>
          </div>
        </div>
        <div class="match-bottom">
          <div class="venue">${ICONS[venue]}</div>
          <div class="badge">MATCH ${i+1}</div>
        </div>
      </section>
    `;
  }).join("");

  const goals = data.goals || {};
  const matchPools = goals.match || {};
  const livePools  = goals.live || {};
  const packImages = data.packImages || {};

  const matchOut = document.querySelector("#matchGoalsOut");
  const liveOut  = document.querySelector("#liveGoalsOut");

  renderFixedDifficulties(matchOut, matchPools, "match", packImages);
  renderFixedDifficulties(liveOut,  livePools,  "live",  packImages);

  document.querySelectorAll("[data-generate]").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.generate;
      if (type === "match") renderFixedDifficulties(matchOut, matchPools, "match", packImages);
      else renderFixedDifficulties(liveOut, livePools, "live", packImages);
    });
  });
}
init().catch(err => { console.error(err); alert("Errore nel caricamento di data.json"); });

(() => {
  "use strict";

  const DATA_URL = "data/contenuti.json";
  let SITE_CONFIG = {};
  let TEAMS = [];
  let RATING_BANDS = [];

  const rankingList = document.getElementById("rankingList");
  const teamGrid = document.getElementById("teamGrid");
  const searchInput = document.getElementById("searchInput");
  const formationFilter = document.getElementById("formationFilter");
  const sortSelect = document.getElementById("sortSelect");
  const emptyState = document.getElementById("emptyState");
  const teamModal = document.getElementById("teamModal");
  const modalContent = document.getElementById("modalContent");
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");

  const state = {
    query: "",
    formation: "all",
    sort: "rating-desc"
  };

  const formationPositions = {
    "4-3-3": [[50,91],[18,74],[39,78],[61,78],[82,74],[28,55],[50,60],[72,55],[20,26],[50,20],[80,26]],
    "3-4-2-1": [[50,91],[27,76],[50,80],[73,76],[16,55],[39,58],[61,58],[84,55],[35,36],[65,36],[50,17]],
    "4-2-3-1": [[50,91],[18,75],[39,79],[61,79],[82,75],[37,59],[63,59],[20,39],[50,34],[80,39],[50,16]],
    "3-5-2": [[50,91],[27,76],[50,80],[73,76],[13,53],[31,57],[50,52],[69,57],[87,53],[36,20],[64,20]],
    "4-3-1-2": [[50,91],[18,75],[39,79],[61,79],[82,75],[27,56],[50,61],[73,56],[50,37],[35,18],[65,18]],
    "5-3-2": [[50,91],[12,70],[31,78],[50,81],[69,78],[88,70],[27,53],[50,58],[73,53],[35,18],[65,18]],
    "4-4-2": [[50,91],[18,75],[39,79],[61,79],[82,75],[17,51],[39,58],[61,58],[83,51],[35,18],[65,18]],
    "3-4-3": [[50,91],[27,76],[50,80],[73,76],[17,55],[40,60],[60,60],[83,55],[20,23],[50,17],[80,23]]
  };

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const numeric = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  const ratingLabel = (rating) => {
    const value = numeric(rating);
    const band = [...RATING_BANDS]
      .sort((a, b) => numeric(b.min) - numeric(a.min))
      .find(item => value >= numeric(item.min));
    return band?.label || "Senza valutazione";
  };

  const getSortedTeams = () => {
    const query = state.query.trim().toLowerCase();
    const teams = TEAMS.filter(team => {
      const haystack = [
        team.name,
        team.owner,
        team.formation,
        team.fmResult,
        ...(team.starters || []),
        ...(team.bench || [])
      ].join(" ").toLowerCase();

      return (!query || haystack.includes(query)) &&
        (state.formation === "all" || team.formation === state.formation);
    });

    const sorters = {
      "rating-desc": (a, b) => numeric(b.rating) - numeric(a.rating),
      "position-asc": (a, b) => numeric(a.fmPosition, 999) - numeric(b.fmPosition, 999),
      "points-desc": (a, b) => numeric(b.points) - numeric(a.points),
      "goals-desc": (a, b) => numeric(b.goalsFor) - numeric(a.goalsFor),
      "name-asc": (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "it")
    };

    return teams.sort(sorters[state.sort] || sorters["rating-desc"]);
  };

  const crest = (team) => `
    <span class="team-crest" style="background:${escapeHtml(team.color || "#e30613")}" aria-hidden="true">
      ${escapeHtml(team.initials || String(team.name || "?").slice(0, 3).toUpperCase())}
    </span>
  `;

  const renderProjectEmptyState = () => {
    rankingList.innerHTML = "";
    emptyState.hidden = false;
    emptyState.innerHTML = `
      <strong>Il progetto sta per partire</strong>
      <p>Le prime fantarose e i primi verdetti FM26 saranno pubblicati qui.</p>
    `;

    teamGrid.innerHTML = `
      <article class="project-empty-card">
        <span>Prossimamente</span>
        <h3>La prima fantarosa potrebbe essere la tua</h3>
        <p>Commenta il video con squadra, titolari e riserve per partecipare alla selezione.</p>
        <a class="button button-primary" href="${escapeHtml(SITE_CONFIG.tiktokProfile || "#")}" target="_blank" rel="noopener">Vai su TikTok</a>
      </article>
    `;
  };

  const renderRanking = () => {
    if (!TEAMS.length) {
      renderProjectEmptyState();
      return;
    }

    const teams = getSortedTeams();
    emptyState.hidden = teams.length > 0;
    if (!teams.length) {
      emptyState.innerHTML = `<strong>Nessuna squadra trovata</strong><p>Prova a modificare ricerca o filtri.</p>`;
    }

    rankingList.innerHTML = teams.map((team, index) => `
      <article class="ranking-row" data-team-id="${escapeHtml(team.id)}" data-rank="${index + 1}" tabindex="0" role="button" aria-label="Apri la scheda di ${escapeHtml(team.name)}">
        <span class="rank-number">${String(index + 1).padStart(2, "0")}</span>
        <div class="team-cell">
          ${crest(team)}
          <div class="team-cell-text">
            <strong>${escapeHtml(team.name)}</strong>
            <small>${escapeHtml(team.owner)}</small>
          </div>
        </div>
        <span class="formation-chip">${escapeHtml(team.formation)}</span>
        <span class="result-chip">${escapeHtml(team.fmResult)}</span>
        <div class="points-cell"><strong>${numeric(team.points)}</strong><small>punti</small></div>
        <div class="rating-cell">
          <span class="rating-ring" style="--value:${numeric(team.rating)}"><strong>${numeric(team.rating)}</strong></span>
          <span class="rating-label"><small>su 100</small><span>${escapeHtml(ratingLabel(team.rating))}</span></span>
        </div>
        <span class="row-arrow">↗</span>
      </article>
    `).join("");
  };

  const renderCards = () => {
    if (!TEAMS.length) return;

    const ranking = [...TEAMS].sort((a, b) => numeric(b.rating) - numeric(a.rating));
    teamGrid.innerHTML = ranking.map((team, index) => `
      <article class="team-card" data-team-id="${escapeHtml(team.id)}" tabindex="0" role="button" style="--team-color:${escapeHtml(team.color || "#e30613")}" aria-label="Apri la scheda di ${escapeHtml(team.name)}">
        <div class="team-card-top">${crest(team)}<span class="card-rank">${String(index + 1).padStart(2, "0")}</span></div>
        <div class="team-card-body">
          <h3>${escapeHtml(team.name)}</h3>
          <p class="owner">${escapeHtml(team.owner)}</p>
          <div class="team-card-meta">
            <div><span>Modulo</span><strong>${escapeHtml(team.formation)}</strong></div>
            <div><span>Serie A FM</span><strong>${numeric(team.fmPosition)}°</strong></div>
          </div>
        </div>
        <div class="team-card-footer">
          <div><small>Valutazione</small><div class="team-card-score">${numeric(team.rating)}/100</div></div>
          <span class="row-arrow">↗</span>
        </div>
      </article>
    `).join("");
  };

  const playerRole = (index, formation) => {
    if (index === 0) return "Portiere";
    const parts = String(formation || "4-3-3").split("-").map(Number);
    const defendersEnd = parts[0];
    const midfieldersEnd = defendersEnd + (parts[1] || 0);
    if (index <= defendersEnd) return "Difensore";
    if (index <= midfieldersEnd) return "Centrocampista";
    return "Attaccante";
  };

  const renderPitch = (team) => {
    const positions = formationPositions[team.formation] || formationPositions["4-3-3"];
    return `
      <div class="pitch" style="--team-color:${escapeHtml(team.color || "#e30613")}">
        ${(team.starters || []).slice(0, 11).map((player, index) => {
          const [x, y] = positions[index] || [50, 50];
          return `
            <div class="player-dot" style="left:${x}%;top:${y}%">
              <div class="player-shirt">${index + 1}</div>
              <span class="player-name">${escapeHtml(player)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  };

  const openModal = (teamId) => {
    const team = TEAMS.find(item => item.id === teamId);
    if (!team) return;

    const fullSquad = [
      ...(team.starters || []).map((name, index) => ({ name, role: playerRole(index, team.formation), number: index + 1 })),
      ...(team.bench || []).map((name, index) => ({ name, role: "Riserva", number: index + 12 }))
    ];

    modalContent.innerHTML = `
      <div class="modal-hero" style="--team-color:${escapeHtml(team.color || "#e30613")}">
        <div class="modal-team-header">${crest(team)}<div><h2 id="modalTeamName">${escapeHtml(team.name)}</h2><p>Rosa di ${escapeHtml(team.owner)} · ${escapeHtml(team.formation)}</p></div></div>
      </div>
      <div class="modal-body">
        <div class="modal-column">
          <section class="panel"><div class="panel-title"><h3>Formazione titolare</h3><span>${escapeHtml(team.formation)}</span></div>${renderPitch(team)}</section>
          <section class="panel">
            <div class="panel-title"><h3>Rosa completa</h3><span>${fullSquad.length} giocatori</span></div>
            <div class="squad-list">${fullSquad.map(player => `<div class="squad-player"><span>${player.number}</span><div><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.role)}</small></div></div>`).join("")}</div>
          </section>
        </div>
        <div class="modal-column">
          <section class="panel">
            <div class="panel-title"><h3>Risultato simulazione</h3><span>${escapeHtml(SITE_CONFIG.competitionName)}</span></div>
            <div class="modal-stats">
              <div class="modal-stat"><span>Piazzamento</span><strong>${numeric(team.fmPosition)}°</strong></div>
              <div class="modal-stat"><span>Punti</span><strong>${numeric(team.points)}</strong></div>
              <div class="modal-stat"><span>Gol fatti</span><strong>${numeric(team.goalsFor)}</strong></div>
              <div class="modal-stat"><span>Gol subiti</span><strong>${numeric(team.goalsAgainst)}</strong></div>
            </div>
          </section>
          <section class="panel">
            <div class="panel-title"><h3>La mia valutazione</h3><span>${escapeHtml(team.verdict)}</span></div>
            <p class="review-text">${escapeHtml(team.review)}</p>
            <div class="review-score"><span class="rating-ring" style="--value:${numeric(team.rating)}"><strong>${numeric(team.rating)}</strong></span><div><h4>${escapeHtml(ratingLabel(team.rating))}</h4><p>Valutazione complessiva su 100</p></div></div>
            <a class="button video-link" href="${escapeHtml(team.videoUrl || SITE_CONFIG.tiktokProfile)}" target="_blank" rel="noopener">Guarda il video su TikTok ↗</a>
          </section>
          <section class="panel"><div class="panel-title"><h3>Verdetto stagionale</h3></div><div class="result-chip">${escapeHtml(team.fmResult)}</div></section>
        </div>
      </div>
    `;

    teamModal.classList.add("is-open");
    teamModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(() => teamModal.querySelector(".modal-close")?.focus(), 0);
  };

  const closeModal = () => {
    teamModal.classList.remove("is-open");
    teamModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  const bindInteractions = () => {
    document.addEventListener("click", event => {
      const item = event.target.closest("[data-team-id]");
      if (item) openModal(item.dataset.teamId);
      if (event.target.closest("[data-close-modal]")) closeModal();
    });

    document.addEventListener("keydown", event => {
      const item = event.target.closest("[data-team-id]");
      if (item && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openModal(item.dataset.teamId);
      }
      if (event.key === "Escape" && teamModal.classList.contains("is-open")) closeModal();
    });

    searchInput.addEventListener("input", event => {
      state.query = event.target.value;
      renderRanking();
    });
    formationFilter.addEventListener("change", event => {
      state.formation = event.target.value;
      renderRanking();
    });
    sortSelect.addEventListener("change", event => {
      state.sort = event.target.value;
      renderRanking();
    });

    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
    mainNav.addEventListener("click", () => {
      mainNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  };

  const populateFilters = () => {
    formationFilter.querySelectorAll("option:not(:first-child)").forEach(option => option.remove());
    [...new Set(TEAMS.map(team => team.formation).filter(Boolean))].sort().forEach(formation => {
      const option = document.createElement("option");
      option.value = formation;
      option.textContent = formation;
      formationFilter.appendChild(option);
    });
    searchInput.disabled = TEAMS.length === 0;
    formationFilter.disabled = TEAMS.length === 0;
    sortSelect.disabled = TEAMS.length === 0;
  };

  const initPage = () => {
    const projectName = SITE_CONFIG.projectName || "La tua fantarosa in Serie A";
    document.title = `${projectName} | ${SITE_CONFIG.brandName || "Fantaballa"}`;
    document.getElementById("metaDescription")?.setAttribute("content", SITE_CONFIG.metaDescription || "");
    document.getElementById("projectNameHeader").textContent = projectName;
    document.getElementById("projectNameEyebrow").textContent = projectName;
    document.getElementById("projectNameRanking").textContent = projectName;
    document.getElementById("projectNameFooter").textContent = projectName;
    document.getElementById("seasonLabel").textContent = SITE_CONFIG.season || "—";
    document.getElementById("contactLink").href = SITE_CONFIG.tiktokProfile || "#";
    document.getElementById("currentYear").textContent = new Date().getFullYear();

    const topTeam = [...TEAMS].sort((a, b) => numeric(b.rating) - numeric(a.rating))[0];
    document.getElementById("heroTopTeam").textContent = topTeam?.name || "In arrivo";
    document.getElementById("heroTopScore").textContent = topTeam ? `${numeric(topTeam.rating)} / 100` : "— / 100";

    const avg = TEAMS.length
      ? Math.round(TEAMS.reduce((sum, team) => sum + numeric(team.rating), 0) / TEAMS.length)
      : null;
    document.getElementById("heroStats").innerHTML = `
      <div class="hero-stat"><strong>${TEAMS.length}</strong><span>Squadre analizzate</span></div>
      <div class="hero-stat"><strong>${TEAMS.length * numeric(SITE_CONFIG.matchesPerSeason, 38)}</strong><span>Partite di campionato</span></div>
      <div class="hero-stat"><strong>${avg ?? "—"}</strong><span>Valutazione media</span></div>
    `;
  };

  const showLoadError = (error) => {
    console.error(error);
    emptyState.hidden = false;
    emptyState.innerHTML = `
      <strong>Impossibile caricare il JSON</strong>
      <p>Apri il sito attraverso un server locale oppure pubblicalo online. Consulta README.txt.</p>
    `;
    teamGrid.innerHTML = "";
  };

  const start = async () => {
    bindInteractions();
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);
      const data = await response.json();
      SITE_CONFIG = data.site || {};
      TEAMS = Array.isArray(data.teams) ? data.teams : [];
      RATING_BANDS = Array.isArray(data.ratingBands) ? data.ratingBands : [];
      initPage();
      populateFilters();
      renderRanking();
      renderCards();
    } catch (error) {
      showLoadError(error);
    }
  };

  start();
})();

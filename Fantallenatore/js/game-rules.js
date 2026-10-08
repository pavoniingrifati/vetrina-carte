(() => {
  'use strict';

  const GAME_CONFIG = Object.freeze({
    buildVersion: '3.2.35.56.250',
    seasonLabel: '2026/27',
    leagueName: 'Lega Amatori',
    startingDivision: 4
  });

  const rules = {
    GAME_CONFIG,
    ROLE_LIMITS: Object.freeze({ P: 3, D: 8, C: 8, A: 6 }),
    ROLE_ORDER: Object.freeze(['P','D','C','A']),
    ROLE_LABELS: Object.freeze({ P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' }),
    ROLE_PLURALS: Object.freeze({ P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }),
    INITIAL_BUDGET: 500,
    FANTASY_SEASON_MATCHDAYS: 38,
    TOTAL_SLOTS: 25,
    BID_WINDOW_MS: 5000,
    MARKET_VALUE_POOL_TARGET: Object.freeze({ P: 35, D: 95, C: 160, A: 210 }),
    MARKET_ROLE_TARGET: Object.freeze({ P: 30, D: 60, C: 120, A: 290 }),
    MARKET_ALPHA: Object.freeze({ P: .90, D: .55, C: .70, A: .45 }),
    ROLE_BID_CORRECTION: Object.freeze({ P: .70, D: .80, C: 1.00, A: 1.40 }),
    TOP_VALUE_THRESHOLD: Object.freeze({ P: 20, D: 15, C: 30, A: 40 }),
    FANTASY_MAX_SUBS: 3,
    SERIEA_MIN_VOTE_MINUTES: 15,
    FORMATION_EVENT_CHANCE: .35,
    ADMIN_RULE_EVENT_CHANCE: .24,
    CAREER_STARTING_EUROS: 20
  };

  window.FantaGameRules = Object.freeze(rules);
})();

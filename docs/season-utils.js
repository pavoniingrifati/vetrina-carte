// Utilities condivise per mantenere separati i dati del Game Pass per stagione.
// I dati legacy privi di `season` vengono considerati appartenenti alla Stagione 1.

export const LEGACY_SEASON = 1;

export function normalizeSeason(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : LEGACY_SEASON;
}

export function seasonKey(season) {
  return `season_${normalizeSeason(season)}`;
}

export function recordSeason(data) {
  if (data && data.season != null) return normalizeSeason(data.season);
  return LEGACY_SEASON;
}

export function seasonProgressPath(uid, season) {
  return `users/${uid}/seasons/${seasonKey(season)}/gamepass/progress`;
}

export function seasonEarnedCollectionPath(uid, season) {
  return `users/${uid}/seasons/${seasonKey(season)}/earned`;
}

export function seasonEarnedDocPath(uid, season, achievementId) {
  return `${seasonEarnedCollectionPath(uid, season)}/${achievementId}`;
}

export function seasonClaimsCollectionPath(uid, season) {
  return `users/${uid}/seasons/${seasonKey(season)}/gp_claims`;
}

export function seasonClaimDocPath(uid, season, tierId) {
  return `${seasonClaimsCollectionPath(uid, season)}/${tierId}`;
}

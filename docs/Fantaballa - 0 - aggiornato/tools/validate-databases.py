#!/usr/bin/env python3
"""Valida e normalizza i database JSON di Fantaballa.

Uso:
  python tools/validate-databases.py
  python tools/validate-databases.py --apply-safe-fixes

Il comando genera sempre copie normalizzate in data/normalized e i report
DATABASE-VALIDATION-REPORT.json/.md. Con --apply-safe-fixes applica ai file live
solo correzioni deterministiche e non distruttive; non elimina record duplicati.
"""
from __future__ import annotations

import argparse
import collections
import copy
import datetime as dt
import json
import math
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
NORMALIZED_DIR = DATA_DIR / "normalized"
ROLE_LABELS = {"P": "Portiere", "D": "Difensore", "C": "Centrocampista", "A": "Attaccante"}
POSITION_ROLE = {"P": "P", "DC": "D", "TS": "D", "TD": "D", "CDC": "C", "CC": "C", "COC": "C", "AS": "A", "AD": "A", "ATT": "A"}
POSITIONS = set(POSITION_ROLE)
FORMATIONS = {"4-3-3", "4-4-2", "4-2-3-1", "4-5-1", "3-5-2", "5-3-2", "3-4-3", "4-3-1-2", "2-4-4", "4-4-4", "3-3-3"}
TRUE_VALUES = {"si", "sì", "yes", "true", "1", "y", "abbonato", "subscriber"}
FALSE_VALUES = {"no", "false", "0", "n", ""}
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def compact(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def normalize_name(value: Any) -> str:
    return re.sub(r"[^a-z0-9à-ÿ]+", "", compact(value).lower())


def normalize_yes_no(value: Any) -> str | None:
    text = compact(value).lower()
    if text in TRUE_VALUES:
        return "si"
    if text in FALSE_VALUES:
        return "no"
    return None


def finite_number(value: Any) -> bool:
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def issue(severity: str, code: str, dataset: str, message: str, **detail: Any) -> dict[str, Any]:
    return {"severity": severity, "code": code, "dataset": dataset, "message": message, "detail": detail}


def normalize_player(player: dict[str, Any], mode: str, changes: list[dict[str, Any]]) -> dict[str, Any]:
    result = copy.deepcopy(player)
    record_id = compact(result.get("id"))

    for field in ("id", "name", "role", "Position", "roleLabel", "nation", "club"):
        if field in result and isinstance(result[field], str):
            cleaned = compact(result[field])
            if cleaned != result[field]:
                changes.append({"recordType": "player", "id": record_id, "field": field, "from": result[field], "to": cleaned, "reason": "spazi normalizzati"})
                result[field] = cleaned

    role = compact(result.get("role")).upper()
    if role:
        result["role"] = role
    raw_positions = [compact(item).upper() for item in str(result.get("Position", "")).split(",") if compact(item)]
    canonical_position = ", ".join(raw_positions)
    if canonical_position and canonical_position != result.get("Position"):
        changes.append({"recordType": "player", "id": record_id, "field": "Position", "from": result.get("Position"), "to": canonical_position, "reason": "posizioni normalizzate"})
        result["Position"] = canonical_position

    expected_label = ROLE_LABELS.get(role)
    if expected_label and result.get("roleLabel") != expected_label:
        changes.append({"recordType": "player", "id": record_id, "field": "roleLabel", "from": result.get("roleLabel"), "to": expected_label, "reason": "etichetta coerente con il ruolo"})
        result["roleLabel"] = expected_label

    subscriber = normalize_yes_no(result.get("subscriber"))
    abbonato_present = "abbonato" in result
    abbonato = normalize_yes_no(result.get("abbonato")) if abbonato_present else None
    canonical_subscriber = "si" if subscriber == "si" or abbonato == "si" else "no"
    if result.get("subscriber") != canonical_subscriber:
        changes.append({"recordType": "player", "id": record_id, "field": "subscriber", "from": result.get("subscriber"), "to": canonical_subscriber, "reason": "valore abbonamento unificato"})
        result["subscriber"] = canonical_subscriber
    if mode == "community" or abbonato_present:
        if result.get("abbonato") != canonical_subscriber:
            changes.append({"recordType": "player", "id": record_id, "field": "abbonato", "from": result.get("abbonato"), "to": canonical_subscriber, "reason": "campo ridondante allineato a subscriber"})
            result["abbonato"] = canonical_subscriber

    if finite_number(result.get("ovr")):
        numeric = int(float(result["ovr"]))
        if result.get("ovr") != numeric:
            changes.append({"recordType": "player", "id": record_id, "field": "ovr", "from": result.get("ovr"), "to": numeric, "reason": "numero intero canonico"})
            result["ovr"] = numeric
    if "quotation" in result and finite_number(result.get("quotation")):
        result["quotation"] = float(result["quotation"])
    return result


def normalize_club(club: dict[str, Any], roster_count: int, changes: list[dict[str, Any]]) -> dict[str, Any]:
    result = copy.deepcopy(club)
    record_id = compact(result.get("id"))
    for field in ("id", "name", "shortName", "defaultFormation"):
        if field in result and isinstance(result[field], str):
            cleaned = compact(result[field])
            if cleaned != result[field]:
                changes.append({"recordType": "club", "id": record_id, "field": field, "from": result[field], "to": cleaned, "reason": "spazi normalizzati"})
                result[field] = cleaned
    if result.get("rosterSize") != roster_count:
        changes.append({"recordType": "club", "id": record_id, "field": "rosterSize", "from": result.get("rosterSize"), "to": roster_count, "reason": "conteggio sincronizzato con i giocatori presenti"})
        result["rosterSize"] = roster_count
    colors = result.get("colorClub") if isinstance(result.get("colorClub"), dict) else {}
    result["colorClub"] = colors
    for key in ("primary", "secondary", "accent", "text"):
        if key in colors and isinstance(colors[key], str):
            normalized = colors[key].strip().upper()
            if normalized != colors[key]:
                changes.append({"recordType": "club", "id": record_id, "field": f"colorClub.{key}", "from": colors[key], "to": normalized, "reason": "colore HEX normalizzato"})
                colors[key] = normalized
    return result


def validate_mode(players: Any, clubs: Any, mode: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    dataset = "community" if mode == "community" else "real"
    issues: list[dict[str, Any]] = []
    changes: list[dict[str, Any]] = []
    if not isinstance(players, list):
        issues.append(issue("error", "PLAYERS_NOT_ARRAY", dataset, "Il database giocatori non contiene un array."))
        return issues, [], [], changes
    if not isinstance(clubs, list):
        issues.append(issue("error", "CLUBS_NOT_ARRAY", dataset, "Il database club non contiene un array."))
        return issues, [], [], changes

    club_ids: list[str] = [compact(club.get("id")) if isinstance(club, dict) else "" for club in clubs]
    known_clubs = set(club_ids)
    roster_counts = collections.Counter(compact(player.get("club")) for player in players if isinstance(player, dict))
    normalized_players = [normalize_player(player if isinstance(player, dict) else {}, mode, changes) for player in players]
    normalized_clubs = [normalize_club(club if isinstance(club, dict) else {}, roster_counts.get(compact((club or {}).get("id")), 0), changes) for club in clubs]

    id_counts = collections.Counter(compact(player.get("id")) for player in players if isinstance(player, dict))
    name_groups: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for index, player in enumerate(players):
        if not isinstance(player, dict):
            issues.append(issue("error", "PLAYER_NOT_OBJECT", dataset, f"Il giocatore in posizione {index + 1} non è un oggetto.", index=index))
            continue
        pid = compact(player.get("id"))
        name = compact(player.get("name"))
        role = compact(player.get("role")).upper()
        position_tokens = [compact(token).upper() for token in str(player.get("Position", "")).split(",") if compact(token)]
        if not pid:
            issues.append(issue("error", "PLAYER_ID_MISSING", dataset, f"Giocatore {index + 1}: ID mancante.", index=index))
        elif id_counts[pid] > 1:
            issues.append(issue("error", "PLAYER_ID_DUPLICATE", dataset, f"ID giocatore duplicato: {pid}.", id=pid, count=id_counts[pid]))
        if not name:
            issues.append(issue("error", "PLAYER_NAME_MISSING", dataset, f"Giocatore {pid or index + 1}: nome mancante.", id=pid))
        else:
            name_groups[normalize_name(name)].append({"id": pid, "name": name, "club": compact(player.get("club")), "role": role})
        if role not in ROLE_LABELS:
            issues.append(issue("error", "PLAYER_ROLE_INVALID", dataset, f"{name or pid}: ruolo macro non valido “{role or 'mancante'}”.", id=pid, value=role))
        if not position_tokens:
            issues.append(issue("error", "PLAYER_POSITION_MISSING", dataset, f"{name or pid}: Position mancante.", id=pid))
        unknown_positions = [token for token in position_tokens if token not in POSITIONS]
        if unknown_positions:
            issues.append(issue("error", "PLAYER_POSITION_INVALID", dataset, f"{name or pid}: posizioni non valide: {', '.join(unknown_positions)}.", id=pid, values=unknown_positions))
        expected_label = ROLE_LABELS.get(role)
        if expected_label and compact(player.get("roleLabel")) != expected_label:
            issues.append(issue("warning", "PLAYER_ROLE_LABEL_MISMATCH", dataset, f"{name or pid}: roleLabel “{compact(player.get('roleLabel')) or 'mancante'}” dovrebbe essere “{expected_label}”.", id=pid, expected=expected_label, actual=player.get("roleLabel"), autoFix=True))
        if not finite_number(player.get("ovr")) or not 1 <= float(player.get("ovr")) <= 100:
            issues.append(issue("error", "PLAYER_OVR_INVALID", dataset, f"{name or pid}: OVR non valido.", id=pid, value=player.get("ovr")))
        elif float(player.get("ovr")) % 1:
            issues.append(issue("warning", "PLAYER_OVR_NOT_INTEGER", dataset, f"{name or pid}: OVR non intero.", id=pid, value=player.get("ovr")))
        if not compact(player.get("nation")):
            issues.append(issue("error", "PLAYER_NATION_MISSING", dataset, f"{name or pid}: nazionale mancante.", id=pid))
        club_id = compact(player.get("club"))
        if club_id not in known_clubs:
            issues.append(issue("error", "PLAYER_CLUB_UNKNOWN", dataset, f"{name or pid}: club “{club_id or 'mancante'}” inesistente.", id=pid, club=club_id))
        subscriber_raw = compact(player.get("subscriber")).lower()
        subscriber = normalize_yes_no(player.get("subscriber"))
        if subscriber is None or subscriber_raw not in {"si", "no"}:
            issues.append(issue("warning", "PLAYER_SUBSCRIBER_NON_CANONICAL", dataset, f"{name or pid}: subscriber usa il valore non canonico “{player.get('subscriber')}”.", id=pid, value=player.get("subscriber"), autoFix=True))
        if "abbonato" in player:
            abbonato_raw = compact(player.get("abbonato")).lower()
            abbonato = normalize_yes_no(player.get("abbonato"))
            if abbonato is None or abbonato_raw not in {"si", "no"}:
                issues.append(issue("warning", "PLAYER_ABBONATO_NON_CANONICAL", dataset, f"{name or pid}: abbonato usa il valore non canonico “{player.get('abbonato')}”.", id=pid, value=player.get("abbonato"), autoFix=True))
            if subscriber is not None and abbonato is not None and subscriber != abbonato:
                issues.append(issue("warning", "PLAYER_SUBSCRIBER_CONFLICT", dataset, f"{name or pid}: subscriber e abbonato non coincidono; la normalizzazione mantiene il valore affermativo.", id=pid, subscriber=player.get("subscriber"), abbonato=player.get("abbonato"), autoFix=True))
        if mode == "real":
            if not finite_number(player.get("quotation")) or float(player.get("quotation")) < 0:
                issues.append(issue("error", "PLAYER_QUOTATION_INVALID", dataset, f"{name or pid}: quotazione non valida.", id=pid, value=player.get("quotation")))
            if not compact(player.get("sourceRole")):
                issues.append(issue("warning", "PLAYER_SOURCE_ROLE_MISSING", dataset, f"{name or pid}: sourceRole mancante.", id=pid))

    emitted_names: set[str] = set()
    for normalized, entries in name_groups.items():
        if normalized and len(entries) > 1 and normalized not in emitted_names:
            emitted_names.add(normalized)
            labels = ", ".join(f"{entry['name']} [{entry['id']} · {entry['club']} · {entry['role']}]" for entry in entries)
            issues.append(issue("warning", "PLAYER_NAME_DUPLICATE", dataset, f"Nome giocatore duplicato: {labels}.", entries=entries, manualReview=True))

    club_id_counts = collections.Counter(club_ids)
    club_name_groups: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for index, club in enumerate(clubs):
        if not isinstance(club, dict):
            issues.append(issue("error", "CLUB_NOT_OBJECT", dataset, f"Il club in posizione {index + 1} non è un oggetto.", index=index))
            continue
        cid = compact(club.get("id"))
        name = compact(club.get("name"))
        if not cid:
            issues.append(issue("error", "CLUB_ID_MISSING", dataset, f"Club {index + 1}: ID mancante.", index=index))
        elif club_id_counts[cid] > 1:
            issues.append(issue("error", "CLUB_ID_DUPLICATE", dataset, f"ID club duplicato: {cid}.", id=cid, count=club_id_counts[cid]))
        elif not SLUG.match(cid):
            issues.append(issue("warning", "CLUB_ID_NON_CANONICAL", dataset, f"{name or cid}: ID club non è uno slug canonico.", id=cid))
        if not name:
            issues.append(issue("error", "CLUB_NAME_MISSING", dataset, f"Club {cid or index + 1}: nome mancante.", id=cid))
        else:
            club_name_groups[normalize_name(name)].append({"id": cid, "name": name})
        short = compact(club.get("shortName"))
        if not short:
            issues.append(issue("error", "CLUB_SHORT_NAME_MISSING", dataset, f"{name or cid}: shortName mancante.", id=cid))
        elif len(short) > 6:
            issues.append(issue("warning", "CLUB_SHORT_NAME_LONG", dataset, f"{name or cid}: shortName molto lungo ({len(short)} caratteri).", id=cid, value=short))
        colors = club.get("colorClub") if isinstance(club.get("colorClub"), dict) else {}
        for key in ("primary", "secondary", "accent", "text"):
            value = compact(colors.get(key))
            if not value:
                issues.append(issue("warning", "CLUB_COLOR_MISSING", dataset, f"{name or cid}: colore {key} mancante.", id=cid, color=key))
            elif not HEX_COLOR.match(value):
                issues.append(issue("error", "CLUB_COLOR_INVALID", dataset, f"{name or cid}: colore {key} non valido “{value}”.", id=cid, color=key, value=value))
        formation = compact(club.get("defaultFormation"))
        if formation not in FORMATIONS:
            issues.append(issue("warning", "CLUB_FORMATION_UNKNOWN", dataset, f"{name or cid}: formazione predefinita non riconosciuta “{formation or 'mancante'}”.", id=cid, value=formation))
        actual_roster = roster_counts.get(cid, 0)
        declared = club.get("rosterSize")
        if not finite_number(declared) or int(float(declared)) != actual_roster:
            issues.append(issue("warning", "CLUB_ROSTER_SIZE_MISMATCH", dataset, f"{name or cid}: rosterSize è {declared}, ma i giocatori presenti sono {actual_roster}.", id=cid, declared=declared, actual=actual_roster, autoFix=True))
        roles = collections.Counter(compact(player.get("role")).upper() for player in players if isinstance(player, dict) and compact(player.get("club")) == cid)
        excluded_user_club = mode == "real" and cid == "fantaballa-real"
        minimum = 14 if mode == "real" else 11
        if not excluded_user_club and actual_roster < minimum:
            issues.append(issue("error", "CLUB_ROSTER_TOO_SMALL", dataset, f"{name or cid}: soltanto {actual_roster} giocatori, minimo {minimum}.", id=cid, actual=actual_roster, minimum=minimum))
        if not excluded_user_club and roles.get("P", 0) < 1:
            issues.append(issue("error", "CLUB_NO_GOALKEEPER", dataset, f"{name or cid}: nessun portiere.", id=cid))
        if not excluded_user_club and (roles.get("D", 0) < 4 or roles.get("C", 0) < 3 or roles.get("A", 0) < 2):
            issues.append(issue("warning", "CLUB_ROLE_DISTRIBUTION_FRAGILE", dataset, f"{name or cid}: distribuzione ruoli fragile (P {roles.get('P',0)}, D {roles.get('D',0)}, C {roles.get('C',0)}, A {roles.get('A',0)}).", id=cid, roles=dict(roles)))

    for normalized, entries in club_name_groups.items():
        if normalized and len(entries) > 1:
            issues.append(issue("warning", "CLUB_NAME_DUPLICATE", dataset, f"Nome club duplicato: {', '.join(entry['name'] for entry in entries)}.", entries=entries, manualReview=True))

    expected_clubs = 37 if mode == "community" else 21
    expected_players = 716 if mode == "community" else 455
    if len(clubs) != expected_clubs:
        issues.append(issue("warning", "DATASET_CLUB_COUNT_UNEXPECTED", dataset, f"Numero club inatteso: {len(clubs)}, attesi {expected_clubs}.", actual=len(clubs), expected=expected_clubs))
    if len(players) != expected_players:
        issues.append(issue("warning", "DATASET_PLAYER_COUNT_UNEXPECTED", dataset, f"Numero giocatori inatteso: {len(players)}, attesi {expected_players}.", actual=len(players), expected=expected_players))

    return issues, normalized_players, normalized_clubs, changes


def validate_commentary(value: Any) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    dataset = "commentary"
    if not isinstance(value, dict):
        return [issue("error", "COMMENTARY_NOT_OBJECT", dataset, "cronaca-gol.json non contiene un oggetto.")]
    required = {"positions": dict, "special": dict, "result": dict, "milestones": dict, "assists": list}
    for key, expected_type in required.items():
        if not isinstance(value.get(key), expected_type):
            issues.append(issue("error", "COMMENTARY_SECTION_INVALID", dataset, f"Sezione {key} mancante o non valida.", section=key))
    positions = value.get("positions") if isinstance(value.get("positions"), dict) else {}
    for position in POSITIONS:
        rows = positions.get(position)
        if not isinstance(rows, list) or not rows:
            issues.append(issue("warning", "COMMENTARY_POSITION_EMPTY", dataset, f"Nessuna frase gol per la posizione {position}.", position=position))
    for section_name in ("positions", "special", "result", "milestones"):
        section = value.get(section_name)
        if not isinstance(section, dict):
            continue
        for key, rows in section.items():
            if not isinstance(rows, list) or not all(isinstance(row, str) and row.strip() for row in rows):
                issues.append(issue("error", "COMMENTARY_LIST_INVALID", dataset, f"Elenco non valido in {section_name}.{key}.", section=section_name, key=key))
    return issues


def validate_ranking(value: Any) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    dataset = "ranking-fallback"
    if not isinstance(value, dict):
        return [issue("error", "RANKING_NOT_OBJECT", dataset, "classifica.json non contiene un oggetto.")]
    if not isinstance(value.get("classifica"), list):
        issues.append(issue("error", "RANKING_ROWS_INVALID", dataset, "Il campo classifica deve essere un array."))
    date = compact(value.get("aggiornato_il"))
    if date and not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        issues.append(issue("warning", "RANKING_DATE_INVALID", dataset, "aggiornato_il non usa il formato YYYY-MM-DD.", value=date))
    if isinstance(value.get("classifica"), list) and not value["classifica"]:
        issues.append(issue("info", "RANKING_EMPTY", dataset, "La classifica fallback è vuota; la pagina dipende dalla sorgente online."))
    return issues


def counts(issues: list[dict[str, Any]]) -> dict[str, int]:
    counter = collections.Counter(item["severity"] for item in issues)
    return {"errors": counter.get("error", 0), "warnings": counter.get("warning", 0), "info": counter.get("info", 0), "total": len(issues)}


def markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# Rapporto validazione database Fantaballa",
        "",
        f"Generato: `{report['generatedAt']}`",
        "",
        "## Riepilogo",
        "",
        "| Dataset | Record | Errori | Avvisi | Informazioni | Correzioni sicure |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for key in ("community", "real", "commentary", "ranking-fallback"):
        section = report["datasets"][key]
        record_text = section.get("recordLabel", "—")
        summary = section["summary"]
        lines.append(f"| {key} | {record_text} | {summary['errors']} | {summary['warnings']} | {summary['info']} | {len(section.get('changes', []))} |")
    lines += [
        "",
        "## Criterio di pulizia",
        "",
        "Le copie in `data/normalized/` applicano solo trasformazioni deterministiche: spazi, maiuscole delle posizioni, etichette ruolo, valori abbonamento e `rosterSize`. Nessun giocatore o club viene eliminato automaticamente.",
        "",
        "## Questioni da verificare manualmente",
        "",
    ]
    manual = [item for item in report["issues"] if item.get("detail", {}).get("manualReview")]
    if manual:
        lines.extend(f"- **{item['dataset']} · {item['code']}** — {item['message']}" for item in manual)
    else:
        lines.append("- Nessuna.")
    lines += ["", "## Tutte le anomalie", ""]
    if not report["issues"]:
        lines.append("Nessuna anomalia rilevata.")
    else:
        for severity in ("error", "warning", "info"):
            rows = [item for item in report["issues"] if item["severity"] == severity]
            if not rows:
                continue
            lines += [f"### {severity.upper()} ({len(rows)})", ""]
            lines.extend(f"- `{item['dataset']}` · `{item['code']}` — {item['message']}" for item in rows)
            lines.append("")
    lines += ["## Correzioni sicure generate", ""]
    all_changes = [change | {"dataset": key} for key in ("community", "real") for change in report["datasets"][key].get("changes", [])]
    if not all_changes:
        lines.append("Nessuna correzione necessaria.")
    else:
        for change in all_changes:
            lines.append(f"- `{change['dataset']}` · `{change['recordType']}:{change['id']}` · `{change['field']}`: `{change.get('from')}` → `{change.get('to')}` ({change['reason']})")
    lines += ["", "## File generati", "", "- `data/normalized/giocatori.json`", "- `data/normalized/club.json`", "- `data/normalized/giocatori-real.json`", "- `data/normalized/club-real.json`", "- `DATABASE-VALIDATION-REPORT.json`", ""]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply-safe-fixes", action="store_true", help="Applica ai file live le sole correzioni non distruttive")
    args = parser.parse_args()

    community_players = read_json(DATA_DIR / "giocatori.json")
    community_clubs = read_json(DATA_DIR / "club.json")
    real_players = read_json(DATA_DIR / "giocatori-real.json")
    real_clubs = read_json(DATA_DIR / "club-real.json")
    commentary = read_json(DATA_DIR / "cronaca-gol.json")
    ranking = read_json(DATA_DIR / "classifica.json")

    community_issues, community_players_norm, community_clubs_norm, community_changes = validate_mode(community_players, community_clubs, "community")
    real_issues, real_players_norm, real_clubs_norm, real_changes = validate_mode(real_players, real_clubs, "real")
    commentary_issues = validate_commentary(commentary)
    ranking_issues = validate_ranking(ranking)

    write_json(NORMALIZED_DIR / "giocatori.json", community_players_norm)
    write_json(NORMALIZED_DIR / "club.json", community_clubs_norm)
    write_json(NORMALIZED_DIR / "giocatori-real.json", real_players_norm)
    write_json(NORMALIZED_DIR / "club-real.json", real_clubs_norm)

    if args.apply_safe_fixes:
        write_json(DATA_DIR / "giocatori.json", community_players_norm)
        write_json(DATA_DIR / "club.json", community_clubs_norm)
        write_json(DATA_DIR / "giocatori-real.json", real_players_norm)
        write_json(DATA_DIR / "club-real.json", real_clubs_norm)

    datasets = {
        "community": {"recordLabel": f"{len(community_players)} giocatori · {len(community_clubs)} club", "summary": counts(community_issues), "issues": community_issues, "changes": community_changes},
        "real": {"recordLabel": f"{len(real_players)} giocatori · {len(real_clubs)} club", "summary": counts(real_issues), "issues": real_issues, "changes": real_changes},
        "commentary": {"recordLabel": "cronaca gol", "summary": counts(commentary_issues), "issues": commentary_issues, "changes": []},
        "ranking-fallback": {"recordLabel": f"{len(ranking.get('classifica', [])) if isinstance(ranking, dict) and isinstance(ranking.get('classifica'), list) else 0} righe", "summary": counts(ranking_issues), "issues": ranking_issues, "changes": []},
    }
    all_issues = community_issues + real_issues + commentary_issues + ranking_issues
    report = {
        "schemaVersion": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "safeFixesAppliedToLiveFiles": bool(args.apply_safe_fixes),
        "summary": counts(all_issues),
        "datasets": datasets,
        "issues": all_issues,
    }
    write_json(ROOT / "DATABASE-VALIDATION-REPORT.json", report)
    (ROOT / "DATABASE-VALIDATION-REPORT.md").write_text(markdown_report(report), encoding="utf-8")

    print(json.dumps({"summary": report["summary"], "safeFixesApplied": args.apply_safe_fixes, "normalizedDirectory": str(NORMALIZED_DIR)}, ensure_ascii=False, indent=2))
    return 1 if report["summary"]["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())

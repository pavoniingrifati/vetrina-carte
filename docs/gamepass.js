// docs/gamepass.js
import { onUser, login, logout, qs, el, call } from "./common.js";
import {
  collection, getDocs, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db, auth } from "./common.js";

const statusBox = qs("#status");
const achGrid = qs("#achGrid");
const reqList = qs("#reqList");
const btnLogin = qs("#btnLogin");
const btnLogout = qs("#btnLogout");
const userInfo = qs("#userInfo");

btnLogin.onclick = () => login().catch(err => alert(err.message));
btnLogout.onclick = () => logout().catch(err => alert(err.message));

const createRequest = call("createRequest");

function setStatus(msg) {
  statusBox.textContent = msg;
}

function badgeForStatus(s) {
  if (s === "approved") return "✅ approvata";
  if (s === "rejected") return "❌ rifiutata";
  return "⏳ in revisione";
}

async function loadAll(uid) {
  setStatus("Carico achievements e stato…");

  // Achievements attivi
  const achSnap = await getDocs(collection(db, "achievements"));
  const achievements = achSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.active !== false);

  // Earned dell'utente
  const earnedSnap = await getDocs(collection(db, `users/${uid}/earned`));
  const earnedSet = new Set(earnedSnap.docs.map(d => d.id));

  // Requests dell'utente (ultime 50)
  const reqQ = query(
    collection(db, "requests"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const reqSnap = await getDocs(reqQ);
  const requests = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderAchievements(achievements, earnedSet);
  renderRequests(requests);

  setStatus(`Ok. Approvati: ${earnedSet.size} • Richieste: ${requests.length}`);
}

function prereqMissing(ach, earnedSet) {
  const prereq = ach.prereq || [];
  return prereq.filter(id => !earnedSet.has(id));
}

function renderAchievements(achievements, earnedSet) {
  achGrid.innerHTML = "";

  for (const ach of achievements) {
    const missing = prereqMissing(ach, earnedSet);
    const locked = missing.length > 0;
    const already = earnedSet.has(ach.id);

    const evidenceText = el("textarea", { placeholder: "Prova (testo) — es: minuto della clip, contesto…" });
    const evidenceUrl = el("input", { placeholder: "Link prova (opzionale)", type: "url" });

    const btn = el("button", {
      class: "btn primary",
      onclick: async () => {
        if (!auth.currentUser) return alert("Devi fare login.");
        btn.disabled = true;
        try {
          await createRequest({
            achievementId: ach.id,
            evidenceText: evidenceText.value.trim(),
            evidenceUrl: evidenceUrl.value.trim(),
          });
          alert("Richiesta inviata!");
          await loadAll(auth.currentUser.uid);
        } catch (e) {
          alert(e?.message || "Errore");
        } finally {
          btn.disabled = false;
        }
      }
    }, [document.createTextNode("Richiedi")]);

    const state = already
      ? el("span", { class: "badge" }, [document.createTextNode("✅ già approvato")])
      : locked
        ? el("span", { class: "badge" }, [document.createTextNode("🔒 bloccato (mancano prereq)")])
        : el("span", { class: "badge" }, [document.createTextNode("🟦 richiedibile")]);

    const reward = ach.reward ? `${ach.reward.itemId} x${ach.reward.qty}` : "—";

    const card = el("div", { class: "card" }, [
      el("div", { class: "row" }, [
        el("strong", {}, [document.createTextNode(ach.title || ach.id)]),
        state
      ]),
      el("div", { class: "small" }, [document.createTextNode(ach.desc || "")]),
      el("div", { class: "sep" }),
      el("div", { class: "small" }, [document.createTextNode(`Ricompensa: ${reward}`)]),
      locked ? el("div", { class: "small mono" }, [document.createTextNode(`Prereq mancanti: ${missing.join(", ")}`)]) : document.createTextNode(""),
      el("div", { class: "sep" }),
      already ? el("div", { class: "small" }, [document.createTextNode("Questo achievement è già stato approvato.")]) : el("div", {}, [
        el("div", { class: "small" }, [document.createTextNode("Inserisci una prova (facoltativa ma consigliata):")]),
        evidenceText,
        el("div", { style: "height:8px" }),
        evidenceUrl,
        el("div", { style: "height:10px" }),
        locked ? el("button", { class: "btn", disabled: "true" }, [document.createTextNode("Non disponibile")]) : btn
      ])
    ]);

    achGrid.append(card);
  }
}

function renderRequests(requests) {
  reqList.innerHTML = "";
  if (!requests.length) {
    reqList.append(el("div", { class: "card small" }, [document.createTextNode("Nessuna richiesta ancora.")]));
    return;
  }

  for (const r of requests) {
    const card = el("div", { class: "card" }, [
      el("div", { class: "row" }, [
        el("strong", {}, [document.createTextNode(r.achievementTitle || r.achievementId)]),
        el("span", { class: "badge" }, [document.createTextNode(badgeForStatus(r.status))])
      ]),
      r.note ? el("div", { class: "small" }, [document.createTextNode(`Nota mod: ${r.note}`)]) : el("div", { class: "small" }, [document.createTextNode(" ")])
    ]);
    reqList.append(card);
  }
}

onUser(async (user) => {
  if (!user) {
    userInfo.textContent = "";
    btnLogin.style.display = "";
    btnLogout.style.display = "none";
    achGrid.innerHTML = "";
    reqList.innerHTML = "";
    setStatus("Fai login per vedere e richiedere achievement.");
    return;
  }

  btnLogin.style.display = "none";
  btnLogout.style.display = "";
  userInfo.textContent = user.email || user.uid;

  await loadAll(user.uid);
});

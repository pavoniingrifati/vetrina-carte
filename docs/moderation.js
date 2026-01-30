// docs/moderation.js
// Moderazione richieste Game Pass + fallback nome da /users/{uid}/profile/main

import { onUser, login, logout, qs, el, db, auth } from "./common.js";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  setDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const statusBox = qs("#status");
const queue = qs("#queue");
const btnLogin = qs("#btnLogin");
const btnLogout = qs("#btnLogout");
const btnReload = qs("#btnReload");
const userInfo = qs("#userInfo");

btnLogin.onclick = () => login().catch(err => alert(err.message));
btnLogout.onclick = () => logout().catch(err => alert(err.message));
btnReload.onclick = () => auth.currentUser && loadQueue();

function setStatus(msg) { statusBox.textContent = msg; }

async function checkModerator(uid) {
  const modSnap = await getDoc(doc(db, "moderators", uid));
  return modSnap.exists();
}

// Cache profili (evita getDoc ripetuti)
const profileNameCache = new Map(); // uid -> string|null oppure Promise
async function getProfileName(uid) {
  if (profileNameCache.has(uid)) return await profileNameCache.get(uid);

  const p = (async () => {
    try {
      const snap = await getDoc(doc(db, `users/${uid}/profile/main`));
      if (snap.exists()) {
        const d = snap.data() || {};
        const n = (d.displayName || "").toString().trim();
        return n || null;
      }
    } catch (e) {
      console.warn("getProfileName error", uid, e);
    }
    return null;
  })();

  profileNameCache.set(uid, p);
  const v = await p;
  profileNameCache.set(uid, v);
  return v;
}

async function loadQueue() {
  setStatus("Carico richieste pending…");
  queue.innerHTML = "";

  const q = query(
    collection(db, "requests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(100)
  );

  let snap;
  try {
    snap = await getDocs(q);
  } catch (e) {
    console.error(e);
    setStatus("Errore nel caricare la queue. Se vedi un errore index, crea l'indice richiesto in Firestore.");
    return;
  }

  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  setStatus(`Pending: ${items.length}`);

  if (!items.length) {
    queue.append(el("div", { class: "card small" }, [document.createTextNode("Nessuna richiesta in attesa.")]));
    return;
  }

  // Precarica profili per le richieste senza requesterName
  const uidsNeedingProfile = [...new Set(
    items
      .filter(r => !(r.requesterName && String(r.requesterName).trim()))
      .map(r => r.uid)
      .filter(Boolean)
  )];

  await Promise.all(uidsNeedingProfile.map(uid => getProfileName(uid)));

  for (const r of items) {
    const note = el("textarea", { placeholder: "Nota (opzionale)" });

    const approveBtn = el("button", {
      class: "btn primary",
      onclick: async () => {
        approveBtn.disabled = true;
        rejectBtn.disabled = true;

        try {
          // 1) prendo i punti dall'achievement
          const achSnap = await getDoc(doc(db, "achievements", r.achievementId));
          if (!achSnap.exists()) throw new Error("Achievement non trovato");
          const ach = achSnap.data() || {};

          // 2) aggiorno la richiesta -> approved
          await updateDoc(doc(db, "requests", r.id), {
            status: "approved",
            note: note.value.trim(),
            reviewedAt: serverTimestamp(),
            reviewedBy: auth.currentUser.uid
          });

          // 3) segno earned
          await setDoc(doc(db, `users/${r.uid}/earned/${r.achievementId}`), {
            approvedAt: serverTimestamp(),
            approvedBy: auth.currentUser.uid
          }, { merge: true });

          // 4) aggiungo punti Game Pass
          const pts = Number(ach.points) || 0;
          if (pts) {
            await setDoc(doc(db, `users/${r.uid}/gamepass/progress`), {
              points: increment(pts),
              updatedAt: serverTimestamp()
            }, { merge: true });
          }

          await loadQueue();
        } catch (e) {
          alert(e?.message || "Errore");
          console.error(e);
        } finally {
          approveBtn.disabled = false;
          rejectBtn.disabled = false;
        }
      }
    }, [document.createTextNode("Approva")]);

    const rejectBtn = el("button", {
      class: "btn danger",
      onclick: async () => {
        rejectBtn.disabled = true;
        approveBtn.disabled = true;

        try {
          await updateDoc(doc(db, "requests", r.id), {
            status: "rejected",
            note: note.value.trim(),
            reviewedAt: serverTimestamp(),
            reviewedBy: auth.currentUser.uid
          });
          await loadQueue();
        } catch (e) {
          alert(e?.message || "Errore");
          console.error(e);
        } finally {
          rejectBtn.disabled = false;
          approveBtn.disabled = false;
        }
      }
    }, [document.createTextNode("Rifiuta")]);

    // Prove
    const evidence = [];
    if (r.evidenceText) evidence.push(el("div", { class: "small" }, [document.createTextNode(`Prova: ${r.evidenceText}`)]));
    if (r.evidenceUrl) evidence.push(el("div", { class: "small" }, [
      document.createTextNode("Link: "),
      el("a", { href: r.evidenceUrl, target: "_blank", rel: "noopener" }, [document.createTextNode(r.evidenceUrl)])
    ]));

    // Nome: 1) requesterName nella request 2) profile/main.displayName 3) fallback
    const profileName = await getProfileName(r.uid);
    const shownName =
      (r.requesterName && String(r.requesterName).trim())
        ? String(r.requesterName).trim()
        : (profileName || "Senza nome");

    const shownEmail =
      (r.requesterEmail && String(r.requesterEmail).trim())
        ? String(r.requesterEmail).trim()
        : "Senza email";

    const card = el("div", { class: "card" }, [
      el("div", { class: "row" }, [
        el("strong", {}, [document.createTextNode(r.achievementTitle || r.achievementId)]),
        el("span", { class: "badge" }, [document.createTextNode("⏳ pending")]),
      ]),
      el("div", { class: "small" }, [
        document.createTextNode(`Utente: ${shownName} — ${shownEmail}`)
      ]),
      el("div", { class: "small mono" }, [
        document.createTextNode(`uid: ${r.uid}`)
      ]),
      ...evidence,
      el("div", { class: "sep" }),
      note,
      el("div", { style: "height:10px" }),
      el("div", { class: "row" }, [approveBtn, rejectBtn])
    ]);

    queue.append(card);
  }
}

onUser(async (user) => {
  if (!user) {
    userInfo.textContent = "";
    btnLogin.style.display = "";
    btnLogout.style.display = "none";
    btnReload.style.display = "none";
    queue.innerHTML = "";
    setStatus("Fai login. Serve essere presente in /moderators/{uid}.");
    return;
  }

  btnLogin.style.display = "none";
  btnLogout.style.display = "";
  userInfo.textContent = user.email || user.uid;

  const ok = await checkModerator(user.uid);
  if (!ok) {
    btnReload.style.display = "none";
    queue.innerHTML = "";
    setStatus("Non autorizzato: non sei in /moderators/{tuoUID}.");
    return;
  }

  btnReload.style.display = "";
  await loadQueue();
});

// docs/moderation.js
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
  // Legge SOLO il doc del proprio uid: /moderators/{uid}
  const modSnap = await getDoc(doc(db, "moderators", uid));
  return modSnap.exists();
}

async function loadQueue() {
  setStatus("Carico richieste pending…");
  queue.innerHTML = "";

  // Pending (ultime 100)
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

  for (const r of items) {
    const note = el("textarea", { placeholder: "Nota (opzionale)" });

    const approveBtn = el("button", {
      class: "btn primary",
      onclick: async () => {
        approveBtn.disabled = true;
        rejectBtn.disabled = true;

        try {
          // 1) prendo il reward dall'achievement
          const achSnap = await getDoc(doc(db, "achievements", r.achievementId));
          if (!achSnap.exists()) throw new Error("Achievement non trovato");
          const ach = achSnap.data();

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

    const evidence = [];
    if (r.evidenceText) evidence.push(el("div", { class: "small" }, [document.createTextNode(`Prova: ${r.evidenceText}`)]));
    if (r.evidenceUrl) evidence.push(el("div", { class: "small" }, [
      document.createTextNode("Link: "),
      el("a", { href: r.evidenceUrl, target: "_blank", rel: "noopener" }, [document.createTextNode(r.evidenceUrl)])
    ]));

    const card = el("div", { class: "card" }, [
      el("div", { class: "row" }, [
        el("strong", {}, [document.createTextNode(r.achievementTitle || r.achievementId)]),
        el("span", { class: "badge" }, [document.createTextNode("⏳ pending")]),
      ]),
      el("div", { class: "small" }, [
  document.createTextNode(
    `Utente: ${(r.requesterName || "Senza nome")} — ${(r.requesterEmail || "Senza email")}`
  )
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

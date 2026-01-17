const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

function isMod(req) {
  return req.auth && req.auth.token && req.auth.token.moderator === true;
}

exports.createRequest = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login richiesto");

  const { achievementId, evidenceText = "", evidenceUrl = "" } = req.data || {};
  if (!achievementId) throw new HttpsError("invalid-argument", "achievementId mancante");

  const achRef = db.doc(`achievements/${achievementId}`);
  const achSnap = await achRef.get();
  if (!achSnap.exists) throw new HttpsError("failed-precondition", "Achievement inesistente");
  const ach = achSnap.data();
  if (ach.active === false) throw new HttpsError("failed-precondition", "Achievement non attivo");

  // Se già earned, stop
  const earnedRef = db.doc(`users/${uid}/earned/${achievementId}`);
  if ((await earnedRef.get()).exists) {
    throw new HttpsError("already-exists", "Già approvato");
  }

  // Blocca se già pending per lo stesso achievement
  const dupQ = await db.collection("requests")
    .where("uid", "==", uid)
    .where("achievementId", "==", achievementId)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (!dupQ.empty) throw new HttpsError("already-exists", "Richiesta già in revisione");

  await db.collection("requests").add({
    uid,
    achievementId,
    achievementTitle: ach.title || achievementId,
    status: "pending",
    evidenceText: String(evidenceText).slice(0, 2000),
    evidenceUrl: String(evidenceUrl).slice(0, 2000),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    note: null
  });

  return { ok: true };
});

exports.reviewRequest = onCall(async (req) => {
  const reviewerUid = req.auth?.uid;
  if (!reviewerUid || !isMod(req)) throw new HttpsError("permission-denied", "Solo moderatori");

  const { requestId, action, note = "" } = req.data || {};
  if (!requestId) throw new HttpsError("invalid-argument", "requestId mancante");
  if (action !== "approve" && action !== "reject") {
    throw new HttpsError("invalid-argument", "action deve essere approve/reject");
  }

  const requestRef = db.doc(`requests/${requestId}`);

  await db.runTransaction(async (tx) => {
    const rSnap = await tx.get(requestRef);
    if (!rSnap.exists) throw new HttpsError("not-found", "Richiesta non trovata");

    const r = rSnap.data();
    if (r.status !== "pending") throw new HttpsError("failed-precondition", "Già revisionata");

    if (action === "reject") {
      tx.update(requestRef, {
        status: "rejected",
        note: String(note).slice(0, 1000),
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: reviewerUid
      });
      return;
    }

    // Approve
    const achRef = db.doc(`achievements/${r.achievementId}`);
    const achSnap = await tx.get(achRef);
    if (!achSnap.exists) throw new HttpsError("failed-precondition", "Achievement mancante");
    const ach = achSnap.data();
    if (ach.active === false) throw new HttpsError("failed-precondition", "Achievement non attivo");

    // prereq check
    const prereq = ach.prereq || [];
    for (const preId of prereq) {
      const preEarned = await tx.get(db.doc(`users/${r.uid}/earned/${preId}`));
      if (!preEarned.exists) {
        throw new HttpsError("failed-precondition", `Prerequisiti mancanti: ${preId}`);
      }
    }

    // earned (idempotente)
    tx.set(db.doc(`users/${r.uid}/earned/${r.achievementId}`), {
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedBy: reviewerUid
    }, { merge: true });

    // reward → inventory
    if (ach.reward && ach.reward.itemId && ach.reward.qty) {
      const itemId = ach.reward.itemId;
      const qty = Number(ach.reward.qty) || 0;
      if (qty > 0) {
        const invRef = db.doc(`users/${r.uid}/inventory/${itemId}`);
        const invSnap = await tx.get(invRef);
        const oldQty = invSnap.exists ? (invSnap.data().qty || 0) : 0;
        tx.set(invRef, {
          qty: oldQty + qty,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }

    tx.update(requestRef, {
      status: "approved",
      note: String(note).slice(0, 1000),
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: reviewerUid
    });
  });

  return { ok: true };
});

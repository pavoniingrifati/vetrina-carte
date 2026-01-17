// docs/common.js
import { firebaseConfig, functionsRegion } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, functionsRegion);

const provider = new GoogleAuthProvider();

export async function login() {
  await signInWithPopup(auth, provider);
}

export async function logout() {
  await signOut(auth);
}

export function onUser(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function getClaims() {
  const user = auth.currentUser;
  if (!user) return {};
  const res = await getIdTokenResult(user, true);
  return res.claims || {};
}

export const call = (name) => httpsCallable(functions, name);

export function qs(sel) { return document.querySelector(sel); }
export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  });
  for (const c of children) n.append(c);
  return n;
}

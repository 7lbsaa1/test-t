// تهيئة Firebase المشتركة — لا تكرر هذه التهيئة في أي ملف آخر
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, runTransaction, onValue, get, update, push } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAxdGkvwTeZSxkrgVSACgaoYrzaGLlcI0k",
  authDomain: "test-t-bdfbe.firebaseapp.com",
  databaseURL: "https://test-t-bdfbe-default-rtdb.firebaseio.com",
  projectId: "test-t-bdfbe",
  storageBucket: "test-t-bdfbe.firebasestorage.app",
  messagingSenderId: "211509136380",
  appId: "1:211509136380:web:139a6409a17bfb124bc079",
  measurementId: "G-7MGWWZKEKW"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// هل المستخدم الحالي أدمن؟ (يُقرأ من عقدة admins في قاعدة البيانات)
async function isAdminUser(uid) {
  if (!uid) return false;
  try {
    const snap = await get(ref(db, `admins/${uid}`));
    return snap.exists() && snap.val() === true;
  } catch { return false; }
}

export { app, db, auth, ref, runTransaction, onValue, get, update, push, signInWithEmailAndPassword, signOut, onAuthStateChanged, isAdminUser };

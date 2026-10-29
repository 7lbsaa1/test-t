import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

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
const auth = getAuth(app);
const rtdb = getDatabase(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { app, auth, rtdb, db, analytics };

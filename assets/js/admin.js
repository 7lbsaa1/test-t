import { auth, rtdb, db } from "./firebase-config.js";
import { onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { generateOrderPDF } from "./pdf.js";
import { STATUS_AR, STATUS_ORDER } from "./orders.js";

const $ = s => document.querySelector(s);

/* ===== حماية الأدمن ===== */
setPersistence(auth, browserLocalPersistence);

onAuthStateChanged(auth, async user => {
  if (!user) { $("#auth-screen").style.display = "flex"; $("#dashboard").style.display = "none"; return; }
  // التحقق من Custom Claim أو admins/{uid}
  let isAdmin = user.token?.claims?.admin === true;
  if (!isAdmin) {
    const snap = await get(ref(rtdb, `admins/${user.uid}`));
    if (snap.val() === true) isAdmin = true;
  }
  if (!isAdmin) { alert("غير مصرح"); signOut(auth); location.href = "/"; return; }
  $("#auth-screen").style.display = "none";
  $("#dashboard").style.display = "block";
  listenOrders();
});

$("#login-form").addEventListener("submit", e => {
  e.preventDefault();
  signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#pass").value)
    .catch(() => $("#login-err").textContent = "بيانات دخول غير صحيحة");
});
$("#logout").addEventListener("click", () => signOut(auth));

/* ===== الاستماع للطلبات ===== */
let allOrders = [];
function listenOrders() {
  onSnapshot(query(collection(db, "orders"), orderBy("orderNumber", "desc"), limit(200)), snap => {
    allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    $("#stat-total").textContent = allOrders.length;
    $("#stat-today").textContent = allOrders.filter(o => o.createdAt?.toDate?.().toDateString() === new Date().toDateString()).length;
    $("#stat-prep").textContent = allOrders.filter(o => ["confirmed","preparing","ready"].includes(o.status)).length;
    $("#stat-done").textContent = allOrders.filter(o => o.status === "delivered").length;
    $("#stat-sales").textContent = allOrders.filter(o => o.status !== "cancelled").reduce((s, o) => s + (o.grandTotal || 0), 0).toLocaleString("ar-EG");
    renderTable();
  });
}

/* ===== فلترة + بحث + رسم الجدول ===== */
let filterStatus = "all", sortKey = "orderNumber", sortDir = -1;
function renderTable() {
  let rows = allOrders.filter(o => filterStatus === "all" || o.status === filterStatus);
  const q = $("#search").value.trim().toLowerCase();
  if (q) rows = rows.filter(o => o.name?.toLowerCase().includes(q) || o.phone?.includes(q) || String(o.orderNumber) === q);
  rows.sort((a, b) => (a[sortKey] > b[sortKey] ? sortDir : -sortDir));

  const tbody = $("#orders-body");
  tbody.textContent = "";
  rows.forEach(o => {
    const tr = document.createElement("tr");
    const td = (txt) => { const t = document.createElement("td"); t.textContent = txt; return t; };
    tr.appendChild(td("#" + o.orderNumber));
    tr.appendChild(td(o.name));
    tr.appendChild(td(o.phone));
    tr.appendChild(td(o.gov));
    tr.appendChild(td((o.grandTotal || 0) + " ج"));
    // الحالة
    const sel = document.createElement("select");
    sel.className = "status-select status-" + o.status;
    STATUS_ORDER.forEach(s => { const op = document.createElement("option"); op.value = s; op.textContent = STATUS_AR[s]; if (s === o.status) op.selected = true; sel.appendChild(op); });
    sel.addEventListener("change", () => changeStatus(o.id, sel.value, o.status));
    const tdStatus = document.createElement("td"); tdStatus.appendChild(sel); tr.appendChild(tdStatus);
    tr.appendChild(td(o.createdAt?.toDate?.().toLocaleString("ar-EG") || "-"));
    // أزرار
    const act = document.createElement("td");
    const bView = document.createElement("button"); bView.textContent = "تفاصيل"; bView.onclick = () => openOrder(o);
    const bPdf = document.createElement("button"); bPdf.textContent = "PDF"; bPdf.onclick = () => generateOrderPDF(o);
    const bDel = document.createElement("button"); bDel.textContent = "حذف"; bDel.onclick = async () => { if (confirm(`حذف الطلب #${o.orderNumber}؟`)) await deleteDoc(doc(db, "orders", o.id)); };
    act.append(bView, bPdf, bDel);
    tr.appendChild(act);
    tbody.appendChild(tr);
  });
}
$("#filter-status").addEventListener("change", e => { filterStatus = e.target.value; renderTable(); });
$("#search").addEventListener("input", renderTable);
$("#th-num").addEventListener("click", () => { sortKey = "orderNumber"; sortDir *= -1; renderTable(); });

async function changeStatus(id, next, old) {
  if (old === "cancelled" || next === old) return;
  await updateDoc(doc(db, "orders", id), {
    status: next,
    updatedAt: serverTimestamp(),
    statusHistory: arrayUnion({ status: next, at: Date.now(), by: "admin" })
  });
}

/* ===== تفاصيل الطلب + صورة البطاقة من RTDB ===== */
async function openOrder(o) {
  $("#detail-body").textContent = "";
  const add = (label, val) => { const p = document.createElement("p"); const b = document.createElement("strong"); b.textContent = label + ": "; p.appendChild(b); p.appendChild(document.createTextNode(val || "-")); $("#detail-body").appendChild(p); };
  add("الاسم", o.name); add("الهاتف", o.phone); add("المحافظة", o.gov); add("العنوان", o.address); add("ملاحظات", o.notes);
  o.items?.forEach(it => add("المنتج", `${it.title} — مقاس ${it.size} × ${it.qty} — ${it.price * it.qty} ج`));

  // زر واتساب
  $("#detail-wa").href = `https://wa.me/2${o.phone}?text=${encodeURIComponent(`مرحبا ${o.name}، بخصوص طلبك #${o.orderNumber}`)}`;

  // صورة البطاقة
  const imgWrap = $("#detail-idcard");
  imgWrap.textContent = "";
  if (o.idCardPath) {
    const snap = await get(ref(rtdb, o.idCardPath));
    if (snap.exists()) {
      const img = document.createElement("img");
      img.src = snap.val();
      img.alt = "صورة البطاقة";
      img.style.cursor = "zoom-in";
      img.onclick = () => window.open(img.src, "_blank");
      imgWrap.appendChild(img);
    } else imgWrap.textContent = "تعذر تحميل الصورة";
  }
  $("#detail-pdf").onclick = () => generateOrderPDF(o);
  $("#detail-modal").classList.add("open");
}
$("#detail-close").addEventListener("click", () => $("#detail-modal").classList.remove("open"));

/* ===== تصدير CSV ===== */
$("#export-csv").addEventListener("click", () => {
  const head = ["الرقم", "الاسم", "الهاتف", "المحافظة", "العنوان", "الإجمالي", "الحالة"];
  const rows = allOrders.map(o => [o.orderNumber, o.name, o.phone, o.gov, o.address, o.grandTotal, STATUS_AR[o.status]]);
  const csv = "\uFEFF" + [head, ...rows].map(r => r.map(c => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "orders.csv"; a.click();
});

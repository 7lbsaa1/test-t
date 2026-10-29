// js/admin.js — لوحة الأدمن
import { db, auth, ref, get, update, push, onAuthStateChanged, signInWithEmailAndPassword, signOut, isAdminUser } from "./firebase-config.js";

let adminUid = null;
let orders = {};

onAuthStateChanged(auth, async u => {
  if (u && await isAdminUser(u.uid)) {
    adminUid = u.uid;
    $("#admin-panel").style.display = "block";
    $("#auth-box").style.display = "none";
    listenOrders();
  } else {
    if (u) await signOut(auth);
    $("#admin-panel").style.display = "none";
    $("#auth-box").style.display = "block";
  }
});

$("#login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#login-error"); err.textContent = "";
  try { await signInWithEmailAndPassword(auth, e.target.email.value.trim(), e.target.password.value); }
  catch { err.textContent = "بيانات الدخول غير صحيحة أو الحساب ليس أدمن."; }
});
$("#logout-btn").addEventListener("click", () => signOut(auth));

function listenOrders() {
  // الاستماع المباشر مقبول لأن القراءة للأدمن فقط عبر القواعد
  import("./firebase-config.js").then(({ onValue }) => {
    onValue(ref(db, "orders"), snap => {
      orders = snap.val() || {};
      renderStats(); renderOrders();
    });
  });
}

const STATUSES = ["جديد","تم تأكيد الطلب","جاري التجهيز","تم التجهيز","تم الشحن","خرج للتوصيل","تم التوصيل","تم الإلغاء","تعذر التسليم"];

function renderStats() {
  const arr = Object.values(orders);
  const c = s => arr.filter(o => o.status === s).length;
  $("#st-total").textContent = arr.length;
  $("#st-new").textContent = c("جديد");
  $("#st-prep").textContent = c("جاري التجهيز");
  $("#st-shipped").textContent = c("تم الشحن");
  $("#st-delivered").textContent = c("تم التوصيل");
  $("#st-cancelled").textContent = c("تم الإلغاء") + c("تعذر التسليم");
  const doneSales = arr.filter(o => o.status === "تم التوصيل").reduce((s,o)=>s+(o.total||0),0);
  $("#st-sales").textContent = new Intl.NumberFormat("ar-EG").format(doneSales) + " جنيه";
}

function renderOrders() {
  const q = $("#search").value.trim().toLowerCase();
  const st = $("#filter-status").value;
  const box = $("#orders-list"); box.innerHTML = "";
  Object.entries(orders)
    .filter(([,o]) => {
      if (st && o.status !== st) return false;
      if (!q) return true;
      const hay = `${o.seq} ${o.customer?.name||""} ${o.customer?.phone||""}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a,b) => (b[1].seq||0)-(a[1].seq||0))
    .forEach(([key,o]) => box.appendChild(orderCard(key,o)));
}

$("#search").addEventListener("input", renderOrders);
$("#filter-status").addEventListener("change", renderOrders);

function waLink(phone, name, seq) {
  // تحويل الرقم المصري المحلي إلى صيغة دولية
  let p = phone.replace(/\D/g,"");
  if (p.startsWith("0")) p = "2" + p;
  if (!p.startsWith("20")) p = "20" + p;
  const msg = encodeURIComponent(`مرحبًا ${name}، بخصوص طلبكم رقم ORD-${String(seq).padStart(5,"0")}`);
  return `https://wa.me/${p}?text=${msg}`;
}

function orderCard(key, o) {
  const el = document.createElement("article");
  el.className = "order-card";
  const c = o.customer || {};
  const itemsTxt = (o.items||[]).map(i=>`${i.name} — ${i.size} — ${i.color} × ${i.qty}`).join(" | ");
  const date = new Date(o.createdAt||Date.now()).toLocaleString("ar-EG");

  const head = document.createElement("div");
  head.innerHTML = `
    <h3>ORD-${String(o.seq).padStart(5,"0")}</h3>
    <p class="meta"></p><p class="cust"></p><p class="addr"></p><p class="items"></p>
    <p class="total"></p><p class="status-line"></p>`;
  head.querySelector(".meta").textContent = date;
  head.querySelector(".cust").textContent = `${c.name||""} — ${c.phone||""}`;
  head.querySelector(".addr").textContent = `${c.gov||""} / ${c.city||""} — ${c.address||""}`;
  head.querySelector(".items").textContent = itemsTxt;
  head.querySelector(".total").textContent = `الإجمالي: ${new Intl.NumberFormat("ar-EG").format(o.total||0)} جنيه`;
  head.querySelector(".status-line").textContent = `الحالة: ${o.status}`;

  const actions = document.createElement("div");
  actions.className = "actions";

  // واتساب
  const wa = document.createElement("a");
  wa.className = "btn-small"; wa.target = "_blank"; wa.rel = "noopener";
  wa.href = waLink(c.phone||"", c.name||"", o.seq||0); wa.textContent = "واتساب 💬";
  actions.appendChild(wa);

  // تحديث الحالة
  const sel = document.createElement("select");
  STATUSES.forEach(s => { const op=document.createElement("option"); op.value=s; op.textContent=s; if(s===o.status) op.selected=true; sel.appendChild(op); });
  const upBtn = document.createElement("button");
  upBtn.className="btn-small"; upBtn.textContent="تحديث الحالة";
  upBtn.addEventListener("click", async () => {
    const newStatus = sel.value;
    if (newStatus === o.status) return;
    if (!confirm(`تغيير حالة الطلب إلى «${newStatus}»؟`)) return;
    try {
      await update(ref(db, `orders/${key}`), {
        status: newStatus,
        updatedAt: Date.now(),
        history: { ...(o.history||{}), [Date.now()]: { from: o.status, to: newStatus, by: adminUid } }
      });
      notify("تم تحديث الحالة بنجاح");
    } catch { notify("فشل تحديث الحالة — تحقق من الصلاحيات", true); }
  });
  actions.append(sel, upBtn);

  // PDF (نافذة طباعة RTL — العربية تُعرض صحيحة)
  const pdfBtn = document.createElement("button");
  pdfBtn.className="btn-small"; pdfBtn.textContent="إنشاء PDF 🖨";
  pdfBtn.addEventListener("click", () => {
    const idImg = o.idImageBase64 ? `<img src="data:${o.idImageMimeType||"image/jpeg"};base64,${o.idImageBase64}" style="max-width:300px;border-radius:8px">` : "";
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طلب ORD-${o.seq}</title>
      <style>body{font-family:"Cairo",sans-serif;padding:24px;max-width:800px;margin:auto}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px}h1{color:#c9a45c}@media print{.noprint{display:none}}</style>
      </head><body>
      <h1>LUXE MEN</h1><h3>فاتورة الطلب ORD-${String(o.seq).padStart(5,"0")}</h3>
      <table><tr><th>التاريخ</th><td>${date}</td></tr><tr><th>الاسم</th><td>${c.name||""}</td></tr>
      <tr><th>الهاتف</th><td>${c.phone||""}</td></tr><tr><th>العنوان</th><td>${c.gov||""} / ${c.city||""} — ${c.address||""}</td></tr>
      <tr><th>المنتجات</th><td>${itemsTxt}</td></tr><tr><th>الإجمالي</th><td>${o.total} جنيه</td></tr>
      <tr><th>الحالة</th><td>${o.status}</td></tr></table>
      ${idImg}
      <p class="noprint"><button onclick="window.print()">طباعة / حفظ PDF</button></p></body></html>`);
    w.document.close();
  });
  actions.appendChild(pdfBtn);

  el.append(head, actions);
  return el;
}

function notify(msg, isError=false){
  const t=$("#admin-toast"); t.textContent=msg; t.className="toast show"+(isError?" error":"");
  clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove("show"),3500);
}

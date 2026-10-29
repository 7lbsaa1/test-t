// js/app.js — منطق الواجهة العامة
import { db, auth, ref, push, get, runTransaction, onValue } from "./firebase-config.js";

// المنتجات الافتراضية (تجريبية — تُدار من لوحة الأدمن)
const DEFAULT_PRODUCTS = [
  { id: "t1", name: "تيشيرت كلاسيك أسود", price: 350, sizes: ["S","M","L","XL","XXL"], colors: ["أسود","أبيض"], desc: "قطن مصري 100% بقصة كلاسيكية أنيقة.", img: "images/t1.jpg", stock: 20, visible: true },
  { id: "t2", name: "تيشيرت أوفرسايز فحمي", price: 420, sizes: ["M","L","XL","XXL"], colors: ["فحمي","رمادي"], desc: "قصة أوفرسايز عصرية بجودة قطن ثقيلة.", img: "images/t2.jpg", stock: 15, visible: true },
  { id: "t3", name: "تيشيرت بولو فاخر", price: 480, sizes: ["S","M","L","XL"], colors: ["كحلي","أبيض"], desc: "بولو بيكمه بأزرار مصنوعة من اللؤلؤ الطبيعي.", img: "images/t3.jpg", stock: 12, visible: true },
  { id: "t4", name: "تيشيرت أساسي أبيض", price: 320, sizes: ["S","M","L","XL","XXL"], colors: ["أبيض"], desc: "الأساسي الذي لا غنى عنه في أي خزانة.", img: "images/t4.jpg", stock: 30, visible: true },
  { id: "t5", name: "تيشيرت مطبوع ذهبي", price: 550, sizes: ["M","L","XL"], colors: ["أسود"], desc: "طبعة ذهبية محدودة على قطن ممتاز.", img: "images/t5.jpg", stock: 8, visible: true },
  { id: "t6", name: "تيشيرت ليكرا مرن", price: 390, sizes: ["S","M","L","XL","XXL"], colors: ["أسود","كحلي","رمادي"], desc: "ملمس مرن مريح يحافظ على شكله بعد الغسيل.", img: "images/t6.jpg", stock: 18, visible: true },
];

let products = {};
let cart = JSON.parse(localStorage.getItem("cart") || "[]"); // السلة: بيانات عامة فقط
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => new Intl.NumberFormat("ar-EG").format(n) + " جنيه";

async function loadProducts() {
  try {
    const snap = await get(ref(db, "products"));
    if (snap.exists()) products = snap.val();
    else DEFAULT_PRODUCTS.forEach(p => products[p.id] = p);
  } catch { DEFAULT_PRODUCTS.forEach(p => products[p.id] = p); }
  renderProducts();
  renderBestSellers();
}

function productCard(p) {
  const el = document.createElement("article");
  el.className = "card reveal";
  const out = !p.stock || p.stock < 1;
  const colors = (p.colors || []).map((c,i) =>
    `<label class="color-opt"><input type="radio" name="color-${p.id}" value="${c}" ${i===0?"checked":""}><span>${c}</span></label>`).join("");
  el.innerHTML = `
    <div class="card-img" tabindex="0" role="button" aria-label="معاينة الصورة">
      <img src="${p.img}" alt="${p.name}" width="600" height="700" loading="lazy" decoding="async">
    </div>
    <div class="card-body">
      <h3></h3><p class="desc"></p>
      <p class="price"></p>
      <p class="stock ${out?"out":""}"></p>
      <fieldset class="sizes"><legend>المقاس</legend></fieldset>
      <fieldset class="colors"><legend>اللون</legend>${colors}</fieldset>
      <button class="btn add" ${out?"disabled":""}></button>
    </div>`;
  // نصوص آمنة عبر textContent فقط
  el.querySelector("h3").textContent = p.name;
  el.querySelector(".desc").textContent = p.desc || "";
  el.querySelector(".price").textContent = fmt(p.price);
  el.querySelector(".stock").textContent = out ? "غير متوفر حاليًا" : `متوفر (${p.stock} قطعة)`;
  el.querySelector(".sizes").insertAdjacentHTML("beforeend",
    (p.sizes||[]).map((s,i)=>`<label class="size-opt"><input type="radio" name="size-${p.id}" value="${s}" ${i===0?"checked":""}><span>${s}</span></label>`).join(""));
  const btn = el.querySelector(".btn.add");
  btn.textContent = out ? "نفدت الكمية" : "أضف إلى الطلب";
  btn.addEventListener("click", () => {
    if (out) return;
    const size = el.querySelector(`input[name="size-${p.id}"]:checked`)?.value;
    const color = el.querySelector(`input[name="color-${p.id}"]:checked`)?.value || "—";
    if (!size) return alert("اختر المقاس أولًا");
    const existing = cart.find(c => c.id===p.id && c.size===size && c.color===color);
    if (existing) existing.qty++;
    else cart.push({ id: p.id, size, color, qty: 1 });
    saveCart(); showToast("تمت الإضافة إلى الطلب");
  });
  el.querySelector(".card-img").addEventListener("click", () => openPreview(p));
  return el;
}

function renderProducts() {
  const grid = $("#products"); grid.innerHTML = "";
  Object.values(products).filter(p => p.visible !== false).forEach(p => grid.appendChild(productCard(p)));
  observeReveals();
}

function renderBestSellers() {
  const grid = $("#best"); if (!grid) return;
  const top = Object.values(products).filter(p => p.bestSeller && p.visible !== false);
  if (!top.length) { $("#best-section").style.display = "none"; return; }
  top.forEach(p => grid.appendChild(productCard(p)));
}

function saveCart(){ localStorage.setItem("cart", JSON.stringify(cart)); renderCart(); }

function renderCart() {
  const box = $("#cart-items"); box.innerHTML = "";
  let total = 0;
  cart.forEach((c,i) => {
    const p = products[c.id] || DEFAULT_PRODUCTS.find(d=>d.id===c.id);
    if (!p) return;
    const line = p.price * c.qty; total += line;
    const div = document.createElement("div");
    div.className = "cart-line";
    const t = document.createElement("span");
    t.textContent = `${p.name} — ${c.size} — ${c.color} × ${c.qty} = ${fmt(line)}`;
    const del = document.createElement("button");
    del.textContent = "حذف"; del.className = "btn-mini";
    del.addEventListener("click", () => { cart.splice(i,1); saveCart(); });
    div.append(t, del); box.appendChild(div);
  });
  $("#cart-total").textContent = fmt(total);
  $("#cart-badge").textContent = cart.reduce((s,c)=>s+c.qty,0);
}

// ---------- معاينة الصورة (Lightbox) ----------
function openPreview(p) {
  const lb = $("#lightbox");
  $("#lightbox-img").src = p.img;
  $("#lightbox-img").alt = p.name;
  lb.classList.add("open"); lb.focus();
}
$("#lightbox").addEventListener("click", e => { if (e.target.id==="lightbox" || e.target.id==="lightbox-close") $("#lightbox").classList.remove("open"); });
document.addEventListener("keydown", e => { if (e.key==="Escape") $("#lightbox").classList.remove("open"); });

// ---------- ضغط صورة البطاقة إلى Base64 ----------
function compressImageToBase64(file, maxDim = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    // التحقق من النوع الحقيقي (لا نعتمد على الامتداد)
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) return reject("نوع الملف غير مدعوم. استخدم صورة JPG أو PNG.");
    if (file.size > 10 * 1024 * 1024) return reject("حجم الصورة كبير جدًا (الحد 10 ميجابايت).");
    const reader = new FileReader();
    reader.onerror = () => reject("فشل قراءة الملف.");
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject("الملف ليس صورة صالحة.");
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL("image/jpeg", quality).split(",")[1];
          // Base64 يزيد الحجم ~⅓ — نتحقق من الحد النهائي
          if (base64.length > 700_000) return reject("حجم الصورة بعد الضغط يتجاوز الحد المسموح. جرّب صورة أصغر أو أوضح إضاءة.");
          resolve({ base64, mimeType: "image/jpeg", width: w, height: h });
        } catch (e) { reject("حدث خطأ أثناء معالجة الصورة."); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- إرسال الطلب ----------
let submitting = false;
$("#order-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (submitting) return; // منع الإرسال المزدوج
  const f = e.target;
  const name = f.name.value.trim(), phone = f.phone.value.trim(),
        gov = f.gov.value.trim(), city = f.city.value.trim(), address = f.address.value.trim();
  if (!cart.length) return showToast("سلة الطلب فارغة", true);
  if (!/^01[0-2,5]\d{8}$/.test(phone)) return showToast("رقم الهاتف غير صحيح (مثال: 01012345678)", true);
  if (!name || !gov || !city || !address) return showToast("يرجى إكمال جميع الحقول المطلوبة", true);

  const items = cart.map(c => {
    const p = products[c.id] || DEFAULT_PRODUCTS.find(d=>d.id===c.id);
    return { id: c.id, name: p.name, size: c.size, color: c.color, qty: c.qty, unitPrice: p.price };
  });
  const total = items.reduce((s,i)=>s+i.unitPrice*i.qty, 0);

  const idFile = f.idImage.files[0];
  let idImage = null;
  if (idFile) {
    try {
      $("#img-progress").textContent = "جاري معالجة الصورة…";
      const r = await compressImageToBase64(idFile);
      idImage = { idImageBase64: r.base64, idImageMimeType: r.mimeType };
    } catch (err) { $("#img-progress").textContent = ""; return showToast(typeof err==="string"?err:"تعذر معالجة الصورة", true); }
  }

  submitting = true;
  $("#submit-btn").disabled = true; $("#submit-btn").textContent = "جاري الإرسال…";

  try {
    // رقم طلب تسلسلي عبر Transaction على الخادم (ليس عدادًا محليًا)
    const counterRef = ref(db, "orderCounters/main");
    const result = await runTransaction(counterRef, cur => (cur || 0) + 1);
    const seq = result.snapshot.val();
    const orderData = {
      seq, status: "جديد",
      customer: { name, phone, gov, city, address, landmark: f.landmark.value.trim() || "" },
      items, total, currency: "EGP",
      createdAt: Date.now(), updatedAt: Date.now(),
      ...(idImage || {})
    };
    await push(ref(db, "orders"), orderData);
    cart = []; saveCart(); f.reset();
    $("#img-progress").textContent = "";
    $("#order-result").innerHTML = "";
    const ok = document.createElement("div");
    ok.className = "success-box";
    ok.textContent = `تم استلام طلبك بنجاح ✅ رقم الطلب: ORD-${String(seq).padStart(5,"0")} — حالته الحالية: طلب جديد`;
    $("#order-result").appendChild(ok);
  } catch (err) {
    $("#order-result").innerHTML = "";
    const er = document.createElement("div");
    er.className = "error-box";
    er.textContent = "فشل إرسال الطلب. تحقق من الاتصال وحاول مرة أخرى.";
    $("#order-result").appendChild(er);
  } finally {
    submitting = false; $("#submit-btn").disabled = false; $("#submit-btn").textContent = "تأكيد الطلب";
  }
});

// ---------- أدوات واجهة ----------
function showToast(msg, isError=false) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (isError?" error":"");
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove("show"), 3500);
}
function observeReveals() {
  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add("visible")), { threshold: 0.12 });
  $$(".reveal").forEach(el => io.observe(el));
}
// إظهار/إخفاء نموذج الطلب
$("#open-order").addEventListener("click", () => { $("#order-section").scrollIntoView({behavior:"smooth"}); });
// FAQ
$$(".faq-q").forEach(q => q.addEventListener("click", () => q.parentElement.classList.toggle("open")));

loadProducts().then(renderCart);
observeReveals();

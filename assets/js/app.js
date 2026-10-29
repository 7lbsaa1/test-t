import { compressToBase64 } from "./image.js";
import { GOVS, SHIP, createOrder, trackOrder, STATUS_AR, STATUS_ORDER } from "./orders.js";

const $ = s => document.querySelector(s);
const WA_NUMBER = "201234567890"; // ← ضع رقم الواتساب الحقيقي

/* ===== Navbar scroll ===== */
window.addEventListener("scroll", () => {
  $(".navbar")?.classList.toggle("scrolled", scrollY > 40);
}, { passive: true });

/* ===== Burger ===== */
$(".burger")?.addEventListener("click", () => $(".nav-links").classList.toggle("open"));

/* ===== Hero typewriter ===== */
const heroText = "تيشرتات رجالية… جودة تدوم";
function typewriter(el, text, i = 0) {
  if (document.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = text; return; }
  if (i <= text.length) { el.textContent = text.slice(0, i); setTimeout(() => typewriter(el, text, i + 1), 70); }
}
typewriter($(".hero-title"), heroText);

/* ===== Reveal on scroll ===== */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("revealed"); io.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 120}ms`;
  io.observe(el);
});

/* ===== عدادات تصاعدية ===== */
const counterIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, target = +el.dataset.count;
    let cur = 0;
    const step = () => { cur += Math.ceil(target / 40); if (cur >= target) cur = target; el.textContent = cur.toLocaleString("ar-EG"); if (cur < target) requestAnimationFrame(step); };
    step(); counterIO.unobserve(el);
  });
}, { threshold: 0.5 });
document.querySelectorAll("[data-count]").forEach(el => counterIO.observe(el));

/* ===== عدسة التكبير (Zoom Lens) ===== */
function initZoom(container) {
  const img = container.querySelector("img");
  const lens = container.querySelector(".zoom-lens");
  if (!img || !lens) return;
  const IMG = getComputedStyle(img).backgroundImage ? img.src : img.src;

  function move(x, y) {
    const r = container.getBoundingClientRect();
    const px = ((x - r.left) / r.width) * 100;
    const py = ((y - r.top) / r.height) * 100;
    lens.style.left = `${(x - r.left - 70)}px`;
    lens.style.top = `${(y - r.top - 70)}px`;
    lens.style.backgroundImage = `url("${IMG}")`;
    lens.style.backgroundPosition = `${px}% ${py}%`;
    lens.style.backgroundSize = `${r.width * 2.2}px ${r.height * 2.2}px`;
  }
  function show() { lens.classList.add("active"); container.querySelector("img").style.transform = "scale(1.08)"; }
  function hide() { lens.classList.remove("active"); container.querySelector("img").style.transform = ""; }

  container.addEventListener("mousemove", e => { show(); move(e.clientX, e.clientY); });
  container.addEventListener("mouseleave", hide);
  container.addEventListener("touchstart", e => { show(); const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
  container.addEventListener("touchmove", e => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
  container.addEventListener("touchend", hide);
}
document.querySelectorAll(".product-image").forEach(initZoom);

/* ===== سلايدر آراء العملاء ===== */
(() => {
  const track = $(".reviews-track");
  if (!track) return;
  let idx = 0, timer;
  const cards = track.children.length;
  function go(i) { idx = (i + cards) % cards; track.style.transform = `translateX(${idx * -100}%)`; }
  timer = setInterval(() => go(idx + 1), 4000);
  let sx = 0;
  track.addEventListener("touchstart", e => { sx = e.touches[0].clientX; clearInterval(timer); }, { passive: true });
  track.addEventListener("touchend", e => { const dx = e.changedTouches[0].clientX - sx; if (dx > 40) go(idx - 1); if (dx < -40) go(idx + 1); timer = setInterval(() => go(idx + 1), 4000); });
})();

/* ===== Modal الطلب ===== */
const modal = $("#order-modal");
let currentProduct = null;

document.querySelectorAll(".btn-order").forEach(btn => {
  btn.addEventListener("click", () => {
    currentProduct = { id: btn.dataset.id, title: btn.dataset.title, price: +btn.dataset.price };
    $("#order-product").textContent = `${currentProduct.title} — ${currentProduct.price} جنيه`;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  });
});
$("#order-close").addEventListener("click", () => { modal.classList.remove("open"); document.body.style.overflow = ""; });

/* محافظات + شحن */
const govSelect = $("#gov");
GOVS.forEach(g => { const o = document.createElement("option"); o.value = g; o.textContent = g; govSelect.appendChild(o); });
govSelect.addEventListener("change", () => { $("#shipping-display").textContent = `الشحن: ${SHIP[govSelect.value] ?? "-"} جنيه`; });

/* ===== التحقق الفوري ===== */
function setError(id, msg) { $(id).textContent = msg || ""; return !msg; }
$("#phone").addEventListener("input", e => setError("#phone-err", /^01[0125][0-9]{8}$/.test(e.target.value) ? "" : "رقم هاتف مصري غير صحيح (مثال: 01012345678)"));

/* ===== صورة البطاقة ===== */
let compressedCard = null;
$("#idcard").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return setError("#img-err", "ملف غير صالح");
  try {
    $("#img-progress").style.display = "block";
    const { base64, size } = await compressToBase64(file, p => { $("#img-progress-bar").style.width = p + "%"; });
    if (base64.length > 7_000_000) return setError("#img-err", "الصورة كبيرة جداً");
    compressedCard = { base64, size };
    $("#img-preview").src = base64;
    $("#img-preview").style.display = "block";
    setError("#img-err", "");
  } catch { setError("#img-err", "الصورة كبيرة جداً"); }
  $("#img-progress").style.display = "none";
});

/* ===== إرسال الطلب ===== */
$("#order-form").addEventListener("submit", async e => {
  e.preventDefault();
  const err = msg => setError("#form-err", msg);

  const last = +localStorage.getItem("lastOrderAt") || 0;
  if (Date.now() - last < 30_000) return err("يرجى الانتظار 30 ثانية قبل إرسال طلب آخر");

  const name = $("#name").value.trim();
  const phone = $("#phone").value.trim();
  const gov = govSelect.value;
  const address = $("#address").value.trim();
  const notes = $("#notes").value.trim();
  const size = $("#size").value;
  const qty = +$("#qty").value;

  if (name.length < 3) return err("الاسم يجب أن يكون 3 حروف على الأقل");
  if (!/^01[0125][0-9]{8}$/.test(phone)) return err("رقم الهاتف غير صحيح");
  if (!gov) return err("اختر المحافظة");
  if (address.length < 10) return err("العنوان التفصيلي قصير جداً (10 حروف على الأقل)");

  const btn = $("#order-submit"); btn.disabled = true; btn.textContent = "جاري الإرسال…";
  try {
    const { orderNumber, grandTotal } = await createOrder({
      name, phone, gov, address, notes,
      items: [{ productId: currentProduct.id, title: currentProduct.title, price: currentProduct.price, size, qty }],
      idCardBase64: compressedCard?.base64, idCardSize: compressedCard?.size
    });
    localStorage.setItem("myOrder", JSON.stringify({ orderNumber, phone }));
    localStorage.setItem("lastOrderAt", Date.now());
    showSuccess(orderNumber, grandTotal, name, phone);
  } catch (ex) {
    err("حدث خطأ أثناء الإرسال، حاول مرة أخرى");
  } finally { btn.disabled = false; btn.textContent = "تأكيد الطلب"; }
});

function showSuccess(orderNumber, grandTotal, name, phone) {
  modal.classList.remove("open");
  const box = $("#success-screen");
  box.classList.add("open");
  $("#success-num").textContent = `#${orderNumber}`;
  $("#success-total").textContent = `الإجمالي: ${grandTotal} جنيه`;
  $("#wa-success").href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`مرحباً، أنا ${name}. طلبي رقم #${orderNumber} بإجمالي ${grandTotal} جنيه.`)}`;
}

/* ===== تتبع الطلب (Banner) ===== */
const saved = JSON.parse(localStorage.getItem("myOrder") || "null");
if (saved) {
  trackOrder(saved.orderNumber, saved.phone, order => {
    if (!order) return;
    $("#track-banner").style.display = "block";
    $("#track-text").textContent = `طلبيق رقم #${order.orderNumber} — ${STATUS_AR[order.status]}`;
    renderTimeline(order.statusHistory);
  });
}
function renderTimeline(history) {
  const ul = $("#track-timeline");
  ul.textContent = "";
  const reached = new Set((history || []).map(h => h.status));
  STATUS_ORDER.filter(s => s !== "pending" && s !== "cancelled").forEach(s => {
    const li = document.createElement("li");
    li.textContent = STATUS_AR[s];
    if (reached.has(s)) li.classList.add("done");
    ul.appendChild(li);
  });
}
$("#lookup-btn").addEventListener("click", async () => {
  const num = prompt("أدخل رقم الطلب:");
  const ph = prompt("أدخل رقم الهاتف المسجل:");
  if (!num || !ph) return;
  const o = await lookupOrder(num, ph);
  alert(o ? `طلبيق رقم #${o.orderNumber} — ${STATUS_AR[o.status]}` : "لم نجد طلباً مطابقاً");
});

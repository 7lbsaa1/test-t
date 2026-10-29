const ALLOWED = ["/", "/index.html", "/admin", "/admin.html", "/about", "/about.html", "/contact", "/contact.html", "/404", "/404.html"];
const path = location.pathname;
if (!ALLOWED.includes(path)) {
  document.body.innerHTML = "";
  document.title = "404 — الصفحة غير موجودة";
  const div = document.createElement("div");
  div.style.cssText = "min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;color:#fff;font-family:'Cairo',sans-serif;gap:20px;text-align:center;padding:20px";
  const h = document.createElement("h1"); h.textContent = "404";
  h.style.cssText = "font-size:6rem;margin:0;color:#e11d48";
  const p = document.createElement("p"); p.textContent = "عذراً، الصفحة التي تبحث عنها غير موجودة";
  const a = document.createElement("a"); a.href = "/"; a.textContent = "العودة للرئيسية";
  a.style.cssText = "background:#e11d48;color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none";
  div.append(h, p, a); document.body.appendChild(div);
}

import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { rtdb } from "./firebase-config.js";
import { STATUS_AR } from "./orders.js";

export async function generateOrderPDF(order) {
  const { jsPDF } = await import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.mjs");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = 595;

  // شعار المتجر (نص مؤقت أو صورة إن وُجدت)
  doc.setFillColor(11, 15, 25);
  doc.rect(0, 0, W, 80, "F");
  doc.setTextColor(255); doc.setFontSize(26);
  doc.text("TeeStore", 30, 50);
  doc.setFontSize(12);
  doc.text(`Order #${order.orderNumber}`, W - 130, 50);

  doc.setTextColor(20); doc.setFontSize(13);
  let y = 120;
  const line = (l, v) => { doc.text(`${l}:`, 30, y); doc.text(String(v || "-"), 200, y); y += 22; };

  line("Date", new Date(order.createdAt?.toDate?.() || Date.now()).toLocaleString());
  line("Name", order.name);
  line("Phone", order.phone);
  line("Governorate", order.gov);
  line("Address", order.address);
  line("Notes", order.notes);

  y += 10;
  doc.setFontSize(12);
  doc.setFillColor(240, 240, 240);
  doc.rect(30, y - 10, W - 60, 24, "F");
  doc.text("Product", 40, y + 6); doc.text("Size", 300, y + 6); doc.text("Qty", 380, y + 6); doc.text("Price", 450, y + 6);
  y += 34;
  order.items?.forEach(it => {
    doc.text(String(it.title).substring(0, 40), 40, y);
    doc.text(it.size, 300, y);
    doc.text(String(it.qty), 380, y);
    doc.text(`${it.price * it.qty} EGP`, 450, y);
    y += 22;
  });
  y += 10;
  line("Shipping", `${order.shipping} EGP`);
  line("Grand Total", `${order.grandTotal} EGP`);
  line("Status", STATUS_AR[order.status] || order.status);

  // صورة البطاقة من RTDB
  if (order.idCardPath) {
    const snap = await get(ref(rtdb, order.idCardPath));
    if (snap.exists() && typeof snap.val() === "string") {
      try {
        doc.addPage();
        doc.setFontSize(14);
        doc.text("ID Card Image:", 30, 50);
        doc.addImage(snap.val(), "JPEG", 30, 70, 300, 190); // قابل للتكبير عبر نسبة العرض
      } catch (e) { console.warn("PDF image error", e); }
    }
  }
  doc.save(`order-${order.orderNumber}.pdf`);
}

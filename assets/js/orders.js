import { rtdb, db } from "./firebase-config.js";
import { ref, runTransaction, onValue, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { collection, addDoc, doc, onSnapshot, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const GOVS = ["القاهرة","الجيزة","الإسكندرية","القليوبية","الشرقية","الدقهلية","الغربية","المنوفية","البحيرة","كفر الشيخ","دمياط","بورسعيد","الإسماعيلية","السويس","شمال سيناء","جنوب سيناء","الفيوم","بني سويف","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","البحر الأحمر","مطروح","الوادي الجديد"];
export const SHIP = { "القاهرة":40, "الجيزة":45, "الإسكندرية":50, "القليوبية":45, "الشرقية":50, "الدقهلية":55, "الغربية":50, "المنوفية":50, "البحيرة":55, "كفر الشيخ":55, "دمياط":55, "بورسعيد":55, "الإسماعيلية":55, "السويس":60, "شمال سيناء":70, "جنوب سيناء":70, "الفيوم":60, "بني سويف":60, "المنيا":65, "أسيوط":65, "سوهاج":70, "قنا":70, "الأقصر":75, "أسوان":80, "البحر الأحمر":80, "مطروح":80, "الوادي الجديد":85 };

export const STATUS_ORDER = ["pending","confirmed","preparing","ready","shipped","delivered","cancelled"];
export const STATUS_AR = {
  pending: "بانتظار التأكيد", confirmed: "تم التأكيد ✅", preparing: "جاري التجهيز",
  ready: "جاهز للشحن", shipped: "تم الشحن 🚚", delivered: "تم التوصيل 🎉", cancelled: "ملغي ❌"
};

/** زيادة ذرية للعداد في RTDB */
async function nextOrderNumber() {
  const counterRef = ref(rtdb, "counters/orderNumber");
  const snap = await runTransaction(counterRef, cur => (cur === null ? 1001 : cur + 1));
  return snap.snapshot.val();
}

/** إرسال الطلب: RTDB transaction → Firestore */
export async function createOrder({ name, phone, gov, address, notes, items, idCardPath, idCardUploaded, idCardBase64, idCardSize }) {
  const orderNumber = await nextOrderNumber();
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = SHIP[gov] ?? 50;
  const grandTotal = total + shipping;

  // الصورة في RTDB (وليس Firestore)
  if (idCardBase64) {
    await set(ref(rtdb, `order_images/${orderNumber}/idCard`), idCardBase64);
  }

  const orderData = {
    orderNumber, name, phone, gov, address, notes: notes || "",
    items, total, shipping, grandTotal,
    status: "pending",
    statusHistory: [{ status: "pending", at: Date.now(), by: "customer" }],
    idCardPath: idCardBase64 ? `order_images/${orderNumber}/idCard` : "",
    idCardUploaded: !!idCardBase64,
    idCardSize: idCardSize || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const refDoc = await addDoc(collection(db, "orders"), orderData);
  return { orderNumber, grandTotal, docId: refDoc.id };
}

/** تتبع فوري بـ onSnapshot حسب رقم الطلب */
export function trackOrder(orderNumber, phone, cb) {
  const q = query(collection(db, "orders"), where("orderNumber", "==", Number(orderNumber)));
  return onSnapshot(q, snap => {
    if (snap.empty) return cb(null);
    const d = snap.docs[0].data();
    if (String(d.phone) !== String(phone)) return cb(null); // تحقق مطابقة الهاتف
    cb(d);
  });
}

/** استعلام يدوي برقم الطلب + الهاتف */
export async function lookupOrder(orderNumber, phone) {
  const q = query(collection(db, "orders"), where("orderNumber", "==", Number(orderNumber)));
  const snap = await get(query(q));
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return String(d.phone) === String(phone) ? d : null;
}

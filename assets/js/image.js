const MAX_DIM = 900, TARGET_KB = 180;

function readAsImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("صورة غير صالحة")); };
    img.src = url;
  });
}

/** يضغط الصورة عبر Canvas: أقصى بُعد 900px، ويقلل الجودة تدريجياً حتى < 180KB */
export async function compressToBase64(file, onProgress = () => {}) {
  const img = await readAsImage(file);
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  let quality = 0.72, blob;
  while (true) {
    blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", quality));
    onProgress(Math.min(90, Math.round((0.72 - quality + 0.08) / 0.8 * 100)));
    if (!blob) throw new Error("فشل ضغط الصورة");
    if (blob.size < TARGET_KB * 1024 || quality <= 0.12) break;
    quality -= 0.08;
  }
  const base64 = await new Promise(r => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result);
    fr.readAsDataURL(blob);
  });
  onProgress(100);
  return { base64, size: blob.size };
}

export async function compressToBase64(file, { maxSide = 900, maxKB = 180 } = {}) {
  if (!file.type.startsWith('image/')) throw new Error('الملف ليس صورة');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);

  let q = 0.72, dataUrl = canvas.toDataURL('image/jpeg', q);
  while (dataUrl.length * 0.75 > maxKB * 1024 && q > 0.35) {
    q -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', q);
  }
  if (dataUrl.length * 0.75 > maxKB * 1024) throw new Error('الصورة كبيرة جداً');
  return dataUrl; // data:image/jpeg;base64,....
}

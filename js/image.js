/**
 * 图片处理：读文件、等比压缩
 *
 * 压缩策略：限制最长边；不含透明通道时转 JPEG（体积小得多），
 * 含透明通道时保留 PNG，避免白底把封面吃出硬边。
 */

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}

export function optimizeImage(dataUrl, maxDim) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        let out = c.toDataURL('image/png');
        try {
          const data = ctx.getImageData(0, 0, w, h).data;
          let hasAlpha = false;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) { hasAlpha = true; break; }
          }
          if (!hasAlpha) out = c.toDataURL('image/jpeg', 0.92);
        } catch (e) { /* 跨域等场景保留 PNG */ }
        resolve(out);
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** 文件 → 压缩后的 dataURL */
export async function fileToOptimizedDataUrl(file, maxDim) {
  const raw = await readFileAsDataURL(file);
  return optimizeImage(raw, maxDim);
}

export const COVER_MAX_DIM = 1000;
export const BANNER_MAX_DIM = 1600;

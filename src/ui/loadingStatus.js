// Transfer totals may describe compressed bytes while loaded describes decoded
// bytes. Never show an impossible percentage or confuse transfer with parsing.
export function loadingStatus(label, { loaded, total }) {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(loaded)) return `載入 ${label} 與貼圖…`;
  if (loaded >= total) return `處理 ${label} 與貼圖…`;
  const percent = Math.max(0, Math.min(100, Math.floor(loaded / total * 100)));
  return `下載 ${label}… ${percent}%`;
}

/**
 * Export via Web Share API (system sheet: Drive, Files, Mail…). No OAuth or API keys.
 * Falls back to programmatic download when sharing files is not supported.
 */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * @param {File[]} files
 * @param {{ title?: string }} [opts]
 * @returns {'shared' | 'downloaded'} outcome
 */
export async function shareFilesOrDownloadFirst(files, opts = {}) {
  if (!files.length) {
    throw new Error('Aucun fichier à partager');
  }
  const sharePayload = { files, title: opts.title };
  try {
    if (navigator.share && navigator.canShare?.(sharePayload)) {
      await navigator.share(sharePayload);
      return 'shared';
    }
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw e;
    }
    console.warn('navigator.share failed:', e);
  }
  const first = files[0];
  downloadBlob(first, first.name);
  return 'downloaded';
}

export { downloadBlob };

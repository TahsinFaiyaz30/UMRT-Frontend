export function hasWebGLSupport() {
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
      ?? canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true });
    if (!context) return false;
    const extension = context.getExtension('WEBGL_lose_context');
    extension?.loseContext();
    return true;
  } catch {
    return false;
  }
}

import { WebGLRenderTarget, type Camera, type Material, type Object3D, type Scene, type WebGLRenderer } from 'three';

const PREPARATION_TIMEOUT_MS = 9000;
const POLL_INTERVAL_MS = 16;

type CompiledProgram = { program?: WebGLProgram };
type MaterialPrograms = {
  currentProgram?: CompiledProgram;
  programs?: Map<string, CompiledProgram>;
};

function aborted() {
  return new DOMException('Space shader preparation was cancelled.', 'AbortError');
}

/**
 * Own every timer and listener while prewarming a single encounter. Three r175's
 * compileAsync has an uncancellable internal polling loop, so a Promise.race
 * timeout around it cannot safely retire materials or a lost WebGL context.
 */
export async function prepareEncounterShaders(
  renderer: WebGLRenderer,
  object: Object3D,
  camera: Camera,
  scene: Scene,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) throw aborted();
  const context = renderer.getContext();
  if (context.isContextLost()) throw new Error('WebGL context was lost during space shader preparation.');

  // Compile the composer's linear-framebuffer variant. This temporary target
  // is released immediately; the program does not depend on its attachments.
  const target = new WebGLRenderTarget(1, 1, { depthBuffer: false });
  const previousTarget = renderer.getRenderTarget();
  let materials: Set<Material>;
  try {
    try {
      renderer.setRenderTarget(target);
      materials = renderer.compile(object, camera, scene);
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
  } finally {
    target.dispose();
  }

  if (signal.aborted) throw aborted();
  if (context.isContextLost()) throw new Error('WebGL context was lost during space shader preparation.');
  const parallel = context.getExtension('KHR_parallel_shader_compile');
  // Without this extension, normal first use performs the driver sync. Do not
  // repeatedly query LINK_STATUS and turn optional prewarming into a stall.
  if (!parallel) return;

  const programs = new Set<WebGLProgram>();
  for (const material of materials) {
    // Guarded Three r175 internal metadata: public compile() returns materials,
    // while their native programs live here. If a future renderer changes this
    // shape, ordinary first-draw compilation remains the safe fallback.
    const properties = renderer.properties.get(material) as MaterialPrograms | undefined;
    if (properties?.currentProgram?.program) programs.add(properties.currentProgram.program);
    // Transparent double-sided materials can own separate front/back programs.
    if (properties?.programs instanceof Map) {
      for (const program of properties.programs.values()) {
        if (program?.program) programs.add(program.program);
      }
    }
  }
  if (programs.size === 0) return;

  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const deadline = Date.now() + PREPARATION_TIMEOUT_MS;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      programs.clear();
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => finish(aborted());
    const onContextLost = () => finish(new Error('WebGL context was lost during space shader preparation.'));
    const poll = () => {
      if (signal.aborted) { onAbort(); return; }
      if (context.isContextLost()) { onContextLost(); return; }
      // A cold or stalled driver may use ordinary first-draw compilation, but
      // the watchdog must leave no hidden poller retaining the old encounter.
      if (Date.now() >= deadline) { finish(); return; }
      try {
        for (const program of programs) {
          if (!context.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) continue;
          if (!context.getProgramParameter(program, context.LINK_STATUS)) {
            const details = context.getAttachedShaders?.(program)?.map((shader) => context.getShaderInfoLog(shader)).filter(Boolean).join('\n');
            finish(new Error(`Space shader failed to link: ${details || context.getProgramInfoLog(program) || 'unknown driver error'}`));
            return;
          }
          programs.delete(program);
        }
        if (programs.size === 0) finish();
        else timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (error) {
        finish(error);
      }
    };
    signal.addEventListener('abort', onAbort, { once: true });
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, { once: true });
    poll();
  });
}

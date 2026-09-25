/**
 * Run with: node scripts/test-team-space.cjs
 * These pure lifecycle/path tests need neither a browser nor a WebGL context.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const typescript = require('typescript');
const THREE = require('three');

const previousTsLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  const result = typescript.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};
let EncounterStream;
let createEncounter;
let seededRandom;
let encounterClearance;
let sampleFlightPose;
let cameraTravelDistance;
let encounterWorldDistance, travelWorldDistance, encounterPrefetch, openingPairReady;
let SECTOR_LENGTH;
let ENCOUNTER_OFFSET;
let createEncounterObject;
let prepareEncounterShaders;
let createOrbitalMotion;
let getSolarSystemBody;
let SOLAR_SYSTEM_BODIES;
try {
  const space = path.resolve(__dirname, '../components/team/space');
  ({ EncounterStream } = require(path.join(space, 'encounterStream.ts')));
  ({ createEncounter, seededRandom, encounterClearance } = require(path.join(space, 'encounterCatalog.ts')));
  ({ sampleFlightPose, cameraTravelDistance } = require(path.join(space, 'spaceFlightState.ts')));
  ({ encounterWorldDistance, travelWorldDistance, encounterPrefetch, openingPairReady } = require(path.join(space, 'encounterPresentation.ts')));
  ({ SECTOR_LENGTH, ENCOUNTER_OFFSET } = require(path.join(space, 'spaceTypes.ts')));
  ({ createEncounterObject } = require(path.join(space, 'encounterObjects.ts')));
  ({ prepareEncounterShaders } = require(path.join(space, 'shaderPreparation.ts')));
  ({ createOrbitalMotion, getSolarSystemBody, SOLAR_SYSTEM_BODIES } = require(path.join(space, 'orbitalMotion.ts')));
} finally {
  if (previousTsLoader) require.extensions['.ts'] = previousTsLoader;
  else delete require.extensions['.ts'];
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function harness(options = {}) {
  const jobs = [];
  const preparations = [];
  const resources = [];
  const creates = [];
  const errors = [];
  const mounted = [];
  const unmounted = [];
  const attached = new Set();
  let now = 0;
  let active = 0;
  let peakActive = 0;
  let changes = 0;
  let createFailures = options.createFailures ?? 0;
  let mountFailures = options.mountFailures ?? 0;
  let changeFailures = options.changeFailures ?? 0;
  const stream = new EncounterStream({
    create(index) {
      creates.push(index);
      if (createFailures > 0) {
        createFailures--;
        throw new Error('creation failed');
      }
      const resource = {
        index,
        disposals: 0,
        dispose() { this.disposals++; },
      };
      resources.push(resource);
      return resource;
    },
    prepare(resource) {
      active++;
      peakActive = Math.max(peakActive, active);
      let resolve;
      let reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      preparations.push({ resource, resolve, reject, settled: false });
      return promise.finally(() => { active--; });
    },
    mount(resource, index) {
      assert.equal(resource.disposals, 0, 'never mount a disposed resource');
      attached.add(resource);
      mounted.push(index);
      if (mountFailures > 0) {
        mountFailures--;
        throw new Error('mount failed after attaching');
      }
    },
    unmount(resource) {
      attached.delete(resource);
      unmounted.push(resource.index);
    },
    schedule(work) {
      const job = { work, cancelled: false };
      jobs.push(job);
      return () => { job.cancelled = true; };
    },
    changed() {
      changes++;
      if (changeFailures > 0) {
        changeFailures--;
        throw new Error('notification failed');
      }
    },
    error(error) { errors.push(error); },
    now: () => now,
  });
  const h = {
    stream, resources, creates, errors, mounted, unmounted, attached,
    get active() { return active; },
    get peakActive() { return peakActive; },
    get changes() { return changes; },
    get queued() { return jobs.filter((job) => !job.cancelled).length; },
    setTime(time) { now = time; },
    runNext() {
      while (jobs.length) {
        const job = jobs.shift();
        if (!job.cancelled) { job.work(); return true; }
      }
      return false;
    },
    settle(index, failure = false) {
      const pending = preparations.find((item) => !item.settled && item.resource.index === index);
      assert.ok(pending, `expected a pending preparation for ${index}`);
      pending.settled = true;
      if (failure) pending.reject(new Error('GPU preparation failed'));
      else pending.resolve();
    },
    async complete(index, failure = false) {
      assert.ok(h.runNext(), `expected an idle job for ${index}`);
      await flush();
      h.settle(index, failure);
      await flush();
    },
    async cleanup() {
      stream.dispose();
      for (const pending of preparations) {
        if (!pending.settled) { pending.settled = true; pending.resolve(); }
      }
      await flush();
      assert.equal(attached.size, 0, 'cleanup detaches every mounted object');
      assert.ok(resources.every((resource) => resource.disposals === 1), 'each created resource is disposed exactly once');
    },
  };
  return h;
}

test('preparation stays serial despite repeated requests and mounts in priority order', async (t) => {
  const h = harness();
  t.after(() => h.cleanup());
  h.stream.update([4, 5, 6], [4, 5, 6]);
  assert.equal(h.queued, 1);
  h.runNext();
  await flush();
  for (let i = 0; i < 100; i++) h.stream.update([4, 5, 6], [4, 5, 6]);
  assert.deepEqual(h.creates, [4]);
  assert.equal(h.active, 1);
  assert.equal(h.queued, 0);
  h.settle(4);
  await flush();
  await h.complete(5);
  await h.complete(6);
  assert.deepEqual(h.mounted, [4, 5, 6]);
  assert.equal(h.peakActive, 1);
  assert.equal(h.queued, 0);
  assert.equal(h.stream.live.size, 3);
});

test('changing direction before an idle task starts does not create the stale object', async (t) => {
  const h = harness();
  t.after(() => h.cleanup());
  h.stream.update([10, 11], [9, 10, 11]);
  h.stream.update([2, 1], [1, 2, 3]);
  h.runNext();
  assert.deepEqual(h.creates, []);
  await h.complete(2);
  await h.complete(1);
  assert.deepEqual(h.mounted, [2, 1]);
});

test('jumping and reversing during preparation discards stale results without mounting them', async (t) => {
  const h = harness();
  t.after(() => h.cleanup());
  h.stream.update([10], [9, 10, 11]);
  h.runNext();
  await flush();
  h.stream.update([0], [0, 1]);
  h.settle(10);
  await flush();
  assert.equal(h.resources[0].disposals, 1);
  assert.deepEqual(h.mounted, []);
  h.runNext();
  await flush();
  h.stream.update([100], [99, 100, 101]);
  h.settle(0, true);
  await flush();
  assert.equal(h.resources[1].disposals, 1);
  await h.complete(100);
  h.stream.update([99, 100], [98, 99, 100]);
  await h.complete(99);
  assert.deepEqual(h.mounted, [100, 99]);
  assert.deepEqual([...h.stream.live.keys()], [100, 99]);
  assert.equal(h.peakActive, 1);
  assert.equal(h.stream.exhausted.size, 0);
});

test('resident cache stays bounded over forward travel and retains objects needed for reverse travel', async (t) => {
  const h = harness();
  t.after(() => h.cleanup());
  for (let sector = 1; sector <= 60; sector++) {
    const window = [sector - 1, sector, sector + 1];
    h.stream.update([sector, sector + 1, sector - 1], window);
    while (h.queued) {
      h.runNext();
      await flush();
      const pending = h.resources.find((resource) => !resource.disposals && !h.stream.live.has(resource.index));
      assert.ok(pending);
      h.settle(pending.index);
      await flush();
      assert.ok(h.stream.live.size <= 3);
    }
    assert.deepEqual([...h.stream.live.keys()].sort((a, b) => a - b), window);
    const count = h.creates.length;
    h.stream.update([sector - 1], window);
    assert.equal(h.queued, 0, 'reverse travel reuses the retained predecessor');
    assert.equal(h.creates.length, count);
  }
  assert.equal(h.peakActive, 1);
  assert.ok(h.resources.filter((resource) => resource.disposals === 0).length <= 3);
});

test('dispose cancels queued work and is idempotent', async () => {
  const h = harness();
  h.stream.update([0], [0]);
  h.stream.dispose();
  h.stream.dispose();
  assert.equal(h.runNext(), false);
  h.stream.update([1], [1]);
  assert.equal(h.queued, 0);
  assert.deepEqual(h.creates, []);
  await h.cleanup();
});

test('dispose waits for an in-flight preparation before releasing its resource', async () => {
  const h = harness();
  h.stream.update([0, 1], [0, 1]);
  h.runNext();
  await flush();
  h.stream.dispose();
  assert.equal(h.resources[0].disposals, 0, 'GPU preparation still owns this resource');
  h.settle(0);
  await flush();
  assert.equal(h.resources[0].disposals, 1);
  assert.deepEqual(h.mounted, []);
  assert.equal(h.changes, 0);
  assert.equal(h.queued, 0);
  await h.cleanup();
});

test('a rejected preparation after dispose is cleaned up without restarting or reporting stale errors', async () => {
  const h = harness();
  h.stream.update([0, 1], [0, 1]);
  h.runNext();
  await flush();
  h.stream.dispose();
  h.settle(0, true);
  await flush();
  assert.equal(h.resources[0].disposals, 1);
  assert.equal(h.errors.length, 0);
  assert.equal(h.queued, 0);
  await h.cleanup();
});

test('GPU failures back off, allow other jobs, exhaust after three attempts, and reset on eviction', async (t) => {
  const h = harness();
  t.after(() => h.cleanup());
  h.stream.update([0, 1], [0, 1]);
  await h.complete(0, true);
  await h.complete(1);
  h.setTime(499);
  h.stream.update([0, 1], [0, 1]);
  assert.equal(h.queued, 0);
  h.setTime(500);
  h.stream.update([0, 1], [0, 1]);
  await h.complete(0, true);
  h.setTime(1499);
  h.stream.update([0, 1], [0, 1]);
  assert.equal(h.queued, 0);
  h.setTime(1500);
  h.stream.update([0, 1], [0, 1]);
  await h.complete(0, true);
  assert.deepEqual([...h.stream.exhausted], [0]);
  assert.equal(h.errors.length, 3);
  h.setTime(100_000);
  for (let i = 0; i < 100; i++) h.stream.update([0, 1], [0, 1]);
  assert.equal(h.queued, 0, 'exhausted sectors cannot create a retry storm');
  assert.deepEqual(h.creates, [0, 1, 0, 0]);
  h.stream.update([1], [1]);
  assert.equal(h.stream.exhausted.size, 0);
  h.stream.update([0, 1], [0, 1]);
  await h.complete(0);
  assert.deepEqual([...h.stream.live.keys()], [1, 0]);
});

test('synchronous creation failures use the same retry budget and do not block later jobs', async (t) => {
  const h = harness({ createFailures: 1 });
  t.after(() => h.cleanup());
  h.stream.update([3, 4], [3, 4]);
  h.runNext();
  assert.equal(h.errors.length, 1);
  assert.equal(h.resources.length, 0);
  await h.complete(4);
  h.setTime(500);
  h.stream.update([3, 4], [3, 4]);
  await h.complete(3);
  assert.deepEqual(h.mounted, [4, 3]);
  assert.equal(h.peakActive, 1);
});

test('mount and notification failures roll back the live cache and attached object before retrying', async () => {
  for (const options of [{ mountFailures: 1 }, { changeFailures: 1 }]) {
    const h = harness(options);
    try {
      h.stream.update([0], [0]);
      await h.complete(0);
      assert.equal(h.stream.live.size, 0);
      assert.equal(h.attached.size, 0);
      assert.equal(h.resources[0].disposals, 1);
      assert.deepEqual(h.unmounted, [0]);
      h.setTime(500);
      h.stream.update([0], [0]);
      await h.complete(0);
      assert.equal(h.stream.live.size, 1);
      assert.equal(h.attached.size, 1);
    } finally {
      await h.cleanup();
    }
  }
});

test('catalog random access is deterministic, independent of call order, and returns independent objects', () => {
  const indices = [0, 1, 27, 8192, 1_000_003, 2 ** 32 + 7, 2 ** 40 + 7];
  const expected = new Map(indices.map((index) => [index, createEncounter(index)]));
  for (const index of [...indices].reverse()) assert.deepEqual(createEncounter(index), expected.get(index));
  const first = createEncounter(27);
  first.palette[0] = '#000000';
  first.position[0] = -999;
  assert.deepEqual(createEncounter(27), expected.get(27));
  assert.deepEqual(createEncounter(2.99), createEncounter(2));
  for (const invalid of [-1, NaN, Infinity, -Infinity]) assert.deepEqual(createEncounter(invalid), createEncounter(0));
});

test('long sector indices do not wrap at 32 bits and positions preserve adjacent sector spacing', () => {
  const largestExactIndex = Math.floor((Number.MAX_SAFE_INTEGER - ENCOUNTER_OFFSET) / SECTOR_LENGTH) - 1;
  const indices = [7, 2 ** 32 + 7, 2 ** 40 + 7, largestExactIndex];
  const descriptors = indices.map(createEncounter);
  assert.equal(new Set(descriptors.map((value) => value.seed)).size, indices.length);
  for (const descriptor of descriptors) {
    assert.ok(Number.isSafeInteger(-descriptor.position[2]));
    const next = createEncounter(descriptor.index + 1);
    assert.equal(descriptor.position[2] - next.position[2], SECTOR_LENGTH);
    assert.deepEqual(createEncounter(descriptor.index), descriptor);
  }
});

test('catalog covers only supported scientific classes with valid geometry and deterministic randomness', () => {
  const kinds = new Set(['terrestrial', 'airless', 'gas-giant', 'ice-giant', 'asteroid', 'comet', 'star', 'black-hole']);
  const seen = new Set();
  for (let index = 0; index < 2048; index++) {
    const descriptor = createEncounter(index);
    assert.ok(kinds.has(descriptor.kind));
    seen.add(descriptor.kind);
    assert.ok(Number.isFinite(descriptor.radius) && descriptor.radius > 0);
    assert.ok(descriptor.position.every(Number.isFinite));
    assert.ok(descriptor.palette.every((color) => /^#[0-9a-f]{6}$/i.test(color)));
    assert.ok(encounterClearance(descriptor) > descriptor.radius);
    if (descriptor.rings) assert.ok(['gas-giant', 'ice-giant'].includes(descriptor.kind));
    if (descriptor.kind === 'airless' && descriptor.solarBodyId !== 'pluto') assert.equal(descriptor.atmosphere, null);
  }
  assert.deepEqual(seen, kinds);
  const a = seededRandom(0x12345678);
  const b = seededRandom(0x12345678);
  for (let i = 0; i < 500; i++) {
    const value = a();
    assert.ok(value >= 0 && value < 1);
    assert.equal(value, b());
  }
});

test('flight path clears every encounter volume, including rings and black-hole raymarch bounds', () => {
  const pose = { x: 0, y: 0, yaw: 0, pitch: 0 };
  for (let index = 0; index < 512; index++) {
    const descriptor = createEncounter(index);
    const center = -descriptor.position[2];
    const clearance = encounterClearance(descriptor);
    for (let offset = -1300; offset <= 1300; offset += 10) {
      const distance = center + offset;
      assert.equal(sampleFlightPose(distance, descriptor, pose), pose, 'render loop output is reused');
      const separation = Math.hypot(pose.x - descriptor.position[0], pose.y - descriptor.position[1], offset);
      assert.ok(separation >= clearance, `sector ${index} (${descriptor.kind}) clearance ${separation} < ${clearance}`);
      assert.ok(Object.values(pose).every(Number.isFinite));
    }
  }
});

test('flight position and gaze remain continuous when the nearest encounter changes', () => {
  const before = { x: 0, y: 0, yaw: 0, pitch: 0 };
  const after = { x: 0, y: 0, yaw: 0, pitch: 0 };
  for (let index = 0; index < 512; index++) {
    const current = createEncounter(index);
    const next = createEncounter(index + 1);
    const midpoint = (-current.position[2] - next.position[2]) / 2;
    sampleFlightPose(midpoint - 0.001, current, before);
    sampleFlightPose(midpoint + 0.001, next, after);
    for (const key of ['x', 'y', 'yaw', 'pitch']) {
      assert.ok(Math.abs(before[key] - after[key]) < 0.001, `discontinuous ${key} between sectors ${index}/${index + 1}`);
    }
  }
});

class TrackedTarget extends EventTarget {
  listeners = new Map();
  addEventListener(type, callback, options) {
    super.addEventListener(type, callback, options);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback, options) {
    super.removeEventListener(type, callback, options);
    this.listeners.get(type)?.delete(callback);
  }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, value) => sum + value.size, 0); }
}

function shaderHarness(options = {}) {
  const signal = new TrackedTarget();
  signal.aborted = options.aborted ?? false;
  const domElement = new TrackedTarget();
  const programs = [{ name: 'front' }, { name: 'back' }];
  const material = new THREE.ShaderMaterial();
  const ready = new Set();
  const linkQueries = [];
  const targets = [];
  let compileCalls = 0;
  let targetDisposals = 0;
  let contextLost = false;
  let currentTarget = null;
  const context = {
    LINK_STATUS: 0x8b82,
    isContextLost: () => contextLost,
    getExtension: () => options.parallel === false ? null : { COMPLETION_STATUS_KHR: 0x91b1 },
    getProgramParameter(program, kind) {
      if (kind === 0x91b1) return ready.has(program);
      assert.equal(kind, this.LINK_STATUS);
      assert.ok(ready.has(program), 'never force link synchronization before KHR completion');
      linkQueries.push(program);
      return options.linked !== false;
    },
    getProgramInfoLog: () => 'simulated link failure',
  };
  const renderer = {
    domElement,
    properties: { get: () => ({
      currentProgram: { program: programs[0] },
      programs: new Map(programs.map((program) => [program.name, { program }])),
    }) },
    getContext: () => context,
    getRenderTarget: () => currentTarget,
    setRenderTarget(target) {
      currentTarget = target;
      targets.push(target);
      if (target) target.addEventListener('dispose', () => { targetDisposals++; });
    },
    compile() {
      compileCalls++;
      if (options.compileThrows) throw new Error('simulated compiler setup failure');
      return new Set([material]);
    },
  };
  return {
    signal, domElement, programs, ready, linkQueries,
    get compileCalls() { return compileCalls; },
    get targetDisposals() { return targetDisposals; },
    get currentTarget() { return currentTarget; },
    prepare: () => prepareEncounterShaders(renderer, new THREE.Group(), new THREE.PerspectiveCamera(), new THREE.Scene(), signal),
    abort() { signal.aborted = true; signal.dispatchEvent(new Event('abort')); },
    loseContext() { contextLost = true; domElement.dispatchEvent(new Event('webglcontextlost')); },
    assertClean() {
      assert.equal(signal.listenerCount, 0);
      assert.equal(domElement.listenerCount, 0);
      assert.equal(currentTarget, null);
      material.dispose();
    },
  };
}

function fakeClock(t) {
  let now = 0;
  let id = 0;
  const tasks = new Map();
  t.mock.method(Date, 'now', () => now);
  t.mock.method(global, 'setTimeout', (work, delay = 0) => {
    const handle = ++id;
    tasks.set(handle, { work, when: now + delay });
    return handle;
  });
  t.mock.method(global, 'clearTimeout', (handle) => tasks.delete(handle));
  return {
    get pending() { return tasks.size; },
    advance(milliseconds) {
      const until = now + milliseconds;
      while (true) {
        const next = [...tasks.entries()].sort((a, b) => a[1].when - b[1].when)[0];
        if (!next || next[1].when > until) break;
        tasks.delete(next[0]);
        now = next[1].when;
        next[1].work();
      }
      now = until;
    },
  };
}

test('shader prewarming polls both face programs without early driver sync and releases all polling state', async (t) => {
  const clock = fakeClock(t);
  const h = shaderHarness();
  const prepared = h.prepare();
  assert.equal(h.compileCalls, 1);
  assert.equal(h.targetDisposals, 1, 'warmup framebuffer is released before awaiting the GPU');
  assert.equal(h.currentTarget, null);
  assert.equal(clock.pending, 1);
  assert.equal(h.linkQueries.length, 0);
  h.ready.add(h.programs[0]);
  clock.advance(16);
  assert.deepEqual(h.linkQueries, [h.programs[0]]);
  assert.equal(clock.pending, 1);
  h.ready.add(h.programs[1]);
  clock.advance(16);
  await prepared;
  assert.equal(clock.pending, 0);
  assert.equal(h.linkQueries.length, 2);
  h.assertClean();
});

test('shader prewarming abort removes its timer and listeners immediately', async (t) => {
  const clock = fakeClock(t);
  const h = shaderHarness();
  const prepared = h.prepare();
  const rejected = assert.rejects(prepared, { name: 'AbortError' });
  h.abort();
  await rejected;
  assert.equal(clock.pending, 0);
  clock.advance(20_000);
  assert.equal(h.linkQueries.length, 0);
  h.assertClean();
});

test('context loss rejects prewarming and cannot leave a timer reading disposed programs', async (t) => {
  const clock = fakeClock(t);
  const h = shaderHarness();
  const rejected = assert.rejects(h.prepare(), /context was lost/);
  h.loseContext();
  await rejected;
  assert.equal(clock.pending, 0);
  h.assertClean();
});

test('shader watchdog falls back to normal drawing without retaining a poller', async (t) => {
  const clock = fakeClock(t);
  const h = shaderHarness();
  const prepared = h.prepare();
  clock.advance(9016);
  await prepared;
  assert.equal(clock.pending, 0);
  assert.equal(h.linkQueries.length, 0);
  h.assertClean();
});

test('shader link and setup failures release all owned state', async (t) => {
  const clock = fakeClock(t);
  const h = shaderHarness({ linked: false });
  h.ready.add(h.programs[0]);
  await assert.rejects(h.prepare(), /simulated link failure/);
  assert.equal(clock.pending, 0);
  h.assertClean();
  const failedSetup = shaderHarness({ compileThrows: true });
  await assert.rejects(failedSetup.prepare(), /compiler setup failure/);
  assert.equal(failedSetup.targetDisposals, 1);
  failedSetup.assertClean();
});

test('prewarming can skip unavailable parallel support and honors an already aborted signal', async (t) => {
  const clock = fakeClock(t);
  const noExtension = shaderHarness({ parallel: false });
  await noExtension.prepare();
  assert.equal(clock.pending, 0);
  assert.equal(noExtension.linkQueries.length, 0);
  noExtension.assertClean();
  const aborted = shaderHarness({ aborted: true });
  await assert.rejects(aborted.prepare(), { name: 'AbortError' });
  assert.equal(aborted.compileCalls, 0);
  assert.equal(aborted.targetDisposals, 0);
  aborted.assertClean();
});

function resourceInventory(object) {
  const geometries = new Set();
  const materials = new Set();
  const instances = new Set();
  object.group.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    if (child.material) {
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
    }
    if (child instanceof THREE.InstancedMesh) instances.add(child);
  });
  return { geometries, materials, instances };
}

function observeDisposals(resources) {
  const counts = new Map();
  for (const resource of resources) {
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  return counts;
}

function findEncounter(predicate) {
  for (let i = 0; i < 2048; i++) {
    const encounter = createEncounter(i);
    if (predicate(encounter)) return encounter;
  }
  throw new Error('No matching encounter in deterministic sample');
}

test('all encounter factories dispose owned geometry, materials and instance buffers exactly once', () => {
  const kinds = ['terrestrial', 'airless', 'gas-giant', 'ice-giant', 'asteroid', 'comet', 'star', 'black-hole'];
  for (const kind of kinds) {
    const object = createEncounterObject(findEncounter((value) => value.kind === kind));
    const scene = new THREE.Scene();
    scene.add(object.group);
    const inventory = resourceInventory(object);
    const counts = observeDisposals(new Set([...inventory.geometries, ...inventory.materials, ...inventory.instances]));
    try {
      object.update(123, 1 / 60);
      object.dispose();
      object.dispose();
      object.update(456, 1 / 60);
      assert.equal(object.group.parent, null);
      assert.equal(object.group.children.length, 0);
      for (const count of counts.values()) assert.equal(count, 1, `double disposal or leak for ${kind}`);
    } finally {
      object.dispose();
    }
  }
});

test('pooled geometry survives overlapping encounter lifetimes and is retired after its final borrower', () => {
  const descriptor = findEncounter((value) => !value.solarBodyId && value.kind === 'gas-giant' && value.rings);
  const a = createEncounterObject(descriptor);
  const b = createEncounterObject({ ...descriptor, index: descriptor.index + 1000 });
  let c;
  let fresh;
  try {
    const aInventory = resourceInventory(a);
    const bInventory = resourceInventory(b);
    assert.deepEqual(aInventory.geometries, bInventory.geometries, 'overlapping instances reuse the same smooth meshes');
    const counts = observeDisposals(aInventory.geometries);
    a.dispose();
    for (const count of counts.values()) assert.equal(count, 0, 'first borrower cannot invalidate another body');
    c = createEncounterObject({ ...descriptor, index: descriptor.index + 2000 });
    assert.deepEqual(resourceInventory(c).geometries, bInventory.geometries);
    b.dispose();
    for (const count of counts.values()) assert.equal(count, 0);
    c.dispose();
    for (const count of counts.values()) assert.equal(count, 1, 'last borrower releases pooled GPU geometry');
    fresh = createEncounterObject(descriptor);
    for (const geometry of resourceInventory(fresh).geometries) {
      assert.ok(!aInventory.geometries.has(geometry), 'retired pool entries must not be reused');
    }
  } finally {
    a.dispose(); b.dispose(); c?.dispose(); fresh?.dispose();
  }
});

test('five thousand sectors prune cache and failure history without retaining prior resources', async () => {
  let scheduled;
  let now = 0;
  let created = 0;
  let disposed = 0;
  let peakResident = 0;
  let peakOutstanding = 0;
  const outstanding = new Set();
  const stream = new EncounterStream({
    create(index) {
      if (index % 31 === 0) throw new Error('periodic simulated allocation failure');
      const resource = {
        index, disposed: false,
        dispose() {
          assert.equal(this.disposed, false, 'each allocation is retired once');
          this.disposed = true;
          outstanding.delete(this);
          disposed++;
        },
      };
      created++;
      outstanding.add(resource);
      peakOutstanding = Math.max(peakOutstanding, outstanding.size);
      return resource;
    },
    prepare: () => Promise.resolve(),
    mount() {}, unmount() {}, changed() {}, error() {},
    schedule(work) {
      assert.equal(scheduled, undefined, 'only one queued idle task may own generation');
      scheduled = work;
      return () => { if (scheduled === work) scheduled = undefined; };
    },
    now: () => now,
  });
  try {
    for (let sector = 1; sector <= 5000; sector++) {
      now = sector * 2000;
      const retained = [sector - 1, sector, sector + 1];
      stream.update([sector, sector + 1, sector - 1], retained);
      while (scheduled) {
        const work = scheduled;
        scheduled = undefined;
        work();
        await flush();
      }
      stream.tick();
      peakResident = Math.max(peakResident, stream.live.size);
      assert.ok(outstanding.size <= 3);
      for (const index of stream.live.keys()) assert.ok(retained.includes(index));
      for (const value of Object.values(stream)) {
        if (value instanceof Map || value instanceof Set) assert.ok(value.size <= 3, 'resident or failure history grew beyond its window');
      }
    }
    assert.ok(peakResident <= 3);
    assert.ok(peakOutstanding <= 3);
  } finally {
    stream.dispose();
  }
  assert.equal(scheduled, undefined);
  assert.equal(outstanding.size, 0);
  assert.equal(created, disposed);
});

/** Exercise the real component's ownership code with controlled render failures. */
function postProcessingHarness(options = {}) {
  const allocated = [];
  const layoutEffects = [];
  const sizes = [];
  let frame;
  let renderError;
  let invalidations = 0;
  class OwnedResource {
    constructor() { this.disposals = 0; allocated.push(this); }
    dispose() { this.disposals++; }
  }
  class Smaa extends OwnedResource {
    constructor() { super(); this.weightsMaterial = {}; this.listeners = new Map(); }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    removeEventListener(type) { this.listeners.delete(type); }
    dispose() {
      super.dispose();
      this.weightsMaterial.searchTexture?.dispose();
      this.weightsMaterial.areaTexture?.dispose();
    }
  }
  class Pass extends OwnedResource {}
  class EffectsPass extends Pass {
    constructor(camera, ...effects) { super(); this.effects = effects; }
    dispose() { super.dispose(); for (const effect of this.effects) effect.dispose(); }
  }
  class Composer extends OwnedResource {
    constructor() { super(); this.passes = []; }
    setRenderer(gl) { gl.autoClear = false; }
    addPass(pass) {
      const fail = this.passes.length === 1 && options.attachmentFailure;
      if (fail === 'before') throw new Error('simulated pass initialization failure');
      this.passes.push(pass);
      if (fail === 'after') throw new Error('simulated depth buffer attachment failure');
    }
    setSize(...values) { sizes.push(values); }
    render() {
      state.gl.target = { intermediate: true };
      if (renderError) throw renderError;
    }
    dispose() { super.dispose(); for (const pass of this.passes) pass.dispose(); this.passes = []; }
  }
  const state = {
    gl: {
      autoClear: true, toneMapping: THREE.ACESFilmicToneMapping, target: null,
      getRenderTarget() { return this.target; },
      setRenderTarget(value) { this.target = value; },
    },
    scene: {}, camera: {}, size: { width: 900, height: 500 }, viewport: { dpr: 2 },
    invalidate() { invalidations++; },
  };
  const scope = {
    exports: {},
    require(name) {
      if (name === 'react') return {
        useLayoutEffect: (work) => layoutEffects.push(work),
        useRef: (value) => ({ current: value }),
      };
      if (name === '@react-three/fiber') return {
        useThree: (selector) => selector(state),
        useFrame: (work, priority) => { frame = work; assert.equal(priority, 1); },
      };
      if (name === 'postprocessing') return {
        EffectComposer: Composer, RenderPass: Pass, EffectPass: EffectsPass,
        SMAAEffect: Smaa, SMAAPreset: { ULTRA: 3 }, BloomEffect: OwnedResource,
        ToneMappingEffect: OwnedResource, ToneMappingMode: { ACES_FILMIC: 3 },
      };
      return require(name);
    },
  };
  const filename = path.resolve(__dirname, '../components/team/space/SpacePostProcessing.tsx');
  const compiled = typescript.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2020, jsx: typescript.JsxEmit.ReactJSX },
    fileName: filename,
  });
  require('node:vm').runInNewContext(compiled.outputText, scope);
  scope.exports.SpacePostProcessing();
  assert.equal(allocated.length, 0, 'React render itself must allocate no GPU-owning objects');
  return {
    state, allocated, sizes,
    get invalidations() { return invalidations; },
    get smaa() { return allocated.filter((value) => value instanceof Smaa).at(-1); },
    setup: () => layoutEffects[0](),
    resize: () => layoutEffects[1](),
    render: () => frame({}, 1 / 60),
    failRender(error) { renderError = error; },
    loadSmaa(smaa) {
      smaa.weightsMaterial.searchTexture = new OwnedResource();
      smaa.weightsMaterial.areaTexture = new OwnedResource();
      smaa.listeners.get('load')();
      return [smaa.weightsMaterial.searchTexture, smaa.weightsMaterial.areaTexture];
    },
    assertRetired() {
      assert.ok(allocated.every((resource) => resource.disposals === 1), 'every owned resource must be disposed exactly once');
      assert.equal(state.gl.autoClear, true);
      assert.equal(state.gl.toneMapping, THREE.ACESFilmicToneMapping);
    },
  };
}

test('postprocessing restores renderer state and propagates the original render exception', () => {
  const h = postProcessingHarness();
  const cleanup = h.setup();
  try {
    h.resize();
    assert.deepEqual(h.sizes, [[900, 500, false]], 'composer receives CSS size without multiplying DPR twice');
    h.state.gl.autoClear = false;
    const originalTarget = { external: true };
    h.state.gl.target = originalTarget;
    h.render();
    assert.equal(h.state.gl.autoClear, false);
    assert.equal(h.state.gl.target, originalTarget);
    const error = new Error('simulated effect rendering failure');
    h.failRender(error);
    assert.throws(() => h.render(), (received) => received === error);
    assert.equal(h.state.gl.autoClear, false);
    assert.equal(h.state.gl.target, originalTarget);
  } finally {
    cleanup();
  }
  h.assertRetired();
});

test('postprocessing cleanup is idempotent and StrictMode replay creates a fresh owned pipeline', () => {
  const h = postProcessingHarness();
  const firstCleanup = h.setup();
  const firstPipeline = [...h.allocated];
  firstCleanup();
  firstCleanup();
  h.assertRetired();
  const secondCleanup = h.setup();
  assert.ok(h.allocated.length > firstPipeline.length);
  assert.ok(firstPipeline.every((resource) => resource.disposals === 1), 'StrictMode cannot resurrect disposed effects');
  secondCleanup();
  h.assertRetired();
});

test('SMAA lookup textures arriving after cleanup are retired without redisposing the effect', () => {
  const h = postProcessingHarness();
  const cleanup = h.setup();
  const smaa = h.smaa;
  cleanup();
  const invalidations = h.invalidations;
  const textures = h.loadSmaa(smaa);
  assert.ok(textures.every((texture) => texture.disposals === 1));
  assert.equal(smaa.disposals, 1);
  assert.equal(smaa.listeners.size, 0);
  assert.equal(h.invalidations, invalidations, 'late image decoding cannot request a frame for an unmounted scene');
  h.assertRetired();
});

test('SMAA lookup textures loaded while mounted are disposed by their effect owner', () => {
  const h = postProcessingHarness();
  const cleanup = h.setup();
  const textures = h.loadSmaa(h.smaa);
  assert.ok(textures.every((texture) => texture.disposals === 0));
  assert.equal(h.smaa.listeners.size, 0);
  cleanup();
  h.assertRetired();
});

test('postprocessing partial initialization failures retain exactly one disposal owner', () => {
  for (const attachmentFailure of ['before', 'after']) {
    const h = postProcessingHarness({ attachmentFailure });
    assert.throws(() => h.setup(), /simulated .* failure/);
    h.assertRetired();
  }
});

test('the opening is the real outward Solar System sequence with only associated moons', () => {
  const expected = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  assert.deepEqual(expected.map((_, index) => createEncounter(index).solarBodyId), expected);
  for (let index = 0; index < expected.length; index++) {
    const encounter = createEncounter(index);
    assert.equal(encounter.name, getSolarSystemBody(expected[index]).name);
    for (const moon of encounter.moons) {
      assert.equal(getSolarSystemBody(moon).parentId, encounter.solarBodyId);
      assert.equal(getSolarSystemBody(moon).tidallyLocked, true);
    }
  }
  assert.deepEqual(createEncounter(1).moons, []);
  assert.deepEqual(createEncounter(2).moons, []);
  assert.equal(createEncounter(10).solarBodyId, undefined, 'procedural classes begin after Pluto');
});

test('Kepler orbits close after a period and their analytic velocities match positional change', () => {
  for (const body of SOLAR_SYSTEM_BODIES.filter((value) => value.orbitalPeriodDays > 0)) {
    const motion = createOrbitalMotion(body, { distanceScale: 1000 });
    const epoch = 12345;
    motion.update(epoch);
    const initial = { ...motion.state.position };
    const velocity = { ...motion.state.velocity };
    const stateReference = motion.state;
    const positionReference = motion.state.position;
    motion.update(epoch + body.orbitalPeriodDays * 86400);
    for (const key of ['x', 'y', 'z']) assert.ok(Math.abs(motion.state.position[key] - initial[key]) < 1e-7, `${body.id} closes`);
    motion.update(epoch + 0.1);
    for (const key of ['x', 'y', 'z']) assert.ok(Math.abs((motion.state.position[key] - initial[key]) / 0.1 - velocity[key]) < 1e-6, `${body.id} velocity ${key}`);
    assert.equal(motion.state, stateReference);
    assert.equal(motion.state.position, positionReference, 'orbital updates reuse their output');
  }
});

test('orbital reference frames and retrograde axes count direction exactly once', () => {
  const circular = { ...getSolarSystemBody('earth'), eccentricity: 0, inclinationDeg: 0, ascendingNodeDeg: 0, argumentOfPeriapsisDeg: 0, meanAnomalyDeg: 0 };
  const prograde = createOrbitalMotion(circular);
  prograde.update(circular.orbitalPeriodDays * 86400 / 4);
  assert.ok(Math.abs(prograde.state.position.x) < 1e-10);
  assert.equal(prograde.state.position.y, 0);
  assert.ok(prograde.state.position.z < 0, 'prograde motion follows positive Three.js rotation.y');
  for (const id of ['venus', 'uranus', 'pluto']) {
    const body = getSolarSystemBody(id);
    assert.ok(body.spinAxisTiltDeg > 90);
    assert.equal(body.localRotationSign, 1, 'directed obliquity already makes this body retrograde');
  }
  const triton = createOrbitalMotion(getSolarSystemBody('triton'));
  triton.update(5000);
  const { position: p, velocity: v } = triton.state;
  assert.ok(p.z * v.x - p.x * v.z < 0, 'Triton has negative orbit angular momentum about parent +y');
});

test('moon coordinates and velocities inherit the moving parent without mutating it', () => {
  const planet = createOrbitalMotion(getSolarSystemBody('earth'));
  const local = createOrbitalMotion(getSolarSystemBody('moon'));
  const attached = createOrbitalMotion(getSolarSystemBody('moon'));
  planet.update(100000);
  local.update(100000);
  const parentSnapshot = JSON.stringify(planet.state);
  attached.update(100000, planet.state);
  for (const kind of ['position', 'velocity']) for (const axis of ['x', 'y', 'z']) {
    assert.ok(Math.abs(attached.state[kind][axis] - planet.state[kind][axis] - local.state[kind][axis]) < 1e-12);
  }
  assert.equal(JSON.stringify(planet.state), parentSnapshot);
});

test('ring ice, comet dust and asteroid fragments have independent bounded motion', () => {
  for (const [predicate, meshName, maximumRadius] of [
    [(e) => !e.solarBodyId && e.rings, 'solid-ice-ring-grains', 2.6],
    [(e) => e.kind === 'comet', 'solid-comet-dust-and-ice', 8],
    [(e) => e.kind === 'asteroid', 'solid-rock-and-metal-fragments', 1.65],
  ]) {
    const object = createEncounterObject(findEncounter(predicate));
    try {
      const mesh = object.group.getObjectByName(meshName);
      object.update(0, 0);
      const initial = mesh.instanceMatrix.array.slice();
      object.update(15, 1 / 60);
      assert.notDeepEqual(mesh.instanceMatrix.array, initial, `${meshName} moves independently`);
      for (let i = 0; i < mesh.count; i++) {
        const offset = i * 16;
        const data = mesh.instanceMatrix.array;
        assert.ok(Math.hypot(data[offset + 12], data[offset + 13], data[offset + 14]) < maximumRadius);
      }
    } finally { object.dispose(); }
  }
});

test('every Solar System encounter keeps its moons bounded and tidally locked and releases local resources', () => {
  const facing = new THREE.Vector3(), towardParent = new THREE.Vector3();
  for (let index = 0; index < 10; index++) {
    const descriptor = createEncounter(index);
    const object = createEncounterObject(descriptor);
    const scene = new THREE.Scene(); scene.add(object.group);
    const inventory = resourceInventory(object);
    const resources = new Set([...inventory.geometries, ...inventory.materials]);
    for (const material of inventory.materials) for (const uniform of Object.values(material.uniforms)) {
      if (uniform.value instanceof THREE.Texture) resources.add(uniform.value);
    }
    const counts = observeDisposals(resources);
    try {
      for (const seconds of [0, 41, 180, 1200]) {
        object.update(seconds, 1 / 60);
        for (const id of descriptor.moons) {
          const body = getSolarSystemBody(id);
          const mesh = object.group.getObjectByName(body.name);
          assert.ok(mesh, `${body.name} must be a real scene mesh`);
          const radius = body.radiusKm / getSolarSystemBody(descriptor.solarBodyId).radiusKm;
          assert.ok(mesh.position.length() + radius < descriptor.systemRadius, `${body.name} stays inside the clearance envelope`);
          facing.set(0, 0, 1).applyQuaternion(mesh.quaternion);
          towardParent.copy(mesh.position).normalize().negate();
          assert.ok(facing.dot(towardParent) > 0.99999, `${body.name} keeps its parent-facing hemisphere`);
        }
      }
      object.dispose(); object.dispose();
      assert.equal(object.group.parent, null);
      for (const count of counts.values()) assert.equal(count, 1, `${descriptor.name} resource ownership`);
    } finally { object.dispose(); }
  }
});

test('solar illumination stays in the orbital plane and seasons respect the spin obliquity', () => {
  for (let index = 1; index < 10; index++) {
    const descriptor = createEncounter(index);
    const body = getSolarSystemBody(descriptor.solarBodyId);
    const object = createEncounterObject(descriptor);
    const mesh = object.group.getObjectByName(body.name);
    const pole = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), body.spinAxisTiltDeg * Math.PI / 180);
    try {
      for (const phase of [0, .125, .25, .5, .75]) {
        object.update(body.orbitalPeriodDays * 86400 / 3600 * phase, 0);
        const sunlight = mesh.material.uniforms.uSun.value;
        assert.ok(Math.abs(sunlight.y) < 1e-10, `${body.id} sunlight stays in its orbital plane`);
        assert.ok(Math.abs(sunlight.length() - 1) < 1e-10);
        assert.ok(Math.abs(sunlight.dot(pole)) <= Math.abs(Math.sin(body.spinAxisTiltDeg * Math.PI / 180)) + 1e-10,
          `${body.id} cannot have a solar declination exceeding its obliquity`);
      }
    } finally { object.dispose(); }
  }
});

test('opening approach stays continuous and clear, with a single Mercury in the actual next encounter', () => {
  let previous = -1;
  const pose = { x: 0, y: 0, yaw: 0, pitch: 0 };
  for (let progress = 0; progress <= 5200; progress += 5) {
    const distance = cameraTravelDistance(progress);
    assert.ok(distance >= previous && distance - previous < 16, 'opening camera moves forward without jumps');
    previous = distance;
    const nearest = Math.max(0, Math.floor((distance - ENCOUNTER_OFFSET + SECTOR_LENGTH / 2) / SECTOR_LENGTH));
    const descriptor = createEncounter(nearest);
    sampleFlightPose(distance, descriptor, pose);
    const separation = Math.hypot(pose.x - descriptor.position[0], pose.y - descriptor.position[1], -distance - descriptor.position[2]);
    assert.ok(separation >= encounterClearance(descriptor));
    if (progress >= 2600) assert.equal(distance, progress, 'opening adjustment ends before Mercury');
  }
  const sun = createEncounterObject(createEncounter(0)), mercury = createEncounterObject(createEncounter(1));
  try {
    const bodies = [];
    for (const object of [sun, mercury]) object.group.traverse((node) => { if (node.isMesh && /mercury/i.test(node.name)) bodies.push(node); });
    assert.equal(bodies.length, 1, 'framing may never duplicate Mercury');
    assert.equal(bodies[0], mercury.group.getObjectByName('Mercury'));
  } finally { sun.dispose(); mercury.dispose(); }
});

test('camera traverses a fixed world with distant neighbours and an atomic opening pair', () => {
  assert.equal(openingPairReady(new Set()), false);
  assert.equal(openingPairReady(new Set([0])), false, 'Sun cannot reveal alone');
  assert.equal(openingPairReady(new Set([1])), false, 'Mercury cannot reveal alone');
  assert.equal(openingPairReady(new Set([0, 1])), true);
  for (let index = 2; index < 25; index++) {
    const center = index * SECTOR_LENGTH + ENCOUNTER_OFFSET;
    const fixedCenter = encounterWorldDistance(index);
    assert.equal(travelWorldDistance(center), fixedCenter);
    assert.ok(fixedCenter - encounterWorldDistance(index - 1) > 35000, 'future bodies are physically distant');
    assert.ok(fixedCenter - travelWorldDistance(index * SECTOR_LENGTH) > 30000, 'cold selector waits far away');
    let previous = travelWorldDistance(center - SECTOR_LENGTH);
    for (let distance = center - SECTOR_LENGTH + 1; distance <= center; distance++) {
      const world = travelWorldDistance(distance);
      assert.ok(world > previous && world - previous < 51, 'camera path is continuous and always forward');
      assert.equal(encounterWorldDistance(index), fixedCenter, 'a moving camera never relocates an object');
      previous = world;
    }
    assert.equal(travelWorldDistance(center + 1) - fixedCenter, 1, 'no speed warp at close inspection');
    assert.equal(encounterPrefetch(index, 650), false, 'do not queue everything during cold-load travel');
    assert.equal(encounterPrefetch(index, 750), true, 'arrival starts preparing the next object');
  }
  for (let distance = 0; distance <= 4150; distance += 5) {
    assert.equal(travelWorldDistance(distance), distance, 'opening keeps the actual Sun and Mercury together');
  }
});

test('measured relief and shared ring data keep linear colour space and release every decoded map', async () => {
  const { solarTextureStats } = require('../components/team/space/solarTextures.ts');
  const originalFetch = global.fetch, originalDecode = global.createImageBitmap;
  const bitmaps = [], objects = [];
  global.fetch = async (url) => ({ ok: true, blob: async () => ({ url }) });
  global.createImageBitmap = async () => {
    const bitmap = { width: 1024, height: 512, closes: 0, close() { this.closes++; } };
    bitmaps.push(bitmap); return bitmap;
  };
  try {
    for (const index of [1, 3, 4, 6]) {
      const object = createEncounterObject(createEncounter(index));
      objects.push(object);
      await object.prepare(new AbortController().signal);
    }
    for (const [object, name, scale, bias] of [[objects[0], 'Mercury', .5, -10000], [objects[1], 'Moon', .5, -10000], [objects[2], 'Mars', 1, -12000]]) {
      const uniforms = object.group.getObjectByName(name).material.uniforms;
      assert.equal(uniforms.uNormalMap.value.colorSpace, THREE.NoColorSpace);
      assert.equal(uniforms.uHeight.value.colorSpace, THREE.NoColorSpace);
      assert.equal(uniforms.uMap.value.colorSpace, THREE.SRGBColorSpace);
      assert.equal(uniforms.uHeightScale.value, scale);
      assert.equal(uniforms.uHeightBias.value, bias);
    }
    const globe = objects[3].group.getObjectByName('Saturn');
    const ring = objects[3].group.getObjectByName('Saturn rings');
    assert.equal(ring.material.side, THREE.FrontSide, 'the closed rings must not composite front and backfaces twice');
    assert.equal(globe.material.uniforms.uRingProfile.value, ring.material.uniforms.uRingProfile.value);
    assert.equal(ring.material.uniforms.uRingProfile.value.colorSpace, THREE.NoColorSpace);
    assert.equal(ring.material.uniforms.uRingColor.value.colorSpace, THREE.SRGBColorSpace);
    assert.ok(solarTextureStats().residentMaps > 0);
    for (const object of objects) { object.dispose(); object.dispose(); }
    assert.equal(solarTextureStats().residentMaps, 0);
    assert.equal(solarTextureStats().decodedBytes, 0);
    assert.ok(bitmaps.every((bitmap) => bitmap.closes === 1));
  } finally {
    for (const object of objects) object.dispose();
    global.fetch = originalFetch; global.createImageBitmap = originalDecode;
  }
});

test('Sun readiness waits for the observed map and retirement releases its full-resolution bitmap', async () => {
  const { solarTextureStats } = require('../components/team/space/solarTextures.ts');
  const originalFetch = global.fetch, originalDecode = global.createImageBitmap;
  const urls = [];
  let finishDecode, textureDisposals = 0, ready = false;
  const bitmap = { width: 8192, height: 4096, closes: 0, close() { this.closes++; } };
  global.fetch = async (url) => { urls.push(url); return { ok: true, blob: async () => ({}) }; };
  global.createImageBitmap = () => new Promise((resolve) => { finishDecode = resolve; });
  const object = createEncounterObject(createEncounter(0));
  try {
    const prepared = object.prepare(new AbortController().signal).then(() => { ready = true; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(ready, false, 'opening cannot present a placeholder Sun while its observation decodes');
    assert.deepEqual(urls, ['/textures/solar/sun-aia304.webp']);
    finishDecode(bitmap);
    await prepared;
    const texture = object.group.getObjectByName('Sun').material.uniforms.uSolarObservation.value;
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
    assert.equal(texture.image, bitmap);
    assert.equal(solarTextureStats().decodedBytes, 8192 * 4096 * 4);
    texture.addEventListener('dispose', () => { textureDisposals++; });
    object.dispose(); object.dispose();
    assert.equal(textureDisposals, 1);
    assert.equal(bitmap.closes, 1);
    assert.equal(solarTextureStats().residentMaps, 0);
    assert.equal(solarTextureStats().decodedBytes, 0);
  } finally {
    object.dispose(); global.fetch = originalFetch; global.createImageBitmap = originalDecode;
  }
});

test('a failed relief download retires the whole encounter and its concurrently decoded maps', async () => {
  const { solarTextureStats } = require('../components/team/space/solarTextures.ts');
  const originalFetch = global.fetch, originalDecode = global.createImageBitmap;
  const bitmaps = [];
  global.fetch = async (url) => ({ ok: !url.includes('mars-normal'), status: 503, blob: async () => ({ url }) });
  global.createImageBitmap = async () => {
    const bitmap = { width: 1024, height: 512, closes: 0, close() { this.closes++; } };
    bitmaps.push(bitmap); return bitmap;
  };
  const object = createEncounterObject(createEncounter(4));
  try {
    await assert.rejects(object.prepare(new AbortController().signal), /mars-normal.*503/);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(solarTextureStats().residentMaps, 0);
    assert.equal(solarTextureStats().users, 0);
    assert.equal(object.group.children.length, 0);
    assert.ok(bitmaps.every((bitmap) => bitmap.closes === 1));
  } finally {
    object.dispose(); global.fetch = originalFetch; global.createImageBitmap = originalDecode;
  }
});

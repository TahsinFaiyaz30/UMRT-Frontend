/**
 * Solar-map ownership tests. Run: node scripts/test-solar-resources.cjs
 * No browser, network or GPU is needed: the module is isolated per test while
 * its textures use Three's real dispose event and its async work is controlled.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const typescript = require('typescript');
const THREE = require('three');

const sourcePath = path.resolve(__dirname, '../components/team/space/solarTextures.ts');
const compiledSource = typescript.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: sourcePath,
}).outputText;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function harness() {
  const fetches = [];
  const decodes = [];
  const textures = [];
  const bitmaps = [];
  const timers = new Map();
  let nextTimer = 0;

  class TrackedTexture extends THREE.Texture {
    constructor(...args) {
      super(...args);
      this.disposals = 0;
      this.addEventListener('dispose', () => { this.disposals++; });
      textures.push(this);
    }
  }

  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require(id) {
      assert.equal(id, 'three', 'the resource loader should have no eager asset dependencies');
      return { ...THREE, Texture: TrackedTexture };
    },
    AbortController,
    DOMException,
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options = {}) {
      const work = deferred();
      const request = { url, signal: options.signal, work, aborts: 0 };
      fetches.push(request);
      const abort = () => {
        request.aborts++;
        work.reject(request.signal?.reason ?? new DOMException('Aborted fetch', 'AbortError'));
      };
      if (request.signal?.aborted) abort();
      else request.signal?.addEventListener('abort', abort, { once: true });
      const removeListener = () => request.signal?.removeEventListener('abort', abort);
      work.promise.then(removeListener, removeListener);
      return work.promise;
    },
    createImageBitmap(blob, options) {
      const work = deferred();
      decodes.push({ blob, options, work });
      return work.promise;
    },
  });
  new vm.Script(compiledSource, { filename: sourcePath }).runInContext(context);

  function bitmap() {
    const value = { width: 4096, height: 2048, closes: 0, close() { this.closes++; } };
    bitmaps.push(value);
    return value;
  }

  async function respond(index = 0, status = 200, blob = { index }) {
    fetches[index].work.resolve({ ok: status >= 200 && status < 300, status, blob: async () => blob });
    await flush();
  }

  async function finish(index = 0) {
    const value = bitmap();
    decodes[index].work.resolve(value);
    await flush();
    return value;
  }

  function fireDeadline() {
    assert.equal(timers.size, 1, 'one bounded deadline should own the pending resource');
    const [id, timer] = [...timers.entries()][0];
    assert.equal(timer.delay, 12_000);
    timers.delete(id);
    timer.callback();
  }

  function assertEmpty() {
    const stats = module.exports.solarTextureStats();
    assert.equal(stats.residentMaps, 0);
    assert.equal(stats.users, 0);
    assert.equal(stats.decodedBytes, 0);
    assert.equal(stats.estimatedGpuBytes, 0);
    assert.equal(timers.size, 0, 'retired resources leave no timer behind');
  }

  return {
    ...module.exports, fetches, decodes, textures, bitmaps, timers,
    bitmap, respond, finish, fireDeadline, assertEmpty,
  };
}

test('loading the module is lazy and acquiring one map starts only that map', async () => {
  const h = harness();
  assert.equal(h.fetches.length, 0);
  assert.equal(h.textures.length, 0);
  const earth = h.acquireSolarTexture('earth');
  const failure = assert.rejects(earth.ready, { name: 'AbortError' });
  assert.deepEqual(h.fetches.map((request) => request.url), ['/textures/solar/earth.webp']);
  assert.equal(h.solarTextureStats().users, 1);
  earth.release();
  await failure;
  h.assertEmpty();
});

test('shared leases keep one texture alive until the final idempotent release', async () => {
  const h = harness();
  const first = h.acquireSolarTexture('earth');
  const second = h.acquireSolarTexture('earth');
  assert.equal(first.ready, second.ready);
  assert.equal(h.fetches.length, 1);
  assert.equal(h.solarTextureStats().users, 2);
  await h.respond();
  const bitmap = await h.finish();
  const texture = await first.ready;
  const decodedBytes = bitmap.width * bitmap.height * 4;
  assert.equal(h.solarTextureStats().decodedBytes, decodedBytes, 'shared decoded memory is counted once');
  assert.equal(h.solarTextureStats().estimatedGpuBytes, Math.ceil(decodedBytes * 4 / 3));
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  assert.equal(texture.flipY, false);
  assert.equal(h.decodes[0].options.imageOrientation, 'flipY');
  first.release();
  first.release();
  assert.equal(h.solarTextureStats().users, 1);
  assert.equal(h.fetches[0].signal.aborted, false);
  assert.equal(texture.disposals, 0);
  assert.equal(bitmap.closes, 0);
  second.release();
  second.release();
  assert.equal(texture.disposals, 1);
  assert.equal(bitmap.closes, 1);
  h.assertEmpty();
});

test('color and data maps own distinct leases and preserve their color spaces', async () => {
  const h = harness();
  const color = h.acquireSolarTexture('earth', false);
  const data = h.acquireSolarTexture('earth', true);
  assert.notEqual(color.ready, data.ready);
  await h.respond(0);
  await h.respond(1);
  await h.finish(0);
  await h.finish(1);
  assert.equal((await color.ready).colorSpace, THREE.SRGBColorSpace);
  assert.equal((await data.ready).colorSpace, THREE.NoColorSpace);
  color.release();
  assert.equal(h.solarTextureStats().residentMaps, 1);
  data.release();
  assert.ok(h.bitmaps.every((bitmap) => bitmap.closes === 1));
  h.assertEmpty();
});

test('only the last pending lease aborts its request and removes its deadline', async () => {
  const h = harness();
  const first = h.acquireSolarTexture('mars');
  const second = h.acquireSolarTexture('mars');
  const failure = assert.rejects(first.ready, { name: 'AbortError' });
  first.release();
  assert.equal(h.fetches[0].signal.aborted, false);
  second.release();
  await failure;
  assert.equal(h.fetches[0].aborts, 1);
  assert.equal(h.decodes.length, 0);
  assert.equal(h.textures.length, 0);
  h.assertEmpty();
});

test('a bitmap decoding after eviction closes without allocating a texture', async () => {
  const h = harness();
  const lease = h.acquireSolarTexture('jupiter');
  const failure = assert.rejects(lease.ready, { name: 'AbortError' });
  await h.respond();
  lease.release();
  const lateBitmap = await h.finish();
  await failure;
  assert.equal(lateBitmap.closes, 1);
  assert.equal(h.textures.length, 0);
  lease.release();
  assert.equal(lateBitmap.closes, 1);
  h.assertEmpty();
});

test('late retirement cannot remove or dispose a replacement entry with the same key', async () => {
  const h = harness();
  const old = h.acquireSolarTexture('saturn');
  const retired = assert.rejects(old.ready, { name: 'AbortError' });
  await h.respond(0);
  old.release();
  const current = h.acquireSolarTexture('saturn');
  await h.respond(1);
  const currentBitmap = await h.finish(1);
  const currentTexture = await current.ready;
  const oldBitmap = await h.finish(0);
  await retired;
  assert.equal(oldBitmap.closes, 1);
  assert.equal(currentBitmap.closes, 0);
  assert.equal(currentTexture.disposals, 0);
  assert.equal(h.solarTextureStats().residentMaps, 1);
  assert.equal(h.solarTextureStats().users, 1);
  current.release();
  assert.equal(currentBitmap.closes, 1);
  assert.equal(currentTexture.disposals, 1);
  h.assertEmpty();
});

test('failed HTTP entries retry after all leases release without duplicating shared requests', async () => {
  const h = harness();
  const first = h.acquireSolarTexture('venus');
  const failure = assert.rejects(first.ready, /503/);
  await h.respond(0, 503);
  await failure;
  assert.equal(h.timers.size, 0);
  const second = h.acquireSolarTexture('venus');
  assert.equal(first.ready, second.ready);
  assert.equal(h.fetches.length, 1);
  first.release();
  second.release();
  h.assertEmpty();
  const retry = h.acquireSolarTexture('venus');
  assert.equal(h.fetches.length, 2);
  await h.respond(1);
  await h.finish(0);
  assert.ok(await retry.ready);
  retry.release();
  h.assertEmpty();
});

test('decode failures clear their deadline and release without phantom textures', async () => {
  const h = harness();
  const lease = h.acquireSolarTexture('neptune');
  const failure = assert.rejects(lease.ready, /decoder failed/);
  await h.respond();
  h.decodes[0].work.reject(new Error('decoder failed'));
  await failure;
  assert.equal(h.timers.size, 0);
  assert.equal(h.textures.length, 0);
  lease.release();
  h.assertEmpty();
});

test('one 12-second deadline is shared by users and cleared after success', async () => {
  const h = harness();
  const first = h.acquireSolarTexture('uranus');
  const second = h.acquireSolarTexture('uranus');
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].delay, 12_000);
  await h.respond();
  await h.finish();
  await first.ready;
  assert.equal(h.timers.size, 0);
  first.release();
  second.release();
  h.assertEmpty();
});

test('a stalled fetch reaches its deadline, aborts and can be acquired again', async () => {
  const h = harness();
  const lease = h.acquireSolarTexture('pluto');
  const failure = assert.rejects(lease.ready, { name: 'TimeoutError' });
  h.fireDeadline();
  await failure;
  assert.equal(h.fetches[0].signal.aborted, true);
  assert.equal(h.timers.size, 0);
  lease.release();
  h.assertEmpty();
  const retry = h.acquireSolarTexture('pluto');
  const abortedRetry = assert.rejects(retry.ready);
  assert.equal(h.fetches.length, 2);
  retry.release();
  await abortedRetry;
  h.assertEmpty();
});

test('a stalled decoder cannot hold readiness past its deadline and closes any late bitmap', async () => {
  const h = harness();
  const lease = h.acquireSolarTexture('moon');
  let rejected = false;
  lease.ready.catch(() => { rejected = true; });
  await h.respond();
  h.fireDeadline();
  await flush();
  assert.equal(rejected, true, 'decode is not abortable, so readiness must race an owned deadline');
  assert.equal(h.fetches[0].signal.aborted, true);
  const bitmap = await h.finish();
  assert.equal(bitmap.closes, 1);
  assert.equal(h.textures.length, 0);
  lease.release();
  h.assertEmpty();
});

test('eviction while reading the response body prevents subsequent decoding', async () => {
  const h = harness();
  const lease = h.acquireSolarTexture('mercury');
  const failure = assert.rejects(lease.ready, { name: 'AbortError' });
  const body = deferred();
  h.fetches[0].work.resolve({ ok: true, status: 200, blob: () => body.promise });
  await flush();
  lease.release();
  body.resolve({ retired: true });
  await failure;
  assert.equal(h.decodes.length, 0);
  assert.equal(h.textures.length, 0);
  h.assertEmpty();
});

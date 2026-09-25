/** One preparation at a time, with a bounded, direction-independent cache. */
export class EncounterStream<T extends { dispose(): void }> {
  readonly live = new Map<number, T>();
  readonly exhausted = new Set<number>();
  private requested: number[] = [];
  private retained = new Set<number>();
  private failed = new Map<number, { attempts: number; retryAt: number }>();
  private cancelScheduled?: () => void;
  private preparing = false;
  private stopped = false;

  constructor(private readonly operations: {
    create(index: number): T;
    prepare(resource: T): Promise<unknown>;
    mount(resource: T, index: number): void;
    unmount(resource: T): void;
    schedule(work: () => void): () => void;
    changed(): void;
    error(error: unknown): void;
    now?(): number;
  }) {}

  update(requested: number[], retained: number[]) {
    if (this.stopped) return;
    this.requested = requested;
    this.retained = new Set(retained);
    for (const [index, resource] of this.live) {
      if (!this.retained.has(index)) {
        this.operations.unmount(resource);
        resource.dispose();
        this.live.delete(index);
      }
    }
    for (const index of this.failed.keys()) {
      if (!this.retained.has(index)) this.failed.delete(index);
    }
    for (const index of this.exhausted) {
      if (!this.retained.has(index)) this.exhausted.delete(index);
    }
    this.pump();
  }

  /** Retry due work without rebuilding the unchanged resident window per frame. */
  tick() {
    this.pump();
  }

  private recordFailure(index: number, error: unknown) {
    if (this.stopped) return;
    if (this.retained.has(index)) {
      const attempts = (this.failed.get(index)?.attempts ?? 0) + 1;
      const now = this.operations.now?.() ?? Date.now();
      this.failed.set(index, { attempts, retryAt: now + attempts * 500 });
      if (attempts >= 3) this.exhausted.add(index);
    }
    this.operations.error(error);
  }

  private pump() {
    if (this.stopped || this.preparing || this.cancelScheduled) return;
    const now = this.operations.now?.() ?? Date.now();
    const index = this.requested.find((id) => !this.live.has(id) && !this.exhausted.has(id)
      && (this.failed.get(id)?.retryAt ?? 0) <= now);
    if (index === undefined) return;
    this.cancelScheduled = this.operations.schedule(() => {
      this.cancelScheduled = undefined;
      if (this.stopped) return;
      if (!this.requested.includes(index)) { this.pump(); return; }
      this.preparing = true;
      let resource: T;
      try {
        resource = this.operations.create(index);
      } catch (error) {
        this.preparing = false;
        this.recordFailure(index, error);
        this.pump();
        return;
      }
      Promise.resolve().then(() => this.operations.prepare(resource)).then(() => {
        if (this.stopped || !this.retained.has(index)) {
          resource.dispose();
        } else {
          this.live.set(index, resource);
          this.operations.mount(resource, index);
          this.operations.changed();
          this.failed.delete(index);
        }
      }).catch((error: unknown) => {
        // Mount/notification callbacks can fail after attaching the object.
        // Remove every public reference before releasing its GPU resources.
        if (this.live.get(index) === resource) {
          this.live.delete(index);
          this.operations.unmount(resource);
        }
        resource.dispose();
        this.recordFailure(index, error);
      }).finally(() => {
        this.preparing = false;
        this.pump();
      });
    });
  }

  dispose() {
    this.stopped = true;
    this.cancelScheduled?.();
    this.cancelScheduled = undefined;
    for (const resource of this.live.values()) {
      this.operations.unmount(resource);
      resource.dispose();
    }
    this.live.clear();
    this.requested = [];
    this.retained.clear();
    this.failed.clear();
    this.exhausted.clear();
    // A pending GPU compile owns its resource until it settles, then disposes it.
  }
}

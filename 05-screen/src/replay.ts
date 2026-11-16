// Plays recorded events through the same model as live, keeping their relative timing.
import type { TraceEvent } from './types';
import { model } from './model';

export type ReplayState = { status: 'idle' | 'playing' | 'paused' | 'done'; at: number; total: number; label: string };

const MAX_GAP_MS = 4000; // idle gaps longer than this are shortened so a replay never stalls

export class Replayer {
  private evs: { t: number; e: TraceEvent }[] = [];
  private i = 0;
  private vt = 0; // trace time already played, ms
  private wall = 0; // wall clock when the current timer was armed
  private timer = 0;
  speed = 1;
  state: ReplayState = { status: 'idle', at: 0, total: 0, label: '' };
  onChange: (s: ReplayState) => void = () => {};

  /** groups: one event list per run. Several runs start staggered, as if fired together. */
  load(groups: TraceEvent[][], label: string, staggerMs = 400) {
    this.stop();
    const all: { t: number; e: TraceEvent }[] = [];
    groups.forEach((g, gi) => {
      const sorted = [...g].sort((a, b) => a.ts - b.ts);
      let t = gi * staggerMs, prev = sorted[0]?.ts ?? 0;
      for (const e of sorted) {
        t += Math.min(MAX_GAP_MS, Math.max(0, (e.ts - prev) * 1000));
        prev = e.ts;
        all.push({ t, e });
      }
    });
    all.sort((a, b) => a.t - b.t);
    this.evs = all;
    this.state = { status: 'idle', at: 0, total: all.length, label };
    this.restart();
  }

  private emit(patch: Partial<ReplayState>) {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }

  private arm() {
    clearTimeout(this.timer);
    if (this.i >= this.evs.length) { this.emit({ status: 'done', at: this.i }); return; }
    const wait = Math.max(0, (this.evs[this.i].t - this.vt) / this.speed);
    this.wall = performance.now();
    this.timer = window.setTimeout(() => this.tick(), wait);
  }

  private tick() {
    this.vt = this.evs[this.i].t;
    const batch: TraceEvent[] = [];
    while (this.i < this.evs.length && this.evs[this.i].t <= this.vt + 1) batch.push(this.evs[this.i++].e);
    model.ingestMany(batch);
    this.emit({ at: this.i });
    this.arm();
  }

  restart() {
    clearTimeout(this.timer);
    model.reset();
    this.i = 0;
    this.vt = 0;
    if (!this.evs.length) return;
    this.emit({ status: 'playing', at: 0 });
    this.arm();
  }

  pause() {
    if (this.state.status !== 'playing') return;
    clearTimeout(this.timer);
    this.vt += (performance.now() - this.wall) * this.speed;
    if (this.i < this.evs.length) this.vt = Math.min(this.vt, this.evs[this.i].t);
    this.emit({ status: 'paused' });
  }

  resume() {
    if (this.state.status !== 'paused') return;
    this.emit({ status: 'playing' });
    this.arm();
  }

  setSpeed(s: number) {
    if (this.state.status === 'playing') {
      clearTimeout(this.timer);
      this.vt += (performance.now() - this.wall) * this.speed;
      if (this.i < this.evs.length) this.vt = Math.min(this.vt, this.evs[this.i].t);
      this.speed = s;
      this.arm();
    } else this.speed = s;
  }

  stop() {
    clearTimeout(this.timer);
    this.emit({ status: 'idle' });
  }
}

export const replayer = new Replayer();

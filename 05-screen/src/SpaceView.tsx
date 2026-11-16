// Space view: a three.js scene of the same trace model the Graph and Context views read.
// Loaded with React.lazy from App.tsx, so three.js lives in its own chunk.
// Each run is a cell (membrane + nucleus); tool calls are organelles; pulses travel along curved paths.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { model, type Item, type Run } from './model';

/* ----------------------------------------------------------------- limits ---- */
const MAX_CELLS = 1024; // runs + sub-agent daughter cells
const MAX_NODES = 6000; // nuclei + organelles
const MAX_PULSES = 512;
const MAX_PATHS = 192; // glowing path lines alive at once (ring buffer)
const PATH_SEG = 12;
const STARS = 2600;
const PULSE_S = 0.7; // seconds for a pulse to travel one way
const PATH_LIFE = 1.6;

const HUE: Record<string, number> = { web: 0.55, files: 0.47, memory: 0.74, email: 0.09, crawl: 0.33, swarm: 0.86, other: 0.6 };

/* ---------------------------------------------------------------- shaders ---- */
const membraneVS = /* glsl */ `
  attribute vec3 aColor; attribute float aAlpha; attribute float aPhase;
  uniform float uTime; uniform float uWobble;
  varying vec3 vN; varying vec3 vV; varying vec3 vC; varying float vA;
  void main() {
    vec3 p = position;
    float w = sin(uTime * 1.1 + aPhase + p.x * 3.1) * cos(uTime * 0.9 + aPhase * 1.7 + p.y * 2.7);
    p += normal * w * 0.045 * uWobble;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    vN = normalize(mat3(modelViewMatrix * instanceMatrix) * normal);
    vV = normalize(-mv.xyz);
    vC = aColor; vA = aAlpha;
    gl_Position = projectionMatrix * mv;
  }`;
const membraneFS = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vC; varying float vA;
  void main() {
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float rim = pow(f, 2.6);
    gl_FragColor = vec4(vC * (0.035 + rim * 0.85) * vA, 1.0);
  }`;
const pointsVS = /* glsl */ `
  attribute vec3 aColor; attribute float aSize;
  uniform float uScale;
  varying vec3 vC;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vC = aColor;
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const pointsFS = /* glsl */ `
  varying vec3 vC;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float g = exp(-d * d * 7.0) * 0.6 + smoothstep(0.22, 0.0, d) * 0.9;
    gl_FragColor = vec4(vC * g, 1.0);
  }`;

/* ------------------------------------------------------------------ state ---- */
interface Cell {
  key: string; run: string; agent: string; parent: Cell | null; idx: number;
  hue: number; pos: THREE.Vector3; dir: THREE.Vector3; radius: number; alpha: number;
  pulse: number; nodes: Org[]; nucleus: number; done: boolean; fail: boolean; budIdx: number; phase: number;
}
interface Org { cell: Cell; dir: THREE.Vector3; slot: number; kind: 'tool' | 'decision' | 'message'; status: string; flash: number; }
interface Pulse { a: Org | null; from: Cell; to: Org | null; back: boolean; t: number; delay: number; fail: boolean; path: number; }

const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpM = new THREE.Matrix4();
const qdir = (k: number, seed: number) => {
  // deterministic spread of unit directions; stable as more are added
  const y = (((k + seed) * 0.618034 + 0.31) % 1) * 2 - 1;
  const a = (k + seed) * 2.399963;
  const r = Math.sqrt(1 - y * y);
  return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
};
const tokensOf = (it: Item) => {
  for (let i = it.events.length - 1; i >= 0; i--) {
    const e = it.events[i];
    if (e.kind === 'llm_end') return (Number(e.tokens_in) || 0) + (Number(e.tokens_out) || 0);
  }
  return 0;
};

class Scene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
  cells = new Map<string, Cell>();
  cellList: Cell[] = [];
  orgs = new Map<string, Org>();
  seenRunVer = new Map<string, number>();
  seenRun = new Map<string, Run>(); // identity check: model.reset() + new events in one frame must still clear the scene
  pulses: Pulse[] = [];
  pathHead = 0;
  pathAge = new Float32Array(MAX_PATHS).fill(PATH_LIFE);
  pathPulse: (Pulse | null)[] = new Array(MAX_PATHS).fill(null);
  nodeCount = 0;
  dirty = true;
  first = true;
  reduced: boolean;
  // camera
  theta = 0.6; phi = 1.15; dist = 14; zoom = 1; target = new THREE.Vector3(); userAt = -1e9;
  // gpu objects
  membrane: THREE.InstancedMesh; mAttr: { c: THREE.InstancedBufferAttribute; a: THREE.InstancedBufferAttribute; p: THREE.InstancedBufferAttribute };
  nodes: THREE.Points; nPos: Float32Array; nCol: Float32Array; nSize: Float32Array;
  pulsePts: THREE.Points; pPos: Float32Array; pCol: Float32Array; pSize: Float32Array;
  tethers: THREE.LineSegments; tPos: Float32Array; tCol: Float32Array;
  paths: THREE.LineSegments; lPos: Float32Array; lCol: Float32Array;
  stars: THREE.Points;
  memMat: THREE.ShaderMaterial; ptMat: THREE.ShaderMaterial;
  t0 = performance.now(); last = performance.now();

  constructor(canvas: HTMLCanvasElement, reduced: boolean) {
    this.reduced = reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x05060b, 1);
    this.scene.fog = null;

    const add = (geo: THREE.BufferGeometry, name: string, arr: Float32Array, size: number) => {
      const a = new THREE.BufferAttribute(arr, size);
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
      return a;
    };

    // membranes: one instanced sphere
    this.memMat = new THREE.ShaderMaterial({
      vertexShader: membraneVS, fragmentShader: membraneFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uWobble: { value: reduced ? 0.3 : 1 } },
    });
    const sg = new THREE.IcosahedronGeometry(1, 3);
    const c = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CELLS * 3), 3);
    const a = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CELLS), 1);
    const p = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CELLS), 1);
    sg.setAttribute('aColor', c); sg.setAttribute('aAlpha', a); sg.setAttribute('aPhase', p);
    this.mAttr = { c, a, p };
    this.membrane = new THREE.InstancedMesh(sg, this.memMat, MAX_CELLS);
    this.membrane.count = 0;
    this.membrane.frustumCulled = false;
    this.membrane.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.membrane);

    // one sprite-glow material for every Points object (additive, no bloom pass)
    this.ptMat = new THREE.ShaderMaterial({
      vertexShader: pointsVS, fragmentShader: pointsFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 300 } },
    });
    const mkPoints = (n: number) => {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
      add(g, 'position', pos, 3); add(g, 'aColor', col, 3); add(g, 'aSize', size, 1);
      g.setDrawRange(0, 0);
      const pts = new THREE.Points(g, this.ptMat);
      pts.frustumCulled = false;
      this.scene.add(pts);
      return { pts, pos, col, size };
    };
    const n = mkPoints(MAX_NODES); this.nodes = n.pts; this.nPos = n.pos; this.nCol = n.col; this.nSize = n.size;
    const q = mkPoints(MAX_PULSES); this.pulsePts = q.pts; this.pPos = q.pos; this.pCol = q.col; this.pSize = q.size;

    const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const mkLines = (verts: number) => {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(verts * 3), col = new Float32Array(verts * 3);
      add(g, 'position', pos, 3); add(g, 'color', col, 3);
      g.setDrawRange(0, 0);
      const l = new THREE.LineSegments(g, lineMat);
      l.frustumCulled = false;
      this.scene.add(l);
      return { l, pos, col };
    };
    const t = mkLines(MAX_NODES * 2); this.tethers = t.l; this.tPos = t.pos; this.tCol = t.col;
    const l = mkLines(MAX_PATHS * PATH_SEG * 2); this.paths = l.l; this.lPos = l.pos; this.lCol = l.col;
    this.paths.geometry.setDrawRange(0, MAX_PATHS * PATH_SEG * 2);

    // star / particle field: sparse far stars plus nearer dim "cytoplasm" motes
    const sg2 = new THREE.BufferGeometry();
    const sp = new Float32Array(STARS * 3), sc = new Float32Array(STARS * 3), ss = new Float32Array(STARS);
    for (let i = 0; i < STARS; i++) {
      const near = i % 3 === 0;
      const r = near ? 8 + Math.random() * 40 : 90 + Math.random() * 160;
      const d = qdir(i, Math.random() * 1000);
      sp.set([d.x * r, d.y * r, d.z * r], i * 3);
      const b = near ? 0.07 + Math.random() * 0.08 : 0.25 + Math.random() * 0.5;
      const tint = Math.random();
      sc.set([b * (0.8 + tint * 0.2), b * 0.9, b * (1 - tint * 0.15)], i * 3);
      ss[i] = near ? 0.06 + Math.random() * 0.12 : 0.35 + Math.random() * 0.7;
    }
    sg2.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg2.setAttribute('aColor', new THREE.BufferAttribute(sc, 3));
    sg2.setAttribute('aSize', new THREE.BufferAttribute(ss, 1));
    this.stars = new THREE.Points(sg2, this.ptMat);
    this.scene.add(this.stars);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    // world-size points: pixels = size * (h/2) / (z * tan(fov/2))
    this.ptMat.uniforms.uScale.value = (h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
  }

  reset() {
    this.cells.clear(); this.cellList = []; this.orgs.clear(); this.seenRunVer.clear(); this.seenRun.clear();
    this.pulses = []; this.nodeCount = 0; this.pathAge.fill(PATH_LIFE); this.pathPulse.fill(null);
  }

  private addNodeSlot() { return this.nodeCount < MAX_NODES ? this.nodeCount++ : -1; }

  private ensureCell(r: Run, agent: string, parentAgent: string | null): Cell | null {
    const key = `${r.id}\u0000${agent}`;
    let c = this.cells.get(key);
    if (c) return c;
    if (this.cellList.length >= MAX_CELLS) return null;
    const parent = parentAgent ? this.ensureCell(r, parentAgent, r.agents.get(parentAgent)?.parent ?? null) : null;
    const runIdx = parent ? parent.idx : model.order.indexOf(r.id);
    const slot = this.addNodeSlot();
    if (slot < 0) return null;
    c = {
      key, run: r.id, agent, parent, idx: runIdx, hue: HUE[r.category] ?? HUE.other,
      pos: new THREE.Vector3(), dir: parent ? qdir(parent.budIdx++, runIdx * 7.3) : qdir(runIdx, 0.5),
      radius: parent ? 0.55 : 1, alpha: 0, pulse: 0.6, nodes: [], nucleus: slot, done: false, fail: false, budIdx: 0, phase: Math.random() * 6.28,
    };
    if (parent) c.pos.copy(parent.pos); else c.pos.copy(c.dir).multiplyScalar(this.homeRadius(c));
    this.cells.set(key, c);
    this.cellList.push(c);
    return c;
  }

  private homeRadius(c: Cell) { return 5 * Math.cbrt(c.idx) * (c.done ? 1.3 : 1); }

  private spawnPulse(cell: Cell, org: Org, back: boolean, fail: boolean, delay = 0) {
    if (this.pulses.length >= MAX_PULSES) this.pulses.shift();
    const path = this.pathHead;
    this.pathHead = (this.pathHead + 1) % MAX_PATHS;
    const p: Pulse = { a: org, from: cell, to: org, back, t: 0, delay, fail, path };
    this.pathAge[path] = -delay;
    this.pathPulse[path] = p;
    this.pulses.push(p);
  }

  /** Read the shared model; only runs whose version changed are walked. */
  sync() {
    this.dirty = false;
    for (const [id, obj] of this.seenRun) if (model.runs.get(id) !== obj) { this.reset(); break; }
    for (const id of model.order) {
      const r = model.runs.get(id);
      if (!r || this.seenRunVer.get(id) === r.ver) continue;
      this.seenRunVer.set(id, r.ver);
      this.seenRun.set(id, r);
      for (const ag of r.agents.values()) {
        const cell = this.ensureCell(r, ag.id, ag.parent && ag.parent !== ag.id ? ag.parent : null);
        if (!cell) continue;
        cell.done = r.done; cell.fail = r.ok === false;
        for (const it of ag.items) {
          if (it.kind === 'llm') {
            let o = this.orgs.get(it.id);
            if (!o) { o = { cell, dir: tmpV, slot: -1, kind: 'message', status: it.status, flash: 0 }; this.orgs.set(it.id, o); }
            if (o.status === 'active' && it.status !== 'active' && !this.first) cell.pulse = Math.max(cell.pulse, 0.35 + Math.min(1.4, Math.log10(1 + tokensOf(it)) * 0.32));
            else if (o.status !== 'active' && it.status === 'active') { /* llm_start: small breath */ cell.pulse = Math.max(cell.pulse, 0.15); }
            o.status = it.status;
            continue;
          }
          if (it.kind !== 'tool' && it.kind !== 'decision' && it.kind !== 'message') continue;
          let o = this.orgs.get(it.id);
          if (!o) {
            const slot = this.addNodeSlot();
            if (slot < 0) continue;
            o = { cell, dir: qdir(cell.nodes.length, cell.idx * 3.1), slot, kind: it.kind, status: 'new', flash: 0 };
            this.orgs.set(it.id, o);
            cell.nodes.push(o);
            if (!this.first) {
              if (it.kind === 'tool') {
                this.spawnPulse(cell, o, false, false);
                if (it.status !== 'active') this.spawnPulse(cell, o, true, it.status === 'fail', PULSE_S + 0.15);
              } else if (it.kind === 'decision') o.flash = 1;
            }
            o.status = it.status;
            continue;
          }
          if (o.status === 'active' && it.status !== 'active' && it.kind === 'tool' && !this.first) this.spawnPulse(cell, o, true, it.status === 'fail');
          o.status = it.status;
        }
      }
    }
    this.first = false;
  }

  focusCell(): Cell | null {
    for (let i = model.order.length - 1; i >= 0; i--) {
      const r = model.runs.get(model.order[i]);
      if (r && !r.done) return this.cells.get(`${r.id}\u0000${r.roots[0] ?? 'main'}`) ?? null;
    }
    const id = model.order[model.order.length - 1];
    const r = id ? model.runs.get(id) : undefined;
    return r ? this.cells.get(`${r.id}\u0000${r.roots[0] ?? 'main'}`) ?? null : null;
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const time = (now - this.t0) / 1000;
    if (this.dirty) this.sync();
    this.memMat.uniforms.uTime.value = time;
    const ease = 1 - Math.exp(-dt * 2.2);
    const col = new THREE.Color();

    // cells: positions, size, membrane instances, nucleus point
    const cl = this.cellList;
    for (let i = 0; i < cl.length; i++) {
      const c = cl[i];
      const n = c.nodes.length;
      const targetR = (c.parent ? 0.5 : 0.9) + 0.16 * Math.sqrt(n);
      c.radius += (targetR - c.radius) * ease;
      if (c.parent) {
        tmpV.copy(c.dir).multiplyScalar(c.parent.radius + c.radius * 1.5).add(c.parent.pos);
        c.done = c.parent.done; c.fail = c.fail || c.parent.fail;
      } else {
        tmpV.copy(c.dir).multiplyScalar(this.homeRadius(c));
        if (!this.reduced) tmpV.y += Math.sin(time * 0.25 + c.phase) * 0.25; // slow drift
      }
      c.pos.lerp(tmpV, ease);
      const targetA = c.done ? 0.38 : 1;
      c.alpha += (Math.min(1, targetA) - c.alpha) * ease;
      c.pulse *= Math.exp(-dt * 3.2);
      tmpM.makeScale(c.radius, c.radius, c.radius).setPosition(c.pos);
      this.membrane.setMatrixAt(i, tmpM);
      col.setHSL(c.fail ? 0.0 : c.hue, c.fail ? 0.55 : 0.42, 0.55);
      this.mAttr.c.setXYZ(i, col.r, col.g, col.b);
      this.mAttr.a.setX(i, c.alpha);
      this.mAttr.p.setX(i, c.phase);
      // nucleus
      const s = c.nucleus;
      this.nPos.set([c.pos.x, c.pos.y, c.pos.z], s * 3);
      col.setHSL(c.hue, 0.35, c.done ? 0.45 : 0.78);
      const b = 0.95 + c.pulse * 0.7;
      this.nCol.set([col.r * b, col.g * b, col.b * b], s * 3);
      this.nSize[s] = (c.parent ? 0.7 : 1.05) * (1 + c.pulse * 0.8) * (c.done ? 0.8 : 1);
    }
    this.membrane.count = cl.length;
    this.membrane.instanceMatrix.needsUpdate = true;
    this.mAttr.c.needsUpdate = this.mAttr.a.needsUpdate = this.mAttr.p.needsUpdate = true;

    // organelles + tethers
    let tv = 0;
    for (const c of cl) {
      const dim = c.done ? 0.45 : 1;
      for (const o of c.nodes) {
        o.flash *= Math.exp(-dt * 5);
        tmpV.copy(o.dir).multiplyScalar(c.radius * 0.62).add(c.pos);
        this.nPos.set([tmpV.x, tmpV.y, tmpV.z], o.slot * 3);
        let size = 0.32, r = 0, g = 0, bl = 0;
        if (o.kind === 'decision') {
          size = 0.22 + o.flash * 1.6; r = 1.0; g = 0.93; bl = 0.75;
          const k = (0.8 + o.flash * 3) * dim; r *= k; g *= k; bl *= k;
        } else {
          col.setHSL(o.status === 'fail' ? 0.0 : (c.hue + 0.06) % 1, o.status === 'fail' ? 0.75 : 0.5, o.kind === 'message' ? 0.35 : 0.6);
          const k = (o.status === 'active' ? 1.5 : 0.85) * dim;
          r = col.r * k; g = col.g * k; bl = col.b * k;
          if (o.kind === 'message') size = 0.2;
        }
        this.nCol.set([r, g, bl], o.slot * 3);
        this.nSize[o.slot] = size;
        if (tv < MAX_NODES * 2 - 2) {
          this.tPos.set([c.pos.x, c.pos.y, c.pos.z, tmpV.x, tmpV.y, tmpV.z], tv * 3);
          col.setHSL(c.hue, 0.4, 0.5);
          const k = 0.07 * dim;
          this.tCol.set([col.r * k * 1.6, col.g * k * 1.6, col.b * k * 1.6, col.r * k, col.g * k, col.b * k], tv * 3);
          tv += 2;
        }
      }
      if (c.parent && tv < MAX_NODES * 2 - 2) { // daughter-cell filament
        this.tPos.set([c.parent.pos.x, c.parent.pos.y, c.parent.pos.z, c.pos.x, c.pos.y, c.pos.z], tv * 3);
        col.setHSL(c.hue, 0.5, 0.6);
        const k = 0.35 * dim;
        this.tCol.set([col.r * k, col.g * k, col.b * k, col.r * k, col.g * k, col.b * k], tv * 3);
        tv += 2;
      }
    }
    this.nodes.geometry.setDrawRange(0, this.nodeCount);
    this.tethers.geometry.setDrawRange(0, tv);
    const ng = this.nodes.geometry.attributes;
    ng.position.needsUpdate = ng.aColor.needsUpdate = ng.aSize.needsUpdate = true;
    const tg = this.tethers.geometry.attributes;
    tg.position.needsUpdate = tg.color.needsUpdate = true;

    // pulses travel a quadratic curve nucleus <-> organelle that bows outward
    const curve = (p: Pulse, u: number, out: THREE.Vector3) => {
      const c = p.from, o = p.to!;
      tmpV.copy(c.pos);
      tmpV2.copy(o.dir).multiplyScalar(c.radius * 0.62).add(c.pos);
      tmpC.copy(o.dir).cross(THREE.Object3D.DEFAULT_UP).normalize().multiplyScalar(c.radius * 0.45).add(tmpV).add(tmpV2).multiplyScalar(0.5);
      if (tmpC.lengthSq() !== tmpC.lengthSq()) tmpC.copy(tmpV).add(tmpV2).multiplyScalar(0.5);
      const a = p.back ? 1 - u : u;
      const ia = 1 - a;
      out.set(
        ia * ia * tmpV.x + 2 * ia * a * tmpC.x + a * a * tmpV2.x,
        ia * ia * tmpV.y + 2 * ia * a * tmpC.y + a * a * tmpV2.y,
        ia * ia * tmpV.z + 2 * ia * a * tmpC.z + a * a * tmpV2.z,
      );
    };
    let pc = 0;
    const out = new THREE.Vector3();
    const keep: Pulse[] = [];
    for (const p of this.pulses) {
      if (p.delay > 0) { p.delay -= dt; keep.push(p); continue; }
      p.t += dt / PULSE_S;
      if (p.t >= 1) { if (!p.back && p.to) p.to.flash = Math.max(p.to.flash, 0.4); continue; }
      keep.push(p);
      curve(p, p.t, out);
      this.pPos.set([out.x, out.y, out.z], pc * 3);
      if (p.fail) this.pCol.set([1.6, 0.35, 0.3], pc * 3);
      else { col.setHSL(p.from.hue, 0.3, 0.85); this.pCol.set([col.r * 1.8, col.g * 1.8, col.b * 1.8], pc * 3); }
      this.pSize[pc] = 0.55;
      pc++;
    }
    this.pulses = keep;
    this.pulsePts.geometry.setDrawRange(0, pc);
    const pg = this.pulsePts.geometry.attributes;
    pg.position.needsUpdate = pg.aColor.needsUpdate = pg.aSize.needsUpdate = true;

    // glowing path lines (ring buffer), fade after the pulse that lit them
    for (let k = 0; k < MAX_PATHS; k++) {
      const age = (this.pathAge[k] += dt);
      const p = this.pathPulse[k];
      const base = k * PATH_SEG * 2 * 3;
      if (!p || age >= PATH_LIFE || age < 0) { if (p && age >= PATH_LIFE) this.pathPulse[k] = null; this.lCol.fill(0, base, base + PATH_SEG * 6); continue; }
      const k2 = Math.max(0, 1 - age / PATH_LIFE) * (p.fail ? 0.9 : 0.55);
      if (p.fail) col.setRGB(1, 0.25, 0.2); else col.setHSL(p.from.hue, 0.5, 0.65);
      for (let s = 0; s < PATH_SEG; s++) {
        const fake: Pulse = { ...p, back: false };
        curve(fake, s / PATH_SEG, out);
        this.lPos.set([out.x, out.y, out.z], base + s * 6);
        curve(fake, (s + 1) / PATH_SEG, out);
        this.lPos.set([out.x, out.y, out.z], base + s * 6 + 3);
        this.lCol.set([col.r * k2, col.g * k2, col.b * k2, col.r * k2, col.g * k2, col.b * k2], base + s * 6);
      }
    }
    const lg = this.paths.geometry.attributes;
    lg.position.needsUpdate = lg.color.needsUpdate = true;

    // camera: slow orbit, eases toward the most recent active cell; drag/wheel override
    const idle = now - this.userAt > 4000;
    if (!this.reduced && idle) this.theta += dt * 0.05;
    const f = this.focusCell();
    const cen = tmpC.set(0, 0, 0);
    let roots = 0;
    for (const c of cl) if (!c.parent) { cen.add(c.pos); roots++; }
    if (roots) cen.multiplyScalar(1 / roots);
    let spread = 0;
    for (const c of cl) if (!c.parent) spread = Math.max(spread, c.pos.distanceTo(cen) + c.radius);
    const live = !!f && !f.done;
    // a live run pulls the camera most of the way to it; otherwise frame every cell
    const want = tmpV.copy(cen);
    if (f) want.lerp(f.pos, live ? 0.75 : 0.25);
    const autoDist = Math.min(80, Math.max(8, live ? 6 + f!.radius * 3 + spread * 0.55 : 4 + spread * 1.9));
    const k = 1 - Math.exp(-dt * 1.2);
    if (this.reduced) { this.target.copy(want); this.dist = autoDist; }
    else { this.target.lerp(want, k); this.dist += (autoDist - this.dist) * k; }
    const d = this.dist * this.zoom;
    this.camera.position.set(
      this.target.x + d * Math.sin(this.phi) * Math.cos(this.theta),
      this.target.y + d * Math.cos(this.phi),
      this.target.z + d * Math.sin(this.phi) * Math.sin(this.theta),
    );
    this.camera.lookAt(this.target);
    if (!this.reduced) this.stars.rotation.y = time * 0.004;
    this.renderer.render(this.scene, this.camera);
  }

  /** nearest root cell to a screen point, for the hover label */
  pick(x: number, y: number, w: number, h: number): Cell | null {
    let best: Cell | null = null, bd = 28 * 28;
    for (const c of this.cellList) {
      if (c.parent) continue;
      tmpV.copy(c.pos).project(this.camera);
      if (tmpV.z > 1) continue;
      const sx = (tmpV.x * 0.5 + 0.5) * w, sy = (-tmpV.y * 0.5 + 0.5) * h;
      const dd = (sx - x) ** 2 + (sy - y) ** 2;
      if (dd < bd) { bd = dd; best = c; }
    }
    return best;
  }

  dispose() {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.memMat.dispose(); this.ptMat.dispose();
    (this.tethers.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}

export default function SpaceView() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState<{ x: number; y: number; flip: boolean; text: string; sub: string } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const el = wrap.current!, cv = canvas.current!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let s: Scene;
    try { s = new Scene(cv, reduced); } catch (e) { setErr(`WebGL unavailable: ${String(e)}`); return; }
    const unsub = model.subscribe(() => { s.dirty = true; });
    const ro = new ResizeObserver(() => s.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    s.resize(el.clientWidth, el.clientHeight);

    // render loop runs only while visible on screen and the tab is shown
    let raf = 0, onScreen = true;
    const loop = () => { raf = 0; s.frame(); schedule(); };
    const schedule = () => { if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(loop); };
    const io = new IntersectionObserver((es) => { onScreen = es[0]?.isIntersecting ?? true; if (onScreen) { s.last = performance.now(); schedule(); } });
    io.observe(el);
    const vis = () => { if (!document.hidden) { s.last = performance.now(); schedule(); } };
    document.addEventListener('visibilitychange', vis);
    schedule();

    // minimal orbit controls: drag to orbit, wheel to zoom
    let drag: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); s.userAt = performance.now(); };
    const move = (e: PointerEvent) => {
      if (drag) {
        s.theta += (e.clientX - drag.x) * 0.006;
        s.phi = Math.min(2.9, Math.max(0.25, s.phi - (e.clientY - drag.y) * 0.006));
        drag = { x: e.clientX, y: e.clientY };
        s.userAt = performance.now();
        return;
      }
      const b = cv.getBoundingClientRect();
      const c = s.pick(e.clientX - b.left, e.clientY - b.top, b.width, b.height);
      const r = c ? model.runs.get(c.run) : undefined;
      setLabel(r ? {
        x: e.clientX - b.left, y: e.clientY - b.top, flip: e.clientX - b.left > b.width - 300, text: r.task || r.id,
        sub: `${r.category} · ${r.done ? (r.ok === false ? 'failed' : 'done') : 'running'} · ${r.llmCalls} llm · ${r.toolCalls} tools${r.agents.size > 1 ? ` · ${r.agents.size - 1} sub-agents` : ''}`,
      } : null);
    };
    const up = () => { drag = null; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); s.zoom = Math.min(4, Math.max(0.15, s.zoom * Math.exp(e.deltaY * 0.001))); s.userAt = performance.now(); };
    const leave = () => setLabel(null);
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointerleave', leave);
    cv.addEventListener('wheel', wheel, { passive: false });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      unsub(); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', vis);
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointerleave', leave);
      cv.removeEventListener('wheel', wheel);
      s.dispose();
    };
  }, []);

  return (
    <div className="space" ref={wrap}>
      <canvas ref={canvas} className="space-canvas" aria-label="Space view: each run is a cell, tool calls fire as pulses" />
      {err && <div className="space-err">{err}</div>}
      <ul className="space-legend" aria-label="Legend">
        <li><i className="lg-cell" />cell = run</li>
        <li><i className="lg-nuc" />nucleus = agent, swells per LLM step</li>
        <li><i className="lg-pulse" />pulse = tool call (red = failed)</li>
        <li><i className="lg-flash" />flash = decision</li>
        <li><i className="lg-bud" />bud = sub-agent</li>
      </ul>
      {label && (
        <div className="space-label" style={label.flip ? { right: `calc(100% - ${label.x - 14}px)`, top: label.y + 10 } : { left: label.x + 14, top: label.y + 10 }}>
          <b>{label.text}</b><span>{label.sub}</span>
        </div>
      )}
    </div>
  );
}

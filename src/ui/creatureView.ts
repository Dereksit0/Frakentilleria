import Phaser from 'phaser';
import {
  RIG,
  solveRig,
  armPose,
  backArmRotation,
  localAim,
  worldBox,
  type Placement,
  type RigData,
  type SolvedRig,
} from '../core/rig';
import type { Selection } from '../core/stats';
import {
  AnimMachine,
  ANIM_DURATION,
  fxOnEnter,
  newPose,
  periodicFx,
  pickLine,
  poseAt,
  TAUNTS,
  type AmbientInput,
  type AnimFx,
  type AnimState,
} from './model/anim';
import { sfx } from './audio';
import { settings } from './settings';
import { SpeechBubble } from './speechBubble';

/** ?debug=rig draws anchors, piece boxes and the ground line over every creature. */
export const DEBUG_RIG =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'rig';

/**
 * ?debug=rig&head=<id>&torso=<id>&arms=<id>&legs=<id> forces a combination (any subset) to check it quickly.
 * Returns `base` untouched outside the debug mode or for unknown ids.
 */
export function forcedSelection(base: Selection): Selection {
  if (!DEBUG_RIG) return base;
  const q = new URLSearchParams(location.search);
  const out = { ...base };
  for (const slot of ['head', 'torso', 'arms', 'legs'] as const) {
    const v = q.get(slot);
    if (v && RIG.pieces[v]) out[slot] = v;
  }
  return out;
}

type FxHandler = (kind: AnimFx, x: number, y: number) => void;

/**
 * A creature assembled by `solveRig` (src/core/rig.ts) and animated by `poseAt` (src/ui/model/anim.ts).
 * Local origin = centre of the feet on the ground, y grows downward.
 *
 *   root ── legL, legR (behind)
 *        └─ upper (pivot = hip) ── torso, arm, head
 *
 * The head pivots on the neck, the arm on the shoulder and each leg on its hip. Nothing is allocated per frame.
 */
export class CreatureView extends Phaser.GameObjects.Container {
  readonly solved: SolvedRig;
  readonly machine = new AnimMachine();
  /** Receives the particle/sound effects a state asks for (Battle wires it to its emitters). */
  fxHandler: FxHandler | null = null;

  private readonly pose = newPose();
  private readonly root: Phaser.GameObjects.Container;
  private readonly upper: Phaser.GameObjects.Container;
  private readonly legL: Phaser.GameObjects.Image;
  private readonly legR: Phaser.GameObjects.Image;
  private readonly torso: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly arm: Phaser.GameObjects.Image;
  /** Second arm: same art, a bit darker, behind the torso (visual only). */
  private readonly armBack: Phaser.GameObjects.Image;
  private readonly armBackBase: [number, number];
  private readonly backTint: number;
  private readonly rigData: RigData;
  private readonly pieces: Phaser.GameObjects.Image[];
  private readonly glowG: Phaser.GameObjects.Graphics;
  private readonly bubble: SpeechBubble;
  private readonly dbg: Phaser.GameObjects.Graphics | null = null;
  private readonly donor: string;
  private readonly base: number;
  private readonly headBase: [number, number];
  private readonly armBase: [number, number];
  private readonly maxHeadDy: number;
  private readonly maxArmDy: number;
  private readonly restArm: number;

  private facing: 1 | -1 = 1;
  private aimDeg = -12;
  private aimRot = 0;
  private phase = 0;
  private entered = false;
  private lineN = 0;
  private lastBeat = 0;
  private lastGlow = 0;
  private flashMs = 0;
  private flashColor = 0xffffff;
  private tintKey = -1;
  private silhouette = false;
  private silColor = 0x4a4466;
  private grayed = false;
  private iced = false;
  private amb: AmbientInput = { moving: false, aiming: false, hpRatio: 1, alive: true };
  private tauntReadyAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, sel: Selection, scale = 0.3, rig: RigData = RIG) {
    super(scene, x, y);
    this.base = scale;
    this.donor = sel.head;
    const r = (this.solved = solveRig(sel, rig));
    const frame = (slot: string, donor: string) => `part_${donor}_${slot}`;
    const hip = r.hip;
    this.rigData = rig;
    const k = Math.round(255 * rig.backArm.tint);
    this.backTint = (k << 16) | (k << 8) | k;

    const mk = (p: Placement, slot: string, donor: string): Phaser.GameObjects.Image => {
      const img = scene.add.image(0, 0, 'atlas', frame(slot, donor));
      img.setOrigin(p.originX / p.w, p.originY / p.h);
      // Crop to the body of the piece: stray leftovers of the extraction are never drawn.
      img.setCrop(p.bbox[0], p.bbox[1], p.bbox[2] - p.bbox[0] + 1, p.bbox[3] - p.bbox[1] + 1);
      return img;
    };

    // Legs: two halves of the same frame, each pivoting on its own hip.
    const legs = rig.pieces[sel.legs].legs;
    const half = (side: 'l' | 'r'): Phaser.GameObjects.Image => {
      const img = scene.add.image(0, 0, 'atlas', frame('legs', sel.legs));
      const hx = legs.hipTop[0] + (side === 'l' ? -1 : 1) * (legs.hipSpacing / 2);
      img.setOrigin(hx / r.legs.w, legs.hipTop[1] / r.legs.h);
      const x0 = side === 'l' ? legs.bbox[0] : legs.split;
      const x1 = side === 'l' ? legs.split - 1 : legs.bbox[2];
      img.setCrop(x0, legs.bbox[1], x1 - x0 + 1, legs.bbox[3] - legs.bbox[1] + 1);
      const w = side === 'l' ? r.hipL : r.hipR;
      img.setPosition(w[0], w[1]);
      return img;
    };
    this.legL = half('l');
    this.legR = half('r');

    this.torso = mk(r.torso, 'torso', sel.torso);
    this.torso.setOrigin((hip[0] - r.torso.x) / r.torso.w, (hip[1] - r.torso.y) / r.torso.h);
    this.torso.setPosition(0, 0);

    this.head = mk(r.head, 'head', sel.head);
    const neck = r.neck;
    this.head.setOrigin((neck[0] - r.head.x) / r.head.w, (neck[1] - r.head.y) / r.head.h);
    this.headBase = [neck[0] - hip[0], neck[1] - hip[1]];
    this.head.setPosition(this.headBase[0], this.headBase[1]);

    this.arm = mk(r.arm, 'arms', sel.arms);
    this.armBase = [r.arm.x - hip[0], r.arm.y - hip[1]];
    this.arm.setPosition(this.armBase[0], this.armBase[1]);
    this.restArm = Math.atan2(r.armVec[1], r.armVec[0]);

    this.arm.setScale(r.arm.scale);
    this.armBack = mk(r.armBack, 'arms', sel.arms);
    this.armBack.setScale(r.armBack.scale);
    this.armBackBase = [r.armBack.x - hip[0], r.armBack.y - hip[1]];
    this.armBack.setPosition(this.armBackBase[0], this.armBackBase[1]);

    // Keep detached pieces (defeat) from sinking under the ground.
    const headBottom = worldBox(r.head)[3];
    this.maxHeadDy = Math.max(0, -headBottom - 6);
    this.maxArmDy = Math.max(0, -r.arm.y - 30);

    this.glowG = scene.add.graphics();
    this.upper = scene.add.container(hip[0], hip[1], [this.torso, this.armBack, this.arm, this.head]);
    this.root = scene.add.container(0, 0, [this.glowG, this.legL, this.legR, this.upper]);
    this.pieces = [this.legL, this.legR, this.armBack, this.torso, this.arm, this.head];
    this.add(this.root);
    if (DEBUG_RIG) {
      this.dbg = scene.add.graphics();
      this.add(this.dbg);
      this.drawDebug();
    }
    this.bubble = new SpeechBubble(scene, 90);
    this.setScale(scale);
    this.setAim(1, -12);
    scene.add.existing(this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.tick(0, 0);
  }

  // ------------------------------------------------------------------ public API

  /** facing: 1 right, −1 left. angleDeg: absolute aim angle (0 = right, 90 = up, 180 = left). */
  setAim(facing: 1 | -1, angleDeg: number): void {
    this.facing = facing;
    this.aimDeg = angleDeg;
    this.setScale(this.base * facing, this.base);
    const local = (localAim(angleDeg, facing) * Math.PI) / 180;
    // The art is not perfectly horizontal: subtract its rest angle so the hand lies on the aim line.
    this.aimRot = -local - this.restArm;
    this.arm.setRotation(this.aimRot + this.pose.armRot);
  }

  /** Feeds the looping animation (walk / aim / low health) from the match state. */
  setStatus(moving: boolean, aiming: boolean, hpRatio: number, alive: boolean): void {
    const a = this.amb;
    a.moving = moving;
    a.aiming = aiming;
    a.hpRatio = hpRatio;
    a.alive = alive;
  }

  /** Starts an animation when its priority allows it. */
  play(state: AnimState): boolean {
    if (state === 'taunt') {
      if (this.scene.time.now < this.tauntReadyAt) return false;
    }
    const ok = this.machine.request(state);
    if (ok) {
      this.entered = true;
      if (state === 'taunt') this.tauntReadyAt = this.scene.time.now + ANIM_DURATION.taunt + 400;
    }
    return ok;
  }

  get animState(): AnimState {
    return this.machine.state;
  }

  /** Name of this creature's taunt (from the head donor). */
  get tauntName(): string {
    return TAUNTS[this.donor]?.name ?? '';
  }

  /** Feet-to-head-top height in screen px (drives the bar height and the collision box of the view). */
  get heightPx(): number {
    return this.solved.height * this.base;
  }

  /** World position of the hand / muzzle for the current aim. */
  muzzleWorld(): { x: number; y: number } {
    const m = armPose(this.solved, localAim(this.aimDeg, this.facing)).muzzle;
    return { x: this.x + m[0] * this.scaleX, y: this.y + m[1] * this.scaleY };
  }

  /** Legacy hook: offsets the idle breathing so two creatures do not move in unison. */
  idle(_scene: Phaser.Scene, phase = 0): void {
    this.phase = phase * 700;
  }

  /** One-shot colour flash (e.g. acid green); the hurt animation flashes white by itself. */
  flash(color = 0xffffff): void {
    this.flashColor = color;
    this.flashMs = 90;
    this.applyTint();
  }

  /** Silhouette mode (used by the "pass the device" screen so nobody peeks). */
  setSilhouette(on: boolean, color = 0x4a4466): void {
    this.silhouette = on;
    this.silColor = color;
    this.applyTint();
  }

  setGrayed(on: boolean): void {
    this.grayed = on;
    this.applyTint();
  }

  setIce(on: boolean): void {
    if (on === this.iced) return;
    this.iced = on;
    this.applyTint();
  }

  get facingDir(): 1 | -1 {
    return this.facing;
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.bubble?.destroy();
    super.destroy(fromScene);
  }

  // ------------------------------------------------------------------ frame loop

  private tick(_time: number, delta: number): void {
    if (!this.active) return;
    const dt = Math.min(delta, 50);
    const m = this.machine;
    const prev = m.state;
    const prevT = m.time;
    m.update(dt, this.amb);
    const changed = m.state !== prev;
    if (this.entered || changed) {
      this.entered = false;
      this.onEnter(m.state);
    } else {
      const fx = periodicFx(m.state, prevT, m.time);
      if (fx) this.fxOut(fx);
    }
    const t = m.state === 'idle' || m.state === 'aim' ? m.time + this.phase : m.time;
    const p = poseAt(this.pose, m.state, t, this.donor, settings.reduceEffects);
    if (p.beat !== this.lastBeat) {
      if (p.beat > this.lastBeat) sfx('tick');
      this.lastBeat = p.beat;
    }
    this.apply(dt);
    if (this.bubble.showing) {
      const top = this.y + this.solved.headTop * this.base;
      this.bubble.follow(this.x, top - 64, dt);
    }
    if (this.dbg) this.drawDebug();
  }

  private apply(dt: number): void {
    const p = this.pose;
    this.root.setPosition(p.bodyDx, p.bodyDy);
    this.root.setScale(p.squashX, p.squashY);
    this.upper.setRotation(p.upperRot);
    this.torso.setScale(1, p.torsoScaleY);
    this.head.setPosition(this.headBase[0] + p.headDx, this.headBase[1] + Math.min(p.headDy, this.maxHeadDy));
    this.head.setRotation(p.headRot);
    this.head.setScale(p.headScaleX, 1);
    this.arm.setPosition(this.armBase[0] + p.armDx, this.armBase[1] + Math.min(p.armDy, this.maxArmDy));
    this.arm.setRotation(this.aimRot + p.armRot);
    this.armBack.setPosition(
      this.armBackBase[0] + p.backDx,
      this.armBackBase[1] + Math.min(p.backDy, this.maxArmDy),
    );
    this.armBack.setRotation(
      backArmRotation(this.solved, localAim(this.aimDeg, this.facing), p.backMode, p.backRot, this.rigData),
    );
    this.legL.setRotation(p.legLRot);
    this.legR.setRotation(p.legRRot);
    if (this.flashMs > 0) {
      this.flashMs -= dt;
      if (this.flashMs <= 0) this.applyTint();
    }
    this.applyTint();
    if (Math.abs(p.glow - this.lastGlow) > 0.02) {
      this.lastGlow = p.glow;
      const g = this.glowG.clear();
      if (p.glow > 0.02) {
        const cy = this.upper.y - 70;
        g.fillStyle(0x7fe8ff, 0.22 * p.glow).fillCircle(this.upper.x, cy, 150);
        g.fillStyle(0xbff3ff, 0.3 * p.glow).fillCircle(this.upper.x, cy, 95);
      }
    }
  }

  private applyTint(): void {
    const hurtFlash = this.pose.flash > 0.5 && !settings.reduceEffects;
    const key = hurtFlash || this.flashMs > 0 ? 1 : this.silhouette ? 2 : this.iced ? 4 : this.grayed ? 3 : 0;
    const color = hurtFlash ? 0xffffff : this.flashColor;
    const full = key * 0x1000000 + (key === 1 ? color : 0);
    if (full === this.tintKey) return;
    this.tintKey = full;
    for (const i of this.pieces) {
      const back = i === this.armBack;
      if (key === 1) i.setTintFill(color);
      else if (key === 2) i.setTintFill(this.silColor);
      else if (key === 4) i.setTint(back ? mul(0x9fd8ff, this.backTint) : 0x9fd8ff);
      else if (key === 3) i.setTint(back ? mul(0x555566, this.backTint) : 0x555566);
      else if (back) i.setTint(this.backTint);
      else i.clearTint();
    }
  }

  private onEnter(state: AnimState): void {
    for (const fx of fxOnEnter(state, this.donor)) this.fxOut(fx);
  }

  private fxOut(fx: AnimFx): void {
    if (fx === 'say-hurt') this.bubble.say(pickLine('hurt', this.lineN++), 1000);
    else if (fx === 'say-taunt') this.bubble.say(pickLine('taunt', this.lineN++), 1100);
    if (!this.fxHandler) return;
    const feet = fx === 'dust';
    const hx = this.x + this.headBase[0] * this.scaleX;
    const hy = this.y + (this.solved.headTop + 30) * this.base;
    const bodyY = this.y + (this.solved.hip[1] - 60) * this.base;
    if (feet) this.fxHandler(fx, this.x - this.facing * 10, this.y);
    else if (fx === 'smoke' || fx === 'bolts') this.fxHandler(fx, this.x, bodyY);
    else this.fxHandler(fx, hx, hy);
  }

  // ------------------------------------------------------------------ ?debug=rig

  private drawDebug(): void {
    const g = this.dbg;
    if (!g) return;
    const s = this.solved;
    const k = 1 / Math.max(this.base, 0.05);
    g.clear();
    g.lineStyle(2 * k, 0xffffff, 0.6).lineBetween(-260, 0, 260, 0); // ground line
    const box = (p: Placement, color: number) => {
      const b = worldBox(p);
      g.lineStyle(1.5 * k, color, 0.9).strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    };
    box(s.legs, 0x7cff4f);
    box(s.torso, 0xffe14d);
    box(s.head, 0xff9a4d);
    box(s.arm, 0x7fa0ff);
    const dot = (x: number, y: number, color: number, r = 4) => g.fillStyle(color, 1).fillCircle(x, y, r * k);
    dot(s.neck[0], s.neck[1], 0xff9a4d);
    dot(s.hip[0], s.hip[1], 0xffe14d);
    dot(s.hipL[0], s.hipL[1], 0x7cff4f);
    dot(s.hipR[0], s.hipR[1], 0x7cff4f);
    dot(s.arm.x, s.arm.y, 0xff5468, 5); // front shoulder pivot
    dot(s.armBack.x, s.armBack.y, 0x7fa0ff, 5); // back shoulder pivot
    dot(0, 0, 0xffffff, 5); // feet origin
    const mz = armPose(s, localAim(this.aimDeg, this.facing)).muzzle;
    dot(mz[0], mz[1], 0xff5468, 5);
    g.lineStyle(1.5 * k, 0xff5468, 0.9).lineBetween(s.arm.x, s.arm.y, mz[0], mz[1]);
  }
}

/** Multiplies two 0xRRGGBB colours channel by channel. */
function mul(a: number, b: number): number {
  const ch = (sh: number) => Math.round((((a >> sh) & 255) * ((b >> sh) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

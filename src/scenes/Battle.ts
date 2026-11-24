import Phaser from 'phaser';
import { ACID_START_ROUND, acidLevelY } from '../core/acid';
import { launchVelocity, simulateTrajectory } from '../core/ballistics';
import { Battle as Core, type BattleEvent } from '../core/battle';
import { ABILITIES, CRATES, WEAPONS, WORLD, type MapDef } from '../core/data';
import { TUNING } from '../core/tuning';
import { WorldView, paintStamps, worldBanner } from '../ui/worldView';
import { buildTerrain, layerRect, type LayerDef } from '../core/maps';
import { Rng } from '../core/rng';
import type { Terrain } from '../core/terrain';
import { UNIT_CENTER_OFFSET } from '../core/unit';
import { sfx, duckMusic } from '../ui/audio';
import { pushBackHandler } from '../ui/backNav';
import { CreatureView } from '../ui/creatureView';
import { windVisual } from '../core/windVisual';
import { WindFx } from '../ui/windFx';
import { atlasRef, loadItemsAtlas } from '../ui/atlasRefs';
import { AcidLayer } from '../ui/acidLayer';
import { PainFx } from '../ui/painFx';
import type { AnimFx } from '../ui/model/anim';
import { FloatingNumbers } from '../ui/floatingNumbers';
import { HealthBar } from '../ui/healthBar';
import { HEAVY_HIT } from '../ui/model/healthBar';
import { currentMap, session } from '../ui/session';
import { settings, vibrate } from '../ui/settings';
import { C, H, W } from '../ui/theme';
import type { Hud } from './Hud';

const CREATURE_SCALE = 0.34;
const PLATE_Y = -(460 * CREATURE_SCALE) - 30;

/** Battle scene: renders the pure-core simulation (src/core/battle.ts) and forwards input to it. */
export class Battle extends Phaser.Scene {
  core!: Core;
  locked = false;

  private map!: MapDef;
  private terrain!: Terrain;
  private terrainTex!: Phaser.Textures.CanvasTexture;
  private layers: { img: Phaser.GameObjects.Image; def: LayerDef }[] = [];
  private views: CreatureView[] = [];
  private bars: HealthBar[] = [];
  /** Status badges (frozen, shield) next to each nameplate, created on first use. */
  private badges: Phaser.GameObjects.Image[][] = [];
  private floats!: FloatingNumbers;
  private marker!: Phaser.GameObjects.Graphics;
  private shields!: Phaser.GameObjects.Graphics;
  private aimG!: Phaser.GameObjects.Graphics;
  private acid!: AcidLayer;
  private pain!: PainFx;
  private beamG!: Phaser.GameObjects.Graphics;
  private acidY = H;
  private projViews = new Map<number, Phaser.GameObjects.Image>();
  private crateViews = new Map<number, Phaser.GameObjects.Image>();
  /** Visual offset between the arm tip and the core's muzzle at the moment of the last shot. */
  private muzzleOff: { dx: number; dy: number; at: number } | null = null;
  private emitters: Record<
    'fire' | 'smoke' | 'acid' | 'ice' | 'spark' | 'confetti' | 'bolts',
    Phaser.GameObjects.Particles.ParticleEmitter
  > | null = null;
  private clouds: Phaser.GameObjects.Image[] = [];
  private stormShade?: Phaser.GameObjects.Rectangle;
  private camX = 0;
  private hitStop = 0;
  private lastTick = -1;
  private aiming = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private overHandled = false;
  private acidWarned = false;
  private worldView!: WorldView;
  private windFx!: WindFx;
  private trailG!: Phaser.GameObjects.Graphics;
  /** Smoothed lean of the far layers towards the wind (px). */
  private windShift = 0;
  private lastGustFlash = 0;
  private rng = new Rng(1234);

  constructor() {
    super('Battle');
  }

  private get hud(): Hud {
    return this.scene.get('Hud') as Hud;
  }

  // ------------------------------------------------------------ setup

  preload(): void {
    loadItemsAtlas(this);
  }

  create(): void {
    this.locked = false;
    this.overHandled = false;
    this.acidWarned = false;
    this.acidY = H;
    this.layers = [];
    this.projViews.clear();
    this.crateViews.clear();
    this.clouds = [];
    this.hitStop = 0;
    this.lastTick = -1;
    this.camX = 0;
    this.rng = new Rng(session.seed ^ 0x9e3779b9);
    this.cameras.main.fadeIn(settings.reduceEffects ? 0 : 300, 15, 14, 21);

    const sels = session.selections;
    if (!sels[0] || !sels[1]) {
      this.scene.start('Menu');
      return;
    }
    this.map = currentMap();
    this.buildBackground();
    this.buildTerrain();
    const solidBefore = this.terrain.solid.slice();
    this.core = new Core({
      seed: session.seed,
      terrain: this.terrain,
      spawns: this.map.spawns,
      selections: [sels[0], sels[1]],
    });

    // Walls, scrap piles and bridges are built into the terrain by the match: paint them on the canvas.
    paintStamps(this.terrainTex.getContext(), solidBefore, this.terrain.solid, W, H);
    this.terrainTex.refresh();
    this.windFx = new WindFx(this, this.map.id, 36);
    this.trailG = this.add.graphics().setDepth(51);
    this.worldView = new WorldView(this, this.core, this.terrain.hazards, (frame) => atlasRef(frame));
    this.acid = new AcidLayer(this, 45);
    this.pain = new PainFx(this);
    this.shields = this.add.graphics().setDepth(41);
    this.aimG = this.add.graphics().setDepth(52);
    this.beamG = this.add.graphics().setDepth(53);
    this.marker = this.add.graphics().setDepth(61);
    this.buildEmitters();

    this.views = this.core.units.map((u, i) => {
      const v = new CreatureView(this, u.x, u.y, u.selection, CREATURE_SCALE).setDepth(40);
      v.idle(this, i);
      v.fxHandler = (kind, x, y) => this.creatureFx(kind, x, y);
      return v;
    });
    this.bars = this.core.units.map((u, i) =>
      new HealthBar(this, u.x, u.y, {
        barW: 104,
        barH: 24,
        player: i as 0 | 1,
        name: `J${i + 1}`,
        chip: true,
      }).setDepth(62),
    );
    this.floats = new FloatingNumbers(this, 80);
    // Solo en desarrollo: ?debug=acid salta a la tormenta acida para revisarla.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === 'acid') {
      this.core.turn.round = ACID_START_ROUND + 2;
      this.ensureStorm();
    }

    this.setupInput();
    const popBack = pushBackHandler(() => this.requestPause());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, popBack);
    this.scene.launch('Hud', { battle: this });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop('Hud');
      duckMusic(0.35);
    });
    duckMusic(0.22);
  }

  private buildBackground(): void {
    const sorted = [...this.map.layers].sort((a, b) => a.depth - b.depth);
    let drew = false;
    for (const l of sorted) {
      let key = `layer:${this.map.id}:${l.id}`;
      if (l.kind === 'gradient' && l.stops) {
        key = `grad:${this.map.id}:${l.id}`;
        if (!this.textures.exists(key)) {
          const tex = this.textures.createCanvas(key, 4, 256);
          if (tex) {
            const ctx = tex.getContext();
            const grad = ctx.createLinearGradient(0, 0, 0, 256);
            for (const [o, c] of l.stops) grad.addColorStop(o, c);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 4, 256);
            tex.refresh();
          }
        }
      }
      if (!this.textures.exists(key)) continue;
      const img = this.add.image(0, 0, key).setOrigin(0).setDepth(l.depth);
      this.layers.push({ img, def: l });
      drew = true;
    }
    if (!drew) this.add.rectangle(0, 0, W, H, 0x6fb7e8).setOrigin(0).setDepth(0);
    this.applyParallax();
  }

  private applyParallax(): void {
    for (const { img, def } of this.layers) {
      const r = layerRect(def, WORLD, this.camX);
      // clouds and far layers lean towards the wind (the layers are oversized, so no edge shows)
      const lean = def.id === 'sky' ? 0 : def.id === 'far' ? this.windShift : this.windShift * 0.5;
      img.setPosition(r.x + lean, r.y).setDisplaySize(r.w, r.h);
    }
  }

  private buildTerrain(): void {
    const t = this.map.terrain;
    if (this.textures.exists('terrain-canvas')) this.textures.remove('terrain-canvas');
    const tex = this.textures.createCanvas('terrain-canvas', W, H);
    if (!tex) throw new Error('canvas texture unavailable');
    this.terrainTex = tex;
    const ctx = tex.getContext();
    const artKey = `terrain:${this.map.id}`;
    if (t.kind === 'image' && this.textures.exists(artKey)) {
      const src = this.textures.get(artKey).getSourceImage() as HTMLImageElement;
      const sw = src.width;
      const sh = src.height;
      ctx.drawImage(src, 0, H - sh);
      const data = ctx.getImageData(0, H - sh, sw, sh).data;
      const alpha = new Uint8Array(sw * sh);
      for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
      this.terrain = buildTerrain(this.map, WORLD, { alpha, w: sw, h: sh });
    } else {
      // Procedural terrain (also the fallback when art is missing).
      const procMap: MapDef =
        t.kind === 'procedural'
          ? this.map
          : {
              ...this.map,
              terrain: {
                kind: 'procedural',
                depth: t.depth,
                seed: 5,
                base: this.map.groundY,
                amp: 80,
                status: 'placeholder',
              },
            };
      this.terrain = buildTerrain(procMap, WORLD);
      this.paintProcedural(ctx, procMap.terrain.colors);
    }
    tex.refresh();
    this.add.image(0, 0, 'terrain-canvas').setOrigin(0).setDepth(t.depth);
  }

  private paintProcedural(
    ctx: CanvasRenderingContext2D,
    colors?: { lip: string; body: string; outline: string },
  ): void {
    const c = colors ?? { lip: '#7CFF4F', body: '#6B4A2B', outline: '#0F0E15' };
    const img = ctx.createImageData(W, H);
    const rgb = (hex: string) => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    const lip = rgb(c.lip);
    const body = rgb(c.body);
    const outline = rgb(c.outline);
    for (let x = 0; x < W; x++) {
      let depth = -1;
      for (let y = 0; y < H; y++) {
        const solid = this.terrain.isSolid(x, y);
        if (!solid) {
          depth = -1;
          continue;
        }
        depth = depth < 0 ? 0 : depth + 1;
        const col = depth < 3 ? outline : depth < 22 ? lip : body;
        const speck =
          ((x * 7 + y * 13) % 29 === 0 ? 14 : 0) + (depth > 22 ? (((x >> 3) + (y >> 3)) % 2) * 6 : 0);
        const i = (y * W + x) * 4;
        img.data[i] = Math.min(255, col[0] + speck);
        img.data[i + 1] = Math.min(255, col[1] + speck);
        img.data[i + 2] = Math.min(255, col[2] + speck);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private buildEmitters(): void {
    const mk = (tint: number, cap: number, grav: number, speed: number, life: number) =>
      this.add
        .particles(0, 0, 'atlas', {
          frame: 'dot',
          emitting: false,
          lifespan: life,
          speed: { min: speed * 0.3, max: speed },
          gravityY: grav,
          scale: { start: 0.9, end: 0 },
          alpha: { start: 1, end: 0 },
          tint,
          maxAliveParticles: cap,
        })
        .setDepth(60);
    // 5 emitters x capped alive particles = never more than 150 particles on screen.
    this.emitters = {
      fire: mk(0xff9a2e, 40, 200, 380, 520),
      smoke: mk(0x8a809c, 30, -60, 160, 800),
      acid: mk(0x7cff4f, 30, 500, 260, 700),
      ice: mk(0xbff3ff, 20, 300, 300, 600),
      spark: mk(0xffe14d, 30, 400, 460, 450),
      confetti: mk(0xb06bff, 24, 420, 520, 1100),
      bolts: mk(0xa99be0, 12, 260, 700, 900),
    };
  }

  /** Particles for the creature animations (stars when hurt, dust when walking, confetti on victory...). */
  private creatureFx(kind: AnimFx, x: number, y: number): void {
    switch (kind) {
      case 'stars':
      case 'sparkle':
        this.burst('spark', x, y, kind === 'stars' ? 5 : 6);
        break;
      case 'sweat':
        this.burst('ice', x, y, 2);
        break;
      case 'dust':
        this.burst('smoke', x, y, 1);
        break;
      case 'confetti':
        this.burst('confetti', x, y, 14);
        this.burst('spark', x, y, 6);
        break;
      case 'smoke':
        this.burst('smoke', x, y, 10);
        break;
      case 'bolts':
        this.burst('bolts', x, y, 8);
        break;
      default:
        break;
    }
  }

  /** The attacker taunts by itself shortly after landing a hit on the rival. */
  private tauntAfterHit(target: number, cause: string): void {
    if (cause === 'acid' || cause === 'fall' || this.overHandled) return;
    const attacker = this.core.current.index;
    if (attacker === target) return;
    this.time.delayedCall(650, () => {
      const a = this.core.units[attacker];
      if (this.overHandled || !a.alive || !this.core.units[target].alive) return;
      const av = this.views[attacker];
      if (av.play('taunt')) this.pain.taunt(av.x, av.y - 150, '¡Tomaaa!');
    });
  }

  /** The "Burlar" button: 1 s of attitude, costs nothing and never blocks the turn. */
  tauntCurrent(): boolean {
    if (this.locked || this.core.phase !== 'playing' || !this.core.current.alive) return false;
    const v = this.views[this.core.current.index];
    const ok = v.play('taunt');
    if (ok) this.pain.taunt(v.x, v.y - 150, '¡Jajaja!');
    return ok;
  }

  private burst(kind: keyof NonNullable<Battle['emitters']>, x: number, y: number, n: number): void {
    if (!this.emitters) return;
    const count = settings.reduceEffects ? Math.ceil(n / 4) : n;
    this.emitters[kind].explode(count, x, y);
  }

  // ------------------------------------------------------------ input

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.keys = kb.addKeys('A,D,W,S,Q,E,LEFT,RIGHT,UP,DOWN,SHIFT,ONE,TWO') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    kb.on('keydown-SPACE', () => this.doFire());
    kb.on('keydown-ENTER', () => this.doFire());
    kb.on('keydown-H', () => this.doAbility());
    kb.on('keydown-J', () => this.doJump());
    kb.on('keydown-ESC', () => this.requestPause());
    kb.on('keydown-P', () => this.requestPause());
    kb.on('keydown-ONE', () => this.chooseWeaponIndex(0));
    kb.on('keydown-TWO', () => this.chooseWeaponIndex(1));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.locked || this.hud?.hits(p.x, p.y)) return;
      this.aiming = true;
      this.aimAt(p.x, p.y);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.aiming && p.isDown) this.aimAt(p.x, p.y);
    });
    this.input.on('pointerup', () => (this.aiming = false));
  }

  private canAct(): boolean {
    return (
      !this.locked &&
      this.core.phase === 'playing' &&
      this.core.clock.phase === 'aim' &&
      this.core.projectiles.length === 0
    );
  }

  /** Drag anywhere free: the barrel points from the creature towards the pointer. */
  private aimAt(px: number, py: number): void {
    if (!this.canAct()) return;
    const u = this.core.current;
    const cx = u.x;
    const cy = u.y - UNIT_CENTER_OFFSET - 10;
    let a = (Math.atan2(-(py - cy), px - cx) * 180) / Math.PI;
    a = this.clampAngle(a);
    this.core.setAim(a, u.aimPower);
  }

  private clampAngle(a: number): number {
    const n = ((a + 540) % 360) - 180; // (-180, 180]
    if (Math.abs(n) <= 90) return Phaser.Math.Clamp(n, -25, 90);
    const e = n > 0 ? 180 - n : -180 - n;
    const ce = Phaser.Math.Clamp(e, -25, 90);
    return 180 - ce;
  }

  setPower(p: number): void {
    if (!this.canAct()) return;
    const u = this.core.current;
    this.core.setAim(u.aimAngle, p);
  }

  chooseWeapon(id: string): void {
    if (this.canAct() && id && this.core.selectWeapon(id)) sfx('click');
  }
  private chooseWeaponIndex(i: number): void {
    const id = this.core.current.weapons[i];
    if (id) this.chooseWeapon(id);
  }
  doFire(): void {
    if (!this.canAct()) return;
    if (this.core.fire()) this.aiming = false;
  }
  doAbility(): void {
    if (this.canAct()) this.core.useAbility();
  }
  doJump(): void {
    if (!this.locked) this.core.jump();
  }
  requestPause(): void {
    if (this.locked || !this.core || this.core.phase !== 'playing') return;
    if (this.scene.isPaused('Battle') || this.scene.isActive('Pause')) return;
    this.scene.pause('Battle');
    this.scene.pause('Hud');
    this.scene.launch('Pause');
  }
  openHelp(): void {
    if (this.locked || this.scene.isPaused('Battle')) return;
    this.scene.pause('Battle');
    this.scene.pause('Hud');
    this.scene.launch('Tutorial', { returnTo: 'Battle' });
  }

  private pollKeys(dt: number): void {
    if (!this.keys || this.locked || this.core.phase !== 'playing') return;
    const k = this.keys;
    let dir: -1 | 0 | 1 = 0;
    if (k.A.isDown || k.LEFT.isDown) dir = -1;
    else if (k.D.isDown || k.RIGHT.isDown) dir = 1;
    if (dir === 0) dir = this.hud?.moveDir ?? 0;
    if (dir !== 0) this.core.move(dir, dt);
    if (!this.canAct()) return;
    const u = this.core.current;
    const vert = (k.W.isDown || k.UP.isDown ? 1 : 0) - (k.S.isDown || k.DOWN.isDown ? 1 : 0);
    if (vert !== 0) {
      const right = Math.cos((u.aimAngle * Math.PI) / 180) >= 0;
      const delta = vert * 60 * dt * (right ? 1 : -1);
      this.core.setAim(this.clampAngle(u.aimAngle + delta), u.aimPower);
    }
    const pw = (k.E.isDown ? 1 : 0) - (k.Q.isDown ? 1 : 0);
    if (pw !== 0) this.core.setAim(u.aimAngle, u.aimPower + pw * 50 * dt);
  }

  // ------------------------------------------------------------ frame loop

  update(_t: number, delta: number): void {
    if (!this.core) return;
    const dt = Math.min(delta / 1000, 0.05);
    if (this.hitStop > 0) {
      this.hitStop -= delta;
    } else if (!this.locked) {
      this.pollKeys(dt);
      this.core.update(dt);
    }
    this.handleEvents(this.core.drainEvents());
    this.syncViews(dt);
    this.drawAim();
    this.drawAcid(dt);
    this.worldView.draw(this.time.now);
    this.updateWind(dt);

    const clock = this.core.clock;
    if (clock.urgent && this.core.phase === 'playing' && clock.phase === 'aim') {
      const s = Math.ceil(clock.timeLeft);
      if (s !== this.lastTick) {
        this.lastTick = s;
        sfx('tick');
      }
    }
  }

  /** Floating bars sit above each creature; they are pushed apart when the creatures are close. */
  private placeBars(): void {
    const us = this.core.units;
    const ws = this.bars.map((b) => b.totalWidth * b.scaleX);
    const xs = us.map((u, i) => Phaser.Math.Clamp(u.x, ws[i] / 2 + 10, W - ws[i] / 2 - 10));
    const need = (ws[0] + ws[1]) / 2 + 12;
    const gap = xs[1] - xs[0];
    const ys = us.map((u) => u.y + PLATE_Y);
    if (Math.abs(gap) < need) {
      const push = (need - Math.abs(gap)) / 2;
      const dir = gap >= 0 ? 1 : -1;
      xs[0] = Phaser.Math.Clamp(xs[0] - dir * push, ws[0] / 2 + 10, W - ws[0] / 2 - 10);
      xs[1] = Phaser.Math.Clamp(xs[1] + dir * push, ws[1] / 2 + 10, W - ws[1] / 2 - 10);
      if (Math.abs(xs[1] - xs[0]) < need) ys[1] -= 56; // still overlapping at the screen edge: stack them
    }
    this.bars.forEach((b, i) => b.setPosition(xs[i], ys[i]));
  }

  /** Shows the frozen / shield badges next to each health bar while the status lasts. */
  private syncBadges(): void {
    this.core.units.forEach((u, i) => {
      if (!this.badges[i])
        this.badges[i] = ['badge-congelado', 'badge-escudo'].map((f) =>
          this.add
            .image(0, 0, ...atlasRef(f))
            .setDisplaySize(40, 40)
            .setDepth(60)
            .setVisible(false),
        );
      const on = [u.frozenTurns > 0, u.shield > 0];
      let slot = 0;
      this.badges[i].forEach((b, k) => {
        b.setVisible(u.alive && on[k]);
        if (!b.visible) return;
        const bar = this.bars[i];
        b.setPosition(bar.x + (bar.totalWidth * bar.scaleX) / 2 + 26 + slot * 44, bar.y);
        slot++;
      });
    });
  }

  private syncViews(dt: number): void {
    const core = this.core;
    core.units.forEach((u, i) => {
      const v = this.views[i];
      v.setPosition(u.x, u.y);
      if (u.alive) {
        v.setAim(u.facing, u.aimAngle);
        v.setIce(u.frozenTurns > 0);
      }
      const active = core.phase === 'playing' && core.current.index === i;
      v.setStatus(Math.abs(u.vx) > 1 && u.grounded, active && u.alive, u.hp / u.maxHp, u.alive);
      this.bars[i].setValue(u.hp, u.maxHp);
      this.bars[i].tick(dt * 1000);
      this.bars[i].setEmphasis(core.phase !== 'playing' || core.current.index === i);
    });
    this.placeBars();
    this.syncBadges();
    // Active-creature marker (triangle bouncing above the nameplate)
    const cur = core.current;
    this.marker.clear();
    if (core.phase === 'playing' && cur.alive) {
      const bob = Math.sin(this.time.now / 180) * 6;
      const x = cur.x;
      const y = cur.y + PLATE_Y - 52 + bob;
      this.marker.fillStyle(C.volt, 1).fillTriangle(x - 16, y - 18, x + 16, y - 18, x, y + 4);
      this.marker.lineStyle(4, C.ink, 1).strokeTriangle(x - 16, y - 18, x + 16, y - 18, x, y + 4);
    }
    // Shield rings
    this.shields.clear();
    for (const u of core.units) {
      if (u.alive && u.shield > 0) {
        this.shields.lineStyle(5, 0x9fe8ff, 0.9).strokeCircle(u.x, u.y - UNIT_CENTER_OFFSET, 62);
        this.shields.fillStyle(0x9fe8ff, 0.18).fillCircle(u.x, u.y - UNIT_CENTER_OFFSET, 62);
      }
    }
    // Projectiles
    const live = new Set<number>();
    for (const p of core.projectiles) {
      live.add(p.id);
      let img = this.projViews.get(p.id);
      const def = WEAPONS[p.weapon];
      if (!img) {
        const frame =
          p.weapon === 'granada'
            ? 'fx-granada-calabaza'
            : p.weapon === 'hielo'
              ? 'fx-hielo-proyectil'
              : (def.sprite ?? 'fx_ball');
        img = this.add.image(p.x, p.y, ...atlasRef(frame)).setDepth(50);
        if (frame === 'fx_ball') img.setScale(0.8);
        const m = this.muzzleOff;
        if (m && this.time.now - m.at < 150) img.setData('off', [m.dx, m.dy, this.time.now]);
        this.projViews.set(p.id, img);
      }
      const off = img.getData('off') as [number, number, number] | undefined;
      const k = off ? Math.max(0, 1 - (this.time.now - off[2]) / 180) : 0;
      img.setPosition(p.x + (off ? off[0] * k : 0), p.y + (off ? off[1] * k : 0));
      if (p.weapon === 'bazuca') {
        img.setRotation(Math.atan2(p.vy, p.vx) + Math.PI / 4);
        if (!settings.reduceEffects && Math.floor(this.time.now / 40) % 2 === 0)
          this.burst('smoke', p.x - p.vx * 0.02, p.y - p.vy * 0.02, 1);
      } else if (p.weapon === 'granada') {
        img.rotation += dt * 8;
      } else if (p.weapon === 'hielo') {
        img.setRotation(Math.atan2(p.vy, p.vx));
        if (Math.floor(this.time.now / 60) % 2 === 0) this.burst('ice', p.x, p.y, 1);
      }
    }
    for (const [id, img] of this.projViews) {
      if (!live.has(id)) {
        img.destroy();
        this.projViews.delete(id);
      }
    }
    // Crates
    const liveC = new Set<number>();
    for (const c of core.crates) {
      liveC.add(c.id);
      let img = this.crateViews.get(c.id);
      if (!img) {
        img = this.add.image(c.x, c.y, 'atlas', 'item_mystery').setOrigin(0.5, 1).setScale(0.75).setDepth(35);
        this.crateViews.set(c.id, img);
      }
      img.setPosition(c.x, c.y + (c.landed ? 0 : Math.sin(this.time.now / 120) * 4));
    }
    for (const [id, img] of this.crateViews) {
      if (!liveC.has(id)) {
        img.destroy();
        this.crateViews.delete(id);
      }
    }
    // Parallax follows the action gently
    let focus = cur.x;
    if (core.projectiles[0]) focus = core.projectiles[0].x;
    const target = Phaser.Math.Clamp(((focus - W / 2) / (W / 2)) * WORLD.maxPan, -WORLD.maxPan, WORLD.maxPan);
    this.camX += (target - this.camX) * Math.min(1, dt * 3);
    if (!settings.reduceEffects) this.applyParallax();
  }

  private drawAim(): void {
    const g = this.aimG;
    g.clear();
    if (!this.canAct()) return;
    if (this.core.world.fog) return; // fog hides the aiming preview
    const u = this.core.current;
    const w = WEAPONS[u.weapon];
    const rad = (u.aimAngle * Math.PI) / 180;
    const mx = u.x + Math.cos(rad) * 40;
    const my = u.y - UNIT_CENTER_OFFSET - 10 - Math.sin(rad) * 40;
    let pts: { x: number; y: number }[];
    if (w.kind === 'projectile' || w.kind === 'grenade') {
      const v = launchVelocity(u.aimAngle, u.aimPower);
      pts = simulateTrajectory({ x: mx, y: my }, v, this.core.windNow, this.terrain, {
        windFactor: w.windFactor,
        maxT: TUNING.preview.seconds,
        sampleEvery: 7,
      }).points;
    } else {
      pts = [];
      const reach = w.kind === 'beam' ? 220 : 90;
      for (let d = 30; d <= reach; d += 36)
        pts.push({ x: u.x + Math.cos(rad) * d, y: u.y - UNIT_CENTER_OFFSET - 10 - Math.sin(rad) * d });
    }
    pts.forEach((p, i) => {
      const r = Math.max(3, 8 - i * 0.4);
      g.fillStyle(C.ink, 0.9).fillCircle(p.x, p.y, r + 2);
      g.fillStyle(C.bone, 1).fillCircle(p.x, p.y, r);
    });
    // a small streamer at the end of the preview, leaning with the wind
    const last = pts[pts.length - 1];
    if (last && this.core.windNow !== 0 && !settings.reduceEffects) {
      const lean = this.core.windNow * 9;
      g.lineStyle(4, C.volt, 0.9);
      for (let k = 0; k < 3; k++)
        g.lineBetween(last.x, last.y - 10 - k * 7, last.x + lean * (1 - k * 0.2), last.y - 14 - k * 7);
    }
  }

  /** Ambient wind particles, far-layer lean, gust flash and whistle. */
  private updateWind(dt: number): void {
    const core = this.core;
    this.windFx.update(dt, core.windNow);
    const v = windVisual(core.wind);
    this.windShift += (v.cloudShift - this.windShift) * Math.min(1, dt * 0.8);
    // a strong gust while a shot is flying: edge flash + whistle
    const gust = core.gust;
    if (core.projectiles.length > 0 && Math.abs(gust) >= 1 && this.time.now - this.lastGustFlash > 1600) {
      this.lastGustFlash = this.time.now;
      this.windFx.gustFlash(gust);
      sfx('wind');
    }
    // projectile streamers lean with the wind
    const g = this.trailG.clear();
    const lean = core.windNow * 7;
    for (const p of settings.reduceEffects ? [] : core.projectiles) {
      for (let k = 1; k <= 3; k++) {
        g.lineStyle(5 - k, C.bone, 0.55 - k * 0.12);
        g.lineBetween(
          p.x - p.vx * 0.012 * (k - 1) + lean * (k - 1),
          p.y - p.vy * 0.012 * (k - 1),
          p.x - p.vx * 0.012 * k + lean * k,
          p.y - p.vy * 0.012 * k,
        );
      }
    }
  }

  private drawAcid(dt: number): void {
    const target = acidLevelY(this.core.round, H);
    this.acidY += (target - this.acidY) * Math.min(1, dt * 2);
    this.acid.update(this.acidY, dt, settings.reduceEffects);
  }

  private ensureStorm(): void {
    if (this.stormShade) return;
    this.stormShade = this.add.rectangle(0, 0, W, H, 0x2e2a47, 0).setOrigin(0).setDepth(70);
    this.tweens.add({ targets: this.stormShade, alpha: 0.22, duration: settings.reduceEffects ? 1 : 1200 });
    for (let i = 0; i < 3; i++) {
      const c = this.add
        .image(250 + i * 560, 70 + (i % 2) * 40, 'atlas', 'fx_cloud')
        .setDepth(71)
        .setTint(0x6d4aa8)
        .setAlpha(0.9)
        .setScale(1.2);
      this.clouds.push(c);
      if (!settings.reduceEffects)
        this.tweens.add({
          targets: c,
          x: c.x + 90,
          duration: 6000 + i * 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
    }
    if (!settings.reduceEffects) {
      this.time.addEvent({
        delay: 350,
        loop: true,
        callback: () => this.acid.dropRain(this.rng.int(80, W - 80), 100),
      });
    }
  }

  // ------------------------------------------------------------ events

  private carve(x: number, y: number, r: number): void {
    const ctx = this.terrainTex.getContext();
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(25,12,20,0.6)';
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.terrainTex.refresh();
  }

  private shake(ms: number, intensity: number): void {
    if (settings.reduceEffects) return;
    this.cameras.main.shake(ms, intensity);
  }

  private handleEvents(events: BattleEvent[]): void {
    // An event/hazard banner wins over the plain "turn of" toast shown in the same batch.
    const banner = events.some(
      (e) => e.type === 'event-start' || e.type === 'event-warn' || e.type === 'hazard-warn',
    );
    for (const e of events) {
      switch (e.type) {
        case 'turn-start': {
          this.hud?.windNotice(e.wind);
          if (banner) break;
          const who = `J${e.unit + 1}`;
          if (e.round === ACID_START_ROUND - 1 && e.unit === 0 && !this.acidWarned) {
            this.hud?.toast('El ácido llega en la ronda 6');
            this.acid.warn();
          } else if (e.round >= ACID_START_ROUND) {
            this.ensureStorm();
            if (!this.acidWarned) {
              this.acidWarned = true;
              this.hud?.toast('¡Tormenta ácida! El ácido sube');
              sfx('splash');
              break;
            }
            this.hud?.toast(`Turno de ${who} · Ronda ${e.round}`);
          } else {
            this.hud?.toast(`Turno de ${who}`);
          }
          break;
        }
        case 'fire': {
          sfx(e.weapon === 'tesla' ? 'beam' : 'shoot');
          // The shot comes out of the hand: flash at the arm tip and ease the sprite from there onto the true path.
          const tip = this.views[e.unit].muzzleWorld();
          this.muzzleOff = { dx: tip.x - e.x, dy: tip.y - e.y, at: this.time.now };
          this.burst('spark', tip.x, tip.y, 6);
          this.burst('smoke', tip.x, tip.y, 4);
          this.shake(80, 0.002);
          this.views[e.unit].play('fire');
          break;
        }
        case 'beam': {
          this.beamG.clear();
          // Electric arc sprite stretched from the muzzle to the impact point, plus the impact flash.
          const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
          const arc = this.add
            .image((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2, ...atlasRef('fx-rayo-arco'))
            .setRotation(Math.atan2(e.y2 - e.y1, e.x2 - e.x1))
            .setDisplaySize(Math.max(len, 40), 64)
            .setDepth(54);
          const hit = this.add.image(e.x2, e.y2, ...atlasRef('fx-rayo-impacto')).setDepth(55);
          this.burst('spark', e.x2, e.y2, 12);
          this.tweens.add({
            targets: [arc, hit],
            alpha: { from: 1, to: 0 },
            duration: 220,
            onComplete: () => {
              arc.destroy();
              hit.destroy();
            },
          });
          break;
        }
        case 'event-warn':
        case 'event-start':
        case 'hazard-warn': {
          const msg = worldBanner(e as unknown as { type: string } & Record<string, unknown>);
          if (msg) this.hud?.toast(msg, 2600);
          if (e.type === 'event-start') sfx('splash');
          break;
        }
        case 'lightning': {
          this.burst('spark', e.x, e.y, 18);
          sfx('beam');
          this.shake(260, 0.012);
          break;
        }
        case 'explosion': {
          this.carve(e.x, e.y, e.crater);
          const s = (e.radius * 2.6) / (e.weapon === 'hielo' ? 200 : 256);
          const boom = this.add
            .image(e.x, e.y, ...atlasRef(e.weapon === 'hielo' ? 'fx-hielo-explosion' : 'fx_explosion'))
            .setDepth(58)
            .setScale(s * 0.4);
          this.tweens.add({
            targets: boom,
            scale: s,
            alpha: 0,
            duration: settings.reduceEffects ? 150 : 420,
            ease: 'Cubic.easeOut',
            onComplete: () => boom.destroy(),
          });
          if (e.weapon === 'hielo') {
            this.burst('ice', e.x, e.y, 14);
            sfx('freeze');
          } else {
            this.burst('fire', e.x, e.y, 16);
            this.burst('smoke', e.x, e.y, 10);
          }
          if (e.weapon !== 'tesla') {
            sfx('explosion');
            this.shake(220, Math.min(0.02, 0.004 + e.radius / 6000));
          }
          break;
        }
        case 'damage': {
          const target = this.core.units[e.unit];
          const kind =
            e.cause === 'acid'
              ? 'acid'
              : e.cause === 'fall'
                ? 'fall'
                : e.amount / target.maxHp >= HEAVY_HIT
                  ? 'heavy'
                  : 'damage';
          this.floats.show(e.x, e.y, `−${e.amount}`, kind);
          const v = this.views[e.unit];
          v.play('hurt');
          this.pain.hurt(v.x, v.y - 120, kind === 'heavy');
          if (!settings.reduceEffects && e.cause === 'acid') v.flash(0x7cff4f);
          this.tauntAfterHit(e.unit, e.cause);
          sfx('hit');
          vibrate(e.amount >= 25 ? 80 : 35);
          if (e.amount >= 20 && !settings.reduceEffects) this.hitStop = 70; // impact pause
          if (e.cause === 'acid') {
            this.burst('acid', v.x, v.y - 60, 8);
            this.acid.crown(v.x);
          }
          break;
        }
        case 'heal':
          this.floats.show(
            this.core.units[e.unit].x,
            this.core.units[e.unit].y - 170,
            `+${e.amount}`,
            'heal',
          );
          sfx('pickup');
          break;
        case 'ability': {
          const def = ABILITIES[e.ability];
          this.hud?.toast(`Habilidad usada: ${def.name}`);
          sfx('ability');
          this.views[e.unit].play('ability');
          break;
        }
        case 'crate-spawn':
          this.hud?.toast('¡Cae una caja!', 1400);
          break;
        case 'crate-pick': {
          const def = CRATES.types[e.crate];
          this.hud?.toast(`J${e.unit + 1} recoge: ${def.name}`);
          sfx('pickup');
          break;
        }
        case 'land':
          if (e.distance > 50) this.burst('smoke', this.core.units[e.unit].x, this.core.units[e.unit].y, 4);
          break;
        case 'death': {
          const v = this.views[e.unit];
          const u = this.core.units[e.unit];
          this.burst('smoke', u.x, u.y - 60, 14);
          this.shake(300, 0.012);
          v.setGrayed(true);
          v.setIce(false);
          v.play('defeat');
          this.pain.defeat(v.x, v.y - 60, u.selection.head);
          if (e.cause === 'void' || e.cause === 'acid') sfx('splash');
          break;
        }
        case 'over':
          this.finish(e.winner);
          break;
      }
    }
  }

  private finish(winner: number | null): void {
    if (this.overHandled) return;
    this.overHandled = true;
    this.locked = true;
    this.aimG.clear();
    this.hud?.toast(winner === null ? '¡Empate!' : `¡Gana el Jugador ${winner + 1}!`, 2200);
    sfx('win');
    if (winner !== null) this.views[winner].play('victory');
    this.time.delayedCall(settings.reduceEffects ? 600 : 2200, () => {
      this.cameras.main.fadeOut(300, 15, 14, 21);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.stop('Hud');
        this.scene.start('Result', {
          winner,
          rounds: this.core.round,
          damage: this.core.stats.damage,
          bestShot: this.core.stats.bestShot,
          hpLeft: [this.core.units[0].hp, this.core.units[1].hp],
          comeback: this.core.comeback,
          deathCause: this.core.lastDeathCause,
          weaponsUsed: [...this.core.weaponsUsed],
          seed: session.seed,
          selections: session.selections,
        });
      });
    });
  }
}

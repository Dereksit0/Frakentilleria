import Phaser from 'phaser';
import { ABILITIES, WEAPONS } from '../core/data';
import { isMobile } from '../ui/device';
import { settings } from '../ui/settings';
import { BTN, C, S, W } from '../ui/theme';
import { Button, txt } from '../ui/widgets';
import type { Battle } from './Battle';

const PAD = 32;
const POWER_X = 1068;
const POWER_W = 280;

/**
 * HUD lives in its own scene/layer on top of the battle: 104 px buttons, ≥32 px text.
 * It only reads the core state through the Battle scene and forwards player actions to it.
 */
export class Hud extends Phaser.Scene {
  private battle!: Battle;
  private zones: Phaser.Geom.Rectangle[] = [];
  private mobile = false;

  private turnBg!: Phaser.GameObjects.Graphics;
  private turnText!: Phaser.GameObjects.Text;
  private timerBg!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private windG!: Phaser.GameObjects.Graphics;
  private windText!: Phaser.GameObjects.Text;
  private weaponBtns: { btn: Button; id: string; icon: Phaser.GameObjects.Image }[] = [];
  private abilityBtn!: Button;
  private fireBtn!: Button;
  private powerG!: Phaser.GameObjects.Graphics;
  private powerText!: Phaser.GameObjects.Text;
  private toastBg!: Phaser.GameObjects.Graphics;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private lastKey = '';
  private moveDirValue: -1 | 0 | 1 = 0;
  private draggingPower = false;

  constructor() {
    super('Hud');
  }

  init(data: { battle: Battle }): void {
    this.battle = data.battle;
    this.zones = [];
    this.weaponBtns = [];
    this.lastKey = '';
    this.moveDirValue = 0;
  }

  get moveDir(): -1 | 0 | 1 {
    return this.moveDirValue;
  }

  /** True when a screen point belongs to a HUD control (so dragging there does not aim). */
  hits(x: number, y: number): boolean {
    return this.zones.some((z) => z.contains(x, y));
  }

  private zone(x: number, y: number, w: number, h: number): void {
    this.zones.push(new Phaser.Geom.Rectangle(x, y, w, h));
  }

  create(): void {
    this.mobile = isMobile();
    const g = this.add.graphics();
    void g;

    // ---- top bar ----
    this.turnBg = this.add.graphics();
    this.turnText = txt(this, PAD + 76, PAD + 32, '', { title: true, size: 32, origin: [0, 0.5], raw: true, color: S.ink });
    this.timerBg = this.add.graphics();
    this.timerText = txt(this, PAD + 340, PAD + 32, '', { title: true, size: 34, origin: [0.5, 0.5], raw: true });
    this.windG = this.add.graphics();
    this.windText = txt(this, W - PAD - BTN - 24, PAD + 32, '', { origin: [1, 0.5], color: S.volt });

    new Button(this, W - PAD - BTN, PAD - 8, BTN, BTN, 'II', {
      title: true,
      size: 40,
      onClick: () => this.battle.requestPause(),
    });
    this.zone(W - PAD - BTN, PAD - 8, BTN, BTN + 8);
    new Button(this, PAD, 130, BTN, BTN, '?', { title: true, size: 44, onClick: () => this.battle.openHelp() });
    this.zone(PAD, 130, BTN, BTN);

    // ---- bottom left: weapons + ability ----
    const by = 900 - PAD - BTN;
    this.zone(0, by - 8, W, BTN + PAD + 8);
    this.weaponBtns = [];
    for (let i = 0; i < 2; i++) {
      const x = PAD + i * 316;
      const btn = new Button(this, x, by, 300, BTN, '', { onClick: () => this.battle.chooseWeapon(this.weaponBtns[i].id) });
      const icon = this.add.image(x + 56, by + BTN / 2, 'atlas', 'wicon_cannon').setScale(0.5);
      const label = txt(this, x + 108, by + BTN / 2, '', { origin: [0, 0.5], width: 180, size: 32 });
      btn.setData('label', label);
      this.weaponBtns.push({ btn, id: '', icon });
    }
    this.abilityBtn = new Button(this, PAD + 2 * 316, by, 230, BTN, 'Habilidad', {
      kind: 'ability',
      onClick: () => this.battle.doAbility(),
    });

    // ---- bottom right: power + fire ----
    this.powerG = this.add.graphics();
    this.powerText = txt(this, POWER_X, by - 4, '', { stroke: true });
    const hit = this.add.zone(POWER_X - 16, by + 40, POWER_W + 32, 64).setOrigin(0, 0).setInteractive();
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.draggingPower = true;
      this.setPowerFromX(p.x);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.draggingPower && p.isDown) this.setPowerFromX(p.x);
    });
    this.input.on('pointerup', () => (this.draggingPower = false));
    this.fireBtn = new Button(this, W - PAD - 220, by, 220, BTN, '¡Fuego!', {
      kind: 'danger',
      title: true,
      size: 40,
      onClick: () => this.battle.doFire(),
    });

    // ---- touch-only movement cluster ----
    if (this.mobile) {
      const y = by - BTN - 20;
      this.zone(PAD, y, 3 * BTN + 24, BTN);
      this.holdButton(PAD, y, '<', -1);
      this.holdButton(PAD + BTN + 12, y, '>', 1);
      new Button(this, PAD + 2 * (BTN + 12), y, BTN, BTN, '^', {
        title: true,
        size: 44,
        onClick: () => this.battle.doJump(),
      });
    }

    // ---- toast ----
    this.toastBg = this.add.graphics();
    this.toastText = txt(this, W / 2, 150, '', { origin: [0.5, 0.5], color: S.volt, align: 'center' });
    this.toastText.setVisible(false);
    this.toastBg.setVisible(false);
  }

  private holdButton(x: number, y: number, label: string, dir: -1 | 1): void {
    const b = new Button(this, x, y, BTN, BTN, label, { title: true, size: 44, silent: true });
    b.on('pointerdown', () => (this.moveDirValue = dir));
    b.on('pointerup', () => (this.moveDirValue = 0));
    b.on('pointerout', () => (this.moveDirValue = 0));
  }

  private setPowerFromX(x: number): void {
    const t = Phaser.Math.Clamp((x - POWER_X) / POWER_W, 0, 1);
    this.battle.setPower(Math.round(10 + t * 90));
  }

  toast(msg: string, ms = 1900): void {
    this.toastText.setText(msg).setVisible(true);
    const b = this.toastText.getBounds();
    this.toastBg.clear().setVisible(true);
    this.toastBg.fillStyle(C.ink, 0.95).fillRoundedRect(b.x - 28, b.y - 12, b.width + 56, b.height + 24, 12);
    this.toastText.setDepth(2);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(ms, () => {
      this.toastText.setVisible(false);
      this.toastBg.setVisible(false);
    });
  }

  update(): void {
    const core = this.battle.core;
    if (!core) return;
    const u = core.current;
    const clock = core.clock;
    const secs = Math.ceil(clock.timeLeft);
    const urgent = clock.urgent;
    const canAct = core.phase === 'playing' && clock.phase === 'aim' && core.projectiles.length === 0 && !this.battle.locked;

    // Turn badge (colour + shape)
    const key = [u.index, secs, urgent, core.wind, u.weapon, u.abilityUsed, u.aimPower, canAct, settings.highContrast].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;

    const p1 = u.index === 0;
    this.turnBg.clear();
    this.turnBg.fillStyle(C.ink, 1).fillRoundedRect(PAD, PAD, 272, 64, 12);
    this.turnBg.fillStyle(p1 ? C.p1 : C.p2, 1).fillRoundedRect(PAD + 3, PAD + 3, 266, 58, 10);
    this.turnBg.fillStyle(C.ink, 1);
    if (p1) this.turnBg.fillCircle(PAD + 36, PAD + 32, 13);
    else this.turnBg.fillRect(PAD + 23, PAD + 19, 26, 26);
    this.turnText.setText(`Turno J${u.index + 1}`);
    this.turnText.setX(PAD + 66);

    // Timer: normal = coal, last 5 s = alarm + exclamation marks
    this.timerBg.clear();
    this.timerBg.fillStyle(C.ink, 1).fillRoundedRect(PAD + 288, PAD, 140, 64, 12);
    this.timerBg.fillStyle(urgent ? C.alarm : C.coal, 1).fillRoundedRect(PAD + 291, PAD + 3, 134, 58, 10);
    this.timerText.setText(urgent ? `¡${secs}s!` : `${secs} s`).setColor(urgent ? S.ink : S.bone);
    this.timerText.setX(PAD + 358);

    // Wind: arrow shape whose length grows with strength
    const wnd = core.wind;
    this.windG.clear();
    const bw = 330;
    const bx = W - PAD - BTN - 16 - bw;
    this.windG.fillStyle(C.ink, 1).fillRoundedRect(bx, PAD, bw, 64, 12);
    this.windText.setX(bx + 150).setOrigin(0, 0.5).setText(wnd === 0 ? 'Calma' : `${Math.abs(wnd)}`);
    this.windText.setText(wnd === 0 ? 'Viento: 0' : `Viento ${Math.abs(wnd)}`);
    this.windText.setX(bx + 16);
    if (wnd !== 0) {
      const dir = wnd > 0 ? 1 : -1;
      const len = 12 + Math.abs(wnd) * 7;
      const cx = bx + bw - 24 - (dir > 0 ? 0 : 0);
      const x0 = cx - dir * len;
      this.windG.fillStyle(C.volt, 1);
      this.windG.fillRect(Math.min(x0, cx), PAD + 28, len, 8);
      this.windG.fillTriangle(cx + dir * 14, PAD + 32, cx, PAD + 16, cx, PAD + 48);
    }

    // Weapon buttons
    for (let i = 0; i < this.weaponBtns.length; i++) {
      const wb = this.weaponBtns[i];
      const id = u.weapons[i];
      const label = wb.btn.data.get('label') as Phaser.GameObjects.Text;
      wb.btn.setVisible(!!id);
      wb.icon.setVisible(!!id);
      label.setVisible(!!id);
      if (!id) continue;
      wb.id = id;
      const def = WEAPONS[id];
      wb.icon.setTexture('atlas', def.icon);
      wb.icon.setScale(0.5);
      label.setText(def.name);
      const sel = u.weapon === id;
      wb.btn.setSelected(sel).setEnabled(canAct);
      label.setColor(sel || !canAct ? (sel ? S.ink : S.bone) : S.bone);
      wb.btn.setLabel('');
    }

    // Ability
    const ab = u.ability ? ABILITIES[u.ability] : undefined;
    if (!ab) {
      this.abilityBtn.setLabel('Sin habilidad').setEnabled(false);
    } else if (u.abilityUsed) {
      this.abilityBtn.setLabel('Habilidad usada').setEnabled(false);
    } else {
      this.abilityBtn.setLabel(`${ab.name}`).setEnabled(canAct);
    }

    // Power
    const pw = u.aimPower;
    this.powerText.setText(`Potencia ${pw}%`);
    const g = this.powerG;
    g.clear();
    const by = 900 - PAD - BTN;
    g.fillStyle(C.ink, 1).fillRoundedRect(POWER_X, by + 52, POWER_W, 40, 20);
    g.fillStyle(pw > 85 ? C.alarm : C.volt, 1).fillRoundedRect(
      POWER_X + 4,
      by + 56,
      Math.max(16, ((POWER_W - 8) * (pw - 10)) / 90),
      32,
      16,
    );
    // Marker triangle at the end of the bar (shape cue, not colour only)
    const mx = POWER_X + 4 + ((POWER_W - 8) * (pw - 10)) / 90;
    g.fillStyle(C.bone, 1).fillTriangle(mx - 10, by + 100, mx + 10, by + 100, mx, by + 86);

    this.fireBtn.setEnabled(canAct);
  }
}

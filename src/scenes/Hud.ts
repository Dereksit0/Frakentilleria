import Phaser from 'phaser';
import { ABILITIES, WEAPONS } from '../core/data';
import { isMobile } from '../ui/device';
import { HealthBar } from '../ui/healthBar';
import { settings } from '../ui/settings';
import { BTN, C, S, W } from '../ui/theme';
import { Button, txt } from '../ui/widgets';
import type { PlayerId } from '../ui/model/healthBar';
import type { Battle } from './Battle';

const PAD = 32;
const POWER_X = 1068;
const POWER_W = 280;
const PANEL_W = 420;
const PANEL_H = 140;
const PANEL_Y = 16;

interface TeamPanel {
  gfx: Phaser.GameObjects.Graphics;
  portrait: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  bar: HealthBar;
  resIcon: Phaser.GameObjects.Image;
  resText: Phaser.GameObjects.Text;
  dmgIcon: Phaser.GameObjects.Image;
  dmgText: Phaser.GameObjects.Text;
  abilityG: Phaser.GameObjects.Graphics;
  lastKey: string;
}

/**
 * HUD lives in its own scene/layer on top of the battle: 104 px buttons, ≥32 px text.
 * Top: one panel per team (portrait, name, big health bar, resistance / bonus / ability icons).
 * It only reads the core state through the Battle scene and forwards player actions to it.
 */
export class Hud extends Phaser.Scene {
  private battle!: Battle;
  private zones: Phaser.Geom.Rectangle[] = [];
  private mobile = false;

  private panels: TeamPanel[] = [];
  private timerBg!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private windG!: Phaser.GameObjects.Graphics;
  private windText!: Phaser.GameObjects.Text;
  private weaponBtns: { btn: Button; id: string; icon: Phaser.GameObjects.Image }[] = [];
  private abilityBtn!: Button;
  private tauntBtn!: Button;
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
    this.panels = [];
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

    // ---- top: team panels ----
    const units = this.battle.core.units;
    this.panels = units.map((u, i) =>
      this.makePanel(i as PlayerId, i === 0 ? PAD : W - PAD - PANEL_W, u.selection.head),
    );

    // ---- top centre: timer, wind, pause ----
    const cx = W / 2;
    const startX = cx - 294;
    this.timerBg = this.add.graphics();
    this.timerText = txt(this, startX + 75, PANEL_Y + 32, '', {
      title: true,
      size: 34,
      origin: [0.5, 0.5],
      raw: true,
    });
    this.windG = this.add.graphics();
    this.windText = txt(this, startX + 162 + 14, PANEL_Y + 32, '', { origin: [0, 0.5], color: S.volt });
    new Button(this, startX + 162 + 310 + 12, PANEL_Y - 8, BTN, BTN, 'II', {
      title: true,
      size: 40,
      onClick: () => this.battle.requestPause(),
    });
    this.zone(startX + 162 + 310 + 12, PANEL_Y - 8, BTN, BTN + 8);
    new Button(this, PAD, PANEL_Y + PANEL_H + 16, BTN, BTN, '?', {
      title: true,
      size: 44,
      onClick: () => this.battle.openHelp(),
    });
    this.zone(PAD, PANEL_Y + PANEL_H + 16, BTN, BTN);
    // "Burlar": 1 s of attitude, does not spend the turn
    this.tauntBtn = new Button(this, PAD + BTN + 12, PANEL_Y + PANEL_H + 16, 200, BTN, 'Burlar', {
      size: 32,
      onClick: () => this.battle.tauntCurrent(),
    });
    this.zone(PAD + BTN + 12, PANEL_Y + PANEL_H + 16, 200, BTN);
    this.zone(PAD, PANEL_Y, PANEL_W, PANEL_H);
    this.zone(W - PAD - PANEL_W, PANEL_Y, PANEL_W, PANEL_H);

    // ---- bottom left: weapons + ability ----
    const by = 900 - PAD - BTN;
    this.zone(0, by - 8, W, BTN + PAD + 8);
    this.weaponBtns = [];
    for (let i = 0; i < 2; i++) {
      const x = PAD + i * 316;
      const btn = new Button(this, x, by, 300, BTN, '', {
        onClick: () => this.battle.chooseWeapon(this.weaponBtns[i].id),
      });
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
    const hit = this.add
      .zone(POWER_X - 16, by + 40, POWER_W + 32, 64)
      .setOrigin(0, 0)
      .setInteractive();
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
    this.toastText = txt(this, W / 2, 222, '', { origin: [0.5, 0.5], color: S.volt, align: 'center' });
    this.toastText.setVisible(false);
    this.toastBg.setVisible(false);
  }

  private makePanel(player: PlayerId, x: number, headDonor: string): TeamPanel {
    const y = PANEL_Y;
    const gfx = this.add.graphics();
    const portrait = this.add.image(x + 58, y + 58, 'atlas', `part_${headDonor}_head`);
    portrait.setScale(76 / Math.max(portrait.width, portrait.height));
    const name = txt(this, x + 150, y + 22, `Jugador ${player + 1}`, { origin: [0, 0.5], color: S.bone });
    const bar = new HealthBar(this, 0, y + 72, { barW: 170, barH: 32, player });
    bar.setPosition(x + 112 + bar.totalWidth / 2, y + 72);
    const iconY = y + 118;
    const resIcon = this.add.image(x + 122, iconY, 'atlas', 'item_shield').setScale(0.3);
    const resText = txt(this, x + 142, iconY, '', { origin: [0, 0.5], color: S.bone });
    const dmgIcon = this.add.image(x + 252, iconY, 'atlas', 'item_fist').setScale(0.3);
    const dmgText = txt(this, x + 272, iconY, '', { origin: [0, 0.5], color: S.bone });
    const abilityG = this.add.graphics();
    return { gfx, portrait, name, bar, resIcon, resText, dmgIcon, dmgText, abilityG, lastKey: '' };
  }

  private drawPanel(i: number, p: TeamPanel, active: boolean): void {
    const core = this.battle.core;
    const u = core.units[i];
    const x = i === 0 ? PAD : W - PAD - PANEL_W;
    const y = PANEL_Y;
    const key = [
      active,
      u.alive,
      u.abilityUsed,
      u.stats.resistance,
      u.stats.damage,
      settings.highContrast,
    ].join('|');
    if (key === p.lastKey) return;
    p.lastKey = key;
    const color = i === 0 ? C.p1 : C.p2;
    const g = p.gfx;
    g.clear();
    g.fillStyle(C.ink, 1).fillRoundedRect(x - 3, y - 3, PANEL_W + 6, PANEL_H + 6, 16);
    g.fillStyle(active ? 0x3a2f6b : C.night, 1).fillRoundedRect(x, y, PANEL_W, PANEL_H, 14);
    if (active) g.lineStyle(6, C.volt, 1).strokeRoundedRect(x + 3, y + 3, PANEL_W - 6, PANEL_H - 6, 12);
    // portrait frame + shape chip (circle = J1, diamond = J2)
    g.fillStyle(C.coal, 1).fillRoundedRect(x + 16, y + 16, 84, 84, 12);
    g.lineStyle(5, color, 1).strokeRoundedRect(x + 16, y + 16, 84, 84, 12);
    g.fillStyle(color, 1).lineStyle(4, C.ink, 1);
    const cx = x + 124;
    const cy = y + 22;
    if (i === 0) g.fillCircle(cx, cy, 13).strokeCircle(cx, cy, 13);
    else {
      const pts = [
        new Phaser.Geom.Point(cx, cy - 16),
        new Phaser.Geom.Point(cx + 16, cy),
        new Phaser.Geom.Point(cx, cy + 16),
        new Phaser.Geom.Point(cx - 16, cy),
      ];
      g.fillPoints(pts, true).strokePoints(pts, true);
    }
    p.name.setText(active ? `Turno de J${i + 1}` : `Jugador ${i + 1}`).setColor(active ? S.volt : S.bone);
    p.portrait.setAlpha(u.alive ? 1 : 0.4);
    // resistance / damage bonus / ability: icon + value
    const res = u.stats.resistance;
    const dmg = u.stats.damage - 100;
    p.resIcon.setVisible(res > 0);
    p.resText.setText(res > 0 ? `${res}%` : '').setVisible(res > 0);
    p.dmgIcon.setVisible(dmg > 0);
    p.dmgText.setText(dmg > 0 ? `+${dmg}%` : '').setVisible(dmg > 0);
    const ag = p.abilityG;
    ag.clear();
    if (u.ability) {
      // Lightning bolt: bright when available, dim + crossed out once used.
      const ax = x + 388;
      const ay = y + 118;
      ag.fillStyle(u.abilityUsed ? C.disabled : 0x3fc8c0, 1).lineStyle(3, C.ink, 1);
      const pts = [
        new Phaser.Geom.Point(ax + 4, ay - 18),
        new Phaser.Geom.Point(ax - 10, ay + 2),
        new Phaser.Geom.Point(ax - 1, ay + 2),
        new Phaser.Geom.Point(ax - 5, ay + 18),
        new Phaser.Geom.Point(ax + 10, ay - 4),
        new Phaser.Geom.Point(ax + 1, ay - 4),
      ];
      ag.fillPoints(pts, true).strokePoints(pts, true);
      if (u.abilityUsed) ag.lineStyle(4, C.alarm, 1).lineBetween(ax - 14, ay - 16, ax + 14, ay + 16);
    }
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

  update(_t: number, delta: number): void {
    const core = this.battle.core;
    if (!core) return;
    const u = core.current;
    const clock = core.clock;
    const secs = Math.ceil(clock.timeLeft);
    const urgent = clock.urgent;
    const canAct =
      core.phase === 'playing' &&
      clock.phase === 'aim' &&
      core.projectiles.length === 0 &&
      !this.battle.locked;

    // Team panels: bars animate every frame, the static frame only redraws on change.
    this.panels.forEach((p, i) => {
      const unit = core.units[i];
      p.bar.setValue(unit.hp, unit.maxHp);
      p.bar.tick(delta);
      this.drawPanel(i, p, u.index === i && core.phase === 'playing');
    });

    const key = [
      u.index,
      secs,
      urgent,
      core.wind,
      u.weapon,
      u.abilityUsed,
      u.aimPower,
      canAct,
      settings.highContrast,
    ].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;

    const startX = W / 2 - 294;
    // Timer: normal = coal, last 5 s = alarm + exclamation marks
    this.timerBg.clear();
    this.timerBg.fillStyle(C.ink, 1).fillRoundedRect(startX, PANEL_Y, 150, 64, 12);
    this.timerBg
      .fillStyle(urgent ? C.alarm : C.coal, 1)
      .fillRoundedRect(startX + 3, PANEL_Y + 3, 144, 58, 10);
    this.timerText.setText(urgent ? `¡${secs}s!` : `${secs} s`).setColor(urgent ? S.ink : S.bone);

    // Wind: arrow shape whose length grows with strength
    const wnd = core.wind;
    this.windG.clear();
    const bx = startX + 162;
    this.windG.fillStyle(C.ink, 1).fillRoundedRect(bx, PANEL_Y, 310, 64, 12);
    this.windText.setText(wnd === 0 ? 'Viento: 0' : `Viento ${Math.abs(wnd)}`);
    if (wnd !== 0) {
      const dir = wnd > 0 ? 1 : -1;
      const len = 12 + Math.abs(wnd) * 6;
      const cx = bx + 310 - 36;
      this.windG.fillStyle(C.volt, 1);
      this.windG.fillRect(Math.min(cx - dir * len, cx), PANEL_Y + 28, len, 8);
      this.windG.fillTriangle(cx + dir * 14, PANEL_Y + 32, cx, PANEL_Y + 16, cx, PANEL_Y + 48);
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
      label.setColor(sel ? S.ink : S.bone);
      wb.btn.setLabel('');
    }

    this.tauntBtn.setEnabled(canAct);

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
    const mx = POWER_X + 4 + ((POWER_W - 8) * (pw - 10)) / 90;
    g.fillStyle(C.bone, 1).fillTriangle(mx - 10, by + 100, mx + 10, by + 100, mx, by + 86);

    this.fireBtn.setEnabled(canAct);
  }
}

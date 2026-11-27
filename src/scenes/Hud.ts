import Phaser from 'phaser';
import { ABILITIES, WEAPONS } from '../core/data';
import { windVisual } from '../core/windVisual';
import { AchievementToast } from '../ui/achievementToast';
import { isMobile } from '../ui/device';
import { HealthBar } from '../ui/healthBar';
import { settings } from '../ui/settings';
import { BTN, C, S, W } from '../ui/theme';
import { designPoint } from '../ui/stage';
import { Button, txt } from '../ui/widgets';
import { setIconFrame } from '../ui/atlasRefs';
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
 * El HUD vive en su propia escena sobre el combate: botones de 104 px y texto de al menos 32 px.
 * Arriba, un panel por equipo (retrato, nombre, barra de vida grande, íconos de resistencia, bono y habilidad).
 * Solo lee el estado del núcleo a través de Battle y le pasa las acciones del jugador.
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
  private achToast!: AchievementToast;
  private noticeG!: Phaser.GameObjects.Graphics;
  private noticeText!: Phaser.GameObjects.Text;
  private noticeTimer?: Phaser.Time.TimerEvent;
  private ammoText!: Phaser.GameObjects.Text;
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

  /** True si un punto de la pantalla es de un control del HUD (así arrastrar ahí no apunta). */
  hits(x: number, y: number): boolean {
    const d = designPoint(this, { x, y });
    return this.zones.some((z) => z.contains(d.x, d.y));
  }

  private zone(x: number, y: number, w: number, h: number): void {
    this.zones.push(new Phaser.Geom.Rectangle(x, y, w, h));
  }

  create(): void {
    this.mobile = isMobile();

    const units = this.battle.core.units;
    this.panels = units.map((u, i) =>
      this.makePanel(i as PlayerId, i === 0 ? PAD : W - PAD - PANEL_W, u.selection.head),
    );

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
    this.achToast = new AchievementToast(this, 300);
    this.noticeG = this.add.graphics().setDepth(3).setVisible(false);
    this.noticeText = txt(this, W / 2 + 50, 300, '', {
      title: true,
      size: 40,
      origin: [0.5, 0.5],
      color: S.volt,
      raw: true,
    })
      .setDepth(4)
      .setVisible(false);
    new Button(this, startX + 162 + 310 + 12, PANEL_Y - 8, BTN, BTN, '', {
      icon: 'hud-pause',
      onClick: () => this.battle.requestPause(),
    });
    this.zone(startX + 162 + 310 + 12, PANEL_Y - 8, BTN, BTN + 8);
    new Button(this, PAD, PANEL_Y + PANEL_H + 16, BTN, BTN, '', {
      icon: 'ui-help',
      onClick: () => this.battle.openHelp(),
    });
    this.zone(PAD, PANEL_Y + PANEL_H + 16, BTN, BTN);
    // "Burlar": 1 s de actitud, no gasta el turno
    this.tauntBtn = new Button(this, PAD + BTN + 12, PANEL_Y + PANEL_H + 16, 200, BTN, 'Burlar', {
      size: 32,
      onClick: () => this.battle.tauntCurrent(),
    });
    this.zone(PAD + BTN + 12, PANEL_Y + PANEL_H + 16, 200, BTN);
    this.zone(PAD, PANEL_Y, PANEL_W, PANEL_H);
    this.zone(W - PAD - PANEL_W, PANEL_Y, PANEL_W, PANEL_H);

    const by = 900 - PAD - BTN;
    this.zone(0, by - 8, W, BTN + PAD + 8);
    this.weaponBtns = [];
    // Carrusel: [<] arma actual (ícono, nombre, munición) [>]; sirve con cualquier cantidad de armas.
    const cx0 = PAD + BTN + 12;
    new Button(this, PAD, by, BTN, BTN, '<', { title: true, size: 44, onClick: () => this.cycleWeapon(-1) });
    new Button(this, cx0 + 300 + 12, by, BTN, BTN, '>', {
      title: true,
      size: 44,
      onClick: () => this.cycleWeapon(1),
    });
    for (let i = 0; i < 1; i++) {
      const x = cx0;
      const btn = new Button(this, x, by, 300, BTN, '', {
        onClick: () => this.battle.chooseWeapon(this.weaponBtns[i].id),
      });
      const icon = this.add.image(x + 56, by + BTN / 2, 'atlas', 'wicon_cannon').setScale(0.5);
      const label = txt(this, x + 108, by + BTN / 2, '', { origin: [0, 0.5], width: 180, size: 32 });
      btn.setData('label', label);
      this.ammoText = txt(this, x + 292, by + 18, '', {
        origin: [1, 0.5],
        size: 32,
        color: S.volt,
        stroke: true,
      });
      this.weaponBtns.push({ btn, id: '', icon });
    }
    this.abilityBtn = new Button(this, cx0 + 300 + 12 + BTN + 12, by, 230, BTN, 'Habilidad', {
      kind: 'ability',
      onClick: () => this.battle.doAbility(),
    });

    this.powerG = this.add.graphics();
    this.powerText = txt(this, POWER_X, by - 4, '', { stroke: true });
    const hit = this.add
      .zone(POWER_X - 16, by + 40, POWER_W + 32, 64)
      .setOrigin(0, 0)
      .setInteractive();
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.draggingPower = true;
      this.setPowerFromX(designPoint(this, p).x);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.draggingPower && p.isDown) this.setPowerFromX(designPoint(this, p).x);
    });
    this.input.on('pointerup', () => (this.draggingPower = false));
    this.fireBtn = new Button(this, W - PAD - 220, by, 220, BTN, '¡Fuego!', {
      kind: 'danger',
      title: true,
      size: 40,
      onClick: () => this.battle.doFire(),
    });

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
    // marco del retrato y ficha de forma (círculo = J1, rombo = J2)
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
    const res = u.stats.resistance;
    const dmg = u.stats.damage - 100;
    p.resIcon.setVisible(res > 0);
    p.resText.setText(res > 0 ? `${res}%` : '').setVisible(res > 0);
    p.dmgIcon.setVisible(dmg > 0);
    p.dmgText.setText(dmg > 0 ? `+${dmg}%` : '').setVisible(dmg > 0);
    const ag = p.abilityG;
    ag.clear();
    if (u.ability) {
      // Rayo: brillante si se puede usar, apagado y tachado una vez usado.
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

  /** Mueve el carrusel al siguiente arma que aún tenga munición. */
  private cycleWeapon(dir: 1 | -1): void {
    const core = this.battle.core;
    const u = core.current;
    const n = u.weapons.length;
    const at = u.weapons.indexOf(u.weapon);
    for (let k = 1; k <= n; k++) {
      const id = u.weapons[(at + dir * k + n * k) % n];
      if (id !== u.weapon && core.hasAmmo(u, id)) {
        this.battle.chooseWeapon(id);
        return;
      }
    }
  }

  private setPowerFromX(x: number): void {
    const t = Phaser.Math.Clamp((x - POWER_X) / POWER_W, 0, 1);
    this.battle.setPower(Math.round(10 + t * 90));
  }

  /** Panel de viento: manga, "Viento N" y una flecha por nivel. */
  private drawWind(wnd: number): void {
    const v = windVisual(wnd);
    const g = this.windG;
    const bx = W / 2 - 294 + 162;
    g.clear();
    g.fillStyle(C.ink, 1).fillRoundedRect(bx, PANEL_Y, 310, 64, 12);
    this.windText
      .setPosition(bx + 66, PANEL_Y + 32)
      .setText(v.direction === 0 ? 'Viento 0' : `Viento ${v.sockLevel}`);
    const px = bx + 24;
    const py = PANEL_Y + 54;
    const top = PANEL_Y + 20;
    g.lineStyle(4, C.steel, 1).lineBetween(px, py, px, top);
    const t = settings.reduceEffects ? 0 : this.time.now / 1000;
    const droop = (Math.PI / 2) * (1 - v.sockLevel / 5) * 0.9;
    const dir = v.direction || 1;
    let x = px;
    let y = top;
    let ang = v.direction === 0 ? Math.PI / 2 : dir > 0 ? droop : Math.PI - droop;
    const inflate = 0.55 + v.sockLevel * 0.09;
    for (let i = 0; i < 4; i++) {
      const r0 = 9 * inflate * (1 - i * 0.14);
      const r1 = 9 * inflate * (1 - (i + 1) * 0.14);
      ang += Math.sin(t * 9 + i * 1.3) * 0.07 * v.sockLevel;
      const nx = x + Math.cos(ang) * 9;
      const ny = y + Math.sin(ang) * 9;
      const sx = -Math.sin(ang);
      const sy = Math.cos(ang);
      g.fillStyle(i % 2 ? C.bone : 0xff9a4d, 1);
      g.fillPoints(
        [
          new Phaser.Geom.Point(x + sx * r0, y + sy * r0),
          new Phaser.Geom.Point(nx + sx * r1, ny + sy * r1),
          new Phaser.Geom.Point(nx - sx * r1, ny - sy * r1),
          new Phaser.Geom.Point(x - sx * r0, y - sy * r0),
        ],
        true,
      );
      x = nx;
      y = ny;
    }
    for (let i = 0; i < 5; i++) {
      const ax = bx + 216 + i * 18;
      const on = i < v.arrows;
      g.fillStyle(on ? C.volt : C.disabled, on ? 1 : 0.35);
      const d = v.direction || 1;
      g.fillTriangle(ax + d * 8, PANEL_Y + 32, ax - d * 6, PANEL_Y + 20, ax - d * 6, PANEL_Y + 44);
    }
  }

  /** Queues the "¡Logro desbloqueado!" toast (never blocks the combat). */
  achievement(id: string): void {
    this.achToast.show(id);
  }

  /** Aviso de 1,2 s al empezar el turno: flechas y fuerza del viento nuevo. */
  windNotice(wnd: number): void {
    const v = windVisual(wnd);
    if (!v.notice) return;
    const g = this.noticeG.clear().setVisible(true);
    const cx = W / 2;
    const cy = 300;
    g.fillStyle(C.ink, 0.92).fillRoundedRect(cx - 270, cy - 44, 540, 88, 14);
    g.lineStyle(4, C.volt, 1).strokeRoundedRect(cx - 270, cy - 44, 540, 88, 14);
    for (let i = 0; i < v.arrows; i++) {
      const ax = cx - 250 + i * 34;
      g.fillStyle(C.volt, 1).fillTriangle(
        ax + v.direction * 14,
        cy,
        ax - v.direction * 10,
        cy - 20,
        ax - v.direction * 10,
        cy + 20,
      );
    }
    this.noticeText.setText(`Viento ${v.sockLevel}`).setVisible(true);
    this.noticeTimer?.remove();
    this.noticeTimer = this.time.delayedCall(1200, () => {
      this.noticeG.setVisible(false);
      this.noticeText.setVisible(false);
    });
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
    this.achToast.update(delta);
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

    // Paneles de equipo: las barras se animan en cada cuadro y el marco fijo solo se redibuja si cambia.
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
      JSON.stringify(u.ammo),
      u.abilityUsed,
      u.aimPower,
      canAct,
      settings.highContrast,
    ].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;

    const startX = W / 2 - 294;
    // Reloj: normal = carbón; en los últimos 5 s = alarma con signos de exclamación
    this.timerBg.clear();
    this.timerBg.fillStyle(C.ink, 1).fillRoundedRect(startX, PANEL_Y, 150, 64, 12);
    this.timerBg
      .fillStyle(urgent ? C.alarm : C.coal, 1)
      .fillRoundedRect(startX + 3, PANEL_Y + 3, 144, 58, 10);
    this.timerText.setText(urgent ? `¡${secs}s!` : `${secs} s`).setColor(urgent ? S.ink : S.bone);

    // Viento: una manga que apunta, se infla y ondea con el viento, más una flecha por nivel (nunca solo color)
    this.drawWind(core.wind);

    for (let i = 0; i < this.weaponBtns.length; i++) {
      const wb = this.weaponBtns[i];
      const id = u.weapon;
      const label = wb.btn.data.get('label') as Phaser.GameObjects.Text;
      wb.btn.setVisible(!!id);
      wb.icon.setVisible(!!id);
      label.setVisible(!!id);
      if (!id) continue;
      wb.id = id;
      const def = WEAPONS[id];
      setIconFrame(wb.icon, def.icon, 56);
      label.setText(def.name);
      const left = u.ammo[id];
      this.ammoText.setText(left === undefined ? '∞' : `×${left}`).setColor(left === 0 ? S.alarm : S.volt);
      const sel = u.weapon === id;
      wb.btn.setSelected(sel).setEnabled(canAct);
      label.setColor(sel ? S.ink : S.bone);
      wb.btn.setLabel('');
    }

    this.tauntBtn.setEnabled(canAct);

    const ab = u.ability ? ABILITIES[u.ability] : undefined;
    if (!ab) {
      this.abilityBtn.setLabel('Sin habilidad').setEnabled(false);
    } else if (u.abilityUsed) {
      this.abilityBtn.setLabel('Habilidad usada').setEnabled(false);
    } else {
      this.abilityBtn.setLabel(`${ab.name}`).setEnabled(canAct);
    }

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

import Phaser from 'phaser';
import { ABILITIES, DONOR_IDS, PARTS, SLOTS, WEAPONS, type Slot } from '../core/data';
import { decodeDna, encodeDna } from '../core/dna';
import { Rng, newSeed } from '../core/rng';
import {
  abilityFor,
  budgetOf,
  computeStats,
  partFor,
  randomSelection,
  weaponsFor,
  type Selection,
} from '../core/stats';
import { resolveBack, selectionsEqual } from '../core/flow';
import { sfx } from '../ui/audio';
import { pushBackHandler } from '../ui/backNav';
import { openConfirm } from '../ui/modal';
import { CreatureView, forcedSelection } from '../ui/creatureView';
import { resetCreatures, session } from '../ui/session';
import { settings } from '../ui/settings';
import { C, FONT_BODY, H, S, W } from '../ui/theme';
import { atlasRef } from '../ui/atlasRefs';
import { Button, enableKeyboardFocus, fadeIn, goTo, panel, txt } from '../ui/widgets';

const SLOT_LABEL: Record<Slot, string> = { head: 'Cabeza', torso: 'Torso', arms: 'Brazos', legs: 'Piernas' };
const DEFAULT_SELECTION: Selection = {
  head: 'armadura',
  torso: 'espantapajaros',
  arms: 'maniqui',
  legs: 'juguete',
};

function effectLabel(donor: string, slot: Slot): string {
  const e = partFor(donor, slot).effect;
  if (e.res) return `Res. +${e.res}%`;
  if (e.hp) return `Vida +${e.hp}`;
  if (e.mob) return `Mov. +${e.mob}%`;
  if (e.dmg) return `Daño +${e.dmg}%`;
  return '—';
}

/** Insignia del jugador: color Y forma (círculo = J1, cuadrado = J2) para no depender solo del color. */
export function playerBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  player: 1 | 2,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const color = player === 1 ? C.p1 : C.p2;
  const label = txt(scene, 64, 28, `Jugador ${player}`, {
    title: true,
    size: 32,
    color: S.ink,
    origin: [0, 0.5],
    raw: true,
  });
  const w = 64 + label.width + 20;
  g.fillStyle(color, 1).fillRoundedRect(0, 0, w, 56, 12);
  g.lineStyle(4, C.ink, 1).strokeRoundedRect(2, 2, w - 4, 56 - 4, 12);
  g.fillStyle(C.ink, 1);
  if (player === 1) g.fillCircle(32, 28, 13);
  else g.fillRect(19, 15, 26, 26);
  c.add([g, label]);
  return c;
}

export class Lab extends Phaser.Scene {
  private player: 1 | 2 = 1;
  private sel!: Selection;
  private slot: Slot = 'head';
  private view!: CreatureView;
  private statTexts: Phaser.GameObjects.Text[] = [];
  private tabs: Button[] = [];
  private rows: { btn: Button; swatch: Phaser.GameObjects.Image; donor: string }[] = [];
  private budgetText!: Phaser.GameObjects.Text;
  private budgetBar!: Phaser.GameObjects.Graphics;
  private listo!: Button;
  private info!: Phaser.GameObjects.Container;
  private adnMsg!: Phaser.GameObjects.Text;
  private adnInput!: HTMLInputElement;
  private msgTimer?: Phaser.Time.TimerEvent;
  private baseline!: Selection;
  private modalOpen = false;
  private backBtn!: Button;
  private focusables: Button[] = [];
  private kbFocus?: { hasFocus: () => boolean; clear: () => void };

  constructor() {
    super('Lab');
  }

  init(data: { player?: 1 | 2 }): void {
    this.player = data.player ?? 1;
    const prev = session.selections[this.player - 1];
    this.baseline = { ...(prev ?? DEFAULT_SELECTION) };
    this.sel = forcedSelection({ ...(session.drafts[this.player - 1] ?? this.baseline) });
    this.modalOpen = false;
    this.slot = 'head';
  }

  create(): void {
    fadeIn(this);
    this.tabs = [];
    this.rows = [];
    this.statTexts = [];
    this.add.rectangle(0, 0, W, H, C.coal).setOrigin(0);
    this.add.rectangle(0, 0, W, H, 0x26223a, 0.6).setOrigin(0);

    this.backBtn = new Button(this, 48, 6, 200, 104, '‹ Atrás', { onClick: () => this.requestBack() });
    txt(this, 272, 30, 'Laboratorio', { title: true, size: 44, stroke: true, raw: true });
    playerBadge(this, 660, 30, this.player);
    txt(this, W - 48, 30, 'Elige una pieza por cada parte', { origin: [1, 0] });

    panel(this, 48, 116, 782, 660, C.night, 16);
    this.add.rectangle(52, 696, 774, 76, 0x4a4466).setOrigin(0).setAlpha(0);
    this.add.rectangle(52, 660, 774, 6, 0xa99be0).setOrigin(0).setAlpha(0);
    const floor = this.add.graphics();
    floor.fillStyle(0x4a4466, 1).fillRect(52, 630, 774, 14);
    floor.fillStyle(0xa99be0, 1).fillRect(52, 630, 774, 5);
    this.view = new CreatureView(this, 560, 632, this.sel, 1.0);
    this.view.idle(this, 0);
    this.info = this.add.container(0, 0);

    SLOTS.forEach((s, i) => {
      const b = new Button(this, 870 + i * 173, 116, 163, 104, SLOT_LABEL[s], {
        kind: 'tab',
        size: 32,
        onClick: () => {
          this.slot = s;
          this.refresh();
        },
      });
      this.tabs.push(b);
    });
    DONOR_IDS.forEach((d, i) => {
      const y = 228 + i * 108;
      const btn = new Button(this, 870, y, 682, 104, '', {
        kind: 'secondary',
        onClick: () => {
          this.sel[this.slot] = d;
          this.refresh();
        },
      });
      const swatch = this.add.image(870 + 56, y + 52, 'atlas', `icon_${d}`);
      const name = txt(this, 870 + 112, y + 52, PARTS.donors[d].name, { origin: [0, 0.5], color: S.bone });
      const eff = txt(this, 870 + 520, y + 52, '', { origin: [1, 0.5], size: 32 });
      const cost = txt(this, 870 + 664, y + 52, '', { title: true, size: 32, origin: [1, 0.5], raw: true });
      btn.setData({ name, eff, cost });
      this.rows.push({ btn, swatch, donor: d });
    });

    this.budgetText = txt(this, 48, 788, '');
    this.budgetBar = this.add.graphics();

    this.adnMsg = txt(this, 810, 132, '', { origin: [1, 0], color: S.bone });
    const dom = this.add.dom(540, 790, 'input').setOrigin(0, 0);
    this.adnInput = dom.node as HTMLInputElement;
    const st = this.adnInput.style;
    st.cssText = `width:200px;height:104px;box-sizing:border-box;padding:0 12px;background:${S.ink};color:${S.bone};font:800 32px ${FONT_BODY};border:4px solid #4A4466;border-radius:12px;text-transform:uppercase;outline:none;`;
    this.adnInput.maxLength = 8;
    this.adnInput.placeholder = 'Código';
    this.adnInput.setAttribute('aria-label', 'Código ADN');
    this.adnInput.autocomplete = 'off';
    this.adnInput.spellcheck = false;
    this.adnInput.addEventListener('input', () => this.setAdnState('idle'));
    this.adnInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.applyAdn();
      if (e.key === 'Escape') {
        this.adnInput.blur();
        this.requestBack();
      }
    });
    new Button(this, 748, 790, 140, 104, 'Cargar', { onClick: () => this.applyAdn() });
    new Button(this, 896, 790, 140, 104, 'Copiar', { onClick: () => this.copyAdn() });
    new Button(this, 1112, 790, 180, 104, 'Al azar', {
      title: true,
      onClick: () => {
        this.sel = randomSelection(new Rng(newSeed()));
        this.setAdnState('idle');
        this.refresh();
      },
    });
    this.listo = new Button(this, 1302, 790, 250, 104, '', {
      kind: 'primary',
      title: true,
      onBlocked: () => this.flashBudget(),
      onClick: () => this.done(),
    });
    this.focusables = [this.backBtn, ...this.tabs, ...this.rows.map((r) => r.btn), this.listo];
    this.kbFocus = enableKeyboardFocus(this, () => (this.modalOpen ? [] : this.focusables));
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.modalOpen || this.kbFocus?.hasFocus() || document.activeElement === this.adnInput) return;
      this.done();
    });
    this.input.keyboard?.on('keydown-ESC', () => this.requestBack());
    const pop = pushBackHandler(() => this.requestBack());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, pop);
    this.refresh();
  }

  private get dirty(): boolean {
    return !selectionsEqual(this.sel, this.baseline);
  }

  /** Atrás: button, Esc, browser back or phone back gesture. */
  private requestBack(): void {
    if (this.modalOpen) return;
    const r = resolveBack({ screen: this.player === 1 ? 'lab1' : 'lab2', dirty: this.dirty });
    if (r.kind === 'go') {
      this.leave(r.to, r.keepDraft);
      return;
    }
    this.modalOpen = true;
    this.adnInput.blur();
    openConfirm(
      this,
      r.message,
      () => this.leave(r.to, r.keepDraft),
      () => (this.modalOpen = false),
    );
  }

  private leave(to: 'menu' | 'lab1', keepDraft: boolean): void {
    if (keepDraft) session.drafts[this.player - 1] = { ...this.sel };
    if (to === 'menu') {
      resetCreatures();
      goTo(this, 'Menu');
    } else {
      goTo(this, 'Lab', { player: 1 });
    }
  }

  private flashBudget(): void {
    if (settings.reduceEffects) return;
    this.tweens.add({
      targets: this.budgetText,
      x: 60,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.budgetText.setX(48),
    });
  }

  private done(): void {
    if (budgetOf(this.sel).over) {
      sfx('error');
      this.flashBudget();
      return;
    }
    session.selections[this.player - 1] = { ...this.sel };
    session.drafts[this.player - 1] = null;
    if (this.player === 1) goTo(this, 'PassDevice');
    else goTo(this, 'Battle');
  }

  private setAdnState(state: 'idle' | 'ok' | 'error', msg = ''): void {
    const color = state === 'error' ? '#FF5468' : state === 'ok' ? '#7CFF4F' : '#4A4466';
    this.adnInput.style.borderColor = color;
    this.adnMsg.setText(msg);
    this.adnMsg.setColor(state === 'error' ? S.alarmSoft : S.acid);
    this.msgTimer?.remove();
    if (msg) this.msgTimer = this.time.delayedCall(3500, () => this.adnMsg.setText(''));
  }

  private applyAdn(): void {
    const parsed = decodeDna(this.adnInput.value);
    if (!parsed) {
      sfx('error');
      this.setAdnState('error', 'Código inválido');
      return;
    }
    this.sel = parsed;
    this.refresh();
    this.setAdnState('ok', 'ADN cargado');
    sfx('pickup');
  }

  private copyAdn(): void {
    const code = encodeDna(this.sel);
    this.adnInput.value = code;
    const ok = () => this.setAdnState('ok', `Copiado: ${code}`);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(ok, ok);
    else ok();
  }

  /** Vuelve a dibujar todo lo que depende de la selección. */
  private refresh(): void {
    const sel = this.sel;
    SLOTS.forEach((s, i) => this.tabs[i].setSelected(s === this.slot));
    for (const r of this.rows) {
      const data = r.btn.data.getAll() as { eff: Phaser.GameObjects.Text; cost: Phaser.GameObjects.Text };
      const picked = sel[this.slot] === r.donor;
      r.btn.setSelected(picked);
      r.swatch.setTexture('atlas', `icon_${r.donor}`);
      const box = 76;
      r.swatch.setScale(Math.min(box / r.swatch.width, box / r.swatch.height));
      data.eff.setText(effectLabel(r.donor, this.slot));
      data.cost.setText(`${partFor(r.donor, this.slot).cost} pts`);
      const fg = picked ? S.ink : S.bone;
      data.eff.setColor(fg);
      data.cost.setColor(fg);
      (r.btn.data.get('name') as Phaser.GameObjects.Text).setColor(fg);
    }
    this.view.destroy();
    this.view = new CreatureView(this, 560, 632, sel, 1.0);
    this.view.idle(this, 0);
    this.view.setAim(1, 15);
    const st = computeStats(sel);
    const base = PARTS.base;
    this.statTexts.forEach((t) => t.destroy());
    const lines: [string, string, boolean][] = [
      ['Vida', `${st.hp}`, st.hp > base.hp],
      ['Mov.', `${st.mobility}%`, st.mobility > base.mobility],
      ['Res.', `${st.resistance}%`, st.resistance > base.resistance],
      ['Daño', `${st.damage}%`, st.damage > base.damage],
    ];
    lines.forEach(([n, v, up], i) => {
      this.statTexts.push(txt(this, 72, 140 + i * 44, n, { stroke: true }));
      this.statTexts.push(
        txt(this, 200, 140 + i * 44, v + (up ? ' ▲' : ''), {
          title: true,
          size: 32,
          color: up ? S.acid : S.bone,
          stroke: true,
          raw: true,
        }),
      );
    });
    this.info.removeAll(true);
    const ab = abilityFor(sel);
    if (ab) this.info.add(txt(this, 72, 640, `Habilidad: ${ABILITIES[ab].name}`, { color: S.volt }));
    weaponsFor(sel).forEach((w, i) => {
      const def = WEAPONS[w];
      const ic = this.add.image(72 + 20, 704 + i * 44, ...atlasRef(def.icon));
      ic.setScale(40 / ic.width);
      this.info.add([ic, txt(this, 72 + 52, 704 + i * 44, def.name, { origin: [0, 0.5] })]);
    });
    const b = budgetOf(sel);
    this.budgetText.setText(
      b.over ? `Te pasaste: ${b.total} / ${b.limit} puntos` : `Presupuesto: ${b.total} / ${b.limit} puntos`,
    );
    this.budgetText.setColor(b.over ? S.alarmSoft : S.bone);
    const g = this.budgetBar;
    g.clear();
    g.fillStyle(C.ink, 1).fillRoundedRect(48, 846, 480, 32, 16);
    g.fillStyle(b.over ? C.alarm : C.acid, 1).fillRoundedRect(
      52,
      850,
      Math.max(8, 472 * Math.min(1, b.total / b.limit)),
      24,
      12,
    );
    // Pasarse del presupuesto también lleva un patrón de rayas (no solo color).
    if (b.over) {
      g.lineStyle(4, C.ink, 0.6);
      for (let x = 60; x < 520; x += 24) g.lineBetween(x, 874, x + 16, 852);
    }
    this.listo.setLabel(b.over ? 'Sin presupuesto' : this.player === 2 ? '¡A combatir!' : 'Listo');
    this.listo.setEnabled(!b.over);
  }
}

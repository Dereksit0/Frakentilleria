import Phaser from 'phaser';
import { PARTS } from '../core/data';
import { ACHIEVEMENTS, COSMETICS, sharedCollection } from '../core/rewards';
import { Rng } from '../core/rng';
import type { Selection } from '../core/stats';
import { startMusic } from '../ui/audio';
import { CreatureView } from '../ui/creatureView';
import { pushBackHandler } from '../ui/backNav';
import { newMatchSeed, resetCreatures } from '../ui/session';
import { settings } from '../ui/settings';
import { C, H, S, W } from '../ui/theme';
import { Button, fadeIn, goTo, panel, txt } from '../ui/widgets';
import { playerBadge } from './Lab';

interface ResultData {
  winner: number | null;
  rounds: number;
  damage: [number, number];
  bestShot: [number, number];
  hpLeft?: [number, number];
  comeback?: [boolean, boolean];
  deathCause?: string | null;
  weaponsUsed?: string[];
  seed?: number;
  selections: [Selection | null, Selection | null];
}

/** Match summary: winner (or draw), stats, and the rematch / change creatures / menu choices. */
export class Result extends Phaser.Scene {
  private data0!: ResultData;

  constructor() {
    super('Result');
  }

  init(data: ResultData): void {
    this.data0 = data;
  }

  create(): void {
    fadeIn(this);
    startMusic(this);
    const pop = pushBackHandler(() => goTo(this, 'Menu'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, pop);
    this.input.keyboard?.on('keydown-ESC', () => goTo(this, 'Menu'));
    const d = this.data0;
    const draw = d.winner === null;
    this.add.rectangle(0, 0, W, H, C.coal).setOrigin(0);
    this.add.rectangle(0, 0, W, H, draw ? C.night : C.storm, 0.35).setOrigin(0);

    const logo = this.add.image(190, 60, 'logo');
    logo.setScale(Math.min(240 / logo.width, 1));
    txt(this, W / 2, 90, draw ? '¡Empate!' : `¡Gana el Jugador ${(d.winner ?? 0) + 1}!`, {
      title: true,
      size: 72,
      origin: [0.5, 0.5],
      color: S.volt,
      stroke: true,
      raw: true,
    });
    const sels = d.selections;
    let reason = 'Las dos criaturas cayeron en el mismo turno';
    if (!draw && sels[d.winner as number]) {
      const donor = PARTS.donors[(sels[d.winner as number] as Selection).torso].name;
      reason = `Su ${donor} aguantó hasta el final`;
    }
    txt(this, W / 2, 170, reason, { size: 36, origin: [0.5, 0.5] });

    // Creatures: the winner stands tall, the loser is greyed out
    ([0, 1] as const).forEach((i) => {
      const sel = sels[i];
      if (!sel) return;
      const x = i === 0 ? 360 : W - 300;
      const isWinner = d.winner === i;
      const v = new CreatureView(this, x, 640, sel, draw ? 0.7 : isWinner ? 0.85 : 0.6);
      v.setAim(i === 0 ? 1 : -1, isWinner ? 55 : -10);
      if (isWinner) {
        v.idle(this, i);
        if (!settings.reduceEffects) this.tweens.add({ targets: v, y: v.y - 18, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
      } else if (!draw) {
        v.setGrayed(true);
        v.setAngle(i === 0 ? -80 : 80);
      } else {
        v.setGrayed(true);
      }
      playerBadge(this, x - 110, 230, (i + 1) as 1 | 2);
    });

    // Stats card
    panel(this, W / 2 - 250, 250, 500, 330, C.night);
    const lines = [
      `Rondas: ${d.rounds}`,
      `Daño J1: ${d.damage[0]}`,
      `Daño J2: ${d.damage[1]}`,
      `Mejor tiro: ${Math.max(d.bestShot[0], d.bestShot[1])}`,
    ];
    lines.forEach((l, i) => txt(this, W / 2, 288 + i * 70, l, { origin: [0.5, 0], size: 40 }));

    // Rewards: patch chest + achievements (recorded once per match, never in the middle of a rematch loop).
    const rewards = sharedCollection().recordMatch(
      {
        winner: d.winner,
        rounds: d.rounds,
        damage: d.damage,
        bestShot: d.bestShot,
        hpLeft: d.hpLeft ?? [0, 0],
        comeback: d.comeback ?? [false, false],
        deathCause: d.deathCause ?? null,
        weaponsUsed: d.weaponsUsed ?? [],
      },
      new Rng((d.seed ?? 1) ^ 0xc0ffee),
    );
    const names = rewards.chest.map((id) => COSMETICS.items.find((i) => i.id === id)?.name ?? id);
    txt(this, W / 2, 604, names.length ? `Cofre de remiendos: ${names.join(' y ')}` : 'Cofre de remiendos: ¡ya tienes todo!', {
      size: 32,
      origin: [0.5, 0],
      color: S.volt,
      stroke: true,
    });
    const ach = rewards.achievements.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id);
    if (ach.length) txt(this, W / 2, 652, `Logro: ${ach.join(' · ')}`, { size: 32, origin: [0.5, 0], stroke: true });

    // Buttons
    const bw = 440;
    new Button(this, W / 2 - bw - 20 - bw / 2 + 0, 740, bw, 104, 'Revancha', {
      kind: 'primary',
      leftIcon: 'ui-rematch',
      title: true,
      onClick: () => {
        newMatchSeed();
        goTo(this, 'Battle');
      },
    });
    new Button(this, W / 2 - bw / 2, 740, bw, 104, 'Cambiar criaturas', {
      onClick: () => {
        newMatchSeed();
        resetCreatures();
        goTo(this, 'Lab', { player: 1 });
      },
    });
    new Button(this, W / 2 + bw / 2 + 20, 740, bw, 104, 'Menú', { leftIcon: 'ui-home', onClick: () => goTo(this, 'Menu') });
  }
}

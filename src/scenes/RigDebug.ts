import Phaser from 'phaser';
import { DONOR_IDS } from '../core/data';
import { RIG, type RigData } from '../core/rig';
import type { Selection, Slot } from '../core/stats';
import { CreatureView, forcedSelection } from '../ui/creatureView';
import { FONT_BODY, H, W } from '../ui/theme';

const SLOTS: Slot[] = ['head', 'torso', 'arms', 'legs'];
const ANCHORS: Record<Slot, string[]> = {
  head: ['neck'],
  torso: ['neck', 'hip', 'shoulderFront', 'shoulderBack'],
  arms: ['shoulder', 'muzzle'],
  legs: ['hipTop', 'ground'],
};

/**
 * Development-only rig calibrator (open it with F2 when the page has ?debug=rig).
 *   1-4 choose the piece · [ ] change its donor · Tab next anchor · arrows move it (Shift = 5 px)
 *   A / D aim · C copies the "manual" JSON for src/data/rig.json · Esc back to the menu
 */
export class RigDebug extends Phaser.Scene {
  private sel: Selection = { head: 'armadura', torso: 'armadura', arms: 'armadura', legs: 'armadura' };
  private rigData!: RigData;
  private manual: Record<string, [number, number]> = {};
  private slot = 1;
  private anchor = 0;
  private aim = 20;
  private view: CreatureView | null = null;
  private info!: Phaser.GameObjects.Text;
  private zoomG!: Phaser.GameObjects.Graphics;
  private zoomImg: Phaser.GameObjects.Image | null = null;

  constructor() {
    super('RigDebug');
  }

  create(): void {
    this.sel = forcedSelection(this.sel);
    this.rigData = JSON.parse(JSON.stringify(RIG)) as RigData;
    this.manual = { ...(this.rigData.manual ?? {}) } as Record<string, [number, number]>;
    this.add.rectangle(0, 0, W, H, 0x2e2a47).setOrigin(0);
    this.info = this.add
      .text(24, 20, '', { fontFamily: FONT_BODY, fontSize: '26px', color: '#F4EFE1', lineSpacing: 6 })
      .setDepth(10);
    this.zoomG = this.add.graphics().setDepth(5);
    const kb = this.input.keyboard!;
    const on = (k: string, fn: (e: KeyboardEvent) => void) => kb.on(`keydown-${k}`, fn);
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((k, i) => on(k, () => this.pick(i)));
    on('TAB', (e) => {
      e.preventDefault();
      this.anchor = (this.anchor + 1) % ANCHORS[SLOTS[this.slot]].length;
      this.rebuild();
    });
    on('OPEN_BRACKET', () => this.cycleDonor(-1));
    on('CLOSED_BRACKET', () => this.cycleDonor(1));
    on('A', () => ((this.aim = Math.max(-60, this.aim - 5)), this.rebuild()));
    on('D', () => ((this.aim = Math.min(120, this.aim + 5)), this.rebuild()));
    on('LEFT', (e) => this.move(-1, 0, e));
    on('RIGHT', (e) => this.move(1, 0, e));
    on('UP', (e) => this.move(0, -1, e));
    on('DOWN', (e) => this.move(0, 1, e));
    on('C', () => {
      const text = JSON.stringify(this.manual, null, 1);
      console.log(text);
      void navigator.clipboard?.writeText(text).catch(() => undefined);
      this.info.setText(`Copiado:\n${text}`);
    });
    on('ESC', () => this.scene.start('Menu'));
    this.rebuild();
  }

  private pick(i: number): void {
    this.slot = i;
    this.anchor = 0;
    this.rebuild();
  }

  private cycleDonor(d: number): void {
    const slot = SLOTS[this.slot];
    const i = DONOR_IDS.indexOf(this.sel[slot]);
    this.sel[slot] = DONOR_IDS[(i + d + DONOR_IDS.length) % DONOR_IDS.length];
    this.rebuild();
  }

  private move(dx: number, dy: number, e: KeyboardEvent): void {
    const slot = SLOTS[this.slot];
    const name = ANCHORS[slot][this.anchor];
    const donor = this.sel[slot];
    const piece = this.rigData.pieces[donor][slot] as unknown as Record<string, [number, number]>;
    const k = e.shiftKey ? 5 : 1;
    const p = piece[name];
    if (!p) return;
    piece[name] = [p[0] + dx * k, p[1] + dy * k];
    this.manual[`${donor}.${slot}.${name}`] = piece[name];
    this.rebuild();
  }

  private rebuild(): void {
    this.view?.destroy();
    this.view = new CreatureView(this, 1000, 800, this.sel, 1.5, this.rigData);
    this.view.setAim(1, this.aim);
    const slot = SLOTS[this.slot];
    const name = ANCHORS[slot][this.anchor];
    const donor = this.sel[slot];
    const piece = this.rigData.pieces[donor][slot] as unknown as Record<string, [number, number]>;
    this.info.setText(
      `RIG · pieza ${this.slot + 1}: ${slot} (${donor})  ancla: ${name} = ${JSON.stringify(piece[name])}\n` +
        `1-4 pieza · [ ] donante · Tab ancla · flechas mover (Shift ×5) · A/D apuntar · C copiar JSON · Esc salir`,
    );
    // magnified frame of the selected piece with its anchors
    this.zoomImg?.destroy();
    const Z = 3;
    const ox = 60;
    const oy = 150;
    this.zoomImg = this.add
      .image(ox, oy, 'atlas', `part_${donor}_${slot}`)
      .setOrigin(0)
      .setScale(Z)
      .setDepth(4);
    const g = this.zoomG.clear();
    for (const a of ANCHORS[slot]) {
      const p = piece[a];
      if (!p) continue;
      g.fillStyle(a === name ? 0xff5468 : 0xffe14d, 1).fillCircle(
        ox + p[0] * Z,
        oy + p[1] * Z,
        a === name ? 9 : 6,
      );
    }
  }
}

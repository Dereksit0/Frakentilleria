import type { Rng } from './rng';

export const TURN_TIME = 20;
export const MOVE_TIME = 6;
export const RETREAT_TIME = 3;
const URGENT_TIME = 5;
const WIND_MAX = 5;

export type ClockPhase = 'aim' | 'retreat';

/** Per-turn timer: 20 s total, 6 s of accumulated movement, one attack, then a 3 s retreat. */
export class TurnClock {
  timeLeft = TURN_TIME;
  moveLeft = MOVE_TIME;
  phase: ClockPhase = 'aim';

  reset(moveBonus = 0, frozen = false): void {
    this.timeLeft = TURN_TIME;
    this.moveLeft = frozen ? 0 : MOVE_TIME + moveBonus;
    this.phase = 'aim';
  }

  get ended(): boolean {
    return this.timeLeft <= 0;
  }
  get urgent(): boolean {
    return this.timeLeft <= URGENT_TIME && !this.ended;
  }

  /** Advances the clock; returns true when the turn time is over. */
  tick(dt: number): boolean {
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    return this.ended;
  }

  canMove(): boolean {
    if (this.ended) return false;
    return this.phase === 'retreat' ? true : this.moveLeft > 1e-6;
  }

  /** Consumes movement time and returns how much of `dt` may actually be used. */
  spendMove(dt: number): number {
    if (!this.canMove()) return 0;
    if (this.phase === 'retreat') return dt;
    const granted = Math.min(dt, this.moveLeft);
    this.moveLeft -= granted;
    return granted;
  }

  addMove(seconds: number): void {
    this.moveLeft += seconds;
  }

  /** Starts the retreat. Only one attack per turn. */
  fire(): boolean {
    if (this.phase !== 'aim' || this.ended) return false;
    this.phase = 'retreat';
    this.timeLeft = Math.min(this.timeLeft, RETREAT_TIME);
    return true;
  }
}

/** Who plays next. A round is complete once every player has had a turn. */
export class TurnOrder {
  current = 0;
  round = 1;
  turnNumber = 1;
  constructor(private readonly count: number) {}

  advance(isAlive: (index: number) => boolean): number {
    let next = this.current;
    for (let i = 0; i < this.count; i++) {
      next = (next + 1) % this.count;
      if (isAlive(next)) break;
    }
    // Wrapping past the last player means everyone has played: new round.
    if (next <= this.current) this.round++;
    this.current = next;
    this.turnNumber++;
    return next;
  }
}

export function rollWind(rng: Rng): number {
  return rng.int(-WIND_MAX, WIND_MAX);
}

import { defineConfig } from 'vitest/config';

/** Config for `npm run simulate`: runs the batch simulation script as a long test (see scripts/simulate.sim.ts). */
export default defineConfig({
  test: { include: ['scripts/*.sim.ts'], testTimeout: 3_600_000, hookTimeout: 120_000 },
});

/**
 * Static JSON imports. Metro (and vitest, via its default JSON transform)
 * bundle these directly — no filesystem access at runtime.
 * One manufacturer per file, per docs/specs/bullet-library.md.
 */
import barnes from '../data/barnes.json';
import berger from '../data/berger.json';
import federal from '../data/federal.json';
import hornady from '../data/hornady.json';
import lapua from '../data/lapua.json';
import nosler from '../data/nosler.json';
import rimfire from '../data/rimfire.json';
import sierra from '../data/sierra.json';
import type { LibraryBullet } from './types';

const ALL_SOURCES: readonly (readonly LibraryBullet[])[] = [
  barnes as unknown as readonly LibraryBullet[],
  berger as unknown as readonly LibraryBullet[],
  federal as unknown as readonly LibraryBullet[],
  hornady as unknown as readonly LibraryBullet[],
  lapua as unknown as readonly LibraryBullet[],
  nosler as unknown as readonly LibraryBullet[],
  rimfire as unknown as readonly LibraryBullet[],
  sierra as unknown as readonly LibraryBullet[],
];

/** Flattened, de-duplicated view of every manufacturer JSON file. */
export const ALL_BULLETS: readonly LibraryBullet[] = ALL_SOURCES.flat();

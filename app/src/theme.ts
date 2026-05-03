/**
 * Design tokens for Aim's three display modes.
 * Import `useTheme()` in any component — never hard-code colours.
 */
import { useMemo } from 'react';
import type { DisplayMode } from './store/fieldStore';

export interface Theme {
  bg: string;
  surface: string;
  border: string;
  /** Primary data values — dial, path numbers. */
  primary: string;
  /** Secondary labels — RANGE, VELOCITY headings. */
  label: string;
  /** Dimmed — unit suffixes, separators. */
  dim: string;
  /** Tab bar / navigation chrome. */
  nav: string;
  navBorder: string;
  navActive: string;
  navInactive: string;
  statusBar: 'light' | 'dark';
}

const DAY: Theme = {
  bg: '#000000',
  surface: '#0A0A0A',
  border: '#1A1A1A',
  primary: '#FF0000', // Aggressive tactical red
  label: '#FFFFFF', // High-contrast white for labels
  dim: '#444444',
  nav: '#050505',
  navBorder: '#151515',
  navActive: '#FF0000',
  navInactive: '#333333',
  statusBar: 'light',
};

const BRIGHT: Theme = {
  bg: '#F5F5F0',
  surface: '#FFFFFF',
  border: '#E0E0D8',
  primary: '#CC0000', // Deep red for visibility in bright light
  label: '#1A1A1A',
  dim: '#888888',
  nav: '#FFFFFF',
  navBorder: '#E0E0D8',
  navActive: '#CC0000',
  navInactive: '#AAAAAA',
  statusBar: 'dark',
};

const NIGHT_RED: Theme = {
  bg: '#000000',
  surface: '#080000',
  border: '#150000',
  primary: '#8B0000', // Low-intensity red for night vision preservation
  label: '#5C0000',
  dim: '#2D0000',
  nav: '#050000',
  navBorder: '#100000',
  navActive: '#8B0000',
  navInactive: '#2D0000',
  statusBar: 'light',
};

const THEMES: Record<DisplayMode, Theme> = {
  day: DAY,
  bright: BRIGHT,
  'night-red': NIGHT_RED,
};

export function getTheme(mode: DisplayMode): Theme {
  return THEMES[mode] ?? DAY;
}

export function useTheme(mode: DisplayMode): Theme {
  return useMemo(() => getTheme(mode), [mode]);
}

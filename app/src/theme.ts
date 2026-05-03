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
  bg: '#0D0D0D',
  surface: '#1A1A1A',
  border: '#2A2A2A',
  primary: '#F5A623',
  label: '#AAAAAA',
  dim: '#555555',
  nav: '#1A1A1A',
  navBorder: '#2A2A2A',
  navActive: '#F5A623',
  navInactive: '#555555',
  statusBar: 'light',
};

const BRIGHT: Theme = {
  bg: '#F5F5F0',
  surface: '#FFFFFF',
  border: '#E0E0D8',
  primary: '#1A1A1A',
  label: '#555555',
  dim: '#AAAAAA',
  nav: '#FFFFFF',
  navBorder: '#E0E0D8',
  navActive: '#1A1A1A',
  navInactive: '#AAAAAA',
  statusBar: 'dark',
};

const NIGHT_RED: Theme = {
  bg: '#000000',
  surface: '#0D0000',
  border: '#1A0000',
  primary: '#8B0000',
  label: '#5C0000',
  dim: '#2D0000',
  nav: '#0D0000',
  navBorder: '#1A0000',
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

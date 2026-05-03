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
  bg:          '#0A0A0A',        // True black-ish
  surface:     '#161616',        // Cards / panels — visibly lifted off bg
  border:      '#2C2C2C',        // Visible dividers (was #1A1A1A — invisible)
  primary:     '#FF2200',        // Tactical red — slightly warmer
  label:       '#F0F0F0',        // High-contrast near-white
  dim:         '#8A8A8A',        // 5.9:1 on #0A0A0A — passes WCAG AA (was #444444 — fails)
  nav:         '#0D0D0D',
  navBorder:   '#2C2C2C',
  navActive:   '#FF2200',
  navInactive: '#5A5A5A',        // Readable inactive tab labels (was #333333 — too dark)
  statusBar:   'light',
};

const BRIGHT: Theme = {
  bg:          '#F0F0EB',
  surface:     '#FFFFFF',
  border:      '#C8C8C0',        // More visible dividers in bright mode
  primary:     '#CC0000',
  label:       '#111111',
  dim:         '#666666',        // 4.6:1 on white — passes WCAG AA (was #888 — marginal)
  nav:         '#FFFFFF',
  navBorder:   '#DCDCD4',
  navActive:   '#CC0000',
  navInactive: '#888888',
  statusBar:   'dark',
};

const NIGHT_RED: Theme = {
  bg:          '#000000',
  surface:     '#0D0000',        // Slight red-black for panels
  border:      '#280000',        // Visible red-tinted borders
  primary:     '#8B0000',        // Low-intensity red — preserves night vision
  label:       '#7A0000',        // Lifted from #5C0000 — more legible
  dim:         '#4A0000',        // Lifted from #2D0000 — more legible
  nav:         '#060000',
  navBorder:   '#1A0000',
  navActive:   '#8B0000',
  navInactive: '#4A0000',
  statusBar:   'light',
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

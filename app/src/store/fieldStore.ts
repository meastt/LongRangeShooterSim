/**
 * Field Mode state — range, wind, atmospheric override, display mode, active rifle.
 * Persisted to AsyncStorage so the last session is restored on app relaunch.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AtmosphericConditions } from '@aim/solver';

export type DisplayMode = 'day' | 'bright' | 'night-red';

export interface FieldState {
  /** Selected target range in yards. */
  rangeYards: number;
  windSpeedMph: number;
  /** Clock position 1–12 (12 = head-on, 3 = full value right, etc.) */
  windClockPosition: number;
  /**
   * When null, the solver uses the atmosphere recorded at zero time.
   * When set, overrides temperature, pressure, and RH for the current solve.
   */
  atmosphericOverride: AtmosphericConditions | null;
  displayMode: DisplayMode;
  /** ID of the rifle whose active load + zero feeds the HUD. */
  activeRifleId: string | null;

  // Actions
  setRange: (yards: number) => void;
  setWind: (speedMph: number, clockPosition: number) => void;
  setAtmosphericOverride: (atmo: AtmosphericConditions | null) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  cycleDisplayMode: () => void;
  setActiveRifleId: (id: string | null) => void;
}

const DISPLAY_MODE_CYCLE: DisplayMode[] = ['day', 'bright', 'night-red'];

export const useFieldStore = create<FieldState>()(
  persist(
    (set, get) => ({
      rangeYards: 300,
      windSpeedMph: 0,
      windClockPosition: 3,
      atmosphericOverride: null,
      displayMode: 'day',
      activeRifleId: null,

      setRange: (yards) => set({ rangeYards: Math.max(0, Math.min(1760, yards)) }),
      setWind: (speedMph, clockPosition) =>
        set({ windSpeedMph: speedMph, windClockPosition: clockPosition }),
      setAtmosphericOverride: (atmo) => set({ atmosphericOverride: atmo }),
      setDisplayMode: (mode) => set({ displayMode: mode }),
      cycleDisplayMode: () => {
        const current = get().displayMode;
        const idx = DISPLAY_MODE_CYCLE.indexOf(current);
        const next = DISPLAY_MODE_CYCLE[(idx + 1) % DISPLAY_MODE_CYCLE.length];
        set({ displayMode: next });
      },
      setActiveRifleId: (id) => set({ activeRifleId: id }),
    }),
    {
      name: 'aim-field-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

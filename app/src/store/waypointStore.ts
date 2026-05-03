/**
 * Waypoint store — hunt planning markers persisted across sessions.
 *
 * Types cover the full scouting lifecycle:
 *   SIGHTING   → saw an animal (species optional in note)
 *   TRACKS     → fresh sign / track line
 *   STAND      → blind or treestand position
 *   GLASSING   → vantage / glassing point
 *   WATER      → spring, pond, creek crossing
 *   FOOD       → food plot, mast, field edge
 *   MIGRATION  → funnel, saddle, migration corridor
 *   WAYPOINT   → generic named marker
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Tiny collision-resistant ID — no external dep needed. */
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type WaypointType =
  | 'sighting'
  | 'tracks'
  | 'stand'
  | 'glassing'
  | 'water'
  | 'food'
  | 'migration'
  | 'waypoint';

export interface Waypoint {
  id: string;
  type: WaypointType;
  lat: number;
  lng: number;
  note: string;
  createdAt: number;  // unix ms
}

export interface WaypointConfig {
  label: string;
  emoji: string;
  color: string;
}

export const WAYPOINT_CONFIG: Record<WaypointType, WaypointConfig> = {
  sighting:  { label: 'SIGHTING',   emoji: '👁',  color: '#FF3000' },
  tracks:    { label: 'TRACKS',     emoji: '🦶', color: '#C87941' },
  stand:     { label: 'STAND',      emoji: '🪑',  color: '#FF8C00' },
  glassing:  { label: 'GLASSING',   emoji: '🔭',  color: '#00BFFF' },
  water:     { label: 'WATER',      emoji: '💧',  color: '#29ABE2' },
  food:      { label: 'FOOD',       emoji: '🌾',  color: '#7CB518' },
  migration: { label: 'MIGRATION',  emoji: '🦌',  color: '#FFB300' },
  waypoint:  { label: 'WAYPOINT',   emoji: '📍',  color: '#E0E0E0' },
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface WaypointState {
  waypoints: Waypoint[];
  addWaypoint: (wp: Omit<Waypoint, 'id' | 'createdAt'>) => string;
  updateNote: (id: string, note: string) => void;
  removeWaypoint: (id: string) => void;
  clearAll: () => void;
}

export const useWaypointStore = create<WaypointState>()(
  persist(
    (set) => ({
      waypoints: [],

      addWaypoint: (wp) => {
        const id = uid();
        set((s) => ({
          waypoints: [
            ...s.waypoints,
            { ...wp, id, createdAt: Date.now() },
          ],
        }));
        return id;
      },

      updateNote: (id, note) =>
        set((s) => ({
          waypoints: s.waypoints.map((w) => (w.id === id ? { ...w, note } : w)),
        })),

      removeWaypoint: (id) =>
        set((s) => ({
          waypoints: s.waypoints.filter((w) => w.id !== id),
        })),

      clearAll: () => set({ waypoints: [] }),
    }),
    {
      name: 'rangedope-waypoints',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

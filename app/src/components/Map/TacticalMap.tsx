/**
 * TacticalMap — Hunt planning map using MapLibre GL Native.
 *
 * Requires a dev build (npx expo run:ios). NOT compatible with Expo Go.
 *
 * Styles (all free, no API key required):
 *   TOPO  → USGS National Map topo raster          (DEFAULT)
 *   LIDAR → USGS 3DEP shaded relief                (LiDAR-derived 1m hillshade)
 *   3D    → ESRI satellite + World Hillshade blend  (OnX-style 3D terrain)
 *   SAT   → ESRI World Imagery
 *   VEC   → OpenFreeMap Liberty (OSM vector)
 *
 * USGS 3DEP — 3D Elevation Program:
 *   Federal LiDAR program covering ~90% of the continental US at 1m resolution.
 *   Rendered as a hillshade raster tile service (public domain, no auth required).
 *
 * 3D Composite technique:
 *   Two MapLibre raster layers stacked — satellite at 100% + hillshade at 45%.
 *   The hillshade reveals terrain structure and canyon/ridge detail over imagery.
 *   Same technique used by OnX Maps and HuntStand.
 *
 * MapLibre native warning: "Invalid geometry in line layer"
 *   Benign — only appears when the VEC style is active. Raster styles are unaffected.
 */
import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text, type NativeSyntheticEvent } from 'react-native';
import { Map, Camera, Marker } from '@maplibre/maplibre-react-native';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
// PressEvent type — inlined to avoid package.json export restrictions
type PressEvent = {
  lngLat: [number, number]; // [longitude, latitude]
  point: [number, number];  // pixel coords
};

// ─── Map styles ───────────────────────────────────────────────────────────────

const VECTOR_URL = 'https://tiles.openfreemap.org/styles/liberty';

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'ESRI World Imagery',
    },
  },
  layers: [{ id: 'esri-imagery', type: 'raster', source: 'esri' }],
};

const TOPO_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    usgs: {
      type: 'raster',
      tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'USGS National Map',
    },
  },
  layers: [{ id: 'usgs-topo', type: 'raster', source: 'usgs' }],
};

/**
 * USGS 3DEP LiDAR shaded relief.
 * 1m resolution where LiDAR coverage exists (∼90% of the continental US).
 * Public domain — no API key required.
 */
const LIDAR_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    relief: {
      type: 'raster',
      tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'USGS 3DEP — 3D Elevation Program',
    },
  },
  layers: [{ id: 'usgs-relief', type: 'raster', source: 'relief' }],
};

/**
 * 3D Composite — ESRI satellite + ESRI World Hillshade at 45% opacity.
 * Reveals terrain structure (ridgelines, drainages, saddles) over imagery.
 * Same rendering technique used by OnX Maps and HuntStand. No API key required.
 */
const COMPOSITE_3D_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
    },
    hillshade: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
    },
  },
  layers: [
    { id: 'esri-sat',       type: 'raster', source: 'satellite' },
    { id: 'esri-hillshade', type: 'raster', source: 'hillshade', paint: { 'raster-opacity': 0.45 } },
  ],
};

type StyleKey = 'topo' | 'lidar' | 'composite' | 'satellite' | 'vector';

const STYLE_MAP: Record<StyleKey, string | StyleSpecification> = {
  topo:      TOPO_STYLE,
  lidar:     LIDAR_STYLE,
  composite: COMPOSITE_3D_STYLE,
  satellite: SATELLITE_STYLE,
  vector:    VECTOR_URL,
};

const STYLE_LABELS: Record<StyleKey, string> = {
  topo:      'TOPO',
  lidar:     'LIDAR',
  composite: '3D',
  satellite: 'SAT',
  vector:    'VEC',
};

// ─── BLM Surface Management Agency overlay ────────────────────────────────────
//
// Free, no-auth tile service from BLM. Shows federal/state/tribal/private land
// in the standard agency color scheme (yellow=BLM, green=USFS, dark=NPS, etc.)
// Same data layer used by onX Hunt / HuntStand under the hood.

const BLM_SMA_TILES = [
  'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_with_PriUnk/MapServer/tile/{z}/{y}/{x}',
];

/**
 * Injects the BLM SMA raster overlay into a StyleSpecification.
 * Only works on raster-based styles (TOPO, LIDAR, 3D, SAT) — not VEC.
 */
function withOwnership(base: StyleSpecification): StyleSpecification {
  return {
    ...base,
    sources: {
      ...base.sources,
      'blm-sma': {
        type: 'raster',
        tiles: BLM_SMA_TILES,
        tileSize: 256,
        minzoom: 5,
        maxzoom: 15,
        attribution: 'BLM Surface Management Agency',
      },
    },
    layers: [
      ...base.layers,
      { id: 'blm-ownership', type: 'raster', source: 'blm-sma', paint: { 'raster-opacity': 0.52 } },
    ],
  };
}

/**
 * Injects ESRI World Transportation roads as a transparent raster overlay.
 * Works on any raster style (TOPO, LIDAR, 3D, SAT). Not supported on VEC.
 * Free, no API key required.
 */
const ESRI_ROADS_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
];

function withRoads(base: StyleSpecification): StyleSpecification {
  return {
    ...base,
    sources: {
      ...base.sources,
      'esri-roads': {
        type: 'raster',
        tiles: ESRI_ROADS_TILES,
        tileSize: 256,
        attribution: 'ESRI World Transportation',
      },
    },
    layers: [
      ...base.layers,
      { id: 'roads-overlay', type: 'raster', source: 'esri-roads' },
    ],
  };
}

/** Order shown in the toggle — most useful for hunting first. */
const STYLE_ORDER: StyleKey[] = ['topo', 'lidar', 'composite', 'satellite', 'vector'];

const FONT = 'SpaceMono-Regular';

// ─── Style switcher ───────────────────────────────────────────────────────────

function StyleToggle({
  current,
  onChange,
  showOwnership,
  onToggleOwnership,
  showRoads,
  onToggleRoads,
  topInset = 0,
}: {
  current: StyleKey;
  onChange: (s: StyleKey) => void;
  showOwnership: boolean;
  onToggleOwnership: () => void;
  showRoads: boolean;
  onToggleRoads: () => void;
  topInset?: number;
}) {
  return (
    <View style={[styles.styleToggle, { top: topInset + 10 }]}>
      {STYLE_ORDER.map((key) => (
        <Pressable
          key={key}
          onPress={() => onChange(key)}
          style={[styles.styleBtn, current === key && styles.styleBtnActive]}
          accessibilityLabel={`Switch to ${key} map style`}
        >
          <Text
            style={[
              styles.styleBtnText,
              { color: current === key ? '#FF3000' : 'rgba(255,255,255,0.45)' },
            ]}
          >
            {STYLE_LABELS[key]}
          </Text>
        </Pressable>
      ))}
      {/* Ownership overlay toggle */}
      {current !== 'vector' && (
        <Pressable
          onPress={onToggleOwnership}
          style={[styles.styleBtn, showOwnership && styles.ownBtnActive]}
          accessibilityLabel={showOwnership ? 'Hide land ownership overlay' : 'Show land ownership overlay'}
        >
          <Text style={[styles.styleBtnText, { color: showOwnership ? '#FFB300' : 'rgba(255,255,255,0.45)' }]}>
            OWN
          </Text>
        </Pressable>
      )}
      {/* Roads overlay toggle */}
      {current !== 'vector' && (
        <Pressable
          onPress={onToggleRoads}
          style={[styles.styleBtn, showRoads && styles.rdsBtnActive]}
          accessibilityLabel={showRoads ? 'Hide roads overlay' : 'Show roads overlay'}
        >
          <Text style={[styles.styleBtnText, { color: showRoads ? '#60B8FF' : 'rgba(255,255,255,0.45)' }]}>
            RDS
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/** A pin to render on the map. */
export type PinMarker = {
  id: string;
  /** [longitude, latitude] — MapLibre LngLat tuple. */
  lngLat: [number, number];
  label: string;
  color: string;
};

/** A waypoint marker rendered on the map (hunt scouting). */
export type WaypointMarker = {
  id: string;
  lngLat: [number, number];
  emoji: string;
  color: string;
  label: string;
};

interface Props {
  /** Initial center [lng, lat]. Defaults to central Utah hunting country. */
  initialCenter?: [number, number];
  initialZoom?: number;
  /** Safe area top inset — pass useSafeAreaInsets().top so the toggle
   *  clears the status bar / Dynamic Island on any device. */
  topInset?: number;
  /** Shot-plan pins (SHOOTER red, TARGET amber). */
  pins?: PinMarker[];
  /** Hunt scouting waypoints rendered with emoji icons. */
  waypointMarkers?: WaypointMarker[];
  /** Called when the user long-presses the map — fires with [lng, lat] tuple. */
  onLongPress?: (lngLat: [number, number]) => void;
  /** Called when a pin marker is tapped — fires with pin.id. */
  onPinPress?: (pinId: string) => void;
}

export function TacticalMap({
  initialCenter = [-111.093, 39.75],
  initialZoom = 11,
  topInset = 0,
  pins = [],
  waypointMarkers = [],
  onLongPress,
  onPinPress,
}: Props) {
  const [styleKey, setStyleKey] = useState<StyleKey>('topo');
  const [showOwnership, setShowOwnership] = useState(false);
  const [showRoads, setShowRoads] = useState(false);

  // Compose active style — apply overlays in order (ownership under roads).
  // VEC is a URL string so raster overlays are not supported on that style.
  let activeStyle: string | StyleSpecification = STYLE_MAP[styleKey];
  if (typeof activeStyle !== 'string') {
    if (showOwnership) activeStyle = withOwnership(activeStyle);
    if (showRoads) activeStyle = withRoads(activeStyle);
  }

  return (
    <View style={styles.root}>
      <Map
        style={styles.map}
        mapStyle={activeStyle}
        compass
        logo={false}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
        scaleBar
        scaleBarPosition={{ bottom: 28, left: 8 }}
        onLongPress={(event: NativeSyntheticEvent<PressEvent>) => {
          onLongPress?.(event.nativeEvent.lngLat);
        }}
      >
        <Camera
          initialViewState={{
            center: initialCenter,
            zoom: initialZoom,
          }}
          minZoom={4}
          maxZoom={18}
        />

        {/* Shooter / target pin markers */}
        {pins.map((pin) => (
          <Marker key={pin.id} lngLat={pin.lngLat} anchor="bottom">
            <Pressable
              onPress={() => onPinPress?.(pin.id)}
              hitSlop={12}
              accessibilityLabel={`${pin.label} pin — tap to manage`}
            >
              <View style={styles.pinMarker}>
                <Text style={[styles.pinMarkerLabel, { color: pin.color }]}>{pin.label}</Text>
                <View style={[styles.pinMarkerDot, { backgroundColor: pin.color, borderColor: pin.color }]} />
              </View>
            </Pressable>
          </Marker>
        ))}

        {/* Hunt scouting waypoints with emoji icons */}
        {waypointMarkers.map((wp) => (
          <Marker key={wp.id} lngLat={wp.lngLat} anchor="bottom">
            <View style={styles.waypointMarker}>
              <Text style={styles.waypointEmoji}>{wp.emoji}</Text>
              <View style={[styles.waypointDot, { backgroundColor: wp.color }]} />
            </View>
          </Marker>
        ))}
      </Map>

      <StyleToggle
        current={styleKey}
        onChange={setStyleKey}
        showOwnership={showOwnership}
        onToggleOwnership={() => setShowOwnership((v) => !v)}
        showRoads={showRoads}
        onToggleRoads={() => setShowRoads((v) => !v)}
        topInset={topInset}
      />

      {/* Tactical crosshair overlay */}
      <View style={styles.crosshairOverlay} pointerEvents="none">
        <View style={styles.crossH} />
        <View style={styles.crossV} />
        <View style={styles.crossDot} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  map:  { flex: 1 },

  styleToggle: {
    position: 'absolute',
    // top is set dynamically via topInset prop — see StyleToggle
    right: 12,
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,80,0,0.25)',
  },
  styleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  styleBtnActive: {
    backgroundColor: 'rgba(255,48,0,0.15)',
  },
  rdsBtnActive: {
    backgroundColor: 'rgba(96,184,255,0.18)',
  },
  ownBtnActive: {
    backgroundColor: 'rgba(255,179,0,0.18)',
  },
  styleBtnText: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 1,
  },

  // Scope crosshair
  crosshairOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossH: {
    position: 'absolute',
    width: 32,
    height: 1,
    backgroundColor: 'rgba(255,48,0,0.45)',
  },
  crossV: {
    position: 'absolute',
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,48,0,0.45)',
  },
  crossDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,48,0,0.65)',
  },

  // Drop pin markers (shooter / target)
  pinMarker: {
    alignItems: 'center',
    gap: 2,
  },
  pinMarkerLabel: {
    fontFamily: FONT,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  pinMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },

  // Waypoint emoji markers
  waypointMarker: {
    alignItems: 'center',
    gap: 1,
  },
  waypointEmoji: {
    fontSize: 20,
  },
  waypointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

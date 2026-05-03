import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

// Standard OSM tiles for v1 (Zero-Ops)
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

// Initial camera position (somewhere tactical — e.g., near a famous range or zeroed on user)
const INITIAL_CENTER: [number, number] = [-111.891, 40.7608]; // SLC area placeholder

export function TacticalMap() {
  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        styleJSON={JSON.stringify(OSM_STYLE)}
        logoEnabled={false}
        attributionEnabled={true}
      >
        <MapLibreGL.Camera
          defaultSettings={{
            centerCoordinate: INITIAL_CENTER,
            zoomLevel: 12,
          }}
        />
      </MapLibreGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    flex: 1,
  },
});

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Map, Camera } from '@maplibre/maplibre-react-native';
import { SATELLITE_STYLE } from '../../utils/mapStyles';

// Initial camera position — zooming into a tactical range area
// Placeholder: Salt Lake City (UT) — 40.7608° N, 111.8910° W
const INITIAL_CENTER: [number, number] = [-111.891, 40.7608]; 

export function TacticalMap() {
  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        styleJSON={JSON.stringify(SATELLITE_STYLE)}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Camera
          defaultSettings={{
            centerCoordinate: INITIAL_CENTER,
            zoomLevel: 15, // High-res tactical zoom
            pitch: 45, // Angled view for better terrain feel
          }}
        />
      </Map>
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

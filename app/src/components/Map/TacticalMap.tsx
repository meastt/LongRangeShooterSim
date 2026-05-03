import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Map, Camera } from '@maplibre/maplibre-react-native';

// Professional Vector Style — cleaner, tactical look
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Initial camera position — SLC tactical range
const INITIAL_CENTER: [number, number] = [-111.891, 40.7608]; 

export function TacticalMap() {
  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        styleURL={STYLE_URL}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Camera
          defaultSettings={{
            centerCoordinate: INITIAL_CENTER,
            zoomLevel: 14,
            pitch: 45,
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

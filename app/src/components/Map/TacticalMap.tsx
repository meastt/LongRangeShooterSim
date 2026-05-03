import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Map, Camera } from '@maplibre/maplibre-react-native';
import { SATELLITE_STYLE } from '../../utils/mapStyles';

// Initial camera position — zooming into a tactical range area
// Placeholder: Salt Lake City (UT) — 40.7608° N, 111.8910° W
const INITIAL_CENTER: [number, number] = [-111.891, 40.7608]; 

export function TacticalMap() {
  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    // Force camera to location on mount
    cameraRef.current?.setCamera({
      centerCoordinate: INITIAL_CENTER,
      zoomLevel: 14,
      pitch: 45,
      animationDuration: 0,
    });
  }, []);

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        styleJSON={JSON.stringify(SATELLITE_STYLE)}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Camera
          ref={cameraRef}
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

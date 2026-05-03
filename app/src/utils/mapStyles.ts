/**
 * MapStyle definitions for the Hunt Planning Layer.
 * Using MapLibre-compatible JSON styles.
 */

// ESRI Satellite Imagery — High-res tactical view
export const SATELLITE_STYLE = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
    },
  ],
};

// USGS Topo — Detailed contour lines and elevation for hunters
export const TOPO_STYLE = {
  version: 8,
  sources: {
    topo: {
      type: 'raster',
      tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USTopo/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles courtesy of the U.S. Geological Survey',
    },
  },
  layers: [
    {
      id: 'topo',
      type: 'raster',
      source: 'topo',
      minzoom: 0,
      maxzoom: 16,
    },
  ],
};

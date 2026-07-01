import type { VolcanoFeature } from '../types';

export const VOLCANOES: VolcanoFeature[] = [
  { id: 'st-helens', name: 'Mount St. Helens', position: { lat: 46.19, lon: -122.19 }, radiusKm: 120, elevation: 0.16, rock: 0.55, volcanic: 0.65, size: 0.070 },
  { id: 'kilauea', name: 'Kīlauea', position: { lat: 19.42, lon: -155.29 }, radiusKm: 140, elevation: 0.13, rock: 0.66, volcanic: 0.88, size: 0.074, smoke: true },
  { id: 'mauna-loa', name: 'Mauna Loa', position: { lat: 19.48, lon: -155.61 }, radiusKm: 170, elevation: 0.18, rock: 0.68, volcanic: 0.82, size: 0.078, smoke: true },
  { id: 'popocatepetl', name: 'Popocatépetl', position: { lat: 19.02, lon: -98.62 }, radiusKm: 120, elevation: 0.16, rock: 0.58, volcanic: 0.78, size: 0.072, smoke: true },
  { id: 'cotopaxi', name: 'Cotopaxi', position: { lat: -0.68, lon: -78.44 }, radiusKm: 120, elevation: 0.18, rock: 0.62, volcanic: 0.76, size: 0.074, smoke: true },
  { id: 'chimborazo', name: 'Chimborazo', position: { lat: -1.47, lon: -78.82 }, radiusKm: 110, elevation: 0.16, rock: 0.58, volcanic: 0.48, size: 0.066 },
  { id: 'villarrica', name: 'Villarrica', position: { lat: -39.42, lon: -71.93 }, radiusKm: 110, elevation: 0.14, rock: 0.56, volcanic: 0.80, size: 0.068, smoke: true },
  { id: 'etna', name: 'Etna', position: { lat: 37.75, lon: 14.99 }, radiusKm: 120, elevation: 0.15, rock: 0.62, volcanic: 0.82, size: 0.078, smoke: true },
  { id: 'vesuvius', name: 'Vesuvius', position: { lat: 40.82, lon: 14.43 }, radiusKm: 90, elevation: 0.12, rock: 0.54, volcanic: 0.70, size: 0.066, smoke: true },
  { id: 'eyjafjallajokull', name: 'Eyjafjallajökull', position: { lat: 63.63, lon: -19.62 }, radiusKm: 120, elevation: 0.14, rock: 0.58, volcanic: 0.74, size: 0.066, smoke: true },
  { id: 'kilimanjaro', name: 'Kilimanjaro', position: { lat: -3.07, lon: 37.36 }, radiusKm: 140, elevation: 0.20, rock: 0.52, volcanic: 0.38, size: 0.086 },
  { id: 'nyiragongo', name: 'Nyiragongo', position: { lat: -1.52, lon: 29.25 }, radiusKm: 110, elevation: 0.15, rock: 0.60, volcanic: 0.88, size: 0.072, smoke: true },
  { id: 'krakatoa', name: 'Krakatoa', position: { lat: -6.10, lon: 105.42 }, radiusKm: 110, elevation: 0.13, rock: 0.62, volcanic: 0.86, size: 0.072, smoke: true },
  { id: 'merapi', name: 'Merapi', position: { lat: -7.54, lon: 110.45 }, radiusKm: 110, elevation: 0.15, rock: 0.60, volcanic: 0.84, size: 0.068, smoke: true },
  { id: 'tambora', name: 'Tambora', position: { lat: -8.25, lon: 118.00 }, radiusKm: 125, elevation: 0.15, rock: 0.62, volcanic: 0.76, size: 0.070 },
  { id: 'fuji', name: 'Mount Fuji', position: { lat: 35.36, lon: 138.73 }, radiusKm: 100, elevation: 0.13, rock: 0.50, volcanic: 0.58, size: 0.066 },
  { id: 'ruapehu', name: 'Ruapehu', position: { lat: -39.28, lon: 175.57 }, radiusKm: 105, elevation: 0.14, rock: 0.56, volcanic: 0.64, size: 0.064 },
  { id: 'erebus', name: 'Mount Erebus', position: { lat: -77.53, lon: 167.17 }, radiusKm: 110, elevation: 0.12, rock: 0.58, volcanic: 0.72, size: 0.060, smoke: true },
];

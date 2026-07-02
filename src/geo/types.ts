export interface GeoPoint {
  /** Real-world latitude in degrees. North is positive. */
  lat: number;
  /** Real-world longitude in degrees. East is positive, west is negative. */
  lon: number;
}

export interface MountainRangeFeature {
  id: string;
  name: string;
  path: GeoPoint[];
  widthKm: number;
  height: number;
  roughness: number;
  rock: number;
  snowBias: number;
  treeDensityBias?: number;
}

export type LandformKind = 'basin' | 'plateau' | 'shield' | 'rift' | 'desert' | 'wetland' | 'ice';

export interface LandformFeature {
  id: string;
  name: string;
  kind: LandformKind;
  center: GeoPoint;
  latRadiusKm: number;
  lonRadiusKm: number;
  elevation: number;
  rim?: number;
  roughness?: number;
  moisture?: number;
  rock?: number;
  sand?: number;
  forest?: number;
  volcanic?: number;
  snowBias?: number;
  treeDensityBias?: number;
}

export interface GeoSample {
  /** Extra stylized elevation contributed by real geographic features. */
  elevation: number;
  roughness: number;
  moisture: number;
  snowBias: number;
  rock: number;
  sand: number;
  forest: number;
  volcanic: number;
  treeDensity: number;
  mountain: number;
  basin: number;
  plateau: number;
  rift: number;
  desert: number;
  shield: number;
}

export interface ClimateSample {
  cloudDensity: number;
  cloudAltitude: number;
  windSpeed: number;
  windHeading: number;
  moisture: number;
  orographic: number;
  storm: number;
  polar: number;
}

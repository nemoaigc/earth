import * as THREE from 'three';

export interface DayNightState {
  sunDirection: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  skyTopColor: THREE.Color;
  skyBottomColor: THREE.Color;
  fogColor: THREE.Color;
  fogNear: number;
  fogFar: number;
  atmosphereColor: THREE.Color;
  cloudOpacity: number;
  starVisibility: number;
  auroraVisibility: number;
  rainIntensity: number;
  timeOfDay: number;
  // Auto-derived from sun state — not in keyframes
  terrainTint: THREE.Color;
  oceanColor: THREE.Color;
}

interface KeyFrame {
  time: number;
  sunColor: THREE.Color;
  sunIntensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  skyTopColor: THREE.Color;
  skyBottomColor: THREE.Color;
  fogColor: THREE.Color;
  fogNear: number;
  fogFar: number;
  atmosphereColor: THREE.Color;
  cloudOpacity: number;
  starVisibility: number;
  auroraVisibility: number;
  rainIntensity: number;
}

const CYCLE_DURATION = 120;

function makeKeyFrame(
  time: number,
  sunColor: string, sunIntensity: number,
  ambientColor: string, ambientIntensity: number,
  skyTop: string, skyBottom: string,
  fogColor: string, fogNear: number, fogFar: number,
  atmosphereColor: string,
  cloudOpacity: number, starVisibility: number, auroraVisibility: number, rainIntensity: number
): KeyFrame {
  return {
    time,
    sunColor: new THREE.Color(sunColor),
    sunIntensity,
    ambientColor: new THREE.Color(ambientColor),
    ambientIntensity,
    skyTopColor: new THREE.Color(skyTop),
    skyBottomColor: new THREE.Color(skyBottom),
    fogColor: new THREE.Color(fogColor),
    fogNear,
    fogFar,
    atmosphereColor: new THREE.Color(atmosphereColor),
    cloudOpacity,
    starVisibility,
    auroraVisibility,
    rainIntensity,
  };
}

const KEY_FRAMES: KeyFrame[] = [
  // Day — original Tiny Skies colors
  makeKeyFrame(0.25,
    '#fff0d0', 1.8,
    '#80ccdd', 0.75,
    '#1a4a82', '#50e4f4',
    '#60ccde', 15, 40,
    '#bbddcc',
    0.2, 0, 0, 0),
  // Sunset — original warm orange/purple
  makeKeyFrame(0.45,
    '#ffaa40', 1.2,
    '#ff9944', 0.5,
    '#4a2078', '#f0a030',
    '#c07848', 12, 35,
    '#ffcc44',
    0.2, 0.1, 0, 0),
  // Night — original deep blue, planet visible
  makeKeyFrame(0.70,
    '#102060', 0.6,
    '#283c80', 0.5,
    '#050a1e', '#203c94',
    '#08142c', 10, 30,
    '#2850aa',
    0.06, 1.0, 0.8, 0),
  // Dawn — warming up
  makeKeyFrame(0.92,
    '#ffaa40', 0.8,
    '#ff9944', 0.45,
    '#1a1050', '#f8c858',
    '#c07848', 12, 35,
    '#ffcc44',
    0.15, 0.2, 0.1, 0),
];

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Reusable temp colors to avoid GC
const _white = new THREE.Color('#ffffff');
const _baseCyan = new THREE.Color('#55ccee');
const _tmpColor = new THREE.Color();

export class DayNightCycle {
  state: DayNightState;
  private cycleDuration: number;
  private elapsed: number;

  // Rain system
  private isRaining: boolean;
  private rainTimer: number;
  private rainDuration: number;
  private rainFadeIn: number;
  private rainFadeOut: number;
  private rainPeak: number;
  private nextRainCheck: number;
  private cycleCount: number;

  constructor() {
    this.cycleDuration = CYCLE_DURATION;
    this.elapsed = CYCLE_DURATION * 0.25; // Start at daytime

    this.isRaining = false;
    this.rainTimer = 0;
    this.rainDuration = 0;
    this.rainFadeIn = 3;
    this.rainFadeOut = 5;
    this.rainPeak = 0;
    this.nextRainCheck = 0.5;
    this.cycleCount = 0;

    this.state = {
      sunDirection: new THREE.Vector3(1, 0.3, 0),
      sunColor: new THREE.Color('#ffffff'),
      sunIntensity: 1.8,
      ambientColor: new THREE.Color('#aaccee'),
      ambientIntensity: 0.7,
      skyTopColor: new THREE.Color('#2288dd'),
      skyBottomColor: new THREE.Color('#66ccff'),
      fogColor: new THREE.Color('#88ccee'),
      fogNear: 15,
      fogFar: 60,
      atmosphereColor: new THREE.Color('#44aaff'),
      cloudOpacity: 0.6,
      starVisibility: 0,
      auroraVisibility: 0,
      rainIntensity: 0,
      timeOfDay: 0.25,
      terrainTint: new THREE.Color('#ffffff'),
      oceanColor: new THREE.Color('#55ccee'),
    };
  }

  update(deltaTime: number): void {
    this.elapsed += deltaTime;
    const prevTimeOfDay = this.state.timeOfDay;
    const timeOfDay = (this.elapsed / this.cycleDuration) % 1;
    this.state.timeOfDay = timeOfDay;

    if (timeOfDay < prevTimeOfDay) {
      this.cycleCount++;
    }

    // Sun direction
    const angle = timeOfDay * Math.PI * 2;
    this.state.sunDirection.set(
      Math.cos(angle),
      Math.sin(angle) * 0.3,
      Math.sin(angle)
    ).normalize();

    // Find surrounding keyframes
    const frames = KEY_FRAMES;
    let beforeIdx = frames.length - 1;
    let afterIdx = 0;

    for (let i = 0; i < frames.length; i++) {
      if (frames[i].time > timeOfDay) {
        afterIdx = i;
        beforeIdx = (i - 1 + frames.length) % frames.length;
        break;
      }
      if (i === frames.length - 1) {
        beforeIdx = i;
        afterIdx = 0;
      }
    }

    const before = frames[beforeIdx];
    const after = frames[afterIdx];

    // Calculate interpolation factor
    let range: number;
    let progress: number;
    if (after.time > before.time) {
      range = after.time - before.time;
      progress = (timeOfDay - before.time) / range;
    } else {
      range = (1 - before.time) + after.time;
      if (timeOfDay >= before.time) {
        progress = (timeOfDay - before.time) / range;
      } else {
        progress = (1 - before.time + timeOfDay) / range;
      }
    }
    const t = progress * progress * (3 - 2 * progress);

    // Interpolate keyframe properties
    this.state.sunColor.lerpColors(before.sunColor, after.sunColor, t);
    this.state.sunIntensity = lerpScalar(before.sunIntensity, after.sunIntensity, t);
    this.state.ambientColor.lerpColors(before.ambientColor, after.ambientColor, t);
    this.state.ambientIntensity = lerpScalar(before.ambientIntensity, after.ambientIntensity, t);
    this.state.skyTopColor.lerpColors(before.skyTopColor, after.skyTopColor, t);
    this.state.skyBottomColor.lerpColors(before.skyBottomColor, after.skyBottomColor, t);
    this.state.fogColor.lerpColors(before.fogColor, after.fogColor, t);
    this.state.fogNear = lerpScalar(before.fogNear, after.fogNear, t);
    this.state.fogFar = lerpScalar(before.fogFar, after.fogFar, t);
    this.state.atmosphereColor.lerpColors(before.atmosphereColor, after.atmosphereColor, t);
    this.state.cloudOpacity = lerpScalar(before.cloudOpacity, after.cloudOpacity, t);
    this.state.starVisibility = lerpScalar(before.starVisibility, after.starVisibility, t);
    this.state.auroraVisibility = lerpScalar(before.auroraVisibility, after.auroraVisibility, t);

    // === AUTO-DERIVE terrain & ocean from sun state ===
    // brightness: 30% floor — planet is NEVER fully dark
    const brightness = Math.min(1.0, Math.max(0.55, this.state.sunIntensity * 0.35 + 0.45));

    // terrainTint: sunColor diluted toward white, then scaled by brightness
    _tmpColor.copy(this.state.sunColor).lerp(_white, 0.6);
    this.state.terrainTint.copy(_tmpColor).multiplyScalar(brightness);

    // oceanColor: blend sky bottom with cyan, matching original's sky-ocean unity
    _tmpColor.copy(this.state.skyBottomColor).lerp(_baseCyan, 0.4);
    this.state.oceanColor.copy(_tmpColor).multiplyScalar(Math.max(0.5, brightness));

    // Rain
    let baseRain = lerpScalar(before.rainIntensity, after.rainIntensity, t);
    this.updateRain(deltaTime, timeOfDay);
    this.state.rainIntensity = Math.max(baseRain, this.getRainOverlay());
  }

  private updateRain(deltaTime: number, timeOfDay: number): void {
    if (this.isRaining) {
      this.rainTimer += deltaTime;
      const totalDuration = this.rainFadeIn + this.rainDuration + this.rainFadeOut;
      if (this.rainTimer >= totalDuration) {
        this.isRaining = false;
        this.rainTimer = 0;
      }
    }

    const checkPoint = this.nextRainCheck;
    if (!this.isRaining && timeOfDay >= checkPoint && timeOfDay < checkPoint + 0.02) {
      if (Math.random() < 0.1) {
        this.isRaining = true;
        this.rainTimer = 0;
        this.rainDuration = 8 + Math.random() * 12;
        this.rainPeak = 0.5 + Math.random() * 0.5;
        this.rainFadeIn = 3;
        this.rainFadeOut = 5;
      }
      this.nextRainCheck = timeOfDay < 0.5 ? 0.5 + Math.random() * 0.3 : Math.random() * 0.3;
    }
  }

  private getRainOverlay(): number {
    if (!this.isRaining) return 0;
    const t = this.rainTimer;
    if (t < this.rainFadeIn) {
      return this.rainPeak * (t / this.rainFadeIn);
    } else if (t < this.rainFadeIn + this.rainDuration) {
      return this.rainPeak;
    } else {
      const fadeElapsed = t - this.rainFadeIn - this.rainDuration;
      return this.rainPeak * Math.max(0, 1 - fadeElapsed / this.rainFadeOut);
    }
  }
}

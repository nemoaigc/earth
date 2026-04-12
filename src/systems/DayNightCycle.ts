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
  // Day — bright blue sky, full sunlight
  makeKeyFrame(0.25,
    '#ffffff', 1.8,
    '#aaccee', 0.7,
    '#2288dd', '#66ccff',
    '#88ccee', 15, 60,
    '#44aaff',
    0.6, 0, 0, 0),
  // Golden hour — warm orange glow
  makeKeyFrame(0.42,
    '#ffcc66', 1.3,
    '#ddaa77', 0.5,
    '#3366aa', '#ffbb55',
    '#ccaa77', 12, 50,
    '#ffaa55',
    0.5, 0, 0, 0),
  // Sunset — deep orange, sky darkening
  makeKeyFrame(0.50,
    '#ff8844', 0.7,
    '#aa7755', 0.35,
    '#1a2244', '#dd6633',
    '#885544', 10, 40,
    '#ff6633',
    0.4, 0.15, 0, 0),
  // Night — moonlight blue, planet clearly visible
  makeKeyFrame(0.70,
    '#aabbdd', 0.5,
    '#445577', 0.45,
    '#080c1a', '#101830',
    '#101828', 8, 35,
    '#3355aa',
    0.15, 1.0, 0.8, 0),
  // Pre-dawn — sky starts warming
  makeKeyFrame(0.90,
    '#ffbb77', 0.5,
    '#887766', 0.35,
    '#112244', '#cc8855',
    '#776655', 10, 45,
    '#6688bb',
    0.35, 0.3, 0.1, 0),
  // Dawn — brightening quickly
  makeKeyFrame(0.98,
    '#ffddaa', 1.0,
    '#aabb99', 0.5,
    '#2277bb', '#88bbdd',
    '#99aabb', 12, 50,
    '#55aadd',
    0.5, 0.05, 0, 0),
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

    // oceanColor: base cyan tinted slightly by sunColor, then scaled by brightness
    _tmpColor.copy(_baseCyan).lerp(this.state.sunColor, 0.15);
    this.state.oceanColor.copy(_tmpColor).multiplyScalar(brightness);

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

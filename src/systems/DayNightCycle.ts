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
  terrainTint: THREE.Color;
  oceanColor: THREE.Color;
}

const CYCLE_DURATION = 120; // seconds

function makeKeyFrame(
  time: number,
  sunColor: string, sunIntensity: number,
  ambientColor: string, ambientIntensity: number,
  skyTop: string, skyBottom: string,
  fogColor: string, fogNear: number, fogFar: number,
  atmosphereColor: string,
  cloudOpacity: number, starVisibility: number, auroraVisibility: number, rainIntensity: number,
  terrainTint: string, oceanColor: string
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
    terrainTint: new THREE.Color(terrainTint),
    oceanColor: new THREE.Color(oceanColor),
  };
}

const KEY_FRAMES: KeyFrame[] = [
  // Day — bright vivid sky
  makeKeyFrame(0.25,
    '#ffffff', 1.8,
    '#aaccee', 0.7,
    '#2288dd', '#66ccff',
    '#88ccee', 15, 60,
    '#44aaff',
    0.6, 0, 0, 0,
    '#ffffff', '#55ccee'),
  // Sunset — warm golden
  makeKeyFrame(0.45,
    '#ffbb55', 1.0,
    '#cc8855', 0.4,
    '#1a3366', '#ee7744',
    '#aa7755', 10, 45,
    '#ff9944',
    0.5, 0.1, 0, 0,
    '#ddaa77', '#3388aa'),
  // Night — deep blue, not black
  makeKeyFrame(0.7,
    '#556688', 0.25,
    '#223355', 0.25,
    '#060818', '#0c1430',
    '#0c1225', 8, 35,
    '#3355aa',
    0.2, 1.0, 0.8, 0,
    '#334466', '#1a3355'),
  // Dawn — soft blue-purple
  makeKeyFrame(0.95,
    '#ffcc88', 0.7,
    '#8877bb', 0.4,
    '#2244aa', '#dd9966',
    '#887766', 10, 45,
    '#7799dd',
    0.4, 0.2, 0.1, 0,
    '#9999bb', '#2255aa'),
];

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

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
    this.nextRainCheck = 0.5; // check halfway through first cycle
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
      timeOfDay: 0,
      terrainTint: new THREE.Color('#ffffff'),
      oceanColor: new THREE.Color('#55ccee'),
    };
  }

  update(deltaTime: number): void {
    this.elapsed += deltaTime;
    const prevTimeOfDay = this.state.timeOfDay;
    const timeOfDay = (this.elapsed / this.cycleDuration) % 1;
    this.state.timeOfDay = timeOfDay;

    // Detect cycle completion
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
      // Wrapping around (e.g. dawn -> day across 0)
      range = (1 - before.time) + after.time;
      if (timeOfDay >= before.time) {
        progress = (timeOfDay - before.time) / range;
      } else {
        progress = (1 - before.time + timeOfDay) / range;
      }
    }
    // Smooth step for nicer transitions
    const t = progress * progress * (3 - 2 * progress);

    // Interpolate all properties
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
    this.state.terrainTint.lerpColors(before.terrainTint, after.terrainTint, t);
    this.state.oceanColor.lerpColors(before.oceanColor, after.oceanColor, t);

    // Base rain from keyframes
    let baseRain = lerpScalar(before.rainIntensity, after.rainIntensity, t);

    // Occasional rain system
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

    // Check for new rain event (~10% chance per cycle, checked once per cycle)
    const checkPoint = this.nextRainCheck;
    if (!this.isRaining && timeOfDay >= checkPoint && timeOfDay < checkPoint + 0.02) {
      if (Math.random() < 0.1) {
        this.isRaining = true;
        this.rainTimer = 0;
        this.rainDuration = 8 + Math.random() * 12; // 8-20 seconds
        this.rainPeak = 0.5 + Math.random() * 0.5; // 0.5-1.0
        this.rainFadeIn = 3;
        this.rainFadeOut = 5;
      }
      // Schedule next check at a random point in the next cycle
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

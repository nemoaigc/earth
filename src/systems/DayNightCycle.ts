import * as THREE from 'three';

export interface SkyStop { stop: number; color: THREE.Color }

export interface DayNightState {
  sunDirection: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  sun2Color: THREE.Color;
  sun2Intensity: number;
  fillColor: THREE.Color;
  fillIntensity: number;
  backColor: THREE.Color;
  backIntensity: number;
  hemiSkyColor: THREE.Color;
  hemiGroundColor: THREE.Color;
  hemiIntensity: number;
  skyGradient: SkyStop[];
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
  oceanShallow: THREE.Color;
  oceanDeep: THREE.Color;
  oceanFoam: THREE.Color;
}

interface KeyFrame {
  time: number;
  sunColor: THREE.Color; sunIntensity: number;
  sun2Color: THREE.Color; sun2Intensity: number;
  fillColor: THREE.Color; fillIntensity: number;
  backColor: THREE.Color; backIntensity: number;
  hemiSkyColor: THREE.Color; hemiGroundColor: THREE.Color; hemiIntensity: number;
  skyGradient: SkyStop[];
  fogColor: THREE.Color; fogNear: number; fogFar: number;
  atmosphereColor: THREE.Color;
  oceanShallow: THREE.Color; oceanDeep: THREE.Color; oceanFoam: THREE.Color;
  cloudOpacity: number; starVisibility: number; auroraVisibility: number; rainIntensity: number;
}

const CYCLE_DURATION = 120;

function c(hex: string): THREE.Color { return new THREE.Color(hex); }
function stops(...pairs: [number, string][]): SkyStop[] {
  return pairs.map(([s, col]) => ({ stop: s, color: new THREE.Color(col) }));
}

// Original Tiny Skies presets (extracted from source)
const KEY_FRAMES: KeyFrame[] = [
  { // DAY (0.25)
    time: 0.25,
    sunColor: c('#fff0d0'), sunIntensity: 3.75,
    sun2Color: c('#fff0d0'), sun2Intensity: 2.5,
    fillColor: c('#90bfcc'), fillIntensity: 1.25,
    backColor: c('#aacc6e'), backIntensity: 1.0,
    hemiSkyColor: c('#80ccdd'), hemiGroundColor: c('#66aa44'), hemiIntensity: 1.25,
    skyGradient: stops(
      [0,'#04102e'],[0.1,'#081e4a'],[0.2,'#103268'],[0.3,'#1a4a82'],
      [0.4,'#266498'],[0.5,'#2080b0'],[0.6,'#209cc8'],[0.7,'#28b8dc'],
      [0.8,'#38d0ea'],[0.9,'#50e4f4'],[1,'#70f2fc']
    ),
    fogColor: c('#60ccde'), fogNear: 15, fogFar: 40,
    atmosphereColor: c('#bbddcc'),
    oceanShallow: c('#2a8ca0'), oceanDeep: c('#1560a0'), oceanFoam: c('#b3ffff'),
    cloudOpacity: 0.2, starVisibility: 0, auroraVisibility: 0, rainIntensity: 0,
  },
  { // SUNSET (0.45)
    time: 0.45,
    sunColor: c('#ffaa40'), sunIntensity: 3.5,
    sun2Color: c('#aa6600'), sun2Intensity: 1.0,
    fillColor: c('#cc8855'), fillIntensity: 0.875,
    backColor: c('#aa8866'), backIntensity: 0.625,
    hemiSkyColor: c('#ff9944'), hemiGroundColor: c('#554422'), hemiIntensity: 0.94,
    skyGradient: stops(
      [0,'#0e0a2a'],[0.15,'#1a1050'],[0.3,'#4a2078'],[0.45,'#a03060'],
      [0.55,'#cc4840'],[0.65,'#e07828'],[0.75,'#f0a030'],[0.85,'#f8c858'],
      [1,'#fce0a0']
    ),
    fogColor: c('#c07848'), fogNear: 12, fogFar: 35,
    atmosphereColor: c('#ffcc44'),
    oceanShallow: c('#5a4a98'), oceanDeep: c('#302868'), oceanFoam: c('#ff9944'),
    cloudOpacity: 0.2, starVisibility: 0.1, auroraVisibility: 0, rainIntensity: 0,
  },
  { // NIGHT (0.70) — boosted so planet stays visible at distance
    time: 0.70,
    sunColor: c('#2040aa'), sunIntensity: 2.0,
    sun2Color: c('#1830880'), sun2Intensity: 1.0,
    fillColor: c('#4060aa'), fillIntensity: 1.2,
    backColor: c('#405080'), backIntensity: 0.8,
    hemiSkyColor: c('#3050aa'), hemiGroundColor: c('#182838'), hemiIntensity: 1.0,
    skyGradient: stops(
      [0,'#02030c'],[0.15,'#050a1e'],[0.3,'#081032'],[0.45,'#0c1846'],
      [0.55,'#101e58'],[0.65,'#142668'],[0.75,'#182e74'],[0.85,'#1c3684'],
      [1,'#203c94']
    ),
    fogColor: c('#08142c'), fogNear: 10, fogFar: 30,
    atmosphereColor: c('#2850aa'),
    oceanShallow: c('#081838'), oceanDeep: c('#040c20'), oceanFoam: c('#2050aa'),
    cloudOpacity: 0.06, starVisibility: 1.0, auroraVisibility: 0.8, rainIntensity: 0,
  },
  { // DAWN (0.92)
    time: 0.92,
    sunColor: c('#ffaa40'), sunIntensity: 2.5,
    sun2Color: c('#aa6600'), sun2Intensity: 0.8,
    fillColor: c('#cc8855'), fillIntensity: 0.8,
    backColor: c('#aa8866'), backIntensity: 0.5,
    hemiSkyColor: c('#ff9944'), hemiGroundColor: c('#554422'), hemiIntensity: 0.8,
    skyGradient: stops(
      [0,'#0e0a2a'],[0.15,'#1a1050'],[0.3,'#4a2078'],[0.45,'#a03060'],
      [0.55,'#cc4840'],[0.65,'#e07828'],[0.75,'#f0a030'],[0.85,'#f8c858'],
      [1,'#fce0a0']
    ),
    fogColor: c('#c07848'), fogNear: 12, fogFar: 35,
    atmosphereColor: c('#ffcc44'),
    oceanShallow: c('#5a4a98'), oceanDeep: c('#302868'), oceanFoam: c('#ff9944'),
    cloudOpacity: 0.15, starVisibility: 0.2, auroraVisibility: 0.1, rainIntensity: 0,
  },
];

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpSkyGradient(a: SkyStop[], b: SkyStop[], t: number): SkyStop[] {
  const result: SkyStop[] = [];
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    result.push({
      stop: lerpScalar(a[i].stop, b[i].stop, t),
      color: new THREE.Color().lerpColors(a[i].color, b[i].color, t),
    });
  }
  return result;
}

const _white = new THREE.Color('#ffffff');
const _tmpColor = new THREE.Color();

export class DayNightCycle {
  state: DayNightState;
  private cycleDuration: number;
  private elapsed: number;
  private isRaining = false;
  private rainTimer = 0;
  private rainDuration = 0;
  private rainFadeIn = 3;
  private rainFadeOut = 5;
  private rainPeak = 0;
  private nextRainCheck = 0.5;
  private cycleCount = 0;

  constructor() {
    this.cycleDuration = CYCLE_DURATION;
    this.elapsed = CYCLE_DURATION * 0.25;

    const day = KEY_FRAMES[0];
    this.state = {
      sunDirection: new THREE.Vector3(1, 0.3, 0),
      sunColor: day.sunColor.clone(), sunIntensity: day.sunIntensity,
      sun2Color: day.sun2Color.clone(), sun2Intensity: day.sun2Intensity,
      fillColor: day.fillColor.clone(), fillIntensity: day.fillIntensity,
      backColor: day.backColor.clone(), backIntensity: day.backIntensity,
      hemiSkyColor: day.hemiSkyColor.clone(), hemiGroundColor: day.hemiGroundColor.clone(), hemiIntensity: day.hemiIntensity,
      skyGradient: day.skyGradient.map(s => ({ stop: s.stop, color: s.color.clone() })),
      fogColor: day.fogColor.clone(), fogNear: day.fogNear, fogFar: day.fogFar,
      atmosphereColor: day.atmosphereColor.clone(),
      cloudOpacity: day.cloudOpacity,
      starVisibility: 0, auroraVisibility: 0, rainIntensity: 0,
      timeOfDay: 0.25,
      terrainTint: new THREE.Color('#ffffff'),
      oceanShallow: day.oceanShallow.clone(),
      oceanDeep: day.oceanDeep.clone(),
      oceanFoam: day.oceanFoam.clone(),
    };
  }

  update(deltaTime: number): void {
    this.elapsed += deltaTime;
    const prevTimeOfDay = this.state.timeOfDay;
    const timeOfDay = (this.elapsed / this.cycleDuration) % 1;
    this.state.timeOfDay = timeOfDay;
    if (timeOfDay < prevTimeOfDay) this.cycleCount++;

    const angle = timeOfDay * Math.PI * 2;
    this.state.sunDirection.set(Math.cos(angle), Math.sin(angle) * 0.3, Math.sin(angle)).normalize();

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
      if (i === frames.length - 1) { beforeIdx = i; afterIdx = 0; }
    }

    const before = frames[beforeIdx];
    const after = frames[afterIdx];

    let range: number, progress: number;
    if (after.time > before.time) {
      range = after.time - before.time;
      progress = (timeOfDay - before.time) / range;
    } else {
      range = (1 - before.time) + after.time;
      progress = timeOfDay >= before.time
        ? (timeOfDay - before.time) / range
        : (1 - before.time + timeOfDay) / range;
    }
    const t = progress * progress * (3 - 2 * progress);

    // Interpolate all
    this.state.sunColor.lerpColors(before.sunColor, after.sunColor, t);
    this.state.sunIntensity = lerpScalar(before.sunIntensity, after.sunIntensity, t);
    this.state.sun2Color.lerpColors(before.sun2Color, after.sun2Color, t);
    this.state.sun2Intensity = lerpScalar(before.sun2Intensity, after.sun2Intensity, t);
    this.state.fillColor.lerpColors(before.fillColor, after.fillColor, t);
    this.state.fillIntensity = lerpScalar(before.fillIntensity, after.fillIntensity, t);
    this.state.backColor.lerpColors(before.backColor, after.backColor, t);
    this.state.backIntensity = lerpScalar(before.backIntensity, after.backIntensity, t);
    this.state.hemiSkyColor.lerpColors(before.hemiSkyColor, after.hemiSkyColor, t);
    this.state.hemiGroundColor.lerpColors(before.hemiGroundColor, after.hemiGroundColor, t);
    this.state.hemiIntensity = lerpScalar(before.hemiIntensity, after.hemiIntensity, t);

    this.state.skyGradient = lerpSkyGradient(before.skyGradient, after.skyGradient, t);
    this.state.fogColor.lerpColors(before.fogColor, after.fogColor, t);
    this.state.fogNear = lerpScalar(before.fogNear, after.fogNear, t);
    this.state.fogFar = lerpScalar(before.fogFar, after.fogFar, t);
    this.state.atmosphereColor.lerpColors(before.atmosphereColor, after.atmosphereColor, t);
    this.state.cloudOpacity = lerpScalar(before.cloudOpacity, after.cloudOpacity, t);
    this.state.starVisibility = lerpScalar(before.starVisibility, after.starVisibility, t);
    this.state.auroraVisibility = lerpScalar(before.auroraVisibility, after.auroraVisibility, t);

    this.state.oceanShallow.lerpColors(before.oceanShallow, after.oceanShallow, t);
    this.state.oceanDeep.lerpColors(before.oceanDeep, after.oceanDeep, t);
    this.state.oceanFoam.lerpColors(before.oceanFoam, after.oceanFoam, t);

    // Terrain tint from sun
    const brightness = Math.min(1.0, Math.max(0.55, this.state.sunIntensity * 0.15 + 0.45));
    _tmpColor.copy(this.state.sunColor).lerp(_white, 0.6);
    this.state.terrainTint.copy(_tmpColor).multiplyScalar(brightness);

    // Rain
    const baseRain = lerpScalar(before.rainIntensity, after.rainIntensity, t);
    this.updateRain(deltaTime, timeOfDay);
    this.state.rainIntensity = Math.max(baseRain, this.getRainOverlay());
  }

  private updateRain(deltaTime: number, timeOfDay: number): void {
    if (this.isRaining) {
      this.rainTimer += deltaTime;
      if (this.rainTimer >= this.rainFadeIn + this.rainDuration + this.rainFadeOut) {
        this.isRaining = false;
        this.rainTimer = 0;
      }
    }
    const cp = this.nextRainCheck;
    if (!this.isRaining && timeOfDay >= cp && timeOfDay < cp + 0.02) {
      if (Math.random() < 0.1) {
        this.isRaining = true; this.rainTimer = 0;
        this.rainDuration = 8 + Math.random() * 12;
        this.rainPeak = 0.5 + Math.random() * 0.5;
      }
      this.nextRainCheck = timeOfDay < 0.5 ? 0.5 + Math.random() * 0.3 : Math.random() * 0.3;
    }
  }

  private getRainOverlay(): number {
    if (!this.isRaining) return 0;
    const t = this.rainTimer;
    if (t < this.rainFadeIn) return this.rainPeak * (t / this.rainFadeIn);
    if (t < this.rainFadeIn + this.rainDuration) return this.rainPeak;
    const f = t - this.rainFadeIn - this.rainDuration;
    return this.rainPeak * Math.max(0, 1 - f / this.rainFadeOut);
  }
}

/**
 * Stubs for p5.sound APIs so sketches that reference sound don't crash.
 *
 * Instance methods are patched onto the p5 instance; constructor-level
 * classes are attached to the p5 constructor itself (e.g. p5.SoundFile).
 */

const noop = () => {};
const noopThis = function (this: any) { return this; };
const noopPromise = () => Promise.resolve();

// Common methods shared by most p5.sound stub classes
const COMMON_METHODS = [
  "play", "stop", "pause", "start", "connect", "disconnect",
  "amp", "setVolume", "pan", "rate", "set", "process",
  "freq", "res", "toggle", "setType", "dispose",
] as const;

function makeStubClass(extra: Record<string, any> = {}): new (...args: any[]) => any {
  return class StubSoundNode {
    constructor() {
      for (const m of COMMON_METHODS) {
        (this as any)[m] = noop;
      }
      Object.assign(this, extra);
    }
  } as any;
}

// Classes to attach to p5 constructor (p5.SoundFile, p5.Amplitude, etc.)
const SOUND_CLASSES: Record<string, new (...args: any[]) => any> = {
  SoundFile: makeStubClass({
    isLoaded: () => false,
    isPlaying: () => false,
    isPaused: () => false,
    isLooping: () => false,
    duration: () => 0,
    currentTime: () => 0,
    channels: () => 1,
    sampleRate: () => 44100,
    frames: () => 0,
    getPeaks: () => [],
    setLoop: noop,
    setPath: noop,
    addCue: () => 0,
    removeCue: noop,
    clearCues: noop,
  }),
  Amplitude: makeStubClass({
    getLevel: () => 0,
    toggleNormalize: noop,
    smooth: noop,
    setInput: noop,
  }),
  AudioIn: makeStubClass({
    start: noopPromise,
    getSources: () => Promise.resolve([]),
    setSource: noop,
    getLevel: () => 0,
    enabled: false,
  }),
  FFT: makeStubClass({
    analyze: () => new Uint8Array(1024),
    waveform: () => new Float32Array(1024),
    getEnergy: () => 0,
    getCentroid: () => 0,
    smooth: noop,
    setInput: noop,
    linAverages: () => [],
    logAverages: () => [],
    getOctaveBands: () => [],
  }),
  Oscillator: makeStubClass({
    setType: noop,
    freq: noop,
    amp: noop,
    add: noop,
    mult: noop,
    phase: noop,
  }),
  Noise: makeStubClass({ setType: noop }),
  Env: makeStubClass({ setADSR: noop, setRange: noop, setExp: noop, triggerAttack: noop, triggerRelease: noop }),
  Envelope: makeStubClass({ setADSR: noop, setRange: noop, setExp: noop, triggerAttack: noop, triggerRelease: noop }),
  Delay: makeStubClass({ delayTime: noop, feedback: noop, filter: noop, drywet: noop }),
  Filter: makeStubClass({ freq: noop, res: noop, drywet: noop, setType: noop }),
  LowPass: makeStubClass({ freq: noop, res: noop }),
  HighPass: makeStubClass({ freq: noop, res: noop }),
  BandPass: makeStubClass({ freq: noop, res: noop }),
  Reverb: makeStubClass({ drywet: noop, set: noop }),
  Convolver: makeStubClass({ addImpulse: noop, resetImpulse: noop, drywet: noop }),
  MonoSynth: makeStubClass({ setADSR: noop, noteAttack: noop, noteRelease: noop }),
  PolySynth: makeStubClass({ setADSR: noop, noteAttack: noop, noteRelease: noop }),
  SoundLoop: makeStubClass({ start: noop, stop: noop, pause: noop, syncedStart: noop }),
  SoundRecorder: makeStubClass({ record: noop, stop: noop }),
  Phrase: makeStubClass(),
  Part: makeStubClass({ start: noop, stop: noop, pause: noop, loop: noop, noLoop: noop, addPhrase: noop, removePhrase: noop }),
  Score: makeStubClass({ start: noop, stop: noop, pause: noop, loop: noop, noLoop: noop }),
  Compressor: makeStubClass({ attack: noop, knee: noop, ratio: noop, threshold: noop, release: noop, drywet: noop }),
  Gain: makeStubClass({ amp: noop }),
  Panner3D: makeStubClass({ set: noop, positionX: noop, positionY: noop, positionZ: noop }),
  PeakDetect: makeStubClass({ update: noop, onPeak: noop }),
  EQ: makeStubClass({ bands: [] }),
};

export function patchSoundStubs(p: any, p5Constructor: any): void {
  // Instance-level no-op methods
  p.soundFormats = noop;
  p.userStartAudio = noopPromise;
  p.getAudioContext = () => (typeof window !== "undefined" ? new (window as any).AudioContext() : {});

  // loadSound needs to handle p5's preload lifecycle
  p.loadSound = function (_path: string, successCb?: Function, errorCb?: Function) {
    const stub = new SOUND_CLASSES.SoundFile();
    // Decrement preload counter on next microtask so p5's preload can finish
    queueMicrotask(() => {
      try { p._decrementPreload(); } catch {}
      if (successCb) successCb(stub);
    });
    return stub;
  };

  // Attach stub classes to p5 constructor
  for (const [name, Cls] of Object.entries(SOUND_CLASSES)) {
    if (!(p5Constructor as any)[name]) {
      (p5Constructor as any)[name] = Cls;
    }
  }
}

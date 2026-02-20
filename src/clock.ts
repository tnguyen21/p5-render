/**
 * Deterministic time control for headless p5.js rendering.
 *
 * No real clock is used. Everything is derived from the frame count
 * and the configured frame rate, so the same sketch + seed + frame
 * always produces the same output.
 */

export class DeterministicClock {
  private _frameCount: number = 0;
  private _frameRate: number;
  private _deltaTime: number;

  constructor(frameRate: number = 60) {
    this._frameRate = frameRate;
    this._deltaTime = 1000 / frameRate;
  }

  get frameCount(): number {
    return this._frameCount;
  }

  get frameRate(): number {
    return this._frameRate;
  }

  /** Returns simulated millis since sketch start */
  millis(): number {
    return this._frameCount * this._deltaTime;
  }

  /** Fixed delta time between frames in ms */
  get deltaTime(): number {
    return this._deltaTime;
  }

  /** Advance one frame */
  tick(): void {
    this._frameCount++;
  }

  /** Reset to frame 0 */
  reset(): void {
    this._frameCount = 0;
  }

  /**
   * Patch a p5 instance so that its time functions use our
   * deterministic clock instead of Date.now / performance.now.
   */
  patchP5Instance(p: any): void {
    const self = this;
    // Override millis() to return deterministic value
    p.millis = () => self.millis();
    // p5 stores deltaTime and frameCount as properties on the instance.
    // We need to patch them before each frame via patchFrame().
  }

  /**
   * Called before each draw() invocation to sync p5 instance
   * properties with our deterministic clock.
   */
  patchFrame(p: any): void {
    p._frameRate = this._frameRate;
    p.deltaTime = this._deltaTime;
    // p5 increments frameCount itself, but we override it to be deterministic
    p.frameCount = this._frameCount;
  }
}

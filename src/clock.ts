/**
 * Deterministic time control. Everything is derived from frame count
 * and configured frame rate — same sketch + seed + frame = same output.
 */
export class DeterministicClock {
  private _frameCount = 0;
  private _frameRate: number;
  private _deltaTime: number;

  constructor(frameRate = 60) {
    this._frameRate = frameRate;
    this._deltaTime = 1000 / frameRate;
  }

  millis(): number {
    return this._frameCount * this._deltaTime;
  }

  tick(): void {
    this._frameCount++;
  }

  patchP5Instance(p: any): void {
    p.millis = () => this.millis();
  }

  patchFrame(p: any): void {
    p._frameRate = this._frameRate;
    p.deltaTime = this._deltaTime;
    p.frameCount = this._frameCount;
  }
}

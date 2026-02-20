declare module "gl" {
  function createGL(width: number, height: number, attrs?: Record<string, any>): WebGLRenderingContext | null;
  export default createGL;
}

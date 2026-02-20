function setup() {
  createCanvas(400, 400, WEBGL);
  background(30);

  ambientLight(60);
  directionalLight(255, 255, 255, 0.5, 0.5, -1);

  noStroke();
  ambientMaterial(200, 100, 100);
  rotateX(0.5);
  rotateY(0.7);
  box(80);

  push();
  translate(120, 0, 0);
  ambientMaterial(100, 200, 100);
  sphere(50);
  pop();

  push();
  translate(-120, 0, 0);
  ambientMaterial(100, 100, 200);
  cylinder(40, 100);
  pop();
}

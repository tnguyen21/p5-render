function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);

  fill(0);
  textSize(18);
  textAlign(LEFT, TOP);

  text("frameCount: " + frameCount, 20, 20);
  text("millis(): " + nf(millis(), 1, 2), 20, 50);
  text("deltaTime: " + nf(deltaTime, 1, 2), 20, 80);
  text("frameRate: " + nf(frameRate(), 1, 2), 20, 110);
}

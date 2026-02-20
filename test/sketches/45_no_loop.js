function setup() {
  createCanvas(400, 400);
  noLoop();
}

function draw() {
  background(220);

  fill(0);
  textAlign(CENTER, CENTER);
  textSize(64);
  text("ONCE", width / 2, height / 2);

  textSize(16);
  text("frameCount: " + frameCount, width / 2, height / 2 + 60);
}

let counter = 0;

function setup() {
  createCanvas(400, 400);
  noLoop();
}

function draw() {
  counter++;

  background(220);

  fill(0);
  textAlign(CENTER, CENTER);
  textSize(48);
  text("Counter: " + counter, width / 2, height / 2);

  textSize(16);
  text("frameCount: " + frameCount, width / 2, height / 2 + 50);
  text("Each redraw() increments counter", width / 2, height / 2 + 80);
}

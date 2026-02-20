function setup() {
  createCanvas(400, 400);
  textAlign(CENTER, CENTER);
}

function draw() {
  background(240);

  fill(0);
  textSize(80);
  text(frameCount, width / 2, height / 2);

  textSize(16);
  text("frameCount", width / 2, height / 2 + 60);
}

function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);

  let x = frameCount * 5;
  fill(50, 100, 200);
  noStroke();
  ellipse(x, height / 2, 60, 60);

  fill(0);
  textSize(14);
  text("frame: " + frameCount, 10, 20);
  text("x: " + x, 10, 40);
}

function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(2);
  fill(200, 100, 255);
  rectMode(CENTER);

  // Translate + rotate + scale combined
  translate(200, 200);
  rotate(PI / 6); // 30 degrees
  scale(1.5);
  rect(0, 0, 100, 60);
}

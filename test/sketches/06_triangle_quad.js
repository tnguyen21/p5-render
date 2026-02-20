function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(2);

  // Orange triangle on the left
  fill(255, 165, 0);
  triangle(100, 80, 30, 250, 170, 250);

  // Purple quad on the right
  fill(128, 0, 128);
  quad(230, 100, 370, 120, 350, 280, 250, 260);
}

function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(2);
  rectMode(CENTER);

  // Level 0: no transform, default fill (white)
  circle(50, 50, 40);

  // Level 1: translate, red fill
  push();
  translate(200, 100);
  fill(255, 0, 0);
  rotate(PI / 8);
  rect(0, 0, 80, 50);

  // Level 2: additional translate, green fill
  push();
  translate(0, 120);
  fill(0, 200, 0);
  scale(1.3);
  circle(0, 0, 50);

  // Level 3: additional rotate, blue fill
  push();
  translate(60, 0);
  fill(0, 0, 255);
  rotate(PI / 4);
  rect(0, 0, 40, 40);
  pop(); // back to level 2

  // Verify level 2 style is green
  circle(0, 60, 30);
  pop(); // back to level 1

  // Verify level 1 style is red
  rect(0, 60, 50, 30);
  pop(); // back to level 0

  // Verify level 0 style is default (white)
  circle(350, 350, 40);
}

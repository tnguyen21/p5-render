let x, y, vx, vy, r;

function setup() {
  createCanvas(400, 400);
  r = 30;
  x = r;
  y = r;
  vx = 5;
  vy = 3.7;
}

function draw() {
  background(30);

  // Update position
  x += vx;
  y += vy;

  // Bounce off walls
  if (x + r > width || x - r < 0) {
    vx *= -1;
    x = constrain(x, r, width - r);
  }
  if (y + r > height || y - r < 0) {
    vy *= -1;
    y = constrain(y, r, height - r);
  }

  // Draw the ball
  noStroke();
  fill(100, 200, 255);
  ellipse(x, y, r * 2, r * 2);

  // Draw trail indicator
  fill(255);
  textSize(14);
  text("Frame: " + frameCount, 10, 20);
}

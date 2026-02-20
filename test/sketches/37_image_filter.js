function setup() {
  createCanvas(400, 400);
  background(255);

  // Draw colored shapes on the left half
  noStroke();
  fill(255, 0, 0);
  ellipse(100, 100, 120, 120);

  fill(0, 200, 0);
  rect(30, 180, 140, 80);

  fill(0, 0, 255);
  triangle(50, 350, 150, 280, 150, 370);

  fill(255, 200, 0);
  ellipse(100, 340, 60, 60);

  // Grab the left half as the "before" image
  let before = get(0, 0, 200, 400);

  // Apply grayscale filter to the entire canvas
  filter(GRAY);

  // Grab the left half as the "after" image
  let after = get(0, 0, 200, 400);

  // Clear canvas and draw side by side
  background(255);

  // Draw labels
  fill(0);
  textSize(16);
  textAlign(CENTER);
  text("Before (color)", 100, 20);
  text("After (GRAY)", 300, 20);

  // Draw before on the left, after on the right
  image(before, 0, 30);
  image(after, 200, 30);

  // Draw a dividing line
  stroke(0);
  strokeWeight(2);
  line(200, 0, 200, 400);

  noLoop();
}

function draw() {}

function setup() {
  createCanvas(400, 400);
  background(220);

  // Draw some shapes in the top-left quadrant
  noStroke();
  fill(255, 0, 0);
  ellipse(80, 80, 100, 100);

  fill(0, 150, 255);
  rect(20, 120, 160, 60);

  fill(255, 200, 0);
  triangle(30, 50, 150, 30, 100, 130);

  stroke(0);
  strokeWeight(2);
  noFill();
  rect(0, 0, 200, 200);

  // Grab the top-left 200x200 region
  let region = get(0, 0, 200, 200);

  // Draw it in the bottom-right corner
  image(region, 200, 200);

  // Label the regions
  fill(0);
  noStroke();
  textSize(14);
  text("Original", 10, 195);
  text("Copied region", 210, 395);

  noLoop();
}

function draw() {}

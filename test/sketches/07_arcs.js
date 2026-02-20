function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(2);

  // PIE mode (left)
  fill(255, 100, 100);
  arc(80, 200, 120, 120, 0, PI + QUARTER_PI, PIE);

  // CHORD mode (center)
  fill(100, 255, 100);
  arc(200, 200, 120, 120, 0, PI + QUARTER_PI, CHORD);

  // OPEN mode (right)
  fill(100, 100, 255);
  arc(320, 200, 120, 120, 0, PI + QUARTER_PI, OPEN);

  // Labels
  fill(0);
  noStroke();
  textSize(14);
  textAlign(CENTER);
  text("PIE", 80, 290);
  text("CHORD", 200, 290);
  text("OPEN", 320, 290);
}

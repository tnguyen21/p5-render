function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  // Shape with noFill (stroke only)
  noFill();
  stroke(0, 0, 200);
  strokeWeight(3);
  circle(100, 200, 120);

  // Shape with noStroke (fill only)
  fill(200, 0, 0);
  noStroke();
  circle(250, 200, 120);

  // Shape with both noFill and noStroke (invisible, should not crash)
  noFill();
  noStroke();
  circle(350, 200, 120);

  // Labels
  fill(0);
  noStroke();
  textSize(14);
  textAlign(CENTER);
  text("noFill", 100, 290);
  text("noStroke", 250, 290);
  text("both (invisible)", 350, 290);
}

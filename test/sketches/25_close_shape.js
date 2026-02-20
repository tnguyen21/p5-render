function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(3);
  fill(180, 200, 255);

  // Left shape: endShape(CLOSE) -- closed path
  beginShape();
  vertex(30, 100);
  vertex(100, 50);
  vertex(170, 100);
  vertex(170, 250);
  vertex(30, 250);
  endShape(CLOSE);

  // Right shape: endShape() -- open path, no closing edge
  beginShape();
  vertex(230, 100);
  vertex(300, 50);
  vertex(370, 100);
  vertex(370, 250);
  vertex(230, 250);
  endShape();

  // Labels
  fill(0);
  noStroke();
  textSize(14);
  textAlign(CENTER);
  text("CLOSE", 100, 300);
  text("OPEN", 300, 300);
}

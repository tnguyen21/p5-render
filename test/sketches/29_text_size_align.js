function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  let refX = 200;
  textSize(20);
  fill(0);
  noStroke();

  // Draw vertical reference line at alignment x position
  stroke(255, 0, 0);
  strokeWeight(1);
  line(refX, 0, refX, height);
  noStroke();

  // LEFT aligned
  textAlign(LEFT);
  text("LEFT aligned", refX, 100);

  // CENTER aligned
  textAlign(CENTER);
  text("CENTER aligned", refX, 200);

  // RIGHT aligned
  textAlign(RIGHT);
  text("RIGHT aligned", refX, 300);
}

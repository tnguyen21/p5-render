function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  fill(0);
  noStroke();
  textSize(24);

  textStyle(NORMAL);
  text("Normal text", 50, 100);

  textStyle(BOLD);
  text("Bold text", 50, 160);

  textStyle(ITALIC);
  text("Italic text", 50, 220);

  textStyle(BOLDITALIC);
  text("BoldItalic text", 50, 280);
}

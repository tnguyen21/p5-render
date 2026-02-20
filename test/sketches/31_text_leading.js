function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  fill(0);
  noStroke();
  textSize(16);

  let multiline = "Line one\nLine two\nLine three\nLine four";

  // Tight leading (left column)
  textLeading(14);
  text("Leading: 14", 30, 30);
  text(multiline, 30, 60);

  // Normal leading (center column)
  textLeading(22);
  text("Leading: 22", 160, 30);
  text(multiline, 160, 60);

  // Wide leading (right column)
  textLeading(36);
  text("Leading: 36", 290, 30);
  text(multiline, 290, 60);
}

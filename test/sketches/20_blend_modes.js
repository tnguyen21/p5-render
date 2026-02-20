function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  noStroke();
  let modes = [BLEND, ADD, MULTIPLY, SCREEN];
  let labels = ["BLEND", "ADD", "MULTIPLY", "SCREEN"];
  let sectionW = width / modes.length;

  for (let i = 0; i < modes.length; i++) {
    let x = i * sectionW;

    // Draw base colors in normal blend mode
    blendMode(BLEND);
    fill(200, 60, 60);
    rect(x + 10, 80, sectionW - 20, 120);

    // Overlay with the test blend mode
    blendMode(modes[i]);
    fill(60, 60, 200);
    rect(x + 20, 140, sectionW - 20, 120);

    // Reset for label
    blendMode(BLEND);
    fill(0);
    textSize(12);
    textAlign(CENTER);
    text(labels[i], x + sectionW / 2, 320);
  }
}

function setup() {
  createCanvas(400, 400);
  background(128);

  let modes = [BLEND, ADD, DARKEST, LIGHTEST, DIFFERENCE, EXCLUSION, MULTIPLY, SCREEN, REPLACE, OVERLAY, HARD_LIGHT, SOFT_LIGHT, DODGE, BURN];
  let cols = 4;
  let rows = ceil(modes.length / cols);
  let cellW = width / cols;
  let cellH = height / rows;

  noStroke();

  for (let i = 0; i < modes.length; i++) {
    let col = i % cols;
    let row = floor(i / cols);
    let cx = col * cellW;
    let cy = row * cellH;

    // Reset blend mode and draw background color for this cell
    blendMode(BLEND);
    fill(100, 150, 200);
    rect(cx, cy, cellW, cellH);

    // Apply the blend mode and draw overlapping shapes
    blendMode(modes[i]);

    fill(255, 80, 80);
    rect(cx + 5, cy + 5, cellW * 0.6, cellH * 0.6);

    fill(80, 255, 80);
    rect(cx + cellW * 0.3, cy + cellH * 0.2, cellW * 0.6, cellH * 0.6);

    fill(80, 80, 255);
    ellipse(cx + cellW / 2, cy + cellH / 2, cellW * 0.5, cellH * 0.5);
  }

  // Reset blend mode
  blendMode(BLEND);

  noLoop();
}

function draw() {}

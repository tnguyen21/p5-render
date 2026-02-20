function setup() {
  createCanvas(400, 400);
  background(220);

  // Draw some colorful shapes
  noStroke();
  fill(255, 0, 0);
  ellipse(100, 100, 120, 120);

  fill(0, 255, 0);
  rect(200, 50, 150, 100);

  fill(0, 0, 255);
  triangle(50, 300, 200, 200, 200, 350);

  fill(255, 255, 0);
  ellipse(300, 300, 100, 100);

  // Invert all pixel colors
  loadPixels();
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255 - pixels[i];       // R
    pixels[i + 1] = 255 - pixels[i + 1]; // G
    pixels[i + 2] = 255 - pixels[i + 2]; // B
    // Alpha stays the same
  }
  updatePixels();

  noLoop();
}

function draw() {}

function setup() {
  createCanvas(400, 400);
  background(220);

  // Draw a red rectangle
  noStroke();
  fill(255, 0, 0);
  rect(50, 50, 100, 100);

  // Load pixel data
  loadPixels();

  // If we got here, pixels array is populated
  // Verify by checking a pixel inside the red rect
  let idx = (75 * width + 75) * 4;
  let r = pixels[idx];
  let g = pixels[idx + 1];
  let b = pixels[idx + 2];

  // Draw a green rect to prove loadPixels() succeeded
  fill(0, 200, 0);
  rect(200, 50, 100, 100);

  // Draw text confirming pixel values
  fill(0);
  textSize(14);
  text("Red rect pixel: R=" + r + " G=" + g + " B=" + b, 20, 220);
  text("pixels.length: " + pixels.length, 20, 250);
  text("Expected length: " + (width * height * 4), 20, 280);

  noLoop();
}

function draw() {}

function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  // Lines with different strokeWeights
  stroke(0);

  strokeWeight(1);
  line(50, 50, 350, 50);

  strokeWeight(3);
  line(50, 100, 350, 100);

  strokeWeight(5);
  line(50, 150, 350, 150);

  strokeWeight(10);
  line(50, 200, 350, 200);

  // Grid of points
  strokeWeight(6);
  stroke(200, 0, 0);
  for (let x = 50; x <= 350; x += 30) {
    for (let y = 260; y <= 380; y += 30) {
      point(x, y);
    }
  }
}

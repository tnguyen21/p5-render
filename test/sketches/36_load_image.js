let img;

function preload() {
  img = loadImage("test.png");
}

function setup() {
  createCanvas(400, 400);
  background(220);
  imageMode(CENTER);
  image(img, width / 2, height / 2);
  noLoop();
}

function draw() {}

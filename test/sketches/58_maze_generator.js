function setup() {
  createCanvas(400, 400);
  background(255);
  randomSeed(42);

  let cols = 20;
  let rows = 20;
  let cellW = width / cols;
  let cellH = height / rows;

  // Initialize grid: each cell tracks which walls are present
  // walls: [top, right, bottom, left]
  let grid = [];
  let visited = [];
  for (let i = 0; i < cols * rows; i++) {
    grid[i] = [true, true, true, true];
    visited[i] = false;
  }

  // Recursive backtracking DFS
  let stack = [];
  let current = 0;
  visited[current] = true;

  function getNeighbors(idx) {
    let x = idx % cols;
    let y = floor(idx / cols);
    let neighbors = [];

    if (y > 0 && !visited[idx - cols]) neighbors.push(idx - cols);       // top
    if (x < cols - 1 && !visited[idx + 1]) neighbors.push(idx + 1);      // right
    if (y < rows - 1 && !visited[idx + cols]) neighbors.push(idx + cols); // bottom
    if (x > 0 && !visited[idx - 1]) neighbors.push(idx - 1);             // left

    return neighbors;
  }

  function removeWalls(a, b) {
    let ax = a % cols;
    let ay = floor(a / cols);
    let bx = b % cols;
    let by = floor(b / cols);

    let dx = bx - ax;
    let dy = by - ay;

    if (dx === 1) {
      grid[a][1] = false; // remove right wall of a
      grid[b][3] = false; // remove left wall of b
    } else if (dx === -1) {
      grid[a][3] = false;
      grid[b][1] = false;
    } else if (dy === 1) {
      grid[a][2] = false; // remove bottom wall of a
      grid[b][0] = false; // remove top wall of b
    } else if (dy === -1) {
      grid[a][0] = false;
      grid[b][2] = false;
    }
  }

  // Iterative DFS
  let totalCells = cols * rows;
  let visitedCount = 1;
  stack.push(current);

  while (visitedCount < totalCells) {
    let neighbors = getNeighbors(current);
    if (neighbors.length > 0) {
      let next = neighbors[floor(random(neighbors.length))];
      stack.push(current);
      removeWalls(current, next);
      current = next;
      visited[current] = true;
      visitedCount++;
    } else if (stack.length > 0) {
      current = stack.pop();
    } else {
      break;
    }
  }

  // Draw the maze
  stroke(0);
  strokeWeight(2);

  for (let i = 0; i < cols * rows; i++) {
    let x = (i % cols) * cellW;
    let y = floor(i / cols) * cellH;

    if (grid[i][0]) line(x, y, x + cellW, y);                 // top
    if (grid[i][1]) line(x + cellW, y, x + cellW, y + cellH); // right
    if (grid[i][2]) line(x, y + cellH, x + cellW, y + cellH); // bottom
    if (grid[i][3]) line(x, y, x, y + cellH);                 // left
  }

  noLoop();
}

function draw() {}

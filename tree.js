const { Agent, Vector, utils } = require("flocc");
const { clone } = require("lodash");
const open = require("open");
const fs = require("fs");
const { createCanvas } = require("canvas");

function random(min = 0, max = 1, float = false) {
  let r = Math.random() * (max - min);
  if (!float) r = Math.round(r);
  return min + r;
}

let TIME = 0;
const STOP_TIME = 30000;

let width = 750;
let height = 750;
let canvas = createCanvas(width, height);
let context = canvas.getContext("2d");

const N = new Vector(0, -1);
const S = new Vector(0, 1);
const E = new Vector(1, 0);
const W = new Vector(-1, 0);
const dirs = [N, S, E, W];

const probs = [
  [1, 0, 1, 1], // ----
  [0, 0, 0, 1], // ---W
  [0, 0, 1, 0], // --E-
  [2, 2, 1, 1], // --EW
  [1, 0, 1, 1], // -S--
  [1, 0, 0, 0], // -S-W
  [1, 0, 0, 0], // -SE-
  [1, 0, 0, 0], // -SEW
  [0, 0, 1, 1], // N---
  [1, 0, 1, 0], // N--W
  [1, 0, 0, 1], // N-E-
  [1, 0, 1, 1], // N-EW
  [1, 0, 1, 1], // NS--
  [0, 0, 1, 0], // NS-W
  [0, 0, 0, 1], // NSE-
  [1, 1, 1, 1] // NSEW
];

function neighborsToProbs(x, y) {
  const amt = [W, E, S, N].reduce((acc, dir, i) => {
    if (pixelEquals(getPixel(x + dir.x, y + dir.y), BLACK)) return acc + 2 ** i;
    return acc;
  }, 0);
  return probs[amt];
}

const bb = {
  minX: width / 2,
  minY: height - 1,
  maxX: width / 2,
  maxY: height - 1
};

const agent = new Agent();
const WHITE = { r: 0, g: 0, b: 0, a: 0 };
const BLACK = { r: 0, g: 0, b: 0, a: 255 };

function weightedRandom(arr, probs) {
  const r = Math.random();
  const s = utils.sum(probs);
  const normalizedProbs = probs.map(p => p / s);

  let prob = 0;
  for (let i = 0; i < arr.length; i++) {
    prob += normalizedProbs[i];
    if (r <= prob) return arr[i];
  }
}

function getPixel(x, y) {
  if (x < 0 || x >= width || y < 0 || y >= width) return WHITE;
  const [r, g, b, a] = context.getImageData(x, y, 1, 1).data;
  return {
    r,
    g,
    b,
    a
  };
}

function setPixel(px, x, y) {
  context.fillStyle = `rgba(${px.r}, ${px.g}, ${px.b}, ${px.a})`;
  context.fillRect(x, y, 1, 1);
}

function pixelEquals(px1, px2) {
  return ["r", "g", "b", "a"].every(k => {
    return px1[k] === px2[k];
  });
}

function move() {
  let { x, y } = agent.get("location");
  // console.log(x, y);

  let theProbs = neighborsToProbs(x, y);

  let n = weightedRandom(dirs, theProbs);
  // console.log(n);
  x += n.x;
  y += n.y;
  agent.get("location").add(n);
  // console.log(x, y, agent.get("location").x, agent.get("location").y);

  if (x < 0 || x >= width || y < 0 || y >= height) {
    return;
  }

  if (pixelEquals(getPixel(x, y), BLACK)) {
    agent.set("last", n);
    process.nextTick(move);
  } else {
    setPixel(BLACK, x, y);
    if (x < bb.minX) bb.minX = x;
    if (y < bb.minY) bb.minY = y;
    if (x > bb.maxX) bb.maxX = x;
    if (y > bb.maxY) bb.maxY = y;
    return;
  }
}

function reset() {
  let r;
  do {
    r = new Vector(random(bb.minX, bb.maxX), random(bb.minY, bb.maxY));
  } while (pixelEquals(getPixel(r.x, r.y), WHITE));
  console.assert(pixelEquals(getPixel(r.x, r.y), BLACK));
  agent.set("location", r);
}

function seek() {
  const px = agent.get("location").x;
  const py = agent.get("location").y;
  move();
  const { x, y } = agent.get("location");
  console.assert(Math.abs(px - x) === 1 || Math.abs(py - y) === 1);
  // setPixel(BLACK, x, y);
  reset();
  if (TIME < STOP_TIME) {
    if (TIME % 1000 === 0) console.log("time: ", TIME);
    TIME++;
    process.nextTick(seek);
  } else {
    // context.strokeRect(bb.minX, bb.minY, bb.maxX - bb.minX, bb.maxY - bb.minY);
    fs.writeFileSync("./tree.png", canvas.toBuffer());
    open("./tree.png");
    console.log("done!");
  }
}

function init() {
  setPixel(BLACK, bb.maxX, bb.maxY);
  setPixel(BLACK, bb.maxX, bb.maxY - 1);
  reset();
  seek();
}

init();

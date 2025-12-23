#!/usr/bin/env node
// Generate 2D map of ethical systems using a simple distance-based layout (MDS-like)
// Mirrors scripts/generate_ethics_map_simple.py but in Node.js

const fs = require('fs');
const path = require('path');

// Tetralemma encoding vectors: A, B, Both, Neither
const TETRALEMMA_VECTORS = [ [1,0], [0,1], [1,1], [0,0] ];

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function encodeSystem(system, dimensions) {
  const vector = [];
  for (const dim of dimensions) {
    const dimId = dim.id;
    const systemVal = (system.profile || {})[dimId] || '';
    let tetra = [0,0];
    for (let i = 0; i < dim.options.length; i++) {
      if (dim.options[i].value === systemVal) {
        tetra = TETRALEMMA_VECTORS[i] || [0,0];
        break;
      }
    }
    vector.push(...tetra);
  }
  return vector;
}

function euclideanDistance(v1, v2) {
  let sum = 0;
  for (let i = 0; i < v1.length; i++) sum += (v1[i] - v2[i])**2;
  return Math.sqrt(sum);
}

function simpleMDS(distanceMatrix, nIter = 2000) {
  const n = distanceMatrix.length;
  // Initialize with deterministic pseudo-random positions
  let seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return (seed / 4294967296) * 2 - 1; };
  const coords = Array.from({length: n}, () => [rand()*100, rand()*100]);

  let learningRate = 1.0;
  for (let iter = 0; iter < nIter; iter++) {
    const grads = Array.from({length: n}, () => [0,0]);
    for (let i = 0; i < n; i++) {
      for (let j = i+1; j < n; j++) {
        const dx = coords[i][0] - coords[j][0];
        const dy = coords[i][1] - coords[j][1];
        const current = Math.sqrt(dx*dx + dy*dy) + 1e-10;
        const target = distanceMatrix[i][j];
        const scale = (current - target) / current;
        const gx = scale * dx;
        const gy = scale * dy;
        grads[i][0] += gx; grads[i][1] += gy;
        grads[j][0] -= gx; grads[j][1] -= gy;
      }
    }
    for (let i = 0; i < n; i++) {
      coords[i][0] -= (learningRate * grads[i][0]) / n;
      coords[i][1] -= (learningRate * grads[i][1]) / n;
    }
    learningRate *= 0.999;
  }
  return coords;
}

function main() {
  const scriptDir = __dirname;
  const dataDir = path.join(path.dirname(scriptDir), 'data');
  const systems = loadJSON(path.join(dataDir, 'ethical_systems.json'));
  const dimensions = loadJSON(path.join(dataDir, 'ethical_dimensions.json'));

  const encoded = systems.map(s => encodeSystem(s, dimensions));
  const n = systems.length;
  const dist = Array.from({length: n}, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i+1; j < n; j++) {
      const d = euclideanDistance(encoded[i], encoded[j]);
      dist[i][j] = d; dist[j][i] = d;
    }
  }
  const coords = simpleMDS(dist, 2000);
  const xs = coords.map(c => c[0]);
  const ys = coords.map(c => c[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scaleX = (maxX !== minX) ? 180.0 / (maxX - minX) : 1;
  const scaleY = (maxY !== minY) ? 180.0 / (maxY - minY) : 1;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const output = systems.map((s, i) => ({
    name: s.name,
    x: Math.round(((coords[i][0] - centerX) * scaleX) * 100) / 100,
    y: Math.round(((coords[i][1] - centerY) * scaleY) * 100) / 100,
    description: s.description,
    profile: s.profile,
  }));

  fs.writeFileSync(path.join(dataDir, 'ethical_systems_map.json'), JSON.stringify(output, null, 4));
  console.log('Successfully generated ethical_systems_map.json');
}

if (require.main === module) {
  main();
}


#!/usr/bin/env node
// tools/process-targets.js — Run 8th Wall image-target-cli on all marker PNGs
//
// Prerequisites:
//   1. Clone 8th Wall repo: git clone https://github.com/8thwall/8thwall.git
//   2. cd 8thwall/apps/image-target-cli && npm install
//   3. Come back here and set CLI_PATH below
//
// Usage:
//   node tools/process-targets.js

const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT     = path.join(__dirname, '..');
const IMG_DIR  = path.join(ROOT, 'assets', 'marker-images');
const OUT_DIR  = path.join(ROOT, 'assets', 'targets');

// ── CONFIGURE THIS PATH ───────────────────────────────────────────────────
// Path to the 8th Wall image-target-cli index.js
// Clone https://github.com/8thwall/8thwall and point here:
const CLI_PATH = path.join(ROOT, '..', '8thwall', 'apps', 'image-target-cli', 'index.js');
// ─────────────────────────────────────────────────────────────────────────

const MARKERS = ['marker-a', 'marker-b', 'marker-c'];

function run() {
  if (!fs.existsSync(CLI_PATH)) {
    console.error(`\n  ✗ CLI not found at: ${CLI_PATH}`);
    console.error(`\n  Steps to fix:`);
    console.error(`    git clone https://github.com/8thwall/8thwall.git ../8thwall`);
    console.error(`    cd ../8thwall/apps/image-target-cli && npm install`);
    console.error(`    cd back here and run: node tools/process-targets.js\n`);
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Processing image targets with 8th Wall CLI…\n');

  for (const name of MARKERS) {
    const inputPng = path.join(IMG_DIR, `${name}.png`);

    if (!fs.existsSync(inputPng)) {
      console.error(`  ✗ Missing PNG: ${inputPng}`);
      console.error(`    Run: node tools/generate-markers.js  first`);
      continue;
    }

    try {
      // The 8th Wall image-target-cli command (adjust flags per CLI version)
      const cmd = `node "${CLI_PATH}" --input "${inputPng}" --output "${OUT_DIR}"`;
      console.log(`  Processing ${name}…`);
      execSync(cmd, { stdio: 'inherit' });
      console.log(`  ✓ ${name} → ${OUT_DIR}\n`);
    } catch (err) {
      console.error(`  ✗ Failed on ${name}: ${err.message}`);
    }
  }

  console.log('Done. Check assets/targets/ for the generated files.');
  console.log('Then deploy to GitHub Pages and test on your phone.');
}

run();

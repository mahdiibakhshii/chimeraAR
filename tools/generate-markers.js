#!/usr/bin/env node
// tools/generate-markers.js — Convert SVG marker designs → PNG/JPG for image-target-cli
//
// Usage:
//   cd tools
//   npm install
//   node generate-markers.js
//
// Output: assets/marker-images/marker-{a,b,c}.png  (for image-target-cli)
//         assets/marker-images/marker-{a,b,c}.jpg  (for printing)

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const ROOT      = path.join(__dirname, '..');
const IMG_DIR   = path.join(ROOT, 'assets', 'marker-images');
const MARKERS   = ['marker-a', 'marker-b', 'marker-c'];
const SIZE      = 1024;  // higher res for better feature extraction

async function convert() {
  console.log('Converting SVG markers to PNG/JPG…\n');

  for (const name of MARKERS) {
    const svgPath = path.join(IMG_DIR, `${name}.svg`);
    const pngPath = path.join(IMG_DIR, `${name}.png`);
    const jpgPath = path.join(IMG_DIR, `${name}.jpg`);

    if (!fs.existsSync(svgPath)) {
      console.error(`  ✗ Missing: ${svgPath}`);
      continue;
    }

    const svgBuf = fs.readFileSync(svgPath);

    // PNG for image-target-cli (lossless, highest quality)
    await sharp(svgBuf, { density: 300 })
      .resize(SIZE, SIZE, { fit: 'contain', background: '#ffffff' })
      .png({ compressionLevel: 6 })
      .toFile(pngPath);

    // JPG for printing (high quality, smaller file)
    await sharp(svgBuf, { density: 300 })
      .resize(SIZE, SIZE, { fit: 'contain', background: '#ffffff' })
      .jpeg({ quality: 95 })
      .toFile(jpgPath);

    const pngStat = fs.statSync(pngPath);
    const jpgStat = fs.statSync(jpgPath);
    console.log(`  ✓ ${name}  PNG: ${(pngStat.size/1024).toFixed(0)}KB  JPG: ${(jpgStat.size/1024).toFixed(0)}KB`);
  }

  console.log('\nDone. Next step: run the image-target-cli on the PNG files.');
  console.log('See README.md → "Processing Image Targets"');
}

convert().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

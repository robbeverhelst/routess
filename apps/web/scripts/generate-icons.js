#!/usr/bin/env node

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_IMAGE = path.join(__dirname, '../public/logo.png');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Icon sizes needed for PWA
const ICON_SIZES = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
];

// Maskable icons (with padding for safe area)
const MASKABLE_SIZES = [
  { size: 192, name: 'icon-192x192-maskable.png' },
  { size: 512, name: 'icon-512x512-maskable.png' },
];

// Shortcut icons
const SHORTCUT_ICONS = [
  { name: 'shortcut-new-route.png', emoji: '🗺️' },
  { name: 'shortcut-location.png', emoji: '📍' },
  { name: 'shortcut-import.png', emoji: '📁' },
];

async function generateIcons() {
  console.log('🎨 Generating PWA icons...');

  try {
    // Generate regular icons
    for (const icon of ICON_SIZES) {
      await sharp(INPUT_IMAGE)
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(path.join(OUTPUT_DIR, icon.name));
      
      console.log(`✅ Generated ${icon.name}`);
    }

    // Generate maskable icons (with 20% padding for safe area)
    for (const icon of MASKABLE_SIZES) {
      const paddedSize = Math.round(icon.size * 0.8); // 20% padding
      const padding = Math.round((icon.size - paddedSize) / 2);
      
      await sharp(INPUT_IMAGE)
        .resize(paddedSize, paddedSize, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(path.join(OUTPUT_DIR, icon.name));
      
      console.log(`✅ Generated ${icon.name} (maskable)`);
    }

    // Generate simple shortcut icons (you can replace these with custom designs later)
    for (const shortcut of SHORTCUT_ICONS) {
      // Create a simple colored square with the emoji/icon
      // For now, we'll just create colored versions of the main icon
      const hue = shortcut.name.includes('new') ? 120 : 
                  shortcut.name.includes('location') ? 240 : 0;
      
      await sharp(INPUT_IMAGE)
        .resize(96, 96, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .modulate({ hue })
        .png()
        .toFile(path.join(OUTPUT_DIR, shortcut.name));
      
      console.log(`✅ Generated ${shortcut.name}`);
    }

    console.log('🎉 All PWA icons generated successfully!');
    console.log(`📁 Icons saved to: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

// Run the icon generation
generateIcons(); 
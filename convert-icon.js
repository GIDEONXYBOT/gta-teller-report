const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create build directory if it doesn't exist
const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// SVG to PNG conversion
const svgPath = path.join(buildDir, 'icon.svg');
const png512Path = path.join(buildDir, 'icon.png');
const png256Path = path.join(buildDir, 'icon_256.png');
const icoPath = path.join(buildDir, 'icon.ico');

async function convertIcon() {
  try {
    // Convert SVG to 512x512 PNG
    console.log('Converting SVG to PNG (512x512)...');
    await sharp(svgPath, { density: 384 })
      .png()
      .resize(512, 512, { fit: 'contain', background: { r: 31, g: 41, b: 55 } })
      .toFile(png512Path);
    
    console.log('✓ Created 512x512 PNG');

    // Convert to 256x256 PNG (for ICO)
    console.log('Converting to 256x256 PNG...');
    await sharp(png512Path)
      .resize(256, 256, { fit: 'contain', background: { r: 31, g: 41, b: 55 } })
      .toFile(png256Path);
    
    console.log('✓ Created 256x256 PNG');

    // For ICO, we'll use the 256x256 PNG
    // Note: electron-builder can handle PNG as icon source
    console.log('✓ Icon conversion complete!');
    console.log(`Icon files created at ${buildDir}`);
    
  } catch (error) {
    console.error('Error converting icon:', error);
    process.exit(1);
  }
}

convertIcon();

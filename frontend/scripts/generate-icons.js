const fs = require('fs');
const path = require('path');

/**
 * PWA Icon Generator Script
 * 
 * This script generates placeholder icon files for PWA.
 * For production, you should replace these with actual high-quality icons
 * generated from your logo using tools like:
 * - https://realfavicongenerator.net/
 * - https://www.pwabuilder.com/imageGenerator
 * - Sharp library for Node.js
 */

const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');
const logoPath = path.join(publicDir, 'sabi_logo.png');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

console.log('PWA Icon Setup');
console.log('==============\n');

// Check if logo exists
if (!fs.existsSync(logoPath)) {
  console.error('❌ Logo not found at:', logoPath);
  process.exit(1);
}

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
  console.log('✅ Created icons directory');
}

console.log('📋 To generate PWA icons, you have several options:\n');
console.log('Option 1 - Online Tools (Recommended):');
console.log('  1. Visit https://realfavicongenerator.net/');
console.log('  2. Upload your logo: public/sabi_logo.png');
console.log('  3. Download the generated icons');
console.log('  4. Place them in: public/icons/\n');

console.log('Option 2 - PWA Builder:');
console.log('  1. Visit https://www.pwabuilder.com/imageGenerator');
console.log('  2. Upload your logo');
console.log('  3. Download the generated icons');
console.log('  4. Place them in: public/icons/\n');

console.log('Option 3 - Using Sharp (Node.js):');
console.log('  1. Run: npm install sharp');
console.log('  2. The script below will be automatically updated\n');

// Try to use Sharp if available
let sharp;
try {
  sharp = require('sharp');
  console.log('✅ Sharp is installed. Generating icons...\n');
  
  const generateIcons = async () => {
    for (const size of sizes) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      
      await sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 13, g: 13, b: 26, alpha: 1 } // #0d0d1a
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated icon-${size}x${size}.png`);
    }
    
    console.log('\n✅ All PWA icons generated successfully!');
  };
  
  generateIcons().catch(err => {
    console.error('Error generating icons:', err);
    process.exit(1);
  });
  
} catch (err) {
  console.log('ℹ️  Sharp not installed. To auto-generate icons, run:');
  console.log('   npm install sharp');
  console.log('   node scripts/generate-icons.js\n');
  
  // Create placeholder files as a fallback
  console.log('Creating placeholder icon files for now...\n');
  
  sizes.forEach(size => {
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    
    // Copy the original logo as placeholder
    if (!fs.existsSync(outputPath)) {
      fs.copyFileSync(logoPath, outputPath);
      console.log(`📄 Created placeholder: icon-${size}x${size}.png`);
    }
  });
  
  console.log('\n⚠️  Note: These are placeholder files.');
  console.log('   Replace them with properly sized icons for production.\n');
}

console.log('\n✅ PWA icon setup complete!');
console.log('📁 Icons location: public/icons/\n');

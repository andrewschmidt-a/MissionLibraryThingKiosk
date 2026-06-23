// One-off icon generator. Renders resources/logo.svg → icon.png/icon.ico/icon.icns.
// Not used at runtime; run with `node scripts/generate-icons.cjs` when the logo changes.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;
const png2icons = require('png2icons');

const resourcesDir = path.join(__dirname, '..', 'resources');
const svgPath = path.join(resourcesDir, 'logo.svg');

async function main() {
  const svg = fs.readFileSync(svgPath);

  const masterTransparent = await sharp(svg, { density: 384 })
    .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp(masterTransparent).resize(512, 512).png().toFile(path.join(resourcesDir, 'icon.png'));

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = await Promise.all(
    sizes.map((s) => sharp(masterTransparent).resize(s, s).png().toBuffer())
  );
  const ico = await pngToIco(pngs);
  fs.writeFileSync(path.join(resourcesDir, 'icon.ico'), ico);

  const icns = png2icons.createICNS(masterTransparent, png2icons.BILINEAR, 0);
  if (!icns) throw new Error('Failed to create icns');
  fs.writeFileSync(path.join(resourcesDir, 'icon.icns'), icns);

  console.log('Wrote icon.png, icon.ico, icon.icns to resources/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

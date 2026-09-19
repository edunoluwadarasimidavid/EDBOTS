/**
 * WebP to PNG/MP4 Converter
 * Uses system ffmpeg only - no sharp dependency
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getTempDir, deleteTempFile } = require('./tempManager');

const ffmpegPath = 'ffmpeg';

/**
 * Convert WebP sticker to PNG image
 */
async function webp2png(webpBuffer) {
  const tempDir = getTempDir();
  const inputPath = path.join(tempDir, `w2p_${Date.now()}.webp`);
  const outputPath = path.join(tempDir, `w2p_${Date.now()}.png`);

  try {
    fs.writeFileSync(inputPath, webpBuffer);
    execSync(`${ffmpegPath} -y -i "${inputPath}" "${outputPath}"`, { stdio: 'ignore' });
    return fs.readFileSync(outputPath);
  } finally {
    deleteTempFile(inputPath);
    deleteTempFile(outputPath);
  }
}

/**
 * Convert animated WebP sticker to MP4 video
 */
async function webp2mp4(webpBuffer) {
  const tempDir = getTempDir();
  const inputPath = path.join(tempDir, `input_${Date.now()}.webp`);
  const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);

  try {
    fs.writeFileSync(inputPath, webpBuffer);
    execSync(`${ffmpegPath} -y -i "${inputPath}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${outputPath}"`, { stdio: 'ignore' });

    if (!fs.existsSync(outputPath)) throw new Error('Conversion failed');
    return fs.readFileSync(outputPath);
  } finally {
    deleteTempFile(inputPath);
    deleteTempFile(outputPath);
  }
}

module.exports = {
  webp2png,
  webp2mp4,
  webp2gif: webp2mp4
};

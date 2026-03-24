/**
 * WebP to PNG/MP4 Converter
 * Uses system ffmpeg and sharp
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { getTempDir, deleteTempFile } = require('./tempManager');

// Use system ffmpeg
const ffmpegPath = 'ffmpeg'; 

/**
 * Convert WebP sticker to PNG image
 */
async function webp2png(webpBuffer) {
  try {
    const sharp = require('sharp');
    return await sharp(webpBuffer).png().toBuffer();
  } catch (error) {
    throw new Error('Failed to convert WebP to PNG: ' + error.message);
  }
}

/**
 * Convert animated WebP sticker to MP4 video
 */
async function webp2mp4(webpBuffer) {
  const tempDir = getTempDir();
  const timestamp = Date.now();
  const inputPath = path.join(tempDir, `input_${timestamp}.webp`);
  const outputPath = path.join(tempDir, `output_${timestamp}.mp4`);
  
  try {
    fs.writeFileSync(inputPath, webpBuffer);
    
    // Convert directly using ffmpeg
    // Assuming ffmpeg supports libwebp decoding (standard in most builds)
    const cmd = `${ffmpegPath} -i "${inputPath}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -y "${outputPath}"`;
    
    await new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    if (!fs.existsSync(outputPath)) throw new Error('Conversion failed');
    return fs.readFileSync(outputPath);
    
  } finally {
    try {
      if (fs.existsSync(inputPath)) deleteTempFile(inputPath);
      if (fs.existsSync(outputPath)) deleteTempFile(outputPath);
    } catch (e) {}
  }
}

module.exports = {
  webp2png,
  webp2mp4,
  // Alias for compatibility
  webp2gif: webp2mp4 
};

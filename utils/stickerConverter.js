/**
 * Sticker Converter using FFmpeg only
 * No sharp or node-webpmux dependency
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getTempDir, deleteTempFile } = require('./tempManager');

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Convert image/video to sticker using ffmpeg
 */
const convertToSticker = async (mediaBuffer, options = {}) => {
  if (mediaBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(mediaBuffer.length / 1024 / 1024).toFixed(2)}MB (max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
  }

  const tempDir = getTempDir();
  const inputPath = path.join(tempDir, `input_${Date.now()}.${options.isVideo ? 'mp4' : 'jpg'}`);
  const outputPath = path.join(tempDir, `output_${Date.now()}.webp`);

  try {
    fs.writeFileSync(inputPath, mediaBuffer);

    const cmd = options.isVideo
      ? `ffmpeg -y -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=#00000000,fps=fps=15" -vcodec libwebp -lossless 1 -loop 0 -an -vsync 0 -t 10 "${outputPath}"`
      : `ffmpeg -y -i "${inputPath}" -vcodec libwebp -filter:v fps=fps=20 -lossless 1 -loop 0 -preset default -an -vsync 0 -s 512:512 "${outputPath}"`;

    execSync(cmd, { stdio: 'ignore' });

    const stickerBuffer = fs.readFileSync(outputPath);
    return stickerBuffer;
  } finally {
    deleteTempFile(inputPath);
    deleteTempFile(outputPath);
  }
};

/**
 * Add metadata to sticker using pure ffmpeg (packname/author display)
 * Note: WhatsApp stickers will work without metadata
 */
const addStickerMetadata = async (stickerBuffer, packname, author) => {
  // Without node-webpmux, stickers still work but won't show packname/author
  // This is acceptable - the sticker itself is what matters
  return stickerBuffer;
};

/**
 * Process media to sticker
 */
const createSticker = async (mediaBuffer, isVideo = false, packname = 'Made by', author = 'EDBOTS') => {
  let stickerBuffer = await convertToSticker(mediaBuffer, { isVideo });
  stickerBuffer = await addStickerMetadata(stickerBuffer, packname, author);
  return stickerBuffer;
};

module.exports = {
  convertToSticker,
  addStickerMetadata,
  createSticker
};

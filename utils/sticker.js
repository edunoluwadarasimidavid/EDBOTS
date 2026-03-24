/**
 * Sticker Creation Utilities - Refactored for Jimp and FFmpeg.
 * No sharp or wa-sticker-formatter dependency.
 */

const Jimp = require('jimp');
const { writeExifImg, writeExifVid } = require('./exif');
const config = require('../config');

/**
 * Create sticker from image/video buffer.
 */
const createStickerBuffer = async (media, options = {}) => {
  try {
    // If it's a buffer and likely an image, Jimp will handle it.
    // If Jimp fails, we assume it's a video and use FFmpeg via exif.js
    try {
        await Jimp.read(media);
        return await writeExifImg(media, options);
    } catch (e) {
        // Assume video
        return await writeExifVid(media, options);
    }
  } catch (error) {
    throw new Error(`Sticker creation failed: ${error.message}`);
  }
};

/**
 * Create cropped sticker (Legacy support).
 */
const createCroppedSticker = async (media, options = {}) => {
  return await createStickerBuffer(media, options);
};

/**
 * Create circle sticker (Legacy support).
 */
const createCircleSticker = async (media, options = {}) => {
  return await createStickerBuffer(media, options);
};

/**
 * Convert sticker to image.
 */
const stickerToImage = async (stickerBuffer) => {
  try {
    const image = await Jimp.read(stickerBuffer);
    return await image.getBufferAsync(Jimp.MIME_PNG);
  } catch (error) {
    throw new Error(`Sticker to image conversion failed: ${error.message}`);
  }
};

module.exports = {
  createStickerBuffer,
  createCroppedSticker,
  createCircleSticker,
  stickerToImage
};

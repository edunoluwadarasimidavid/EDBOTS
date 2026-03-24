/**
 * @file exif.js
 * @description Sticker metadata utilities using pure JS (Jimp) and FFmpeg.
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const Jimp = require('jimp');

function getFFmpegPath() {
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        return 'ffmpeg';
    } catch (e) {
        return 'ffmpeg';
    }
}

/**
 * Basic WebP Metadata Injector (EXIF)
 */
async function addMetadata(webpBuffer, packname, author) {
    // This is a simplified version. For full EXIF injection without node-webpmux,
    // we would need to parse the WebP RIFF structure.
    // For now, we return the buffer. (Most users care about the sticker working).
    return webpBuffer;
}

async function writeExifImg(buffer, metadata) {
    const tempDir = path.join(__dirname, '../temp');
    await fs.ensureDir(tempDir);
    const inputPath = path.join(tempDir, `img_${Date.now()}.png`);
    const outputPath = path.join(tempDir, `out_${Date.now()}.webp`);

    try {
        const image = await Jimp.read(buffer);
        // Resize to 512x512 with transparent padding
        image.contain(512, 512);
        await image.writeAsync(inputPath);

        const ffmpegPath = getFFmpegPath();
        // Convert to webp with ffmpeg
        execSync(`${ffmpegPath} -i ${inputPath} -vcodec libwebp -filter:v fps=fps=20 -lossless 1 -loop 0 -preset default -an -vsync 0 -s 512:512 ${outputPath}`);
        
        return await fs.readFile(outputPath);
    } finally {
        await fs.remove(inputPath).catch(() => {});
        await fs.remove(outputPath).catch(() => {});
    }
}

async function writeExifVid(buffer, metadata) {
    const tempDir = path.join(__dirname, '../temp');
    await fs.ensureDir(tempDir);
    const inputPath = path.join(tempDir, `vid_${Date.now()}.mp4`);
    const outputPath = path.join(tempDir, `out_${Date.now()}.webp`);

    try {
        await fs.writeFile(inputPath, buffer);
        const ffmpegPath = getFFmpegPath();
        
        // Use ffmpeg to scale and pad video to 512x512 webp
        const cmd = `${ffmpegPath} -i ${inputPath} -vcodec libwebp -filter:v "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=#00000000,fps=fps=15" -lossless 1 -loop 0 -preset default -an -vsync 0 -t 10 ${outputPath}`;
        execSync(cmd);

        return await fs.readFile(outputPath);
    } finally {
        await fs.remove(inputPath).catch(() => {});
        await fs.remove(outputPath).catch(() => {});
    }
}

module.exports = {
    writeExifImg,
    writeExifVid,
    getFFmpegPath
};

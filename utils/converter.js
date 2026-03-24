/**
 * @file converter.js
 * @description Modernized FFmpeg-based media converter for EDBOTS.
 */

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const { getFFmpegPath } = require('./exif');

/**
 * Core FFmpeg wrapper for processing buffers.
 */
function ffmpeg(buffer, args = [], ext = '', ext2 = '') {
    return new Promise(async (resolve, reject) => {
        const tempDir = path.join(__dirname, '../temp');
        await fs.ensureDir(tempDir);
        
        const tmp = path.join(tempDir, `input_${Date.now()}.${ext}`);
        const out = path.join(tempDir, `output_${Date.now()}.${ext2}`);
        const ffmpegPath = getFFmpegPath();

        try {
            await fs.writeFile(tmp, buffer);
            
            const ff = spawn(ffmpegPath, [
                '-y',
                '-i', tmp,
                ...args,
                out
            ]);

            ff.on('error', (err) => {
                fs.remove(tmp).catch(() => {});
                fs.remove(out).catch(() => {});
                reject(err);
            });

            ff.on('close', async (code) => {
                try {
                    await fs.remove(tmp);
                    if (code !== 0) {
                        await fs.remove(out).catch(() => {});
                        return reject(new Error(`FFmpeg exited with code ${code}`));
                    }
                    const result = await fs.readFile(out);
                    await fs.remove(out);
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Convert buffer to standard MP3 audio.
 */
function toAudio(buffer, ext) {
    return ffmpeg(buffer, [
        '-vn',
        '-ac', '2',
        '-b:a', '128k',
        '-ar', '44100'
    ], ext, 'mp3');
}

/**
 * Convert buffer to WhatsApp PTT (Opus).
 */
function toPTT(buffer, ext) {
    return ffmpeg(buffer, [
        '-vn',
        '-c:a', 'libopus',
        '-b:a', '128k',
        '-vbr', 'on',
        '-compression_level', '10'
    ], ext, 'opus');
}

/**
 * Convert buffer to MP4 video.
 */
function toVideo(buffer, ext) {
    return ffmpeg(buffer, [
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-ab', '128k',
        '-ar', '44100',
        '-crf', '32',
        '-preset', 'ultrafast'
    ], ext, 'mp4');
}

module.exports = {
    toAudio,
    toPTT,
    toVideo,
    ffmpeg
};

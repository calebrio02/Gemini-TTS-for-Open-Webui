/**
 * Audio format converter using ffmpeg
 * Converts raw PCM audio (s16le, 24000Hz, mono) to various formats
 * Supports both buffered and streaming conversion
 */

const { spawn } = require('child_process');
const logger = require('./logger');

/**
 * Converts PCM audio buffer to the specified format using ffmpeg
 * 
 * @param {Buffer} pcmBuffer - Raw PCM audio data (s16le, 24000Hz, mono)
 * @param {string} format - Target format: 'mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'
 * @returns {Promise<Buffer>} - Converted audio buffer
 */
async function convertAudio(pcmBuffer, format = 'mp3') {
    // If PCM is requested, return as-is
    if (format === 'pcm') {
        logger.debug('PCM format requested, returning raw audio');
        return pcmBuffer;
    }

    return new Promise((resolve, reject) => {
        const outputFormat = format === 'mp3' ? 'mp3' : format;

        // ffmpeg arguments for converting from PCM
        const args = [
            '-f', 's16le',        // Input format: signed 16-bit little-endian
            '-ar', '24000',       // Input sample rate: 24000 Hz
            '-ac', '1',           // Input channels: mono
            '-i', 'pipe:0',       // Read from stdin
            '-f', outputFormat,   // Output format
        ];

        // Add format-specific options
        if (format === 'mp3') {
            args.push('-b:a', '128k'); // Bitrate for MP3
        } else if (format === 'opus') {
            args.push('-b:a', '64k');  // Bitrate for Opus
        }

        args.push('pipe:1');  // Write to stdout

        logger.debug(`Running ffmpeg with args: ${args.join(' ')}`);

        const ffmpeg = spawn('ffmpeg', args, {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        const chunks = [];
        let stderrOutput = '';

        ffmpeg.stdout.on('data', (chunk) => {
            chunks.push(chunk);
        });

        ffmpeg.stderr.on('data', (data) => {
            stderrOutput += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                const outputBuffer = Buffer.concat(chunks);
                logger.debug(`Conversion complete: ${pcmBuffer.length} bytes PCM -> ${outputBuffer.length} bytes ${format}`);
                resolve(outputBuffer);
            } else {
                logger.error(`ffmpeg exited with code ${code}`, stderrOutput);
                reject(new Error(`ffmpeg conversion failed: ${stderrOutput}`));
            }
        });

        ffmpeg.on('error', (err) => {
            logger.error('ffmpeg process error', err.message);
            reject(new Error(`ffmpeg not found or failed to start: ${err.message}`));
        });

        // Write PCM data to ffmpeg stdin
        ffmpeg.stdin.write(pcmBuffer);
        ffmpeg.stdin.end();
    });
}

/**
 * Creates a streaming audio converter that converts PCM chunks to the target format
 * Returns a transform interface with write() and end() methods
 * 
 * @param {string} format - Target format: 'mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'
 * @param {function} onData - Callback for converted audio chunks
 * @param {function} onEnd - Callback when conversion is complete
 * @param {function} onError - Callback for errors
 * @returns {object} - { write(chunk), end() }
 */
function createStreamConverter(format, onData, onEnd, onError) {
    // For PCM, just pass through
    if (format === 'pcm') {
        return {
            write: (chunk) => onData(chunk),
            end: () => onEnd()
        };
    }

    const outputFormat = format === 'mp3' ? 'mp3' : format;

    const args = [
        '-f', 's16le',
        '-ar', '24000',
        '-ac', '1',
        '-i', 'pipe:0',
        '-f', outputFormat,
    ];

    if (format === 'mp3') {
        args.push('-b:a', '128k');
    } else if (format === 'opus') {
        args.push('-b:a', '64k');
    }

    args.push('pipe:1');

    logger.debug(`Creating streaming ffmpeg converter with args: ${args.join(' ')}`);

    const ffmpeg = spawn('ffmpeg', args, {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderrOutput = '';

    ffmpeg.stdout.on('data', (chunk) => {
        onData(chunk);
    });

    ffmpeg.stderr.on('data', (data) => {
        stderrOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
        if (code === 0) {
            logger.debug('Streaming conversion complete');
            onEnd();
        } else {
            logger.error(`ffmpeg streaming exited with code ${code}`, stderrOutput);
            onError(new Error(`ffmpeg conversion failed: ${stderrOutput}`));
        }
    });

    ffmpeg.on('error', (err) => {
        logger.error('ffmpeg streaming process error', err.message);
        onError(new Error(`ffmpeg not found or failed to start: ${err.message}`));
    });

    return {
        write: (chunk) => {
            if (!ffmpeg.stdin.destroyed) {
                ffmpeg.stdin.write(chunk);
            }
        },
        end: () => {
            if (!ffmpeg.stdin.destroyed) {
                ffmpeg.stdin.end();
            }
        }
    };
}

/**
 * Get the Content-Type header for a given audio format
 * 
 * @param {string} format - Audio format
 * @returns {string} - MIME type
 */
function getContentType(format) {
    const contentTypes = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'opus': 'audio/opus',
        'aac': 'audio/aac',
        'flac': 'audio/flac',
        'pcm': 'audio/pcm',
    };
    return contentTypes[format] || 'audio/mpeg';
}

module.exports = {
    convertAudio,
    createStreamConverter,
    getContentType
};

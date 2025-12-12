/**
 * TTS Proxy Server
 * Converts OpenAI TTS API requests to Gemini TTS API
 * Supports both streaming and non-streaming responses
 */

require('dotenv').config();

const express = require('express');
const { generateSpeech, generateSpeechStream } = require('./gemini');
const { convertAudio, createStreamConverter, getContentType } = require('./converter');
const { mapVoice } = require('./voiceMapping');
const logger = require('./logger');

const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3500;
const HOST = process.env.HOST || '0.0.0.0';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_VOICE = process.env.DEFAULT_VOICE || 'Kore';

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'tts-proxy',
        geminiConfigured: !!GEMINI_API_KEY,
        features: {
            streaming: true,
            formats: ['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm']
        }
    });
});

// OpenAI-compatible TTS endpoint
app.post('/v1/audio/speech', async (req, res) => {
    const startTime = Date.now();

    try {
        const {
            input,
            voice = 'alloy',
            model = 'tts-1',
            response_format = 'mp3',
            speed = 1.0,
            stream = true  // Streaming enabled by default
        } = req.body;

        // Validate input
        if (!input) {
            logger.warn('Request missing input text');
            return res.status(400).json({
                error: {
                    message: 'Missing required parameter: input',
                    type: 'invalid_request_error'
                }
            });
        }

        if (input.length > 4096) {
            logger.warn(`Input text too long: ${input.length} characters`);
            return res.status(400).json({
                error: {
                    message: 'Input text exceeds maximum length of 4096 characters',
                    type: 'invalid_request_error'
                }
            });
        }

        // Map OpenAI voice to Gemini voice
        const geminiVoice = mapVoice(voice, DEFAULT_VOICE);

        logger.info(`TTS request: model=${model}, voice=${voice}->${geminiVoice}, format=${response_format}, stream=${stream}, length=${input.length}`);

        const contentType = getContentType(response_format);

        if (stream) {
            // Streaming response
            res.set('Content-Type', contentType);
            res.set('Transfer-Encoding', 'chunked');

            // 1. Create the AbortController
            const controller = new AbortController();
            const signal = controller.signal;

            // 2. Listen for response close (Client stopped listening)
            // CHANGED: req.on('close') -> res.on('close') to avoid premature aborts
            res.on('close', () => {
                logger.info('Client disconnected, aborting TTS generation');
                controller.abort();
            });

            let bytesSent = 0;

            // Create streaming converter
            const converter = createStreamConverter(
                response_format,
                (chunk) => {
                    bytesSent += chunk.length;
                    res.write(chunk);
                },
                () => {
                    res.end();
                    const elapsed = Date.now() - startTime;
                    logger.info(`Streaming TTS completed in ${elapsed}ms, ${bytesSent} bytes sent`);
                },
                (err) => {
                    logger.error('Streaming conversion error:', err.message);
                    if (!res.headersSent) {
                        res.status(500).json({
                            error: {
                                message: err.message,
                                type: 'server_error'
                            }
                        });
                    } else {
                        res.end();
                    }
                }
            );

            // 3. Stream from Gemini with signal and abort check
            try {
                await generateSpeechStream(input, geminiVoice, GEMINI_API_KEY, async (pcmChunk) => {
                    if (signal.aborted) return; // Stop writing if aborted
                    converter.write(pcmChunk);
                }, signal);

                converter.end();
            } catch (err) {
                if (err.name === 'AbortError' || signal.aborted) {
                    logger.info('Stream aborted successfully');
                    converter.end();
                    return;
                }
                throw err;
            }

        } else {
            // Non-streaming response (original behavior)
            const pcmBuffer = await generateSpeech(input, geminiVoice, GEMINI_API_KEY);
            const audioBuffer = await convertAudio(pcmBuffer, response_format);

            res.set('Content-Type', contentType);
            res.set('Content-Length', audioBuffer.length);
            res.send(audioBuffer);

            const elapsed = Date.now() - startTime;
            logger.info(`TTS request completed in ${elapsed}ms, ${audioBuffer.length} bytes`);
        }

    } catch (error) {
        const elapsed = Date.now() - startTime;
        logger.error(`TTS request failed after ${elapsed}ms: ${error.message}`);

        if (!res.headersSent) {
            res.status(500).json({
                error: {
                    message: error.message,
                    type: 'server_error'
                }
            });
        }
    }
});

// List available voices (OpenAI-compatible)
app.get('/v1/audio/voices', (req, res) => {
    const { GEMINI_VOICES, OPENAI_TO_GEMINI_VOICE_MAP } = require('./voiceMapping');

    res.json({
        voices: [
            ...Object.keys(OPENAI_TO_GEMINI_VOICE_MAP).map(name => ({
                voice_id: name,
                name: name,
                type: 'openai-mapped',
                mapped_to: OPENAI_TO_GEMINI_VOICE_MAP[name]
            })),
            ...GEMINI_VOICES.map(name => ({
                voice_id: name,
                name: name,
                type: 'gemini-native'
            }))
        ]
    });
});

// Start server
app.listen(PORT, HOST, () => {
    logger.info(`TTS Proxy server running at http://${HOST}:${PORT}`);
    logger.info(`OpenAI TTS endpoint: http://${HOST}:${PORT}/v1/audio/speech`);
    logger.info(`Streaming support: enabled`);

    if (!GEMINI_API_KEY) {
        logger.warn('GEMINI_API_KEY is not set! TTS requests will fail.');
    } else {
        logger.info('Gemini API key configured');
    }
});

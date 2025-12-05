/**
 * Gemini TTS API client
 * Handles communication with Google's Gemini TTS endpoint
 * Supports both regular and streaming responses
 */

const logger = require('./logger');

const GEMINI_TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';
const GEMINI_TTS_STREAM_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:streamGenerateContent';

/**
 * Generate speech using Gemini TTS API (non-streaming)
 * 
 * @param {string} text - Text to convert to speech
 * @param {string} voiceName - Gemini voice name (e.g., 'Kore', 'Charon')
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Buffer>} - Raw PCM audio buffer (s16le, 24000Hz, mono)
 */
async function generateSpeech(text, voiceName, apiKey) {
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const requestBody = {
        contents: [{
            parts: [{
                text: text
            }]
        }],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: voiceName
                    }
                }
            }
        }
    };

    logger.debug('Sending request to Gemini TTS API', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        voiceName,
        url: GEMINI_TTS_URL
    });

    const startTime = Date.now();

    const response = await fetch(`${GEMINI_TTS_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Gemini API error (${response.status})`, errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    logger.debug(`Gemini API response received in ${elapsed}ms`);

    // Extract audio data from response
    const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
        logger.error('No audio data in Gemini response', data);
        throw new Error('No audio data received from Gemini API');
    }

    // Decode base64 to buffer
    const pcmBuffer = Buffer.from(audioData, 'base64');
    logger.info(`Generated ${pcmBuffer.length} bytes of PCM audio for "${text.substring(0, 50)}..." using voice ${voiceName}`);

    return pcmBuffer;
}

/**
 * Generate speech using Gemini TTS API with streaming (SSE)
 * 
 * @param {string} text - Text to convert to speech
 * @param {string} voiceName - Gemini voice name
 * @param {string} apiKey - Gemini API key
 * @param {function} onChunk - Callback for each PCM chunk (Buffer)
 * @returns {Promise<void>}
 */
async function generateSpeechStream(text, voiceName, apiKey, onChunk) {
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const requestBody = {
        contents: [{
            parts: [{
                text: text
            }]
        }],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: voiceName
                    }
                }
            }
        }
    };

    logger.debug('Sending streaming request to Gemini TTS API', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        voiceName,
        url: GEMINI_TTS_STREAM_URL
    });

    const startTime = Date.now();

    const response = await fetch(`${GEMINI_TTS_STREAM_URL}?alt=sse&key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Gemini API streaming error (${response.status})`, errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalBytes = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process SSE events
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6).trim();

                    if (jsonStr === '[DONE]') {
                        continue;
                    }

                    try {
                        const data = JSON.parse(jsonStr);
                        const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

                        if (audioData) {
                            const pcmChunk = Buffer.from(audioData, 'base64');
                            totalBytes += pcmChunk.length;
                            await onChunk(pcmChunk);
                        }
                    } catch (parseError) {
                        logger.debug('Failed to parse SSE data', jsonStr.substring(0, 100));
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    const elapsed = Date.now() - startTime;
    logger.info(`Streamed ${totalBytes} bytes of PCM audio in ${elapsed}ms for "${text.substring(0, 50)}..." using voice ${voiceName}`);
}

module.exports = {
    generateSpeech,
    generateSpeechStream
};

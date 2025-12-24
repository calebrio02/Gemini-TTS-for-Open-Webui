/**
 * Gemini TTS API client
 * Handles communication with Google's Gemini TTS endpoint
 * Supports both regular and streaming responses
 */

const logger = require('./logger');

const GEMINI_TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';
const GEMINI_TTS_STREAM_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:streamGenerateContent';

// Helper function to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate speech using Gemini TTS API (non-streaming)
 * Includes retry logic for 5xx errors
 */
async function generateSpeech(text, voiceName, apiKey, retries = 3) {
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

    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger.debug(`Sending request to Gemini TTS API (Attempt ${attempt}/${retries})`, {
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
                // If it's a server error (5xx), throw to trigger retry
                if (response.status >= 500) {
                    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
                }
                // For client errors (4xx), don't retry, just log and throw
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

        } catch (error) {
            lastError = error;
            logger.warn(`Attempt ${attempt} failed: ${error.message}`);
            
            // If we have retries left, wait and continue
            if (attempt < retries) {
                const delay = attempt * 1000; // Linear backoff: 1s, 2s, 3s...
                logger.info(`Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

/**
 * Generate speech using Gemini TTS API with streaming (SSE)
 * Includes retry logic for 5xx errors on initial connection
 */
async function generateSpeechStream(text, voiceName, apiKey, onChunk, signal, retries = 3) {
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

    let response;
    let lastError;

    // Retry loop for the initial connection
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger.debug(`Sending streaming request to Gemini TTS API (Attempt ${attempt}/${retries})`, {
                text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                voiceName,
                url: GEMINI_TTS_STREAM_URL
            });

            // Pass 'signal' to fetch for cancellation support
            response = await fetch(`${GEMINI_TTS_STREAM_URL}?alt=sse&key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal 
            });

            if (!response.ok) {
                const errorText = await response.text();
                if (response.status >= 500) {
                    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
                }
                logger.error(`Gemini API streaming error (${response.status})`, errorText);
                throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
            }

            // If success, break the retry loop
            break;

        } catch (error) {
            lastError = error;
            // Don't retry if the user cancelled
            if (error.name === 'AbortError' || signal?.aborted) {
                throw error;
            }

            logger.warn(`Streaming attempt ${attempt} failed: ${error.message}`);
            
            if (attempt < retries) {
                const delay = attempt * 1000;
                logger.info(`Retrying stream in ${delay}ms...`);
                await sleep(delay);
            } else {
                throw lastError;
            }
        }
    }

    const startTime = Date.now();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalBytes = 0;

    // Helper to process a single SSE line (Used for both main loop and final flush)
    const processLine = async (line) => {
        if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();

            if (jsonStr === '[DONE]') {
                return;
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
    };

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                // UPDATE 2 Part A: Flush any remaining characters from decoder
                buffer += decoder.decode();
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process SSE events
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                await processLine(line);
            }
        }

        // UPDATE 2 Part B: Process any remaining data in buffer after stream ends
        // This fixes the "stops after first sentence" issue
        if (buffer.trim()) {
            await processLine(buffer.trim());
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

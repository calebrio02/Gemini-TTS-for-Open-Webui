/**
 * Voice mapping from OpenAI voice names to Gemini voice names.
 * Gemini voices available: Achernar, Achird, Algenib, Algieba, Alnilam, Aoede,
 * Autonoe, Callirrhoe, Charon, Despina, Enceladus, Erinome, Fenrir, Gacrux,
 * Iapetus, Kore, Laomedeia, Leda, Orus, Puck, Pulcherrima, Rasalgethi,
 * Sadachbia, Sadaltager, Schedar, Sulafat, Umbriel, Vindemiatrix, Zephyr, Zubenelgenubi
 */

const OPENAI_TO_GEMINI_VOICE_MAP = {
    // OpenAI standard voices
    'alloy': 'Kore',
    'echo': 'Charon',
    'fable': 'Fenrir',
    'onyx': 'Orus',
    'nova': 'Aoede',
    'shimmer': 'Leda',
    // Additional OpenAI voices
    'ash': 'Puck',
    'ballad': 'Zephyr',
    'coral': 'Aoede',
    'sage': 'Gacrux',
    'verse': 'Alnilam',
};

// List of valid Gemini voice names (case-insensitive check)
const GEMINI_VOICES = [
    'Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Aoede',
    'Autonoe', 'Callirrhoe', 'Charon', 'Despina', 'Enceladus', 'Erinome',
    'Fenrir', 'Gacrux', 'Iapetus', 'Kore', 'Laomedeia', 'Leda', 'Orus',
    'Puck', 'Pulcherrima', 'Rasalgethi', 'Sadachbia', 'Sadaltager',
    'Schedar', 'Sulafat', 'Umbriel', 'Vindemiatrix', 'Zephyr', 'Zubenelgenubi'
];

/**
 * Maps an OpenAI voice name to a Gemini voice name.
 * If the input is already a valid Gemini voice, returns it directly.
 * Falls back to default voice if no mapping found.
 * 
 * @param {string} voice - The voice name from the request
 * @param {string} defaultVoice - Default voice to use if no mapping found
 * @returns {string} - The Gemini voice name
 */
function mapVoice(voice, defaultVoice = 'Kore') {
    if (!voice) {
        return defaultVoice;
    }

    const lowerVoice = voice.toLowerCase();

    // Check if it's an OpenAI voice
    if (OPENAI_TO_GEMINI_VOICE_MAP[lowerVoice]) {
        return OPENAI_TO_GEMINI_VOICE_MAP[lowerVoice];
    }

    // Check if it's already a valid Gemini voice (case-insensitive)
    const geminiVoice = GEMINI_VOICES.find(v => v.toLowerCase() === lowerVoice);
    if (geminiVoice) {
        return geminiVoice;
    }

    // Return default
    return defaultVoice;
}

module.exports = {
    mapVoice,
    OPENAI_TO_GEMINI_VOICE_MAP,
    GEMINI_VOICES
};

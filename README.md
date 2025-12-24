# Gemini TTS Proxy for OpenWebUI

A lightweight proxy server that converts OpenAI-compatible TTS API requests to Google's Gemini TTS API. This allows you to use Gemini's high-quality text-to-speech voices with OpenWebUI or any application that supports OpenAI's TTS API.

## ✨ Features

- 🔄 **OpenAI API Compatible** - Drop-in replacement for OpenAI's `/v1/audio/speech` endpoint
- 🎙️ **30 Gemini Voices** - Access to all Gemini TTS voices
- ⚡ **Streaming & Buffered Modes** - Choose between low-latency streaming or quota-friendly buffered mode
- 🎵 **Multiple Formats** - Supports MP3, WAV, OPUS, AAC, FLAC, and PCM
- 🐳 **Docker Ready** - Easy deployment with Docker Compose
- 🔊 **Voice Mapping** - Automatic mapping from OpenAI voice names to Gemini voices

## 🚀 Quick Start

### 1. Clone and Configure

```bash
git clone https://github.com/calebrio02/Gemini-TTS-for-Open-Webui.git
cd Gemini-TTS-for-Open-Webui
```

### 2. Set Your Gemini API Key

Edit `docker-compose.yml` and replace the API key:

```yaml
environment:
  - GEMINI_API_KEY=your-gemini-api-key-here
```

Or create a `.env` file:

```bash
echo "GEMINI_API_KEY=your-api-key" > .env
```

### 3. Start the Server

```bash
docker-compose up -d
```

The server will be running at `http://localhost:3500`

## 🔧 OpenWebUI Configuration

1. Go to **Settings** → **Audio**
2. Configure TTS settings:
   - **TTS Engine**: `OpenAI`
   - **API Base URL**: `http://your-server-ip:3500/v1`
   - **API Key**: `sk-unused` (any value works)
   - **TTS Voice**: `alloy` or any Gemini voice name (e.g., `Kore`, `Charon`)



## 📡 API Usage

### Generate Speech

```bash
curl -X POST "http://localhost:3500/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello, this is a test of Gemini text to speech!",
    "voice": "alloy",
    "response_format": "mp3"
  }' \
  --output speech.mp3
```

### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `input` | string | Text to convert (max 4096 chars) | Required |
| `voice` | string | Voice name (OpenAI or Gemini) | `alloy` |
| `model` | string | Model name (ignored, for compatibility) | `tts-1` |
| `response_format` | string | Output format: mp3, wav, opus, aac, flac, pcm | `mp3` |
| `stream` | boolean | Enable streaming response | Uses `TTS_MODE` env var |

### List Available Voices

```bash
curl http://localhost:3500/v1/audio/voices
```

### Health Check

```bash
curl http://localhost:3500/health
```

## 🎤 Voice Mapping

OpenAI voices are automatically mapped to Gemini equivalents:

| OpenAI Voice | Gemini Voice |
|--------------|--------------|
| alloy | Kore |
| echo | Charon |
| fable | Fenrir |
| onyx | Orus |
| nova | Aoede |
| shimmer | Leda |

You can also use Gemini voice names directly:

`Achernar`, `Achird`, `Algenib`, `Algieba`, `Alnilam`, `Aoede`, `Autonoe`, `Callirrhoe`, `Charon`, `Despina`, `Enceladus`, `Erinome`, `Fenrir`, `Gacrux`, `Iapetus`, `Kore`, `Laomedeia`, `Leda`, `Orus`, `Puck`, `Pulcherrima`, `Rasalgethi`, `Sadachbia`, `Sadaltager`, `Schedar`, `Sulafat`, `Umbriel`, `Vindemiatrix`, `Zephyr`, `Zubenelgenubi`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | Required |
| `PORT` | Server port | `3500` |
| `HOST` | Server host | `0.0.0.0` |
| `DEFAULT_VOICE` | Default voice if not specified | `Kore` |
| `TTS_MODE` | TTS mode: `streaming` or `buffered` | `buffered` |
| `LOG_LEVEL` | Logging level: debug, info, warn, error | `info` |

> **💡 Tip:** Use `buffered` mode to conserve your daily API quota. Streaming mode provides lower latency but makes more API requests.

### Docker Compose

```yaml
services:
  tts-proxy:
    build: .
    container_name: tts-proxy
    restart: unless-stopped
    ports:
      - "3500:3500"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - PORT=3500
      - HOST=0.0.0.0
      - DEFAULT_VOICE=Kore
      - TTS_MODE=buffered  # 'streaming' or 'buffered'
      - LOG_LEVEL=info
```

## 🛠️ Development

### Running Locally

```bash
# Install dependencies
npm install

# Make sure ffmpeg is installed
# Ubuntu/Debian: sudo apt install ffmpeg
# macOS: brew install ffmpeg

# Set environment variables
export GEMINI_API_KEY=your-api-key

# Start the server
npm start

# Or with auto-reload
npm run dev
```

### Project Structure

```
gemini-tts-proxy/
├── src/
│   ├── index.js          # Express server
│   ├── gemini.js         # Gemini API client
│   ├── converter.js      # Audio format conversion (ffmpeg)
│   ├── voiceMapping.js   # Voice name mapping
│   └── logger.js         # Logging utility
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## 📋 Requirements

- **Node.js** 18+ (for local development)
- **ffmpeg** (for audio format conversion)
- **Docker** (recommended for deployment)
- **Gemini API Key** - Get one at [Google AI Studio](https://aistudio.google.com/)

## 🐛 Troubleshooting

### Audio not playing

Check the logs for errors:
```bash
docker logs tts-proxy
```

### ffmpeg not found

Make sure ffmpeg is installed. The Docker image includes it automatically.

### API key errors

Verify your Gemini API key is correct and has access to the Gemini 2.5 Flash TTS model.

### Slow response times

- Enable debug logging to see timing: `LOG_LEVEL=debug`
- Use `TTS_MODE=streaming` for lower perceived latency (but uses more API quota)
- Use `TTS_MODE=buffered` to conserve API quota (default)
- Shorter text inputs will generate faster

### API quota running out quickly

- Switch to `TTS_MODE=buffered` mode which makes a single API request per text
- Streaming mode makes multiple requests and consumes quota faster

## 📄 License

MIT License - feel free to use this in your own projects!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- [Google Gemini API](https://ai.google.dev/) for the TTS capabilities
- [OpenWebUI](https://github.com/open-webui/open-webui) for the amazing UI
- The open source community for inspiration

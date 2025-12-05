FROM node:20-alpine

# Install ffmpeg for audio conversion
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY src/ ./src/

# Expose port
EXPOSE 3500

# Run the server
CMD ["node", "src/index.js"]

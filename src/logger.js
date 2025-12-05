/**
 * Simple logger with levels and timestamps
 */

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.info;

function formatTimestamp() {
    return new Date().toISOString();
}

function log(level, message, data = null) {
    if (LOG_LEVELS[level] < currentLevel) {
        return;
    }

    const prefix = `[${formatTimestamp()}] [${level.toUpperCase()}]`;

    if (data) {
        console.log(`${prefix} ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    } else {
        console.log(`${prefix} ${message}`);
    }
}

module.exports = {
    debug: (msg, data) => log('debug', msg, data),
    info: (msg, data) => log('info', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
};

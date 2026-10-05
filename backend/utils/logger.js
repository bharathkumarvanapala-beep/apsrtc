/**
 * APSRTC SmartTrack Structured Logger
 */

const levels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const currentLevel = process.env.LOG_LEVEL || 'INFO';

function formatMessage(level, message, meta) {
  const ts = new Date().toISOString();
  const metaStr = meta ? ` | ${typeof meta === 'object' ? JSON.stringify(meta) : meta}` : '';
  return `[${ts}] [${level}] ${message}${metaStr}`;
}

const logger = {
  debug: (msg, meta) => {
    if (levels[currentLevel] <= levels.DEBUG) {
      console.log(formatMessage('DEBUG', msg, meta));
    }
  },
  info: (msg, meta) => {
    if (levels[currentLevel] <= levels.INFO) {
      console.log(formatMessage('INFO', msg, meta));
    }
  },
  warn: (msg, meta) => {
    if (levels[currentLevel] <= levels.WARN) {
      console.warn(formatMessage('WARN', msg, meta));
    }
  },
  error: (msg, meta) => {
    if (levels[currentLevel] <= levels.ERROR) {
      console.error(formatMessage('ERROR', msg, meta));
    }
  }
};

module.exports = logger;

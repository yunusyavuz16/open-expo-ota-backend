/**
 * Application logger utility
 * Provides consistent logging throughout the application
 */
import chalk from 'chalk';

// Environment-sensitive logging
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Log levels with their respective colors
 */
const LOG_LEVELS = {
  DEBUG: { color: chalk.gray, enabled: isDevelopment },
  INFO: { color: chalk.blue, enabled: true },
  WARN: { color: chalk.yellow, enabled: true },
  ERROR: { color: chalk.red, enabled: true },
};

/**
 * Format the current timestamp
 */
const getTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Format a log message
 */
const formatMessage = (level: string, message: string, ...args: any[]) => {
  const timestamp = getTimestamp();
  const logLevel = LOG_LEVELS[level as keyof typeof LOG_LEVELS];

  if (!logLevel?.enabled && !isTest) {
    return null; // Skip logging if disabled for this level
  }

  const colorize = logLevel?.color || ((text: string) => text);
  const formattedLevel = colorize(`[${level}]`);

  // Format the message
  let formattedMessage = `${chalk.gray(timestamp)} ${formattedLevel} ${message}`;

  // Add additional arguments if provided
  if (args.length > 0) {
    for (const arg of args) {
      if (typeof arg === 'object') {
        try {
          formattedMessage += ` ${JSON.stringify(arg)}`;
        } catch (error) {
          formattedMessage += ` [Object]`;
        }
      } else {
        formattedMessage += ` ${arg}`;
      }
    }
  }

  return formattedMessage;
};

/**
 * Logger interface
 */
const logger = {
  /**
   * Debug level logging (development only)
   */
  debug: (message: string, ...args: any[]) => {
    const formattedMessage = formatMessage('DEBUG', message, ...args);
    if (formattedMessage && !isTest) {
      console.debug(formattedMessage);
    }
  },

  /**
   * Info level logging
   */
  info: (message: string, ...args: any[]) => {
    const formattedMessage = formatMessage('INFO', message, ...args);
    if (formattedMessage && !isTest) {
      console.info(formattedMessage);
    }
  },

  /**
   * Warning level logging
   */
  warn: (message: string, ...args: any[]) => {
    const formattedMessage = formatMessage('WARN', message, ...args);
    if (formattedMessage && !isTest) {
      console.warn(formattedMessage);
    }
  },

  /**
   * Error level logging
   */
  error: (message: string, ...args: any[]) => {
    const formattedMessage = formatMessage('ERROR', message, ...args);
    if (formattedMessage && !isTest) {
      console.error(formattedMessage);
    }
  },
};

export default logger;
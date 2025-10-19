const fs = require('fs');
const path = require('path');
const { format } = require('util');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const errorLogPath = path.join(logsDir, 'error.log');
const appLogPath = path.join(logsDir, 'app.log');

/**
 * Log an error to file and console
 * @param {Error|string} err - Error object or message
 * @param {string} context - Context where the error occurred
 */
function logError(err, context = '') {
    const timestamp = new Date().toISOString();
    const errorMessage = err instanceof Error ? err.stack || err.message : err;
    const logEntry = `[${timestamp}] [ERROR] [${context}] ${errorMessage}\n`;
    
    // Log to console
    console.error(`\x1b[31m${logEntry}\x1b[0m`);
    
    // Log to file
    fs.appendFile(errorLogPath, logEntry, (appendErr) => {
        if (appendErr) {
            console.error(`Failed to write to error log: ${appendErr.message}`);
        }
    });
}

/**
 * Log application info to file and console
 * @param {string} message - Log message
 * @param {string} level - Log level (info, warn, debug)
 */
function logInfo(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    // Log to console with color based on level
    let consoleLog;
    switch (level) {
        case 'warn':
            consoleLog = `\x1b[33m${logEntry}\x1b[0m`; // Yellow
            console.warn(consoleLog);
            break;
        case 'debug':
            consoleLog = `\x1b[36m${logEntry}\x1b[0m`; // Cyan
            console.debug(consoleLog);
            break;
        default:
            consoleLog = `\x1b[32m${logEntry}\x1b[0m`; // Green
            console.log(consoleLog);
    }
    
    // Log to file
    fs.appendFile(appLogPath, logEntry, (appendErr) => {
        if (appendErr) {
            console.error(`Failed to write to app log: ${appendErr.message}`);
        }
    });
}

/**
 * Express error handler middleware
 */
function errorMiddleware(err, req, res, next) {
    logError(err, `${req.method} ${req.path}`);
    
    // Send appropriate response to client
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: statusCode
        }
    });
}

/**
 * Create a custom error with status code
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {Error} Custom error object
 */
function createError(message, statusCode = 500) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

/**
 * Wrap async route handlers to catch errors
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler that catches errors
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    logError,
    logInfo,
    errorMiddleware,
    createError,
    asyncHandler
};
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(config.dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to SQLite database');
    
    // Create messages table if it doesn't exist
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            type TEXT NOT NULL,
            target_group TEXT
        )
    `, (err) => {
        if (err) {
            console.error('Error creating messages table:', err);
        } else {
            console.log('Messages table ready');
        }
    });
});

// Log a message to the database
function logMessage(sender, content, timestamp, type, targetGroup = null) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO messages (sender, content, timestamp, type, target_group)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        db.run(query, [sender, content, timestamp, type, targetGroup], function(err) {
            if (err) {
                console.error('Error logging message:', err);
                reject(err);
                return;
            }
            resolve(this.lastID);
        });
    });
}

// Get all messages
function getMessages(callback) {
    const query = `
        SELECT * FROM messages
        ORDER BY timestamp DESC
        LIMIT 100
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching messages:', err);
            callback(err, null);
            return;
        }
        callback(null, rows);
    });
}

// Get messages by type
function getMessagesByType(type, callback) {
    const query = `
        SELECT * FROM messages
        WHERE type = ?
        ORDER BY timestamp DESC
        LIMIT 50
    `;
    
    db.all(query, [type], (err, rows) => {
        if (err) {
            console.error(`Error fetching ${type} messages:`, err);
            callback(err, null);
            return;
        }
        callback(null, rows);
    });
}

// Close database connection
function close() {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
                reject(err);
                return;
            }
            console.log('Database connection closed');
            resolve();
        });
    });
}

module.exports = {
    logMessage,
    getMessages,
    getMessagesByType,
    close
};
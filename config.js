const fs = require('fs');
const path = require('path');

// Default configuration
const defaultConfig = {
    targetGroupName: 'Message Forwarding',  // Default target group name
    dbPath: path.join(__dirname, 'data', 'messages.db'),
    sendVideosAsDocument: false,
    forwardVideosAsLink: false,
    publicBaseUrl: '',
    uploadsDir: path.join(__dirname, 'uploads'),
    disableVideoForwarding: false
};

// Path to config file
const configPath = path.join(__dirname, 'config.json');

// Create config file if it doesn't exist
if (!fs.existsSync(configPath)) {
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
}

// Read config
let config;
try {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = { ...defaultConfig, ...JSON.parse(configData) };
} catch (error) {
    console.error('Error reading config file:', error);
    config = defaultConfig;
}

// Update target group
function updateTargetGroup(groupName) {
    config.targetGroupName = groupName;
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`Target group updated to: ${groupName}`);
        return true;
    } catch (error) {
        console.error('Error updating config file:', error);
        return false;
    }
}

module.exports = {
    ...config,
    updateTargetGroup
};
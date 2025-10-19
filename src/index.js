const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const db = require('./database');
const config = require('../config');
const { logError, logInfo, errorMiddleware, asyncHandler } = require('./errorHandler');
const fs = require('fs');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Initialize WhatsApp client (mutable for re-creation)
let client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let qrCodeData = '';
let connectionStatus = 'disconnected';
let targetGroup = config.targetGroupName;

// Attach WhatsApp client event handlers to a given client instance
function attachClientHandlers(c) {
    // QR events
    c.on('qr', (qr) => {
        logInfo('QR Code received, scan to authenticate');
        qrCodeData = qr;
        qrcode.toDataURL(qr, (err, url) => {
            if (err) {
                logError(err, 'QR Code generation');
                return;
            }
            io.emit('qrCode', url);
        });
    });

    // Ready
    c.on('ready', () => {
        logInfo('WhatsApp client is ready!');
        connectionStatus = 'connected';
        io.emit('status', { status: connectionStatus });
    });

    // Authenticated
    c.on('authenticated', () => {
        logInfo('WhatsApp client authenticated');
        qrCodeData = '';
        io.emit('authenticated');
    });

    // Auth failure
    c.on('auth_failure', (msg) => {
        logError(msg, 'WhatsApp Authentication');
        connectionStatus = 'auth_failure';
        io.emit('status', { status: connectionStatus, message: msg });
    });

    // Disconnected
    c.on('disconnected', (reason) => {
        logInfo(`WhatsApp client disconnected: ${reason}`, 'warn');
        connectionStatus = 'disconnected';
        io.emit('status', { status: connectionStatus, message: reason });
    });

    // Message handling
    c.on('message', async (message) => {
        try {
            // Skip messages from groups
            const chat = await message.getChat();
            if (chat.isGroup) return;

            const contact = await message.getContact();
            const contactName = contact.pushname || contact.number;
            const messageContent = message.body;
            const timestamp = new Date().toISOString();

            logInfo(`New message from ${contactName}: ${messageContent}`);

            // Log message to database
            await db.logMessage(contactName, messageContent, timestamp, 'incoming');

            // Forward message to target group
            const targetGroupChat = await getTargetGroupChat(c, targetGroup);

            if (targetGroupChat) {
                await targetGroupChat.sendMessage(`*Forwarded from ${contactName}*:\n${messageContent}`);
                logInfo(`Message forwarded to group: ${targetGroup}`);
                
                // Log forwarded message
                await db.logMessage(contactName, messageContent, timestamp, 'forwarded', targetGroup);
                
                // Emit to dashboard
                io.emit('newMessage', {
                    type: 'forwarded',
                    from: contactName,
                    to: targetGroup,
                    content: messageContent,
                    timestamp
                });
            } else {
                const errorMsg = `Target group "${targetGroup}" not found`;
                logError(errorMsg, 'Message Forwarding');
                io.emit('error', { message: errorMsg });
            }

            // Emit to dashboard
            io.emit('newMessage', {
                type: 'incoming',
                from: contactName,
                content: messageContent,
                timestamp
            });
        } catch (error) {
            logError(error, 'Message Handling');
            io.emit('error', { message: 'Error handling message', error: error.message });
        }
    });
}

// Helper: normalize group name for comparison
function normalizeName(name) {
    return (name || '').trim().toLowerCase();
}

// Helper: get target group chat with robust matching
async function getTargetGroupChat(c, groupName) {
    try {
        const chats = await c.getChats();
        const normalizedTarget = normalizeName(groupName);
        // Exact (case-insensitive)
        let match = chats.find(chat => chat.isGroup && normalizeName(chat.name) === normalizedTarget);
        if (!match) {
            // Partial fallback
            match = chats.find(chat => chat.isGroup && normalizeName(chat.name).includes(normalizedTarget));
        }
        return match || null;
    } catch (e) {
        logError(e, 'Find Target Group Chat');
        return null;
    }
}

// Attach handlers to the current client instance
attachClientHandlers(client);

// API Routes
app.get('/api/status', asyncHandler(async (req, res) => {
    res.json({ status: connectionStatus });
}));

app.get('/api/qr', asyncHandler(async (req, res) => {
    if (qrCodeData) {
        qrcode.toDataURL(qrCodeData, (err, url) => {
            if (err) {
                throw new Error('Failed to generate QR code');
            }
            res.json({ qrCode: url });
        });
    } else {
        res.status(404).json({ error: 'QR code not available' });
    }
}));

app.get('/api/messages', asyncHandler(async (req, res) => {
    try {
        const messages = await new Promise((resolve, reject) => {
            db.getMessages((err, messages) => {
                if (err) reject(err);
                else resolve(messages);
            });
        });
        res.json({ messages });
    } catch (error) {
        logError(error, 'Fetching messages');
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
}));

app.post('/api/config/target-group', asyncHandler(async (req, res) => {
    const { groupName } = req.body;
    if (!groupName) {
        return res.status(400).json({ error: 'Group name is required' });
    }
    
    targetGroup = groupName;
    const updated = config.updateTargetGroup(groupName);
    if (updated) {
        logInfo(`Target group updated to: ${groupName}`);
        res.json({ success: true, targetGroup });
    } else {
        res.status(500).json({ error: 'Failed to update target group' });
    }
}));

// Add disconnect endpoint
app.post('/api/whatsapp/disconnect', asyncHandler(async (req, res) => {
    try {
        await client.destroy();
        connectionStatus = 'disconnected';
        qrCodeData = '';
        io.emit('status', { status: connectionStatus, message: 'WhatsApp disconnected' });
        logInfo('WhatsApp client disconnected by dashboard command', 'warn');
        res.json({ success: true });
    } catch (error) {
        logError(error, 'WhatsApp Disconnect');
        res.status(500).json({ success: false, error: 'Failed to disconnect WhatsApp' });
    }
}));

// Add connect endpoint
app.post('/api/whatsapp/connect', asyncHandler(async (req, res) => {
    try {
        // Always recreate a fresh client instance before initialize
        try {
            await client.destroy();
        } catch (e) {
            logError(e, 'WhatsApp Connect (destroy existing client)');
        }

        client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });
        attachClientHandlers(client);

        connectionStatus = 'connecting';
        io.emit('status', { status: connectionStatus, message: 'Connecting...' });
        await client.initialize();
        res.json({ success: true });
    } catch (error) {
        logError(error, 'WhatsApp Connect');
        res.status(500).json({ success: false, error: 'Failed to connect WhatsApp' });
    }
}));

// Add logout endpoint (clear session and require new QR)
app.post('/api/whatsapp/logout', asyncHandler(async (req, res) => {
    try {
        // Attempt to logout from WhatsApp
        try {
            await client.logout();
        } catch (e) {
            logError(e, 'WhatsApp Logout (client.logout)');
        }

        // Fully destroy the client instance
        try {
            await client.destroy();
        } catch (e) {
            logError(e, 'WhatsApp Logout (client.destroy)');
        }

        // Remove LocalAuth session folder to ensure a fresh login
        const authDir = path.join(__dirname, '../.wwebjs_auth');
        try {
            if (fs.existsSync(authDir)) {
                await fs.promises.rm(authDir, { recursive: true, force: true });
                logInfo('LocalAuth session directory cleared');
            }
        } catch (e) {
            logError(e, 'WhatsApp Logout (clear auth dir)');
        }

        connectionStatus = 'disconnected';
        qrCodeData = '';
        io.emit('status', { status: connectionStatus, message: 'Logged out. Click Connect to pair a new number.' });
        res.json({ success: true });
    } catch (error) {
        logError(error, 'WhatsApp Logout');
        res.status(500).json({ success: false, error: 'Failed to logout and clear session' });
    }
}));

// Socket.io connection
io.on('connection', (socket) => {
    logInfo('New client connected to dashboard');
    socket.emit('status', { status: connectionStatus });
    
    if (qrCodeData) {
        qrcode.toDataURL(qrCodeData, (err, url) => {
            if (err) {
                logError(err, 'QR Code generation for socket');
                return;
            }
            socket.emit('qrCode', url);
        });
    }
    
    socket.on('disconnect', () => {
        logInfo('Client disconnected from dashboard');
    });
});

// Add error middleware
app.use(errorMiddleware);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logInfo(`Server running on port ${PORT}`);
    logInfo(`Dashboard available at http://localhost:${PORT}`);
    
    // Initialize WhatsApp client
    client.initialize().catch(err => {
        logError(err, 'WhatsApp client initialization');
    });
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    logInfo('Shutting down...', 'warn');
    try {
        await client.destroy();
        await db.close();
        server.close(() => {
            logInfo('Server closed');
            process.exit(0);
        });
    } catch (error) {
        logError(error, 'Shutdown');
        process.exit(1);
    }
});

// List available groups for current account
app.get('/api/groups', asyncHandler(async (req, res) => {
    try {
        const chats = await client.getChats();
        const groups = chats
            .filter(chat => chat.isGroup)
            .map(chat => ({ id: chat.id && chat.id._serialized ? chat.id._serialized : (chat.id || '').toString(), name: chat.name }));
        res.json({ groups });
    } catch (error) {
        logError(error, 'List Groups');
        res.status(500).json({ error: 'Failed to list groups' });
    }
}));
// Connect to Socket.io server
const socket = io();

// DOM Elements
const connectionStatus = document.getElementById('connection-status');
const qrContainer = document.getElementById('qrcode');
const messagesContainer = document.getElementById('messages');
const targetGroupForm = document.getElementById('target-group-form');
const targetGroupInput = document.getElementById('target-group');
const filterButtons = document.querySelectorAll('.filter-btn');
const notification = document.getElementById('notification');
const notificationMessage = document.querySelector('.notification-message');
const notificationClose = document.querySelector('.notification-close');
const disconnectBtn = document.getElementById('disconnect-btn');
const connectBtn = document.getElementById('connect-btn');
const logoutBtn = document.getElementById('logout-btn');

// Current filter
let currentFilter = 'all';

// Initialize the dashboard
function init() {
    fetchMessages();
    fetchConfig();
    fetchGroups();
    setupEventListeners();
}

// Fetch messages from the server
function fetchMessages() {
    fetch('/api/messages')
        .then(response => response.json())
        .then(data => {
            if (data.messages && data.messages.length > 0) {
                renderMessages(data.messages);
            }
        })
        .catch(error => {
            showNotification('Error loading messages: ' + error.message, 'error');
        });
}

// Fetch configuration from the server
function fetchConfig() {
    fetch('/api/status')
        .then(response => response.json())
        .then(data => {
            updateConnectionStatus(data.status);
        })
        .catch(error => {
            showNotification('Error loading status: ' + error.message, 'error');
        });
}

// Fetch available groups and show a hint
function fetchGroups() {
    const hint = document.getElementById('group-hint');
    if (!hint) return;
    fetch('/api/groups')
        .then(res => res.json())
        .then(data => {
            if (data.groups && data.groups.length) {
                const names = data.groups.map(g => g.name).filter(Boolean);
                const preview = names.slice(0, 8).join(', ');
                hint.innerHTML = `<span class="hint-title">Available Groups:</span><span class="hint-list">${preview}${names.length > 8 ? '…' : ''}</span>`;
            } else {
                hint.textContent = 'No groups found. Ensure the connected account is a member of the target group.';
            }
        })
        .catch(() => {
            hint.textContent = 'Unable to load groups. You can still type the exact group name.';
        });
}

// Setup event listeners
function setupEventListeners() {
    targetGroupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const groupName = targetGroupInput.value.trim();
        
        if (groupName) {
            updateTargetGroup(groupName);
        } else {
            showNotification('Please enter a group name', 'warning');
        }
    });
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            currentFilter = filter;
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            filterMessages(filter);
        });
    });
    
    notificationClose.addEventListener('click', hideNotification);

    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectWhatsApp);
    }
    if (connectBtn) {
        connectBtn.addEventListener('click', connectWhatsApp);
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutWhatsApp);
    }
}

// Update target group
function updateTargetGroup(groupName) {
    fetch('/api/config/target-group', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ groupName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(`Target group updated to: ${groupName}`, 'success');
            fetchGroups();
        } else {
            showNotification('Failed to update target group', 'error');
        }
    })
    .catch(error => {
        showNotification('Error updating target group: ' + error.message, 'error');
    });
}

// Render messages in the UI
function renderMessages(messages) {
    const emptyState = messagesContainer.querySelector('.empty-state');
    if (emptyState) {
        messagesContainer.removeChild(emptyState);
    }
    
    if (messages.length > 0) {
        messagesContainer.innerHTML = '';
    }
    
    // Sort ascending by timestamp so the latest ends up at top when prepending
    const ordered = messages.slice().sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return ta - tb;
    });
    
    ordered.forEach(message => {
        addMessageToUI(message);
    });
    
    filterMessages(currentFilter);
}

// Add a single message to the UI
function addMessageToUI(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message-item message-${message.type}`;
    messageElement.setAttribute('data-type', message.type);
    
    const formattedTime = moment(message.timestamp).format('MMM D, YYYY h:mm A');
    
    let targetInfo = '';
    if (message.type === 'forwarded' && message.target_group) {
        targetInfo = `<div class="message-target">To: ${message.target_group}</div>`;
    }
    
    messageElement.innerHTML = `
        <div class="message-header-info">
            <div class="message-sender">${message.sender}</div>
            <div class="message-time">${formattedTime}</div>
        </div>
        <div class="message-content">${message.content}</div>
        <div class="message-footer">
            <div class="message-type">${message.type.charAt(0).toUpperCase() + message.type.slice(1)}</div>
            ${targetInfo}
        </div>
    `;
    
    messagesContainer.insertBefore(messageElement, messagesContainer.firstChild);
}

// Filter messages based on type
function filterMessages(filter) {
    const messages = messagesContainer.querySelectorAll('.message-item');
    
    messages.forEach(message => {
        if (filter === 'all' || message.getAttribute('data-type') === filter) {
            message.style.display = 'block';
        } else {
            message.style.display = 'none';
        }
    });
}

// Update connection status in the UI
function updateConnectionStatus(status) {
    connectionStatus.className = 'status ' + status;
    
    let statusText = 'Unknown';
    switch (status) {
        case 'connected':
            statusText = 'Connected';
            break;
        case 'disconnected':
            statusText = 'Disconnected';
            break;
        case 'connecting':
            statusText = 'Connecting...';
            break;
        case 'auth_failure':
            statusText = 'Authentication Failed';
            break;
    }
    
    connectionStatus.querySelector('.status-text').textContent = statusText;
}

// Show notification
function showNotification(message, type = 'info') {
    notificationMessage.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        hideNotification();
    }, 5000);
}

// Hide notification
function hideNotification() {
    notification.className = 'notification';
}

// Disconnect WhatsApp client
function disconnectWhatsApp() {
    fetch('/api/whatsapp/disconnect', {
        method: 'POST'
    })
    .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        let data = null;
        if (contentType.includes('application/json')) {
            try {
                data = await res.json();
            } catch (_) {
                // Fallback to text when JSON parse fails
                const text = await res.text();
                data = { success: false, message: text };
            }
        } else {
            const text = await res.text();
            data = { success: false, message: text };
        }

        if (res.ok && data && data.success) {
            updateConnectionStatus('disconnected');
            showNotification('WhatsApp disconnected', 'success');
        } else {
            const msg = (data && (data.error || data.message)) || `Request failed: ${res.status}`;
            showNotification(msg, 'error');
        }
    })
    .catch(err => {
        showNotification('Error disconnecting WhatsApp: ' + err.message, 'error');
    });
}

// Connect WhatsApp client
function connectWhatsApp() {
    fetch('/api/whatsapp/connect', {
        method: 'POST'
    })
    .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        let data = null;
        if (contentType.includes('application/json')) {
            try {
                data = await res.json();
            } catch (_) {
                const text = await res.text();
                data = { success: false, message: text };
            }
        } else {
            const text = await res.text();
            data = { success: false, message: text };
        }

        if (res.ok && data && data.success) {
            updateConnectionStatus('connecting');
            showNotification('Connecting to WhatsApp...', 'info');
        } else {
            const msg = (data && (data.error || data.message)) || `Request failed: ${res.status}`;
            showNotification(msg, 'error');
        }
    })
    .catch(err => {
        showNotification('Error connecting WhatsApp: ' + err.message, 'error');
    });
}

// Logout and clear session to pair a different number
function logoutWhatsApp() {
    fetch('/api/whatsapp/logout', {
        method: 'POST'
    })
    .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        let data = null;
        if (contentType.includes('application/json')) {
            try {
                data = await res.json();
            } catch (_) {
                const text = await res.text();
                data = { success: false, message: text };
            }
        } else {
            const text = await res.text();
            data = { success: false, message: text };
        }

        if (res.ok && data && data.success) {
            updateConnectionStatus('disconnected');
            showNotification('Logged out. Click Connect to pair a new number.', 'warning');
        } else {
            const msg = (data && (data.error || data.message)) || `Request failed: ${res.status}`;
            showNotification(msg, 'error');
        }
    })
    .catch(err => {
        showNotification('Error logging out: ' + err.message, 'error');
    });
}

// Socket.io event handlers
socket.on('connect', () => console.log('Connected to server'));
socket.on('status', (data) => {
    updateConnectionStatus(data.status);
    if (data.message) showNotification(data.message);
});
socket.on('qrCode', (qrCodeUrl) => {
    qrContainer.innerHTML = `<img src="${qrCodeUrl}" alt="WhatsApp QR Code">`;
});
socket.on('authenticated', () => {
    qrContainer.innerHTML = '<p class="qr-placeholder">Authenticated successfully!</p>';
    showNotification('WhatsApp authenticated successfully!', 'success');
});
socket.on('newMessage', (message) => {
    addMessageToUI({
        sender: message.from,
        content: message.content,
        timestamp: message.timestamp,
        type: message.type,
        target_group: message.to
    });
    showNotification(`New ${message.type} message from ${message.from}`, 'info');
});
socket.on('error', (error) => showNotification(error.message, 'error'));

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', init);
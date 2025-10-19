# WhatsApp Message Forwarder

A full-stack Node.js application that automatically forwards private WhatsApp messages to a specified group and provides a real-time web dashboard to monitor activity.

## Features

- **WhatsApp Web Integration**: Logs into WhatsApp Web using the whatsapp-web.js library with LocalAuth
- **Automatic Message Forwarding**: Forwards private messages to a configured WhatsApp group
- **Real-time Web Dashboard**: Displays incoming and forwarded messages with timestamps
- **Message Logging**: Stores all message history in a local SQLite database
- **Persistent Authentication**: Remembers login after initial QR code scan

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- A WhatsApp account
- Chrome/Chromium browser (used by Puppeteer for WhatsApp Web)

## Installation

1. Clone this repository or download the source code:

```bash
git clone https://github.com/yourusername/whatsapp-forwarder.git
cd whatsapp-forwarder
```

2. Install dependencies:

```bash
npm install
```

## Configuration

The application uses a configuration file that will be automatically created on first run. You can modify the target WhatsApp group through the web dashboard or by editing the `data/config.json` file directly.

Default configuration:
```json
{
  "targetGroup": "My Group"
}
```

## Running the Application

Start the server:

```bash
npm start
```

For development with auto-restart on file changes:

```bash
npm run dev
```

## Usage Guide

### First-time Setup

1. Start the application using one of the commands above
2. Open your browser and navigate to `http://localhost:3000`
3. Scan the QR code displayed on the dashboard using your WhatsApp mobile app:
   - Open WhatsApp on your phone
   - Tap Menu or Settings
   - Select WhatsApp Web/Desktop
   - Point your phone at the QR code on screen

### Configuring Target Group

1. Once logged in, use the "Configure Target Group" section on the dashboard
2. Enter the exact name of the WhatsApp group where messages should be forwarded
3. Click "Save" to update the configuration

### Monitoring Messages

The dashboard displays:
- **Incoming Messages**: Private messages sent to your WhatsApp account
- **Forwarded Messages**: Messages that have been forwarded to the target group
- **Filter Options**: Filter messages by type (incoming/forwarded)

### Connection Status

The dashboard shows the current connection status:
- **Connected**: Successfully logged into WhatsApp
- **Disconnected**: Not logged in or connection lost
- **Authenticating**: QR code scanning in progress

## Error Handling

The application includes comprehensive error handling:
- Connection issues are automatically managed with reconnection attempts
- All errors are logged to the console and `logs/error.log`
- Application activity is recorded in `logs/app.log`

## Project Structure

```
whatsapp-forwarder/
├── data/                  # Data storage directory
│   ├── config.json        # Configuration file
│   └── messages.db        # SQLite database
├── logs/                  # Log files directory
│   ├── app.log            # Application logs
│   └── error.log          # Error logs
├── public/                # Frontend assets
│   ├── css/               # Stylesheets
│   ├── js/                # Client-side JavaScript
│   └── index.html         # Main HTML file
├── src/                   # Backend source code
│   ├── config.js          # Configuration management
│   ├── database.js        # Database operations
│   ├── errorHandler.js    # Error handling utilities
│   └── index.js           # Main application entry point
├── .gitignore             # Git ignore file
├── package.json           # Node.js dependencies
└── README.md              # This documentation
```

## Best Practices Implemented

- **Error Handling**: Comprehensive error logging and graceful recovery
- **Code Organization**: Modular structure with separation of concerns
- **Real-time Updates**: Socket.io for instant dashboard updates
- **Persistent Storage**: SQLite database for message history
- **Graceful Shutdown**: Proper cleanup on application termination

## Troubleshooting

### QR Code Not Appearing
- Ensure you have a stable internet connection
- Try restarting the application
- Check console for any error messages

### Messages Not Being Forwarded
- Verify the target group name is spelled exactly as it appears in WhatsApp
- Ensure you have permission to send messages to the group
- Check the application logs for any errors

### Connection Issues
- WhatsApp Web may disconnect if your phone loses internet connection
- The application will attempt to reconnect automatically
- You may need to re-scan the QR code if the session expires

## License

This project is licensed under the MIT License - see the LICENSE file for details.
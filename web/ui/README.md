# Porter UI Frontend

A modern React-based web interface for managing remote servers via SSH.

## Features

- **Dashboard** - Overview of all machines with health status
- **Machine Management** - Add, organize, and connect to servers
- **Interactive Terminal** - Full SSH terminal in the browser (xterm.js)
- **Multi-Terminal** - Multiple terminal sessions in tabs
- **File Manager** - Browse, edit, upload, and download files
- **Monaco Editor** - VS Code-like editor for remote files
- **Service Manager** - Start, stop, restart systemd services
- **Docker Manager** - Manage containers, images, and compose stacks
- **Live Logs** - Real-time log streaming with filtering
- **System Monitor** - CPU, memory, disk, and network graphs
- **Remote Desktop** - VNC access via noVNC
- **Script Runner** - Execute deployment scripts with progress tracking
- **Network Tools** - Ping, traceroute, DNS lookup, port scan
- **Backup Manager** - Schedule and manage backups
- **Import/Export** - Backup and restore configuration

## Tech Stack

- **React 19** - UI framework
- **Material UI 7** - Component library
- **xterm.js** - Terminal emulator
- **Monaco Editor** - Code editor
- **noVNC** - VNC client
- **Recharts** - Charts and graphs
- **Vite** - Build tool

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
cd ui
npm install
```

### Development Server

```bash
npm start
```

Opens at http://localhost:5173 with hot reload.

### Production Build

```bash
npm run build
```

Output is in `build/` directory.

## Project Structure

```
ui/
├── src/
│   ├── App.js              # Main app with routing
│   ├── index.js            # Entry point
│   └── scripts/
│       ├── ScriptRunner.js # Main layout with navigation
│       ├── Dashboard.js    # Machine overview dashboard
│       ├── Machines.js     # Machine list and management
│       ├── MachineView.js  # Single machine view
│       ├── MachineTerminal*.js  # Terminal components
│       ├── FileManager.js  # File browser
│       ├── DockerManager.js # Docker management
│       ├── LiveLogs.js     # Log viewer
│       ├── Settings.js     # Application settings
│       └── ...
├── public/                 # Static assets
├── package.json
└── vite.config.js
```

## Configuration

The UI connects to the Porter backend API. Configure the API URL in development:

```js
// vite.config.js - proxy configuration
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
}
```

## Theming

Supports light and dark themes via Material UI's theming system. Theme preference is persisted in localStorage.

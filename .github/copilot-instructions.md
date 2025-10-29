<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements

- [x] Scaffold the Project

- [x] Customize the Project

- [x] Install Required Extensions

- [x] Compile the Project

- [x] Create and Run Task

- [ ] Launch the Project

- [x] Ensure Documentation is Complete

## Project Information

This is a Watch-With-Friends web application for synchronized video watching with real-time voice and text chat.

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Zustand + Socket.IO Client
- **Backend**: Node.js + TypeScript + Express + Socket.IO + Redis
- **Real-time**: WebSocket (Socket.IO) for control + WebRTC for voice
- **Synchronization**: Server-authoritative clock with drift correction

### To Run the Application

**Prerequisites**: Redis server must be running (or use Docker Compose)

**Development Mode**:
```bash
# Start backend
cd backend
npm run dev

# Start frontend (in another terminal)
cd frontend  
npm run dev
```

**Or use Docker**:
```bash
docker-compose up
```

Frontend will be at http://localhost:5173
Backend API at http://localhost:3001

# KKB Bot - Development Roadmap

## Completed ✅

- [x] Monorepo architecture (shared, bot, dashboard packages)
- [x] TypeScript configuration and module resolution
- [x] Discord.js bot core with intents
- [x] Text command system (CommandRegistry, examples)
- [x] WebSocket server infrastructure
- [x] Welcome/greeting system (auto-greet on member join, GIF support, interactive buttons)
- [x] Dashboard UI and real-time sync
- [x] Slash command infrastructure (SlashCommandRegistry, ISlashCommand interface)
- [x] Slash command deployment (Discord REST API)
- [x] Two welcome slash commands (/welcome, /welcome-setup)
- [x] Message and interaction event handlers
- [x] **PostgreSQL + GifManager** for GIF storage
- [x] **Express HTTP server** for file uploads
- [x] **GIF resizing** with Sharp (animated GIF support)
- [x] **Upload routes** (POST, GET, DELETE endpoints)
- [x] **Pre-resize script** for performance optimization

## In Progress 🔄

- [ ] Install and test dependencies (sharp, express, pg, multer)
  - Run: `npm install` and `npm run type-check`
  - Verify: HTTP server starts, database schema creates

## Pending 🚧

### High Priority
- [ ] **Test GIF Upload System**
  - Set up PostgreSQL locally or on Render
  - Run bot and verify HTTP server starts on port 3000
  - Test: POST upload, GET list, DELETE, GET random
  - Verify: GIFs resize correctly with Sharp

- [ ] **Dashboard Upload UI**
  - Add file input element to WelcomePanel
  - Connect POST request to `/api/upload/gif`
  - Display upload progress
  - Show list of uploaded GIFs with delete buttons
  - Real-time sync via WebSocket (gif:uploaded events)

- [ ] **WebSocket Integration**
  - Emit `gif:uploaded` event when file uploads
  - Emit `gif:deleted` event when file deletes
  - Dashboard listens and updates UI in real-time

### Medium Priority
- [ ] **Command Enhancements**
  - Make /welcome-setup actions actually update WelcomeManager
  - Test dashboard receives settings updates via WebSocket
  - Connect upload endpoint to welcome greeting flow

- [ ] **Error Handling & Validation**
  - File type validation (GIF, PNG, JPG only)
  - File size validation against config
  - User-friendly error messages
  - Handle database connection failures gracefully
  - Timeout handling for large uploads

- [ ] **Production Settings**
  - Add DATABASE_URL setup guide
  - Create deployment checklist for Render.com
  - Document environment variable setup
  - Test SSL connection to Render PostgreSQL

### Low Priority
- [ ] **Performance Optimization**
  - Monitor database query performance
  - Implement GIF caching headers
  - Add CDN support for static GIF serving
  - Consider image compression options

- [ ] **Testing & Documentation**
  - Unit tests for GifManager
  - Integration tests for upload endpoints
  - API documentation with examples
  - User guide for dashboard GIF management

- [ ] **Additional Features**
  - GIF metadata editing (name, description)
  - Bulk upload support
  - GIF search/filter
  - Upload history/audit log

## Quick Start Testing

```bash
# Install dependencies
npm install

# Type check
npm run type-check

# Run bot (requires DISCORD_TOKEN in .env)
cd packages/bot && npm run dev

# Run dashboard (in another terminal)
cd packages/dashboard && npm run dev
```

## File Structure Reference

```
/packages/
├── shared/src/
│   └── index.ts          (Shared types, interfaces)
├── bot/src/
│   ├── bot.ts            (Main entry point)
│   ├── commands/
│   │   ├── CommandRegistry.ts       (Text command registry)
│   │   ├── SlashCommandRegistry.ts  (Slash command registry)
│   │   ├── Welcome.ts              (Welcome slash commands)
│   │   └── examples.ts             (Ping, Hello text commands)
│   ├── storage/
│   │   ├── SettingsManager.ts       (Bot settings)
│   │   └── WelcomeManager.ts        (Welcome config + GIFs)
│   └── ws/
│       ├── DashboardServer.ts       (WebSocket server)
│       └── WelcomeHandler.ts        (Member join/greeting logic)
└── dashboard/src/
    ├── main.ts           (Dashboard init)
    ├── BotClient.ts      (WebSocket client)
    ├── WelcomePanel.ts   (UI component)
    └── index.html        (UI markup)
```

## Environment Setup

Required in `.env`:
```
DISCORD_TOKEN=your_token_here
WS_PORT=8080
```

Dashboard runs on http://localhost:5173 (dev) or configurable port (prod)
Bot connects to Discord gateway and WebSocket server

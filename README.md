# KKB Bot

A lightweight, extensible Discord bot with a companion dashboard for settings and asset management.

## 🏗️ Architecture

This is a **monorepo** with three main packages:

- **`packages/shared`** — Type definitions, interfaces, and constants shared between bot and dashboard
- **`packages/bot`** — Discord bot service with command registry and WebSocket server
- **`packages/dashboard`** — Lightweight Vite-based dashboard for bot management

### Communication Flow

```
Discord
   ↓
[Bot Service]
   ↓ (WebSocket)
[Dashboard Client]
```

The bot runs a WebSocket server on `WS_PORT` (default 8080) that the dashboard connects to for real-time updates and settings management.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- A Discord bot token (from [Discord Developer Portal](https://discord.com/developers/applications))

### Setup

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Configure environment:**

```bash
cp .env.example .env
# Edit .env and add your DISCORD_TOKEN
```

3. **Run in development:**

```bash
# Terminal 1: Bot
npm run dev:bot

# Terminal 2: Dashboard
npm run dev:dashboard
```

Visit `http://localhost:5173` to access the dashboard.

## 📝 Adding New Commands

Commands follow a simple, extensible pattern:

```typescript
// packages/bot/src/commands/MyCommand.ts
import { ICommand, CommandContext, createCommandName } from "@kkb/shared";

export class MyCommand implements ICommand {
  readonly name = createCommandName("mycommand");
  readonly description = "Does something cool";
  readonly usage = "/mycommand [args]";

  async execute(args: string[], context: CommandContext): Promise<string> {
    // Command logic here
    return "Result message";
  }
}
```

Then register it in `bot.ts`:

```typescript
commandRegistry.register(new MyCommand());
```

## 🔌 WebSocket API

The dashboard communicates with the bot via WebSocket messages:

### Dashboard → Bot

```typescript
{ type: "settings:fetch" }
{ type: "settings:update", data: { prefix: "!" } }
{ type: "image:list" }
{ type: "image:delete", data: { id: "image-123" } }
{ type: "ping" }
```

### Bot → Dashboard

```typescript
{ type: "hello", data: { version: "0.0.1" } }
{ type: "event", data: { type: "command:executed", data: {...} } }
{ type: "error", data: { message: "error description" } }
```

## 📁 Project Structure

```
packages/
├── shared/           # Types, interfaces, constants
│   └── src/
│       └── index.ts  # All domain types
├── bot/              # Discord bot
│   └── src/
│       ├── bot.ts           # Main entry point
│       ├── commands/         # Command implementations
│       ├── storage/          # Settings persistence
│       └── ws/               # Dashboard server
└── dashboard/        # Vite frontend
    ├── src/
    │   ├── BotClient.ts      # WS client
    │   ├── main.ts           # App entry point
    │   └── utils/            # Helper utilities
    └── index.html
```

## 🛠️ Development Commands

```bash
npm run build           # Build all packages
npm run type-check      # Run TypeScript type checking
npm run lint            # Lint code
npm run dev:bot        # Run bot in dev mode
npm run dev:dashboard  # Run dashboard in dev mode
```

## 🔐 Environment Variables

Required:
- `DISCORD_TOKEN` — Your Discord bot token

Optional:
- `WS_PORT` — WebSocket port (default: 8080)
- `NODE_ENV` — Environment (development/production)

## 📦 Dependencies

The project uses minimal, focused dependencies:

- `discord.js` — Discord API client
- `ws` — WebSocket server/client
- `lodash-es` — Utility functions
- `vite` — Frontend build tool
- `typescript` — Type checking

## 🎯 Design Principles

- **Systems thinking** — Clear boundaries and interfaces between subsystems
- **Extensibility** — Easy to add commands, features, storage backends
- **Simplicity** — Vanilla JS where possible, minimal dependencies
- **Type safety** — Full TypeScript with strict mode

## 📝 License

See LICENSE file.

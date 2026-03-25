# GIF Upload System - Implementation Guide

## Overview
The GIF upload system uses:
- **PostgreSQL** for metadata storage (via `pg` package)
- **Sharp** for efficient GIF resizing (handles animated GIFs)
- **Express** + **Multer** for file uploads
- **WebSocket** for real-time sync to dashboard

## Architecture

### Components

#### 1. GifManager (`packages/bot/src/storage/GifManager.ts`)
Manages GIF storage and operations:
- `uploadGif(buffer, name, maxSize)` - Upload and store a GIF
- `listGifs()` - Get all uploaded GIFs
- `getRandomGif(width?, height?)` - Get random GIF with optional resizing
- `deleteGif(id)` - Delete a GIF and cleanup cache
- `initDatabase()` - Initialize PostgreSQL schema

**Database Schema:**
```sql
CREATE TABLE gifs (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at BIGINT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. Upload Routes (`packages/bot/src/routes/uploadRoutes.ts`)
Express routes for file operations:
- `POST /api/upload/gif` - Upload a new GIF
- `GET /api/upload/gifs` - List all GIFs
- `DELETE /api/upload/gif/:id` - Delete a GIF
- `GET /api/upload/gif/random` - Get random GIF (with optional resizing)

#### 3. Resize Script (`scripts/resizeGifs.ts`)
Pre-cache GIFs to avoid first-request delays:
```bash
node scripts/resizeGifs.ts
```

Stores resized versions at: `gifs/welcome/resized/<WIDTH>x<HEIGHT>/`

#### 4. HTTP Server Integration (`packages/bot/src/bot.ts`)
- Starts Express server on `HTTP_PORT` (default 3000)
- Mounts upload routes at `/api/upload`
- Health check endpoint at `/health`
- Runs alongside Discord bot and WebSocket server

## Setup Instructions

### 1. Environment Configuration

Add to `.env`:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/kkb_bot
HTTP_PORT=3000
```

### 2. Database Setup

#### Local PostgreSQL (Development)
```bash
# Install PostgreSQL
brew install postgresql  # macOS
sudo apt install postgresql  # Ubuntu/Debian

# Start service
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Ubuntu

# Create database and user
createdb kkb_bot
createuser kkb_user -P  # Set password when prompted
psql kkb_bot -c "GRANT ALL PRIVILEGES ON DATABASE kkb_bot TO kkb_user;"

# Connection string
DATABASE_URL=postgresql://kkb_user:password@localhost:5432/kkb_bot
```

#### Render.com (Production - Recommended)
Render provides PostgreSQL databases:
1. Create Render PostgreSQL database
2. Copy internal connection string to `.env`
3. App automatically connects and creates schema

**Note:** Use `SSL_REJECT_UNAUTHORIZED=false` for Render in production (connection string handles this).

### 3. Install Dependencies

```bash
npm install
```

This installs:
- `sharp` - GIF resizing (native binary)
- `express` - HTTP server
- `multer` - File upload handling
- `pg` - PostgreSQL client

### 4. Pre-resize GIFs (Optional but Recommended)

```bash
# Resize all GIFs in gifs/* folders to cache
node scripts/resizeGifs.ts
```

This prevents first-request timeouts by pre-generating resized versions.

## Usage

### Upload from Dashboard

```javascript
// BotClient.ts
const formData = new FormData();
formData.append('file', file);

fetch('http://localhost:3000/api/upload/gif', {
  method: 'POST',
  body: formData
})
.then(r => r.json())
.then(gifMeta => {
  console.log('Uploaded:', gifMeta);
  // { id: 'uuid', name: '...', path: '/...', size: 123456, uploadedAt: 1234 }
});
```

### List GIFs

```javascript
fetch('http://localhost:3000/api/upload/gifs')
  .then(r => r.json())
  .then(gifs => console.log(gifs));
```

### Delete GIF

```javascript
fetch('http://localhost:3000/api/upload/gif/gif-id', {
  method: 'DELETE'
})
.then(r => r.json());
```

## Performance Considerations

### Cold Start (Without Pre-resize)
- First request: 1-3 seconds (resizes + caches)
- Subsequent requests: <100ms (cache hit)

### Warm Start (With Pre-resize)
- All requests: <100ms (all in cache)

**Recommendation:** Run `npm run resize-gifs` before deployment.

## File Structure

```
packages/bot/
├── src/
│   ├── storage/
│   │   ├── GifManager.ts         ← GIF storage/database
│   │   └── WelcomeManager.ts      (existing)
│   ├── routes/
│   │   └── uploadRoutes.ts        ← Express routes
│   ├── bot.ts                     (updated with HTTP server)
│   └── ...
├── gifs/
│   ├── welcome/                   ← User uploads here
│   ├── resized/
│   │   └── 256x256/
│   │       └── welcome/           ← Cached resized versions
│   └── ...
├── scripts/
│   └── resizeGifs.ts              ← Pre-resize script
├── config.json                    ← GIF resize config
└── package.json
```

## Troubleshooting

### "Cannot find module 'sharp'"
- Sharp requires build tools and libvips
- Solution: `npm install` in workspace root re-runs native builds

### "DATABASE_URL is required"
- Solution: Add to `.env`: `DATABASE_URL=postgresql://user:pass@host/db`

### "Connection refused for PostgreSQL"
- Check PostgreSQL service is running
- Verify connection string format: `postgresql://user:pass@host:port/database`

### "Upload timeout (interaction failed)"
- Pre-resize GIFs: `node scripts/resizeGifs.ts`
- Or increase timeout in config.json gif dimensions

## Next Steps

1. **Dashboard UI** - Create upload file picker in WelcomePanel
2. **WebSocket Sync** - Emit gif:uploaded events to dashboard
3. **Auto-refresh** - Dashboard listens for new uploads
4. **GIF Stats** - Track upload counts, sizes, usage

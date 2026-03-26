# Render.com Deployment Guide (with Persistent Disk)

## Quick Start

### Option A: Using render.yaml (Recommended)
The repo includes `render.yaml` which auto-configures everything:

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add Render deployment config"
   git push origin main
   ```

2. **Deploy on Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click **New** → **Blueprint** 
   - Connect your GitHub repo
   - Select branch: `main`
   - Click **Deploy**
   - Render will create:
     - ✅ PostgreSQL database
     - ✅ Web service (bot)
     - ✅ 10GB persistent disk for GIFs

3. **Add Environment Variables**
   In Render Dashboard → your service → **Environment**:
   ```
   DISCORD_TOKEN=your_token_here
   DATABASE_URL=(auto-filled from database service)
   ```

4. **Done!** Bot is live 🚀

---

### Option B: Manual Setup

If you prefer manual setup (without render.yaml):

#### 1. Create PostgreSQL Database
1. Click **New** → **PostgreSQL**
2. Name: `kkb-bot-db`
3. Database: `kkb_bot`
4. User: `kkb_user`
5. Copy the **Internal Database URL**

#### 2. Create Web Service
1. Click **New** → **Web Service**
2. Connect your GitHub repo
3. **Build Command:**
   ```bash
   npm install && npm run build
   ```
4. **Start Command:**
   ```bash
   node packages/bot/dist/bot.js
   ```

#### 3. Add Persistent Disk
1. Service Settings → **Disks**
2. Click **Add Disk**
3. Mount path: `/var/data/gifs`
4. Size: `10 GB`
5. Save

#### 4. Set Environment Variables
In **Environment**:
```
DISCORD_TOKEN=your_discord_token
DATABASE_URL=postgresql://kkb_user:PASSWORD@hostname:5432/kkb_bot
WS_PORT=8080
HTTP_PORT=3000
NODE_ENV=production
GIF_STORAGE_PATH=/var/data/gifs
```

---

## Environment Variables Reference

| Variable | Value | Notes |
|----------|-------|-------|
| `DISCORD_TOKEN` | Your bot token | From Discord Developer Portal |
| `DATABASE_URL` | PostgreSQL URL | Auto-filled if using render.yaml |
| `GIF_STORAGE_PATH` | `/var/data/gifs` | **Must match disk mount path** |
| `WS_PORT` | `8080` | Fixed for Render |
| `HTTP_PORT` | `3000` | Fixed for Render |
| `NODE_ENV` | `production` | For Render |

---

## Persistent Disk Details

The 10GB disk is mounted at `/var/data/gifs` and stores:

```
/var/data/gifs/
  ├── welcome/              # Welcome category GIFs
  │   ├── gif1.gif
  │   ├── gif2.gif
  │   └── resized/         # Pre-cached resized versions
  ├── memes/               # User-created categories
  │   ├── meme1.gif
  │   └── resized/
  └── reactions/
      ├── thumbsup.gif
      └── resized/
```

### Persistence Across Deploys
- ✅ GIFs survive redeploys
- ✅ GIFs survive service restarts
- ✅ No data loss on code updates
- ❌ Disk is NOT shared between web services (if you scale)

---

## Getting Your Discord Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create New Application
3. Go to **Bot** section → **Create Bot**
4. Under TOKEN, click **Reset Token** → **Copy**
5. Paste in Render's `DISCORD_TOKEN` environment variable

**Scopes & Permissions:**
- OAuth2 → Scopes: `bot`
- Permissions: `Administrator`

---

## Testing After Deploy

### Check Bot is Running
```bash
curl https://your-service-name.onrender.com/health
# Should return: {"status":"ok","service":"kkb-bot-upload"}
```

### In Discord
1. Add bot to your server using OAuth invite
2. In any channel, type:
   ```
   /gif list
   ```
   Should show: `📁 No categories created yet.`

3. Create a category:
   ```
   /gif create welcome
   ```

4. DM the bot:
   ```
   /gif upload welcome
   ```
   Upload a GIF file

5. Show the GIF:
   ```
   /gif show welcome
   ```

---

## Troubleshooting

### "Service not found" or 503 error
- Check Render Logs tab
- Ensure `DATABASE_URL` is set correctly
- Verify `DISCORD_TOKEN` is valid and non-empty

### "Failed to initialize GIF database"
- Check `DATABASE_URL` format
- Ensure database service finished starting (wait ~2 min)
- View logs: Dashboard → Logs tab

### "/gif upload" not working
- Ensure `GIF_STORAGE_PATH=/var/data/gifs` is set
- Check disk is attached (Service Settings → Disks)
- View bot logs for file write errors

### Bot not responding to commands
- Wait 30 seconds after deploy for slash commands to register
- Check bot has "Administrator" permission in server
- View Discord app info: Developer Portal → Your App → General

### GIFs disappear after redeploy
- Verify `GIF_STORAGE_PATH` is set
- Check disk is mounted (Service Settings → Disks)
- If not, GIFs are stored in ephemeral `/tmp` (lost on redeploy)

---

## Scaling & Performance

### Current Setup (Starter Plan)
- Works great for small-medium servers
- 10 GB disk can hold ~500-1000 GIFs
- Storage cost: included in disk allocation

### If You Need More
1. **Scale WEB service** → Change plan to Standard
2. **Scale DATABASE** → Upgrade PostgreSQL plan
3. **Scale STORAGE** → Increase disk size (costs extra)

---

## Redeploys & Updates

### Auto-deploy on Git Push
- Just `git push origin main`
- Render detects changes and redeploys automatically
- Takes ~1-2 minutes
- GIFs and database persist

### Manual Redeploy
- Render Dashboard → Service → **Actions** → **Redeploy Latest Commit**

### Bypass Build Cache
- If npm dependencies aren't updating:
- **Actions** → **Clear Build Cache** → **Redeploy**

---

## Monitoring

### View Logs
- Render Dashboard → Service → **Logs** tab
- Shows startup errors, commands run, database operations

### Check Disk Usage
- Render Dashboard → Service → **Disks**
- Shows current usage / total size

### Performance Monitoring
- Render Dashboard → Service → **Metrics**
- CPU, memory, request count

---

## Next Steps

1. ✅ Push render.yaml to GitHub
2. ✅ Create Render account & connect GitHub
3. ✅ Deploy using Blueprint (render.yaml)
4. ✅ Set `DISCORD_TOKEN` in Environment
5. ✅ Test bot in Discord: `/gif list`
6. ✅ Create categories and upload GIFs!

Questions? Check Render docs: https://render.com/docs

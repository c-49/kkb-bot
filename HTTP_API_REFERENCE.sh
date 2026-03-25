#!/bin/bash

# Quick Reference: HTTP Upload Server

# Endpoints (running on http://localhost:3000)

echo "📋 KKB Bot - HTTP Upload API Reference"
echo ""
echo "Base URL: http://localhost:3000"
echo ""

echo "1️⃣  Health Check"
echo "   GET /health"
echo "   curl http://localhost:3000/health"
echo ""

echo "2️⃣  Upload GIF"
echo "   POST /api/upload/gif"
echo "   curl -F 'file=@mygif.gif' http://localhost:3000/api/upload/gif"
echo ""

echo "3️⃣  List GIFs"
echo "   GET /api/upload/gifs"
echo "   curl http://localhost:3000/api/upload/gifs"
echo ""

echo "4️⃣  Delete GIF"
echo "   DELETE /api/upload/gif/:id"
echo "   curl -X DELETE http://localhost:3000/api/upload/gif/uuid-here"
echo ""

echo "5️⃣  Get Random GIF"
echo "   GET /api/upload/gif/random?width=256&height=256"
echo "   curl http://localhost:3000/api/upload/gif/random"
echo ""

echo "📚 Response Format:"
echo ""
echo "   Upload Success (201):"
echo "   {\"id\": \"uuid\", \"name\": \"file.gif\", \"path\": \"/...\", \"size\": 12345, \"uploadedAt\": 1234567}"
echo ""
echo "   List Success (200):"
echo "   [{\"id\": \"...\", ...}, ...]"
echo ""
echo "   Error (40x/50x):"
echo "   {\"error\": \"Error message\"}"
echo ""

echo "🔒 Size Limits:"
echo "   - Hard limit: 50MB per file"
echo "   - Default max: 10MB (configurable in config.json)"
echo "   - Format: GIF, PNG, JPG only"
echo ""

echo "💾 Database:"
echo "   - PostgreSQL required"
echo "   - Connection string in .env: DATABASE_URL"
echo "   - Schema auto-creates on bot start"
echo ""

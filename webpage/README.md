# Miniprogram Web (minimal scaffold)

This is a minimal React + Vite scaffold that mirrors the mini program's login + dashboard flow and provides a small API wrapper to call the existing backend.

Quick start:

1. cd webpage
2. npm install
3. npm run dev

Environment:
- Create a `.env` file at the project root with:

VITE_API_BASE=http://localhost:3001

This project intentionally keeps things simple: it stores token in localStorage to match the mini program's session flow. For production, prefer HttpOnly cookies.

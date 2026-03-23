# delexi-proxy

A lightweight Express proxy that sits between the [Delexi](https://delexi-v1.vercel.app) frontend and the Spotify Web API. It keeps Spotify credentials server-side and returns a trimmed-down response to the client.

## Why a proxy?

The Spotify API requires a `client_id` and `client_secret` to obtain access tokens. Exposing those in a browser-side app would leak them publicly. This server handles the OAuth **Client Credentials** flow and forwards only the data the frontend needs.

## Features

- Fetches and caches Spotify app tokens (auto-refreshes before expiry)
- Returns a slim playlist object instead of the full Spotify response
- CORS restricted to allowed origins (Delexi Vercel deployments + localhost)
- Market support (defaults to `FR`, configurable via env)
- `/health` endpoint for uptime checks

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/playlist/:id` | Fetch a Spotify playlist by ID |
| `GET` | `/health` | Health check — returns `{ ok: true }` |

### `GET /api/playlist/:id`

**Query params:**

| Param | Default | Description |
|-------|---------|-------------|
| `market` | `FR` | ISO 3166-1 alpha-2 market code (`FR`, `US`, `GB`, `DE`, `ES`, `IT`, `CA`, `BR`) |

**Example:**
```
GET /api/playlist/37i9dQZF1DXcBWIGoYBM5M?market=US
```

**Response shape:**
```json
{
  "id": "37i9dQZF1DXcBWIGoYBM5M",
  "name": "Today's Top Hits",
  "description": "...",
  "owner": "Spotify",
  "image": "https://...",
  "tracks": [
    {
      "index": 1,
      "name": "Song Title",
      "artist": "Artist Name",
      "duration_ms": 210000,
      "preview_url": "https://...",
      "external_url": "https://open.spotify.com/track/...",
      "id": "trackId"
    }
  ]
}
```

## Setup

### Prerequisites

- Node.js 18+
- A [Spotify Developer](https://developer.spotify.com/dashboard) app (for `client_id` and `client_secret`)

### Install

```bash
npm install
```

### Environment variables

Create a `.env` file at the project root:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Optional — defaults to FR
DEFAULT_MARKET=FR

# Optional — defaults to 5174
PORT=5174
```

### Run locally

```bash
npm start
```

The server starts at `http://localhost:5174`.

## Deployment

This proxy is designed to run on [Render](https://render.com). Set the environment variables in your Render service settings — Render injects `PORT` automatically.

## Allowed origins (CORS)

Requests are accepted from:

- `https://delexi-v1.vercel.app`
- `https://delexi-v1-ismas-projects-4db74a16.vercel.app`
- `https://delexi-v1-git-main-ismas-projects-4db74a16.vercel.app`
- `http://localhost:5173` (local dev)

To add a new origin, update the `allowed` set in `server.js`.

## Tech stack

| Package | Role |
|---------|------|
| `express` | HTTP server & routing |
| `cors` | Origin filtering |
| `dotenv` | Environment variable loading |
| `node-fetch` | Outbound HTTP requests to Spotify |

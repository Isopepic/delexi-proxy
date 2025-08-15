// ===== 1) IMPORTS =====
import express from "express";              // Framework serveur HTTP (routes, middlewares)
import cors from "cors";                    // Contrôle qui a le droit d’appeler ton serveur (CORS)
import "dotenv/config";                     // Charge les variables du fichier .env dans process.env
import fetch from "node-fetch";             // fetch côté Node (appels HTTP sortants)

// ===== 2) APP EXPRESS =====
const app = express();                      // Crée l’application serveur
// --- CORS : autorise uniquement tes origines (Pages + local) ---
const allowed = new Set([
  "https://delexi-v1.vercel.app/analysis" ,
  "https://delexi-v1.vercel.app",
  "https://delexi-v1-ismas-projects-4db74a16.vercel.app/",
  "https://delexi-v1-git-main-ismas-projects-4db74a16.vercel.app/",
  "http://localhost:5173"                 // tests directs depuis le navigateur
]);

const DEFAULT_MARKET = (process.env.DEFAULT_MARKET || "FR").toUpperCase(); // FR par défaut
const ALLOWED_MARKETS = new Set(["FR","US","CA","BR","GB","DE","ES","IT"]);


app.use(cors({
  origin: (origin, cb) => {                 // origin = domaine qui fait la requête
    if (!origin || allowed.has(origin)) return cb(null, true); // autorise si absent (cli/curl) ou dans la liste
    cb(new Error("Origin non autorisée"));  // sinon, bloque
  }
}));

// ===== 3) CACHE TOKEN (mémoire process) =====
let cachedToken = null;                     // token Spotify actuel
let cachedExpiry = 0;                       // timestamp d’expiration (en ms)

// ===== 4) OBTENIR UN TOKEN D’APP SPOTIFY =====
async function getAppToken() {              // async = on va await des requêtes réseau
  const now = Date.now();                   // temps actuel
  if (cachedToken && now < cachedExpiry) {  // si un token valide est déjà en cache
    return cachedToken;                     // le réutiliser
  }
  const tokenUrl = "https://accounts.spotify.com/api/token"; // endpoint token Spotify
  const clientId = process.env.SPOTIFY_CLIENT_ID;            // ID depuis variables d’env
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;    // Secret depuis variables d’env
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64"); // "id:secret" en Base64 (format Basic)

  const res = await fetch(tokenUrl, {       // POST pour obtenir un access_token
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",   // format imposé
      "Authorization": `Basic ${basic}`,                     // Auth Basic base64(id:secret)
    },
    body: "grant_type=client_credentials", // flow d’app (pas d’utilisateur)
  });

  if (!res.ok) {                            // si Spotify renvoie une erreur HTTP
    const txt = await res.text();           // on lit le texte d’erreur pour debug
    throw new Error(`Erreur token: ${res.status} ${txt}`); // on jette une erreur
  }

  const data = await res.json();            // parse JSON { access_token, expires_in, ... }
  cachedToken = data.access_token;          // stocke le token
  cachedExpiry = Date.now() + (data.expires_in - 60) * 1000; // calcule l’expir (-60s marge)
  return cachedToken;                       // renvoie le token prêt à l’emploi
}

// ===== 5) ROUTE PLAYLIST =====
app.get("/api/playlist/:id", async (req, res) => {  // :id = paramètre dynamique depuis l’URL
  try {
    const playlistId = req.params.id;               // récupère l’ID envoyé par le front
    const token = await getAppToken();              // garantit un token valide

    // 1) Market demandé ? sinon market par défaut (FR)
    let mk = (req.query.market || DEFAULT_MARKET).toUpperCase();
    if (!ALLOWED_MARKETS.has(mk)) mk = DEFAULT_MARKET; // garde FR si invalide

    const url = `https://api.spotify.com/v1/playlists/${playlistId}?market=${mk}`;
    const r = await fetch(url, {                    // appelle Spotify
      headers: { Authorization: `Bearer ${token}` } // auth Bearer avec notre token
    });

    if (!r.ok) {                                    // gère les cas 4xx/5xx
      const msg = await r.text();                   // texte d’erreur
      return res.status(r.status).json({ error: msg }); // propager le code + msg
    }

    const full = await r.json();                    // JSON complet de Spotify

    // On construit un objet "slim" (plus léger) pour le front
    const slim = {
      id: full.id,
      name: full.name,
      description: full.description,
      owner: full.owner?.display_name,
      image: full.images?.[0]?.url || null,
      tracks: (full.tracks?.items || []).map((it, i) => ({
        index: i + 1,
        name: it.track?.name,
        artist: it.track?.artists?.map(a => a.name).join(", "),
        duration_ms: it.track?.duration_ms,
        preview_url: it.track?.preview_url,
        external_url: it.track?.external_urls?.spotify,
        id: it.track?.id,
      })),
    };

    res.json(slim);                                 // renvoie au navigateur
  } catch (e) {
    res.status(500).json({ error: String(e) });     // erreur serveur (try/catch)
  }
});

// ===== 6) ROUTE SANTÉ (ping rapide) =====
app.get("/health", (req, res) => {          // endpoint simple pour tester que le serveur est up
  res.json({ ok: true });                    // renvoie { ok: true }
});

// ===== 7) DÉMARRAGE DU SERVEUR =====
const PORT = process.env.PORT || 5174;       // Render fournira PORT; en local on garde 5174
app.listen(PORT, () => {                      // lance l’écoute HTTP
  console.log(`Delexi proxy up on http://localhost:${PORT}`); // log de confirmation
});

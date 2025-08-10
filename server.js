// ===== 1) IMPORTS =====
import express from "express";              // Framework qui simplifie la création d'un serveur web
import cors from "cors";                    // Middleware qui gère les autorisations entre origines (CORS)
import "dotenv/config";                     // Charge automatiquement les variables du fichier .env
import fetch from "node-fetch";             // Permet d'utiliser fetch dans Node.js (comme dans un navigateur)


// ===== 2) CRÉATION DE L'APPLICATION =====
const app = express();                      // Initialise l'application Express (notre serveur)
app.use(cors());                            // Active CORS pour autoriser toutes les origines (on filtrera plus tard si besoin)


// ===== 3) VARIABLES POUR LE CACHE DU TOKEN =====
let cachedToken = null;                     // Stockera le token Spotify actuel
let cachedExpiry = 0;                        // Stockera la date/heure d'expiration du token (en ms)


// ===== 4) FONCTION POUR RÉCUPÉRER UN TOKEN D'APPLICATION =====
async function getAppToken() {
  const now = Date.now();                   // Heure actuelle en ms

  // Si on a déjà un token valide, on le réutilise
  if (cachedToken && now < cachedExpiry) {
    return cachedToken;
  }

  // Sinon, on demande un nouveau token à Spotify
  const tokenUrl = "https://accounts.spotify.com/api/token";
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  // Encodage en Base64 de "clientId:clientSecret" (exigé par Spotify)
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  // Requête POST vers l'API Spotify pour obtenir un token
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basic}`,  // Authentification avec le couple id:secret
    },
    body: "grant_type=client_credentials", // On demande un token "application" (pas lié à un utilisateur)
  });

  // Si Spotify renvoie une erreur
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Erreur lors de la récupération du token : ${res.status} ${txt}`);
  }

  // Lecture de la réponse JSON
  const data = await res.json();

  // On met le token et son expiration en cache (-60s de marge pour éviter les expirations pile au mauvais moment)
  cachedToken = data.access_token;
  cachedExpiry = Date.now() + (data.expires_in - 60) * 1000;

  return cachedToken; // On renvoie le token valide
}


// ===== 5) ROUTE POUR RÉCUPÉRER LES DÉTAILS D'UNE PLAYLIST =====
app.get("/api/playlist/:id", async (req, res) => {
  try {
    const playlistId = req.params.id;       // On lit l'ID de la playlist dans l'URL
    const token = await getAppToken();      // On obtient un token valide

    // Appel de l'API Spotify pour cette playlist
    const url = `https://api.spotify.com/v1/playlists/${playlistId}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {                            // Si Spotify renvoie une erreur (playlist inexistante, privée, etc.)
      const msg = await r.text();
      return res.status(r.status).json({ error: msg });
    }

    const full = await r.json();            // Lecture de la réponse complète

    // On crée une version simplifiée pour le front
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
      })),
    };

    res.json(slim);                         // On renvoie l'objet simplifié
  } catch (e) {
    res.status(500).json({ error: String(e) }); // Erreur serveur
  }
});


//

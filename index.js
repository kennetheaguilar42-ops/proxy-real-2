import express from 'express';
import fetch from 'node-fetch';
import LRUCache from 'lru-cache';
import pLimit from 'p-limit';

const app = express();
const PORT = process.env.PORT || 3000;
const limit = pLimit(4);

const cache = new LRUCache({
    max: 500,
    ttl: 1000 * 60 * 5
});

async function fetchJSON(url) {
    try {
        const cached = cache.get(url);
        if (cached) return cached;

        const res = await fetch(url, { timeout: 8000 });
        const data = await res.json();
        cache.set(url, data);
        return data;
    } catch {
        return null;
    }
}

app.get('/api/user/:userid/items', async (req, res) => {
    const userId = req.params.userid;

    const urlGames = `https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&limit=50&sortOrder=Asc`;
    const gamesData = await fetchJSON(urlGames);

    if (!gamesData || !gamesData.data) {
        return res.json({ error: true, items: [] });
    }

    const passes = [];

    await Promise.all(
        gamesData.data.map(game =>
            limit(async () => {
                const urlPasses = `https://games.roblox.com/v1/games/${game.id}/game-passes?limit=100&sortOrder=Asc`;
                const data = await fetchJSON(urlPasses);
                if (data && data.data) passes.push(...data.data);
            })
        )
    );

    res.json({
        error: false,
        items: passes
    });
});

app.listen(PORT, () => {
    console.log("Backend running on port " + PORT);
});

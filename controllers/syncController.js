const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { advanceRoundOf32Winners, advanceKnockoutWinners } = require('../services/knockoutBracket');
const { fetchESPNMatches, syncMatches } = require('../services/espnSync');

// Configurações do Banco
const MONGO_URI = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/worldcup2026';
const MATCH_COLLECTION = process.env.MATCH_COLLECTION || 'games';
// Using ESPN Sync service for robust data processing.

// Rota de Sincronização
router.get('/sync-live-games', async (req, res) => {
    const { secret } = req.query;
    const SYNC_SECRET = process.env.SYNC_SECRET || 'fallback_secret_token_123';
    
    if (secret !== SYNC_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret token' });
    }

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db();
        const rangeStr = req.query.range || "today";
        let dates = "";
        if (rangeStr === "all") {
            dates = "20260611-20260720";
        } else {
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0].replace(/-/g, '');
            const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0].replace(/-/g, '');
            dates = `${yesterday}-${tomorrow}`;
        }
        
        const events = await fetchESPNMatches(dates);
        const updatedCount = await syncMatches(events, db, MATCH_COLLECTION);
        await advanceKnockoutWinners(db, MATCH_COLLECTION);
        
        return res.status(200).json({ 
            success: true, 
            message: `Sync completed. ${updatedCount} matches updated.`,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error executing live sync:', err);
        return res.status(500).json({ error: 'Sync failed', details: err.message });
    } finally {
        await client.close();
    }
});

module.exports = app => app.use('/api', router);

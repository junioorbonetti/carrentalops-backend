/**
 * tracking.js
 * Endpoints de posição GPS por veículo — live, histórico e relay via vehicleId
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authenticateToken = require('../middleware/auth');
const { sendCommand, isOnline } = require('../services/gpsServer');

// ─── Última posição de um veículo ────────────────────────────────────────────
router.get('/vehicles/:id/live', authenticateToken, async (req, res) => {
  try {
    const tracker = await prisma.tracker.findUnique({
      where: { vehicleId: parseInt(req.params.id) }
    });
    if (!tracker) return res.status(404).json({ error: 'Nenhum tracker vinculado a este veículo' });

    const last = await prisma.vehicleLocation.findFirst({
      where: { trackerId: tracker.id },
      orderBy: { timestamp: 'desc' }
    });

    res.json({
      trackerId: tracker.id,
      online: isOnline(tracker.id),
      location: last || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Histórico de posições de um veículo ─────────────────────────────────────
// Query params: from (ISO date), to (ISO date), limit (default 500)
router.get('/vehicles/:id/history', authenticateToken, async (req, res) => {
  const { from, to, limit = 500 } = req.query;
  try {
    const tracker = await prisma.tracker.findUnique({
      where: { vehicleId: parseInt(req.params.id) }
    });
    if (!tracker) return res.status(404).json({ error: 'Nenhum tracker vinculado a este veículo' });

    const locations = await prisma.vehicleLocation.findMany({
      where: {
        trackerId: tracker.id,
        timestamp: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined
        }
      },
      orderBy: { timestamp: 'asc' },
      take: Math.min(parseInt(limit), 2000)
    });

    res.json({ trackerId: tracker.id, count: locations.length, locations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Relay via vehicleId (atalho) ─────────────────────────────────────────────
// Body: { action: "cut" | "release" }
router.post('/vehicles/:id/relay', authenticateToken, async (req, res) => {
  const { action } = req.body;
  if (!['cut', 'release'].includes(action)) {
    return res.status(400).json({ error: 'action deve ser "cut" ou "release"' });
  }

  try {
    const tracker = await prisma.tracker.findUnique({
      where: { vehicleId: parseInt(req.params.id) }
    });
    if (!tracker) return res.status(404).json({ error: 'Nenhum tracker vinculado a este veículo' });
    if (!isOnline(tracker.id)) {
      return res.status(503).json({ error: 'Dispositivo offline' });
    }

    const command = action === 'cut' ? 'RELAY,1#' : 'RELAY,0#';
    sendCommand(tracker.id, command);

    await prisma.trackerCommand.create({
      data: { trackerId: tracker.id, command, action, sentBy: req.user.id }
    });

    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Live de todos os veículos com tracker ────────────────────────────────────
router.get('/fleet', authenticateToken, async (req, res) => {
  try {
    const trackers = await prisma.tracker.findMany({
      where: { active: true, vehicleId: { not: null } },
      include: {
        vehicle: { select: { id: true, plate: true, brand: true, model: true, color: true, status: true } },
        locations: { orderBy: { timestamp: 'desc' }, take: 1 }
      }
    });

    const fleet = trackers.map(t => ({
      trackerId: t.id,
      online: isOnline(t.id),
      vehicle: t.vehicle,
      lastLocation: t.locations[0] || null,
      lastSeen: t.lastSeen
    }));

    res.json(fleet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

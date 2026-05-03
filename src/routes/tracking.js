const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authenticateToken = require('../middleware/auth');
const { getDevices, getAllPositions, getHistory } = require('../services/traccar');

// Última posição de um veículo
router.get('/vehicles/:id/live', authenticateToken, async (req, res) => {
  try {
    const tracker = await prisma.tracker.findUnique({
      where: { vehicleId: parseInt(req.params.id) }
    });
    if (!tracker) return res.status(404).json({ error: 'Nenhum tracker vinculado' });

    const positions = await getAllPositions();
    const devices = await getDevices();
    const device = devices.find(d => d.uniqueId === tracker.id);
    if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado no Traccar' });

    const position = positions.find(p => p.deviceId === device.id);

    res.json({
      trackerId: tracker.id,
      online: device.status === 'online',
      lastUpdate: device.lastUpdate,
      location: position ? {
        lat: position.latitude,
        lng: position.longitude,
        speed: position.speed,
        ignition: position.attributes?.ignition || false,
        timestamp: position.fixTime
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Histórico de posições
router.get('/vehicles/:id/history', authenticateToken, async (req, res) => {
  const { from, to } = req.query;
  try {
    const tracker = await prisma.tracker.findUnique({
      where: { vehicleId: parseInt(req.params.id) }
    });
    if (!tracker) return res.status(404).json({ error: 'Nenhum tracker vinculado' });

    const devices = await getDevices();
    const device = devices.find(d => d.uniqueId === tracker.id);
    if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado no Traccar' });

    const positions = await getHistory(device.id, from, to);
    const locations = positions.map(p => ({
      lat: p.latitude,
      lng: p.longitude,
      speed: p.speed,
      ignition: p.attributes?.ignition || false,
      timestamp: p.fixTime
    }));

    res.json({ trackerId: tracker.id, count: locations.length, locations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Relay via vehicleId
router.post('/vehicles/:id/relay', authenticateToken, async (req, res) => {
  res.status(503).json({ error: 'Relay via Traccar ainda não implementado' });
});

// Fleet — posição de toda a frota
router.get('/fleet', authenticateToken, async (req, res) => {
  try {
    const trackers = await prisma.tracker.findMany({
      where: {
        active: true,
        NOT: { vehicleId: null }
      },
      include: {
        vehicle: { select: { id: true, plate: true, brand: true, model: true, color: true, status: true } }
      }
    });

    const devices = await getDevices();
    const positions = await getAllPositions();

    const fleet = trackers.map(tracker => {
      const device = devices.find(d => d.uniqueId === tracker.id);
      const position = device ? positions.find(p => p.deviceId === device.id) : null;

      return {
        trackerId: tracker.id,
        online: device?.status === 'online',
        lastSeen: device?.lastUpdate,
        vehicle: tracker.vehicle,
        lastLocation: position ? {
          lat: position.latitude,
          lng: position.longitude,
          speed: position.speed,
          ignition: position.attributes?.ignition || false,
          timestamp: position.fixTime
        } : null
      };
    });

    res.json(fleet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
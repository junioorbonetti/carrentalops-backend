const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authenticateToken = require('../middleware/auth');
const {
  getDevices,
  createTraccarDevice,
  deleteTraccarDevice,
  sendCommand
} = require('../services/traccar');

// Listar todos os trackers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const trackers = await prisma.tracker.findMany({
      include: {
        vehicle: { select: { id: true, brand: true, model: true, year: true, plate: true, color: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const devices = await getDevices();

    const result = trackers.map(t => {
      const device = devices.find(d => d.uniqueId === t.id);
      return {
        ...t,
        online: device?.status === 'online',
        lastSeen: device?.lastUpdate || t.lastSeen,
        traccarId: device?.id || null
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastrar novo tracker
router.post('/', authenticateToken, async (req, res) => {
  const { imei, label, simNumber } = req.body;

  if (!imei || imei.trim().length < 10) {
    return res.status(400).json({ error: 'IMEI inválido' });
  }

  try {
    const tracker = await prisma.tracker.create({
      data: {
        id: imei.trim(),
        label: label || null,
        simNumber: simNumber || null,
        active: false
      }
    });

    try {
      await createTraccarDevice(imei.trim(), label || imei.trim());
    } catch (traccarErr) {
      console.warn('Erro ao criar no Traccar:', traccarErr.message);
    }

    res.status(201).json(tracker);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'IMEI já cadastrado no sistema' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Atualizar dados do tracker
router.patch('/:imei', authenticateToken, async (req, res) => {
  const { label, simNumber } = req.body;
  try {
    const tracker = await prisma.tracker.update({
      where: { id: req.params.imei },
      data: { label, simNumber }
    });
    res.json(tracker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vincular tracker a um veículo
router.patch('/:imei/assign', authenticateToken, async (req, res) => {
  const { vehicleId } = req.body;
  if (!vehicleId) return res.status(400).json({ error: 'vehicleId obrigatório' });

  try {
    await prisma.tracker.updateMany({
      where: { vehicleId: parseInt(vehicleId), id: { not: req.params.imei } },
      data: { vehicleId: null, active: false }
    });

    const tracker = await prisma.tracker.update({
      where: { id: req.params.imei },
      data: { vehicleId: parseInt(vehicleId), active: true },
      include: { vehicle: { select: { plate: true, brand: true, model: true } } }
    });
    res.json(tracker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Desvincular tracker de veículo
router.patch('/:imei/unassign', authenticateToken, async (req, res) => {
  try {
    const tracker = await prisma.tracker.update({
      where: { id: req.params.imei },
      data: { vehicleId: null, active: false }
    });
    res.json(tracker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deletar tracker
router.delete('/:imei', authenticateToken, async (req, res) => {
  try {
    try {
      await deleteTraccarDevice(req.params.imei);
    } catch (traccarErr) {
      console.warn('Erro ao remover do Traccar:', traccarErr.message);
    }
    await prisma.tracker.delete({ where: { id: req.params.imei } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cortar / liberar motor
router.post('/:imei/relay', authenticateToken, async (req, res) => {
  const { action } = req.body;
  if (!['cut', 'release'].includes(action)) {
    return res.status(400).json({ error: 'action deve ser "cut" ou "release"' });
  }
  try {
    const result = await sendCommand(req.params.imei, action);

    await prisma.trackerCommand.create({
      data: {
        trackerId: req.params.imei,
        command: action === 'cut' ? 'engineStop' : 'engineResume',
        action,
        sentBy: req.user.id
      }
    });

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Histórico de comandos
router.get('/:imei/commands', authenticateToken, async (req, res) => {
  try {
    const commands = await prisma.trackerCommand.findMany({
      where: { trackerId: req.params.imei },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(commands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
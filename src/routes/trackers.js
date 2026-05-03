/**
 * trackers.js
 * Gerenciamento de dispositivos GPS (cadastro, vínculo com veículo, status)
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authenticateToken = require('../middleware/auth');
const { sendCommand, isOnline } = require('../services/gpsServer');

// ─── Listar todos os trackers ─────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const trackers = await prisma.tracker.findMany({
      include: {
        vehicle: {
          select: { id: true, brand: true, model: true, year: true, plate: true, color: true }
        },
        locations: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const result = trackers.map(t => ({
      ...t,
      online: isOnline(t.id),
      lastLocation: t.locations[0] || null,
      locations: undefined
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Cadastrar novo tracker ───────────────────────────────────────────────────
// Body: { imei, label, simNumber }
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
        active: false // fica inativo até vincular a um veículo
      }
    });
    res.status(201).json(tracker);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'IMEI já cadastrado no sistema' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── Atualizar dados do tracker ───────────────────────────────────────────────
// Body: { label, simNumber }
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

// ─── Vincular tracker a um veículo ────────────────────────────────────────────
// Body: { vehicleId }
router.patch('/:imei/assign', authenticateToken, async (req, res) => {
  const { vehicleId } = req.body;
  if (!vehicleId) return res.status(400).json({ error: 'vehicleId obrigatório' });

  try {
    // Remove vínculo anterior se o veículo já tinha outro tracker
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

// ─── Desvincular tracker de veículo ──────────────────────────────────────────
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

// ─── Deletar tracker ──────────────────────────────────────────────────────────
router.delete('/:imei', authenticateToken, async (req, res) => {
  try {
    await prisma.tracker.delete({ where: { id: req.params.imei } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Controle de relé (cortar / liberar motor) ────────────────────────────────
// Body: { action: "cut" | "release" }
router.post('/:imei/relay', authenticateToken, async (req, res) => {
  const { action } = req.body;
  if (!['cut', 'release'].includes(action)) {
    return res.status(400).json({ error: 'action deve ser "cut" ou "release"' });
  }

  try {
    const tracker = await prisma.tracker.findUnique({ where: { id: req.params.imei } });
    if (!tracker) return res.status(404).json({ error: 'Tracker não encontrado' });
    if (!isOnline(req.params.imei)) {
      return res.status(503).json({ error: 'Dispositivo offline — comando não enviado' });
    }

    // Comando J16: RELAY,1# = corta motor | RELAY,0# = libera motor
    const command = action === 'cut' ? 'RELAY,1#' : 'RELAY,0#';
    sendCommand(req.params.imei, command);

    // Loga no banco
    await prisma.trackerCommand.create({
      data: {
        trackerId: req.params.imei,
        command,
        action,
        sentBy: req.user.id
      }
    });

    res.json({ success: true, action, command });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Histórico de comandos enviados ──────────────────────────────────────────
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

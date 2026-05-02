const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/maintenance
router.get('/', auth, async (req, res) => {
  try {
    const { vehicleId, status } = req.query;
    const where = {};
    if (vehicleId) where.vehicleId = Number(vehicleId);
    if (status) where.status = status;

    const records = await prisma.maintenance.findMany({
      where,
      include: { vehicle: true },
      orderBy: { date: 'desc' },
    });
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/maintenance
router.post('/', auth, async (req, res) => {
  try {
    const { vehicleId, type, date, mileage, cost, status, shop, notes, nextMaintenanceDate, nextMileage } = req.body;
    if (!vehicleId || !type || !date)
      return res.status(400).json({ error: 'Missing required fields' });

    const record = await prisma.maintenance.create({
      data: {
        vehicleId: Number(vehicleId),
        type,
        date: new Date(date),
        mileage: mileage ? Number(mileage) : null,
        cost: Number(cost) || 0,
        status: status || 'pending',
        shop,
        notes,
        nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : null,
        nextMileage: nextMileage ? Number(nextMileage) : null,
      },
      include: { vehicle: true },
    });

    // if status is in_progress, update vehicle status
    if (status === 'in_progress') {
      await prisma.vehicle.update({
        where: { id: Number(vehicleId) },
        data: { status: 'maintenance' },
      });
    }

    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/maintenance/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { type, date, mileage, cost, status, shop, notes, nextMaintenanceDate, nextMileage } = req.body;

    const record = await prisma.maintenance.update({
      where: { id: Number(req.params.id) },
      data: {
        type, shop, notes, status,
        date: date ? new Date(date) : undefined,
        mileage: mileage ? Number(mileage) : undefined,
        cost: cost ? Number(cost) : undefined,
        nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : undefined,
        nextMileage: nextMileage ? Number(nextMileage) : undefined,
      },
      include: { vehicle: true },
    });

    // if completed, set vehicle back to available
    if (status === 'completed') {
      await prisma.vehicle.update({
        where: { id: record.vehicleId },
        data: { status: 'available' },
      });
    }

    res.json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/maintenance/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.maintenance.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Record deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

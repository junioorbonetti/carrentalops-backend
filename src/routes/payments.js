const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/payments
router.get('/', auth, async (req, res) => {
  try {
    const { customerId, vehicleId, rentalId, status } = req.query;
    const where = {};
    if (customerId) where.customerId = Number(customerId);
    if (vehicleId) where.vehicleId = Number(vehicleId);
    if (rentalId) where.rentalId = Number(rentalId);
    if (status) where.status = status;

    const payments = await prisma.payment.findMany({
      where,
      include: { customer: true, vehicle: true, rental: true },
      orderBy: { paidAt: 'desc' },
    });
    res.json(payments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/payments
router.post('/', auth, async (req, res) => {
  try {
    const { rentalId, customerId, vehicleId, amount, method, type, status, notes, paidAt } = req.body;
    if (!customerId || !amount || !method || !type)
      return res.status(400).json({ error: 'Missing required fields' });

    const payment = await prisma.payment.create({
      data: {
        rentalId: rentalId ? Number(rentalId) : null,
        customerId: Number(customerId),
        vehicleId: vehicleId ? Number(vehicleId) : null,
        amount: Number(amount),
        method,
        type,
        status: status || 'paid',
        notes,
        paidAt: paidAt ? new Date(paidAt + "T12:00:00.000Z") : new Date(),
      },
      include: { customer: true, vehicle: true },
    });
    res.status(201).json(payment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/payments/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { amount, method, type, status, notes, paidAt } = req.body;
    const payment = await prisma.payment.update({
      where: { id: Number(req.params.id) },
      data: {
        amount: amount ? Number(amount) : undefined,
        method, type, status, notes,
        paidAt: paidAt ? new Date(paidAt + "T12:00:00.000Z") : undefined,
      },
    });
    res.json(payment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/payments/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.payment.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Payment deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

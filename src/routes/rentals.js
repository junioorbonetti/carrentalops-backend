const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/rentals
router.get('/', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};
    const rentals = await prisma.rental.findMany({
      where,
      include: { customer: true, vehicle: true },
      orderBy: { createdAt: 'desc' },
    });

    // auto-mark late rentals
    const now = new Date();
    const updated = rentals.map(r => {
      if (r.status === 'active' && r.expectedReturn && new Date(r.expectedReturn) < now) {
        return { ...r, status: 'late' };
      }
      return r;
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/rentals/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const rental = await prisma.rental.findUnique({
      where: { id: Number(req.params.id) },
      include: { customer: true, vehicle: true, payments: true },
    });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });

    const totalPaid = rental.payments
      .filter(p => p.status === 'paid' && p.type !== 'deposit')
      .reduce((sum, p) => sum + p.amount, 0);

    const depositPaid = rental.payments
      .filter(p => p.status === 'paid' && p.type === 'deposit')
      .reduce((sum, p) => sum + p.amount, 0);

    const days = rental.expectedReturn
      ? Math.ceil((new Date(rental.expectedReturn) - new Date(rental.startDate)) / (1000 * 60 * 60 * 24))
      : Math.ceil((new Date() - new Date(rental.startDate)) / (1000 * 60 * 60 * 24));
    const totalDue = (days / 7) * rental.weeklyRate;
    const pendingBalance = totalDue - totalPaid;

    res.json({ ...rental, totalDue, totalPaid, pendingBalance, depositPaid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/rentals
router.post('/', auth, async (req, res) => {
  try {
    const { customerId, vehicleId, startDate, expectedReturn, weeklyRate, deposit, notes } = req.body;
    if (!customerId || !vehicleId || !startDate || !weeklyRate)
      return res.status(400).json({ error: 'Missing required fields' });

    const vehicle = await prisma.vehicle.findUnique({ where: { id: Number(vehicleId) } });
    if (!vehicle || vehicle.status !== 'available')
      return res.status(400).json({ error: 'Vehicle not available' });

    const [rental] = await prisma.$transaction([
      prisma.rental.create({
        data: {
          customerId: Number(customerId),
          vehicleId: Number(vehicleId),
          startDate: new Date(startDate),
          expectedReturn: expectedReturn ? new Date(expectedReturn) : null,
          weeklyRate: Number(weeklyRate),
          deposit: Number(deposit) || 0,
          notes,
        },
        include: { customer: true, vehicle: true },
      }),
      prisma.vehicle.update({
        where: { id: Number(vehicleId) },
        data: { status: 'rented' },
      }),
    ]);

    // auto-create deposit payment if deposit > 0
    if (Number(deposit) > 0) {
      await prisma.payment.create({
        data: {
          rentalId: rental.id,
          customerId: Number(customerId),
          vehicleId: Number(vehicleId),
          amount: Number(deposit),
          method: 'other',
          type: 'deposit',
          status: 'pending',
          notes: 'Security deposit',
        },
      });
    }

    res.status(201).json(rental);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/rentals/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, actualReturn, expectedReturn, notes, startDate, weeklyRate, deposit } = req.body;
    const rental = await prisma.rental.findUnique({ where: { id: Number(req.params.id) } });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });

    const data = { notes };
    data.expectedReturn = expectedReturn ? new Date(expectedReturn) : null;
    if (status) data.status = status;
    if (actualReturn) data.actualReturn = new Date(actualReturn);
    if (startDate) data.startDate = new Date(startDate);
    if (weeklyRate !== undefined) data.weeklyRate = Number(weeklyRate);
    if (deposit !== undefined) data.deposit = Number(deposit);

    const updated = await prisma.rental.update({
      where: { id: Number(req.params.id) },
      data,
      include: { vehicle: true },
    });

    // when finished, set vehicle back to available
    if (status === 'finished' || status === 'cancelled') {
      await prisma.vehicle.update({
        where: { id: rental.vehicleId },
        data: { status: 'available' },
      });
    }

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

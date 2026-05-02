const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// GET /api/weekly-payments - returns active rentals grouped by payment day
router.get('/', auth, async (req, res) => {
  try {
    const today = new Date();
    const todayName = DAYS[today.getDay()];

    const rentals = await prisma.rental.findMany({
      where: { status: 'active', paymentDay: { not: null } },
      include: { customer: true, vehicle: true, payments: { orderBy: { paidAt: 'desc' }, take: 10 } },
      orderBy: { paymentDay: 'asc' },
    });

    // For each rental, check if this week's payment was already made
    const result = rentals.map(r => {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const paidThisWeek = r.payments.some(p =>
        p.status === 'paid' &&
        p.type === 'rental' &&
        new Date(p.paidAt) >= startOfWeek
      );

      return {
        id: r.id,
        customerId: r.customerId,
        vehicleId: r.vehicleId,
        customerName: r.customer.fullName,
        customerPhone: r.customer.phone,
        vehicle: `${r.vehicle.brand} ${r.vehicle.model} (${r.vehicle.plate})`,
        paymentDay: r.paymentDay,
        weeklyRate: r.weeklyRate,
        isToday: r.paymentDay === todayName,
        paidThisWeek,
      };
    });

    // Group by day
    const grouped = {};
    DAYS.forEach(d => { grouped[d] = []; });
    result.forEach(r => {
      if (grouped[r.paymentDay]) grouped[r.paymentDay].push(r);
    });

    // Only return days that have rentals
    const filtered = Object.entries(grouped)
      .filter(([, rentals]) => rentals.length > 0)
      .map(([day, rentals]) => ({ day, rentals, isToday: day === todayName }));

    res.json({ today: todayName, schedule: filtered });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/weekly-payments/mark-paid - mark this week's payment as paid
router.post('/mark-paid', auth, async (req, res) => {
  try {
    const { rentalId, customerId, vehicleId, amount, method } = req.body;

    const payment = await prisma.payment.create({
      data: {
        rentalId: Number(rentalId),
        customerId: Number(customerId),
        vehicleId: Number(vehicleId),
        amount: Number(amount),
        method: method || 'cash',
        type: 'rental',
        status: 'paid',
        paidAt: new Date(),
      },
    });

    res.json(payment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

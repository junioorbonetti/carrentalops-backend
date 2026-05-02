const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/reports/revenue-by-month
router.get('/revenue-by-month', auth, async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { status: 'paid' },
      select: { amount: true, paidAt: true, type: true },
    });

    const grouped = {};
    payments.forEach(p => {
      const key = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = 0;
      grouped[key] += p.amount;
    });

    const result = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reports/revenue-by-vehicle
router.get('/revenue-by-vehicle', auth, async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      include: { payments: true, maintenances: true },
    });

    const result = vehicles.map(v => {
      const revenue = v.payments
        .filter(p => p.status === 'paid' && p.type !== 'deposit')
        .reduce((sum, p) => sum + p.amount, 0);
      const costs = v.maintenances.reduce((sum, m) => sum + m.cost, 0);
      return {
        id: v.id,
        label: `${v.brand} ${v.model} (${v.plate})`,
        revenue,
        costs,
        profit: revenue - costs,
      };
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reports/pending-customers
router.get('/pending-customers', auth, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        payments: { where: { status: { in: ['pending', 'late'] } } },
      },
    });

    const result = customers
      .map(c => ({
        id: c.id,
        name: c.fullName,
        phone: c.phone,
        pendingAmount: c.payments.reduce((sum, p) => sum + p.amount, 0),
        pendingCount: c.payments.length,
      }))
      .filter(c => c.pendingCount > 0)
      .sort((a, b) => b.pendingAmount - a.pendingAmount);

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

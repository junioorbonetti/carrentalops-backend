const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/revenue-by-vehicle', auth, async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({ include: { payments: true, maintenances: true } });
    const result = vehicles.map(v => {
      const revenue = v.payments.filter(p => p.status === 'paid' && p.type !== 'deposit').reduce((s, p) => s + p.amount, 0);
      const costs = v.maintenances.reduce((s, m) => s + m.cost, 0);
      return { id: v.id, label: `${v.brand} ${v.model} (${v.plate})`, revenue, costs, profit: revenue - costs };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pending-customers', auth, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      include: { payments: { where: { status: { in: ['pending', 'late'] } } } },
    });
    const result = customers
      .map(c => ({ id: c.id, name: c.fullName, phone: c.phone, pendingAmount: c.payments.reduce((s, p) => s + p.amount, 0), pendingCount: c.payments.length }))
      .filter(c => c.pendingCount > 0)
      .sort((a, b) => b.pendingAmount - a.pendingAmount);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/monthly', auth, async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const payments = await prisma.payment.findMany({
      where: { paidAt: { gte: start, lt: end } },
      include: { customer: true },
      orderBy: { paidAt: 'desc' },
    });
    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
    const totalPending = payments.filter(p => p.status !== 'paid').reduce((s, p) => s + p.amount, 0);
    res.json({ totalRevenue, totalPaid, totalPending, paymentCount: payments.length, payments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/range', auth, async (req, res) => {
  try {
    const start = req.query.start ? new Date(req.query.start) : new Date();
    const end = req.query.end ? new Date(req.query.end) : new Date();
    end.setHours(23, 59, 59, 999);
    const payments = await prisma.payment.findMany({
      where: { paidAt: { gte: start, lte: end } },
      include: { customer: true, vehicle: true },
      orderBy: { paidAt: 'desc' },
    });
    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
    const totalPending = payments.filter(p => p.status !== 'paid').reduce((s, p) => s + p.amount, 0);
    res.json({ totalRevenue, totalPaid, totalPending, paymentCount: payments.length, payments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
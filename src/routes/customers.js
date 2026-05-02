const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/customers
router.get('/', auth, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { fullName: 'asc' } });
    res.json(customers);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/customers/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        rentals: { include: { vehicle: true }, orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/customers
router.post('/', auth, async (req, res) => {
  try {
    const { fullName, phone, email, address, licenseNumber, licenseExpiry, notes } = req.body;

    const customer = await prisma.customer.create({
      data: { fullName, phone, email, address, licenseNumber, licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null, notes },
    });
    res.status(201).json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { fullName, phone, email, address, licenseNumber, licenseExpiry, notes } = req.body;
    const customer = await prisma.customer.update({
      where: { id: Number(req.params.id) },
      data: {
        fullName, phone, email, address, licenseNumber, notes,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
      },
    });
    res.json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.customer.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Customer deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

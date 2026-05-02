const express = require('express');
const multer = require('multer');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// GET /api/vehicles
router.get('/', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};
    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(vehicles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/vehicles/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        rentals: { include: { customer: true }, orderBy: { createdAt: 'desc' } },
        maintenances: { orderBy: { date: 'desc' } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/vehicles
router.post('/', auth, upload.single('photo'), async (req, res) => {
  try {
    const { brand, model, year, plate, vin, color, mileage, weeklyRate, notes } = req.body;

    const vehicle = await prisma.vehicle.create({
      data: {
        brand,
        model,
        year: Number(year),
        plate,
        vin,
        color,
        mileage: Number(mileage) || 0,
        weeklyRate: Number(weeklyRate),
        notes,
        photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
      },
    });
    res.status(201).json(vehicle);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Plate already registered' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/vehicles/:id
router.put('/:id', auth, upload.single('photo'), async (req, res) => {
  try {
    const { brand, model, year, plate, vin, color, status, mileage, weeklyRate, notes } = req.body;
    const data = {
      brand, model, plate, vin, color, status, notes,
      year: year ? Number(year) : undefined,
      mileage: mileage ? Number(mileage) : undefined,
      weeklyRate: weeklyRate ? Number(weeklyRate) : undefined,
    };
    if (req.file) data.photoUrl = `/uploads/${req.file.filename}`;

    const vehicle = await prisma.vehicle.update({
      where: { id: Number(req.params.id) },
      data,
    });
    res.json(vehicle);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/vehicles/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.vehicle.update({
      where: { id: Number(req.params.id) },
      data: { status: 'inactive' },
    });
    res.json({ message: 'Vehicle deactivated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/public/vehicles — carros disponíveis (sem auth)
router.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { status: 'available' },
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        color: true,
        weeklyRate: true,
        photoUrl: true,
        notes: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(vehicles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/dashboard
router.get('/', auth, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalVehicles,
      availableVehicles,
      rentedVehicles,
      maintenanceVehicles,
      activeRentals,
      lateRentals,
      pendingPayments,
      monthPayments,
      pendingMaintenance,
      overdueMaintenance,
      expiringDocs,
    ] = await Promise.all([
      prisma.vehicle.count({ where: { status: { not: 'inactive' } } }),
      prisma.vehicle.count({ where: { status: 'available' } }),
      prisma.vehicle.count({ where: { status: 'rented' } }),
      prisma.vehicle.count({ where: { status: 'maintenance' } }),
      prisma.rental.count({ where: { status: 'active' } }),
      prisma.rental.count({ where: { status: 'active', expectedReturn: { lt: now } } }),
      prisma.payment.findMany({ where: { status: 'pending' }, include: { customer: true, vehicle: true } }),
      prisma.payment.findMany({ where: { status: 'paid', paidAt: { gte: startOfMonth } } }),
      prisma.maintenance.count({ where: { status: { in: ['pending', 'in_progress'] } } }),
      prisma.maintenance.count({
        where: {
          status: { not: 'completed' },
          nextMaintenanceDate: { lt: now },
        },
      }),
      prisma.vehicle.findMany({
        where: {
          docExpiry: {
            gte: now,
            lte: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
          },
          status: { not: 'inactive' },
        },
        select: { id: true, brand: true, model: true, plate: true, docExpiry: true },
      }),
    ]);

    const monthRevenue = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      totalVehicles,
      availableVehicles,
      rentedVehicles,
      maintenanceVehicles,
      activeRentals,
      lateRentals,
      pendingPayments: pendingPayments.length,
      pendingAmount,
      pendingPaymentsList: pendingPayments.slice(0, 5),
      monthRevenue,
      pendingMaintenance,
      overdueMaintenance,
      expiringDocs,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

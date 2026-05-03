const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { sendLeadConfirmation } = require('../services/email');
const router = express.Router();
const prisma = new PrismaClient();

router.post('/', async (req, res) => {
  try {
    const { fullName, email, phone, licenseNumber, hasWhatsapp, whatsappNumber, vehicleId } = req.body;
    if (!fullName || !email || !phone || !licenseNumber || !vehicleId) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
    }
    const vehicle = await prisma.vehicle.findUnique({ where: { id: Number(vehicleId) } });
    if (!vehicle) return res.status(404).json({ error: 'Veículo não encontrado.' });
    if (vehicle.status !== 'available') return res.status(409).json({ error: 'Este veículo não está disponível.' });

    const lead = await prisma.leadRequest.create({
      data: {
        fullName,
        email,
        phone,
        licenseNumber,
        hasWhatsapp: hasWhatsapp === true || hasWhatsapp === 'true',
        whatsappNumber: whatsappNumber || null,
        vehicleId: Number(vehicleId),
      },
      include: { vehicle: true },
    });

    sendLeadConfirmation(lead, lead.vehicle).catch(err =>
      console.error('Erro ao enviar email de confirmação:', err)
    );
    res.status(201).json(lead);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const leads = await prisma.leadRequest.findMany({
      where: status ? { status } : {},
      include: { vehicle: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(leads);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const lead = await prisma.leadRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: { vehicle: true },
    });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
    res.json(lead);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const lead = await prisma.leadRequest.update({
      where: { id: Number(req.params.id) },
      data: { status, notes },
    });
    res.json(lead);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/convert', auth, async (req, res) => {
  try {
    const lead = await prisma.leadRequest.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });

    const customer = await prisma.customer.create({
      data: {
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        licenseNumber: lead.licenseNumber,
        hasWhatsapp: lead.hasWhatsapp,
        whatsappNumber: lead.whatsappNumber,
      },
    });

    await prisma.leadRequest.update({
      where: { id: lead.id },
      data: { status: 'converted', convertedToId: customer.id },
    });

    res.status(201).json({ customer, leadId: lead.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
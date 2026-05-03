const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./src/routes/auth');
const vehicleRoutes = require('./src/routes/vehicles');
const customerRoutes = require('./src/routes/customers');
const rentalRoutes = require('./src/routes/rentals');
const paymentRoutes = require('./src/routes/payments');
const maintenanceRoutes = require('./src/routes/maintenance');
const dashboardRoutes = require('./src/routes/dashboard');
const reportRoutes = require('./src/routes/reports');
const weeklyPaymentRoutes = require('./src/routes/weeklyPayments');
const trackingRoutes = require('./src/routes/tracking');
const trackerRoutes  = require('./src/routes/trackers');
const { server: gpsServer } = require('./src/services/gpsServer');

const app = express();
const PORT = process.env.PORT || 3001;
const GPS_PORT = process.env.GPS_PORT || 8821;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/weekly-payments', weeklyPaymentRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/trackers',  trackerRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`CarRentalOps backend running on port ${PORT}`);
});

gpsServer.listen(GPS_PORT, '0.0.0.0', () => {
  console.log(`GPS TCP server listening on port ${GPS_PORT}`);
});
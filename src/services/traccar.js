const axios = require('axios');

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://209.38.73.192:8082';
const TRACCAR_USER = process.env.TRACCAR_USER;
const TRACCAR_PASS = process.env.TRACCAR_PASS;

const traccar = axios.create({
  baseURL: TRACCAR_URL,
  auth: { username: TRACCAR_USER, password: TRACCAR_PASS }
});

async function getDevices() {
  const { data } = await traccar.get('/api/devices');
  return data;
}

async function getPosition(positionId) {
  const { data } = await traccar.get(`/api/positions?id=${positionId}`);
  return data[0] || null;
}

async function getAllPositions() {
  const { data } = await traccar.get('/api/positions');
  return data;
}

async function getHistory(deviceId, from, to) {
  const { data } = await traccar.get('/api/positions', {
    params: {
      deviceId,
      from: from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      to: to || new Date().toISOString()
    }
  });
  return data;
}

async function createTraccarDevice(imei, name) {
  const { data } = await traccar.post('/api/devices', {
    name: name,
    uniqueId: imei
  });
  return data;
}

async function deleteTraccarDevice(imei) {
  const devices = await getDevices();
  const device = devices.find(d => d.uniqueId === imei);
  if (device) {
    await traccar.delete(`/api/devices/${device.id}`);
  }
}

async function sendCommand(imei, action) {
  const devices = await getDevices();
  const device = devices.find(d => d.uniqueId === imei);
  if (!device) throw new Error('Dispositivo não encontrado no Traccar');
  if (device.status !== 'online') throw new Error('Dispositivo offline — comando não enviado');

  const type = action === 'cut' ? 'engineStop' : 'engineResume';
  const { data } = await traccar.post('/api/commands/send', {
    deviceId: device.id,
    type,
    attributes: {}
  });
  return data;
}

module.exports = {
  getDevices,
  getPosition,
  getAllPositions,
  getHistory,
  createTraccarDevice,
  deleteTraccarDevice,
  sendCommand
};
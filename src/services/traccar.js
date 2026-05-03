const axios = require('axios');

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://209.38.73.192:8082';
const TRACCAR_USER = process.env.TRACCAR_USER;
const TRACCAR_PASS = process.env.TRACCAR_PASS;

const traccar = axios.create({
  baseURL: TRACCAR_URL,
  auth: { username: TRACCAR_USER, password: TRACCAR_PASS }
});

// Buscar todos os dispositivos com status e posição
async function getDevices() {
  const { data } = await traccar.get('/api/devices');
  return data;
}

// Buscar posição atual de um dispositivo pelo uniqueId (IMEI)
async function getPosition(positionId) {
  const { data } = await traccar.get(`/api/positions?id=${positionId}`);
  return data[0] || null;
}

// Buscar todas as posições atuais
async function getAllPositions() {
  const { data } = await traccar.get('/api/positions');
  return data;
}

// Buscar histórico de posições de um dispositivo
async function getHistory(deviceId, from, to) {
  const { data } = await traccar.get('/api/positions', {
    params: {
      deviceId,
      from: from || new Date(Date.now() - 24*60*60*1000).toISOString(),
      to: to || new Date().toISOString()
    }
  });
  return data;
}

module.exports = { getDevices, getPosition, getAllPositions, getHistory };
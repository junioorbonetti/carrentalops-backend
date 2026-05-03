const axios = require('axios');

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://209.38.73.192:8082';
const TRACCAR_USER = process.env.TRACCAR_USER;
const TRACCAR_PASS = process.env.TRACCAR_PASS;

let sessionCookie = null;

async function getSession() {
  if (sessionCookie) return sessionCookie;
  const resp = await axios.post(`${TRACCAR_URL}/api/session`, 
    `email=${encodeURIComponent(TRACCAR_USER)}&password=${encodeURIComponent(TRACCAR_PASS)}`,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  sessionCookie = resp.headers['set-cookie']?.[0]?.split(';')[0];
  return sessionCookie;
}

async function traccarGet(path) {
  const cookie = await getSession();
  const { data } = await axios.get(`${TRACCAR_URL}${path}`, {
    headers: { Cookie: cookie }
  });
  return data;
}

async function traccarPost(path, body) {
  const cookie = await getSession();
  const { data } = await axios.post(`${TRACCAR_URL}${path}`, body, {
    headers: { Cookie: cookie }
  });
  return data;
}

async function traccarDelete(path) {
  const cookie = await getSession();
  await axios.delete(`${TRACCAR_URL}${path}`, {
    headers: { Cookie: cookie }
  });
}

async function getDevices() {
  return traccarGet('/api/devices');
}

async function getAllPositions() {
  return traccarGet('/api/positions');
}

async function getHistory(deviceId, from, to) {
  const f = from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const t = to || new Date().toISOString();
  return traccarGet(`/api/positions?deviceId=${deviceId}&from=${f}&to=${t}`);
}

async function createTraccarDevice(imei, name) {
  return traccarPost('/api/devices', { name, uniqueId: imei });
}

async function deleteTraccarDevice(imei) {
  const devices = await getDevices();
  const device = devices.find(d => d.uniqueId === imei);
  if (device) await traccarDelete(`/api/devices/${device.id}`);
}

async function sendCommand(imei, action) {
  const devices = await getDevices();
  const device = devices.find(d => d.uniqueId === imei);
  if (!device) throw new Error('Dispositivo não encontrado no Traccar');
  if (device.status !== 'online') throw new Error('Dispositivo offline');
  const type = action === 'cut' ? 'engineStop' : 'engineResume';
  return traccarPost('/api/commands/send', { deviceId: device.id, type, attributes: {} });
}

module.exports = { getDevices, getAllPositions, getHistory, createTraccarDevice, deleteTraccarDevice, sendCommand };
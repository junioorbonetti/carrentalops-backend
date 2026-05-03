const axios = require('axios');

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://209.38.73.192:8082';
const TRACCAR_USER = process.env.TRACCAR_USER;
const TRACCAR_PASS = process.env.TRACCAR_PASS;

let sessionCookie = null;

async function login() {
  const resp = await axios.post(
    `${TRACCAR_URL}/api/session`,
    `email=${encodeURIComponent(TRACCAR_USER)}&password=${encodeURIComponent(TRACCAR_PASS)}`,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  sessionCookie = resp.headers['set-cookie']?.[0]?.split(';')[0];
  return sessionCookie;
}

async function getHeaders() {
  if (!sessionCookie) await login();
  return { Cookie: sessionCookie };
}

async function traccarRequest(method, path, body = null) {
  try {
    const headers = await getHeaders();
    const config = { headers };
    let resp;
    if (method === 'GET') {
      resp = await axios.get(`${TRACCAR_URL}${path}`, config);
    } else if (method === 'POST') {
      resp = await axios.post(`${TRACCAR_URL}${path}`, body, config);
    } else if (method === 'DELETE') {
      resp = await axios.delete(`${TRACCAR_URL}${path}`, config);
    }
    return resp.data;
  } catch (err) {
    // Se deu 401, renova a sessão e tenta de novo
    if (err.response?.status === 401 || err.response?.status === 404) {
      sessionCookie = null;
      const headers = await getHeaders();
      const config = { headers };
      let resp;
      if (method === 'GET') {
        resp = await axios.get(`${TRACCAR_URL}${path}`, config);
      } else if (method === 'POST') {
        resp = await axios.post(`${TRACCAR_URL}${path}`, body, config);
      } else if (method === 'DELETE') {
        resp = await axios.delete(`${TRACCAR_URL}${path}`, config);
      }
      return resp.data;
    }
    throw err;
  }
}

async function getDevices() {
  return traccarRequest('GET', '/api/devices');
}

async function getAllPositions() {
  return traccarRequest('GET', '/api/positions');
}

async function getHistory(deviceId, from, to) {
  const f = from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const t = to || new Date().toISOString();
  return traccarRequest('GET', `/api/positions?deviceId=${deviceId}&from=${f}&to=${t}`);
}

async function createTraccarDevice(imei, name) {
  return traccarRequest('POST', '/api/devices', { name, uniqueId: imei });
}

async function deleteTraccarDevice(imei) {
  const devices = await getDevices();
  const device = devices.find(d => d.uniqueId === imei);
  if (device) await traccarRequest('DELETE', `/api/devices/${device.id}`);
}

async function sendCommand(imei, action) {
  const devices = await getDevices();
  const device = devices.find(d => d.uniqueId === imei);
  if (!device) throw new Error('Dispositivo não encontrado no Traccar');
  if (device.status !== 'online') throw new Error('Dispositivo offline');
  const type = action === 'cut' ? 'engineStop' : 'engineResume';
  return traccarRequest('POST', '/api/commands/send', { deviceId: device.id, type, attributes: {} });
}

module.exports = { getDevices, getAllPositions, getHistory, createTraccarDevice, deleteTraccarDevice, sendCommand };
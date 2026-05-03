/**
 * gpsServer.js
 * Servidor TCP que recebe conexões dos dispositivos J16 (protocolo GT06)
 * Roda paralelo ao Express na porta 8821
 */

const net = require('net');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mapa de sessões ativas: IMEI -> socket
const sessions = new Map();

// ─── Parser do protocolo GT06 ────────────────────────────────────────────────

function parsePacket(data) {
  const hex = data.toString('hex');

  // Pacote inválido
  if (!hex.startsWith('7878') && !hex.startsWith('7979')) return null;

  const type = hex.substring(4, 6);

  // Login (0x01) — dispositivo se identifica com o IMEI
  if (type === '01') {
    const imeiHex = hex.substring(6, 22);
    const imei = hexToImei(imeiHex);
    const serialHex = hex.substring(hex.length - 8, hex.length - 4);
    return { type: 'login', imei, serial: parseInt(serialHex, 16) };
  }

  // Posição GPS (0x22)
  if (type === '22') {
    return parseLocationPacket(hex);
  }

  // Heartbeat (0x23) — manter conexão viva
  if (type === '23') {
    return { type: 'heartbeat' };
  }

  return { type: 'unknown', raw: hex };
}

function hexToImei(hex) {
  // Cada byte hex = 2 dígitos do IMEI
  let imei = '';
  for (let i = 0; i < hex.length; i += 2) {
    imei += parseInt(hex.substring(i, i + 2), 16).toString().padStart(2, '0');
  }
  return imei.substring(0, 15);
}

function parseLocationPacket(hex) {
  try {
    // Offsets conforme spec GT06 para pacote 0x22
    const offset = 6;
    // Data/hora: 6 bytes (YY MM DD HH MM SS)
    const year  = 2000 + parseInt(hex.substring(offset, offset + 2), 16);
    const month = parseInt(hex.substring(offset + 2, offset + 4), 16);
    const day   = parseInt(hex.substring(offset + 4, offset + 6), 16);
    const hour  = parseInt(hex.substring(offset + 6, offset + 8), 16);
    const min   = parseInt(hex.substring(offset + 8, offset + 10), 16);
    const sec   = parseInt(hex.substring(offset + 10, offset + 12), 16);
    const timestamp = new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}Z`);

    // Satélites (1 byte)
    const satellites = parseInt(hex.substring(offset + 12, offset + 14), 16) & 0x0F;

    // Latitude (4 bytes, graus * 1800000)
    const latRaw = parseInt(hex.substring(offset + 14, offset + 22), 16);
    let lat = latRaw / 1800000.0;

    // Longitude (4 bytes, graus * 1800000)
    const lngRaw = parseInt(hex.substring(offset + 22, offset + 30), 16);
    let lng = lngRaw / 1800000.0;

    // Velocidade (1 byte, km/h)
    const speed = parseInt(hex.substring(offset + 30, offset + 32), 16);

    // Flags de status (2 bytes)
    const flags = parseInt(hex.substring(offset + 32, offset + 36), 16);
    const southHemisphere = !(flags & 0x0400);
    const westHemisphere  =  (flags & 0x0800);
    const gpsValid        =  (flags & 0x1000);
    const ignition        =  (flags & 0x8000);

    if (southHemisphere) lat = -lat;
    if (westHemisphere)  lng = -lng;

    return { type: 'location', lat, lng, speed, ignition: !!ignition, satellites, gpsValid: !!gpsValid, timestamp };
  } catch (e) {
    return null;
  }
}

// ─── Respostas ao dispositivo (obrigatórias no GT06) ─────────────────────────

function buildLoginResponse(serial) {
  // Formato: start(2) + len(1) + type(1) + serial(2) + crc(2) + stop(2)
  const serialHex = serial.toString(16).padStart(4, '0');
  // CRC simplificado — alguns firmwares do J16 aceitam fixo
  return Buffer.from(`787801` + `01` + serialHex + `d9dc` + `0d0a`, 'hex');
}

function buildHeartbeatResponse(serial) {
  const serialHex = serial.toString(16).padStart(4, '0');
  return Buffer.from(`787801` + `23` + serialHex + `d9dc` + `0d0a`, 'hex');
}

// ─── Servidor TCP ─────────────────────────────────────────────────────────────

const server = net.createServer((socket) => {
  let deviceImei = null;
  const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;

  console.log(`[GPS] Nova conexão: ${remoteAddr}`);

  socket.on('data', async (data) => {
    const packet = parsePacket(data);
    if (!packet) return;

    // ── Login ──────────────────────────────────────────────────────────────
    if (packet.type === 'login') {
      deviceImei = packet.imei;
      sessions.set(deviceImei, socket);
      socket.write(buildLoginResponse(packet.serial));
      console.log(`[GPS] Login OK — IMEI: ${deviceImei}`);

      // Atualiza lastSeen no banco
      try {
        await prisma.tracker.updateMany({
          where: { id: deviceImei },
          data: { lastSeen: new Date() }
        });
      } catch (_) {}
    }

    // ── Heartbeat ──────────────────────────────────────────────────────────
    if (packet.type === 'heartbeat') {
      socket.write(buildHeartbeatResponse(0));
      if (deviceImei) {
        try {
          await prisma.tracker.updateMany({
            where: { id: deviceImei },
            data: { lastSeen: new Date() }
          });
        } catch (_) {}
      }
    }

    // ── Posição GPS ────────────────────────────────────────────────────────
    if (packet.type === 'location' && deviceImei) {
      console.log(`[GPS] Posição — IMEI: ${deviceImei} | Lat: ${packet.lat} | Lng: ${packet.lng} | Speed: ${packet.speed}`);

      try {
        // Só salva se o tracker estiver cadastrado no sistema
        const tracker = await prisma.tracker.findUnique({ where: { id: deviceImei } });
        if (tracker) {
          await prisma.vehicleLocation.create({
            data: {
              trackerId: deviceImei,
              lat: packet.lat,
              lng: packet.lng,
              speed: packet.speed,
              ignition: packet.ignition,
              timestamp: packet.timestamp || new Date()
            }
          });
          await prisma.tracker.update({
            where: { id: deviceImei },
            data: { lastSeen: new Date() }
          });
        } else {
          console.warn(`[GPS] IMEI ${deviceImei} não cadastrado no sistema — posição ignorada`);
        }
      } catch (e) {
        console.error(`[GPS] Erro ao salvar posição:`, e.message);
      }
    }
  });

  socket.on('close', () => {
    if (deviceImei) {
      sessions.delete(deviceImei);
      console.log(`[GPS] Dispositivo desconectado: ${deviceImei}`);
    }
  });

  socket.on('error', (err) => {
    console.error(`[GPS] Erro no socket (${remoteAddr}):`, err.message);
  });
});

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Envia comando de texto para um dispositivo conectado pelo IMEI
 * ex: sendCommand('358xxxxxxxxx', 'RELAY,1#')
 */
function sendCommand(imei, command) {
  const socket = sessions.get(imei);
  if (!socket || socket.destroyed) {
    throw new Error(`Dispositivo ${imei} offline ou não conectado`);
  }
  socket.write(Buffer.from(command + '\r\n', 'ascii'));
  console.log(`[GPS] Comando enviado para ${imei}: ${command}`);
}

function getSessions() {
  return sessions;
}

function isOnline(imei) {
  const s = sessions.get(imei);
  return !!s && !s.destroyed;
}

module.exports = { server, sendCommand, getSessions, isOnline };

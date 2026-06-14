// Tiny Modbus-TCP simulator for end-to-end testing of the edge gateway.
// - Coil 0 pulses (false→true→false) ~every 1.5s  → rising edges for a GOOD/TOTAL counter
// - Holding register 0 increments each tick         → a changing MEASUREMENT value to historize
// Usage:  node scripts/modbus-sim.mjs [port]   (default 1502; 502 needs admin on Windows)
import pkg from 'modbus-serial';
const { ServerTCP } = pkg;

const PORT = Number(process.argv[2] || process.env.SIM_PORT || 1502);
let coil0 = false;
let hr0 = 0;

const vector = {
  getCoil: (addr, _unit, cb) => cb(null, addr === 0 ? coil0 : false),
  getDiscreteInput: (addr, _unit, cb) => cb(null, addr === 0 ? coil0 : false),
  getInputRegister: (addr, _unit, cb) => cb(null, addr === 0 ? hr0 : 0),
  getHoldingRegister: (addr, _unit, cb) => cb(null, addr === 0 ? hr0 : 0),
  setCoil: (_addr, _val, _unit, cb) => cb(null),
  setRegister: (_addr, _val, _unit, cb) => cb(null),
};

const server = new ServerTCP(vector, { host: '0.0.0.0', port: PORT, debug: false, unitID: 1 });

server.on('socketError', (e) => console.error('sim socket error:', e?.message));
server.on('serverError', (e) => console.error('sim server error:', e?.message));

// Drive the values so the gateway sees real-time change.
setInterval(() => {
  coil0 = !coil0;          // each false→true is one rising edge (= +1 count)
  hr0 = (hr0 + 1) % 1000;  // ever-changing register value
}, 1500);

console.log(`Modbus simulator listening on 0.0.0.0:${PORT} (coil0 pulsing, HR0 counting)`);

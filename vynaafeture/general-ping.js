import os from 'os';

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d > 0 ? d + ' hari ' : ''}${h} jam ${m} menit ${s} detik`;
}

export default {
  name: 'ping',
  command: ['ping', 'speed', 'runtime'],
  category: 'general',
  description: 'Cek kecepatan respon bot dan status runtime server',
  group: true,

  async execute({ m }) {
    const start = Date.now();
    const uptime = formatUptime(process.uptime());
    const ram = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);

    const lat = Date.now() - start;

    const response = `PONG!

Informasi Server:
- Kecepatan Respon: ${lat} ms
- Uptime Bot      : ${uptime}
- Penggunaan RAM  : ${ram} MB / ${totalRam} GB
- Platform OS     : ${os.type()} (${os.arch()})`;

    return m.reply(response);
  }
};

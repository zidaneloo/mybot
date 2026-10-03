import config from '../config.js';
import { plugins } from '../lib/plugins.js';

const categoryTitles = {
  admin: 'ADMIN GRUP',
  store: 'TOKO / GRUP JUALAN',
  downloader: 'DOWNLOADER & MEDIA',
  ai: 'ARTIFICIAL INTELLIGENCE',
  general: 'FITUR UMUM',
  owner: 'FITUR SEWA & OWNER'
};

const categoryOrder = ['admin', 'store', 'downloader', 'ai', 'general', 'owner'];

export default {
  name: 'menu',
  command: ['menu', 'help', 'fitur'],
  category: 'general',
  description: 'Menampilkan daftar seluruh perintah bot yang dideteksi secara otomatis',
  group: true,

  async execute({ vynaa, m, prefix }) {
    const pluginMap = plugins || global.plugins || new Map();
    const categorized = {};
    const seenCommands = new Set();

    for (const [, plugin] of pluginMap) {
      if (!plugin || typeof plugin.execute !== 'function') continue;

      const cat = plugin.category || 'general';
      if (!categorized[cat]) categorized[cat] = [];

      // Ambil perintah utama tanpa duplikat
      let cmds = [];
      if (Array.isArray(plugin.menu)) {
        cmds = plugin.menu;
      } else if (typeof plugin.menu === 'string') {
        cmds = [plugin.menu];
      } else if (plugin.name) {
        cmds = [plugin.name];
      } else if (Array.isArray(plugin.command)) {
        cmds = [plugin.command[0]];
      } else if (typeof plugin.command === 'string') {
        cmds = [plugin.command];
      }

      for (const cmd of cmds) {
        if (!cmd) continue;
        const cleanCmd = String(cmd).trim().toLowerCase();
        if (!seenCommands.has(cleanCmd)) {
          seenCommands.add(cleanCmd);
          categorized[cat].push(cmd);
        }
      }
    }

    let text = `┌── [ ${config.botName.toUpperCase()} ]
│
├ Pengguna : @${m.senderNumber}
├ Mode     : Khusus Grup
├ Total    : ${seenCommands.size} Perintah Terdeteksi
├ Prefix   : Fleksibel ( . ! # atau langsung ketik )
│\n`;

    const allCategories = Array.from(
      new Set([...categoryOrder, ...Object.keys(categorized)])
    );

    for (const cat of allCategories) {
      const list = categorized[cat];
      if (!list || list.length === 0) continue;

      const title = categoryTitles[cat] || cat.toUpperCase();
      text += `├── [ ${title} ]\n`;
      for (const cmd of list) {
        text += `│ ├ ${cmd}\n`;
      }
      text += `│\n`;
    }

    text += `└── [ Simple, Clean & Fast ]`;

    // Kirim menu dengan foto banner jika dikonfigurasi di config.js
    if (config.thumb) {
      try {
        return await vynaa.sendMessage(m.chat, {
          image: { url: config.thumb },
          caption: text,
          mentions: [m.sender]
        }, { quoted: m.raw });
      } catch (err) {
        console.error('[Menu Image Error]', err.message);
      }
    }

    return m.reply(text, {
      mentions: [m.sender]
    });
  }
};

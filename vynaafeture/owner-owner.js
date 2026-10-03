import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import db from '../lib/database.js';
import { formatNumber, cleanJid } from '../lib/simple.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../config.js');

/**
 * Helper untuk menyinkronkan daftar owner ke file config.js secara otomatis
 */
function syncOwnerToConfigFile(ownersArray) {
  try {
    if (!fs.existsSync(configPath)) return;
    let content = fs.readFileSync(configPath, 'utf-8');
    const formattedOwners = ownersArray.map((num) => `  '${num}'`).join(',\n');
    const replacement = `owner: [\n${formattedOwners}\n]`;
    content = content.replace(/owner:\s*\[[\s\S]*?\]/, replacement);
    fs.writeFileSync(configPath, content, 'utf-8');
  } catch (err) {
    console.error('[Sync Owner Error]', err);
  }
}

export default {
  name: 'addowner',
  command: ['addowner', 'delowner', 'listowner', 'addown', 'delown'],
  menu: ['addowner', 'delowner', 'listowner'],
  category: 'owner',
  description: 'Menambah, menghapus, atau melihat daftar owner bot',
  owner: true,

  async execute({ vynaa, m, text, args, command, prefix }) {
    // Gabungkan owner dari config dan database
    const dbOwners = db.getOwners ? db.getOwners() : [];
    const allOwners = Array.from(new Set([...(config.owner || []), ...dbOwners].filter(Boolean)));

    // 1. LIST OWNER
    if (command === 'listowner') {
      if (allOwners.length === 0) {
        return m.reply('Belum ada owner yang terdaftar.');
      }

      let res = `┌── [ DAFTAR OWNER BOT ]\n│\n`;
      let count = 1;
      const mentions = [];

      for (const own of allOwners) {
        const jid = `${own}@s.whatsapp.net`;
        mentions.push(jid);
        res += `│ ├ ${count++}. @${own}\n`;
      }
      res += `│\n└── [ Total: ${allOwners.length} Owner ]`;

      return m.reply(res, { mentions });
    }

    // Ambil target nomor dari reply pesan, mention @user, atau teks input
    let target = '';
    if (m.quoted?.sender) {
      target = formatNumber(m.quoted.sender);
    } else if (m.mentions && m.mentions.length > 0) {
      target = formatNumber(m.mentions[0]);
    } else if (text) {
      target = text.replace(/\D/g, '');
    }

    // 2. ADD OWNER
    if (command === 'addowner' || command === 'addown') {
      if (!target) {
        return m.reply(
          `*Cara Tambah Owner Bot:*\n` +
          `• *${prefix + command} 628xxx*\n` +
          `• *${prefix + command} @tag*\n` +
          `• Atau reply pesan orangnya lalu ketik *${prefix + command}*`
        );
      }

      if (allOwners.includes(target)) {
        return m.reply(`Nomor @${target} sudah terdaftar sebagai owner bot.`, {
          mentions: [`${target}@s.whatsapp.net`]
        });
      }

      // Simpan ke database & config
      db.addOwner(target);
      if (!config.owner.includes(target)) {
        config.owner.push(target);
      }
      const updatedOwners = Array.from(new Set([...config.owner, ...db.getOwners()]));
      syncOwnerToConfigFile(updatedOwners);

      return m.reply(`✅ Berhasil menambahkan @${target} sebagai Owner Bot.`, {
        mentions: [`${target}@s.whatsapp.net`]
      });
    }

    // 3. DEL OWNER
    if (command === 'delowner' || command === 'delown') {
      if (!target) {
        return m.reply(
          `*Cara Hapus Owner Bot:*\n` +
          `• *${prefix + command} 628xxx*\n` +
          `• *${prefix + command} @tag*\n` +
          `• Atau reply pesan orangnya lalu ketik *${prefix + command}*`
        );
      }

      if (!allOwners.includes(target)) {
        return m.reply(`Nomor @${target} bukan bagian dari owner bot.`, {
          mentions: [`${target}@s.whatsapp.net`]
        });
      }

      // Hapus dari database & config
      db.removeOwner(target);
      config.owner = (config.owner || []).filter((num) => num !== target);
      const updatedOwners = Array.from(new Set([...config.owner, ...db.getOwners()]));
      syncOwnerToConfigFile(updatedOwners);

      return m.reply(`✅ Berhasil menghapus @${target} dari daftar Owner Bot.`, {
        mentions: [`${target}@s.whatsapp.net`]
      });
    }
  }
};

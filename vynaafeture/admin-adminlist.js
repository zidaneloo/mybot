import { formatNumber, resolveJid, getUserName } from '../lib/simple.js';

export default {
  name: 'adminlist',
  command: ['adminlist', 'listadmin', 'admins', 'admin'],
  category: 'admin',
  description: 'Melihat daftar seluruh admin grup beserta nama / username',
  group: true,

  async execute({ vynaa, m, participants, groupMetadata }) {
    const groupName = groupMetadata?.subject || 'Grup';
    const admins = (participants || []).filter((p) => p.admin === 'admin' || p.admin === 'superadmin');

    if (admins.length === 0) {
      return m.reply('Tidak ada admin yang terdeteksi di grup ini.');
    }

    let text = `┌── [ DAFTAR ADMIN GRUP ]
│
├ Grup        : ${groupName}
├ Total Admin : ${admins.length} Orang
│
├── [ DAFTAR NAMA ]\n`;

    const mentions = [];
    let count = 1;

    for (const admin of admins) {
      const jid = resolveJid(admin.id || admin.jid, participants);
      const number = formatNumber(jid);
      const role = admin.admin === 'superadmin' ? 'Ketua Grup' : 'Admin';
      
      // Ambil username / pushName jika tersedia
      const displayName = admin.name || admin.notify || getUserName(jid) || getUserName(number);
      const nameTag = displayName ? `${displayName} ` : '';

      text += `│ ├ ${count++}. ${nameTag}(@${number}) - [ ${role} ]\n`;
      mentions.push(jid);
    }

    text += `│\n└── [ Total: ${admins.length} Admin ]`;

    await vynaa.sendMessage(m.chat, {
      text,
      mentions
    }, { quoted: m.raw });
  }
};

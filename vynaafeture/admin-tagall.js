import { formatNumber, resolveJid, getUserName } from '../lib/simple.js';
import * as simple from '../lib/simple.js';

export default {
  name: 'tagall',
  command: ['tagall', 'semua'],
  category: 'admin',
  description: 'Memanggil seluruh anggota grup dengan tag @ terlihat secara rapi',
  group: true,
  admin: true,

  async execute({ vynaa, m, text, participants, groupMetadata }) {
    const groupName = groupMetadata?.subject || 'Grup';
    const totalMembers = (participants || []).length;
    const pesan = text || m.quoted?.text || '';

    let message = `┌── [ PANGGILAN ANGGOTA ]
│
├ Grup        : ${groupName}
├ Total Member: ${totalMembers} Orang\n`;

    if (pesan) {
      message += `├ Pesan       : ${pesan}\n`;
    }

    message += `│\n├── [ DAFTAR MEMBER ]\n`;

    let count = 1;

    for (const p of participants || []) {
      const jid = resolveJid(p.id || p.jid, participants);
      const number = formatNumber(jid);
      const displayName = p.name || p.notify || getUserName(jid) || getUserName(number);
      const suffix = displayName ? ` ~ ${displayName}` : '';

      message += `│ ├ ${count++}. @${number}${suffix}\n`;
    }

    message += `│\n└── [ Panggilan Selesai ]`;

    // Ambil seluruh variasi JID agar mention sampai ke semua anggota grup
    const allMentions = typeof simple.getAllParticipantJids === 'function'
      ? simple.getAllParticipantJids(participants)
      : (participants || []).map((p) => resolveJid(p.id || p.jid, participants)).filter(Boolean);

    await vynaa.sendMessage(m.chat, {
      text: message,
      mentions: allMentions
    }, { quoted: m.raw });
  }
};

import { formatNumber, resolveJid, getUserName } from '../lib/simple.js';

export default {
  name: 'infogrup',
  command: ['infogrup', 'infogc', 'groupinfo'],
  category: 'general',
  description: 'Melihat informasi lengkap seputar grup WhatsApp dan link undangan',
  group: true,

  async execute({ vynaa, m, groupMetadata, participants, chat, isBotAdmin }) {
    if (!groupMetadata) return m.reply('Tidak dapat memuat informasi grup.');

    const groupName = groupMetadata.subject || 'Tanpa Nama';
    const groupId = groupMetadata.id;
    const ownerJid = resolveJid(groupMetadata.owner || groupMetadata.subjectOwner, participants);
    const ownerNum = ownerJid ? formatNumber(ownerJid) : 'Tidak diketahui';
    const ownerName = getUserName(ownerJid) || getUserName(ownerNum);
    const ownerText = ownerName ? `${ownerName} (@${ownerNum})` : `@${ownerNum}`;

    const totalMembers = (participants || []).length;
    const totalAdmins = (participants || []).filter((p) => p.admin === 'admin' || p.admin === 'superadmin').length;
    const antilinkStatus = (chat?.antilink2 || chat?.antilinkKick)
      ? 'Aktif (Mode 2: Kick)'
      : (chat?.antilink ? 'Aktif (Mode 1: Hapus Pesan)' : 'Nonaktif');

    // Ambil link grup jika bot admin
    let groupLink = '(Jadikan bot admin untuk melihat link grup)';
    if (isBotAdmin) {
      try {
        const code = await vynaa.groupInviteCode(m.chat);
        if (code) groupLink = `https://chat.whatsapp.com/${code}`;
      } catch {}
    }

    const text = `┌── [ INFORMASI GRUP ]
│
├ Nama Grup      : ${groupName}
├ ID Grup        : ${groupId}
├ Pembuat Grup   : ${ownerText}
├ Total Member   : ${totalMembers} Orang
├ Total Admin    : ${totalAdmins} Orang
├ Status Antilink: ${antilinkStatus}
├ Link Undangan  : ${groupLink}
│
├── [ DESKRIPSI GRUP ]
│ ${desc.split('\n').join('\n│ ')}
│
└── [ Selesai ]`;

    return m.reply(text, {
      mentions: ownerJid ? [ownerJid] : []
    });
  }
};

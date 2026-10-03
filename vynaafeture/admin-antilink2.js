import { isUrl, kickParticipant } from '../lib/simple.js';

export default {
  name: 'antilink2',
  command: ['antilink2'],
  category: 'admin',
  description: 'Aktifkan atau nonaktifkan proteksi antilink 2 (hapus pesan & kick member)',
  group: true,
  admin: true,
  botAdmin: true,

  // Hook pengecekan setiap pesan yang masuk
  async before({ vynaa, m, chat, isAdmin, isBotAdmin, isGroup, participants }) {
    if (!isGroup || (!chat?.antilink2 && !chat?.antilinkKick) || !m.text) return false;
    if (isAdmin) return false; // Admin bebas kirim link

    const text = m.text || m.body || '';
    const hasLink = isUrl(text);

    if (hasLink) {
      // 1. Hapus pesan link jika bot admin
      if (isBotAdmin) {
        await vynaa.sendMessage(m.chat, {
          delete: {
            remoteJid: m.chat,
            fromMe: false,
            id: m.id,
            participant: m.raw?.key?.participant || m.rawSender || m.sender
          }
        }).catch(() => {});
      }

      // 2. Beri pesan respon dan kick jika bot admin
      if (isBotAdmin) {
        const target = m.rawSender || m.sender;
        try {
          const res = await kickParticipant(vynaa, m.chat, target, participants);
          const displayNum = res.targetNum || m.senderNumber;
          await m.reply(
            `*「 ANTILINK 2 TERDETEKSI 」*\n\n` +
            `Link terdeteksi dari @${displayNum}!\n` +
            `Sesuai aturan grup (Antilink 2: Hapus & Kick), pesan kamu telah dihapus dan kamu dikeluarkan dari grup.`,
            { mentions: [m.sender, res.kickedJid, target] }
          );
        } catch (err) {
          await m.reply(
            `*「 ANTILINK 2 TERDETEKSI 」*\n\n` +
            `Peringatan untuk @${m.senderNumber}!\n` +
            `Dilarang mengirim link di grup ini. (Pesan telah dihapus, gagal auto-kick: ${err.message})`,
            { mentions: [m.sender] }
          );
        }
      } else {
        await m.reply(
          `*「 ANTILINK 2 TERDETEKSI 」*\n\n` +
          `Peringatan untuk @${m.senderNumber}!\n` +
          `Dilarang mengirim link apapun di grup ini.\n` +
          `_(Jadikan bot sebagai admin grup agar fitur hapus pesan & auto-kick dapat berjalan)._`,
          { mentions: [m.sender] }
        );
      }

      return true; // Stop eksekusi plugin lain
    }

    return false;
  },

  async execute({ m, args, chat, db, prefix, isBotAdmin }) {
    const action = (args[0] || '').toLowerCase();

    if (action === 'on' || action === 'aktif') {
      chat.antilink2 = true;
      chat.antilinkKick = true;
      chat.antilink = false; // Matikan antilink 1 agar fokus pada mode kick
      db.save();

      let botAdminNotice = '';
      if (!isBotAdmin) {
        botAdminNotice = '\n\n⚠️ *Perhatian:* Bot belum menjadi admin grup ini. Jadikan bot admin agar fitur hapus pesan dan kick member dapat bekerja otomatis.';
      }

      return m.reply(
        `*Antilink 2 (Mode Hapus & Kick) Berhasil Diaktifkan!*\n\n` +
        `• Status: Aktif (Mode 2: Kick)\n` +
        `• Deteksi: Semua jenis link (Website, domain .com, .my.id, .biz.id, link grup WA, sosmed, dll)\n` +
        `• Aksi: Hapus pesan link + LANGSUNG KICK member${botAdminNotice}\n\n` +
        `_Ketik "${prefix}antilink2 off" untuk mematikan._`
      );
    }

    if (action === 'off' || action === 'mati') {
      chat.antilink2 = false;
      chat.antilinkKick = false;
      db.save();
      return m.reply('Antilink 2 (Mode Hapus & Kick) berhasil dinonaktifkan.');
    }

    return m.reply(`┌── [ PENGATURAN ANTILINK 2 ]
│
├ Mode     : Hapus Pesan & Kick Member
├ Status   : ${chat.antilink2 || chat.antilinkKick ? 'Aktif' : 'Nonaktif'}
├ Bot Admin: ${isBotAdmin ? 'Ya (Siap Kick)' : 'Tidak (Jadikan Bot Admin!)'}
│
├── [ PANDUAN PENGGUNAAN ]
├ ${prefix}antilink2 on  - Mengaktifkan Antilink 2 (Kick)
├ ${prefix}antilink2 off - Mematikan Antilink 2
│
├── [ INFORMASI ]
├ Member yang mengirim tautan apa pun (termasuk .com,
├ .my.id, .biz.id, link grup WA, sosmed, shortlink, dll)
├ akan otomatis dihapus dan langsung dikeluarkan dari grup.
│
└── [ Simple, Clean & Fast ]`);
  }
};

/*
        ••JANGAN HAPUS INI••
SCRIPT BY © VYNAA VALERIE 
•• recode kasih credits 
•• contacts: (6282389924037) 
•• (github.com/VynaaValerie) 

•• Join https://whatsapp.com/channel/0029VbCaDhn11ulT1qwodB2x  

• Menerima pemberitahuan web
• Menerima pemberitahuan aplikasi 
• Menerima pembuatan script bot
• Menerima perbaikan script atau fitur bot
• Menerima pembuatan fitur bot
• Menerima semua kebutuhan bot
• Menerima Jadi Bot

ℹ️ Information

• Pembayaran bisa dicicil
• Bisa bayar di awal atau akhir
• Pembayaran melalu QRIS Only
• Testimoni Banyak

Aturan:
1. Dilarang memperjualbelikan script ini.
2. Hak cipta milik Vynaa Valerie.

“Dan janganlah kamu makan harta di antara kamu dengan jalan yang batil, dan janganlah kamu membunuh dirimu sendiri. Sesungguhnya Allah adalah Maha Penyayang kepadamu.” (QS. Al-Baqarah: 188)
*/

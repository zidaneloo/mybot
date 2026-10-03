import { isUrl } from '../lib/simple.js';

export default {
  name: 'antilink',
  command: ['antilink', 'antilink1'],
  category: 'admin',
  description: 'Aktifkan atau nonaktifkan proteksi antilink 1 (hapus pesan & peringatan)',
  group: true,
  admin: true,
  botAdmin: true,

  // Hook pengecekan setiap pesan yang masuk
  async before({ vynaa, m, chat, isAdmin, isBotAdmin, isGroup }) {
    // Hanya aktif jika grup, antilink 1 aktif, dan antilink 2 TIDAK aktif (agar tidak bentrok)
    if (!isGroup || !chat?.antilink || chat?.antilink2 || !m.text) return false;
    if (isAdmin) return false; // Admin bebas kirim link

    const text = m.text || m.body || '';
    const hasLink = isUrl(text);

    if (hasLink) {
      // Hapus pesan link jika bot admin
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

      await m.reply(
        `*「 ANTILINK TERDETEKSI 」*\n\n` +
        `Peringatan untuk @${m.senderNumber}!\n` +
        `Dilarang mengirim link apapun di grup ini. Pesan kamu telah dihapus oleh bot.\n\n` +
        `_Patuhi peraturan grup agar tetap nyaman!_`,
        { mentions: [m.sender] }
      );

      return true; // Stop eksekusi plugin lain
    }

    return false;
  },

  async execute({ m, args, chat, db, prefix }) {
    const action = (args[0] || '').toLowerCase();
    const subAction = (args[1] || '').toLowerCase();

    // Dukungan .antilink 2 on / off atau .antilink kick on / off
    if (action === '2' || action === 'kick') {
      if (subAction === 'on' || subAction === 'aktif') {
        chat.antilink = false;
        chat.antilink2 = true;
        chat.antilinkKick = true;
        db.save();
        return m.reply(
          `*Mode Antilink 2 (Hapus & Kick) Berhasil Diaktifkan!*\n\n` +
          `• Status: Aktif (Mode 2: Kick)\n` +
          `• Aksi: Hapus pesan link + KICK pengirim otomatis\n\n` +
          `_Gunakan "${prefix}antilink2 off" untuk mematikan._`
        );
      } else if (subAction === 'off' || subAction === 'mati') {
        chat.antilink2 = false;
        chat.antilinkKick = false;
        db.save();
        return m.reply('Mode Antilink 2 (Kick) dinonaktifkan.');
      }
    }

    if (action === '1') {
      if (subAction === 'on' || subAction === 'aktif') {
        chat.antilink = true;
        chat.antilink2 = false;
        chat.antilinkKick = false;
        db.save();
        return m.reply(
          `*Mode Antilink 1 (Hapus Pesan) Berhasil Diaktifkan!*\n\n` +
          `• Status: Aktif (Mode 1)\n` +
          `• Aksi: Hapus pesan link + beri peringatan (tanpa kick)\n\n` +
          `_Gunakan "${prefix}antilink off" untuk mematikan._`
        );
      } else if (subAction === 'off' || subAction === 'mati') {
        chat.antilink = false;
        db.save();
        return m.reply('Mode Antilink 1 dinonaktifkan.');
      }
    }

    if (action === 'on' || action === 'aktif') {
      chat.antilink = true;
      chat.antilink2 = false;
      chat.antilinkKick = false;
      db.save();
      return m.reply(
        `*Antilink 1 Berhasil Diaktifkan!*\n\n` +
        `Bot akan otomatis mendeteksi dan menghapus semua jenis link (website, domain .com, .my.id, .biz.id, link grup WA, sosmed, shortlink, dll) yang dikirim oleh member, serta memberikan peringatan.\n\n` +
        `_Note: Jika ingin mode hapus + kick otomatis, gunakan command: *${prefix}antilink2 on*_`
      );
    }

    if (action === 'off' || action === 'mati') {
      chat.antilink = false;
      db.save();
      return m.reply('Antilink 1 dinonaktifkan.');
    }

    return m.reply(`┌── [ PENGATURAN ANTILINK ]
│
├ Mode 1 (Hapus Link)  : ${chat.antilink && !chat.antilink2 ? 'Aktif' : 'Nonaktif'}
├ Mode 2 (Hapus & Kick): ${chat.antilink2 ? 'Aktif' : 'Nonaktif'}
│
├── [ PANDUAN PENGGUNAAN ]
├ ${prefix}antilink on   - Aktifkan mode hapus link + peringatan
├ ${prefix}antilink off  - Matikan antilink 1
├ ${prefix}antilink2 on  - Aktifkan mode hapus link + kick member
├ ${prefix}antilink2 off - Matikan antilink 2
│
├── [ DETEKSI LINK ]
├ Mendeteksi seluruh tautan (https://, http://, wa.me,
├ domain tanpa https seperti .com, .my.id, .biz.id, .id, dll)
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
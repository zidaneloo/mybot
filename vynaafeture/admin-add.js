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

import { formatNumber } from '../lib/simple.js';

export default {
  name: 'add',
  command: ['add', 'tambah', 'invite'],
  category: 'admin',
  description: 'Menambahkan anggota ke grup',
  group: true,
  admin: true,
  botAdmin: true,

  async execute({ vynaa, m, text, prefix }) {
    let num = '';

    if (m.quoted) {
      num = formatNumber(m.quoted.sender);
    } else if (text) {
      num = text.replace(/\D/g, '');
    }

    if (!num) {
      return m.reply(`Tulis nomornya bro.\nContoh: ${prefix}add 628123456789 atau reply pesannya.`);
    }

    const targetJid = `${num}@s.whatsapp.net`;

    try {
      const res = await vynaa.groupParticipantsUpdate(m.chat, [targetJid], 'add');
      const status = res?.[0]?.status;

      if (status === '200') {
        return m.reply(`Berhasil menambahkan @${num} ke grup.`, {
          mentions: [targetJid]
        });
      } else if (status === '403') {
        return m.reply(`Nomor @${num} membatasi undangan grup secara privat.\nSilakan kirimkan link grup secara langsung kepadanya.`, {
          mentions: [targetJid]
        });
      } else if (status === '408') {
        return m.reply(`Nomor @${num} baru saja keluar dari grup ini. Tunggu beberapa saat sebelum menambahkan lagi.`, {
          mentions: [targetJid]
        });
      } else {
        return m.reply(`Status penambahan @${num}: ${status || 'Menunggu verifikasi'}.`, {
          mentions: [targetJid]
        });
      }
    } catch (err) {
      return m.reply(`Gagal menambahkan nomor tersebut: ${err.message}`);
    }
  }
};

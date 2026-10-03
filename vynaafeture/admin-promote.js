import { formatNumber, updateParticipantGroup } from '../lib/simple.js';

export default {
  name: 'promote',
  command: ['promote', 'admin', 'jadikanadmin'],
  category: 'admin',
  description: 'Menaikkan member menjadi admin grup',
  group: true,
  admin: true,
  botAdmin: true,

  async execute({ vynaa, m, text, participants, prefix }) {
    let target = null;

    if (m.quoted) {
      target = m.quoted.rawSender || m.quoted.sender;
    } else if (m.mentions && m.mentions.length > 0) {
      target = m.mentions[0];
    } else if (text) {
      const cleanNum = text.replace(/\D/g, '');
      if (cleanNum) target = `${cleanNum}@s.whatsapp.net`;
    }

    if (!target) {
      return m.reply(`Sebutkan member yang mau dinaikkan jadi admin bro.\nContoh:\n- ${prefix}promote @member\n- Reply pesan lalu ketik ${prefix}promote`);
    }

    try {
      const res = await updateParticipantGroup(vynaa, m.chat, target, 'promote', participants);
      const displayNum = res.targetNum || formatNumber(target);
      return m.reply(`Selamat @${displayNum}, kamu sudah dinaikkan menjadi admin grup.`, {
        mentions: [res.kickedJid, target]
      });
    } catch (err) {
      return m.reply(`Gagal menaikkan status: ${err.message}`);
    }
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

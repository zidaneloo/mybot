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
export default {
  name: 'group',
  command: ['group', 'grup'],
  category: 'admin',
  description: 'Buka atau tutup obrolan grup untuk member',
  group: true,
  admin: true,
  botAdmin: true,

  async execute({ vynaa, m, args, prefix }) {
    const action = (args[0] || '').toLowerCase();

    if (action === 'open' || action === 'buka') {
      await vynaa.groupSettingUpdate(m.chat, 'not_announcement');
      return m.reply('Grup telah dibuka. Semua member sekarang bisa mengirim pesan.');
    } else if (action === 'close' || action === 'tutup') {
      await vynaa.groupSettingUpdate(m.chat, 'announcement');
      return m.reply('Grup telah ditutup. Hanya admin yang bisa mengirim pesan.');
    } else {
      return m.reply(`Format perintah grup:
- ${prefix}group open  (Buka obrolan)
- ${prefix}group close (Tutup obrolan)`);
    }
  }
};

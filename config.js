// ==========================================
// KONFIGURASI BOT WHATSAPP - VYNAA AI
// ==========================================

export const config = {
  // Nama bot
  botName: 'Sherin Bot V1',
  
  // Nomor Owner (Format angka tanpa tanda +, misal: '628xxx')
  owner: [
  '6283872659753',
  '6285757845929'
],

  // Nama folder sesi login Baileys
  sessionName: 'VynaaSesi',

  // Nomor default untuk pairing code (kosongkan jika ingin selalu ditanya saat start)
  pairingNumber: '',

  // Prefix default untuk command
  prefix: '.',

  // Thumbnail / Foto Menu Bot
  thumb: 'https://vydrive.zone.id/f/nm2rJWfe.jpeg',

  // ==========================================
  // KONFIGURASI TELEGRAM BOT CONTROLLER
  // ==========================================
  telegram: {
    enabled: true,
    token: '8985246357:AAECrraKWzn2fQaSPQ_iT2yowrwiygR-Jb4',
    ownerId: '8800459833',
    allowedUsers: ['8800459833']
  },

  // ==========================================
  // KONFIGURASI API VTECH (https://api.vtech.biz.id)
  // ==========================================
  vtech: 'sk-3812b98420fb', // Isi dengan API Key VTech Anda (contoh: 'free' atau key pribadi)
  
  api: {
    vtech: 'https://api.vtech.biz.id',
    apiKey: 'sk-3812b98420fb' // API Key VTech
  },

  // Respons teks default (gaya santai, ramah, dan tanpa emoji berlebihan)
  msg: {
    admin: 'Maaf bro, perintah ini cuma bisa dipakai sama admin grup ya.',
    botAdmin: 'Bot harus jadi admin grup dulu biar bisa jalanin perintah ini.',
    owner: 'Perintah ini khusus buat owner bot ya bro.',
    group: 'Bot ini khusus aktif di dalam grup aja ya.',
    wait: 'Tunggu sebentar ya bro, lagi diproses...',
    error: 'Terjadi kendala saat memproses perintah.',
    success: 'Berhasil diproses.'
  }
};

global.vtech = config.vtech;
global.config = config;
export default config;
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
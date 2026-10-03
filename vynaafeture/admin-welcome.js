import config from '../config.js';
import db from '../lib/database.js';

export const DEFAULT_WELCOME = `┌── [ MEMBER BARU BERGABUNG ]
│
├ Halo @user
├ Selamat datang di:
├ %group%
│
├ Deskripsi Grup:
│ %desc%
│
└── [ Semoga betah dan patuhi aturan ya kak! ]`;

export const DEFAULT_BYE = `┌── [ MEMBER KELUAR ]
│
├ Selamat jalan @user
├ Dari grup: %group%
│
└── [ Semoga harimu selalu menyenangkan! ]`;

export default {
  name: 'welcome',
  command: ['welcome', 'bye', 'goodbye', 'left', 'setwelcome', 'setbye', 'setgoodbye', 'cekwelcome', 'cekbye'],
  menu: ['welcome [on/off]', 'bye [on/off]', 'setwelcome [teks]', 'setbye [teks]'],
  category: 'admin',
  description: 'Pengaturan pesan sambutan member baru (welcome) dan pesan perpisahan (bye) dengan foto profil',
  group: true,
  admin: true,

  async execute({ vynaa, m, text, args, command, prefix, chat }) {
    if (!chat) {
      return m.reply('Data grup tidak ditemukan.');
    }

    // ==========================================
    // 1. SET WELCOME (SETWELCOME)
    // ==========================================
    if (command === 'setwelcome') {
      const newTemplate = (text || m.quoted?.text || '').trim();

      if (!newTemplate) {
        return m.reply(
          `*Cara Mengatur Pesan Welcome:*\n\n` +
          `1. *Ketik langsung (bisa teks panjang):*\n` +
          `   ${prefix}setwelcome <teks sambutan>\n\n` +
          `2. *Atau reply pesan teks lalu ketik:*\n` +
          `   ${prefix}setwelcome\n\n` +
          `*Variabel yang dapat digunakan:*\n` +
          `• *@user* : Mention nama/nomor member baru\n` +
          `• *%group%* : Nama grup\n` +
          `• *%desc%* : Deskripsi grup\n` +
          `• *%members%* : Jumlah total member grup\n` +
          `• *%waktu%* : Tanggal dan jam WIB`
        );
      }

      chat.welcomeText = newTemplate;
      db.saveSync();

      return m.reply(`✅ *Berhasil mengatur pesan Welcome untuk grup ini!*\n\n*Preview:*\n${newTemplate}`);
    }

    // ==========================================
    // 2. SET BYE (SETBYE / SETGOODBYE)
    // ==========================================
    if (command === 'setbye' || command === 'setgoodbye') {
      const newTemplate = (text || m.quoted?.text || '').trim();

      if (!newTemplate) {
        return m.reply(
          `*Cara Mengatur Pesan Bye / Perpisahan:*\n\n` +
          `1. *Ketik langsung (bisa teks panjang):*\n` +
          `   ${prefix}setbye <teks perpisahan>\n\n` +
          `2. *Atau reply pesan teks lalu ketik:*\n` +
          `   ${prefix}setbye\n\n` +
          `*Variabel yang dapat digunakan:*\n` +
          `• *@user* : Mention nama/nomor member yang keluar\n` +
          `• *%group%* : Nama grup\n` +
          `• *%desc%* : Deskripsi grup\n` +
          `• *%members%* : Jumlah total member grup\n` +
          `• *%waktu%* : Tanggal dan jam WIB`
        );
      }

      chat.byeText = newTemplate;
      db.saveSync();

      return m.reply(`✅ *Berhasil mengatur pesan Bye / Perpisahan untuk grup ini!*\n\n*Preview:*\n${newTemplate}`);
    }

    // ==========================================
    // 3. CEK TEMPLATE (CEKWELCOME / CEKBYE)
    // ==========================================
    if (command === 'cekwelcome') {
      const tmpl = chat.welcomeText || DEFAULT_WELCOME;
      return m.reply(`*Template Welcome Grup Ini:*\nStatus: ${chat.welcome ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}\n\n${tmpl}`);
    }

    if (command === 'cekbye') {
      const tmpl = chat.byeText || DEFAULT_BYE;
      return m.reply(`*Template Bye Grup Ini:*\nStatus: ${chat.bye ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}\n\n${tmpl}`);
    }

    // ==========================================
    // 4. ON / OFF WELCOME
    // ==========================================
    if (command === 'welcome') {
      const arg = (args[0] || '').toLowerCase();

      if (arg === 'on' || arg === '1' || arg === 'aktif' || arg === 'enable') {
        chat.welcome = true;
        db.saveSync();
        return m.reply('✅ Fitur *Welcome* berhasil diaktifkan di grup ini.');
      }

      if (arg === 'off' || arg === '0' || arg === 'mati' || arg === 'disable') {
        chat.welcome = false;
        db.saveSync();
        return m.reply('❌ Fitur *Welcome* berhasil dinonaktifkan di grup ini.');
      }

      return m.reply(
        `*Pengaturan Fitur Welcome:*\n` +
        `• Status saat ini: *${chat.welcome ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}*\n\n` +
        `*Perintah:*\n` +
        `• *${prefix}welcome on* : Mengaktifkan welcome\n` +
        `• *${prefix}welcome off* : Menonaktifkan welcome\n` +
        `• *${prefix}setwelcome <teks>* : Kustomisasi teks sambutan\n` +
        `• *${prefix}cekwelcome* : Melihat template saat ini`
      );
    }

    // ==========================================
    // 5. ON / OFF BYE
    // ==========================================
    if (command === 'bye' || command === 'goodbye' || command === 'left') {
      const arg = (args[0] || '').toLowerCase();

      if (arg === 'on' || arg === '1' || arg === 'aktif' || arg === 'enable') {
        chat.bye = true;
        db.saveSync();
        return m.reply('✅ Fitur *Bye / Perpisahan* berhasil diaktifkan di grup ini.');
      }

      if (arg === 'off' || arg === '0' || arg === 'mati' || arg === 'disable') {
        chat.bye = false;
        db.saveSync();
        return m.reply('❌ Fitur *Bye / Perpisahan* berhasil dinonaktifkan di grup ini.');
      }

      return m.reply(
        `*Pengaturan Fitur Bye / Perpisahan:*\n` +
        `• Status saat ini: *${chat.bye ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}*\n\n` +
        `*Perintah:*\n` +
        `• *${prefix}bye on* : Mengaktifkan pesan perpisahan\n` +
        `• *${prefix}bye off* : Menonaktifkan pesan perpisahan\n` +
        `• *${prefix}setbye <teks>* : Kustomisasi teks perpisahan\n` +
        `• *${prefix}cekbye* : Melihat template saat ini`
      );
    }
  }
};

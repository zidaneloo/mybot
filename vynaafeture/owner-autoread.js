export default {
  name: 'autoread',
  command: ['autoread', 'read'],
  menu: ['autoread [on/off]'],
  category: 'owner',
  description: 'Mengaktifkan atau menonaktifkan fitur centang biru otomatis (Auto Read pesan masuk) - Khusus Owner',
  owner: true,

  async execute({ m, args, db, prefix }) {
    if (!db.data.settings) db.data.settings = {};
    const current = Boolean(db.data.settings.autoread);

    const action = (args[0] || '').toLowerCase();

    if (action === 'on' || action === 'enable' || action === '1' || action === 'aktif') {
      db.data.settings.autoread = true;
      db.saveSync();
      return m.reply(
        `✅ *Auto Read BERHASIL DIAKTIFKAN!*\n\n` +
        `_Mulai sekarang bot akan otomatis membaca (memberi tanda centang biru) pada setiap pesan yang masuk._`
      );
    }

    if (action === 'off' || action === 'disable' || action === '0' || action === 'mati') {
      db.data.settings.autoread = false;
      db.saveSync();
      return m.reply(
        `❌ *Auto Read BERHASIL DINONAKTIFKAN!*\n\n` +
        `_Bot tidak akan menandai pesan sebagai terbaca secara otomatis._`
      );
    }

    // Tampilkan status saat ini jika tanpa argumen
    return m.reply(
      `┌── [ PENGATURAN AUTO READ ]\n│\n` +
      `├ Status Saat Ini: *${current ? 'AKTIF (ON) ✅' : 'NONAKTIF (OFF) ❌'}*\n│\n` +
      `├── [ CARA PENGGUNAAN ]\n` +
      `├ Ketik: *${prefix}autoread on* (untuk mengaktifkan)\n` +
      `├ Ketik: *${prefix}autoread off* (untuk mematikan)\n│\n` +
      `└── [ Khusus Owner Bot ]`
    );
  }
};

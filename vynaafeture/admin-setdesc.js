export default {
  name: 'setdesc',
  command: ['setdesc', 'setdeskripsi', 'gantidesc'],
  category: 'admin',
  description: 'Mengganti deskripsi grup',
  group: true,
  admin: true,
  botAdmin: true,

  async execute({ vynaa, m, text, prefix }) {
    if (!text) {
      return m.reply(`Masukkan deskripsi grup yang baru bro.\nContoh: ${prefix}setdesc Grup diskusi santai seputar teknologi.`);
    }

    try {
      await vynaa.groupUpdateDescription(m.chat, text);
      return m.reply('Deskripsi grup berhasil diperbarui.');
    } catch (err) {
      return m.reply(`Gagal mengubah deskripsi: ${err.message}`);
    }
  }
};

export default {
  name: 'setname',
  command: ['setname', 'setsubject', 'gantinama'],
  category: 'admin',
  description: 'Mengganti nama / subjek grup',
  group: true,
  admin: true,
  botAdmin: true,

  async execute({ vynaa, m, text, prefix }) {
    if (!text) {
      return m.reply(`Masukkan nama grup yang baru bro.\nContoh: ${prefix}setname Komunitas Developer`);
    }

    try {
      await vynaa.groupUpdateSubject(m.chat, text);
      return m.reply(`Nama grup berhasil diubah menjadi: "${text}"`);
    } catch (err) {
      return m.reply(`Gagal mengubah nama grup: ${err.message}`);
    }
  }
};

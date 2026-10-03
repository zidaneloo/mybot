export default {
  name: 'setprefix',
  command: ['setprefix', 'prefix'],
  category: 'owner',
  description: 'Mengubah prefix default bot',
  owner: true,

  async execute({ m, text, db, prefix, config }) {
    if (!text) {
      return m.reply(`Prefix saat ini: ${config.prefix}\nContoh ubah: ${prefix}setprefix #`);
    }

    config.prefix = text.trim();
    db.data.settings.prefix = config.prefix;
    db.save();

    return m.reply(`Prefix bot berhasil diubah menjadi: ${config.prefix}`);
  }
};

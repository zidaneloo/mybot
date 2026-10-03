export default {
  name: 'delete',
  command: ['delete', 'del', 'hapus'],
  category: 'general',
  description: 'Menghapus pesan bot atau pesan member (jika bot admin)',
  group: true,

  async execute({ vynaa, m, isBotAdmin, isAdmin, prefix }) {
    if (!m.quoted) {
      return m.reply(`Reply pesan yang mau dihapus lalu ketik ${prefix}delete`);
    }

    // Jika pesan quoted adalah milik bot, siapapun bisa minta hapus
    if (m.quoted.fromMe) {
      return vynaa.sendMessage(m.chat, {
        delete: {
          remoteJid: m.chat,
          fromMe: true,
          id: m.quoted.id,
          participant: vynaa.user?.id
        }
      });
    }

    // Jika pesan orang lain, bot harus admin dan pemanggil harus admin
    if (!isAdmin) {
      return m.reply('Hanya admin grup yang bisa menghapus pesan member lain.');
    }
    if (!isBotAdmin) {
      return m.reply('Bot harus menjadi admin grup untuk menghapus pesan member lain.');
    }

    return vynaa.sendMessage(m.chat, {
      delete: {
        remoteJid: m.chat,
        fromMe: false,
        id: m.quoted.id,
        participant: m.quoted.sender
      }
    });
  }
};

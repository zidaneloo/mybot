export default {
  name: 'linkgc',
  command: ['linkgc', 'linkgroup', 'linkgrup'],
  category: 'admin',
  description: 'Mendapatkan link undangan grup WhatsApp',
  group: true,
  admin: true,
  botAdmin: true,

  async execute({ vynaa, m, groupMetadata }) {
    try {
      const code = await vynaa.groupInviteCode(m.chat);
      const groupName = groupMetadata?.subject || 'Grup';
      return m.reply(`Link Undangan Grup: ${groupName}\nhttps://chat.whatsapp.com/${code}`);
    } catch (err) {
      return m.reply(`Gagal mengambil link grup: ${err.message}`);
    }
  }
};

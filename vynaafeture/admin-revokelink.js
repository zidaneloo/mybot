export default {
  name: 'revokelink',
  command: ['revokelink', 'resetlink', 'tariklink'],
  category: 'admin',
  description: 'Mereset link undangan grup lama dan membuat link baru',
  group: true,
  admin: true,
  botAdmin: true,

  async execute({ vynaa, m }) {
    try {
      const code = await vynaa.groupRevokeInvite(m.chat);
      return m.reply(`Link undangan grup lama telah ditarik.\nLink baru:\nhttps://chat.whatsapp.com/${code}`);
    } catch (err) {
      return m.reply(`Gagal mereset link: ${err.message}`);
    }
  }
};

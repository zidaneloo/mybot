export default {
  name: 'leave',
  command: ['leave', 'keluar', 'out'],
  category: 'owner',
  description: 'Memerintahkan bot keluar dari grup ini',
  group: true,
  owner: true,

  async execute({ vynaa, m }) {
    await m.reply('Bot pamit undur diri dari grup ini ya bro.');
    await vynaa.groupLeave(m.chat).catch(() => {});
  }
};

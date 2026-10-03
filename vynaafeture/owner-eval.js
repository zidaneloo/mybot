import util from 'util';

export default {
  name: 'eval',
  command: ['eval', '>'],
  category: 'owner',
  description: 'Mengevaluasi kode JavaScript (Khusus Owner)',
  owner: true,

  async execute({ vynaa, m, text, args, command, prefix, isOwner, isAdmin, isBotAdmin, groupMetadata, participants, chat, user, db, config }) {
    if (!text) return m.reply('Masukkan kode JavaScript yang mau dijalankan.');

    let output = '';
    try {
      let evaled = await eval(`(async () => { ${text.startsWith('return') ? text : (text.includes(';') ? text : `return (${text})`)} })()`);
      if (typeof evaled !== 'string') {
        evaled = util.inspect(evaled, { depth: 2 });
      }
      output = evaled;
    } catch (err) {
      output = err.stack || err.message;
    }

    return m.reply(String(output));
  }
};

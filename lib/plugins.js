/*
        ••JANGAN HAPUS INI••
SCRIPT BY © VYNAA VALERIE 
•• recode kasih credits 
•• contacts: (6282389924037) 
•• (github.com/VynaaValerie) 

•• Join https://whatsapp.com/channel/0029VbCaDhn11ulT1qwodB2x  

• Menerima pemberitahuan web
• Menerima pemberitahuan aplikasi 
• Menerima pembuatan script bot
• Menerima perbaikan script atau fitur bot
• Menerima pembuatan fitur bot
• Menerima semua kebutuhan bot
• Menerima Jadi Bot

ℹ️ Information

• Pembayaran bisa dicicil
• Bisa bayar di awal atau akhir
• Pembayaran melalu QRIS Only
• Testimoni Banyak

Aturan:
1. Dilarang memperjualbelikan script ini.
2. Hak cipta milik Vynaa Valerie.

“Dan janganlah kamu makan harta di antara kamu dengan jalan yang batil, dan janganlah kamu membunuh dirimu sendiri. Sesungguhnya Allah adalah Maha Penyayang kepadamu.” (QS. Al-Baqarah: 188)
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginsDir = path.resolve(__dirname, '../vynaafeture');

export const plugins = new Map();
global.plugins = plugins;

/**
 * Logger dengan tampilan Cosplay persis Google Antigravity CLI (Vynaa AI)
 */
export const logger = {
  banner() {
    console.clear();
    // Logo Rainbow Gradient Vynaa AI (Persis gaya pixel Antigravity)
    console.log(chalk.hex('#FF6B6B')('       ████       '));
    console.log(chalk.hex('#FF9F43')('     ██    ██     '));
    console.log(chalk.hex('#FECA57')('   ██        ██   '));
    console.log(chalk.hex('#1DD1A1')(' ██   ██████   ██ '));
    console.log(chalk.hex('#54A0FF')('██   ██    ██   ██'));
    console.log(chalk.hex('#5F27CD')('██              ██\n'));

    console.log(chalk.cyan.bold('Vynaa AI 1.0.0'));
    console.log(chalk.gray('vynaa.dev@gmail.com (Vynaa AI Pro)'));
    console.log(chalk.gray(`Node ${process.version} (Group Engine)`));
    console.log(chalk.gray('~'));
    console.log(chalk.gray('──────────────────────────────────────────────────\n'));
  },

  info(label, detail = '') {
    console.log(
      chalk.green('• ') +
      chalk.white.bold(label) +
      chalk.gray(`(${detail})`)
    );
  },

  reload(filename, status = 'updated') {
    const color = status === 'loaded' ? chalk.cyan : (status === 'deleted' ? chalk.red : chalk.yellow);
    console.log(
      chalk.yellow('• ') +
      chalk.white.bold('Reload') +
      chalk.gray(`(${filename}) `) +
      color(`(${status})`)
    );
  },

  error(label, detail = '') {
    console.log(
      chalk.red('• ') +
      chalk.red.bold(label) +
      chalk.gray(`(${detail})`)
    );
  },

  cmd(user, command, group) {
    console.log(
      chalk.green('• ') +
      chalk.white.bold('Exec') +
      chalk.gray(`(${command})`) +
      chalk.gray(` (from ${user} in ${group})`)
    );
  }
};

/**
 * Scan semua file .js di dalam folder dan subfolder secara rekursif
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);
    if (file.isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.isFile() && file.name.endsWith('.js')) {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

/**
 * Muat / Muat Ulang satu file plugin secara dinamis
 */
export async function loadPlugin(fullFilePath) {
  if (!fullFilePath.endsWith('.js')) return;

  try {
    const relativeKey = path.relative(pluginsDir, fullFilePath).replace(/\\/g, '/').replace(/\.js$/, '');
    const fileUrl = `${pathToFileURL(fullFilePath).href}?update=${Date.now()}`;
    const module = await import(fileUrl);
    const plugin = module.default || module;

    if (plugin && (plugin.command || plugin.name || typeof plugin.execute === 'function' || typeof plugin.before === 'function')) {
      plugin.filename = path.basename(fullFilePath);
      plugin.filepath = fullFilePath;
      plugin.key = relativeKey;
      plugins.set(relativeKey, plugin);
      return plugin;
    }
  } catch (err) {
    logger.error('PluginError', `${path.basename(fullFilePath)}: ${err.message}`);
  }
}

/**
 * Muat seluruh plugin dari seluruh folder dan subfolder di vynaafeture
 */
export async function loadAllPlugins() {
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }

  plugins.clear();
  const allFiles = getAllFiles(pluginsDir);

  for (const file of allFiles) {
    await loadPlugin(file);
  }

  logger.info('PluginsLoaded', `total ${plugins.size} fitur di folder /vynaafeture`);
}

/**
 * Auto-Watcher Rekursif: Deteksi instan file baru, edit file, hapus file, atau buat folder baru
 */
export function watchPlugins() {
  if (!fs.existsSync(pluginsDir)) return;

  try {
    fs.watch(pluginsDir, { recursive: true }, async (eventType, filename) => {
      if (!filename || (!filename.endsWith('.js') && !filename.includes('.'))) return;

      const fullPath = path.join(pluginsDir, filename);
      const relativeKey = filename.replace(/\\/g, '/').replace(/\.js$/, '');

      // Debounce singkat
      await new Promise((r) => setTimeout(r, 100));

      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile() && filename.endsWith('.js')) {
        const isNew = !plugins.has(relativeKey);
        await loadPlugin(fullPath);
        if (isNew) {
          logger.reload(filename, 'loaded');
        } else {
          logger.reload(filename, 'updated');
        }
      } else if (!fs.existsSync(fullPath)) {
        if (plugins.has(relativeKey)) {
          plugins.delete(relativeKey);
          logger.reload(filename, 'deleted');
        }
      }
    });

    logger.info('AutoWatch', 'recursive listener aktif di /vynaafeture');
  } catch (err) {
    // Fallback watcher
    fs.watch(pluginsDir, async (eventType, filename) => {
      if (!filename || !filename.endsWith('.js')) return;
      const fullPath = path.join(pluginsDir, filename);
      if (fs.existsSync(fullPath)) {
        await loadPlugin(fullPath);
        logger.reload(filename, 'updated');
      }
    });
  }
}

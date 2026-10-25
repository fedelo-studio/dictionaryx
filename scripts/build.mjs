// Builds the static site into dist/: one app.js, styles, vendor libraries, fonts and config.js (from the environment).
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { bankRows, bundleJs, checkDashes, typo } from './bundle.mjs';

const root = new URL('..', import.meta.url).pathname;
const out = root + 'dist/';

// Local runs can keep their keys in .env; Vercel passes them as environment variables.
if (existsSync(root + '.env')) {
  for (const line of readFileSync(root + '.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
if (!supabaseUrl || !supabaseAnonKey) console.warn('Warning: SUPABASE_URL or SUPABASE_ANON_KEY is missing, the site will show a configuration message.');

rmSync(out, { recursive: true, force: true });
mkdirSync(out + 'vendor', { recursive: true });

const rows = bankRows(root + 'src/bank.json');
const js = "(function () {\n'use strict';\n" + bundleJs(root + 'src/', ['core.js', 'platform-web.js', 'ui.js', 'main.js'], rows) + '\n})();\n';
const css = typo(readFileSync(root + 'src/styles.css', 'utf8')).replace('IPAFONT_SRC', 'url("/fonts/dico-ipa.woff2")');
const page = readFileSync(root + 'src/index.html', 'utf8');
for (const [name, text] of [['app.js', js], ['styles.css', css], ['index.html', page]]) checkDashes(name, text);

writeFileSync(out + 'app.js', js);
writeFileSync(out + 'styles.css', css);
writeFileSync(out + 'index.html', page);
writeFileSync(out + 'config.js', 'window.DICTIONARYX_CONFIG = ' + JSON.stringify({ supabaseUrl, supabaseAnonKey }) + ';\n');
cpSync(root + 'public', out, { recursive: true });

const vendor = {
  'preact.umd.js': 'preact/dist/preact.umd.js',
  'hooks.umd.js': 'preact/hooks/dist/hooks.umd.js',
  'htm.umd.js': 'htm/dist/htm.umd.js',
  'supabase.js': '@supabase/supabase-js/dist/umd/supabase.js'
};
for (const [name, from] of Object.entries(vendor)) copyFileSync(root + 'node_modules/' + from, out + 'vendor/' + name);

console.log('Built dist/ with ' + rows.length + ' words.');

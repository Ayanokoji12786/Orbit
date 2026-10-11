// Prepare Expo's generated output for direct `vercel dist` uploads.
const fs = require('node:fs');
const path = require('node:path');

const output = path.join(path.dirname(require.resolve('../package.json')), 'dist');
if (!fs.existsSync(path.join(output, 'index.html'))) {
  throw new Error('Export the web app before preparing its deployment.');
}
// Vercel otherwise ignores the fonts and icons Expo places under assets/node_modules.
fs.writeFileSync(path.join(output, '.vercelignore'), '!assets/node_modules\n!assets/node_modules/**\n');
const { rewrites } = require('../vercel.json');
fs.writeFileSync(path.join(output, 'vercel.json'), JSON.stringify({ framework: null, rewrites }, null, 2));

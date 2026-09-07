const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'node_modules', '@fortawesome', 'fontawesome-free');
const targetRoot = path.join(projectRoot, 'assets');
const sourceCss = path.join(sourceRoot, 'css', 'all.min.css');
const sourceFonts = path.join(sourceRoot, 'webfonts');
const targetFonts = path.join(targetRoot, 'webfonts');

fs.mkdirSync(targetFonts, { recursive: true });
let css = fs.readFileSync(sourceCss, 'utf8');
css = css.replaceAll('../webfonts/', 'webfonts/').replaceAll('font-display:block', 'font-display:swap');
fs.writeFileSync(path.join(targetRoot, 'fontawesome.min.css'), css);

for (const file of fs.readdirSync(sourceFonts)) {
  fs.copyFileSync(path.join(sourceFonts, file), path.join(targetFonts, file));
}

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const catalog = require('./packs/catalog.json');
const app = fs.readFileSync(path.join(root, 'source', 'app.js'), 'utf8');
const bundled = fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8');

const names = Object.freeze({
  earth: 'Earth', moon: 'Moon', mars: 'Mars', mercury: 'Mercury', venus: 'Venus',
  ceres: 'Ceres', vesta: 'Vesta', pluto: 'Pluto'
});
const kinds = Object.freeze({
  earth: 'planet', moon: "Earth's moon", mars: 'planet', mercury: 'planet',
  venus: 'planet', ceres: 'dwarf planet', vesta: 'asteroid',
  pluto: 'dwarf planet'
});
function worldLabelFrom(script) {
  const a = script.indexOf('  const worldKind = {');
  const b = script.indexOf('  const error = ', a);
  assert.ok(a > 0 && b > a, 'World label helper must exist');
  const code = script.slice(a, b);
  return Function('WORLDS', code + '\nreturn worldLabel;')(
    Object.fromEntries(Object.entries(names).map(([id, name]) => [id, { name }]))
  );
}

test('every optional and included dataset displays its destination world clearly', () => {
  const label = worldLabelFrom(app);
  const ids = new Set([...catalog.builtIn, ...catalog.packs].map(p => p.body));
  assert.deepEqual([...ids].sort(), Object.keys(names).sort());
  for (const entry of [...catalog.builtIn, ...catalog.packs]) {
    assert.equal(label(entry.body), 'Applies to: ' + names[entry.body] +
      ' (' + kinds[entry.body] + ')', entry.name);
  }
});

test('desktop build and source page both label installed and optional entries', () => {
  for (const content of [app, bundled]) {
    assert.match(content, /details\.appendChild\(make\('div', worldLabel\(built\.body\), 'tp-data-world'\)\)/);
    assert.match(content, /details\.appendChild\(make\('div', worldLabel\(pack\.body\), 'tp-data-world'\)\)/);
    assert.match(content, /'Download ' \+ pack\.name \+ ' for ' \+ worldName\(pack\.body\)/);
    assert.equal(worldLabelFrom(content)('moon'), "Applies to: Moon (Earth's moon)");
  }
});

test('planet classifications do not imply gas giants or dwarf bodies are moons', () => {
  const label = worldLabelFrom(app);
  assert.equal(label('ceres'), 'Applies to: Ceres (dwarf planet)');
  assert.equal(label('vesta'), 'Applies to: Vesta (asteroid)');
  assert.equal(label('pluto'), 'Applies to: Pluto (dwarf planet)');
  assert.equal(label('mercury'), 'Applies to: Mercury (planet)');
  assert.equal(label('mars'), 'Applies to: Mars (planet)');
});

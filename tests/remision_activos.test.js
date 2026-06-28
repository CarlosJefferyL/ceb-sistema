/**
 * Test de mergeActivos_: dedup de pacientes activos por ID_Paciente con
 * prioridad de origen QUIROFANO > PISO > URGENCIAS, fusionando etiquetas de
 * ubicación. Extrae la función REAL de apps_script.gs y la evalúa en sandbox.
 *
 * Ejecutar:  node tests/remision_activos.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const gs = fs.readFileSync(path.join(__dirname, '..', 'apps_script.gs'), 'utf8');

function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start === -1) throw new Error('No se encontró la función: ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(extractFn(gs, 'mergeActivos_'), sandbox);
const mergeActivos_ = sandbox.mergeActivos_;

let passed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('mergeActivos_:');

test('dedup: mismo paciente en cirugía y piso → 1 entrada, origen QUIROFANO, ubicaciones fusionadas', () => {
  const cx  = [{ idPaciente: 'P1', nombrePaciente: 'Ana', edad: 30, origen: 'QUIROFANO', folioCirugia: 'CX-1', ubicacionTexto: 'Q.X. · LAPE' }];
  const piso= [{ idPaciente: 'P1', nombrePaciente: 'Ana', edad: 30, origen: 'PISO', folioCirugia: '', ubicacionTexto: 'Hab. 203' }];
  const out = mergeActivos_(cx, piso, []);
  assert.strictEqual(out.length, 1, 'debe quedar 1 entrada');
  assert.strictEqual(out[0].origen, 'QUIROFANO', 'gana el origen de mayor prioridad');
  assert.strictEqual(out[0].folioCirugia, 'CX-1', 'conserva el folio de la cirugía');
  assert(out[0].ubicacionTexto.indexOf('Q.X. · LAPE') !== -1 && out[0].ubicacionTexto.indexOf('Hab. 203') !== -1,
    'fusiona ambas etiquetas de ubicación');
});

test('pacientes distintos en las 3 listas → 3 entradas', () => {
  const out = mergeActivos_(
    [{ idPaciente: 'A', nombrePaciente: 'A', origen: 'QUIROFANO', folioCirugia: 'CX', ubicacionTexto: 'Q.X.' }],
    [{ idPaciente: 'B', nombrePaciente: 'B', origen: 'PISO', folioCirugia: '', ubicacionTexto: 'Hab. 1' }],
    [{ idPaciente: 'C', nombrePaciente: 'C', origen: 'URGENCIAS', folioCirugia: '', ubicacionTexto: 'Urgencias' }]
  );
  assert.strictEqual(out.length, 3);
});

test('paciente solo en urgencias → origen URGENCIAS', () => {
  const out = mergeActivos_([], [], [{ idPaciente: 'U', nombrePaciente: 'U', origen: 'URGENCIAS', folioCirugia: '', ubicacionTexto: 'Urgencias' }]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].origen, 'URGENCIAS');
});

test('folio se conserva aunque la cirugía no sea la primera lista', () => {
  const piso = [{ idPaciente: 'P1', nombrePaciente: 'Ana', origen: 'PISO', folioCirugia: '', ubicacionTexto: 'Hab. 5' }];
  const cx   = [{ idPaciente: 'P1', nombrePaciente: 'Ana', origen: 'QUIROFANO', folioCirugia: 'CX-9', ubicacionTexto: 'Q.X.' }];
  const out = mergeActivos_(piso, cx, []);
  assert.strictEqual(out[0].folioCirugia, 'CX-9');
  assert.strictEqual(out[0].origen, 'QUIROFANO');
});

test('entradas sin idPaciente se ignoran', () => {
  const out = mergeActivos_([{ idPaciente: '', nombrePaciente: 'X', origen: 'PISO', ubicacionTexto: 'Hab. 1' }], [], []);
  assert.strictEqual(out.length, 0);
});

console.log(`\n${passed}/5 pruebas pasaron.`);

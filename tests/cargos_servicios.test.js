/**
 * Tests de las funciones puras de agregación de cargos (F2a).
 * Extrae las funciones REALES de apps_script.gs y las corre en sandbox.
 * Ejecutar:  node tests/cargos_servicios.test.js
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
vm.runInContext('function num_(v){var n=parseFloat(v);return isNaN(n)?0:n;}', sandbox);
vm.runInContext('function ocRound_(n){return Math.round((n+Number.EPSILON)*100)/100;}', sandbox);
vm.runInContext(extractFn(gs, 'totalesCargosPorConcepto_'), sandbox);
vm.runInContext(extractFn(gs, 'calcularHospitalizacion_'), sandbox);
const totalesCargosPorConcepto_ = sandbox.totalesCargosPorConcepto_;
const calcularHospitalizacion_ = sandbox.calcularHospitalizacion_;

let passed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('totalesCargosPorConcepto_:');
test('suma por concepto, ignora no-ACTIVO y filas sin concepto', () => {
  const cargos = [
    { Concepto: 'Laboratorio', Importe: 100, Estado: 'ACTIVO' },
    { Concepto: 'Laboratorio', Importe: 50,  Estado: 'ACTIVO' },
    { Concepto: 'Laparoscopio', Importe: 800, Estado: 'ACTIVO' },
    { Concepto: 'Laboratorio', Importe: 999, Estado: 'CANCELADO' },
    { Concepto: '',           Importe: 70,  Estado: 'ACTIVO' }
  ];
  const out = totalesCargosPorConcepto_(cargos);
  assert.strictEqual(out.Laboratorio, 150);
  assert.strictEqual(out.Laparoscopio, 800);
  assert.strictEqual(out[''], undefined);
});
test('lista vacía → objeto vacío', () => {
  assert.deepStrictEqual(totalesCargosPorConcepto_([]), {});
});

console.log('calcularHospitalizacion_:');
test('días × tarifa del tipo de cuarto', () => {
  const tarifas = [{ Tipo_Cuarto: 'PRIVADA', Tarifa_Dia: 1500, Activo: 'SI' },
                   { Tipo_Cuarto: 'SALA_GENERAL', Tarifa_Dia: 800, Activo: 'SI' }];
  assert.strictEqual(calcularHospitalizacion_(3, 'PRIVADA', tarifas), 4500);
});
test('tipo sin tarifa → 0', () => {
  assert.strictEqual(calcularHospitalizacion_(3, 'TERAPIA_INTENSIVA', []), 0);
});
test('0 días → 0', () => {
  const tarifas = [{ Tipo_Cuarto: 'PRIVADA', Tarifa_Dia: 1500, Activo: 'SI' }];
  assert.strictEqual(calcularHospitalizacion_(0, 'PRIVADA', tarifas), 0);
});

console.log(`\n${passed}/5 pruebas pasaron.`);

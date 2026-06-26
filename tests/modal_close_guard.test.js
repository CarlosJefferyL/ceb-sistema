/**
 * Test del guardado contra cierre accidental del modal (pérdida de datos al
 * dar de alta pacientes). Extrae las funciones REALES de index.html y las
 * evalúa en un DOM falso para no divergir del código de producción.
 *
 * Ejecutar:  node tests/modal_close_guard.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// --- Extrae una función por nombre haciendo conteo de llaves -------------
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

// --- DOM falso mínimo ----------------------------------------------------
function makeFakeDoc() {
  const modalContainer = { innerHTML: '' };
  return {
    getElementById(id) { return id === 'modalContainer' ? modalContainer : null; },
    _modalContainer: modalContainer
  };
}

// --- Construye el sandbox con las funciones reales ------------------------
function buildContext(confirmReturn) {
  const doc = makeFakeDoc();
  let confirmCalls = 0;
  const sandbox = {
    document: doc,
    modalSucio: false,
    confirm: (msg) => { confirmCalls++; sandbox._lastConfirmMsg = msg; return confirmReturn; },
    _confirmCalls: () => confirmCalls
  };
  vm.createContext(sandbox);
  const code = [
    extractFn(html, 'openModal'),
    extractFn(html, 'closeModal'),
    extractFn(html, 'intentarCerrarModal'),
  ].join('\n');
  vm.runInContext(code, sandbox);
  return sandbox;
}

let passed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('Modal close guard:');

test('openModal cablea backdrop y × a intentarCerrarModal (no a closeModal directo)', () => {
  const s = buildContext(true);
  vm.runInContext("openModal('Titulo','<form></form>')", s);
  const out = s.document._modalContainer.innerHTML;
  assert(/intentarCerrarModal\(\)/.test(out), 'el markup debe invocar intentarCerrarModal()');
  // El overlay debe marcar el modal como sucio ante input/change del usuario
  assert(/oninput=/.test(out) && /modalSucio\s*=\s*true/.test(out),
    'el overlay debe marcar modalSucio=true ante input del usuario');
});

test('openModal arranca con modalSucio=false', () => {
  const s = buildContext(true);
  s.modalSucio = true;                 // estado sucio previo
  vm.runInContext("openModal('T','C')", s);
  assert.strictEqual(s.modalSucio, false, 'abrir un modal nuevo resetea el flag');
});

test('cierre SIN datos: no pregunta y cierra', () => {
  const s = buildContext(false);
  vm.runInContext("openModal('T','C')", s);
  vm.runInContext("intentarCerrarModal()", s);
  assert.strictEqual(s._confirmCalls(), 0, 'no debe preguntar si no hay datos');
  assert.strictEqual(s.document._modalContainer.innerHTML, '', 'debe cerrar (innerHTML vacío)');
});

test('cierre CON datos + usuario cancela: NO cierra (conserva captura)', () => {
  const s = buildContext(false);       // confirm() => false (usuario dice "seguir")
  vm.runInContext("openModal('T','C')", s);
  s.modalSucio = true;                 // simula que el usuario capturó datos
  vm.runInContext("intentarCerrarModal()", s);
  assert.strictEqual(s._confirmCalls(), 1, 'debe preguntar');
  assert.notStrictEqual(s.document._modalContainer.innerHTML, '', 'el modal debe seguir abierto');
});

test('cierre CON datos + usuario confirma: cierra y resetea flag', () => {
  const s = buildContext(true);        // confirm() => true (usuario acepta perder)
  vm.runInContext("openModal('T','C')", s);
  s.modalSucio = true;
  vm.runInContext("intentarCerrarModal()", s);
  assert.strictEqual(s._confirmCalls(), 1, 'debe preguntar');
  assert.strictEqual(s.document._modalContainer.innerHTML, '', 'debe cerrar');
  assert.strictEqual(s.modalSucio, false, 'cerrar resetea el flag');
});

console.log(`\n${passed}/5 pruebas pasaron.`);

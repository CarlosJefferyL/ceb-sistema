# Cobro F2a — Motor de tarifas + cargos + cobro valorado · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el cobro de caja se auto-alimente con TODOS los conceptos (no solo materiales), porque durante la estancia se capturan cargos de servicios (equipo, lab, imagen, oxígeno, etc.) a precios unitarios, más la hospitalización calculada por días × tarifa de cuarto.

**Architecture:** Backend Google Apps Script: 3 hojas nuevas (`CAT_Servicios`, `Cargos_Paciente`, `CAT_Tarifas_Cuarto`); funciones puras de agregación (`totalesCargosPorConcepto_`, `calcularHospitalizacion_`) testeables en Node; `registrarCargosServicio` (espeja `registrarRemision` sin tocar inventario); y `getDatosPacienteParaCobro` extendido para devolver totales por concepto + hospitalización + total valorado. Frontend: flujo "Cargar servicios" (reusa el selector de pacientes activos de F1) y prellenado de TODOS los campos del cobro.

**Tech Stack:** Google Apps Script (V8), HTML/JS SPA de un solo archivo, Google Sheets. Pruebas: `node tests/*.test.js` (patrón `vm`/`extractFn`). Integración: manual sobre la app + `docs/GUIA_PRUEBAS.md`. Deploy: push a `main` → CI clasp + Pages.

**Spec:** `docs/superpowers/specs/2026-06-28-cobro-f2a-tarifas-cargos-design.md`.

**Convención del repo:** se trabaja en `main`. Helpers existentes a reutilizar (NO redefinir): `sheetToObjects`, `esActivo`, `num_`, `ocRound_`, `todayStr`, `nowTs`, `getConfig`, `tienePermiso`, `errorSinPermiso`, `appendRowByHeader`, `ensureSheetConHeaders_`, `getSheet`, `calcularDiasEstancia`, `dateOnly`. Frontend: `apiGet`, `apiPost`, `openModal`, `closeModal`, `escJs`, `artEsc`, `showToast`, `cjSetVal`, `cjVal`, `moneyOrBlank`, `fmtMoney`, `recalcularCobro`, `getPacientesActivos` (acción backend de F1).

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `apps_script.gs` | Modificar | Claves `SHEETS`; headers + `ensureCargosSheets_`; funciones puras `totalesCargosPorConcepto_`/`calcularHospitalizacion_`; `getCatalogoServicios`/`getCargosPaciente`/`registrarCargosServicio`; extensión de `getDatosPacienteParaCobro` y `getCatalogos`; casos en dispatcher |
| `index.html` | Modificar | Botón "Cargar servicios" + selector de activos + carrito de servicios; prellenado de todos los conceptos en `seleccionarPacienteCobro` |
| `tests/cargos_servicios.test.js` | Crear | Tests de `totalesCargosPorConcepto_` y `calcularHospitalizacion_` |
| `docs/GUIA_PRUEBAS.md` | Modificar | Pruebas manuales + instrucciones de semilla de las 3 hojas |

---

## Task 1: Backend — funciones puras de agregación + tests

**Files:**
- Create: `tests/cargos_servicios.test.js`
- Modify: `apps_script.gs` (agregar las 2 funciones después de `totalRemisionMateriales_`, ~apps_script.gs:2253, antes de `mergeActivos_`)

- [ ] **Step 1: Create `tests/cargos_servicios.test.js`:**

```javascript
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
// num_ y ocRound_ son dependencias de las funciones puras; se definen stubs equivalentes.
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
    { Concepto: 'Laboratorio', Importe: 999, Estado: 'CANCELADO' }, // ignorado
    { Concepto: '',           Importe: 70,  Estado: 'ACTIVO' }      // sin concepto → ignorado
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
```

- [ ] **Step 2: Run `node tests/cargos_servicios.test.js`** → FAIL con "No se encontró la función: totalesCargosPorConcepto_".

- [ ] **Step 3: En `apps_script.gs`, después de la función `totalRemisionMateriales_` (~línea 2253) y ANTES del comentario de `mergeActivos_`, inserta:**

```javascript
/**
 * Suma los importes de cargos de servicios por Concepto (solo ACTIVO).
 * PURA: recibe el arreglo de cargos ya leído. Devuelve { Concepto: total }.
 */
function totalesCargosPorConcepto_(cargos) {
  var acc = {};
  (cargos || []).forEach(function(c) {
    if (String(c.Estado) === 'CANCELADO') return;
    var concepto = String(c.Concepto || '').trim();
    if (!concepto) return;
    acc[concepto] = ocRound_((acc[concepto] || 0) + num_(c.Importe));
  });
  return acc;
}

/**
 * Importe de hospitalización = días × tarifa del tipo de cuarto.
 * PURA: recibe días, tipo y el arreglo de tarifas. 0 si no hay tarifa.
 */
function calcularHospitalizacion_(dias, tipoCuarto, tarifasCuarto) {
  var d = num_(dias);
  if (d <= 0) return 0;
  var tarifa = 0;
  (tarifasCuarto || []).forEach(function(t) {
    if (String(t.Tipo_Cuarto) === String(tipoCuarto)) tarifa = num_(t.Tarifa_Dia);
  });
  return ocRound_(d * tarifa);
}
```

- [ ] **Step 4: Run `node tests/cargos_servicios.test.js`** → PASS `5/5 pruebas pasaron.`

- [ ] **Step 5: Commit**

```bash
git add tests/cargos_servicios.test.js apps_script.gs
git commit -m "Cobro F2a: agregación pura de cargos por concepto + hospitalización (con tests)"
```

---

## Task 2: Backend — hojas nuevas, ensure + catálogos

**Files:**
- Modify: `apps_script.gs` (claves `SHEETS` ~line 56-62; headers + `ensureCargosSheets_`; `getCatalogoServicios`; extender `getCatalogos` ~line 449-464; casos dispatcher GET)

- [ ] **Step 1: Agregar claves a `SHEETS`.** En el objeto `SHEETS` (apps_script.gs:24-63), después de la línea `CAJA: 'Caja',` (línea 56) agrega:

```javascript
  // ---- Módulo F2a: tarifas + cargos de servicios ----
  SERVICIOS: 'CAT_Servicios',
  CARGOS: 'Cargos_Paciente',
  TARIFAS_CUARTO: 'CAT_Tarifas_Cuarto',
```

- [ ] **Step 2: Agregar headers + ensure.** En `apps_script.gs`, justo después de `ensureRemisionSheet_` (~línea 2228), inserta:

```javascript
var CAT_SERVICIOS_HEADERS = ['ID_Servicio','Nombre','Concepto','Precio_Estandar','Es_Tercerizado','Unidad','Activo'];
var CARGOS_HEADERS = ['ID_Cargo','Fecha','Hora','ID_Paciente','Nombre_Paciente','ID_Servicio',
  'Nombre_Servicio','Concepto','Cantidad','Precio_Unitario','Costo_Tercerizado','Importe',
  'Proveedor','Origen','Estado','Capturado_Por','Timestamp_Captura'];
var TARIFAS_CUARTO_HEADERS = ['Tipo_Cuarto','Tarifa_Dia','Activo'];

function ensureCargosSheets_() {
  ensureSheetConHeaders_(SHEETS.SERVICIOS, CAT_SERVICIOS_HEADERS);
  ensureSheetConHeaders_(SHEETS.CARGOS, CARGOS_HEADERS);
  ensureSheetConHeaders_(SHEETS.TARIFAS_CUARTO, TARIFAS_CUARTO_HEADERS);
}

/** Catálogo de servicios activos (para el frontend). */
function getCatalogoServicios() {
  ensureCargosSheets_();
  return { ok: true, data: sheetToObjects(SHEETS.SERVICIOS).filter(function(s){ return esActivo(s.Activo); }) };
}

/** Cargos ACTIVO de un paciente + total. */
function getCargosPaciente(idPaciente) {
  ensureCargosSheets_();
  var rows = sheetToObjects(SHEETS.CARGOS).filter(function(c){
    return String(c.ID_Paciente) === String(idPaciente) && String(c.Estado) !== 'CANCELADO';
  });
  var total = 0;
  rows.forEach(function(c){ total += num_(c.Importe); });
  return { ok: true, data: rows, total: ocRound_(total) };
}
```

- [ ] **Step 3: Extender `getCatalogos`.** En `getCatalogos` (apps_script.gs:441-464): agrega la llamada de ensure junto a las otras (después de `ensureRemisionSheet_();` ~línea 449):

```javascript
  ensureCargosSheets_();      // F2a: servicios, cargos y tarifas de cuarto
```

y dentro del objeto devuelto, después de `insumos: ...,` (línea 464) agrega:

```javascript
    servicios:    sheetToObjects(SHEETS.SERVICIOS).filter(function(s){return esActivo(s.Activo);}),
    tarifasCuarto: sheetToObjects(SHEETS.TARIFAS_CUARTO).filter(function(t){return esActivo(t.Activo);}),
```

- [ ] **Step 4: Casos en el dispatcher GET.** En `apps_script.gs`, después de `case 'getPacientesActivos': result = getPacientesActivos(); break;` (~línea 206), agrega:

```javascript
      case 'getCatalogoServicios': result = getCatalogoServicios(); break;
      case 'getCargosPaciente': result = getCargosPaciente(e.parameter.idPaciente); break;
```

- [ ] **Step 5: Sanity check** `node --check` no aplica a `.gs` directo (extensión); copia a `.js` temporal y corre `node --check apps_script_tmp.js` para confirmar que no hay error de sintaxis; borra el temporal. Reporta el resultado.

- [ ] **Step 6: Commit**

```bash
git add apps_script.gs
git commit -m "Cobro F2a: hojas CAT_Servicios/Cargos_Paciente/CAT_Tarifas_Cuarto + catálogos"
```

---

## Task 3: Backend — `registrarCargosServicio` + dispatcher POST

**Files:**
- Modify: `apps_script.gs` (agregar `registrarCargosServicio` después de `getCargosPaciente`; caso POST ~línea 234)

- [ ] **Step 1: Agregar `registrarCargosServicio`** (después de `getCargosPaciente`):

```javascript
/**
 * Registra N cargos de servicios a la cuenta de un paciente.
 * Espeja registrarRemision pero NO toca inventario ni Libro COFEPRIS.
 * d: { idPaciente, nombrePaciente, origen, items:[{idServicio, nombreServicio,
 *      concepto, cantidad, precioUnitario, costoTercerizado, proveedor}],
 *      capturadoPor, rolUsuario }
 */
function registrarCargosServicio(d) {
  if (!tienePermiso(d.rolUsuario, 'registrar_consumo')) {
    return errorSinPermiso(d.rolUsuario, 'registrar_consumo');
  }
  var items = d.items || [];
  if (!items.length) return { ok: false, error: 'No hay servicios a registrar' };
  if (!d.idPaciente) return { ok: false, error: 'Paciente requerido' };
  if (cuentaCerrada_(d.idPaciente)) {
    return { ok: false, error: 'La cuenta del paciente está CERRADA. Reábrela en Cobro de caja para agregar cargos.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    ensureCargosSheets_();
    var fecha = d.fecha || todayStr();
    var hora = d.hora || Utilities.formatDate(new Date(), getConfig('ZonaHoraria') || 'America/Chihuahua', 'HH:mm');
    var origen = d.origen || 'PISO';
    var base = new Date().getTime();
    var creados = 0, total = 0;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.concepto) return { ok: false, error: 'Falta el concepto de cobro del servicio ' + (it.nombreServicio || it.idServicio || '') };
      var cantidad = parseFloat(it.cantidad);
      if (!cantidad || cantidad <= 0) return { ok: false, error: 'Cantidad inválida para ' + (it.nombreServicio || it.idServicio || '') };
      var precio = num_(it.precioUnitario);
      var importe = ocRound_(precio * cantidad);
      total += importe;
      appendRowByHeader(SHEETS.CARGOS, {
        'ID_Cargo': 'CGO-' + base + '-' + i, 'Fecha': fecha, 'Hora': "'" + hora,
        'ID_Paciente': d.idPaciente, 'Nombre_Paciente': d.nombrePaciente || '',
        'ID_Servicio': it.idServicio || '', 'Nombre_Servicio': it.nombreServicio || '',
        'Concepto': it.concepto, 'Cantidad': cantidad, 'Precio_Unitario': precio,
        'Costo_Tercerizado': num_(it.costoTercerizado), 'Importe': importe,
        'Proveedor': it.proveedor || '', 'Origen': origen, 'Estado': 'ACTIVO',
        'Capturado_Por': d.capturadoPor || '', 'Timestamp_Captura': nowTs()
      });
      creados++;
    }
    return { ok: true, lineas: creados, total: ocRound_(total) };
  } finally {
    lock.releaseLock();
  }
}
```

- [ ] **Step 2: Caso POST.** Después de `case 'registrarRemision':  result = registrarRemision(payload.data); break;` (apps_script.gs:234) agrega:

```javascript
      case 'registrarCargosServicio': result = registrarCargosServicio(payload.data); break;
```

- [ ] **Step 3: Verificar** que `cuentaCerrada_`, `tienePermiso`, `errorSinPermiso`, `appendRowByHeader`, `num_`, `ocRound_`, `todayStr`, `nowTs` existan (grep). Reporta hallazgos. `node --check` sobre copia `.js`.

- [ ] **Step 4: Commit**

```bash
git add apps_script.gs
git commit -m "Cobro F2a: registrarCargosServicio + caso en dispatcher"
```

---

## Task 4: Backend — extender `getDatosPacienteParaCobro`

**Files:**
- Modify: `apps_script.gs` (`getDatosPacienteParaCobro`, apps_script.gs:5537-5610 — el `return` final y el bloque de hospitalización)

- [ ] **Step 1: Calcular y devolver los nuevos campos.** En `getDatosPacienteParaCobro`, localiza la línea que calcula los materiales (cerca del final):

```javascript
  var materialesRemision = totalRemisionMateriales_(pac.ID_Paciente);
```

Inmediatamente DESPUÉS de esa línea, agrega:

```javascript
  // F2a: cargos de servicios agregados por concepto
  ensureCargosSheets_();
  var cargosPac = sheetToObjects(SHEETS.CARGOS).filter(function(c){
    return String(c.ID_Paciente) === String(pac.ID_Paciente);
  });
  var cargosPorConcepto = totalesCargosPorConcepto_(cargosPac);

  // F2a: hospitalización = días × tarifa de cuarto
  var tarifasCuarto = sheetToObjects(SHEETS.TARIFAS_CUARTO).filter(function(t){ return esActivo(t.Activo); });
  var tipoCuarto = hosp ? (hosp.Tipo_Habitacion || '') : '';
  var diasEstancia = 0;
  if (fechaIngreso) {
    var fIng = new Date(String(fechaIngreso).substring(0,10) + 'T00:00:00');
    var fFin = fechaEgreso ? new Date(String(fechaEgreso).substring(0,10) + 'T00:00:00') : new Date();
    fFin.setHours(0,0,0,0);
    diasEstancia = Math.max(0, Math.floor((fFin - fIng) / 86400000));
  }
  var hospitalizacionCalculada = calcularHospitalizacion_(diasEstancia, tipoCuarto, tarifasCuarto);

  var totalCargos = 0;
  Object.keys(cargosPorConcepto).forEach(function(k){ totalCargos += cargosPorConcepto[k]; });
  var totalConsumoValorado = ocRound_(materialesRemision + totalCargos + hospitalizacionCalculada);
```

- [ ] **Step 2: Extender el `return`.** El return actual es:

```javascript
  return { ok: true, paciente: paciente, cirugias: cirugias, cuentaExistente: cuentaExistente, materialesRemision: materialesRemision };
```

Reemplázalo por:

```javascript
  return { ok: true, paciente: paciente, cirugias: cirugias, cuentaExistente: cuentaExistente,
           materialesRemision: materialesRemision, cargosPorConcepto: cargosPorConcepto,
           hospitalizacionCalculada: hospitalizacionCalculada, diasEstancia: diasEstancia,
           totalConsumoValorado: totalConsumoValorado };
```

- [ ] **Step 3: Verificar** que en `getDatosPacienteParaCobro` ya existan las variables `hosp`, `fechaIngreso`, `fechaEgreso` (sí: apps_script.gs:5572, 5574-5579). `node --check` sobre copia `.js`.

- [ ] **Step 4: Commit**

```bash
git add apps_script.gs
git commit -m "Cobro F2a: getDatosPacienteParaCobro devuelve cargos por concepto + hospitalización + total valorado"
```

---

## Task 5: Frontend — flujo "Cargar servicios"

**Files:**
- Modify: `index.html` (botón en el módulo Consumos junto a "Nueva remisión"; variables + funciones nuevas cerca del bloque de remisión, ~index.html:4466)

- [ ] **Step 1: Botón en la barra de Consumos.** Busca el botón existente `🧾 Nueva remisión` (index.html:1024, `onclick="openModalNuevaRemision()"`). Inmediatamente después de ese `<button>...</button>`, agrega:

```html
          <button class="btn btn-accent" data-accion="registrar_consumo" onclick="openModalCargarServicios()">🧰 Cargar servicios</button>
```

- [ ] **Step 2: Variables + selector + carrito.** Cerca de la declaración `let remisionActivos = [];` (index.html:4467), agrega:

```javascript
let cargosActivos = [];
let cargosCart = [];
let cargosCtx = {};
```

Y agrega estas funciones nuevas (junto a las de remisión, p. ej. después de `remisionElegirActivo`):

```javascript
// ---- F2a: Cargar servicios a la cuenta del paciente ----
function openModalCargarServicios() {
  cargosActivos = [];
  openModal('Cargar servicios · elegir paciente', `
    <div class="form-grid"><div class="full">
      <label>Buscar paciente (nombre, CURP o folio)</label>
      <input type="search" id="cs_buscar" oninput="cargosBuscarPaciente()" placeholder="Mín. 2 letras — o elige de la lista" autocomplete="off">
      <div id="cs_resultados" style="max-height:300px;overflow:auto;border:1px solid var(--border);border-radius:8px;margin-top:6px;"><div style="padding:10px;color:var(--text-muted);font-size:13px;">Cargando pacientes activos…</div></div>
    </div></div>
    <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button></div>
  `);
  cargarCargosActivos();
}

async function cargarCargosActivos() {
  const resp = await apiGet('getPacientesActivos');
  cargosActivos = (resp && resp.ok) ? (resp.data || []) : [];
  const buscar = document.getElementById('cs_buscar');
  if (buscar && (buscar.value || '').trim().length >= 2) return;
  cargosRenderActivos();
}

function cargosRenderActivos() {
  const cont = document.getElementById('cs_resultados');
  if (!cont) return;
  cont.innerHTML = cargosActivos.length
    ? cargosActivos.map(p => `<div onclick="cargosElegirActivo('${escJs(p.idPaciente)}')" style="padding:9px 11px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;"><b>${artEsc(p.nombrePaciente)}</b>${p.edad ? ` <small style="color:var(--text-muted);">· ${p.edad} años</small>` : ''}<br><small style="color:var(--teal);">${artEsc(p.ubicacionTexto)}</small></div>`).join('')
    : '<div style="padding:10px;color:var(--text-muted);font-size:13px;">No hay pacientes activos ahora. Usa el buscador.</div>';
}

let cargosBuscarTimer = null;
function cargosBuscarPaciente() {
  const q = (document.getElementById('cs_buscar').value || '').trim();
  const cont = document.getElementById('cs_resultados');
  if (q.length < 2) { cargosRenderActivos(); return; }
  clearTimeout(cargosBuscarTimer);
  cargosBuscarTimer = setTimeout(async () => {
    const resp = await apiGet('buscarPacientesCobro', { q });
    const lista = (resp && resp.ok) ? (resp.resultados || []) : [];
    cont.innerHTML = lista.length
      ? lista.map(p => `<div onclick="cargosElegirPaciente('${escJs(p.idPaciente)}','${escJs(p.nombrePaciente)}')" style="padding:9px 11px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;"><b>${artEsc(p.nombrePaciente)}</b><br><small style="color:var(--text-muted);">${artEsc(p.idPaciente)}</small></div>`).join('')
      : '<div style="padding:10px;color:var(--text-muted);font-size:13px;">Sin resultados.</div>';
  }, 280);
}

function cargosElegirActivo(idPaciente) {
  const p = cargosActivos.find(x => String(x.idPaciente) === String(idPaciente));
  if (!p) return;
  openModalCargos(p.idPaciente, p.nombrePaciente, p.origen);
}
function cargosElegirPaciente(idPaciente, nombre) { openModalCargos(idPaciente, nombre, 'PISO'); }

function openModalCargos(idPaciente, nombre, origen) {
  cargosCart = [];
  cargosCtx = { idPaciente: idPaciente, nombrePaciente: nombre, origen: origen || 'PISO' };
  const servicios = (catalogos.servicios || []);
  if (!servicios.length) { showToast('No hay servicios en el catálogo (CAT_Servicios)', 'error'); return; }
  const opciones = servicios.map(s => `<option value="${artEsc(s.ID_Servicio)}">${artEsc(s.Nombre)} · ${artEsc(s.Concepto)}</option>`).join('');
  openModal('Cargar servicios · ' + artEsc(nombre), `
    <div style="background:var(--teal-light);padding:8px 12px;border-radius:8px;margin-bottom:10px;font-size:12px;color:var(--navy);">Paciente: <b>${artEsc(nombre)}</b> · cada servicio se carga a su cuenta y cae al cobro por su concepto.</div>
    <div class="form-grid">
      <div class="full"><label>Servicio</label><select id="cs_serv" onchange="cargosServChange()"><option value="">— Seleccionar —</option>${opciones}</select></div>
      <div><label>Cantidad</label><input type="number" id="cs_cant" step="any" min="0" value="1"></div>
      <div><label>Precio unitario</label><input type="number" id="cs_precio" step="any" min="0" placeholder="0.00"></div>
      <div id="cs_terceroWrap" style="display:none;"><label>Costo tercerizado</label><input type="number" id="cs_costo" step="any" min="0" placeholder="0.00"></div>
      <div id="cs_provWrap" style="display:none;"><label>Proveedor</label><input type="text" id="cs_prov" placeholder="Quién lo hizo"></div>
      <div style="display:flex;align-items:end;"><button type="button" class="btn btn-secondary btn-sm" onclick="cargosAgregar()">+ Agregar</button></div>
    </div>
    <div id="cs_cartBox" style="margin-top:10px;"></div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
      <button type="button" class="btn btn-primary" onclick="submitCargos()">Registrar cargos</button>
    </div>
  `);
  cargosRenderCart();
}

function cargosServSel() {
  const id = document.getElementById('cs_serv').value;
  return (catalogos.servicios || []).find(s => String(s.ID_Servicio) === String(id));
}
function cargosServChange() {
  const s = cargosServSel();
  const esTerc = s && String(s.Es_Tercerizado).toUpperCase() === 'SI';
  document.getElementById('cs_terceroWrap').style.display = esTerc ? '' : 'none';
  document.getElementById('cs_provWrap').style.display = esTerc ? '' : 'none';
  document.getElementById('cs_precio').value = s ? (s.Precio_Estandar || '') : '';
}

function cargosAgregar() {
  const s = cargosServSel();
  if (!s) { showToast('Selecciona un servicio', 'error'); return; }
  const cant = parseFloat(document.getElementById('cs_cant').value);
  if (!cant || cant <= 0) { showToast('Cantidad inválida', 'error'); return; }
  const precio = parseFloat(document.getElementById('cs_precio').value) || 0;
  const esTerc = String(s.Es_Tercerizado).toUpperCase() === 'SI';
  cargosCart.push({
    idServicio: s.ID_Servicio, nombreServicio: s.Nombre, concepto: s.Concepto,
    cantidad: cant, precioUnitario: precio,
    costoTercerizado: esTerc ? (parseFloat(document.getElementById('cs_costo').value) || 0) : 0,
    proveedor: esTerc ? (document.getElementById('cs_prov').value || '') : '',
    importe: Math.round(precio * cant * 100) / 100
  });
  cargosRenderCart();
  document.getElementById('cs_serv').value = '';
  document.getElementById('cs_cant').value = '1';
  cargosServChange();
}

function cargosQuitar(i) { cargosCart.splice(i, 1); cargosRenderCart(); }

function cargosRenderCart() {
  const box = document.getElementById('cs_cartBox');
  if (!box) return;
  if (!cargosCart.length) { box.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Carrito vacío.</div>'; return; }
  let total = 0;
  const filas = cargosCart.map((c, i) => {
    total += c.importe;
    return `<tr><td>${artEsc(c.nombreServicio)}<br><small style="color:var(--text-muted);">${artEsc(c.concepto)}</small></td><td>${c.cantidad}</td><td>${fmtMoney(c.precioUnitario)}</td><td>${fmtMoney(c.importe)}</td><td><span style="cursor:pointer;color:var(--danger);" onclick="cargosQuitar(${i})">✕</span></td></tr>`;
  }).join('');
  box.innerHTML = `<table style="width:100%;font-size:13px;"><thead><tr><th>Servicio</th><th>Cant.</th><th>P. unit.</th><th>Importe</th><th></th></tr></thead><tbody>${filas}</tbody></table><div style="text-align:right;font-weight:700;margin-top:6px;">Total: ${fmtMoney(total)}</div>`;
}

async function submitCargos() {
  if (!cargosCart.length) { showToast('Agrega al menos un servicio', 'error'); return; }
  const data = {
    idPaciente: cargosCtx.idPaciente, nombrePaciente: cargosCtx.nombrePaciente,
    origen: cargosCtx.origen,
    items: cargosCart.map(c => ({ idServicio: c.idServicio, nombreServicio: c.nombreServicio,
      concepto: c.concepto, cantidad: c.cantidad, precioUnitario: c.precioUnitario,
      costoTercerizado: c.costoTercerizado, proveedor: c.proveedor })),
    capturadoPor: (typeof usuarioActual !== 'undefined' && usuarioActual) ? usuarioActual.nombre : ''
  };
  const resp = await apiPost('registrarCargosServicio', data);
  if (resp && resp.ok) {
    showToast(`✅ ${resp.lineas} cargo(s) · ${fmtMoney(resp.total)}`);
    closeModal();
  } else {
    showToast('Error: ' + ((resp && resp.error) || 'no se pudo registrar'), 'error');
  }
}
```

> Nota: `capturadoPor` usa `usuarioActual.nombre` igual que el resto del frontend. Si el nombre de esa variable difiere, el implementador debe usar el patrón real de la sesión (buscar cómo `submitRemision` arma `capturadoPor`). Verifícalo antes de cerrar.

- [ ] **Step 3: Verificar** cómo arma `submitRemision` el `capturadoPor` (index.html, busca `capturadoPor` dentro de `submitRemision`) y ajustar `submitCargos` para que use exactamente el mismo patrón. Confirmar que `catalogos.servicios` se llena (depende de Task 2 desplegada; en local basta con que el código lo lea). Confirmar `fmtMoney`, `artEsc`, `escJs`, `apiGet`, `apiPost`, `showToast`, `openModal`, `closeModal` existen.

- [ ] **Step 4: Verificación manual** (tras desplegar): el botón "🧰 Cargar servicios" abre el selector de activos; eliges paciente; agregas un servicio normal y uno tercerizado (con costo); registras; sin errores.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Cobro F2a: flujo Cargar servicios (selector de activos + carrito)"
```

---

## Task 6: Frontend — prellenar todos los conceptos en el cobro

**Files:**
- Modify: `index.html` (`seleccionarPacienteCobro` index.html:8224-8243; agregar función `aplicarCargosConcepto`)

- [ ] **Step 1: Agregar la función de prellenado.** Junto a `aplicarMaterialesRemision` (index.html:8295), agrega:

```javascript
// F2a: mapa concepto → campo del formulario de cobro
const CONCEPTO_CAMPO_COBRO = {
  Hospitalizacion:'cj_hospitalizacion', Consulta_Externa:'cj_consultaExterna',
  Hora_Extra:'cj_horaExtra', Dia_Extra:'cj_diaExtra', Oxigeno:'cj_oxigeno',
  Paquete_Globular:'cj_paqueteGlobular', Noche_Terapia:'cj_nocheTerapia',
  Bomba_Infusion:'cj_bombaInfusion', Fluoroscopio:'cj_fluoroscopio',
  Laparoscopio:'cj_laparoscopio', Artroscopio:'cj_artroscopio', Ligasure:'cj_ligasure',
  Ambulancia:'cj_ambulancia', Monitor:'cj_monitor', Ventilador:'cj_ventilador',
  Laboratorio:'cj_laboratorio', Imagen:'cj_imagen', Anestesia_Mixta:'cj_anestesiaMixta'
};

// F2a: aplica los cargos por concepto + hospitalización calculada a los campos del cobro
function aplicarCargosConcepto(cargosPorConcepto, hospitalizacionCalculada) {
  const mapa = cargosPorConcepto || {};
  Object.keys(mapa).forEach(concepto => {
    const campo = CONCEPTO_CAMPO_COBRO[concepto];
    if (campo && mapa[concepto] > 0) cjSetVal(campo, moneyOrBlank(mapa[concepto]));
  });
  if (hospitalizacionCalculada && hospitalizacionCalculada > 0) {
    cjSetVal('cj_hospitalizacion', moneyOrBlank(hospitalizacionCalculada));
  }
  recalcularCobro();
}
```

- [ ] **Step 2: Llamarla en ambos caminos de `seleccionarPacienteCobro`.** En `seleccionarPacienteCobro` (index.html:8224), en el camino de cuenta existente, después de la línea `aplicarMaterialesRemision(resp.materialesRemision);` (índice 8236) agrega:

```javascript
    aplicarCargosConcepto(resp.cargosPorConcepto, resp.hospitalizacionCalculada);
```

Y en el camino de cuenta nueva, después del bloque que arma honorarios/cirugías (al final de la función, justo antes de su `}` de cierre — después de aplicar `aplicarMaterialesRemision` si existe ahí, o tras `renderListaCirugias();`), agrega la misma llamada. Para localizar el punto exacto: en el camino de cuenta nueva NO existe hoy una llamada a `aplicarMaterialesRemision`; agrégala junto con la de cargos al final del bloque de cuenta nueva:

```javascript
    aplicarMaterialesRemision(resp.materialesRemision);
    aplicarCargosConcepto(resp.cargosPorConcepto, resp.hospitalizacionCalculada);
```

> El implementador debe confirmar que en el camino de cuenta nueva estas dos llamadas queden DESPUÉS de `limpiarCobro()` (para no ser borradas) y al final del armado del formulario. `limpiarCobro()` está al inicio del bloque de cuenta nueva (index.html:8246), así que agregarlas al final del bloque es seguro.

- [ ] **Step 3: Verificar** que `cjSetVal`, `moneyOrBlank`, `recalcularCobro` existen y que los ids `cj_*` del mapa coinciden con el formulario (index.html:1345-1382). Grep cada id del mapa para confirmar 1 ocurrencia en el form.

- [ ] **Step 4: Verificación manual** (tras desplegar): cargar servicios a un paciente, luego abrir Cobro y seleccionarlo → los campos de esos conceptos se prellenan con la suma; hospitalización = días × tarifa; el Total Cuenta refleja todo; re-seleccionar refresca.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Cobro F2a: el cobro prellena todos los conceptos (cargos + hospitalización)"
```

---

## Task 7: Docs — pruebas + semilla de hojas

**Files:**
- Modify: `docs/GUIA_PRUEBAS.md`

- [ ] **Step 1: Agregar sección.** Al final de `docs/GUIA_PRUEBAS.md` agrega:

```markdown

## 7. Cargos de servicios → cobro valorado (F2a)

**Semilla de datos (una vez, en el Google Sheet):**
- `CAT_Tarifas_Cuarto`: una fila por tipo de cuarto con su `Tarifa_Dia` y `Activo=SI` (PRIVADA, SALA_GENERAL, TERAPIA_INTENSIVA, URGENCIAS).
- `CAT_Servicios`: una fila por servicio cobrable con `ID_Servicio`, `Nombre`, `Concepto` (una de las claves del cobro: Laparoscopio, Laboratorio, Imagen, Oxigeno, Hora_Extra, etc.), `Precio_Estandar`, `Es_Tercerizado` (SI/NO), `Activo=SI`. **No** crees servicios con `Concepto=Hospitalizacion` (reservado al cálculo automático).

**Pruebas:**
22. [ ] **Consumos → 🧰 Cargar servicios**: abre el selector de pacientes activos; elige uno.
23. [ ] Agrega un servicio normal (ej. Laboratorio) con cantidad y precio; agrega uno **tercerizado** (aparecen campos de **costo** y **proveedor**). Registra.
24. [ ] **Cobro de caja** → selecciona al paciente: los campos del cobro (Laboratorio, etc.) se **prellenan sumados** por concepto; **Hospitalización** = días de estancia × tarifa del cuarto.
25. [ ] Cada campo prellenado es **editable**; el **Total Cuenta** refleja todo. Re-seleccionar al paciente **refresca**.
26. [ ] En la hoja `Cargos_Paciente`: el cargo tercerizado guardó `Costo_Tercerizado`. Un rol sin `registrar_consumo` no ve el botón "Cargar servicios".
```

- [ ] **Step 2: Commit**

```bash
git add docs/GUIA_PRUEBAS.md
git commit -m "docs: pruebas F2a + semilla de CAT_Servicios/CAT_Tarifas_Cuarto"
```

---

## Task 8: Desplegar y verificar end-to-end

**Files:** ninguno

- [ ] **Step 1: Tests** `node tests/cargos_servicios.test.js` y `node tests/remision_activos.test.js` → ambos verdes.
- [ ] **Step 2: Push a `main`** (CI: clasp backend + Pages frontend). Confirmar ambos runs en success (`gh run list`).
- [ ] **Step 3: Sembrar** `CAT_Servicios` y `CAT_Tarifas_Cuarto` en el Sheet (paso de datos, lo hace Carlos).
- [ ] **Step 4: Recargar la app (Ctrl+Shift+R)** y correr la checklist 22–26 de `GUIA_PRUEBAS.md`.

---

## Self-Review (cobertura del spec)

- **A. Hojas nuevas** (CAT_Servicios, Cargos_Paciente, CAT_Tarifas_Cuarto) → Task 2. ✓
- **B. Contrato de conceptos** (mapa canónico) → Task 6 (`CONCEPTO_CAMPO_COBRO`) + spec. ✓
- **C. Hospitalización reservada al auto-cálculo** → Task 4 (no se mapea cargo a Hospitalizacion; el campo se setea con `hospitalizacionCalculada`) + docs Task 7 (no sembrar servicios con ese concepto). ✓
- **D. registrarCargosServicio (sin inventario)** → Task 3. ✓
- **E. getDatosPacienteParaCobro extendido** (cargosPorConcepto, hospitalizacionCalculada, totalConsumoValorado) → Task 4. ✓
- **F. Captura (selector activos + carrito)** → Task 5. ✓
- **G. Cobro prellena todos los campos** → Task 6. ✓
- **H. Costo de tercerizados almacenado** → Task 3 (`Costo_Tercerizado`). ✓
- **I. Funciones puras testeables** → Task 1. ✓
- **Fuera de alcance** (paquetes, reporte margen, precios por cliente, edición de cargos) → no hay tareas (correcto). ✓
- Consistencia de nombres: `totalesCargosPorConcepto_`, `calcularHospitalizacion_`, `registrarCargosServicio`, `getCatalogoServicios`, `getCargosPaciente`, `ensureCargosSheets_`, `cargosPorConcepto`, `hospitalizacionCalculada`, `CONCEPTO_CAMPO_COBRO`, `aplicarCargosConcepto` usados igual en todas las tareas. ✓
- Placeholders: las dos notas de "verificar patrón real" (capturadoPor; punto de inserción en cuenta nueva) son pasos de verificación con instrucción concreta, no placeholders de código. ✓
```

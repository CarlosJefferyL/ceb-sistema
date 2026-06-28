# Remisión: pacientes activos + botones Q.X./Urgencias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que iniciar una remisión sea rápido: mostrar la lista de pacientes activos (hospitalizados + cirugías de hoy + urgencias de hoy) en el modal de remisión, y agregar botones "Nueva remisión" desde Programación Q.X. y Urgencias (Habitaciones ya lo tiene), soportando un nuevo origen `URGENCIAS`.

**Architecture:** Backend Google Apps Script (`apps_script.gs`) expone una acción nueva `getPacientesActivos` que combina 3 fuentes existentes (`getTableroHabitaciones`, hoja `Cirugias`, hoja `Consultas`) y deduplica con una función pura `mergeActivos_`. El frontend SPA (`index.html`) pinta esa lista por defecto en el modal de remisión, conserva el buscador actual, y añade botones que llaman a la función ya existente `openModalRemision(idPaciente, nombre, origen, folioCirugia)`.

**Tech Stack:** Google Apps Script (V8), HTML/JS SPA de un solo archivo, Google Sheets como BD. Pruebas: scripts `node tests/*.test.js` que extraen funciones reales por nombre y las corren en un sandbox `vm` (sin jest, sin package.json). Verificación de integración: manual sobre la app desplegada, siguiendo `docs/GUIA_PRUEBAS.md`.

**Desviaciones del spec (decididas al planear):**
- El spec pedía agregar `idPaciente` a `getProgramacionDia`. **No es necesario:** el detalle de cirugía (`verDetalleProgramacion`, index.html:2212) ya usa `cache.cirugias` (filas completas) y tiene `c.ID_Paciente` y `c.Nombre_Paciente`. Esa tarea se elimina.
- El merge/dedup se aísla en una función pura `mergeActivos_` para poder probarlo en Node (el resto se valida manual, como el resto del proyecto).

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `apps_script.gs` | Modificar | +`mergeActivos_` (pura, dedup) +`getPacientesActivos` (lee 3 fuentes) +caso en el dispatcher |
| `index.html` | Modificar | Modal de remisión con lista de activos + restaurar buscador; opción `URGENCIAS` en dropdown; botón en `verDetalleProgramacion`; botón en `renderListaConsultas` |
| `tests/remision_activos.test.js` | Crear | Prueba unitaria de `mergeActivos_` (patrón `vm` + `extractFn`) |
| `docs/GUIA_PRUEBAS.md` | Modificar | Ítems de prueba manuales para la lista de activos y los botones |

---

## Task 1: Backend — función pura `mergeActivos_` (dedup por paciente)

**Files:**
- Create: `tests/remision_activos.test.js`
- Modify: `apps_script.gs` (agregar `mergeActivos_` junto a las utilidades de remisión, p. ej. después de `totalRemisionMateriales_`, ~apps_script.gs:2253)

- [ ] **Step 1: Write the failing test**

Create `tests/remision_activos.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/remision_activos.test.js`
Expected: FAIL con `Error: No se encontró la función: mergeActivos_` (aún no existe en `apps_script.gs`).

- [ ] **Step 3: Write minimal implementation**

En `apps_script.gs`, justo después de la función `totalRemisionMateriales_` (~apps_script.gs:2253), agrega:

```javascript
/**
 * Une varias listas de pacientes activos y deduplica por idPaciente.
 * El origen del paciente duplicado gana por prioridad QUIROFANO > PISO > URGENCIAS;
 * las etiquetas de ubicación se concatenan. Función PURA (sin SpreadsheetApp).
 * Cada entrada de entrada: {idPaciente, nombrePaciente, edad, origen, folioCirugia, ubicacionTexto}
 */
function mergeActivos_() {
  var prioridad = { QUIROFANO: 3, PISO: 2, URGENCIAS: 1 };
  var listas = Array.prototype.slice.call(arguments);
  var porId = {};
  listas.forEach(function(lista) {
    (lista || []).forEach(function(e) {
      var id = String(e.idPaciente || '');
      if (!id) return;
      if (!porId[id]) {
        porId[id] = {
          idPaciente: id,
          nombrePaciente: e.nombrePaciente || '',
          edad: e.edad || '',
          origen: e.origen,
          folioCirugia: e.folioCirugia || '',
          ubicaciones: e.ubicacionTexto ? [e.ubicacionTexto] : []
        };
      } else {
        var cur = porId[id];
        if ((prioridad[e.origen] || 0) > (prioridad[cur.origen] || 0)) {
          cur.origen = e.origen;
          if (e.folioCirugia) cur.folioCirugia = e.folioCirugia;
        }
        if (!cur.folioCirugia && e.folioCirugia) cur.folioCirugia = e.folioCirugia;
        if (!cur.nombrePaciente && e.nombrePaciente) cur.nombrePaciente = e.nombrePaciente;
        if (!cur.edad && e.edad) cur.edad = e.edad;
        if (e.ubicacionTexto && cur.ubicaciones.indexOf(e.ubicacionTexto) === -1) {
          cur.ubicaciones.push(e.ubicacionTexto);
        }
      }
    });
  });
  var out = Object.keys(porId).map(function(id) {
    var e = porId[id];
    return {
      idPaciente: e.idPaciente,
      nombrePaciente: e.nombrePaciente,
      edad: e.edad,
      origen: e.origen,
      folioCirugia: e.folioCirugia,
      ubicacionTexto: e.ubicaciones.join(' · ')
    };
  });
  out.sort(function(a, b) {
    return String(a.ubicacionTexto).localeCompare(String(b.ubicacionTexto)) ||
           String(a.nombrePaciente).localeCompare(String(b.nombrePaciente));
  });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/remision_activos.test.js`
Expected: PASS — `5/5 pruebas pasaron.`

- [ ] **Step 5: Commit**

```bash
git add tests/remision_activos.test.js apps_script.gs
git commit -m "Remisión F1: mergeActivos_ — dedup de pacientes activos (con test)"
```

---

## Task 2: Backend — `getPacientesActivos()` + caso en el dispatcher

**Files:**
- Modify: `apps_script.gs` (agregar `getPacientesActivos` después de `mergeActivos_`; agregar caso en el dispatcher ~apps_script.gs:205)

**Verificación:** Esta función lee Google Sheets (`SpreadsheetApp`), así que no se prueba en Node. Se valida manualmente en la app desplegada (Task 7 + GUIA_PRUEBAS). Aquí solo se revisa que el código sea coherente con las fuentes ya existentes.

- [ ] **Step 1: Agregar `getPacientesActivos`**

En `apps_script.gs`, después de `mergeActivos_`, agrega:

```javascript
/**
 * Pacientes "activos ahora" para la lista rápida de remisión:
 * hospitalizados (PISO), cirugías de HOY (QUIROFANO) y urgencias de HOY (URGENCIAS).
 * Deduplicados por ID_Paciente vía mergeActivos_.
 */
function getPacientesActivos() {
  var hoy = todayStr();
  var tz = getConfig('ZonaHoraria') || 'America/Chihuahua';
  function dStr(d) {
    if (!d) return '';
    if (d instanceof Date) return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    return String(d).substring(0, 10);
  }

  // 1) Hospitalizados (cuartos ocupados) -> PISO
  var hospArr = [];
  try {
    var tablero = getTableroHabitaciones();
    (tablero.habitaciones || []).forEach(function(h) {
      if (h.ocupada && h.hospitalizacion && h.hospitalizacion.idPaciente) {
        hospArr.push({
          idPaciente: String(h.hospitalizacion.idPaciente),
          nombrePaciente: h.hospitalizacion.nombrePaciente || '',
          edad: h.hospitalizacion.edadPaciente || '',
          origen: 'PISO',
          folioCirugia: '',
          ubicacionTexto: 'Hab. ' + (h.numero || '?')
        });
      }
    });
  } catch (err) {}

  // 2) Cirugías de hoy -> QUIROFANO
  var cxArr = [];
  try {
    sheetToObjects(SHEETS.CIRUGIAS).forEach(function(r) {
      if (dStr(r.Fecha_Programada) === hoy && r.Estado !== 'CANCELADA' && r.ID_Paciente) {
        cxArr.push({
          idPaciente: String(r.ID_Paciente),
          nombrePaciente: r.Nombre_Paciente || '',
          edad: r.Edad_Paciente || '',
          origen: 'QUIROFANO',
          folioCirugia: r.Folio_Cirugia || '',
          ubicacionTexto: 'Q.X. · ' + (r.Tipo_Cirugia || '')
        });
      }
    });
  } catch (err) {}

  // 3) Urgencias de hoy -> URGENCIAS
  var urgArr = [];
  try {
    sheetToObjects(SHEETS.CONSULTAS).forEach(function(r) {
      if (String(r.Tipo).toUpperCase() === 'URGENCIA' && dStr(r.Fecha) === hoy && r.ID_Paciente) {
        urgArr.push({
          idPaciente: String(r.ID_Paciente),
          nombrePaciente: r.Nombre_Paciente || '',
          edad: '',
          origen: 'URGENCIAS',
          folioCirugia: '',
          ubicacionTexto: 'Urgencias'
        });
      }
    });
  } catch (err) {}

  return { ok: true, data: mergeActivos_(cxArr, hospArr, urgArr) };
}
```

- [ ] **Step 2: Agregar el caso en el dispatcher**

En `apps_script.gs:205`, después de la línea:

```javascript
      case 'getDatosPacienteParaCobro': result = getDatosPacienteParaCobro(e.parameter.idPaciente); break;
```

agrega:

```javascript
      case 'getPacientesActivos': result = getPacientesActivos(); break;
```

- [ ] **Step 3: Revisión de coherencia (sin ejecutar)**

Verifica que existan y se usen igual que en el resto del archivo:
- `todayStr()` (usado en `getProgramacionDia`, apps_script.gs:775) ✓
- `getConfig('ZonaHoraria')` ✓
- `SHEETS.CIRUGIAS`, `SHEETS.CONSULTAS` ✓
- `getTableroHabitaciones()` devuelve `{ habitaciones: [{ ocupada, numero, hospitalizacion:{ idPaciente, nombrePaciente, edadPaciente } }] }` (apps_script.gs:3837-3861) ✓

- [ ] **Step 4: Commit**

```bash
git add apps_script.gs
git commit -m "Remisión F1: getPacientesActivos (hospitalizados + Q.X. hoy + urgencias hoy)"
```

---

## Task 3: Frontend — lista de activos en el modal de remisión + restaurar buscador

**Files:**
- Modify: `index.html` (`openModalNuevaRemision` index.html:4476-4485; `remisionBuscarPaciente` index.html:4487-4500; agregar variable y funciones nuevas)

**Verificación:** manual en la app (Task 7). Funciones dependen de DOM + `apiGet`.

- [ ] **Step 1: Declarar la variable de estado de la lista de activos**

Busca la línea donde se declara `remisionBuscarTimer` (variable que ya existe, usada en `remisionBuscarPaciente`). Justo al lado, agrega la declaración de `remisionActivos`. Si `remisionBuscarTimer` está declarada como `let remisionBuscarTimer;`, agrega en la línea siguiente:

```javascript
let remisionActivos = [];
```

(Si `remisionBuscarTimer` no estuviera declarada explícitamente, agrégala también: `let remisionBuscarTimer;`)

- [ ] **Step 2: Reemplazar `openModalNuevaRemision`**

Reemplaza el bloque completo de `openModalNuevaRemision` (index.html:4476-4485) por:

```javascript
function openModalNuevaRemision() {
  remisionActivos = [];
  openModal('Nueva remisión · elegir paciente', `
    <div class="form-grid"><div class="full">
      <label>Buscar paciente (nombre, CURP o folio)</label>
      <input type="search" id="rm_buscar" oninput="remisionBuscarPaciente()" placeholder="Mín. 2 letras — o elige de la lista" autocomplete="off">
      <div id="rm_resultados" style="max-height:300px;overflow:auto;border:1px solid var(--border);border-radius:8px;margin-top:6px;"><div style="padding:10px;color:var(--text-muted);font-size:13px;">Cargando pacientes activos…</div></div>
    </div></div>
    <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button></div>
  `);
  cargarRemisionActivos();
}

async function cargarRemisionActivos() {
  const resp = await apiGet('getPacientesActivos');
  remisionActivos = (resp && resp.ok) ? (resp.data || []) : [];
  const buscar = document.getElementById('rm_buscar');
  // Si el usuario ya empezó a buscar, no piso su búsqueda
  if (buscar && (buscar.value || '').trim().length >= 2) return;
  remisionRenderActivos();
}

function remisionRenderActivos() {
  const cont = document.getElementById('rm_resultados');
  if (!cont) return;
  cont.innerHTML = remisionActivos.length
    ? remisionActivos.map(p => `<div onclick="remisionElegirActivo('${escJs(p.idPaciente)}')" style="padding:9px 11px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;"><b>${artEsc(p.nombrePaciente)}</b>${p.edad ? ` <small style="color:var(--text-muted);">· ${p.edad} años</small>` : ''}<br><small style="color:var(--teal);">${artEsc(p.ubicacionTexto)}</small></div>`).join('')
    : '<div style="padding:10px;color:var(--text-muted);font-size:13px;">No hay pacientes activos ahora. Usa el buscador.</div>';
}

function remisionElegirActivo(idPaciente) {
  const p = remisionActivos.find(x => String(x.idPaciente) === String(idPaciente));
  if (!p) return;
  openModalRemision(p.idPaciente, p.nombrePaciente, p.origen, p.folioCirugia);
}
```

- [ ] **Step 3: Modificar `remisionBuscarPaciente` para restaurar la lista al borrar**

En `remisionBuscarPaciente` (index.html:4487-4500), reemplaza la línea:

```javascript
  if (q.length < 2) { cont.style.display = 'none'; return; }
```

por:

```javascript
  if (q.length < 2) { remisionRenderActivos(); return; }
```

(El resto de la función queda igual; la línea `cont.style.display = 'block';` dentro del `setTimeout` es inofensiva porque el contenedor ya no nace oculto.)

- [ ] **Step 4: Verificación manual**

Despliega (o prueba local si tienes un mock) y abre **Medicamentos → 🧾 Nueva remisión**. Confirma:
- Aparece "Cargando pacientes activos…" y luego la lista con badges de ubicación.
- Escribir ≥2 letras filtra a todos los pacientes (buscador de siempre).
- Borrar el campo regresa la lista de activos sin recargar la app.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Remisión F1: lista de pacientes activos en el modal (conserva buscador)"
```

---

## Task 4: Frontend — opción `URGENCIAS` en el dropdown de Origen

**Files:**
- Modify: `index.html` (dropdown de origen en `openModalRemision`, index.html:4520)

- [ ] **Step 1: Reemplazar el `<select id="rm_origen">`**

En `openModalRemision` (index.html:4520), reemplaza:

```html
      <div><label>Origen</label><select id="rm_origen"><option value="QUIROFANO" ${origen !== 'PISO' ? 'selected' : ''}>Quirófano</option><option value="PISO" ${origen === 'PISO' ? 'selected' : ''}>Piso</option></select></div>
```

por:

```html
      <div><label>Origen</label><select id="rm_origen"><option value="QUIROFANO" ${(!origen || origen === 'QUIROFANO') ? 'selected' : ''}>Quirófano</option><option value="PISO" ${origen === 'PISO' ? 'selected' : ''}>Piso</option><option value="URGENCIAS" ${origen === 'URGENCIAS' ? 'selected' : ''}>Urgencias</option></select></div>
```

- [ ] **Step 2: Verificación manual**

Abre una remisión desde la lista de activos eligiendo un paciente de urgencias → el dropdown Origen debe mostrar **Urgencias** preseleccionado. Para uno de cirugía → **Quirófano**. Para hospitalizado → **Piso**.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Remisión F1: origen URGENCIAS en el formulario de remisión"
```

---

## Task 5: Frontend — botón "Nueva remisión" en Programación Q.X.

**Files:**
- Modify: `index.html` (`verDetalleProgramacion`, dentro del bloque `acciones`, index.html:2230-2288)

- [ ] **Step 1: Agregar el botón en `acciones`**

En `verDetalleProgramacion`, justo después del bloque de acciones de flujo (después de la línea index.html:2253 que cierra el `else if (estado === 'CONSUMO_REGISTRADO' || ...)`), e **inmediatamente antes** de la línea `// ¿La cirugía tiene paciente registrado del catálogo?` (index.html:2255), inserta:

```javascript
    // Remisión directa (consumos a la cuenta del paciente) desde la cirugía
    if (puede('registrar_consumo') && c.ID_Paciente) {
      acciones += `<button class="btn btn-accent btn-sm" onclick="closeModal();openModalRemision('${escJs(c.ID_Paciente)}','${escJs(c.Nombre_Paciente)}','QUIROFANO','${escJs(folio)}')">🧾 Nueva remisión</button> `;
    }
```

- [ ] **Step 2: Verificación manual**

Abre **Programación Q.X.** → clic en una cirugía de hoy (con paciente registrado) → en el detalle aparece **🧾 Nueva remisión**. Al darle, abre el formulario de remisión con ese paciente, origen Quirófano y el folio precargado. Confirma que NO aparece para roles sin `registrar_consumo`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Remisión F1: botón Nueva remisión en el detalle de Programación Q.X."
```

---

## Task 6: Frontend — botón "Remisión" en la lista de Urgencias

**Files:**
- Modify: `index.html` (`renderListaConsultas` index.html:5293-5316; `renderUrgencias` index.html:5322-5324)

- [ ] **Step 1: Agregar parámetro `origenRemision` a `renderListaConsultas`**

Reemplaza la firma y el cuerpo de `renderListaConsultas` (index.html:5293-5316) por:

```javascript
// Render genérico para ambos tipos. Si origenRemision viene (ej. 'URGENCIAS'),
// y el usuario tiene permiso, agrega una columna con botón de remisión por fila.
function renderListaConsultas(lista, searchValue, contId, origenRemision) {
  let rows = lista.slice();
  const search = (searchValue || '').toLowerCase();
  if (search) {
    rows = rows.filter(c =>
      (c.Nombre_Paciente||'').toLowerCase().includes(search) ||
      (c.Nombre_Medico||'').toLowerCase().includes(search)
    );
  }
  const conAcc = !!origenRemision && puede('registrar_consumo');
  const html = rows.map(c => `
    <tr>
      <td>${c.Folio||'—'}</td>
      <td>${formatDateShort(c.Fecha)}<br><small>${c.Hora||''}</small></td>
      <td><strong>${c.Nombre_Paciente||'—'}</strong></td>
      <td>${c.Nombre_Medico||'—'}</td>
      <td>${c.Motivo||'—'}</td>
      <td>${c.Indicaciones||'—'}</td>
      <td><small>${c.Capturado_Por||'—'}</small></td>
      ${conAcc ? `<td>${c.ID_Paciente ? `<button class="btn btn-accent btn-sm" onclick="openModalRemision('${escJs(c.ID_Paciente)}','${escJs(c.Nombre_Paciente)}','${origenRemision}','')">🧾 Remisión</button>` : '<small style="color:var(--text-muted);">sin paciente</small>'}</td>` : ''}
    </tr>
  `).join('');
  document.getElementById(contId).innerHTML = rows.length
    ? `<table><thead><tr><th>Folio</th><th>Fecha</th><th>Paciente</th><th>Médico</th><th>Motivo</th><th>Indicaciones</th><th>Capturó</th>${conAcc ? '<th>Acciones</th>' : ''}</tr></thead><tbody>${html}</tbody></table>`
    : '<div class="empty-state"><div class="icon">🩺</div>Sin registros</div>';
}
```

- [ ] **Step 2: Pasar el origen desde `renderUrgencias`**

Reemplaza `renderUrgencias` (index.html:5322-5324) por:

```javascript
function renderUrgencias() {
  renderListaConsultas(cache.urgencias, document.getElementById('searchUrgencias').value, 'urgenciasTable', 'URGENCIAS');
}
```

(`renderConsultas` queda **sin** el 4º argumento → Consultas normales no muestran el botón.)

- [ ] **Step 3: Verificación manual**

Abre **Urgencias** → cada renglón con paciente registrado muestra **🧾 Remisión**; al darle abre el formulario con origen Urgencias. Las urgencias sin `ID_Paciente` muestran "sin paciente". En **Consultas** (no urgencias) NO debe aparecer la columna Acciones.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Remisión F1: botón Remisión por fila en Urgencias (origen URGENCIAS)"
```

---

## Task 7: Docs — ítems de prueba en GUIA_PRUEBAS.md

**Files:**
- Modify: `docs/GUIA_PRUEBAS.md` (agregar una subsección en la sección de Remisión, ~después del ítem 12)

- [ ] **Step 1: Agregar la subsección**

En `docs/GUIA_PRUEBAS.md`, dentro de la sección "## 4. Remisión / cuenta del paciente (F3)", agrega al final de esa sección:

```markdown

### 4.b Lista de pacientes activos y botones de remisión (F1)
12.a [ ] **Consumos → 🧾 Nueva remisión**: al abrir, sin teclear, aparece la **lista de pacientes activos** (hospitalizados, cirugías de hoy, urgencias de hoy) con su etiqueta de ubicación. Un paciente que esté en varias (ej. cirugía hoy + cama) sale **una sola vez**.
12.b [ ] Escribir ≥2 letras en el buscador filtra a **todos** los pacientes; **borrar** el campo regresa la lista de activos.
12.c [ ] Elegir un paciente de **cirugía de hoy** desde la lista → el formulario abre con **origen QUIROFANO** y el **folio** precargado.
12.d [ ] **Programación Q.X.** → detalle de una cirugía de hoy → botón **🧾 Nueva remisión** abre el formulario con ese paciente, origen Quirófano y folio.
12.e [ ] **Urgencias** → cada fila con paciente tiene botón **🧾 Remisión** → abre con **origen URGENCIAS**. En **Consultas** normales no aparece la columna.
12.f [ ] Registrar una remisión con origen URGENCIAS → en la hoja `Remision_Items` la columna **Origen** dice `URGENCIAS`, y el total cae en **Cobro de caja** (Materiales y medicamento).
12.g [ ] Un rol **sin** permiso `registrar_consumo` no ve ninguno de estos botones.
```

- [ ] **Step 2: Commit**

```bash
git add docs/GUIA_PRUEBAS.md
git commit -m "docs: pruebas F1 — lista de activos y botones de remisión"
```

---

## Task 8: Desplegar y verificar end-to-end

**Files:** ninguno (despliegue + verificación)

- [ ] **Step 1: Correr la prueba unitaria**

Run: `node tests/remision_activos.test.js`
Expected: `5/5 pruebas pasaron.`

- [ ] **Step 2: Desplegar**

Desplegar el `apps_script.gs` + `index.html` actualizados por el mecanismo habitual del proyecto (clasp / GitHub Action `deploy-appsscript.yml`, o pegar en el editor de Apps Script y crear nueva versión de la implementación web — misma URL). *Este paso lo ejecuta Carlos / el responsable del despliegue.*

- [ ] **Step 3: Recargar la app con Ctrl+Shift+R y correr la checklist 12.a–12.g de `GUIA_PRUEBAS.md`.**

Marca cada ítem. Si alguno falla, anótalo y trátalo como bug antes de cerrar la Fase 1.

---

## Self-Review (cobertura del spec)

- **A. Lista de pacientes activos** → Task 1 (dedup) + Task 2 (3 fuentes) + Task 3 (UI + buscador). ✓
- **B. Botones**: Habitaciones (ya existe, sin cambio), Q.X. → Task 5, Urgencias → Task 6. ✓
- **C. Origen URGENCIAS** → Task 4 (dropdown) + Task 6 (botón lo pasa). Backend ya acepta texto libre, sin cambio. ✓
- **Pruebas** → Task 1 (unit) + Task 7 (manual). ✓
- **Desviación documentada**: `getProgramacionDia` NO se modifica (innecesario). ✓
- Consistencia de nombres: `mergeActivos_`, `getPacientesActivos`, `remisionActivos`, `cargarRemisionActivos`, `remisionRenderActivos`, `remisionElegirActivo`, `renderListaConsultas(…, origenRemision)` usados igual en todas las tareas. ✓
- Sin placeholders. ✓
```

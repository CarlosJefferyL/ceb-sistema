# Cobro F2a — Motor de tarifas + cargos de servicios + cobro valorado

**Fecha:** 2026-06-28
**Estado:** Aprobado (diseño)
**Epic:** "Cobro 100% remisionado" ([[project_ceb_cobro_remisionado]]). Sub-fase **F2a**. La sub-fase **F2b** (modelo de paquetes / presupuesto / extras) se construye encima y NO entra aquí.

## Objetivo

Que el cobro de caja se auto-alimente con **todos** los conceptos (no solo materiales), porque durante la estancia se "remisionan" también los servicios (equipo, laboratorio, imagen, hospitalización, oxígeno, etc.) a costos unitarios. Resultado: al seleccionar un paciente en Cobro, cada campo se prellena con la suma de sus cargos, editable. Además se expone el **total consumido valorado**, insumo de F2b.

## Contexto del código (estado actual)

- **Cobro:** `getDatosPacienteParaCobro(idPaciente)` (apps_script.gs:5537-5610) hoy devuelve `paciente`, `cirugias`, `cuentaExistente` y `materialesRemision` (= `totalRemisionMateriales_`). El frontend `seleccionarPacienteCobro` (index.html:8190) aplica solo `materialesRemision` vía `aplicarMaterialesRemision` (index.html:8261) al campo `cj_materiales`.
- **Form de cobro** (index.html:1340-1419): campos con id `cj_*` y atributo `data-caja` por grupo (clinica/equipo/laboratorio/imagen/honorarios). `recalcularCobro()` (index.html:7776) suma; `guardarIngreso` (apps_script.gs:5744) persiste en hoja `Caja`.
- **Remisión (patrón a imitar):** `registrarRemision` (apps_script.gs:2313) y su modal `openModalRemision` (index.html:4504). Materiales viven en `Remision_Items`; `totalRemisionMateriales_` (apps_script.gs:2245) suma por paciente.
- **Selector de pacientes activos (F1, ya en prod):** `openModalNuevaRemision`/`getPacientesActivos`. Se reutiliza el patrón del selector.
- **Cuartos:** `getTableroHabitaciones` (apps_script.gs:3821); tipos PRIVADA, SALA_GENERAL, URGENCIAS, TERAPIA_INTENSIVA. NO existe tarifa por tipo de cuarto hoy.
- **Catálogos:** patrón `SHEETS.X`, `sheetToObjects`, `esActivo`, `getCatalogos` (apps_script.gs:440) que el frontend cachea en `catalogos`.

## Contrato canónico: conceptos del cobro

Cada servicio del catálogo declara un `Concepto` que DEBE ser una de estas claves (= columna en `Caja` / campo `cj_*`):

| Concepto (clave) | Columna `Caja` | Campo frontend |
|---|---|---|
| `Hospitalizacion` | Hospitalizacion | cj_hospitalizacion |
| `Consulta_Externa` | Consulta_Externa | cj_consultaExterna |
| `Hora_Extra` | Hora_Extra | cj_horaExtra |
| `Dia_Extra` | Dia_Extra | cj_diaExtra |
| `Oxigeno` | Oxigeno | cj_oxigeno |
| `Paquete_Globular` | Paquete_Globular | cj_paqueteGlobular |
| `Noche_Terapia` | Noche_Terapia | cj_nocheTerapia |
| `Bomba_Infusion` | Bomba_Infusion | cj_bombaInfusion |
| `Fluoroscopio` | Fluoroscopio | cj_fluoroscopio |
| `Laparoscopio` | Laparoscopio | cj_laparoscopio |
| `Artroscopio` | Artroscopio | cj_artroscopio |
| `Ligasure` | Ligasure | cj_ligasure |
| `Ambulancia` | Ambulancia | cj_ambulancia |
| `Monitor` | Monitor | cj_monitor |
| `Ventilador` | Ventilador | cj_ventilador |
| `Laboratorio` | Laboratorio | cj_laboratorio |
| `Imagen` | Imagen | cj_imagen |
| `Anestesia_Mixta` | Anestesia_Mixta | cj_anestesiaMixta |

`Materiales_Medicamentos` queda como está (se alimenta de `Remision_Items`, no del catálogo de servicios). Varios cargos del mismo `Concepto` se **suman** en su campo.

**`Hospitalizacion` está reservado para el cálculo automático** (días × tarifa de cuarto): el catálogo `CAT_Servicios` NO debe tener servicios con `Concepto = Hospitalizacion` (para no duplicar). La renta granular se modela con los conceptos `Dia_Extra` / `Noche_Terapia` (servicios sueltos).

## Diseño

### A. Hojas nuevas

**`CAT_Servicios`** (catálogo de servicios cobrables):
`ID_Servicio · Nombre · Concepto · Precio_Estandar · Es_Tercerizado (SI/NO) · Unidad · Activo`
- `Concepto` ∈ claves canónicas de arriba.
- Arranca con filas semilla (una por equipo/concepto + "Laboratorio", "Imagen", "Hora quirófano"→Hora_Extra, "Oxígeno", etc.). Precios los captura la clínica (pueden quedar en 0 al inicio; ver manejo de precio 0 abajo).

**`Cargos_Paciente`** (cargos aplicados a la cuenta):
`ID_Cargo · Fecha · Hora · ID_Paciente · Nombre_Paciente · ID_Servicio · Nombre_Servicio · Concepto · Cantidad · Precio_Unitario · Costo_Tercerizado · Importe · Proveedor · Origen · Estado (ACTIVO) · Capturado_Por · Timestamp_Captura`
- `Importe = Precio_Unitario × Cantidad`. `Precio_Unitario` arranca en `Precio_Estandar` pero es editable al capturar.
- `Costo_Tercerizado` solo se llena si el servicio es tercerizado (informativo; no afecta el cobro al paciente).
- Inmutable tras registro (consistente con `Remision_Items`); corrección = nuevo cargo / cancelación futura. (Edición/borrado post-registro fuera de alcance F2a.)

**`CAT_Tarifas_Cuarto`**: `Tipo_Cuarto · Tarifa_Dia · Activo`.

### B. Backend (apps_script.gs)

1. `getCatalogoServicios()` → servicios activos. Se agrega también a `getCatalogos()` (campo `servicios`) para que el frontend lo cachee, y caso en el dispatcher.
2. `registrarCargosServicio(d)` — análogo a `registrarRemision`: recibe `{ idPaciente, nombrePaciente, origen, items:[{idServicio, concepto, cantidad, precioUnitario, costoTercerizado, proveedor}], capturadoPor, rolUsuario }`; valida permiso `registrar_consumo`; escribe N filas en `Cargos_Paciente`. Devuelve `{ ok, lineas, total }`.
3. `getCargosPaciente(idPaciente)` → cargos ACTIVO del paciente + total.
4. `totalesCargosPorConcepto_(idPaciente)` — **pura sobre los datos ya leídos**: agrupa cargos ACTIVO por `Concepto` → `{ Concepto: importeSumado }`. (Función testeable en Node con el patrón `vm`/`extractFn`.)
5. `calcularHospitalizacion_(hosp, tarifasCuarto)` — **pura**: `diasEstancia × Tarifa_Dia[tipo]` → importe (0 si no hay tarifa). Testeable.
6. **Extender `getDatosPacienteParaCobro`**: además de `materialesRemision`, devolver:
   - `cargosPorConcepto`: mapa `{Concepto: total}` (de `totalesCargosPorConcepto_`).
   - `hospitalizacionCalculada`: importe auto (de `calcularHospitalizacion_`).
   - `totalConsumoValorado`: materiales + Σ cargos + hospitalización (número único, para F2b).
   Sin romper los campos actuales.

### C. Frontend (index.html)

1. **Botón "Cargar servicios"** (en el módulo de Consumos/Medicamentos, junto a "Nueva remisión") → abre el **selector de pacientes activos** (mismo patrón F1, reusando `getPacientesActivos`) → al elegir, abre el **carrito de servicios**.
2. **Carrito de servicios** (`openModalCargos` análogo a `openModalRemision`): elegir servicio del catálogo (`catalogos.servicios`), cantidad, precio (default `Precio_Estandar`, editable), y si `Es_Tercerizado` mostrar campo de **costo** + proveedor. Agregar al carrito, ver total, **Registrar** → `apiPost('registrarCargosServicio', …)`.
3. **Cobro auto-alimentado**: en `seleccionarPacienteCobro`, además de `aplicarMaterialesRemision`, aplicar `cargosPorConcepto` a cada campo `cj_*` (por el mapeo canónico) y `hospitalizacionCalculada` a `cj_hospitalizacion`. Cada campo queda editable; luego `recalcularCobro()`. Re-seleccionar al paciente refresca.

### D. Manejo de precio 0 / faltante

Si un servicio tiene `Precio_Estandar` 0 o vacío, el cargo se puede registrar con el precio que teclee quien captura. Si se deja en 0, el importe es 0 (mismo comportamiento que materiales sin costo). No se bloquea; es responsabilidad de capturar el precio.

## Componentes y aislamiento

- **Catálogo** (`CAT_Servicios`, `CAT_Tarifas_Cuarto`) — solo datos + lectura.
- **Cargos** (`Cargos_Paciente` + `registrarCargosServicio`/`getCargosPaciente`) — escritura de cargos, espeja `registrarRemision`.
- **Agregación** (`totalesCargosPorConcepto_`, `calcularHospitalizacion_`) — funciones **puras**, testeables, sin SpreadsheetApp.
- **Cobro** (extensión de `getDatosPacienteParaCobro` + prefill frontend) — consume la agregación.

## Pruebas

- **Unitarias (Node):** `totalesCargosPorConcepto_` (suma por concepto, ignora no-ACTIVO, cargos sin concepto) y `calcularHospitalizacion_` (días×tarifa, tarifa faltante→0).
- **Manual (GUIA_PRUEBAS.md):** cargar servicios a un paciente activo (incluyendo uno tercerizado con costo); verificar que en Cobro se prellenan los conceptos correctos sumados; hospitalización = días×tarifa; precio editable; total cuenta correcto; re-selección refresca.

## Fuera de alcance (F2b u otros)

- Paquetes, presupuesto, dentro/fuera de presupuesto, cobro de excedentes.
- Reporte de margen de tercerizados (solo se almacena el costo).
- Precios por tipo de cliente / matriz (se usa precio estándar editable).
- Edición/cancelación de cargos ya registrados.
- Sub-catálogo de estudios específicos de lab/imagen (se capturan como cargos sueltos al concepto Laboratorio/Imagen).

## Despliegue

Las hojas nuevas (`CAT_Servicios`, `Cargos_Paciente`, `CAT_Tarifas_Cuarto`) se crean en el Google Sheet (con encabezados exactos). Código: push a `main` → CI clasp (backend) + Pages (frontend).

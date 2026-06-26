# Remisión: lista de pacientes activos + botones desde Q.X./Habitaciones/Urgencias

**Fecha:** 2026-06-26
**Estado:** Aprobado (diseño)

## Objetivo

Hacer más rápido y operable el inicio de una remisión:

1. En el modal **"Nueva remisión · elegir paciente"**, mostrar por defecto la lista de
   **pacientes activos ahora** en el sistema (hospitalizados, cirugías de hoy, urgencias
   de hoy), para elegir sin teclear. El buscador actual se conserva.
2. Agregar botón **"🧾 Nueva remisión"** desde **Programación Q.X.** y **Urgencias**
   (Habitaciones ya lo tiene), que abre la remisión con el paciente y el origen
   precargados.
3. Soportar un nuevo valor de `Origen`: **URGENCIAS** (además de QUIROFANO/PISO).

## Contexto del código (estado actual)

- **Modal elegir paciente:** `openModalNuevaRemision()` (index.html:4476), buscador
  `remisionBuscarPaciente()` (index.html:4487) → `apiGet('buscarPacientesCobro')`,
  selección `remisionElegirPaciente()` (index.html:4502) → `openModalRemision(id, nombre,
  'QUIROFANO', '')`. Resultados se pintan en `#rm_resultados` (index.html:4496).
- **Formulario remisión:** `openModalRemision(idPaciente, nombre, origen, folioCirugia, opts)`
  (index.html:4504). Dropdown Origen en index.html:4520 con opciones QUIROFANO|PISO.
- **Habitaciones (patrón de referencia):** `verDetalleHab()` (index.html:6344) ya tiene el
  botón 🧾 Remisión (index.html:6386): `openModalRemision(idPaciente, nombrePaciente,
  'PISO', '')`, gated por `puede('registrar_consumo')` y `hosp.idPaciente`.
- **Programación Q.X.:** `loadProgramacionDia()` (index.html:2080) → `getProgramacionDia(fecha)`
  (apps_script.gs:774). Detalle: `verDetalleProgramacion(folio)` (index.html:2212). **La
  respuesta NO incluye `idPaciente`** (apps_script.gs:793–810); sí está en la hoja `Cirugias`.
- **Urgencias:** `loadUrgencias()` (index.html:5283) → `getConsultas('URGENCIA', desde, hasta)`
  (apps_script.gs:4809). Render `renderListaConsultas()` (index.html:5293). Cada registro
  trae `ID_Paciente` y `Nombre_Paciente`. Misma hoja `Consultas` que Consultas, filtrada por `Tipo`.
- **Fuentes de pacientes activos:** no existe función unificada. Disponibles:
  `getTableroHabitaciones()` (apps_script.gs:3821, cuartos ocupados), hoja `Cirugias`
  (apps_script.gs:534), `getConsultas('URGENCIA')`.
- **Origen:** `registrarRemision()` (apps_script.gs:2313) guarda `Origen` como texto libre
  (default 'QUIROFANO', apps_script.gs:2349). Hoy solo se usan QUIROFANO|PISO; URGENCIAS no.

## Diseño

### A. Backend — `getPacientesActivos()`

Nueva función + caso en el dispatcher (doGet/doPost). Devuelve lista unificada combinando:

| Fuente | Filtro | origen sugerido | ubicacionTexto |
|---|---|---|---|
| Hospitalizados | `getTableroHabitaciones()`, cuartos ocupados (Estado ACTIVA) | `PISO` | `Hab. {numero}` |
| Cirugías de hoy | hoja `Cirugias`, `Fecha == hoy`, `Estado != CANCELADA` | `QUIROFANO` | `Q.X. · {tipoCirugia}` |
| Urgencias de hoy | hoja `Consultas`, `Tipo == URGENCIA`, `Fecha == hoy`, con `ID_Paciente` | `URGENCIAS` | `Urgencias` |

Cada elemento:
```
{ idPaciente, nombrePaciente, edad, origen, folioCirugia, ubicacionTexto }
```
- `folioCirugia` solo se llena para la fuente de cirugías; vacío en las demás.
- **Dedup por `idPaciente`**: si un paciente aparece en varias fuentes, se emite **una sola
  entrada**. El `origen` por defecto se elige por prioridad **QUIROFANO > PISO > URGENCIAS**,
  y `ubicacionTexto` fusiona las etiquetas (ej. `Q.X. · LAPE · Hab. 203`). El usuario puede
  cambiar el origen dentro del formulario.
- "Hoy" se calcula con la zona horaria del script (igual que el resto del backend).
- Ordenado por `ubicacionTexto` (o por nombre como secundario).
- Tolerante a hojas/columnas faltantes: si una fuente falla, se omite sin tirar la respuesta.

### B. Backend — `idPaciente` en `getProgramacionDia`

Agregar el campo `idPaciente` (desde `ID_Paciente` de la hoja `Cirugias`) al objeto por
cirugía que arma `getProgramacionDia` (apps_script.gs:793–810). No rompe consumidores
existentes (solo agrega un campo).

### C. Frontend — modal de remisión con lista de activos

- `openModalNuevaRemision()`: al abrir, llama `getPacientesActivos` y **renderiza la lista
  por defecto** en `#rm_resultados` (visible), cada renglón con nombre + badge de
  `ubicacionTexto`. Click → `openModalRemision(idPaciente, nombre, origen, folioCirugia)`.
- Estado de carga ("Cargando pacientes activos…") y vacío ("No hay pacientes activos —
  usa el buscador").
- **Buscador conservado:** al escribir ≥2 letras, `remisionBuscarPaciente()` filtra vía
  `buscarPacientesCobro` (todos los pacientes) y reemplaza la lista; al borrar el campo,
  se vuelve a mostrar la lista de activos (cacheada en memoria para no re-pedir).
- Los renglones de búsqueda mantienen su comportamiento actual (origen QUIROFANO por
  defecto, sin folio).

### D. Frontend — botones en Q.X. y Urgencias

- **Programación Q.X.** (`verDetalleProgramacion`): botón 🧾 Nueva remisión, visible si
  `puede('registrar_consumo')` y existe `idPaciente`. Acción:
  `closeModal(); openModalRemision(idPaciente, paciente, 'QUIROFANO', folio)`.
- **Urgencias** (`renderListaConsultas` / fila de urgencias): botón/acción 🧾 Remisión por
  registro, visible si `puede('registrar_consumo')` y el registro tiene `idPaciente`.
  Acción: `openModalRemision(idPaciente, nombre, 'URGENCIAS', '')`.
- **Habitaciones:** sin cambios (ya existe, origen PISO).

### E. Frontend — opción URGENCIAS en el dropdown de Origen

Agregar `<option value="URGENCIAS">Urgencias</option>` al `<select>` de Origen en
`openModalRemision` (index.html:4520). Sin cambios de backend (campo de texto libre).

## Archivos afectados

- `apps_script.gs`: +`getPacientesActivos()` y su caso en el dispatcher; +`idPaciente` en
  `getProgramacionDia`.
- `index.html`: render del modal de remisión (lista activos + buscador); botón en
  `verDetalleProgramacion`; botón en render de urgencias; opción URGENCIAS en el dropdown.
- `docs/GUIA_PRUEBAS.md`: ítems de prueba (lista de activos, los 3 botones, origen URGENCIAS).

## Fuera de alcance

- No se modifica el cálculo de precio de venta ni el flujo de cobro.
- No se crea una hoja/entidad nueva de "cuenta del paciente".
- No se agregan reportes por origen (URGENCIAS solo queda disponible como dato).

## Pruebas (manual, vía GUIA_PRUEBAS.md)

1. Abrir "Nueva remisión": aparece lista de activos con badges correctos; pacientes en
   varias fuentes salen una sola vez.
2. Escribir en el buscador filtra a todos los pacientes; borrar regresa la lista de activos.
3. Elegir un paciente de cirugía hoy → origen `QUIROFANO` y folio precargados.
4. Botón desde Programación Q.X. → abre remisión con el paciente y folio correctos.
5. Botón desde Urgencias → abre remisión con origen `URGENCIAS`.
6. Registrar una remisión con origen URGENCIAS y verificar que `Remision_Items.Origen`
   guarda `URGENCIAS` y que el total cae en Cobro de caja.
7. Permisos: el botón no aparece para roles sin `registrar_consumo`.

## Despliegue

Editar el `.gs` y el `index.html`; crear nueva versión de la implementación web (misma URL),
o vía clasp/GitHub Action de deploy.

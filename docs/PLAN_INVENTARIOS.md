# Plan de implementación — Módulo de Inventarios

> Documento vivo. Estado al **2026-06-22**. Marca el avance del módulo de inventarios y compras de ceb-sistema, y el orden de lo que falta.

---

## 1. Qué YA está hecho ✅

### 1.1 Inventario general (Fase 1)
- **Catálogo único `CAT_Articulos`** con categorías: `INSUMO`, `MEDICAMENTO`, `MEDICAMENTO_CONTROLADO`, `OTROS`.
- **Saldo por artículo** calculado sobre `Inventario_Mov` (`calcularSaldo`).
- **Alta de artículo** (`altaArticulo`) con campos de medicamento condicionales por categoría.
- **Entradas** (`registrarEntradaArticulo`) con lote + caducidad obligatorios para medicamentos/controlados, y receta COFEPRIS solo para controlados. Insumos/otros = saldo simple.
- **Salidas y ajustes** de almacén (`registrarMovimientoArticulo`).
- **Lotes / cajas** (control FEFO por caja) para controlados y medicamentos.
- **Migración** idempotente de catálogos viejos (`migrarCatalogoArticulos_`).
- **Frontend**: página *Artículos / Almacén* — saldos, filtro por categoría, búsqueda, tarjetas resumen, alta, entrada, salida/ajuste.

### 1.2 Compras (Fase 2)
- **Proveedores** (`CAT_Proveedores`): alta y edición.
- **Órdenes de compra** (`Ordenes_Compra` + `OC_Items`): crear con partidas y totales (subtotal/IVA/total), estados `BORRADOR → ENVIADA → RECIBIDA_PARCIAL → RECIBIDA / CANCELADA`.
- **Recepción de OC** (`recibirOrdenCompra`): recepción parcial o total que **genera las entradas a inventario** automáticamente (respeta lote/caducidad/receta por categoría).
- **Lista de precios** (`Precios_Compra`): artículo × proveedor × precio. Importación masiva, comparativo "ver precios" y **autollenado de precio** al crear OC.
- **Datos cargados**: 389 artículos (379 medicamentos + 10 controlados), 42 proveedores, 1,026 precios.

### 1.3 Control de medicamentos controlados (preexistente)
- Consumos por cirugía con descuento por caja/lote.
- Libro COFEPRIS alimentado automáticamente.

### 1.4 Infraestructura
- **Despliegue automático**: backend (`apps_script.gs`) por CI (clasp), frontend (`index.html`) por GitHub Pages.

---

## 2. Qué FALTA ⬜

| # | Pendiente | Notas |
|---|-----------|-------|
| P1 | **Kardex / movimientos por artículo** | Existe la data en `Inventario_Mov`, pero **no hay vista** para ver el historial (entradas/salidas/ajustes) ni saldo corriente por artículo. Hoy operamos "a ciegas". |
| P2 | **Traspasos entre ubicaciones** | Modelo confirmado: multi-almacén real, 7 ubicaciones (ver §3). |
| P3 | **Agrupación piezas/caja/paquete** | Config por artículo: piezas por caja y cajas por paquete. Útil para inventario y **prerequisito de la automatización de recetas (B)**. |
| P4 | **Reportes y alertas** | Tablero de bajo mínimo, existencias valorizadas (saldo × precio), rotación. *Va al final, según prioridad acordada.* |
| P5 | **Limpieza de datos** | Corregir saldos negativos (RELACUM −11, BROSPINA −1); recategorizar controlados dentro de los 379 importados. |
| B | **Automatización recetas controladas (Fentanilo)** | Fase aparte, reglas ya acordadas (ver memoria del proyecto). Depende de P3. |
| — | Integración COFEPRIS | **Fuera de alcance** por ahora. |

---

## 3. Modelo confirmado: multi-almacén + remisión (cuenta del paciente)

Decisiones tomadas con el usuario (2026-06-22):

### 3.1 Multi-ubicación (Opción A) — **CONFIRMADO**
El saldo pasa a ser por **(artículo, ubicación)**. Ubicaciones reales:
**Almacén General · CEyE · Piso · Carro Rojo 1 · Carro Rojo 2 · Carro Rojo 3 · Carro Rojo 4** (cada carro rojo es un almacén). Un traspaso = SALIDA en origen + ENTRADA en destino (conservando lote).

### 3.2 Remisión y cuenta del paciente
- **Cuenta única por estancia** del paciente, que acumula **línea por línea** servicios, materiales y medicamentos.
- **Remisión** = el documento con el que se cargan consumos a esa cuenta.
- Cada consumo **descuenta de una ubicación** (carro/CEyE/piso) y, para medicamentos/controlados, **del lote** específico; y **agrega una línea a la cuenta** automáticamente.
- **Precio de venta = costo × 2** por default (con excepciones). El módulo para ajustar precios de venta se hará **después**.
- Al **alta**, se cierra la cuenta y se liga al **módulo de cobro de caja** (materiales + honorarios + hospitalización).

### 3.3 Flujo clínico (remisión)
```
Almacén Gral / CEyE ──(BOM entregado)──► QUIRÓFANO
   • consumo real del BOM (descuenta + cobra)         ┐
   • extras NO-BOM surtidos de CEyE (líneas nuevas)   ├─► cuenta del paciente
   • al cerrar: no usado del BOM se DEVUELVE al almacén┘
        │
        ▼
   PISO (habitación) ── consumos ──► cuenta del paciente
        │
        ▼
   ALTA ──► cierre de cuenta ──► Cobro de caja
```

---

## 4. Orden de implementación propuesto (epic Remisión + multi-almacén)

> Reemplaza el orden anterior. El usuario pidió **arrancar por consumos/BOMs (remisión)**; como la remisión depende de ubicaciones, la base va primero.

1. ✅ **F1 · Ubicaciones y saldo por almacén** — `CAT_Ubicaciones` (7), `Ubicacion` en `Inventario_Mov`/`Lotes`, `calcularSaldo(art, ubicacion)`, filtro de almacén en Artículos, entradas/salidas/ajustes con ubicación. Stock previo → Almacén General. **HECHO.**
2. ✅ **F2 · Traspasos** — `registrarTraspaso` (SALIDA origen + ENTRADA destino); lote = caja completa, insumos = cantidad. Botón ⇄ Traspaso. **HECHO.**
3. **F3 · Remisión / cuenta del paciente** — *en curso:*
   - ✅ **F3a (backend)**: `Remision_Items`, `registrarRemision` unificado (descuenta almacén/lote, Libro solo controlados, traza en Consumos, línea a precio venta = último costo×2), `getRemisionPaciente`, `getDatosPacienteParaCobro` expone `materialesRemision`.
   - ✅ **F3b (frontend)**: pantalla "Nueva remisión" (buscar paciente → carrito → registrar).
   - ✅ **F3c**: el **cobro** prellena "Materiales y medicamento" desde `materialesRemision` (cuenta nueva y existente); botón **🧾 Remisión** en el detalle del cuarto (piso). *Falta opcional: entrada directa de remisión desde la cirugía (quirófano) — hoy se hace por "Nueva remisión" buscando al paciente.*
4. ✅ **F4 · Conciliación de BOM al cerrar cirugía** — botón "Conciliar BOM" en la cirugía abre la remisión pre-cargada con items del BOM que mapean por Código (insumos con cantidad entregada); meds (con lote) e items fuera de catálogo se listan como aviso para agregarlos manual. Al registrar: descuenta+cobra y guarda `Cantidad_R` en el BOM. Lo no agregado = se queda en almacén. **HECHO.** *Nota: como `entregarBOM` no mueve inventario, el descuento ocurre al conciliar; "lo no usado" simplemente no se descuenta.*
5. **F5 · Cierre de cuenta → cobro** — al alta, cerrar y ligar al módulo de cobro existente.
6. **F6 (después)** · Módulo de **precios de venta** (ajuste de márgenes/excepciones).

Pendientes anteriores que se reacomodan **después** del epic: Kardex (queda cubierto en parte por F1/F2), agrupación piezas/caja/paquete (P3, prerequisito de Fentanilo), limpieza de datos (P5), reportes (P4), recetas controladas (B).

---

## 5. Notas / decisiones abiertas
- **Insumos sin lote en consumo:** los medicamentos/controlados se consumen de un lote específico (confirmado). Para **insumos sin lote** el consumo será del **saldo de la ubicación** (sin lote). *(Asunción; confirmar si los insumos también deben llevar lote/caducidad.)*
- **Stock existente al migrar a multi-almacén:** se asignará a **Almacén General** por default.
- Fentanilo: discrepancia 25 vs 30 piezas por paquete (PDF 5×6=30 vs acuerdo verbal 5×5=25) — **confirmar en B**.

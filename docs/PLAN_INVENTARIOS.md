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
| P2 | **Traspasos entre ubicaciones** | **No existe el concepto de ubicación/almacén.** Requiere decisión de modelo (ver §3). |
| P3 | **Agrupación piezas/caja/paquete** | Config por artículo: piezas por caja y cajas por paquete. Útil para inventario y **prerequisito de la automatización de recetas (B)**. |
| P4 | **Reportes y alertas** | Tablero de bajo mínimo, existencias valorizadas (saldo × precio), rotación. *Va al final, según prioridad acordada.* |
| P5 | **Limpieza de datos** | Corregir saldos negativos (RELACUM −11, BROSPINA −1); recategorizar controlados dentro de los 379 importados. |
| B | **Automatización recetas controladas (Fentanilo)** | Fase aparte, reglas ya acordadas (ver memoria del proyecto). Depende de P3. |
| — | Integración COFEPRIS | **Fuera de alcance** por ahora. |

---

## 3. Decisión central para Traspasos: ¿una o varias ubicaciones?

Hoy el saldo es **global por artículo** (una sola bodega lógica). Un "traspaso" solo tiene sentido si hay **ubicaciones** entre las que se mueve el stock (ej. Almacén General, Farmacia, Quirófano, Piso/Hospitalización).

- **Opción A — Multi-ubicación real (recomendada si manejan stock físico por área):**
  Se agrega una dimensión `Ubicación`. El saldo pasa a ser por **(artículo, ubicación)**. Un traspaso = SALIDA en origen + ENTRADA en destino (mismo artículo/lote). Entradas de compra llegan a un almacén; consumos descuentan del almacén del área. Más potente, más cambios (toca `calcularSaldo`, entradas, consumos, vistas).

- **Opción B — Ubicación como etiqueta (más simple):**
  Saldo sigue global. El traspaso es un **movimiento informativo** (registra origen→destino en `Inventario_Mov`) sin saldo por ubicación. Da trazabilidad de "quién tiene qué" en la bitácora, pero no saldos separados.

> **Pendiente de definir contigo** antes de construir P2. Recomendación: Opción A si de verdad cuentan existencias por área; Opción B si solo quieren registrar el traslado.

---

## 4. Orden de implementación propuesto

Priorizando **movimientos y traspasos antes que reportes** (acordado):

1. **P1 · Kardex / movimientos por artículo** — vista de historial + saldo corriente. *Base de trazabilidad; nos saca de operar a ciegas.*
2. **P2 · Ubicaciones + Traspasos** — según la decisión de §3.
3. **P3 · Agrupación piezas/caja/paquete** — deja lista la base para B.
4. **P5 · Limpieza de datos** — saldos negativos y recategorización.
5. **P4 · Reportes y alertas.**
6. **B · Automatización de recetas controladas.**

---

## 5. Notas / decisiones abiertas
- Modelo de traspasos (§3) — **bloquea P2**.
- Fentanilo: discrepancia 25 vs 30 piezas por paquete (PDF decía 5×6=30; acuerdo verbal 5×5=25) — **confirmar en P3/B**.

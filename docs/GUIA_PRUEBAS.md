# Guía de pruebas — Módulo de inventarios, compras y remisión

> Marca cada paso (`[x]`) y anota en **Resultado** lo que veas. Si algo falla, escribe el mensaje de error exacto y en qué paso. Al terminar, pásame esta lista con tus notas para corregir.

## 0. Antes de empezar
- [ ] Backend desplegado en verde (pestaña **Actions** del repo, último run "Deploy Apps Script backend" ✅).
- [ ] Recarga la app con **Ctrl + F5** (limpia caché del navegador).
- [ ] **Permite las ventanas emergentes** para `carlosjefferyl.github.io` (para los reportes PDF).
- [ ] Ten a la mano una cuenta **ADMIN** (para verlo todo) y, si puedes, una de **RECEPCIÓN** para una prueba puntual.

Datos útiles que ya existen: artículo **FENODID** (med. controlado con saldo en Almacén General), ~389 artículos, 42 proveedores, 1026 precios.

---

## 1. Inventario por almacén (F1)
1. [ ] Entra a **Artículos / Almacén**. Resultado esperado: lista de artículos con saldo, tarjetas resumen por categoría.
   - Resultado: ______________________________
2. [ ] En el filtro **"Todos los almacenes"** elige **Almacén General**. El saldo de FENODID debe ser el mismo que el global; en **Carro Rojo 1** debe ser 0.
   - Resultado: ______________________________
3. [ ] **+ Nuevo artículo**: crea un insumo de prueba (categoría INSUMO, unidad "pieza", stock mínimo 5). Debe aparecer en la lista.
   - Resultado: ______________________________
4. [ ] **↓ Entrada**: registra 100 piezas del insumo de prueba en **Almacén General** (no debe pedir lote). Verifica que el saldo suba a 100.
   - Resultado: ______________________________
5. [ ] **↓ Entrada** de un **medicamento** (categoría medicamento/controlado): confirma que **exige lote y caducidad** (y receta si es controlado).
   - Resultado: ______________________________

## 2. Traspasos (F2)
6. [ ] **⇄ Traspaso** del insumo de prueba: 20 piezas de **Almacén General → Carro Rojo 1**. Verifica con el filtro de almacén que General bajó 20 y Carro Rojo 1 subió 20.
   - Resultado: ______________________________
7. [ ] **⇄ Traspaso** de un **medicamento con lote**: mueve una caja de **Almacén General → CEyE**. Debe pedir elegir la **caja/lote** y mover la caja completa.
   - Resultado: ______________________________
8. [ ] Intenta un traspaso con **origen = destino** → debe rechazarlo. Intenta traspasar más cantidad de la que hay → debe rechazarlo por saldo.
   - Resultado: ______________________________

## 3. Compras (proveedores y órdenes de compra)
9. [ ] **Proveedores → + Nuevo proveedor**: alta de uno de prueba.
   - Resultado: ______________________________
10. [ ] **Órdenes de compra → + Nueva orden**: elige proveedor, agrega 2 partidas (artículos del catálogo). Verifica que el **precio se autocompleta** y que subtotal/IVA/total cuadran. Guarda (queda BORRADOR).
    - Resultado: ______________________________
11. [ ] En la OC creada: **Enviar** → luego **Recibir**. Captura cantidades (para meds pedirá lote/caducidad). Verifica que el **saldo del artículo subió** en Artículos / Almacén.
    - Resultado: ______________________________

## 4. Remisión / cuenta del paciente (F3)
12. [ ] **Consumos → 🧾 Nueva remisión**: busca un paciente (que tenga cirugía u hospitalización). Agrega al carrito: un **insumo** (almacén + cantidad) y un **medicamento** (almacén + lote + cantidad). Verifica el **precio de venta** (≈ costo × 2) y el total. **Registrar remisión**.
    - Resultado: ______________________________
13. [ ] Vuelve a **Artículos / Almacén** y confirma que los saldos bajaron en el almacén usado.
    - Resultado: ______________________________
14. [ ] **Cobro de caja**: busca al mismo paciente. El campo **"Materiales y medicamento"** debe **autocompletarse** con el total de la remisión (sale aviso "desde remisión").
    - Resultado: ______________________________
15. [ ] (Controlados) Revisa el **Libro COFEPRIS**: el medicamento controlado consumido debe tener su asiento.
    - Resultado: ______________________________

### 4.b Lista de pacientes activos y botones de remisión (F1)
12.a [ ] **Consumos → 🧾 Nueva remisión**: al abrir, sin teclear, aparece la **lista de pacientes activos** (hospitalizados, cirugías de hoy, urgencias de hoy) con su etiqueta de ubicación. Un paciente que esté en varias (ej. cirugía hoy + cama) sale **una sola vez**.
12.b [ ] Escribir ≥2 letras en el buscador filtra a **todos** los pacientes; **borrar** el campo regresa la lista de activos.
12.c [ ] Elegir un paciente de **cirugía de hoy** desde la lista → el formulario abre con **origen QUIROFANO** y el **folio** precargado.
12.d [ ] **Programación Q.X.** → detalle de una cirugía de hoy → botón **🧾 Nueva remisión** abre el formulario con ese paciente, origen Quirófano y folio.
12.e [ ] **Urgencias** → cada fila con paciente tiene botón **🧾 Remisión** → abre con **origen URGENCIAS**. En **Consultas** normales no aparece la columna.
12.f [ ] Registrar una remisión con origen URGENCIAS → en la hoja `Remision_Items` la columna **Origen** dice `URGENCIAS`, y el total cae en **Cobro de caja** (Materiales y medicamento).
12.g [ ] Un rol **sin** permiso `registrar_consumo` no ve ninguno de estos botones.

## 5. Conciliación del BOM al cerrar cirugía (F4)
16. [ ] En **Cirugías**, una cirugía activa con BOM: botón **🧾 Conciliar BOM**. Verifica que:
    - los **insumos del BOM** que existen en catálogo se **pre-cargan** con la cantidad entregada,
    - los **medicamentos** del BOM aparecen como **aviso** (se agregan eligiendo lote),
    - los items **fuera de catálogo** salen en **aviso rojo**.
    - Resultado: ______________________________
17. [ ] Ajusta cantidades a lo "realmente usado", agrega un extra de CEyE y **Registrar**. Verifica descuento de inventario y que se sumó a la cuenta del paciente.
    - Resultado: ______________________________

## 6. Piso → alta → cierre de cuenta → cobro (F5)
18. [ ] **Habitaciones**: abre el detalle de un cuarto ocupado → **🧾 Remisión** → agrega un consumo (origen PISO). Verifica que se cargó a la cuenta.
    - Resultado: ______________________________
19. [ ] En ese cuarto, **↗ Egresar** el paciente. Al confirmar, debe preguntar **"¿Ir a Cobro de caja para cerrar su cuenta?"** → Aceptar.
    - Resultado: ______________________________
20. [ ] En **Cobro**, con el paciente cargado: revisa el total, **💾 Registrar cobro**, luego **🔒 Cerrar cuenta**.
    - Resultado: ______________________________
21. [ ] Intenta registrar **otra remisión** a ese paciente → debe **bloquearse** ("La cuenta está CERRADA…"). Luego, como ADMIN, **🔓 Reabrir** y confirma que ya permite consumos.
    - Resultado: ______________________________

## 7. Reportes PDF
22. [ ] **Habitaciones → 🖨 Reporte PDF**, fecha = **hoy**: debe abrir **al instante** una pestaña, con **logo**, título **"Reporte de ocupación de habitaciones (dd/mm/aaaa)"**, en **horizontal**, tarjetas por tipo. Guarda como PDF y revisa que **quepa en una hoja**.
    - Resultado: ______________________________
23. [ ] Mismo reporte con una **fecha pasada**: debe reconstruir la ocupación de ese día (tarda un poco más, normal).
    - Resultado: ______________________________
24. [ ] **Programación Q.X. → 🖨 Reporte PDF**: elige una fecha **con cirugías** → debe mostrar los datos (no vacío), tablero por quirófano, horizontal, con logo y título con fecha.
    - Resultado: ______________________________

## 8. Ajustes de la reunión (A1 / A2)
25. [ ] **Alta de paciente** sin CURP y **sin** marcar "extranjero" → debe **exigir CURP**. Marca "extranjero" → debe permitir guardar sin CURP.
    - Resultado: ______________________________
26. [ ] **Habitaciones → Mover paciente**: elige una habitación **ocupada** → debe ofrecer **intercambio** y, al confirmar, intercambiar a los dos pacientes.
    - Resultado: ______________________________
27. [ ] Con una cuenta de **RECEPCIÓN**: confirma que puede ver **Programación Q.X.** y **generar el reporte**, pero **no** ve los botones de programar/editar cirugía.
    - Resultado: ______________________________

---

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

## Hallazgos / correcciones pendientes
> Anota aquí lo que haya que arreglar (paso, qué esperabas, qué pasó, mensaje de error).

1. 
2. 
3. 

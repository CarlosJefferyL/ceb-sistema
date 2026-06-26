# Guía de uso — Sistema CEB (Clínica Estar Bien)

> Manual operativo para el personal de la clínica. Explica cómo entrar al
> sistema, qué hace cada módulo, quién puede usarlo y cómo realizar las tareas
> del día a día (alta de pacientes, programación de cirugías, almacén COFEPRIS,
> cobro de caja, etc.).
>
> **¿Eres nuevo?** Lee las secciones 1, 2 y 3, y luego ve directo al módulo que
> te toca según tu rol (sección 4). Al final (sección 6) están los **flujos
> completos** de extremo a extremo.

---

## Índice

1. [Qué es el sistema](#1-qué-es-el-sistema)
2. [Cómo entrar (acceso y roles)](#2-cómo-entrar-acceso-y-roles)
3. [La pantalla principal](#3-la-pantalla-principal)
4. [Recorrido por módulos](#4-recorrido-por-módulos)
   - 4.1 [Inicio (Dashboard)](#41-inicio-dashboard)
   - 4.2 [Alta de paciente (Recepción)](#42-alta-de-paciente-recepción)
   - 4.3 [Pacientes (directorio)](#43-pacientes-directorio)
   - 4.4 [Habitaciones](#44-habitaciones)
   - 4.5 [Programación Q.X.](#45-programación-qx)
   - 4.6 [Cirugías](#46-cirugías)
   - 4.7 [Recetas](#47-recetas)
   - 4.8 [Consumos](#48-consumos)
   - 4.9 [BOM quirúrgico](#49-bom-quirúrgico)
   - 4.10 [Consultas y Urgencias](#410-consultas-y-urgencias)
   - 4.11 [Almacén: Artículos, Saldos, Entradas, Cajas/Lotes](#411-almacén)
   - 4.12 [Compras: Órdenes de compra y Proveedores](#412-compras)
   - 4.13 [Libro COFEPRIS](#413-libro-cofepris)
   - 4.14 [Caja: Cobro, Recibos y Ventas](#414-caja)
   - 4.15 [Médicos y cirugías (catálogos)](#415-médicos-y-cirugías-catálogos)
5. [Quién usa qué (permisos por rol)](#5-quién-usa-qué-permisos-por-rol)
6. [Flujos completos de principio a fin](#6-flujos-completos-de-principio-a-fin)
7. [Preguntas frecuentes y problemas comunes](#7-preguntas-frecuentes-y-problemas-comunes)

---

## 1. Qué es el sistema

CEB Sistema es la plataforma de gestión de la **Clínica Estar Bien**. Funciona
desde el navegador (no se instala nada) y centraliza toda la operación:

- **Pacientes y hospitalización** — alta, directorio, ocupación de habitaciones.
- **Quirófano** — programación de cirugías, recetas, consumos y paquetes (BOM).
- **Atención ambulatoria** — consultas y urgencias con consentimiento informado.
- **Almacén y COFEPRIS** — inventario, medicamentos controlados, lotes/cajas,
  órdenes de compra, proveedores y el Libro COFEPRIS oficial.
- **Caja** — cobro a pacientes, recibos y registro de ventas.

El sistema es **multi-rol**: cada persona ve solo los módulos y botones que le
corresponden según su puesto.

---

## 2. Cómo entrar (acceso y roles)

### Ingresar

1. Abre la dirección del sistema en tu navegador.
2. Escribe tu **código de acceso** en el campo de la pantalla de inicio.
3. Presiona **Ingresar** (o la tecla Enter).
4. Si el código es válido, verás tu nombre y tu rol arriba, y el menú lateral
   con los módulos a los que tienes acceso.

> **El código de acceso no es una contraseña tradicional.** Es un código único
> que el administrador asigna a cada usuario y que define tu rol. No hay sesión
> permanente: si cierras el navegador, deberás volver a ingresar.

### Cerrar sesión

Usa **Cerrar sesión** al final del menú. Se limpia tu sesión y regresas a la
pantalla de acceso.

### Roles del sistema

| Rol | A quién corresponde |
|-----|---------------------|
| **ADMIN** | Administrador. Acceso total a todo el sistema. |
| **DIRECTOR_MEDICO** | Director médico. Autoriza BOM, cirugías, cancelaciones; ve caja. |
| **RECEPCION** | Recepción. Alta de pacientes, ingreso a habitación, consultas. |
| **JEFE_ENFERMERIA_QUIROFANO** | Jefe de enfermería de quirófano (cirugías, BOM). |
| **JEFE_ENFERMERIA_PISO** | Jefe de enfermería de piso (hospitalización). |
| **JEFE_ENFERMERIA** | Rol heredado equivalente a ambos jefes (compatibilidad). |
| **ENFERMERIA** | Personal de enfermería general. |
| **ALMACEN** | Responsable de almacén e inventario. |
| **GESTORIA** | Gestoría administrativa / compras. |
| **CAJERO** | Personal de caja (cobro, recibos, ventas). |

La sección 5 detalla qué módulos y acciones puede usar cada rol.

---

## 3. La pantalla principal

- **Menú lateral (izquierda):** lista de módulos, agrupados por área (Recepción,
  Operación, Atención, Almacén, Compras, COFEPRIS, Configuración, Caja). Solo
  aparecen los que tu rol puede ver.
- **Área de trabajo (centro):** el contenido del módulo seleccionado.
- **Ventanas emergentes (modales):** los formularios para crear o editar abren en
  una ventana sobre la pantalla. Se cierran con **Cancelar**, la **×** o al
  guardar.

> 💡 **Nota importante sobre los formularios:** si empiezas a capturar datos y
> tratas de cerrar la ventana (clic afuera o en la ×), el sistema te **pedirá
> confirmación** antes de descartar, para que no pierdas lo capturado. Si no
> capturaste nada, se cierra de inmediato.

---

## 4. Recorrido por módulos

### 4.1 Inicio (Dashboard)

**Para qué sirve:** pantalla de resumen del día. Lo primero que ves al entrar.

Muestra:

- **Tarjetas de cirugías:** cuántas hay **hoy**, **mañana** y en los **próximos
  días** (horizonte configurable, normalmente 7).
- **Sin receta:** cirugías que aún no tienen receta vinculada (en amarillo si hay).
- **Inventario:** medicamentos por debajo del stock mínimo (en rojo si hay).
- **Hospitalización:** camas ocupadas / totales y porcentaje de ocupación.
- **Insignia BOM:** número de paquetes quirúrgicos pendientes (en naranja).
- **Alertas y pendientes:** lista de cirugías sin receta, medicamentos en alerta
  y la línea de tiempo de cirugías próximas.

Úsalo como tablero de control para detectar lo urgente del día.

---

### 4.2 Alta de paciente (Recepción)

**Para qué sirve:** registrar a un paciente nuevo que ingresa a la clínica.
**Quién:** RECEPCION, jefas de enfermería, dirección, admin.

**Pasos:**

1. Entra a **Alta de paciente** y pulsa **+ Nuevo paciente**.
2. Llena el formulario, dividido en 3 pestañas (todos los campos son
   obligatorios salvo los marcados como *opcional*):
   - **General:** nombre completo, contactos, tipo de cliente, médico que refirió.
   - **Dirección:** domicilio o calle, colonia, CP, ciudad, estado, teléfonos, email.
   - **Datos particulares:** fecha de ingreso, servicio (PARTICULAR / ASEGURADORA /
     CONVENIO), caso/expediente, habitación, procedimiento, fecha de nacimiento,
     edad, género, estado civil, responsable, **CURP**, alergias, médico tratante,
     especialidad, etc.
3. **CURP:** es obligatorio, salvo que marques la casilla **🌐 Paciente extranjero
   (sin CURP)**.
4. **Habitación asignada (opcional):** si eliges una habitación de la lista, el
   paciente **ocupa esa cama al instante** (se crea la hospitalización activa).
5. Pulsa **Dar de alta**. El sistema genera automáticamente el **folio de
   recepción** y el ID del paciente.

**Reglas clave:**

- El folio de recepción y el ID se generan solos; no los captures.
- Si el servicio es **ASEGURADORA**, se piden aseguradora y número de póliza.
- Si el estado civil es **Casado(a)**, se pide el cónyuge.

---

### 4.3 Pacientes (directorio)

**Para qué sirve:** consultar y editar el padrón de pacientes ya registrados.
Es distinto de "Alta de paciente": aquí se buscan y modifican los existentes.

**Acciones:**

- **Buscar:** escribe nombre, CURP o ID; la lista filtra en vivo.
- **+ Nuevo paciente:** abre el mismo formulario de alta (sección 4.2).
- **✎ Editar:** modifica los datos de un paciente (la habitación se gestiona en
  Hospitalización, no aquí).
- **🗑 Borrar:** solo ADMIN / jefas de enfermería / RECEPCION.
  - Si el paciente **no tiene historial**, se borra directo.
  - Si **tiene historial** (cirugías, consultas, consumos, hospitalizaciones),
    solo ADMIN puede forzar el borrado tras una segunda confirmación que detalla
    cuánto historial se perdería.

**Estatus del paciente:** Activo (verde) · Atendido (azul) · Suspendido (rojo).
Los pacientes **Suspendidos** no aparecen en las búsquedas de ingreso ni consulta.

---

### 4.4 Habitaciones

**Para qué sirve:** tablero de ocupación de camas y gestión de hospitalización.
**Quién:** piso, enfermería, recepción, dirección, admin.

Las habitaciones se agrupan en 4 tipos: **Privada, Sala General, Urgencias,
Terapia Intensiva**.

**Ingresar paciente** (botón **+ Ingresar paciente**):

1. Elige **habitación** (solo aparecen las libres) y **fecha de ingreso**.
2. Busca al **paciente** (por nombre, CURP o folio).
3. Captura **diagnóstico** (obligatorio) y **doctor a cargo** (obligatorio);
   edad y teléfono se autocompletan.
4. Guarda: la habitación queda **ocupada al instante**.

**Egresar paciente** (botón **↗ Egresar** en una cama ocupada): captura fecha,
hora y motivo de egreso. La cama queda libre. Si hay módulo de caja, te ofrece ir
a **cerrar la cuenta** del paciente.

**Mover paciente** (botón **↔ Mover**): elige la nueva habitación y un motivo
(mínimo 5 caracteres). Si la habitación destino está ocupada, el sistema propone
un **intercambio** de ambos pacientes y pide confirmación.

> Señales visuales: banner rojo si un tipo de habitación supera el 80% de
> ocupación; los días de estancia se colorean (amarillo > 3 días, rojo > 7 días).

---

### 4.5 Programación Q.X.

**Para qué sirve:** agendar cirugías en los quirófanos y ver el calendario.
**Quién:** quirófano, recepción, dirección, admin.

**Programar una cirugía** (**+ Programar cirugía**):

1. Elige **quirófano**, **fecha**, **hora de inicio** y **TQX (horas)** de
   duración estimada (la hora de fin se calcula sola).
2. **Paciente:** búscalo en el catálogo o marca *programar sin paciente
   registrado* y captura un nombre libre (se vincula después).
3. **Tipo de cirugía:** búscalo por nombre, clave CPT o subsistema.
4. **Paquete BOM (opcional):** selecciona uno o varios; si lo dejas vacío, es
   obligatorio escribir el motivo.
5. **Equipo médico:** cirujano (obligatorio), ayudante y anestesiólogo (opcionales).
6. **Medicamentos estimados (opcional):** anticipa controlados; también se pueden
   registrar durante la cirugía.
7. Guarda. Se crea la cirugía en estado **PROGRAMADA** y, automáticamente, su
   **BOM en estado SOLICITADO**.

**Vistas:** tablero diario por quirófano, calendario mensual, accesos rápidos
(Hoy / Mañana) y reporte PDF imprimible.

**Regla clave — conflicto de horario:** el sistema **no deja** agendar dos
cirugías en el mismo quirófano en horarios que se traslapan.

---

### 4.6 Cirugías

**Para qué sirve:** panel central para administrar todas las cirugías.

**Filtros:** Hoy / Mañana / Esta semana / Próximas / Todas, por estado, por
médico, por rango de fechas y buscador por paciente o folio.

**Acciones por cirugía** (según permiso y estado):

- **Ver** — detalle completo.
- **Editar** — quirófano, fecha, hora, TQX, equipo médico, observaciones; pide
  **motivo de edición**. No editable si está CANCELADA o TERMINADA.
- **Asignar paciente** — vincula un paciente del catálogo a una cirugía que se
  programó con nombre libre.
- **Terminar** — marca TERMINADA (normalmente requiere consumos registrados).
- **Cancelar** — pide **motivo** (mínimo 10 caracteres); queda registrada.
- **Reabrir** — reabre una cirugía CANCELADA o TERMINADA (pide motivo).

**Estados de una cirugía:**

`PROGRAMADA` → `RECETA_VINCULADA` (tiene receta física) → (consumos) → `TERMINADA`.
`CANCELADA` en cualquier momento (con motivo). Una cancelada/terminada puede
**reabrirse** si hace falta.

---

### 4.7 Recetas

**Para qué sirve:** vincular la **receta física COFEPRIS** (el folio del talonario
oficial) a una cirugía, para respaldar el uso de medicamentos controlados.
**Quién:** quirófano, almacén, gestoría, dirección, admin.

**Idea general:**

1. Desde una cirugía (o desde el módulo de Recetas) se **emite/vincula** una
   receta indicando su **folio físico**.
2. Al vincularla, la cirugía pasa a estado **RECETA_VINCULADA**.
3. Esa receta es el documento que ampara los consumos de controlados que se
   registren después.

Filtra las recetas por estado para ver cuáles están pendientes de consumo.

---

### 4.8 Consumos

**Para qué sirve:** registrar los **medicamentos e insumos realmente usados** en
una cirugía, descontándolos del inventario y dejando el rastro COFEPRIS.
**Quién:** quirófano, enfermería, almacén, dirección, admin.

**Idea general:**

1. Selecciona la cirugía (idealmente ya con receta vinculada).
2. Registra cada medicamento/insumo consumido con su **cantidad**.
3. El sistema **descuenta de las cajas/lotes** correspondientes (por orden de
   caducidad) y genera automáticamente el **asiento de SALIDA en el Libro
   COFEPRIS** para los controlados.
4. Un consumo mal capturado se puede **cancelar** (con permiso), revirtiendo el
   descuento.

Tras registrar consumos, la cirugía puede **terminarse**.

---

### 4.9 BOM quirúrgico

**Para qué sirve:** gestionar los **paquetes de material/instrumental (BOM)** de
cada cirugía, con un flujo de autorización por etapas.

**Flujo y estados:**

```
SOLICITADO ──proponer──▶ PROPUESTO ──autorizar──▶ AUTORIZADO ──entregar──▶ ENTREGADO
                              └────────rechazar────────▶ RECHAZADO (puede volver a proponer)
```

1. **SOLICITADO** — se crea solo al programar la cirugía.
2. **Asignar paquete** — defines qué paquete(s) de BOM aplican; se generan las
   partidas desde la plantilla.
3. **Proponer** (almacén / quirófano) — pasa a **PROPUESTO**.
4. **Autorizar / Rechazar** (DIRECTOR_MEDICO) — aprueba (**AUTORIZADO**) o rechaza
   con motivo (**RECHAZADO**, puede volver a proponerse).
5. **Entregar** (ALMACEN) — entrega a piso; queda **ENTREGADO**.

El detalle de cada BOM muestra las partidas con columnas **S** (solicitado),
**U** (en uso/tránsito) y **R** (recibido). La insignia del menú indica cuántos
BOM están pendientes.

---

### 4.10 Consultas y Urgencias

**Para qué sirven:** registrar atención ambulatoria. **Consultas** es consulta
externa (con consentimiento informado); **Urgencias** es atención de emergencia
(formulario simplificado, sin consentimiento).

**Nueva consulta / urgencia:**

1. Pulsa **+ Nueva consulta** (o **+ Nueva urgencia**).
2. **Paciente:** búscalo, o usa **+ Registrar paciente nuevo (ligero)** para un
   alta mínima (nombre, fecha de nacimiento, edad, género, teléfono, alergias).
   El alta ligera crea el paciente como *Consulta Externa*.
3. Captura **fecha, hora, médico, motivo e indicaciones**. El médico de consulta
   puede crearse en el momento si tienes permiso.
4. En **Consultas**, además, se capturan los datos del **consentimiento
   informado** (quién suscribe, parentesco, talla, peso, enfermera/o).
5. Guarda con **Guardar consulta** o **Guardar e imprimir consentimiento**.

Ambos módulos permiten filtrar por rango de fechas y buscar por paciente o médico.

---

### 4.11 Almacén

Cubre cuatro pantallas relacionadas.

#### Artículos / Almacén
Catálogo único de **todo** lo que hay en inventario (medicamentos, controlados,
insumos, otros) y sus saldos globales.

- **+ Nuevo artículo:** categoría, nombre, unidad de medida y, si es **controlado**,
  la **Fracción LGS** (obligatoria para auditoría). Se autogenera el ID.
- **↓ Entrada:** registra stock que llega. Si la categoría lo exige, pide **lote**
  y **caducidad**; si es controlado, pide **folio de receta**. Cada entrada con
  lote crea una **caja** en el control de Lotes.
- **⇄ Traspaso:** mueve stock entre almacenes/ubicaciones.
- **Movimientos:** salida (uso administrativo) y ajuste (+/− para correcciones;
  ajuste lo hacen solo ALMACEN y DIRECTOR_MEDICO).

#### Saldos (controlados)
Vista de **solo lectura** con la existencia en tiempo real de los medicamentos
**controlados COFEPRIS**: saldo global, mínimo y alerta si está bajo. Es la
referencia rápida para auditoría.

#### Entradas
Punto de entrada para **medicamentos** que llegan del proveedor. Pide medicamento,
cantidad, unidad, **folio de receta (obligatorio para controlados)**, lote y
caducidad. Cada entrada equivale a una **caja cerrada** que luego se consume.

#### Cajas / Lotes
Control individual de cada **caja** de medicamento desde que entra hasta que se
agota o caduca. Filtra por **Abiertas (con saldo) / Agotadas / Todas** (ordenadas
por caducidad). Al abrir una caja ves su **trazabilidad**: qué cirugías/pacientes
consumieron de ella, cuándo y quién lo registró. Estados de caja: ABIERTA,
AGOTADA, CADUCADA, CANCELADA.

---

### 4.12 Compras

#### Órdenes de compra
Gestiona el ciclo de compra a proveedores.

- **+ Nueva orden:** elige proveedor, condiciones de pago y agrega **partidas**
  (artículo, cantidad, precio, descuento). Calcula subtotal, IVA (16%) y total.
  Se crea en estado **BORRADOR**.
- **Enviar:** pasa a **ENVIADA**.
- **Recibir:** captura lo que llegó por partida (con lote/caducidad y, si es
  controlado, folio de receta). Al recibir, el sistema **genera la entrada a
  inventario automáticamente** (crea las cajas). Si llegó todo, la OC queda
  **RECIBIDA**; si llegó parte, **RECIBIDA_PARCIAL** (se puede recibir en varios
  viajes).
- **Cancelar:** solo ADMIN / DIRECTOR_MEDICO.

Estados: BORRADOR → ENVIADA → RECIBIDA_PARCIAL / RECIBIDA (o CANCELADA).
RECIBIDA y CANCELADA son finales.

#### Proveedores
Catálogo de proveedores: nombre, RFC, contacto y **condiciones de pago** (que se
auto-rellenan al crear una OC). Alta y edición para ADMIN, ALMACEN, GESTORIA y
DIRECTOR_MEDICO.

---

### 4.13 Libro COFEPRIS

**Para qué sirve:** la **bitácora oficial** de movimientos de medicamentos
controlados, exigida por COFEPRIS. **Se llena solo** a partir de las entradas
(ENTRADA) y los consumos (SALIDA) registrados en los demás módulos.

- Filtra por **rango de fechas**.
- Cada asiento muestra: folio, fecha/hora, tipo (ENTRADA/SALIDA), medicamento,
  cantidad, saldo acumulado y la referencia (cirugía, receta u OC).
- **⬇ Exportar CSV** para entregar a auditoría o conciliar con facturas.

> Es de **solo lectura**: no se edita a mano. Su exactitud depende de capturar
> bien las entradas y los consumos. Conserva los registros según la regulación
> COFEPRIS vigente.

---

### 4.14 Caja

**Quién:** CAJERO, DIRECTOR_MEDICO, ADMIN.

#### Cobro de caja
Arma la **cuenta del paciente** y registra el cobro.

1. **Busca al paciente**; se cargan sus datos, expediente, cirugías y la
   **remisión de materiales** (se suma sola en "Materiales y medicamento").
2. Captura los conceptos por grupo: **Clínica** (hospitalización, consulta,
   materiales, oxígeno…), **Equipo** (bomba, laparoscopio, monitor…),
   **Laboratorio** e **Imagen**. Los totales se calculan solos.
3. **Honorarios médicos:** cirujano, ayudantes, anestesiólogo, etc., cada uno con
   su monto.
4. **Depósitos y pago final:** registra anticipos y el pago al egresar (efectivo,
   tarjeta, transferencia).
5. **Comisión bancaria (4%):** se suma solo si se cobra con **tarjeta** y marcas
   la casilla correspondiente.
6. **💾 Registrar cobro** guarda la cuenta. Con **🔒 Cerrar cuenta** se bloquean
   nuevos consumos; **🔓 Reabrir** (solo ADMIN) la vuelve a abrir.

#### Recibos de caja
Emite e imprime recibos de **CAJA, NÓMINA, LIMPIEZA y PAGO** (de paciente).

1. **+ Nuevo recibo:** elige tipo, fecha, beneficiario (o paciente si es PAGO),
   concepto/periodo según el tipo, monto y forma de pago. La cantidad en letra se
   genera sola.
2. Los **beneficiarios** se administran con el botón **👥 Beneficiarios** (se
   pueden crear al vuelo).
3. **Emitir e imprimir** genera el folio e imprime el recibo con el logo de la
   clínica. Un recibo se puede **cancelar** (queda marcado, no se borra).

#### Registro de ventas
Vista consolidada de todos los cobros (un renglón por expediente), con filtros por
fecha y búsqueda, total del periodo y **exportación a Excel (CSV)**.

---

### 4.15 Médicos y cirugías (catálogos)

**Para qué sirve:** mantener los catálogos de apoyo.

- **+ Nuevo médico:** nombre, cédula profesional y especialidad (cédula de
  especialidad y teléfono opcionales). Estos médicos aparecen como cirujano,
  vendedor o tratante en los formularios.
- **+ Nueva cirugía personalizada:** para procedimientos que no están en el
  catálogo CPT (que ya trae miles). Nombre obligatorio; CPT, categoría y
  subsistema opcionales. Hay un buscador para verificar que no exista antes.
- **Otros catálogos** (medicamentos, quirófanos, aseguradoras): de consulta, según
  permisos.

---

## 5. Quién usa qué (permisos por rol)

El sistema controla **qué módulos ve** cada rol (páginas del menú) y **qué botones
de crear/editar** puede usar (acciones). Si un rol no tiene un permiso, ni siquiera
ve el botón. Resumen orientativo:

| Módulo | Roles con acceso (resumen) |
|--------|----------------------------|
| Inicio (Dashboard) | Todos |
| Alta de paciente / Pacientes | ADMIN, RECEPCION, jefas de enfermería, dirección |
| Habitaciones | ADMIN, RECEPCION, piso, enfermería, dirección |
| Programación / Cirugías | ADMIN, quirófano, dirección (programación también RECEPCION) |
| Recetas / Consumos / BOM | ADMIN, quirófano, almacén, dirección (consumos también enfermería) |
| Consultas / Urgencias | ADMIN, RECEPCION, enfermería, quirófano, piso, dirección |
| Almacén (Artículos, Saldos, Entradas, Cajas) | ADMIN, ALMACEN, jefas de enfermería, dirección (entradas más restringido) |
| Compras / Proveedores | ADMIN, ALMACEN, GESTORIA, DIRECTOR_MEDICO |
| Libro COFEPRIS | ADMIN, ALMACEN, GESTORIA, jefas de enfermería, dirección |
| Caja (Cobro, Recibos, Ventas) | ADMIN, DIRECTOR_MEDICO, CAJERO |
| Médicos y cirugías (catálogos) | ADMIN, ALMACEN, GESTORIA, enfermería, dirección |

**Autorizaciones especiales:**
- **Autorizar/Rechazar BOM:** DIRECTOR_MEDICO (o ADMIN).
- **Cancelar orden de compra:** ADMIN o DIRECTOR_MEDICO.
- **Reabrir cuenta de caja / forzar borrado de paciente con historial:** ADMIN.

> La matriz exacta vive en el código (constante `PERMISOS`) y la valida también el
> servidor en cada acción. Para cambiar permisos se edita esa matriz; pídelo al
> administrador del sistema.

---

## 6. Flujos completos de principio a fin

### Flujo A — Paciente quirúrgico: del ingreso al cobro

1. **Recepción** da de **alta al paciente** (4.2); si asigna habitación, queda
   hospitalizado al instante.
2. **Programación Q.X.** agenda la **cirugía** (4.5); se crea su **BOM (SOLICITADO)**.
3. **BOM:** se asigna paquete, se **propone**, el **director autoriza** y almacén
   **entrega** (4.9).
4. Se **vincula la receta** física a la cirugía (4.7) → estado RECETA_VINCULADA.
5. Durante/después de la cirugía se **registran los consumos** (4.8); se descuenta
   inventario y se asienta la **SALIDA en el Libro COFEPRIS**.
6. Se **termina la cirugía** (4.6) y, al alta, se **egresa** de la habitación (4.4).
7. **Caja** arma la cuenta (con la remisión de materiales), **cobra** y **cierra**
   la cuenta; opcionalmente emite **recibo** (4.14).

### Flujo B — Abasto: de la compra a la auditoría

1. **Proveedores:** se da de alta el proveedor (4.12).
2. **Órdenes de compra:** se crea la OC (BORRADOR), se **envía** y, al llegar la
   mercancía, se **recibe** (4.12) → genera **entradas/cajas** en inventario
   automáticamente.
3. **Artículos / Saldos / Cajas-Lotes:** el stock queda disponible y trazable (4.11).
4. **Consumos** descuentan de las cajas conforme se usan (4.8).
5. **Libro COFEPRIS:** refleja entradas y salidas; se **exporta** para auditoría
   (4.13).

---

## 7. Preguntas frecuentes y problemas comunes

**No veo un módulo en el menú.**
Tu rol no tiene acceso a esa pantalla. Es normal: el menú se adapta al puesto. Si
necesitas acceso, pídelo al administrador.

**"Se me cerró la ventana y perdí lo que estaba capturando."**
El sistema ahora **pide confirmación** antes de cerrar un formulario con datos sin
guardar. Si aun así no ves el cambio, **recarga con Ctrl+F5** (limpia la caché del
navegador) para bajar la última versión.

**No puedo dar de alta sin CURP.**
El CURP es obligatorio, salvo que marques **Paciente extranjero (sin CURP)** en la
pestaña *Datos particulares*.

**No me deja programar una cirugía a cierta hora.**
Probablemente hay otra cirugía en ese **mismo quirófano** en un horario que se
traslapa. Cambia la hora, la duración (TQX) o el quirófano.

**No puedo terminar una cirugía.**
Normalmente falta **registrar los consumos** o **vincular la receta**. Revísalo en
los módulos de Consumos y Recetas.

**El Libro COFEPRIS no cuadra.**
El libro se alimenta solo de entradas y consumos. Si algo falta, revisa que esas
capturas se hayan hecho correctamente (entradas con folio de receta, consumos
ligados a la cirugía). El libro no se edita a mano.

**Quién autoriza un BOM.**
El **Director Médico**. El flujo es: almacén/quirófano *proponen* → director
*autoriza* (o rechaza) → almacén *entrega*.

---

*Última actualización: 2026-06-26.*

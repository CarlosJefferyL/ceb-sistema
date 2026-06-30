/**
 * Sistema de Gestión de Medicamentos Controlados
 * Clínica Estar Bien — Backend API (Google Apps Script)
 *
 * VERSIÓN ACTUALIZADA: matriz de permisos por rol sincronizada con frontend.
 * Roles válidos: ADMIN, JEFE_ENFERMERIA, ENFERMERIA, ALMACEN, GESTORIA,
 *                DIRECTOR_MEDICO, RECEPCION
 *
 * INSTRUCCIONES DE DESPLIEGUE:
 *  1. Abre el Google Sheet de la plantilla.
 *  2. Menú Extensiones → Apps Script.
 *  3. Reemplaza el código existente con este archivo.
 *  4. Guarda (Ctrl+S).
 *  5. Click en "Implementar" → "Administrar implementaciones"
 *     → editar versión existente → "Nueva versión" → "Implementar".
 *  6. NO cambies la URL: sigue siendo la misma.
 */

// ============================================================
// CONFIGURACIÓN GLOBAL
// ============================================================
var SS = SpreadsheetApp.openById('1XymgdtY4IQNgiLeh_ET3bHI8DMOTdzC5MWaeLD4R2vw');

var SHEETS = {
  CONFIG: 'CONFIG',
  MEDICAMENTOS: 'CAT_Medicamentos',
  MEDICOS: 'CAT_Medicos',
  MEDICOS_CONSULTA: 'CAT_MedicosConsulta',
  CIRUGIAS_TIPO: 'CAT_Cirugias',
  USUARIOS: 'CAT_Usuarios',
  QUIROFANOS: 'CAT_Quirofanos',
  HABITACIONES: 'CAT_Habitaciones',
  ASEGURADORAS: 'CAT_Aseguradoras',
  PACIENTES: 'Pacientes',
  CIRUGIAS: 'Cirugias',
  AUDIT_CIRUGIAS: 'Audit_Cirugias',
  HOSPITALIZACIONES: 'Hospitalizaciones',
  MOVIMIENTOS_HAB: 'Movimientos_Habitacion',
  RECETAS: 'Recetas',
  CONSUMOS: 'Consumos',
  LOTES: 'Lotes',
  LIBRO: 'LibroCOFEPRIS',
  INV_MOV: 'Inventario_Mov',
  INV_SALDO: 'Inventario_Saldo',
  ARTICULOS: 'CAT_Articulos',
  CODIGOS_BARRAS: 'Codigos_Barras',
  // ---- Módulo Compras ----
  PROVEEDORES: 'CAT_Proveedores',
  ORDENES_COMPRA: 'Ordenes_Compra',
  OC_ITEMS: 'OC_Items',
  PRECIOS_COMPRA: 'Precios_Compra',
  UBICACIONES: 'CAT_Ubicaciones',
  REMISION_ITEMS: 'Remision_Items',
  CONSULTAS: 'Consultas',
  RECIBOS: 'Recibos',
  BENEFICIARIOS: 'CAT_Beneficiarios',
  CAJA: 'Caja',
  // ---- Módulo F2a: tarifas + cargos de servicios ----
  SERVICIOS: 'CAT_Servicios',
  CARGOS: 'Cargos_Paciente',
  TARIFAS_CUARTO: 'CAT_Tarifas_Cuarto',
  // ---- Módulo BOM (Bill of Materials quirúrgico) ----
  PAQUETES: 'CAT_Paquetes',
  INSUMOS: 'CAT_Insumos',
  BOM_PLANTILLA: 'BOM_Plantilla_Items',
  BOM_CIRUGIA: 'BOM_Cirugia',
  BOM_ITEMS: 'BOM_Items',
  // ---- Módulo Pedidos (solicitudes de material de enfermería) ----
  PEDIDOS: 'Pedidos',
  PEDIDO_ITEMS: 'Pedido_Items'
};

// Encabezados de la hoja de médicos de consulta externa (creada bajo demanda).
var MEDICOS_CONSULTA_HEADERS = ['ID_MedicoConsulta','Nombre_Completo','Titulo','Cedula_Profesional','Activo','Capturado_Por','Timestamp_Captura'];

// ============================================================
// MATRIZ DE PERMISOS — DEBE COINCIDIR EXACTAMENTE CON LA DEL FRONTEND
// ============================================================
// Si modificas la matriz del frontend (index.html), modifica también ésta.
// El backend es la fuente de verdad: aunque alguien manipule el frontend,
// estas validaciones se aplican siempre.
// ============================================================
// QX = JEFE_ENFERMERIA_QUIROFANO · PISO = JEFE_ENFERMERIA_PISO · JE = JEFE_ENFERMERIA (legado)
var PERMISOS_ACCIONES = {
  // ---- Flujo quirúrgico (QUIRÓFANO) ----
  'programar_cirugia':    ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','DIRECTOR_MEDICO'],
  'nueva_cirugia':        ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','DIRECTOR_MEDICO'],
  'alta_tipo_cirugia':    ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','DIRECTOR_MEDICO'],
  'editar_cirugia':       ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','ENFERMERIA','DIRECTOR_MEDICO'],
  'cancelar_cirugia':     ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','DIRECTOR_MEDICO'],
  'terminar_cirugia':     ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','ENFERMERIA','DIRECTOR_MEDICO'],
  'reabrir_cirugia':      ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','DIRECTOR_MEDICO'],
  // ---- Hospitalización (PISO) ----
  'ingresar_habitacion':  ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_PISO','ENFERMERIA','DIRECTOR_MEDICO','RECEPCION'],
  // ---- Compartidas (ambos jefes) ----
  'nuevo_paciente_recep': ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','DIRECTOR_MEDICO','RECEPCION'],
  'nuevo_paciente_dir':   ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','DIRECTOR_MEDICO','RECEPCION'],
  'editar_paciente':      ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ALMACEN','DIRECTOR_MEDICO','RECEPCION'],
  'vincular_receta':      ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'registrar_consumo':    ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','ALMACEN','DIRECTOR_MEDICO'],
  'cancelar_consumo':     ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ALMACEN','DIRECTOR_MEDICO'],
  'nueva_entrada':        ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'alta_medicamento':     ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ALMACEN','DIRECTOR_MEDICO'],
  // ---- Inventario general (todos los artículos: medicamentos, controlados, insumos, otros) ----
  'alta_articulo':        ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ALMACEN','DIRECTOR_MEDICO'],
  'editar_articulo':      ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ALMACEN','DIRECTOR_MEDICO'],
  'entrada_articulo':     ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'salida_articulo':      ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','ALMACEN','DIRECTOR_MEDICO'],
  'ajuste_articulo':      ['ADMIN','ALMACEN','DIRECTOR_MEDICO'],
  'traspaso_articulo':    ['ADMIN','ALMACEN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','DIRECTOR_MEDICO'],
  // ---- Compras ----
  'alta_proveedor':       ['ADMIN','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'editar_proveedor':     ['ADMIN','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'crear_oc':             ['ADMIN','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'editar_oc':            ['ADMIN','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'enviar_oc':            ['ADMIN','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'cancelar_oc':          ['ADMIN','DIRECTOR_MEDICO'],
  'recibir_oc':           ['ADMIN','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'alta_medico':          ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','DIRECTOR_MEDICO','RECEPCION'],
  'alta_medico_consulta': ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','DIRECTOR_MEDICO','RECEPCION'],
  'exportar_libro':       ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'registrar_consulta':   ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','DIRECTOR_MEDICO','RECEPCION'],
  // ---- Caja ----
  'cobro_caja':           ['ADMIN','DIRECTOR_MEDICO','CAJERO'],
  'emitir_recibo':        ['ADMIN','DIRECTOR_MEDICO','CAJERO'],
  'cancelar_recibo':      ['ADMIN','DIRECTOR_MEDICO','CAJERO'],
  'alta_beneficiario':    ['ADMIN','DIRECTOR_MEDICO','CAJERO'],
  'editar_beneficiario':  ['ADMIN','DIRECTOR_MEDICO','CAJERO'],
  // ---- Módulo BOM ----
  'proponer_bom':         ['ADMIN','ALMACEN','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA'],
  'autorizar_bom':        ['ADMIN','DIRECTOR_MEDICO'],
  'rechazar_bom':         ['ADMIN','DIRECTOR_MEDICO'],
  'asignar_bom':          ['ADMIN','DIRECTOR_MEDICO'],
  'entregar_bom':         ['ADMIN','ALMACEN'],
  'editar_plantilla_bom': ['ADMIN','ALMACEN','DIRECTOR_MEDICO'],
  // ---- Módulo Pedidos (enfermería pide, almacén surte) ----
  'crear_pedido':         ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','DIRECTOR_MEDICO'],
  'surtir_pedido':        ['ADMIN','ALMACEN','DIRECTOR_MEDICO'],
  'cancelar_pedido':      ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','ALMACEN','DIRECTOR_MEDICO'],
  'devolucion_material':  ['ADMIN','ALMACEN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','DIRECTOR_MEDICO']
};

// JEFE_ENFERMERIA se conserva como rol legado (equivale a "ambos" flujos) para no
// romper las cuentas existentes mientras se migran en CAT_Usuarios a los roles divididos
// JEFE_ENFERMERIA_QUIROFANO (flujo quirúrgico + BOM) y JEFE_ENFERMERIA_PISO (hospitalización).
var ROLES_VALIDOS = ['ADMIN','JEFE_ENFERMERIA','JEFE_ENFERMERIA_QUIROFANO','JEFE_ENFERMERIA_PISO','ENFERMERIA','ALMACEN','GESTORIA','DIRECTOR_MEDICO','RECEPCION','CAJERO'];

/**
 * Valida si un rol tiene permiso para ejecutar una acción.
 * @param {string} rol - rol del usuario (debe estar en ROLES_VALIDOS)
 * @param {string} accion - clave de la acción (debe estar en PERMISOS_ACCIONES)
 * @return {boolean}
 */
function tienePermiso(rol, accion) {
  if (!rol || !accion) return false;
  var lista = PERMISOS_ACCIONES[accion];
  if (!Array.isArray(lista)) return false;
  return lista.indexOf(rol) !== -1;
}

/**
 * Devuelve un error estandarizado cuando no se tiene permiso.
 */
function errorSinPermiso(rol, accion) {
  return {
    ok: false,
    error: 'El rol ' + (rol || 'desconocido') + ' no tiene permiso para: ' + accion +
           '. Comunícate con un administrador si necesitas este acceso.'
  };
}

// ============================================================
// HANDLERS HTTP — entry points de la API
// ============================================================

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  try {
    var result;
    switch (action) {
      case 'ping':         result = { ok: true, msg: 'API activa', ts: new Date() }; break;
      case 'login':        result = login(e.parameter.codigo); break;
      case 'getCatalogos': result = getCatalogos(); break;
      case 'getCirugias':  result = getCirugias(e.parameter.estado, e.parameter.desde, e.parameter.hasta, e.parameter.idMedico); break;
      case 'getRecetas':   result = getRecetas(e.parameter.estado); break;
      case 'getConsumos':  result = getConsumos(e.parameter.desde, e.parameter.hasta); break;
      case 'getConsumosPorCirugia': result = getConsumosPorCirugia(e.parameter.folioCirugia); break;
      case 'getLibro':     result = getLibro(e.parameter.desde, e.parameter.hasta); break;
      case 'getInventario':result = getInventario(); break;
      case 'getInventarioGeneral': result = getInventarioGeneral(e.parameter.categoria, e.parameter.ubicacion); break;
      case 'getArticulos': result = getArticulos(e.parameter.categoria); break;
      case 'getUbicaciones': result = getUbicaciones(); break;
      case 'getRemisionPaciente': result = getRemisionPaciente(e.parameter.idPaciente); break;
      case 'getProveedores': result = getProveedores(); break;
      case 'getOrdenesCompra': result = getOrdenesCompra(e.parameter.estado, e.parameter.desde, e.parameter.hasta); break;
      case 'getOrdenCompra': result = getOrdenCompra(e.parameter.folioOC); break;
      case 'getPreciosCompra': result = getPreciosCompra(e.parameter.idArticulo); break;
      case 'getLotes':     result = getLotes(e.parameter.estado, e.parameter.idMedicamento); break;
      case 'getConsumosPorLote': result = getConsumosPorLote(e.parameter.idLote); break;
      case 'getDashboard': result = getDashboard(e.parameter.horizonte); break;
      case 'getProgramacionDia': result = getProgramacionDia(e.parameter.fecha); break;
      case 'getProgramacionMes': result = getProgramacionMes(e.parameter.anio, e.parameter.mes); break;
      case 'validarConflictoHorario': result = validarConflictoHorario(e.parameter.idQuirofano, e.parameter.fecha, e.parameter.horaInicio, e.parameter.tqxHoras, e.parameter.folioExcluir); break;
      case 'getTableroHabitaciones': result = getTableroHabitaciones(); break;
      case 'getOcupacionEnFecha': result = getOcupacionEnFecha(e.parameter.fecha); break;
      case 'getCirugiasParaHospitalizar': result = getCirugiasParaHospitalizar(); break;
      case 'getHistorialHabitacion': result = getHistorialHabitacion(e.parameter.idHabitacion); break;
      case 'getPacientes': result = getPacientes(e.parameter.busqueda); break;
      case 'getPaciente': result = getPaciente(e.parameter.idPaciente); break;
      case 'getAseguradoras': result = getAseguradoras(); break;
      case 'getAuditCirugia': result = getAuditCirugia(e.parameter.folio); break;
      case 'getConsultas': result = getConsultas(e.parameter.tipo, e.parameter.desde, e.parameter.hasta); break;
      case 'buscarCirugias': result = buscarCirugias(e.parameter.q, e.parameter.limite); break;
      case 'getRecibos':     result = getRecibos(e.parameter.desde, e.parameter.hasta); break;
      case 'getBeneficiarios': result = getBeneficiarios(); break;
      case 'getBeneficiariosAdmin': result = getBeneficiariosAdmin(); break;
      case 'buscarPacientesCobro': result = buscarPacientesCobro(e.parameter.q); break;
      case 'getDatosPacienteParaCobro': result = getDatosPacienteParaCobro(e.parameter.idPaciente); break;
      case 'getPacientesActivos': result = getPacientesActivos(); break;
      case 'getCatalogoServicios': result = getCatalogoServicios(); break;
      case 'getCargosPaciente': result = getCargosPaciente(e.parameter.idPaciente); break;
      case 'getIngresos':    result = getIngresos(e.parameter.desde, e.parameter.hasta); break;
      case 'getBOM':         result = getBOM(e.parameter.folioCirugia); break;
      case 'getBOMPendientes': result = getBOMPendientes(); break;
      case 'getBOMPlantilla': result = getBOMPlantilla(e.parameter.clavePaquete); break;
      case 'getPaquetesAdmin': result = getPaquetesAdmin(); break;
      case 'getPedidos':     result = getPedidos(e.parameter.estado, e.parameter.desde, e.parameter.hasta); break;
      case 'getPedido':      result = getPedido(e.parameter.idPedido); break;
      case 'buscarArticuloPorBarras': result = buscarArticuloPorBarras(e.parameter.codigo); break;
      case 'getCodigosBarras': result = getCodigosBarras(e.parameter.idArticulo); break;
      case 'getMaterialDevolverPaciente': result = getMaterialDevolverPaciente(e.parameter.idPaciente); break;
      default:             result = { ok: false, error: 'Acción no reconocida: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var result;
    switch (action) {
      case 'crearCirugia':       result = crearCirugia(payload.data); break;
      case 'emitirReceta':       result = emitirReceta(payload.data); break;
      case 'registrarConsumo':   result = registrarConsumo(payload.data); break;
      case 'cancelarConsumo':    result = cancelarConsumo(payload.data); break;
      case 'registrarEntrada':   result = registrarEntrada(payload.data); break;
      case 'altaArticulo':       result = altaArticulo(payload.data); break;
      case 'registrarEntradaArticulo': result = registrarEntradaArticulo(payload.data); break;
      case 'registrarMovimientoArticulo': result = registrarMovimientoArticulo(payload.data); break;
      case 'registrarTraspaso':  result = registrarTraspaso(payload.data); break;
      case 'registrarRemision':  result = registrarRemision(payload.data); break;
      case 'registrarCargosServicio': result = registrarCargosServicio(payload.data); break;
      case 'registrarUsoBOM':    result = registrarUsoBOM(payload.data); break;
      case 'migrarArticulos':    result = migrarArticulos(payload.data); break;
      case 'altaProveedor':      result = altaProveedor(payload.data); break;
      case 'editarProveedor':    result = editarProveedor(payload.data); break;
      case 'crearOrdenCompra':   result = crearOrdenCompra(payload.data); break;
      case 'cambiarEstadoOC':    result = cambiarEstadoOC(payload.data); break;
      case 'recibirOrdenCompra': result = recibirOrdenCompra(payload.data); break;
      case 'importarCatalogoPrecios': result = importarCatalogoPrecios(payload.data); break;
      case 'actualizarCirugia':  result = actualizarCirugia(payload.data); break;
      case 'altaPaciente':       result = altaPaciente(payload.data); break;
      case 'altaMedicamento':    result = altaMedicamento(payload.data); break;
      case 'altaMedico':         result = altaMedico(payload.data); break;
      case 'altaMedicoConsulta': result = altaMedicoConsulta(payload.data); break;
      case 'altaCirugiaTipo':    result = altaCirugiaTipo(payload.data); break;
      case 'altaQuirofano':      result = altaQuirofano(payload.data); break;
      case 'ingresarPaciente':   result = ingresarPaciente(payload.data); break;
      case 'egresarPaciente':    result = egresarPaciente(payload.data); break;
      case 'moverPaciente':      result = moverPaciente(payload.data); break;
      case 'actualizarPaciente': result = actualizarPaciente(payload.data); break;
      case 'borrarPaciente':     result = borrarPaciente(payload.data); break;
      case 'altaAseguradora':    result = altaAseguradora(payload.data); break;
      case 'editarCirugia':      result = editarCirugia(payload.data); break;
      case 'cancelarCirugia':    result = cancelarCirugia(payload.data); break;
      case 'terminarCirugia':    result = terminarCirugia(payload.data); break;
      case 'reabrirCirugia':     result = reabrirCirugia(payload.data); break;
      case 'asignarPacienteCirugia': result = asignarPacienteCirugia(payload.data); break;
      case 'registrarConsulta':  result = registrarConsulta(payload.data); break;
      case 'emitirRecibo':       result = emitirRecibo(payload.data); break;
      case 'cancelarRecibo':     result = cancelarRecibo(payload.data); break;
      case 'altaBeneficiario':   result = altaBeneficiario(payload.data); break;
      case 'editarBeneficiario': result = editarBeneficiario(payload.data); break;
      case 'guardarIngreso':     result = guardarIngreso(payload.data); break;
      case 'cerrarCuentaCobro':  result = cerrarCuentaCobro(payload.data); break;
      case 'reabrirCuentaCobro': result = reabrirCuentaCobro(payload.data); break;
      case 'proponerBOM':        result = proponerBOM(payload.data); break;
      case 'asignarBOMPaquetes':  result = asignarBOMPaquetes(payload.data); break;
      case 'autorizarBOM':       result = autorizarBOM(payload.data); break;
      case 'rechazarBOM':        result = rechazarBOM(payload.data); break;
      case 'entregarBOM':        result = entregarBOM(payload.data); break;
      case 'guardarPaquete':     result = guardarPaquete(payload.data); break;
      case 'guardarPlantillaBOM': result = guardarPlantillaBOM(payload.data); break;
      case 'crearPedido':        result = crearPedido(payload.data); break;
      case 'setCodigoBarras':    result = setCodigoBarras(payload.data); break;
      case 'agregarCodigoBarras': result = agregarCodigoBarras(payload.data); break;
      case 'quitarCodigoBarras':  result = quitarCodigoBarras(payload.data); break;
      case 'surtirPedido':       result = surtirPedido(payload.data); break;
      case 'surtirPedidoConEscaneo': result = surtirPedidoConEscaneo(payload.data); break;
      case 'cancelarPedido':     result = cancelarPedido(payload.data); break;
      case 'registrarDevolucion': result = registrarDevolucion(payload.data); break;
      default:                   result = { ok: false, error: 'Acción POST no reconocida: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// HELPERS GENERALES
// ============================================================

function getSheet(name) {
  var sh = SS.getSheetByName(name);
  if (!sh) throw new Error('Pestaña no encontrada: ' + name);
  return sh;
}

function getConfig(key) {
  var sh = getSheet(SHEETS.CONFIG);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

function setConfig(key, value) {
  var sh = getSheet(SHEETS.CONFIG);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sh.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
}

function nextFolio(tipo) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var prefijoKey, contadorKey;
    if (tipo === 'CIRUGIA')   { prefijoKey = 'PrefijoCirugia';  contadorKey = 'UltimoFolioCirugia'; }
    else if (tipo === 'RECETA'){ prefijoKey = 'PrefijoReceta';  contadorKey = 'UltimoFolioReceta'; }
    else throw new Error('Tipo de folio inválido: ' + tipo);

    var prefijo = getConfig(prefijoKey);
    var ultimo = parseInt(getConfig(contadorKey), 10) || 0;
    var nuevo = ultimo + 1;
    setConfig(contadorKey, nuevo);
    return prefijo + String(nuevo).padStart(5, '0');
  } finally {
    lock.releaseLock();
  }
}

function sheetToObjects(sheetName) {
  var sh = getSheet(sheetName);
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];

  // Para LibroCOFEPRIS e Inventario_Saldo los headers están en otra fila
  var headerRow = 0;
  if (sheetName === SHEETS.LIBRO) headerRow = 3;          // fila 4 (0-indexed)
  if (sheetName === SHEETS.INV_SALDO) headerRow = 3;      // fila 4 (0-indexed)

  var headers = data[headerRow];
  var rows = [];
  for (var i = headerRow + 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[1]) continue; // saltar filas vacías
    // Saltar filas de ejemplo (texto entre corchetes en columna 2)
    if (typeof row[1] === 'string' && row[1].indexOf('[Ej') === 0) continue;
    if (typeof row[1] === 'string' && row[1].indexOf('[Ejemplo') === 0) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    rows.push(obj);
  }
  return rows;
}

function nowTs() {
  return Utilities.formatDate(new Date(), getConfig('ZonaHoraria') || 'America/Chihuahua', 'yyyy-MM-dd HH:mm:ss');
}

function todayStr() {
  return Utilities.formatDate(new Date(), getConfig('ZonaHoraria') || 'America/Chihuahua', 'yyyy-MM-dd');
}

/**
 * Determina si un valor de la columna "Activo" cuenta como activo.
 * Es TOLERANTE a variaciones de captura: acepta SI, Sí, si, SÍ, S,
 * TRUE, X, 1, ACTIVO, etc. También trata la celda VACÍA como activo
 * (criterio: si no se marcó explícitamente como inactivo, está activo).
 * Solo cuenta como INACTIVO si dice claramente NO, FALSE, 0, INACTIVO, BAJA.
 *
 * @param {*} valor - contenido de la celda Activo
 * @return {boolean}
 */
function esActivo(valor) {
  if (valor === true) return true;
  if (valor === false) return false;
  var s = String(valor == null ? '' : valor).trim().toUpperCase();
  // Quitar acentos para que "SÍ" cuente igual que "SI"
  s = s.replace(/Í/g, 'I').replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Ó/g, 'O').replace(/Ú/g, 'U');
  var inactivos = ['NO', 'N', 'FALSE', '0', 'INACTIVO', 'BAJA', 'CANCELADO', 'SUSPENDIDO'];
  if (inactivos.indexOf(s) !== -1) return false;
  // Celda vacía o cualquier otro valor → se considera activo
  return true;
}

// ============================================================
// LOGIN / AUTH SIMPLE
// ============================================================

function login(codigo) {
  if (!codigo) return { ok: false, error: 'Código requerido' };
  var usuarios = sheetToObjects(SHEETS.USUARIOS);
  for (var i = 0; i < usuarios.length; i++) {
    var u = usuarios[i];
    // Para login exigimos activación EXPLÍCITA (la celda no puede estar vacía).
    // Aceptamos variantes SI/Sí/si pero rechazamos celda vacía por seguridad.
    var activoUsuario = String(u.Activo == null ? '' : u.Activo).trim().toUpperCase()
                         .replace(/Í/g, 'I');
    var loginActivo = (activoUsuario === 'SI' || activoUsuario === 'S' ||
                       activoUsuario === 'TRUE' || activoUsuario === '1' ||
                       activoUsuario === 'ACTIVO');
    if (String(u.Codigo_Acceso) === String(codigo) && loginActivo) {
      // Validar que el rol del usuario sea uno de los reconocidos
      if (ROLES_VALIDOS.indexOf(u.Rol) === -1) {
        return {
          ok: false,
          error: 'Tu rol "' + u.Rol + '" no es válido. Roles válidos: ' + ROLES_VALIDOS.join(', ') +
                 '. Pide a un administrador que actualice tu rol en CAT_Usuarios.'
        };
      }
      // Actualizar último acceso
      var sh = getSheet(SHEETS.USUARIOS);
      var data = sh.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        if (data[r][0] === u.ID_Usuario) {
          sh.getRange(r + 1, 6).setValue(nowTs());
          break;
        }
      }
      return {
        ok: true,
        usuario: { id: u.ID_Usuario, nombre: u.Nombre, rol: u.Rol }
      };
    }
  }
  return { ok: false, error: 'Código inválido' };
}

// ============================================================
// CATÁLOGOS
// ============================================================

function getCatalogos() {
  // Las cirugías se buscan bajo demanda con buscarCirugias() — son ~5,000 entradas
  // y enviarlas todas haría lento el login y consumiría datos en celular.
  ensureBOMSheets_(); // crea las hojas del módulo BOM en el primer arranque
  ensureSheetConHeaders_(SHEETS.MEDICOS_CONSULTA, MEDICOS_CONSULTA_HEADERS); // médicos de consulta externa
  ensureArticulosSheet_(); // catálogo único de inventario general
  ensureComprasSheets_();  // proveedores y órdenes de compra
  ensureUbicacionesSheet_(); // almacenes (multi-ubicación) + columnas Ubicacion
  ensureRemisionSheet_();    // líneas de remisión (cuenta del paciente)
  ensureCargosSheets_();      // F2a: servicios, cargos y tarifas de cuarto
  return {
    ok: true,
    medicamentos: sheetToObjects(SHEETS.MEDICAMENTOS).filter(function(m){return esActivo(m.Activo);}),
    articulos:    sheetToObjects(SHEETS.ARTICULOS).filter(function(a){return esActivo(a.Activo);}),
    proveedores:  sheetToObjects(SHEETS.PROVEEDORES).filter(function(p){return esActivo(p.Activo);}),
    precios:      sheetToObjects(SHEETS.PRECIOS_COMPRA),
    ubicaciones:  getUbicaciones().data,
    medicos:      sheetToObjects(SHEETS.MEDICOS).filter(function(m){return esActivo(m.Activo);}),
    medicosConsulta: sheetToObjects(SHEETS.MEDICOS_CONSULTA).filter(function(m){return esActivo(m.Activo);}),
    quirofanos:   sheetToObjects(SHEETS.QUIROFANOS).filter(function(q){return esActivo(q.Activo);}),
    habitaciones: sheetToObjects(SHEETS.HABITACIONES).filter(function(h){return esActivo(h.Activo);}),
    aseguradoras: sheetToObjects(SHEETS.ASEGURADORAS).filter(function(a){return esActivo(a.Activo);}),
    pacientes:    sheetToObjects(SHEETS.PACIENTES).filter(function(p){return p.Estatus!=='Suspendido';}),
    paquetes:     sheetToObjects(SHEETS.PAQUETES).filter(function(p){return esActivo(p.Activo);}),
    insumos:      sheetToObjects(SHEETS.INSUMOS).filter(function(i){return esActivo(i.Activo);}),
    servicios:    sheetToObjects(SHEETS.SERVICIOS).filter(function(s){return esActivo(s.Activo);}),
    tarifasCuarto: sheetToObjects(SHEETS.TARIFAS_CUARTO).filter(function(t){return esActivo(t.Activo);}),
    config: {
      nombreClinica: getConfig('NombreClinica'),
      direccion: getConfig('DireccionClinica'),
      responsable: getConfig('ResponsableSanitario'),
      cedulaResp: getConfig('CedulaResponsable'),
      licencia: getConfig('LicenciaSanitaria')
    }
  };
}

// ============================================================
// BÚSQUEDA DE CIRUGÍAS (catálogo CPT con ~5,000 entradas)
// ============================================================

/**
 * Búsqueda inteligente sobre el catálogo de cirugías.
 * Match en: nombre, clave CPT, sub_sistema y tipo_procedimiento.
 *
 * @param {string} q - texto a buscar (mínimo 2 caracteres)
 * @param {number} limite - máximo de resultados (default 30, cap 50)
 */
function buscarCirugias(q, limite) {
  q = String(q || '').trim().toLowerCase();
  if (q.length < 2) {
    return { ok: true, data: [], mensaje: 'Escribe al menos 2 caracteres' };
  }

  limite = Math.min(parseInt(limite, 10) || 30, 50);

  var rows = sheetToObjects(SHEETS.CIRUGIAS_TIPO).filter(function(c){
    return esActivo(c.Activo);
  });

  // Tokenizar la búsqueda en palabras (todas deben aparecer)
  var tokens = q.split(/\s+/).filter(Boolean);

  var resultados = [];
  for (var i = 0; i < rows.length && resultados.length < limite; i++) {
    var c = rows[i];
    var haystack = [
      String(c.Clave_CPT || ''),
      String(c.Nombre_Cirugia || ''),
      String(c.Sub_sistema || ''),
      String(c.Tipo_Procedimiento || ''),
      String(c.Sistema || '')
    ].join(' ').toLowerCase();

    // Todas las palabras deben aparecer (búsqueda AND)
    var match = tokens.every(function(t){ return haystack.indexOf(t) !== -1; });
    if (match) {
      resultados.push({
        idCirugiaTipo: c.ID_Cirugia_Tipo,
        claveCPT: c.Clave_CPT,
        nombreCirugia: c.Nombre_Cirugia,
        sistema: c.Sistema,
        subSistema: c.Sub_sistema,
        tipoProcedimiento: c.Tipo_Procedimiento,
        categoria: c.Categoria,
        duracionEstimada: c.Duracion_Estimada_Min
      });
    }
  }

  return { ok: true, data: resultados, total: resultados.length };
}

// ============================================================
// CIRUGÍAS
// ============================================================

function getCirugias(estado, desde, hasta, idMedico) {
  var rows = sheetToObjects(SHEETS.CIRUGIAS);
  var tz = getConfig('ZonaHoraria') || 'America/Chihuahua';

  function dStr(d) {
    if (!d) return '';
    if (d instanceof Date) return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    return String(d).substring(0, 10);
  }

  if (estado) rows = rows.filter(function(r){ return r.Estado === estado; });
  if (desde)  rows = rows.filter(function(r){ return dStr(r.Fecha_Programada) >= desde; });
  if (hasta)  rows = rows.filter(function(r){ return dStr(r.Fecha_Programada) <= hasta; });
  if (idMedico) rows = rows.filter(function(r){ return r.ID_Medico === idMedico; });

  // Normalizar fecha y hora en respuesta + parsear JSON de medicamentos
  rows = rows.map(function(r){
    r.Fecha_Programada = dStr(r.Fecha_Programada);
    if (r.Hora_Programada instanceof Date) {
      r.Hora_Programada = Utilities.formatDate(r.Hora_Programada, tz, 'HH:mm');
    } else {
      r.Hora_Programada = String(r.Hora_Programada || '').replace(/^'/, '').substring(0, 5);
    }
    // Extraer JSON de medicamentos si existe
    var medsField = String(r.Medicamentos_Solicitados || '');
    var jsonMarker = medsField.indexOf('||JSON||');
    if (jsonMarker !== -1) {
      try {
        r.Medicamentos_Array = JSON.parse(medsField.substring(jsonMarker + 8));
        r.Medicamentos_Resumen = medsField.substring(0, jsonMarker).trim();
      } catch (e) {
        r.Medicamentos_Array = [];
        r.Medicamentos_Resumen = medsField;
      }
    } else {
      r.Medicamentos_Array = [];
      r.Medicamentos_Resumen = medsField;
    }
    return r;
  });
  return { ok: true, data: rows };
}

function crearCirugia(d) {
  // ===== Validación de permisos =====
  if (!tienePermiso(d.rolUsuario, 'nueva_cirugia')) {
    return errorSinPermiso(d.rolUsuario, 'nueva_cirugia');
  }

  // ===== BOM: el paquete es OPCIONAL al programar =====
  // La cirugía se programa con días de anticipación y puede ir sin paquete.
  // La falta de paquete NO frena la programación: el BOM nace SOLICITADO y
  // es el Director Médico quien asigna después el tipo de BOM (asignarBOMPaquetes).
  var paquetesBOM = Array.isArray(d.paquetes) ? d.paquetes.filter(function(x){ return x; }) : [];
  var comentarioBOM = String(d.comentarioSinPaquete || '').trim();

  // ===== Paciente: puede ser del catálogo O texto libre =====
  // Al PROGRAMAR se permite un paciente que aún no está dado de alta
  // (se captura solo el nombre). El paciente del catálogo se vincula
  // después con "Asignar paciente registrado". La validación de que
  // exista un paciente registrado se hace al TERMINAR la cirugía.
  var paciente = null;
  if (d.idPaciente) {
    // Si se mandó un ID, verificar que exista y no esté suspendido
    var pacientes = sheetToObjects(SHEETS.PACIENTES);
    for (var p = 0; p < pacientes.length; p++) {
      if (pacientes[p].ID_Paciente === d.idPaciente) {
        paciente = pacientes[p];
        break;
      }
    }
    if (!paciente) {
      return { ok: false, error: 'El paciente ' + d.idPaciente + ' no existe. Pide a recepción que lo dé de alta.' };
    }
    if (paciente.Estatus === 'Suspendido') {
      return { ok: false, error: 'El paciente está suspendido. No se le pueden programar nuevas cirugías.' };
    }
  } else {
    // Sin ID: paciente texto libre. Solo se exige que venga el nombre.
    if (!d.nombrePaciente || !String(d.nombrePaciente).trim()) {
      return { ok: false, error: 'Captura al menos el nombre del paciente.' };
    }
  }

  // ===== Validación de conflicto de horario =====
  if (d.idQuirofano && d.fechaProgramada && d.horaProgramada && d.tqxHoras) {
    var conflicto = validarConflictoHorario(d.idQuirofano, d.fechaProgramada, d.horaProgramada, d.tqxHoras, null);
    if (conflicto.hayConflicto) {
      return {
        ok: false,
        error: 'Conflicto de horario en ' + (d.numeroQuirofano || d.idQuirofano) +
               ': ya existe la cirugía ' + conflicto.cirugiaConflicto.folio +
               ' (' + conflicto.cirugiaConflicto.paciente + ') de ' +
               conflicto.cirugiaConflicto.horaInicio + ' a ' + conflicto.cirugiaConflicto.horaFin
      };
    }
  }

  var sh = getSheet(SHEETS.CIRUGIAS);
  var folio = nextFolio('CIRUGIA');
  var fechaStr = String(d.fechaProgramada || '').substring(0, 10);
  var horaStr = String(d.horaProgramada || '').substring(0, 5);
  var tqx = parseFloat(d.tqxHoras) || 0;
  var horaFinStr = tqx > 0 ? sumarHoras(horaStr, tqx) : '';

  // Medicamentos estructurados
  var medsArr = Array.isArray(d.medicamentosSolicitados) ? d.medicamentosSolicitados : [];
  var medsJson = JSON.stringify(medsArr);
  var medsResumen = medsArr.map(function(m){
    return m.nombreMedicamento + ' x' + m.cantidad + ' ' + (m.unidad || '');
  }).join('; ');

  sh.appendRow([
    folio,
    fechaStr,
    "'" + horaStr,
    d.idPaciente,
    d.nombrePaciente,
    d.idMedico,
    d.nombreMedico,
    d.idCirugiaTipo,
    d.tipoCirugia,
    'PROGRAMADA',
    medsResumen + (medsJson !== '[]' ? '  ||JSON||' + medsJson : ''),
    '',  // Folio_Receta_Asociada
    '',  // Fecha_Realizacion
    d.observaciones || '',
    d.capturadoPor,
    nowTs(),
    // Columnas nuevas v5
    d.idQuirofano || '',
    d.numeroQuirofano || '',
    d.edadPaciente || '',
    d.idAyudante || '',
    d.nombreAyudante || '',
    d.idAnestesiologo || '',
    d.nombreAnestesiologo || '',
    tqx,
    "'" + horaFinStr,
    d.materialEspecial || '',
    d.claveCPT || ''  // Clave CPT del catálogo
  ]);

  // REACTIVACIÓN AUTOMÁTICA: si el paciente había cerrado ciclo ('Atendido'),
  // programarle una cirugía lo regresa a 'Activo'.
  // (Solo aplica si la cirugía se programó con un paciente del catálogo.)
  if (paciente && String(paciente.Estatus) === 'Atendido') {
    try { marcarEstatusPaciente(d.idPaciente, 'Activo'); } catch (e) {}
  }

  // ===== Crear el BOM de la cirugía (estado SOLICITADO; alerta a almacén) =====
  // No bloquea la programación si algo falla en el armado del BOM.
  var bomInfo = null;
  try {
    bomInfo = crearBOMParaCirugia(folio, paquetesBOM, comentarioBOM, d.capturadoPor);
  } catch (eBom) {
    bomInfo = { ok: false, error: String(eBom) };
  }

  return { ok: true, folio: folio, bom: bomInfo };
}

/**
 * Suma horas decimales a una hora en formato HH:MM y devuelve HH:MM.
 * Ej: sumarHoras('08:00', 5) → '13:00'
 *     sumarHoras('08:00', 1.5) → '09:30'
 */
function sumarHoras(horaInicio, tqxHoras) {
  if (!horaInicio || !tqxHoras) return '';
  var partes = String(horaInicio).split(':');
  var h = parseInt(partes[0], 10) || 0;
  var m = parseInt(partes[1], 10) || 0;
  var totalMin = h * 60 + m + Math.round(parseFloat(tqxHoras) * 60);
  var nuevaH = Math.floor(totalMin / 60) % 24;
  var nuevaM = totalMin % 60;
  return String(nuevaH).padStart(2, '0') + ':' + String(nuevaM).padStart(2, '0');
}

/**
 * Devuelve { hayConflicto: bool, cirugiaConflicto?: {folio, paciente, horaInicio, horaFin} }
 * El parámetro folioExcluir permite ignorar una cirugía específica (útil al editar).
 */
function validarConflictoHorario(idQuirofano, fecha, horaInicio, tqxHoras, folioExcluir) {
  if (!idQuirofano || !fecha || !horaInicio || !tqxHoras) {
    return { ok: true, hayConflicto: false, error: 'Parámetros incompletos' };
  }
  var tz = getConfig('ZonaHoraria') || 'America/Chihuahua';

  function dStr(d) {
    if (!d) return '';
    if (d instanceof Date) return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    return String(d).substring(0, 10);
  }

  function toMin(hhmm) {
    var p = String(hhmm).replace(/^'/, '').split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  var inicioNueva = toMin(horaInicio);
  var finNueva = inicioNueva + Math.round(parseFloat(tqxHoras) * 60);

  var rows = sheetToObjects(SHEETS.CIRUGIAS).filter(function(r){
    return dStr(r.Fecha_Programada) === fecha
        && r.ID_Quirofano === idQuirofano
        && r.Estado !== 'CANCELADA'
        && (!folioExcluir || r.Folio_Cirugia !== folioExcluir);
  });

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var horaIni = String(r.Hora_Programada || '').replace(/^'/, '').substring(0, 5);
    var tqx = parseFloat(r.TQX_Horas) || 0;
    if (!horaIni || !tqx) continue;
    var inicioExist = toMin(horaIni);
    var finExist = inicioExist + Math.round(tqx * 60);

    // Hay traslape si los rangos se intersectan
    if (inicioNueva < finExist && finNueva > inicioExist) {
      var horaFinExist = sumarHoras(horaIni, tqx);
      return {
        ok: true,
        hayConflicto: true,
        cirugiaConflicto: {
          folio: r.Folio_Cirugia,
          paciente: r.Nombre_Paciente,
          horaInicio: horaIni,
          horaFin: horaFinExist,
          medico: r.Nombre_Medico
        }
      };
    }
  }
  return { ok: true, hayConflicto: false };
}

/**
 * Devuelve la programación de un día dado, organizada por quirófano.
 * Útil para el tablero diario.
 */
function getProgramacionDia(fecha) {
  if (!fecha) fecha = todayStr();
  var tz = getConfig('ZonaHoraria') || 'America/Chihuahua';

  function dStr(d) {
    if (!d) return '';
    if (d instanceof Date) return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    return String(d).substring(0, 10);
  }

  var quirofanos = sheetToObjects(SHEETS.QUIROFANOS).filter(function(q){return esActivo(q.Activo);});
  var cirugias = sheetToObjects(SHEETS.CIRUGIAS).filter(function(r){
    return dStr(r.Fecha_Programada) === fecha && r.Estado !== 'CANCELADA';
  });

  // Normalizar
  cirugias = cirugias.map(function(r){
    var hi = String(r.Hora_Programada || '').replace(/^'/, '').substring(0, 5);
    var hf = String(r.Hora_Fin_Calculada || '').replace(/^'/, '').substring(0, 5);
    return {
      folio: r.Folio_Cirugia,
      idQuirofano: r.ID_Quirofano,
      numeroQuirofano: r.Numero_Quirofano,
      horaInicio: hi,
      horaFin: hf,
      tqxHoras: r.TQX_Horas,
      paciente: r.Nombre_Paciente,
      edad: r.Edad_Paciente,
      tipoCirugia: r.Tipo_Cirugia,
      medico: r.Nombre_Medico,
      ayudante: r.Nombre_Ayudante,
      anestesiologo: r.Nombre_Anestesiologo,
      materialEspecial: r.Material_Especial,
      estado: r.Estado,
      folioReceta: r.Folio_Receta_Asociada
    };
  });

  // Agrupar por quirófano
  var porQuirofano = {};
  quirofanos.forEach(function(q){
    porQuirofano[q.ID_Quirofano] = {
      id: q.ID_Quirofano,
      numero: q.Numero,
      caracteristicas: q.Caracteristicas || '',
      cirugias: []
    };
  });

  cirugias.forEach(function(c){
    if (porQuirofano[c.idQuirofano]) {
      porQuirofano[c.idQuirofano].cirugias.push(c);
    } else if (c.idQuirofano) {
      // Quirófano que ya no está activo, agregarlo igual
      porQuirofano[c.idQuirofano] = {
        id: c.idQuirofano,
        numero: c.numeroQuirofano || c.idQuirofano,
        caracteristicas: '(inactivo)',
        cirugias: [c]
      };
    }
  });

  // Ordenar cirugías por hora dentro de cada quirófano
  Object.keys(porQuirofano).forEach(function(k){
    porQuirofano[k].cirugias.sort(function(a, b){
      return (a.horaInicio || '').localeCompare(b.horaInicio || '');
    });
  });

  return {
    ok: true,
    fecha: fecha,
    quirofanos: Object.values(porQuirofano)
  };
}

/**
 * Devuelve resumen de cirugías por día para un mes (vista calendario).
 */
function getProgramacionMes(anio, mes) {
  anio = parseInt(anio, 10);
  mes = parseInt(mes, 10);
  if (!anio || !mes) {
    var hoy = new Date();
    anio = hoy.getFullYear();
    mes = hoy.getMonth() + 1;
  }
  var tz = getConfig('ZonaHoraria') || 'America/Chihuahua';

  function dStr(d) {
    if (!d) return '';
    if (d instanceof Date) return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    return String(d).substring(0, 10);
  }

  var prefijo = anio + '-' + String(mes).padStart(2, '0');
  var cirugias = sheetToObjects(SHEETS.CIRUGIAS).filter(function(r){
    return dStr(r.Fecha_Programada).indexOf(prefijo) === 0 && r.Estado !== 'CANCELADA';
  });

  // Agrupar por fecha
  var porDia = {};
  cirugias.forEach(function(r){
    var f = dStr(r.Fecha_Programada);
    if (!porDia[f]) porDia[f] = [];
    porDia[f].push({
      folio: r.Folio_Cirugia,
      idQuirofano: r.ID_Quirofano,
      numeroQuirofano: r.Numero_Quirofano,
      horaInicio: String(r.Hora_Programada || '').replace(/^'/, '').substring(0, 5),
      paciente: r.Nombre_Paciente,
      tipoCirugia: r.Tipo_Cirugia,
      medico: r.Nombre_Medico,
      estado: r.Estado
    });
  });

  return { ok: true, anio: anio, mes: mes, dias: porDia };
}

function altaQuirofano(d) {
  var sh = getSheet(SHEETS.QUIROFANOS);
  var data = sh.getDataRange().getValues();
  var maxNum = 0;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).indexOf('Q') === 0) {
      var n = parseInt(String(data[i][0]).replace('Q', ''), 10);
      if (!isNaN(n)) maxNum = Math.max(maxNum, n);
    }
  }
  var id = 'Q' + (maxNum + 1);
  sh.appendRow([id, d.numero || (maxNum + 1), d.caracteristicas || '', 'SI']);
  return { ok: true, idQuirofano: id };
}

function actualizarCirugia(d) {
  var sh = getSheet(SHEETS.CIRUGIAS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === d.folio) {
      if (d.estado) sh.getRange(i+1, 10).setValue(d.estado);
      if (d.folioReceta) sh.getRange(i+1, 12).setValue(d.folioReceta);
      if (d.fechaRealizacion) sh.getRange(i+1, 13).setValue(d.fechaRealizacion);
      if (d.observaciones !== undefined) sh.getRange(i+1, 14).setValue(d.observaciones);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Cirugía no encontrada: ' + d.folio };
}

// ============================================================
// RECETAS
// ============================================================

function getRecetas(estado) {
  var rows = sheetToObjects(SHEETS.RECETAS);
  if (estado) rows = rows.filter(function(r){ return r.Estado === estado; });
  return { ok: true, data: rows };
}

/**
 * Vincula una receta FÍSICA (emitida a mano por el responsable sanitario)
 * con una cirugía. El folio NO se genera automáticamente — lo captura el
 * usuario tomándolo del recetario físico oficial COFEPRIS.
 */
function emitirReceta(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'vincular_receta')) {
    return errorSinPermiso(d.rolUsuario, 'vincular_receta');
  }
  if (!d.folioReceta) {
    return { ok: false, error: 'Folio de receta física es obligatorio' };
  }
  // Validar que el folio físico no esté duplicado
  var sh = getSheet(SHEETS.RECETAS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(d.folioReceta).trim()) {
      return { ok: false, error: 'El folio físico ' + d.folioReceta + ' ya está registrado en el sistema' };
    }
  }
  sh.appendRow([
    d.folioReceta,                   // folio FÍSICO capturado por el usuario
    d.fechaEmision || todayStr(),
    d.folioCirugia,
    d.idPaciente,
    d.nombrePaciente,
    d.idMedico,
    d.nombreMedico,
    d.cedulaMedico,
    d.idMedicamento,
    d.nombreMedicamento,
    d.cantidadSolicitada,
    d.unidad,
    d.diagnostico || '',
    'VINCULADA',
    d.capturadoPor,
    nowTs()
  ]);
  // Vincular receta con cirugía
  if (d.folioCirugia) {
    actualizarCirugia({
      folio: d.folioCirugia,
      estado: 'RECETA_VINCULADA',
      folioReceta: d.folioReceta
    });
  }
  return { ok: true, folio: d.folioReceta };
}

// ============================================================
// CONSUMOS — alimenta LibroCOFEPRIS e Inventario_Mov automáticamente
// ============================================================

function getConsumos(desde, hasta) {
  var rows = sheetToObjects(SHEETS.CONSUMOS);
  if (desde) rows = rows.filter(function(r){ return r.Fecha_Consumo >= desde; });
  if (hasta) rows = rows.filter(function(r){ return r.Fecha_Consumo <= hasta; });
  return { ok: true, data: rows };
}

function getConsumosPorCirugia(folioCirugia) {
  if (!folioCirugia) return { ok: false, error: 'Folio de cirugía requerido' };
  var rows = sheetToObjects(SHEETS.CONSUMOS).filter(function(r){
    return r.Folio_Cirugia === folioCirugia;
  });
  return { ok: true, data: rows };
}

/**
 * Registra UNO o VARIOS consumos de medicamentos para una cirugía.
 *
 * NUEVO MODELO: cada consumo se descuenta de una CAJA/LOTE específica que el
 * usuario (ALMACEN / JEFE_ENFERMERIA / ENFERMERIA) eligió manualmente.
 *
 * Acepta:
 *   data.medicamentos = [{idLote, idMedicamento, nombreMedicamento,
 *                         cantidadConsumida, unidad}, ...]
 *   (formato legacy de un solo medicamento también soportado si trae idLote)
 *
 * Cada consumo genera: 1 fila en Consumos + 1 asiento en LibroCOFEPRIS +
 * 1 movimiento SALIDA en Inventario_Mov, y descuenta la caja correspondiente.
 */
function registrarConsumo(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'registrar_consumo')) {
    return errorSinPermiso(d.rolUsuario, 'registrar_consumo');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // Normalizar a array
    var meds = Array.isArray(d.medicamentos) ? d.medicamentos : [{
      idLote: d.idLote,
      idMedicamento: d.idMedicamento,
      nombreMedicamento: d.nombreMedicamento,
      cantidadConsumida: d.cantidadConsumida,
      unidad: d.unidad
    }];

    if (!meds.length || !meds[0].idMedicamento) {
      return { ok: false, error: 'No hay medicamentos a registrar' };
    }
    // Validar que TODOS traigan caja seleccionada antes de escribir nada
    for (var v = 0; v < meds.length; v++) {
      if (!meds[v].idLote) {
        return { ok: false, error: 'Debes seleccionar la caja/lote para: ' + (meds[v].nombreMedicamento || meds[v].idMedicamento) };
      }
    }

    // Asegurar que las columnas nuevas/lazy existan antes de escribir por nombre
    ensureHeaders_(SHEETS.CONSUMOS, ['Estado', 'ID_Lote', 'Lote_Fabricante']);

    // Catálogos de apoyo (cargados una vez)
    var medsCat = sheetToObjects(SHEETS.MEDICAMENTOS);
    var medicosCat = sheetToObjects(SHEETS.MEDICOS);
    var cedula = '';
    for (var j = 0; j < medicosCat.length; j++) {
      if (medicosCat[j].ID_Medico === d.idMedico) {
        cedula = medicosCat[j].Cedula_Profesional;
        break;
      }
    }

    var shInvMov = getSheet(SHEETS.INV_MOV);

    // Calcular siguiente número de asiento del libro (una sola vez)
    var shLibro = getSheet(SHEETS.LIBRO);
    var libroData = shLibro.getDataRange().getValues();
    var ultimoAsiento = 0;
    for (var k = 4; k < libroData.length; k++) {
      if (libroData[k][0] && !isNaN(libroData[k][0])) {
        ultimoAsiento = Math.max(ultimoAsiento, parseInt(libroData[k][0], 10));
      }
    }

    var idsCreados = [];
    var saldosFinales = {};
    var saldosLote = {};

    for (var i = 0; i < meds.length; i++) {
      var m = meds[i];
      var cantidad = parseFloat(m.cantidadConsumida);
      if (!cantidad || cantidad <= 0) {
        return { ok: false, error: 'Cantidad inválida para ' + (m.nombreMedicamento || m.idMedicamento) };
      }

      // 0. Descontar de la caja seleccionada (valida estado y saldo)
      var desc = descontarLote_(m.idLote, cantidad);
      if (!desc.ok) return desc; // aborta sin dejar registros a medias

      var idConsumo = 'CONS-' + new Date().getTime() + '-' + i;
      var saldoAntes = calcularSaldo(m.idMedicamento);   // existencia GLOBAL (COFEPRIS)
      var saldoDespues = saldoAntes - cantidad;

      // Buscar fracción
      var fraccion = '';
      for (var f = 0; f < medsCat.length; f++) {
        if (medsCat[f].ID_Medicamento === m.idMedicamento) {
          fraccion = medsCat[f].Fraccion_LGS;
          break;
        }
      }

      var fechaC = d.fechaConsumo || todayStr();
      var horaC = d.horaConsumo || Utilities.formatDate(new Date(), getConfig('ZonaHoraria') || 'America/Chihuahua', 'HH:mm');

      // 1. Insertar en Consumos (por nombre de encabezado → inmune al orden)
      appendRowByHeader(SHEETS.CONSUMOS, {
        'ID_Consumo': idConsumo,
        'Fecha_Consumo': fechaC,
        'Hora_Consumo': "'" + horaC,
        'Folio_Cirugia': d.folioCirugia,
        'Folio_Receta': d.folioReceta || desc.loteFabricante || '',
        'ID_Paciente': d.idPaciente,
        'Nombre_Paciente': d.nombrePaciente,
        'ID_Medicamento': m.idMedicamento,
        'Nombre_Medicamento': m.nombreMedicamento,
        'Cantidad_Consumida': cantidad,
        'Unidad': m.unidad,
        'ID_Medico': d.idMedico,
        'Nombre_Medico': d.nombreMedico,
        'Administrado_Por': d.administradoPor,
        'Observaciones': d.observaciones || '',
        'Capturado_Por': d.capturadoPor,
        'Timestamp_Captura': nowTs(),
        'Estado': 'ACTIVO',
        'ID_Lote': m.idLote,
        'Lote_Fabricante': desc.loteFabricante || ''
      });

      // 2. Asiento en LibroCOFEPRIS (existencia anterior/posterior = GLOBAL)
      ultimoAsiento++;
      appendLibroRow_({
        'No_Asiento': ultimoAsiento,
        'Fecha': fechaC,
        'Folio_Receta': d.folioReceta || '',
        'ID_Medicamento': m.idMedicamento,
        'Nombre_Medicamento': m.nombreMedicamento,
        'Fraccion_LGS': fraccion,
        'Nombre_Paciente': d.nombrePaciente,
        'Nombre_Medico': d.nombreMedico,
        'Cedula_Medico': cedula,
        'Cantidad_Salida': cantidad,
        'Existencia_Anterior': saldoAntes,
        'Existencia_Posterior': saldoDespues,
        'Folio_Cirugia': d.folioCirugia,
        'Observaciones': d.observaciones || '',
        'Estado': 'ACTIVO',
        'Ref_Consumo': idConsumo,
        'ID_Lote': m.idLote,
        'Lote_Fabricante': desc.loteFabricante || ''
      });

      // 3. Movimiento de inventario SALIDA (ID_Lote al final, columna nueva)
      shInvMov.appendRow([
        'MOV-' + new Date().getTime() + '-' + i,
        fechaC,
        'SALIDA',
        m.idMedicamento,
        m.nombreMedicamento,
        cantidad,
        m.unidad,
        'Consumo cirugía ' + d.folioCirugia + ' (' + idConsumo + ')',
        desc.loteFabricante || '',
        '',
        d.folioReceta,
        d.capturadoPor,
        nowTs(),
        'Consumo registrado vía sistema',
        m.idLote
      ]);

      idsCreados.push(idConsumo);
      saldosFinales[m.idMedicamento] = saldoDespues;
      saldosLote[m.idLote] = desc.saldoLote;
    }

    // Actualizar estado de la cirugía a REALIZADA
    if (d.folioCirugia) {
      actualizarCirugia({
        folio: d.folioCirugia,
        estado: 'REALIZADA',
        fechaRealizacion: d.fechaConsumo || todayStr()
      });
    }

    return {
      ok: true,
      consumosCreados: idsCreados,
      saldosFinales: saldosFinales,
      saldosLote: saldosLote,
      cantidad: idsCreados.length
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cancela un consumo previamente registrado.
 * - Marca el registro de Consumos como CANCELADO con motivo.
 * - Marca el asiento del LibroCOFEPRIS como CANCELADO (NO se borra — audit trail).
 * - Genera un AJUSTE positivo en Inventario_Mov para revertir el saldo.
 */
function cancelarConsumo(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'cancelar_consumo')) {
    return errorSinPermiso(d.rolUsuario, 'cancelar_consumo');
  }
  if (!d.idConsumo) return { ok: false, error: 'idConsumo requerido' };
  if (!d.motivo || !d.motivo.trim()) return { ok: false, error: 'Motivo de cancelación obligatorio' };
  if (!d.canceladoPor) return { ok: false, error: 'Usuario que cancela requerido' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // 1. Buscar el consumo
    var shConsumos = getSheet(SHEETS.CONSUMOS);
    var datosConsumos = shConsumos.getDataRange().getValues();
    var headerC = datosConsumos[0];
    var colEstado = headerC.indexOf('Estado');
    if (colEstado === -1) {
      // Si la columna Estado no existe (Sheet viejo), la agregamos
      shConsumos.getRange(1, headerC.length + 1).setValue('Estado');
      shConsumos.getRange(1, headerC.length + 2).setValue('Motivo_Cancelacion');
      shConsumos.getRange(1, headerC.length + 3).setValue('Cancelado_Por');
      shConsumos.getRange(1, headerC.length + 4).setValue('Fecha_Cancelacion');
      colEstado = headerC.length;
      datosConsumos = shConsumos.getDataRange().getValues();
    }

    var consumoFila = -1;
    var consumoData = null;
    for (var i = 1; i < datosConsumos.length; i++) {
      if (datosConsumos[i][0] === d.idConsumo) {
        consumoFila = i + 1;
        consumoData = datosConsumos[i];
        break;
      }
    }
    if (consumoFila === -1) return { ok: false, error: 'Consumo no encontrado: ' + d.idConsumo };

    // Validar que no esté ya cancelado
    var estadoActual = consumoData[colEstado];
    if (estadoActual === 'CANCELADO') return { ok: false, error: 'Este consumo ya estaba cancelado' };

    // Extraer datos del consumo para revertir
    var idMedicamento = consumoData[7];
    var nombreMedicamento = consumoData[8];
    var cantidad = parseFloat(consumoData[9]);
    var unidad = consumoData[10];
    var folioCirugia = consumoData[3];
    var folioReceta = consumoData[4];
    // ID_Lote por nombre de encabezado (columna nueva, posición variable)
    var colLote = headerC.indexOf('ID_Lote');
    var idLoteConsumo = colLote !== -1 ? consumoData[colLote] : '';

    // 2. Marcar consumo como CANCELADO (las columnas extra: Estado, Motivo, CanceladoPor, FechaCanc)
    shConsumos.getRange(consumoFila, colEstado + 1).setValue('CANCELADO');
    shConsumos.getRange(consumoFila, colEstado + 2).setValue(d.motivo);
    shConsumos.getRange(consumoFila, colEstado + 3).setValue(d.canceladoPor);
    shConsumos.getRange(consumoFila, colEstado + 4).setValue(nowTs());

    // 3. Marcar el asiento correspondiente en LibroCOFEPRIS como CANCELADO
    var shLibro = getSheet(SHEETS.LIBRO);
    var libroData = shLibro.getDataRange().getValues();
    // Headers del libro están en fila 4 (índice 3)
    var libroHeader = libroData[3];
    var colEstadoLibro = libroHeader.indexOf('Estado');
    var colRefConsumo = libroHeader.indexOf('Ref_Consumo');

    // Si no existen, agregarlas
    if (colEstadoLibro === -1) {
      shLibro.getRange(4, libroHeader.length + 1).setValue('Estado');
      shLibro.getRange(4, libroHeader.length + 2).setValue('Ref_Consumo');
      colEstadoLibro = libroHeader.length;
      colRefConsumo = libroHeader.length + 1;
      libroData = shLibro.getDataRange().getValues();
    }

    // Encontrar y marcar el asiento (busca por Ref_Consumo, o si no existe, por Folio_Cirugia + cantidad + medicamento)
    for (var j = 4; j < libroData.length; j++) {
      var refConsumo = libroData[j][colRefConsumo];
      var matchByRef = refConsumo === d.idConsumo;
      var matchByContent = !refConsumo && libroData[j][12] === folioCirugia && libroData[j][3] === idMedicamento && parseFloat(libroData[j][9]) === cantidad && libroData[j][colEstadoLibro] !== 'CANCELADO';
      if (matchByRef || matchByContent) {
        shLibro.getRange(j + 1, colEstadoLibro + 1).setValue('CANCELADO');
        // Agregar nota en observaciones del asiento
        var obsActual = libroData[j][13] || '';
        shLibro.getRange(j + 1, 14).setValue((obsActual ? obsActual + ' | ' : '') + 'CANCELADO ' + nowTs() + ' por ' + d.canceladoPor + ': ' + d.motivo);
        break;
      }
    }

    // 4. Crear AJUSTE positivo en Inventario_Mov para revertir el saldo
    getSheet(SHEETS.INV_MOV).appendRow([
      'MOV-' + new Date().getTime(),
      todayStr(),
      'AJUSTE',
      idMedicamento,
      nombreMedicamento,
      cantidad,  // positivo: reversión
      unidad,
      'Reversión por cancelación de ' + d.idConsumo,
      '',
      '',
      folioReceta,
      d.canceladoPor,
      nowTs(),
      'Cancelación de consumo. Motivo: ' + d.motivo
    ]);

    // 5. Revertir la caja/lote (devolver unidades; reabrir si estaba AGOTADA)
    var saldoLoteNuevo = null;
    if (idLoteConsumo) {
      var rev = revertirLote_(idLoteConsumo, cantidad);
      if (rev.ok) saldoLoteNuevo = rev.saldoLote;
    }

    return { ok: true, idConsumoCancelado: d.idConsumo, saldoNuevo: calcularSaldo(idMedicamento), idLote: idLoteConsumo, saldoLote: saldoLoteNuevo };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// INVENTARIO
// ============================================================

/**
 * Saldo de un artículo. Si se pasa `ubicacion`, devuelve el saldo SOLO de
 * ese almacén; si no, el saldo global (suma de todas las ubicaciones).
 * Los movimientos antiguos sin Ubicacion se consideran del Almacén General.
 */
function calcularSaldo(idMedicamento, ubicacion) {
  var movs = sheetToObjects(SHEETS.INV_MOV);
  var saldo = 0;
  for (var i = 0; i < movs.length; i++) {
    var m = movs[i];
    if (m.ID_Medicamento !== idMedicamento) continue;
    if (ubicacion) {
      var u = m.Ubicacion || UBICACION_DEFAULT;
      if (u !== ubicacion) continue;
    }
    var qty = parseFloat(m.Cantidad) || 0;
    if (m.Tipo === 'ENTRADA') saldo += qty;
    else if (m.Tipo === 'SALIDA') saldo -= qty;
    else if (m.Tipo === 'AJUSTE') saldo += qty; // los ajustes pueden ser positivos o negativos
  }
  return saldo;
}

// ============================================================
// UBICACIONES / ALMACENES (multi-almacén)
// ------------------------------------------------------------
// El stock pasa a ser por (artículo, ubicación). Cada movimiento de
// Inventario_Mov y cada caja/lote guardan su Ubicacion. Los datos previos
// (sin Ubicacion) se asumen en el Almacén General.
// ============================================================
var UBICACIONES_HEADERS = ['ID_Ubicacion', 'Nombre', 'Tipo', 'Activo', 'Orden'];
var UBICACION_DEFAULT = 'ALM_GENERAL';
var UBICACIONES_SEED = [
  ['ALM_GENERAL', 'Almacén General', 'ALMACEN', 'SI', 1],
  ['CEYE', 'CEyE', 'ALMACEN', 'SI', 2],
  ['PISO', 'Piso', 'PISO', 'SI', 3],
  ['CARRO_1', 'Carro Rojo 1', 'CARRO', 'SI', 4],
  ['CARRO_2', 'Carro Rojo 2', 'CARRO', 'SI', 5],
  ['CARRO_3', 'Carro Rojo 3', 'CARRO', 'SI', 6],
  ['CARRO_4', 'Carro Rojo 4', 'CARRO', 'SI', 7]
];

/** Crea la hoja de ubicaciones y la siembra con los 7 almacenes si está vacía. */
function ensureUbicacionesSheet_() {
  var sh = ensureSheetConHeaders_(SHEETS.UBICACIONES, UBICACIONES_HEADERS);
  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, UBICACIONES_SEED.length, UBICACIONES_HEADERS.length).setValues(UBICACIONES_SEED);
  }
  // Asegurar columna Ubicacion en las hojas de stock
  ensureHeaders_(SHEETS.INV_MOV, ['Ubicacion']);
  ensureHeaders_(SHEETS.LOTES, ['Ubicacion']);
  return sh;
}

function getUbicaciones() {
  ensureUbicacionesSheet_();
  var data = sheetToObjects(SHEETS.UBICACIONES)
    .filter(function(u){ return esActivo(u.Activo); })
    .map(function(u){ return { idUbicacion: u.ID_Ubicacion, nombre: u.Nombre, tipo: u.Tipo, orden: parseFloat(u.Orden) || 99 }; });
  data.sort(function(a, b){ return a.orden - b.orden; });
  return { ok: true, data: data };
}

/**
 * Agrega un movimiento a Inventario_Mov (positional) y fija su Ubicacion
 * por nombre de encabezado, de forma robusta al número/orden de columnas.
 */
function appendInvMov_(valores, ubicacion) {
  var sh = getSheet(SHEETS.INV_MOV);
  sh.appendRow(valores);
  var fila = sh.getLastRow();
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var c = headers.indexOf('Ubicacion');
  if (c === -1) {
    c = sh.getLastColumn();
    sh.getRange(1, c + 1).setValue('Ubicacion');
  }
  sh.getRange(fila, c + 1).setValue(ubicacion || UBICACION_DEFAULT);
  return fila;
}

function getInventario() {
  var meds = sheetToObjects(SHEETS.MEDICAMENTOS).filter(function(m){return esActivo(m.Activo);});
  var resultado = meds.map(function(m){
    var saldo = calcularSaldo(m.ID_Medicamento);
    var minimo = parseFloat(m.Stock_Minimo) || 0;
    return {
      idMedicamento: m.ID_Medicamento,
      nombre: m.Nombre_Comercial,
      sustancia: m.Sustancia_Activa,
      fraccion: m.Fraccion_LGS,
      unidad: m.Unidad,
      saldo: saldo,
      minimo: minimo,
      alerta: saldo <= minimo
    };
  });
  return { ok: true, data: resultado };
}

/**
 * Registra la ENTRADA de una caja cerrada de medicamento controlado.
 *
 * En el nuevo modelo, CADA entrada = UNA caja/lote que se da de alta en la
 * pestaña `Lotes` (con su receta de respaldo, lote del fabricante y caducidad).
 * El consumo posterior se descuenta de cajas específicas hasta agotarlas.
 *
 * Requeridos: idMedicamento, nombreMedicamento, cantidad (unidades en la caja),
 *             unidad, folioReceta (receta física que respalda la caja).
 * Opcionales: loteFabricante, fechaCaducidad, proveedor, referencia, observaciones.
 */
function registrarEntrada(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'nueva_entrada')) {
    return errorSinPermiso(d.rolUsuario, 'nueva_entrada');
  }
  if (!d.idMedicamento) return { ok: false, error: 'Medicamento requerido' };
  var cantidad = parseFloat(d.cantidad);
  if (!cantidad || cantidad <= 0) return { ok: false, error: 'La cantidad (unidades en la caja) debe ser mayor a 0' };
  if (!d.folioReceta || !String(d.folioReceta).trim()) {
    return { ok: false, error: 'El folio de receta que respalda la caja es obligatorio' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var idLote = 'LOTE-' + new Date().getTime();
    var fechaEntrada = d.fecha || todayStr();

    // 1. Crear la caja/lote en la pestaña Lotes (escritura por nombre de encabezado)
    appendRowByHeader(SHEETS.LOTES, {
      'ID_Lote': idLote,
      'ID_Medicamento': d.idMedicamento,
      'Nombre_Medicamento': d.nombreMedicamento || '',
      'Folio_Receta': String(d.folioReceta).trim(),
      'Lote_Fabricante': d.loteFabricante || d.lote || '',
      'Fecha_Caducidad': d.fechaCaducidad || '',
      'Cantidad_Inicial': cantidad,
      'Unidad': d.unidad || '',
      'Cantidad_Consumida': 0,
      'Saldo': cantidad,
      'Estado': 'ABIERTA',
      'Proveedor': d.proveedor || '',
      'Referencia': d.referencia || '',
      'Fecha_Entrada': fechaEntrada,
      'Capturado_Por': d.capturadoPor || '',
      'Timestamp_Captura': nowTs()
    });

    // 2. Movimiento de inventario ENTRADA, ligado a la caja (ID_Lote al final)
    getSheet(SHEETS.INV_MOV).appendRow([
      'MOV-' + new Date().getTime(),
      fechaEntrada,
      'ENTRADA',
      d.idMedicamento,
      d.nombreMedicamento,
      cantidad,
      d.unidad || '',
      d.referencia || '',
      d.loteFabricante || d.lote || '',
      d.fechaCaducidad || '',
      d.proveedor || '',
      d.capturadoPor,
      nowTs(),
      d.observaciones || '',
      idLote   // columna nueva: ID_Lote
    ]);

    return {
      ok: true,
      idLote: idLote,
      saldoNuevo: calcularSaldo(d.idMedicamento),
      saldoLote: cantidad
    };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// LOTES (CAJAS CERRADAS) — control por caja y trazabilidad por cirugía
// ============================================================

/**
 * Lista cajas/lotes. Por defecto solo las que tienen saldo > 0 (ABIERTAS),
 * que son de las que se puede descontar un consumo.
 * @param {string} estado - opcional: 'ABIERTA','AGOTADA','CADUCADA','CANCELADA','TODAS'
 * @param {string} idMedicamento - opcional: filtra por medicamento
 */
function getLotes(estado, idMedicamento) {
  var rows = sheetToObjects(SHEETS.LOTES);
  var hoy = todayStr();

  var data = rows.map(function(l){
    var inicial = parseFloat(l.Cantidad_Inicial) || 0;
    var consumida = parseFloat(l.Cantidad_Consumida) || 0;
    var saldo = (l.Saldo === '' || l.Saldo == null) ? (inicial - consumida) : parseFloat(l.Saldo);
    var caduca = dateOnly(l.Fecha_Caducidad);
    return {
      idLote: l.ID_Lote,
      idMedicamento: l.ID_Medicamento,
      nombreMedicamento: l.Nombre_Medicamento,
      folioReceta: l.Folio_Receta,
      loteFabricante: l.Lote_Fabricante,
      fechaCaducidad: caduca,
      cantidadInicial: inicial,
      cantidadConsumida: consumida,
      saldo: saldo,
      unidad: l.Unidad,
      estado: l.Estado,
      proveedor: l.Proveedor,
      referencia: l.Referencia,
      fechaEntrada: dateOnly(l.Fecha_Entrada),
      ubicacion: l.Ubicacion || UBICACION_DEFAULT,
      caducada: caduca && caduca < hoy
    };
  });

  if (idMedicamento) {
    data = data.filter(function(l){ return l.idMedicamento === idMedicamento; });
  }

  if (!estado || estado === 'ABIERTA') {
    // Disponibles para consumo: estado ABIERTA y saldo positivo
    data = data.filter(function(l){ return l.estado === 'ABIERTA' && l.saldo > 0; });
  } else if (estado !== 'TODAS') {
    data = data.filter(function(l){ return l.estado === estado; });
  }

  // Ordenar por caducidad ascendente (primero las que caducan antes)
  data.sort(function(a, b){
    return String(a.fechaCaducidad || '9999').localeCompare(String(b.fechaCaducidad || '9999'));
  });

  return { ok: true, data: data };
}

/**
 * Devuelve TODOS los consumos (cirugías/pacientes) que se descontaron de una
 * caja específica — el vínculo lote → cirugías que pidió Clínica Estar Bien.
 */
function getConsumosPorLote(idLote) {
  if (!idLote) return { ok: false, error: 'idLote requerido' };
  var consumos = sheetToObjects(SHEETS.CONSUMOS).filter(function(c){
    return c.ID_Lote === idLote;
  });
  // Info de la caja
  var lote = sheetToObjects(SHEETS.LOTES).filter(function(l){ return l.ID_Lote === idLote; })[0] || null;
  return { ok: true, lote: lote, data: consumos };
}

/**
 * Helper interno (asume que el llamador ya tiene el LockService).
 * Descuenta `cantidad` de una caja. Valida estado y saldo.
 * Devuelve {ok, ...info} o {ok:false, error}.
 */
function descontarLote_(idLote, cantidad) {
  var sh = getSheet(SHEETS.LOTES);
  var data = sh.getDataRange().getValues();
  var H = data[0];
  var cId = H.indexOf('ID_Lote');
  var cInicial = H.indexOf('Cantidad_Inicial');
  var cConsumida = H.indexOf('Cantidad_Consumida');
  var cSaldo = H.indexOf('Saldo');
  var cEstado = H.indexOf('Estado');
  var cMed = H.indexOf('ID_Medicamento');
  var cNombre = H.indexOf('Nombre_Medicamento');
  var cLoteFab = H.indexOf('Lote_Fabricante');
  var cUnidad = H.indexOf('Unidad');

  for (var i = 1; i < data.length; i++) {
    if (data[i][cId] === idLote) {
      var estado = data[i][cEstado];
      if (estado !== 'ABIERTA') {
        return { ok: false, error: 'La caja ' + idLote + ' no está abierta (estado: ' + estado + ')' };
      }
      var inicial = parseFloat(data[i][cInicial]) || 0;
      var consumida = parseFloat(data[i][cConsumida]) || 0;
      var saldoActual = (cSaldo !== -1 && data[i][cSaldo] !== '') ? parseFloat(data[i][cSaldo]) : (inicial - consumida);
      if (cantidad > saldoActual) {
        return { ok: false, error: 'La caja ' + (data[i][cLoteFab] || idLote) + ' solo tiene ' + saldoActual + ' unidad(es) disponibles (pediste ' + cantidad + ')' };
      }
      var nuevaConsumida = consumida + cantidad;
      var nuevoSaldo = inicial - nuevaConsumida;
      sh.getRange(i + 1, cConsumida + 1).setValue(nuevaConsumida);
      if (cSaldo !== -1) sh.getRange(i + 1, cSaldo + 1).setValue(nuevoSaldo);
      if (nuevoSaldo <= 0) sh.getRange(i + 1, cEstado + 1).setValue('AGOTADA');
      return {
        ok: true,
        saldoLote: nuevoSaldo,
        idMedicamento: data[i][cMed],
        nombreMedicamento: data[i][cNombre],
        loteFabricante: data[i][cLoteFab],
        unidad: data[i][cUnidad]
      };
    }
  }
  return { ok: false, error: 'Caja/lote no encontrada: ' + idLote };
}

/**
 * Helper interno (asume Lock del llamador). Revierte `cantidad` a una caja
 * (al cancelar un consumo). Si estaba AGOTADA, vuelve a ABIERTA.
 */
function revertirLote_(idLote, cantidad) {
  if (!idLote) return { ok: false, error: 'sin lote' };
  var sh = getSheet(SHEETS.LOTES);
  var data = sh.getDataRange().getValues();
  var H = data[0];
  var cId = H.indexOf('ID_Lote');
  var cInicial = H.indexOf('Cantidad_Inicial');
  var cConsumida = H.indexOf('Cantidad_Consumida');
  var cSaldo = H.indexOf('Saldo');
  var cEstado = H.indexOf('Estado');

  for (var i = 1; i < data.length; i++) {
    if (data[i][cId] === idLote) {
      var inicial = parseFloat(data[i][cInicial]) || 0;
      var consumida = parseFloat(data[i][cConsumida]) || 0;
      var nuevaConsumida = Math.max(0, consumida - cantidad);
      var nuevoSaldo = inicial - nuevaConsumida;
      sh.getRange(i + 1, cConsumida + 1).setValue(nuevaConsumida);
      if (cSaldo !== -1) sh.getRange(i + 1, cSaldo + 1).setValue(nuevoSaldo);
      // Si estaba AGOTADA y ahora hay saldo, reabrir (salvo que esté CANCELADA/CADUCADA)
      var estado = data[i][cEstado];
      if (nuevoSaldo > 0 && estado === 'AGOTADA') {
        sh.getRange(i + 1, cEstado + 1).setValue('ABIERTA');
      }
      return { ok: true, saldoLote: nuevoSaldo };
    }
  }
  return { ok: false, error: 'Caja/lote no encontrada: ' + idLote };
}

/**
 * Append robusto al LibroCOFEPRIS (encabezados en la fila 4).
 * Auto-crea las columnas Estado, Ref_Consumo, ID_Lote y Lote_Fabricante si faltan.
 * Mapea por NOMBRE de encabezado, así que es inmune al orden de columnas.
 */
function appendLibroRow_(dataObj) {
  var sh = getSheet(SHEETS.LIBRO);
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(4, 1, 1, lastCol).getValues()[0];

  // Asegurar columnas necesarias
  var requeridas = ['Estado', 'Ref_Consumo', 'ID_Lote', 'Lote_Fabricante'];
  requeridas.forEach(function(col){
    if (headers.indexOf(col) === -1) {
      sh.getRange(4, headers.length + 1).setValue(col);
      headers.push(col);
    }
  });

  var row = headers.map(function(h){ return dataObj.hasOwnProperty(h) ? dataObj[h] : ''; });
  sh.appendRow(row);
}

// ============================================================
// LIBRO COFEPRIS
// ============================================================

function getLibro(desde, hasta) {
  var rows = sheetToObjects(SHEETS.LIBRO);
  if (desde) rows = rows.filter(function(r){ return r.Fecha >= desde; });
  if (hasta) rows = rows.filter(function(r){ return r.Fecha <= hasta; });
  return { ok: true, data: rows };
}

// ============================================================
// INVENTARIO GENERAL — CATÁLOGO ÚNICO DE ARTÍCULOS
// ------------------------------------------------------------
// Unifica medicamentos, medicamentos controlados, insumos y "otros"
// en una sola hoja CAT_Articulos. El control por lote/caducidad
// aplica SOLO a las categorías MEDICAMENTO y MEDICAMENTO_CONTROLADO;
// INSUMO y OTROS llevan saldo simple (entradas/salidas/ajustes en
// Inventario_Mov). El folio de receta (COFEPRIS) se exige únicamente
// a la categoría MEDICAMENTO_CONTROLADO.
//
// Diseño sin ruptura: Inventario_Mov y Lotes ya se llavean por
// ID_Medicamento; tras la migración ese ID = ID_Articulo, así que los
// saldos y lotes existentes siguen funcionando sin tocar esas hojas.
// ============================================================
var ARTICULOS_HEADERS = ['ID_Articulo','Codigo','Nombre','Categoria','Sustancia_Activa',
  'Presentacion','Concentracion','Fraccion_LGS','Unidad','Stock_Minimo','Requiere_Lote','Activo','Notas','Codigo_Barras'];

var CATEGORIAS_ARTICULO = ['INSUMO','MEDICAMENTO','MEDICAMENTO_CONTROLADO','OTROS'];

/** Normaliza una categoría capturada a una de CATEGORIAS_ARTICULO (default OTROS). */
function normCategoria_(cat) {
  var s = String(cat == null ? '' : cat).trim().toUpperCase()
    .replace(/Í/g,'I').replace(/Á/g,'A').replace(/É/g,'E').replace(/Ó/g,'O').replace(/Ú/g,'U');
  if (s.indexOf('CONTROL') !== -1) return 'MEDICAMENTO_CONTROLADO';
  if (s.indexOf('MEDICAMENT') !== -1) return 'MEDICAMENTO';
  if (s.indexOf('INSUMO') !== -1) return 'INSUMO';
  if (CATEGORIAS_ARTICULO.indexOf(s) !== -1) return s;
  return 'OTROS';
}

/** Una categoría exige control por lote + fecha de caducidad. */
function categoriaRequiereLote_(cat) {
  var c = normCategoria_(cat);
  return c === 'MEDICAMENTO' || c === 'MEDICAMENTO_CONTROLADO';
}

/** Una categoría exige folio de receta de respaldo (COFEPRIS). */
function categoriaRequiereReceta_(cat) {
  return normCategoria_(cat) === 'MEDICAMENTO_CONTROLADO';
}

/** Garantiza la hoja CAT_Articulos con sus encabezados. */
function ensureArticulosSheet_() {
  ensureSheetConHeaders_(SHEETS.ARTICULOS, ARTICULOS_HEADERS);
}

// Códigos de barras MÚLTIPLES por artículo (un proveedor puede usar otra nomenclatura).
var CODIGOS_BARRAS_HEADERS = ['ID_Codigo','ID_Articulo','Codigo_Barras','Proveedor','Activo','Capturado_Por','Timestamp_Captura'];
function ensureCodigosBarrasSheet_() {
  ensureSheetConHeaders_(SHEETS.CODIGOS_BARRAS, CODIGOS_BARRAS_HEADERS);
}

/**
 * Migración idempotente: vuelca CAT_Medicamentos (controlados) y
 * CAT_Insumos al catálogo único CAT_Articulos, conservando los IDs
 * para no romper Inventario_Mov / Lotes / BOM. Correr UNA vez desde
 * el editor de Apps Script (o expuesta como acción admin).
 * Devuelve un resumen de cuántos artículos creó/omitió.
 */
function migrarCatalogoArticulos_() {
  ensureArticulosSheet_();
  var existentes = {};
  sheetToObjects(SHEETS.ARTICULOS).forEach(function(a){
    if (a.ID_Articulo) existentes[String(a.ID_Articulo)] = true;
  });

  var creados = 0, omitidos = 0;

  // 1. Medicamentos (el catálogo actual son controlados: tienen Fraccion_LGS)
  sheetToObjects(SHEETS.MEDICAMENTOS).forEach(function(m){
    var id = m.ID_Medicamento;
    if (!id) return;
    if (existentes[String(id)]) { omitidos++; return; }
    var cat = m.Fraccion_LGS ? 'MEDICAMENTO_CONTROLADO' : 'MEDICAMENTO';
    appendRowByHeader(SHEETS.ARTICULOS, {
      'ID_Articulo': id,
      'Codigo': m.Codigo || id,
      'Nombre': m.Nombre_Comercial || '',
      'Categoria': cat,
      'Sustancia_Activa': m.Sustancia_Activa || '',
      'Presentacion': m.Presentacion || '',
      'Concentracion': m.Concentracion || '',
      'Fraccion_LGS': m.Fraccion_LGS || '',
      'Unidad': m.Unidad || '',
      'Stock_Minimo': m.Stock_Minimo || 0,
      'Requiere_Lote': 'SI',
      'Activo': m.Activo || 'SI',
      'Notas': m.Notas || ''
    });
    existentes[String(id)] = true;
    creados++;
  });

  // 2. Insumos (catálogo del BOM, llaveados por Codigo)
  sheetToObjects(SHEETS.INSUMOS).forEach(function(i){
    var id = i.Codigo;
    if (!id) return;
    if (existentes[String(id)]) { omitidos++; return; }
    var cat = normCategoria_(i.Categoria || 'INSUMO');
    appendRowByHeader(SHEETS.ARTICULOS, {
      'ID_Articulo': id,
      'Codigo': id,
      'Nombre': i.Descripcion || '',
      'Categoria': cat,
      'Sustancia_Activa': '',
      'Presentacion': '',
      'Concentracion': '',
      'Fraccion_LGS': '',
      'Unidad': i.Unidad || '',
      'Stock_Minimo': 0,
      'Requiere_Lote': categoriaRequiereLote_(cat) ? 'SI' : 'NO',
      'Activo': i.Activo || 'SI',
      'Notas': ''
    });
    existentes[String(id)] = true;
    creados++;
  });

  return { ok: true, creados: creados, omitidos: omitidos };
}

/** Acción admin para correr la migración desde el frontend. */
function migrarArticulos(d) {
  d = d || {};
  if (d.rolUsuario && d.rolUsuario !== 'ADMIN') {
    return { ok: false, error: 'Solo ADMIN puede ejecutar la migración de catálogo.' };
  }
  return migrarCatalogoArticulos_();
}

/** Busca un artículo por ID en CAT_Articulos (objeto crudo o null). */
function getArticuloRaw_(idArticulo) {
  var rows = sheetToObjects(SHEETS.ARTICULOS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].ID_Articulo) === String(idArticulo)) return rows[i];
  }
  return null;
}

/**
 * Inventario de TODOS los artículos activos con su saldo, mínimo y
 * bandera de alerta. Acepta filtro opcional por categoría y por ubicación.
 * @param {string} categoria - opcional: INSUMO|MEDICAMENTO|MEDICAMENTO_CONTROLADO|OTROS
 * @param {string} ubicacion - opcional: si se pasa, el saldo es solo de ese almacén
 */
function getInventarioGeneral(categoria, ubicacion) {
  ensureArticulosSheet_();
  ensureCodigosBarrasSheet_();
  var filtro = categoria ? normCategoria_(categoria) : null;
  var ubi = (ubicacion && String(ubicacion).trim()) ? String(ubicacion).trim() : null;
  // Conteo de códigos de barras (hoja múltiple) por artículo
  var cbCount = {};
  sheetToObjects(SHEETS.CODIGOS_BARRAS).forEach(function(c){
    if (esActivo(c.Activo)) { var k = String(c.ID_Articulo); cbCount[k] = (cbCount[k] || 0) + 1; }
  });
  var arts = sheetToObjects(SHEETS.ARTICULOS).filter(function(a){ return esActivo(a.Activo); });
  var data = arts.map(function(a){
    var cat = normCategoria_(a.Categoria);
    var saldo = calcularSaldo(a.ID_Articulo, ubi);
    var minimo = parseFloat(a.Stock_Minimo) || 0;
    var legacy = String(a.Codigo_Barras || '').trim();
    return {
      idArticulo: a.ID_Articulo,
      codigo: a.Codigo || a.ID_Articulo,
      codigoBarras: legacy,
      numCodigos: (cbCount[String(a.ID_Articulo)] || 0) + (legacy ? 1 : 0),
      nombre: a.Nombre,
      categoria: cat,
      sustancia: a.Sustancia_Activa,
      presentacion: a.Presentacion,
      concentracion: a.Concentracion,
      fraccion: a.Fraccion_LGS,
      unidad: a.Unidad,
      requiereLote: categoriaRequiereLote_(cat),
      saldo: saldo,
      minimo: minimo,
      alerta: saldo <= minimo,
      ubicacion: ubi || 'TODAS'
    };
  });
  if (filtro) data = data.filter(function(a){ return a.categoria === filtro; });
  data.sort(function(a, b){ return String(a.nombre || '').localeCompare(String(b.nombre || '')); });
  return { ok: true, data: data, ubicacion: ubi || 'TODAS' };
}

/** Catálogo de artículos (para selects del frontend). Filtro opcional por categoría. */
function getArticulos(categoria) {
  ensureArticulosSheet_();
  var filtro = categoria ? normCategoria_(categoria) : null;
  var data = sheetToObjects(SHEETS.ARTICULOS)
    .filter(function(a){ return esActivo(a.Activo); })
    .map(function(a){
      var cat = normCategoria_(a.Categoria);
      return {
        idArticulo: a.ID_Articulo,
        codigo: a.Codigo || a.ID_Articulo,
        nombre: a.Nombre,
        categoria: cat,
        unidad: a.Unidad,
        requiereLote: categoriaRequiereLote_(cat),
        stockMinimo: parseFloat(a.Stock_Minimo) || 0
      };
    });
  if (filtro) data = data.filter(function(a){ return a.categoria === filtro; });
  return { ok: true, data: data };
}

/**
 * Alta de un artículo en el catálogo único. La categoría determina si
 * requiere lote/caducidad. ID autogenerado por prefijo de categoría.
 * Requeridos: nombre, categoria, unidad.
 */
function altaArticulo(d) {
  if (!tienePermiso(d.rolUsuario, 'alta_articulo')) {
    return errorSinPermiso(d.rolUsuario, 'alta_articulo');
  }
  if (!d.nombre || !String(d.nombre).trim()) return { ok: false, error: 'El nombre del artículo es obligatorio' };
  var cat = normCategoria_(d.categoria);

  ensureArticulosSheet_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var prefijo = { 'MEDICAMENTO_CONTROLADO': 'MED', 'MEDICAMENTO': 'MED', 'INSUMO': 'INS', 'OTROS': 'ART' }[cat];
    var rows = sheetToObjects(SHEETS.ARTICULOS);
    var num = 0;
    rows.forEach(function(a){
      var s = String(a.ID_Articulo || '');
      var m = s.match(new RegExp('^' + prefijo + '-?(\\d+)$'));
      if (m) num = Math.max(num, parseInt(m[1], 10) || 0);
    });
    var id = prefijo + '-' + String(num + 1).padStart(3, '0');

    appendRowByHeader(SHEETS.ARTICULOS, {
      'ID_Articulo': id,
      'Codigo': d.codigo || id,
      'Nombre': String(d.nombre).trim(),
      'Categoria': cat,
      'Sustancia_Activa': d.sustanciaActiva || '',
      'Presentacion': d.presentacion || '',
      'Concentracion': d.concentracion || '',
      'Fraccion_LGS': d.fraccion || '',
      'Unidad': d.unidad || '',
      'Stock_Minimo': d.stockMinimo || 0,
      'Requiere_Lote': categoriaRequiereLote_(cat) ? 'SI' : 'NO',
      'Activo': 'SI',
      'Notas': d.notas || '',
      'Codigo_Barras': String(d.codigoBarras || '').trim()
    });
    return { ok: true, idArticulo: id, categoria: cat, requiereLote: categoriaRequiereLote_(cat) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Núcleo (sin lock ni permiso): AGREGA un código de barras a un artículo en la
 * hoja Codigos_Barras (un artículo puede tener varios, p. ej. uno por proveedor).
 * Garantiza unicidad: un mismo código no puede apuntar a dos artículos distintos.
 */
function agregarCodigoBarras_(idArticulo, codigoBarras, proveedor, capturadoPor) {
  var nuevo = String(codigoBarras == null ? '' : codigoBarras).trim();
  if (!idArticulo) return { ok: false, error: 'Falta el artículo' };
  if (!nuevo) return { ok: false, error: 'Código vacío' };
  ensureCodigosBarrasSheet_();
  // ¿el código ya pertenece a otro artículo? (hoja múltiple o columna legacy)
  var enSheet = sheetToObjects(SHEETS.CODIGOS_BARRAS).filter(function (c) {
    return esActivo(c.Activo) && String(c.Codigo_Barras || '').trim() === nuevo;
  })[0];
  if (enSheet && String(enSheet.ID_Articulo) !== String(idArticulo)) {
    return { ok: false, error: 'Código ' + nuevo + ' ya es de otro artículo (' + enSheet.ID_Articulo + ')' };
  }
  if (enSheet && String(enSheet.ID_Articulo) === String(idArticulo)) {
    return { ok: true, idArticulo: idArticulo, codigoBarras: nuevo, yaExistia: true };
  }
  var dupCol = sheetToObjects(SHEETS.ARTICULOS).filter(function (a) {
    return String(a.ID_Articulo) !== String(idArticulo) && String(a.Codigo_Barras || '').trim() === nuevo;
  })[0];
  if (dupCol) return { ok: false, error: 'Código ' + nuevo + ' ya es de "' + (dupCol.Nombre || dupCol.ID_Articulo) + '"' };

  var num = 0;
  sheetToObjects(SHEETS.CODIGOS_BARRAS).forEach(function (c) {
    var m = String(c.ID_Codigo || '').match(/^CB-?(\d+)$/);
    if (m) num = Math.max(num, parseInt(m[1], 10) || 0);
  });
  appendRowByHeader(SHEETS.CODIGOS_BARRAS, {
    'ID_Codigo': 'CB-' + String(num + 1).padStart(4, '0'),
    'ID_Articulo': idArticulo, 'Codigo_Barras': nuevo, 'Proveedor': proveedor || '',
    'Activo': 'SI', 'Capturado_Por': capturadoPor || '', 'Timestamp_Captura': nowTs()
  });
  return { ok: true, idArticulo: idArticulo, codigoBarras: nuevo };
}

/** Acción: agrega un código de barras a un artículo (con permiso + lock). */
function agregarCodigoBarras(d) {
  if (!tienePermiso(d.rolUsuario, 'editar_articulo')) return errorSinPermiso(d.rolUsuario, 'editar_articulo');
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return agregarCodigoBarras_(d.idArticulo, d.codigoBarras, d.proveedor, d.capturadoPor || d.rolUsuario); }
  finally { lock.releaseLock(); }
}

/** Compat: "fijar" un código de barras = agregar uno (ya no sobrescribe). */
function setCodigoBarras(d) { return agregarCodigoBarras(d); }

/** Acción: quita un código de barras de un artículo (de la hoja y de la columna legacy). */
function quitarCodigoBarras(d) {
  if (!tienePermiso(d.rolUsuario, 'editar_articulo')) return errorSinPermiso(d.rolUsuario, 'editar_articulo');
  var codigo = String(d.codigoBarras || '').trim();
  if (!d.idArticulo || !codigo) return { ok: false, error: 'Falta artículo o código' };
  ensureCodigosBarrasSheet_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var quitados = 0;
    var sh = getSheet(SHEETS.CODIGOS_BARRAS);
    var data = sh.getDataRange().getValues();
    var cId = data[0].indexOf('ID_Articulo'), cCod = data[0].indexOf('Codigo_Barras');
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][cId]) === String(d.idArticulo) && String(data[i][cCod]).trim() === codigo) { sh.deleteRow(i + 1); quitados++; }
    }
    // Si el código estaba en la columna legacy de CAT_Articulos, limpiarlo
    var ash = getSheet(SHEETS.ARTICULOS);
    var ad = ash.getDataRange().getValues();
    var aId = ad[0].indexOf('ID_Articulo'), aBar = ad[0].indexOf('Codigo_Barras');
    if (aBar !== -1) {
      for (var j = 1; j < ad.length; j++) {
        if (String(ad[j][aId]) === String(d.idArticulo) && String(ad[j][aBar]).trim() === codigo) { ash.getRange(j + 1, aBar + 1).setValue(''); quitados++; }
      }
    }
    return { ok: true, quitados: quitados };
  } finally { lock.releaseLock(); }
}

/** Lista los códigos de barras de un artículo (hoja múltiple + columna legacy como "principal"). */
function getCodigosBarras(idArticulo) {
  if (!idArticulo) return { ok: false, error: 'Falta el artículo' };
  ensureCodigosBarrasSheet_();
  var lista = sheetToObjects(SHEETS.CODIGOS_BARRAS)
    .filter(function (c) { return esActivo(c.Activo) && String(c.ID_Articulo) === String(idArticulo); })
    .map(function (c) { return { codigo: String(c.Codigo_Barras || '').trim(), proveedor: c.Proveedor || '' }; });
  var art = getArticuloRaw_(idArticulo);
  if (art && String(art.Codigo_Barras || '').trim()) {
    var leg = String(art.Codigo_Barras).trim();
    if (!lista.some(function (x) { return x.codigo === leg; })) lista.push({ codigo: leg, proveedor: '(principal)' });
  }
  return { ok: true, data: lista };
}

/**
 * Busca un artículo activo por código escaneado. Revisa primero la hoja de
 * códigos múltiples, luego la columna legacy, y por último el código interno o ID.
 */
function buscarArticuloPorBarras(codigo) {
  ensureArticulosSheet_();
  ensureCodigosBarrasSheet_();
  var q = String(codigo == null ? '' : codigo).trim();
  if (!q) return { ok: false, error: 'Código vacío' };
  var arts = sheetToObjects(SHEETS.ARTICULOS).filter(function (a) { return esActivo(a.Activo); });
  var hit = null;
  var cb = sheetToObjects(SHEETS.CODIGOS_BARRAS).filter(function (c) { return esActivo(c.Activo) && String(c.Codigo_Barras || '').trim() === q; })[0];
  if (cb) hit = arts.filter(function (a) { return String(a.ID_Articulo) === String(cb.ID_Articulo); })[0];
  if (!hit) hit = arts.filter(function (a) { return String(a.Codigo_Barras || '').trim() === q; })[0];
  if (!hit) hit = arts.filter(function (a) { return String(a.Codigo || '').trim() === q || String(a.ID_Articulo).trim() === q; })[0];
  if (!hit) return { ok: false, error: 'Código no reconocido: ' + q };
  var cat = normCategoria_(hit.Categoria);
  return { ok: true, articulo: {
    idArticulo: hit.ID_Articulo,
    codigo: hit.Codigo || hit.ID_Articulo,
    codigoBarras: q,
    nombre: hit.Nombre,
    categoria: cat,
    unidad: hit.Unidad,
    requiereLote: categoriaRequiereLote_(cat)
  } };
}

/**
 * Valida que una entrada cumpla los requisitos de su categoría
 * (lote+caducidad para meds/controlados; receta para controlados).
 * Devuelve {ok:false,error} si falta algo, o null si todo bien.
 */
function validarRequisitosEntrada_(art, d) {
  var cat = normCategoria_(art.Categoria);
  if (categoriaRequiereLote_(cat)) {
    if (!d.loteFabricante && !d.lote) {
      return { ok: false, error: 'El lote de fabricante es obligatorio para ' + (art.Nombre || cat) };
    }
    if (!d.fechaCaducidad) {
      return { ok: false, error: 'La fecha de caducidad es obligatoria para ' + (art.Nombre || cat) };
    }
  }
  if (categoriaRequiereReceta_(cat) && (!d.folioReceta || !String(d.folioReceta).trim())) {
    return { ok: false, error: 'El folio de receta es obligatorio para el medicamento controlado ' + (art.Nombre || '') };
  }
  return null;
}

/**
 * Escribe físicamente una entrada de stock (caja en Lotes si la categoría
 * lo requiere + movimiento ENTRADA en Inventario_Mov). ASUME que el
 * llamador ya tiene el LockService y ya validó los requisitos.
 * @return {{idLote:string}}
 */
function entradaArticuloEscribir_(art, cantidad, d) {
  var cat = normCategoria_(art.Categoria);
  var requiereLote = categoriaRequiereLote_(cat);
  var unidad = d.unidad || art.Unidad || '';
  var nombre = art.Nombre || d.nombreArticulo || '';
  var fechaEntrada = d.fecha || todayStr();
  var ubicacion = d.ubicacion || UBICACION_DEFAULT;
  var idLote = '';

  if (requiereLote) {
    idLote = 'LOTE-' + new Date().getTime() + '-' + Math.floor(num_(d._seq));
    appendRowByHeader(SHEETS.LOTES, {
      'ID_Lote': idLote,
      'ID_Medicamento': art.ID_Articulo,
      'Nombre_Medicamento': nombre,
      'Folio_Receta': d.folioReceta ? String(d.folioReceta).trim() : '',
      'Lote_Fabricante': d.loteFabricante || d.lote || '',
      'Fecha_Caducidad': d.fechaCaducidad || '',
      'Cantidad_Inicial': cantidad,
      'Unidad': unidad,
      'Cantidad_Consumida': 0,
      'Saldo': cantidad,
      'Estado': 'ABIERTA',
      'Proveedor': d.proveedor || '',
      'Referencia': d.referencia || '',
      'Fecha_Entrada': fechaEntrada,
      'Ubicacion': ubicacion,
      'Capturado_Por': d.capturadoPor || '',
      'Timestamp_Captura': nowTs()
    });
  }

  appendInvMov_([
    'MOV-' + new Date().getTime() + '-' + Math.floor(num_(d._seq)),
    fechaEntrada,
    'ENTRADA',
    art.ID_Articulo,
    nombre,
    cantidad,
    unidad,
    d.referencia || '',
    d.loteFabricante || d.lote || '',
    d.fechaCaducidad || '',
    d.proveedor || '',
    d.capturadoPor,
    nowTs(),
    d.observaciones || '',
    idLote
  ], ubicacion);

  return { idLote: idLote, ubicacion: ubicacion };
}

/** Convierte a número (0 si no aplica). Para sufijos de ID únicos en lote. */
function num_(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

/**
 * Registra una ENTRADA de stock de cualquier artículo.
 *  - Categorías con lote (MEDICAMENTO / MEDICAMENTO_CONTROLADO): exige
 *    lote de fabricante + fecha de caducidad y crea la caja en Lotes.
 *    Si es controlado, además exige folio de receta (COFEPRIS).
 *  - INSUMO / OTROS: solo registra el movimiento ENTRADA (saldo simple).
 * Requeridos: idArticulo, cantidad.
 */
function registrarEntradaArticulo(d) {
  if (!tienePermiso(d.rolUsuario, 'entrada_articulo')) {
    return errorSinPermiso(d.rolUsuario, 'entrada_articulo');
  }
  if (!d.idArticulo) return { ok: false, error: 'Artículo requerido' };
  var cantidad = parseFloat(d.cantidad);
  if (!cantidad || cantidad <= 0) return { ok: false, error: 'La cantidad debe ser mayor a 0' };

  var art = getArticuloRaw_(d.idArticulo);
  if (!art) return { ok: false, error: 'Artículo no encontrado: ' + d.idArticulo };
  var requiereLote = categoriaRequiereLote_(art.Categoria);

  var verr = validarRequisitosEntrada_(art, d);
  if (verr) return verr;

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var res = entradaArticuloEscribir_(art, cantidad, d);
    return {
      ok: true,
      idLote: res.idLote,
      requiereLote: requiereLote,
      saldoNuevo: calcularSaldo(d.idArticulo),
      saldoLote: requiereLote ? cantidad : null
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Registra una SALIDA o AJUSTE de stock de un artículo (uso de almacén
 * general, mermas, correcciones). Para meds controlados el consumo
 * clínico sigue su flujo propio (registrarConsumo); esto es para
 * movimientos administrativos de almacén.
 * @param {string} d.tipo - 'SALIDA' o 'AJUSTE'. AJUSTE acepta cantidad +/-.
 */
function registrarMovimientoArticulo(d) {
  var tipo = String(d.tipo || 'SALIDA').toUpperCase();
  var accion = tipo === 'AJUSTE' ? 'ajuste_articulo' : 'salida_articulo';
  if (!tienePermiso(d.rolUsuario, accion)) {
    return errorSinPermiso(d.rolUsuario, accion);
  }
  if (!d.idArticulo) return { ok: false, error: 'Artículo requerido' };
  var cantidad = parseFloat(d.cantidad);
  if (tipo === 'SALIDA') {
    if (!cantidad || cantidad <= 0) return { ok: false, error: 'La cantidad debe ser mayor a 0' };
  } else if (isNaN(cantidad) || cantidad === 0) {
    return { ok: false, error: 'El ajuste debe ser distinto de 0 (usa negativo para descontar)' };
  }

  var art = getArticuloRaw_(d.idArticulo);
  if (!art) return { ok: false, error: 'Artículo no encontrado: ' + d.idArticulo };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // SALIDA se registra como cantidad positiva con Tipo SALIDA (calcularSaldo resta).
    // AJUSTE conserva el signo capturado.
    var qty = tipo === 'SALIDA' ? Math.abs(cantidad) : cantidad;
    var ubicacion = d.ubicacion || UBICACION_DEFAULT;
    appendInvMov_([
      'MOV-' + new Date().getTime(),
      d.fecha || todayStr(),
      tipo,
      d.idArticulo,
      art.Nombre || '',
      qty,
      d.unidad || art.Unidad || '',
      d.referencia || '',
      '', '', '',
      d.capturadoPor,
      nowTs(),
      d.observaciones || '',
      ''
    ], ubicacion);
    return { ok: true, saldoNuevo: calcularSaldo(d.idArticulo, ubicacion), saldoGlobal: calcularSaldo(d.idArticulo) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Reasigna la ubicación de una caja/lote (traspaso). Asume lock del llamador.
 * Devuelve {ok, saldo, loteFabricante, ubicacionActual} o {ok:false,error}.
 */
function setLoteUbicacion_(idLote, nuevaUbicacion) {
  var sh = getSheet(SHEETS.LOTES);
  var data = sh.getDataRange().getValues();
  var H = data[0];
  var cId = H.indexOf('ID_Lote');
  var cUbi = H.indexOf('Ubicacion');
  var cSaldo = H.indexOf('Saldo');
  var cInicial = H.indexOf('Cantidad_Inicial');
  var cConsumida = H.indexOf('Cantidad_Consumida');
  var cLoteFab = H.indexOf('Lote_Fabricante');
  var cEstado = H.indexOf('Estado');
  if (cUbi === -1) { sh.getRange(1, H.length + 1).setValue('Ubicacion'); cUbi = H.length; }
  for (var i = 1; i < data.length; i++) {
    if (data[i][cId] === idLote) {
      var inicial = parseFloat(data[i][cInicial]) || 0;
      var consumida = parseFloat(data[i][cConsumida]) || 0;
      var saldo = (cSaldo !== -1 && data[i][cSaldo] !== '') ? parseFloat(data[i][cSaldo]) : (inicial - consumida);
      var actual = data[i][cUbi] || UBICACION_DEFAULT;
      sh.getRange(i + 1, cUbi + 1).setValue(nuevaUbicacion);
      return { ok: true, saldo: saldo, loteFabricante: data[i][cLoteFab], ubicacionActual: actual, estado: data[i][cEstado] };
    }
  }
  return { ok: false, error: 'Caja/lote no encontrada: ' + idLote };
}

/**
 * Traspaso de stock entre almacenes: SALIDA en origen + ENTRADA en destino.
 *  - Artículos con lote: se traslada la CAJA completa (su saldo) y se reasigna
 *    su Ubicacion. Requiere idLote.
 *  - Sin lote (insumos/otros): por cantidad, validando saldo en origen.
 * Requeridos: idArticulo, ubicacionOrigen, ubicacionDestino.
 */
function registrarTraspaso(d) {
  if (!tienePermiso(d.rolUsuario, 'traspaso_articulo')) {
    return errorSinPermiso(d.rolUsuario, 'traspaso_articulo');
  }
  if (!d.idArticulo) return { ok: false, error: 'Artículo requerido' };
  if (!d.ubicacionOrigen || !d.ubicacionDestino) return { ok: false, error: 'Almacén de origen y destino requeridos' };
  if (d.ubicacionOrigen === d.ubicacionDestino) return { ok: false, error: 'El origen y el destino deben ser distintos' };

  var art = getArticuloRaw_(d.idArticulo);
  if (!art) return { ok: false, error: 'Artículo no encontrado: ' + d.idArticulo };
  var requiereLote = categoriaRequiereLote_(art.Categoria);
  var nombre = art.Nombre || '';
  var unidad = art.Unidad || '';

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var cantidad, loteFab = '';
    if (requiereLote) {
      if (!d.idLote) return { ok: false, error: 'Selecciona la caja/lote a trasladar' };
      var lt = setLoteUbicacion_(d.idLote, d.ubicacionDestino);
      if (!lt.ok) return lt;
      if (lt.ubicacionActual !== d.ubicacionOrigen) {
        // Revertir la reasignación si el origen no coincide
        setLoteUbicacion_(d.idLote, lt.ubicacionActual);
        return { ok: false, error: 'La caja seleccionada no está en ' + d.ubicacionOrigen + ' (está en ' + lt.ubicacionActual + ')' };
      }
      if (!(lt.saldo > 0)) {
        setLoteUbicacion_(d.idLote, lt.ubicacionActual);
        return { ok: false, error: 'La caja seleccionada no tiene saldo para trasladar' };
      }
      cantidad = lt.saldo;
      loteFab = lt.loteFabricante || '';
    } else {
      cantidad = parseFloat(d.cantidad);
      if (!cantidad || cantidad <= 0) return { ok: false, error: 'La cantidad debe ser mayor a 0' };
      var saldoOrigen = calcularSaldo(d.idArticulo, d.ubicacionOrigen);
      if (cantidad > saldoOrigen) {
        return { ok: false, error: 'Saldo insuficiente en ' + d.ubicacionOrigen + ' (disponible: ' + saldoOrigen + ' ' + unidad + ')' };
      }
    }

    var fecha = d.fecha || todayStr();
    var ref = 'Traspaso ' + d.ubicacionOrigen + ' → ' + d.ubicacionDestino;
    var obs = d.motivo || '';
    var base = new Date().getTime();

    // SALIDA en origen
    appendInvMov_([
      'MOV-' + base, fecha, 'SALIDA', d.idArticulo, nombre, cantidad, unidad,
      ref, loteFab, '', '', d.capturadoPor, nowTs(), obs, d.idLote || ''
    ], d.ubicacionOrigen);
    // ENTRADA en destino
    appendInvMov_([
      'MOV-' + (base + 1), fecha, 'ENTRADA', d.idArticulo, nombre, cantidad, unidad,
      ref, loteFab, '', '', d.capturadoPor, nowTs(), obs, d.idLote || ''
    ], d.ubicacionDestino);

    return {
      ok: true,
      cantidad: cantidad,
      saldoOrigen: calcularSaldo(d.idArticulo, d.ubicacionOrigen),
      saldoDestino: calcularSaldo(d.idArticulo, d.ubicacionDestino)
    };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// MÓDULO REMISIÓN — consumo del paciente con cargo a su cuenta
// ------------------------------------------------------------
// "Remisión" = documento con el que se cargan los consumos a la cuenta única
// del paciente. Cada consumo: descuenta inventario (almacén + lote), escribe
// el Libro COFEPRIS SOLO si es controlado, deja traza en Consumos y agrega una
// línea cobrable a Remision_Items a precio de venta (último costo × 2).
// ============================================================
var REMISION_ITEMS_HEADERS = ['ID_Remision_Item','Fecha','ID_Paciente','Nombre_Paciente','Origen',
  'Folio_Cirugia','ID_Hospitalizacion','ID_Articulo','Codigo','Descripcion','Categoria',
  'Cantidad','Unidad','ID_Lote','Ubicacion','Costo_Unitario','Precio_Venta_Unitario','Importe',
  'Estado','Capturado_Por','Timestamp_Captura','Ref_Item_Devuelto'];

function ensureRemisionSheet_() {
  ensureSheetConHeaders_(SHEETS.REMISION_ITEMS, REMISION_ITEMS_HEADERS);
}

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

/** Precio de compra más reciente de un artículo (0 si no hay). */
function precioCompraReciente_(idArticulo) {
  var rows = sheetToObjects(SHEETS.PRECIOS_COMPRA).filter(function(p){
    return String(p.ID_Articulo) === String(idArticulo) && num_(p.Precio) > 0;
  });
  if (!rows.length) return 0;
  rows.sort(function(a, b){ return String(b.Fecha_Actualizacion || '').localeCompare(String(a.Fecha_Actualizacion || '')); });
  return num_(rows[0].Precio);
}

/** Precio de venta = último costo de compra × 2. */
function precioVentaArticulo_(idArticulo) {
  return ocRound_(precioCompraReciente_(idArticulo) * 2);
}

/** Total cobrable (materiales+medicamentos) de la remisión de un paciente. */
function totalRemisionMateriales_(idPaciente) {
  ensureRemisionSheet_();
  var total = 0;
  sheetToObjects(SHEETS.REMISION_ITEMS).forEach(function(r){
    if (String(r.ID_Paciente) === String(idPaciente) && r.Estado !== 'CANCELADO') total += num_(r.Importe);
  });
  return ocRound_(total);
}

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

/**
 * Registra en el BOM lo realmente usado (Cantidad_R) por código de artículo,
 * al conciliar el BOM con la remisión del cierre de cirugía.
 * d.folioCirugia, d.usos: [{ codigo, cantidad }]
 */
function registrarUsoBOM(d) {
  if (!tienePermiso(d.rolUsuario, 'registrar_consumo')) {
    return errorSinPermiso(d.rolUsuario, 'registrar_consumo');
  }
  if (!d.folioCirugia) return { ok: false, error: 'Folio de cirugía requerido' };
  var usos = {};
  (d.usos || []).forEach(function(u){
    var c = String(u.codigo || '');
    if (!c) return;
    usos[c] = (usos[c] || 0) + (parseFloat(u.cantidad) || 0);
  });
  var sh = getSheet(SHEETS.BOM_ITEMS);
  var data = sh.getDataRange().getValues();
  var H = data[0];
  var cFolio = H.indexOf('Folio_Cirugia');
  var cCodigo = H.indexOf('Codigo');
  var cR = H.indexOf('Cantidad_R');
  if (cR === -1) return { ok: true, actualizados: 0 }; // sin columna, nada que hacer
  var n = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][cFolio]) !== String(d.folioCirugia)) continue;
    var cod = String(data[i][cCodigo] || '');
    if (usos.hasOwnProperty(cod)) {
      sh.getRange(i + 1, cR + 1).setValue(usos[cod]);
      n++;
    }
  }
  return { ok: true, actualizados: n };
}

function getRemisionPaciente(idPaciente) {
  if (!idPaciente) return { ok: false, error: 'Paciente requerido' };
  ensureRemisionSheet_();
  var data = sheetToObjects(SHEETS.REMISION_ITEMS)
    .filter(function(r){ return String(r.ID_Paciente) === String(idPaciente) && r.Estado !== 'CANCELADO'; })
    .map(function(r){
      return {
        idItem: r.ID_Remision_Item, fecha: dateOnly(r.Fecha), origen: r.Origen,
        folioCirugia: r.Folio_Cirugia, idArticulo: r.ID_Articulo, codigo: r.Codigo,
        descripcion: r.Descripcion, categoria: r.Categoria, cantidad: num_(r.Cantidad),
        unidad: r.Unidad, idLote: r.ID_Lote, ubicacion: r.Ubicacion,
        precioVenta: num_(r.Precio_Venta_Unitario), importe: num_(r.Importe)
      };
    });
  return { ok: true, data: data, totalMateriales: totalRemisionMateriales_(idPaciente) };
}

/**
 * Material devolvible de un paciente: agrega sus líneas de remisión por artículo
 * (cargado − ya devuelto). Lo usa la pantalla de devoluciones para validar
 * pertenencia al paciente y topar la cantidad a devolver.
 */
function getMaterialDevolverPaciente(idPaciente) {
  if (!idPaciente) return { ok: false, error: 'Paciente requerido' };
  ensureRemisionSheet_();
  var rows = sheetToObjects(SHEETS.REMISION_ITEMS).filter(function (r) {
    return String(r.ID_Paciente) === String(idPaciente) && r.Estado !== 'CANCELADO';
  });
  var agg = {};
  rows.forEach(function (r) {
    var id = String(r.ID_Articulo);
    if (!agg[id]) agg[id] = { idArticulo: r.ID_Articulo, codigo: r.Codigo, descripcion: r.Descripcion, categoria: r.Categoria, unidad: r.Unidad, cargado: 0, devuelto: 0 };
    var c = num_(r.Cantidad);
    if (c >= 0) agg[id].cargado += c; else agg[id].devuelto += -c;
  });
  var data = Object.keys(agg).map(function (k) {
    var a = agg[k];
    a.cargado = ocRound_(a.cargado);
    a.devuelto = ocRound_(a.devuelto);
    a.devolvible = ocRound_(a.cargado - a.devuelto);
    return a;
  }).filter(function (a) { return a.devolvible > 0; });
  data.sort(function (a, b) { return String(a.descripcion || '').localeCompare(String(b.descripcion || '')); });
  return { ok: true, data: data };
}

/**
 * Registra la devolución de material de un paciente: reintegra al inventario
 * (al mismo lote por revertirLote_, o ENTRADA al almacén para insumos) y revierte
 * el cargo con líneas negativas en Remision_Items. Valida pertenencia al paciente
 * y que no se devuelva más de lo cargado. Para controlados deja asiento en el Libro.
 * d.items = [{idArticulo, cantidad}].
 */
function registrarDevolucion(d) {
  if (!tienePermiso(d.rolUsuario, 'devolucion_material')) {
    return errorSinPermiso(d.rolUsuario, 'devolucion_material');
  }
  if (!d.idPaciente) return { ok: false, error: 'Paciente requerido' };
  var req = Array.isArray(d.items) ? d.items.filter(function (it) {
    return it && it.idArticulo && (parseFloat(it.cantidad) || 0) > 0;
  }) : [];
  if (!req.length) return { ok: false, error: 'No hay artículos a devolver' };
  ensureRemisionSheet_();
  if (cuentaCerrada_(d.idPaciente)) {
    return { ok: false, error: 'La cuenta del paciente está CERRADA. Reábrela en Cobro para registrar la devolución.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var allRows = sheetToObjects(SHEETS.REMISION_ITEMS).filter(function (r) {
      return String(r.ID_Paciente) === String(d.idPaciente) && r.Estado !== 'CANCELADO';
    });
    var devueltoPorRef = {};
    allRows.forEach(function (r) {
      if (num_(r.Cantidad) < 0 && r.Ref_Item_Devuelto) {
        var k = String(r.Ref_Item_Devuelto);
        devueltoPorRef[k] = (devueltoPorRef[k] || 0) + (-num_(r.Cantidad));
      }
    });

    // PASO 1: planear sin escribir (PEPS sobre las líneas de cargo del artículo)
    var plan = [];
    for (var x = 0; x < req.length; x++) {
      var it = req[x];
      var restante = parseFloat(it.cantidad) || 0;
      var fuentes = allRows.filter(function (r) { return String(r.ID_Articulo) === String(it.idArticulo) && num_(r.Cantidad) > 0; });
      fuentes.sort(function (a, b) { return String(a.Timestamp_Captura || a.Fecha || '').localeCompare(String(b.Timestamp_Captura || b.Fecha || '')); });
      var nombreArt = fuentes.length ? fuentes[0].Descripcion : it.idArticulo;
      for (var f = 0; f < fuentes.length && restante > 0.0001; f++) {
        var src = fuentes[f];
        var yaDev = devueltoPorRef[String(src.ID_Remision_Item)] || 0;
        var disp = num_(src.Cantidad) - yaDev;
        if (disp <= 0) continue;
        var tomar = Math.min(restante, disp);
        plan.push({ src: src, tomar: tomar });
        devueltoPorRef[String(src.ID_Remision_Item)] = yaDev + tomar;
        restante -= tomar;
      }
      if (restante > 0.0001) {
        return { ok: false, error: 'No puedes devolver más de lo cargado para "' + nombreArt + '" (excede por ' + ocRound_(restante) + ')' };
      }
    }

    var hayControlado = plan.some(function (p) { return normCategoria_(p.src.Categoria) === 'MEDICAMENTO_CONTROLADO'; });
    var ultimoAsiento = 0;
    if (hayControlado) {
      var libroData = getSheet(SHEETS.LIBRO).getDataRange().getValues();
      for (var k = 4; k < libroData.length; k++) {
        if (libroData[k][0] && !isNaN(libroData[k][0])) ultimoAsiento = Math.max(ultimoAsiento, parseInt(libroData[k][0], 10));
      }
    }

    // PASO 2: escribir
    var base = new Date().getTime();
    var seq = 0, totalCredito = 0, lineas = 0;
    plan.forEach(function (p) {
      var src = p.src, tomar = p.tomar; seq++;
      var cat = normCategoria_(src.Categoria);
      var saldoAntes = (cat === 'MEDICAMENTO_CONTROLADO') ? calcularSaldo(src.ID_Articulo) : 0;

      // Reintegrar inventario
      if (categoriaRequiereLote_(cat) && src.ID_Lote) {
        var rv = revertirLote_(src.ID_Lote, tomar);
        if (!rv.ok) {
          appendInvMov_(['MOV-' + base + '-' + seq, todayStr(), 'ENTRADA', src.ID_Articulo, src.Descripcion, tomar, src.Unidad || '', 'Devolución (lote no disponible) ' + (d.nombrePaciente || d.idPaciente), '', '', '', d.realizadoPor || '', nowTs(), 'Devolución de material', src.ID_Lote || ''], src.Ubicacion || UBICACION_DEFAULT);
        }
      } else {
        appendInvMov_(['MOV-' + base + '-' + seq, todayStr(), 'ENTRADA', src.ID_Articulo, src.Descripcion, tomar, src.Unidad || '', 'Devolución ' + (d.nombrePaciente || d.idPaciente), '', '', '', d.realizadoPor || '', nowTs(), 'Devolución de material', src.ID_Lote || ''], src.Ubicacion || UBICACION_DEFAULT);
      }

      // Línea negativa cobrable (crédito)
      var pventa = num_(src.Precio_Venta_Unitario);
      var importe = ocRound_(-pventa * tomar);
      totalCredito += importe;
      appendRowByHeader(SHEETS.REMISION_ITEMS, {
        'ID_Remision_Item': 'DEV-' + base + '-' + seq, 'Fecha': todayStr(), 'ID_Paciente': d.idPaciente,
        'Nombre_Paciente': d.nombrePaciente || src.Nombre_Paciente || '', 'Origen': src.Origen || '',
        'Folio_Cirugia': src.Folio_Cirugia || '', 'ID_Hospitalizacion': src.ID_Hospitalizacion || '',
        'ID_Articulo': src.ID_Articulo, 'Codigo': src.Codigo || '', 'Descripcion': src.Descripcion || '',
        'Categoria': src.Categoria || '', 'Cantidad': -tomar, 'Unidad': src.Unidad || '',
        'ID_Lote': src.ID_Lote || '', 'Ubicacion': src.Ubicacion || '',
        'Costo_Unitario': num_(src.Costo_Unitario), 'Precio_Venta_Unitario': pventa, 'Importe': importe,
        'Estado': 'DEVOLUCION', 'Capturado_Por': d.realizadoPor || '', 'Timestamp_Captura': nowTs(),
        'Ref_Item_Devuelto': src.ID_Remision_Item
      });

      // Libro COFEPRIS (reingreso) para controlados
      if (cat === 'MEDICAMENTO_CONTROLADO') {
        ultimoAsiento++;
        appendLibroRow_({
          'No_Asiento': ultimoAsiento, 'Fecha': todayStr(), 'Folio_Receta': '',
          'ID_Medicamento': src.ID_Articulo, 'Nombre_Medicamento': src.Descripcion, 'Fraccion_LGS': '',
          'Nombre_Paciente': d.nombrePaciente || '', 'Nombre_Medico': '', 'Cedula_Medico': '',
          'Cantidad_Salida': -tomar, 'Existencia_Anterior': saldoAntes, 'Existencia_Posterior': saldoAntes + tomar,
          'Folio_Cirugia': src.Folio_Cirugia || '', 'Observaciones': 'DEVOLUCIÓN de material',
          'Estado': 'ACTIVO', 'Ref_Consumo': 'DEV-' + base + '-' + seq, 'ID_Lote': src.ID_Lote || '', 'Lote_Fabricante': ''
        });
      }
      lineas++;
    });
    return { ok: true, lineas: lineas, totalCredito: ocRound_(totalCredito), totalCuentaMateriales: totalRemisionMateriales_(d.idPaciente) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Registra una remisión (uno o varios consumos del paciente). UNIFICA el
 * consumo: descuenta inventario por almacén/lote, escribe el Libro COFEPRIS
 * solo para controlados, deja traza en Consumos y agrega líneas cobrables.
 * Requeridos: idPaciente, items[]. Cada item: idArticulo, cantidad, ubicacion,
 * idLote (si la categoría lleva lote).
 */
function registrarRemision(d) {
  if (!tienePermiso(d.rolUsuario, 'registrar_consumo')) {
    return errorSinPermiso(d.rolUsuario, 'registrar_consumo');
  }
  var items = d.items || [];
  if (!items.length) return { ok: false, error: 'No hay artículos a registrar' };
  if (!d.idPaciente) return { ok: false, error: 'Paciente requerido' };
  if (cuentaCerrada_(d.idPaciente)) {
    return { ok: false, error: 'La cuenta del paciente está CERRADA. Reábrela en Cobro de caja para agregar consumos.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    ensureRemisionSheet_();
    ensureHeaders_(SHEETS.CONSUMOS, ['Estado', 'ID_Lote', 'Lote_Fabricante']);

    // Cédula del médico (para el Libro)
    var cedula = '';
    if (d.idMedico) {
      var medicos = sheetToObjects(SHEETS.MEDICOS);
      for (var j = 0; j < medicos.length; j++) {
        if (medicos[j].ID_Medico === d.idMedico) { cedula = medicos[j].Cedula_Profesional; break; }
      }
    }

    // Último asiento del Libro COFEPRIS
    var shLibro = getSheet(SHEETS.LIBRO);
    var libroData = shLibro.getDataRange().getValues();
    var ultimoAsiento = 0;
    for (var k = 4; k < libroData.length; k++) {
      if (libroData[k][0] && !isNaN(libroData[k][0])) ultimoAsiento = Math.max(ultimoAsiento, parseInt(libroData[k][0], 10));
    }

    var fecha = d.fecha || todayStr();
    var hora = d.hora || Utilities.formatDate(new Date(), getConfig('ZonaHoraria') || 'America/Chihuahua', 'HH:mm');
    var origen = d.origen || 'QUIROFANO';

    // ---- Validar TODO antes de escribir ----
    var prep = [];
    for (var v = 0; v < items.length; v++) {
      var it = items[v];
      var art = getArticuloRaw_(it.idArticulo);
      if (!art) return { ok: false, error: 'Artículo no encontrado: ' + it.idArticulo };
      var cat = normCategoria_(art.Categoria);
      var reqLote = categoriaRequiereLote_(cat);
      var cantidad = parseFloat(it.cantidad);
      if (!cantidad || cantidad <= 0) return { ok: false, error: 'Cantidad inválida para ' + (art.Nombre || it.idArticulo) };
      var ubic = it.ubicacion || UBICACION_DEFAULT;
      if (reqLote && !it.idLote) return { ok: false, error: 'Selecciona la caja/lote para ' + (art.Nombre || it.idArticulo) };
      if (!reqLote) {
        var saldoU = calcularSaldo(it.idArticulo, ubic);
        if (cantidad > saldoU) return { ok: false, error: 'Saldo insuficiente de ' + (art.Nombre || '') + ' en ese almacén (disponible: ' + saldoU + ')' };
      }
      prep.push({ art: art, cat: cat, reqLote: reqLote, cantidad: cantidad, ubic: ubic, it: it });
    }

    // ---- Escribir ----
    var creados = 0, totalMateriales = 0, base = new Date().getTime();
    for (var i = 0; i < prep.length; i++) {
      var p = prep[i], art = p.art, cantidad = p.cantidad, ubic = p.ubic, cat = p.cat;
      var unidad = p.it.unidad || art.Unidad || '';
      var nombre = art.Nombre || '';
      var loteFab = '';

      if (p.reqLote) {
        var desc = descontarLote_(p.it.idLote, cantidad);
        if (!desc.ok) return desc;
        loteFab = desc.loteFabricante || '';
      }

      var saldoAntes = calcularSaldo(art.ID_Articulo);     // global (COFEPRIS)
      var saldoDespues = saldoAntes - cantidad;
      var idConsumo = 'CONS-' + base + '-' + i;

      // 1) Movimiento SALIDA en el almacén de origen
      appendInvMov_([
        'MOV-' + base + '-' + i, fecha, 'SALIDA', art.ID_Articulo, nombre, cantidad, unidad,
        'Remisión ' + (d.nombrePaciente || d.idPaciente) + (d.folioCirugia ? ' / ' + d.folioCirugia : ''),
        loteFab, '', '', d.capturadoPor, nowTs(), d.observaciones || '', p.it.idLote || ''
      ], ubic);

      // 2) Traza en Consumos
      appendRowByHeader(SHEETS.CONSUMOS, {
        'ID_Consumo': idConsumo, 'Fecha_Consumo': fecha, 'Hora_Consumo': "'" + hora,
        'Folio_Cirugia': d.folioCirugia || '', 'Folio_Receta': d.folioReceta || '',
        'ID_Paciente': d.idPaciente, 'Nombre_Paciente': d.nombrePaciente || '',
        'ID_Medicamento': art.ID_Articulo, 'Nombre_Medicamento': nombre,
        'Cantidad_Consumida': cantidad, 'Unidad': unidad,
        'ID_Medico': d.idMedico || '', 'Nombre_Medico': d.nombreMedico || '',
        'Administrado_Por': d.administradoPor || '', 'Observaciones': d.observaciones || '',
        'Capturado_Por': d.capturadoPor, 'Timestamp_Captura': nowTs(), 'Estado': 'ACTIVO',
        'ID_Lote': p.it.idLote || '', 'Lote_Fabricante': loteFab
      });

      // 3) Libro COFEPRIS SOLO si es controlado
      if (cat === 'MEDICAMENTO_CONTROLADO') {
        ultimoAsiento++;
        appendLibroRow_({
          'No_Asiento': ultimoAsiento, 'Fecha': fecha, 'Folio_Receta': d.folioReceta || '',
          'ID_Medicamento': art.ID_Articulo, 'Nombre_Medicamento': nombre, 'Fraccion_LGS': art.Fraccion_LGS || '',
          'Nombre_Paciente': d.nombrePaciente || '', 'Nombre_Medico': d.nombreMedico || '', 'Cedula_Medico': cedula,
          'Cantidad_Salida': cantidad, 'Existencia_Anterior': saldoAntes, 'Existencia_Posterior': saldoDespues,
          'Folio_Cirugia': d.folioCirugia || '', 'Observaciones': d.observaciones || '',
          'Estado': 'ACTIVO', 'Ref_Consumo': idConsumo, 'ID_Lote': p.it.idLote || '', 'Lote_Fabricante': loteFab
        });
      }

      // 4) Línea cobrable (precio venta congelado = último costo × 2)
      var costo = precioCompraReciente_(art.ID_Articulo);
      var pventa = ocRound_(costo * 2);
      var importe = ocRound_(pventa * cantidad);
      totalMateriales += importe;
      appendRowByHeader(SHEETS.REMISION_ITEMS, {
        'ID_Remision_Item': 'REM-' + base + '-' + i, 'Fecha': fecha,
        'ID_Paciente': d.idPaciente, 'Nombre_Paciente': d.nombrePaciente || '', 'Origen': origen,
        'Folio_Cirugia': d.folioCirugia || '', 'ID_Hospitalizacion': d.idHospitalizacion || '',
        'ID_Articulo': art.ID_Articulo, 'Codigo': art.Codigo || art.ID_Articulo, 'Descripcion': nombre,
        'Categoria': cat, 'Cantidad': cantidad, 'Unidad': unidad, 'ID_Lote': p.it.idLote || '',
        'Ubicacion': ubic, 'Costo_Unitario': costo, 'Precio_Venta_Unitario': pventa, 'Importe': importe,
        'Estado': 'ACTIVO', 'Capturado_Por': d.capturadoPor, 'Timestamp_Captura': nowTs()
      });
      creados++;
    }

    return {
      ok: true, lineas: creados,
      totalLineasImporte: ocRound_(totalMateriales),
      totalCuentaMateriales: totalRemisionMateriales_(d.idPaciente)
    };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// MÓDULO COMPRAS — PROVEEDORES Y ÓRDENES DE COMPRA
// ------------------------------------------------------------
// Ciclo de la OC: BORRADOR → ENVIADA → RECIBIDA_PARCIAL → RECIBIDA
// (CANCELADA en cualquier punto previo a recibir). Al recibir partidas
// se generan automáticamente las entradas a inventario reutilizando
// entradaArticuloEscribir_, respetando lote/caducidad/receta por categoría.
// ============================================================
var PROVEEDORES_HEADERS = ['ID_Proveedor','Nombre','RFC','Direccion','Ciudad','Telefono','Email',
  'Condiciones_Pago','Activo','Notas','Capturado_Por','Timestamp_Captura'];
var OC_HEADERS = ['Folio_OC','Fecha','ID_Proveedor','Nombre_Proveedor','Condiciones','Via_Embarque',
  'Fecha_Entrega','Estado','Subtotal','IVA','Total','Moneda','Observaciones',
  'Creado_Por','Timestamp_Creacion','Recibido_Por','Timestamp_Recepcion'];
var OC_ITEMS_HEADERS = ['ID_OC_Item','Folio_OC','ID_Articulo','Codigo','Descripcion','Unidad',
  'Cantidad','Precio_Unitario','Descuento','Importe','Cantidad_Recibida','Estado_Item'];
var PRECIOS_COMPRA_HEADERS = ['ID_Precio','ID_Articulo','Nombre_Articulo','ID_Proveedor','Nombre_Proveedor',
  'Precio','Descuento','Moneda','Fecha_Actualizacion'];

var OC_IVA_TASA = 0.16;

/** Garantiza las hojas del módulo de compras. */
function ensureComprasSheets_() {
  ensureSheetConHeaders_(SHEETS.PROVEEDORES, PROVEEDORES_HEADERS);
  ensureSheetConHeaders_(SHEETS.ORDENES_COMPRA, OC_HEADERS);
  ensureSheetConHeaders_(SHEETS.OC_ITEMS, OC_ITEMS_HEADERS);
  ensureSheetConHeaders_(SHEETS.PRECIOS_COMPRA, PRECIOS_COMPRA_HEADERS);
}

/** Clave normalizada para comparar nombres (sin acentos, mayúsculas, espacios colapsados). */
function normNombre_(s) {
  return String(s == null ? '' : s).trim().toUpperCase()
    .replace(/Í/g,'I').replace(/Á/g,'A').replace(/É/g,'E').replace(/Ó/g,'O').replace(/Ú/g,'U').replace(/Ñ/g,'N')
    .replace(/\s+/g, ' ');
}

/**
 * Lista de precios de compra. Sin filtro devuelve todo; con idArticulo
 * devuelve los proveedores y precios de ese artículo (orden ascendente).
 */
function getPreciosCompra(idArticulo) {
  ensureComprasSheets_();
  var data = sheetToObjects(SHEETS.PRECIOS_COMPRA).map(function(p){
    return {
      idArticulo: p.ID_Articulo,
      nombreArticulo: p.Nombre_Articulo,
      idProveedor: p.ID_Proveedor,
      nombreProveedor: p.Nombre_Proveedor,
      precio: num_(p.Precio),
      descuento: num_(p.Descuento),
      moneda: p.Moneda || 'MXN'
    };
  });
  if (idArticulo) {
    data = data.filter(function(p){ return String(p.idArticulo) === String(idArticulo); });
    data.sort(function(a, b){ return a.precio - b.precio; });
  }
  return { ok: true, data: data };
}

/**
 * Importación masiva del catálogo de precios (idempotente). Crea los
 * proveedores y artículos faltantes (match por nombre normalizado) y
 * agrega/actualiza la lista de precios. Usa escritura en bloque.
 * Payload d:
 *   proveedores: [nombre, ...]
 *   articulos:   [{nombre, categoria, unidad}, ...]
 *   precios:     [{articulo, proveedor, precio, descuento}, ...]
 * Pensado para correrse por tramos (chunks) varias veces sin duplicar.
 */
function importarCatalogoPrecios(d) {
  if (d && d.rolUsuario && d.rolUsuario !== 'ADMIN') {
    return { ok: false, error: 'Solo ADMIN puede importar el catálogo de precios.' };
  }
  ensureArticulosSheet_();
  ensureComprasSheets_();
  var hoy = todayStr();
  var res = { ok: true, proveedoresNuevos: 0, articulosNuevos: 0, preciosNuevos: 0, preciosActualizados: 0 };

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // ---- 1) PROVEEDORES (match por nombre) ----
    var provSh = getSheet(SHEETS.PROVEEDORES);
    var provRows = sheetToObjects(SHEETS.PROVEEDORES);
    var provPorNombre = {};
    var provMaxNum = 0;
    provRows.forEach(function(p){
      if (p.Nombre) provPorNombre[normNombre_(p.Nombre)] = p.ID_Proveedor;
      var m = String(p.ID_Proveedor || '').match(/^PROV-?(\d+)$/);
      if (m) provMaxNum = Math.max(provMaxNum, parseInt(m[1], 10) || 0);
    });
    var provHeaders = provSh.getRange(1, 1, 1, provSh.getLastColumn()).getValues()[0];
    var nuevosProv = [];
    (d.proveedores || []).forEach(function(nombre){
      var k = normNombre_(nombre);
      if (!k || provPorNombre[k]) return;
      provMaxNum++;
      var id = 'PROV-' + String(provMaxNum).padStart(3, '0');
      provPorNombre[k] = id;
      var obj = { 'ID_Proveedor': id, 'Nombre': String(nombre).trim(), 'Activo': 'SI', 'Timestamp_Captura': nowTs() };
      nuevosProv.push(provHeaders.map(function(h){ return obj.hasOwnProperty(h) ? obj[h] : ''; }));
    });
    if (nuevosProv.length) {
      provSh.getRange(provSh.getLastRow() + 1, 1, nuevosProv.length, provHeaders.length).setValues(nuevosProv);
      res.proveedoresNuevos = nuevosProv.length;
    }

    // ---- 2) ARTÍCULOS (match por nombre) ----
    var artSh = getSheet(SHEETS.ARTICULOS);
    var artRows = sheetToObjects(SHEETS.ARTICULOS);
    var artPorNombre = {};
    var medMaxNum = 0, insMaxNum = 0, otrMaxNum = 0;
    artRows.forEach(function(a){
      if (a.Nombre) artPorNombre[normNombre_(a.Nombre)] = a.ID_Articulo;
      var s = String(a.ID_Articulo || '');
      var mm = s.match(/^MED-?(\d+)$/); if (mm) medMaxNum = Math.max(medMaxNum, parseInt(mm[1],10)||0);
      var mi = s.match(/^INS-?(\d+)$/); if (mi) insMaxNum = Math.max(insMaxNum, parseInt(mi[1],10)||0);
      var mo = s.match(/^ART-?(\d+)$/); if (mo) otrMaxNum = Math.max(otrMaxNum, parseInt(mo[1],10)||0);
    });
    var artHeaders = artSh.getRange(1, 1, 1, artSh.getLastColumn()).getValues()[0];
    var nuevosArt = [];
    (d.articulos || []).forEach(function(a){
      var k = normNombre_(a.nombre);
      if (!k || artPorNombre[k]) return;
      var cat = normCategoria_(a.categoria || 'MEDICAMENTO');
      var id;
      if (cat === 'INSUMO') { insMaxNum++; id = 'INS-' + String(insMaxNum).padStart(3,'0'); }
      else if (cat === 'OTROS') { otrMaxNum++; id = 'ART-' + String(otrMaxNum).padStart(3,'0'); }
      else { medMaxNum++; id = 'MED-' + String(medMaxNum).padStart(3,'0'); }
      artPorNombre[k] = id;
      var obj = {
        'ID_Articulo': id, 'Codigo': id, 'Nombre': String(a.nombre).trim(), 'Categoria': cat,
        'Unidad': a.unidad || '', 'Stock_Minimo': 0,
        'Requiere_Lote': categoriaRequiereLote_(cat) ? 'SI' : 'NO', 'Activo': 'SI'
      };
      nuevosArt.push(artHeaders.map(function(h){ return obj.hasOwnProperty(h) ? obj[h] : ''; }));
    });
    if (nuevosArt.length) {
      artSh.getRange(artSh.getLastRow() + 1, 1, nuevosArt.length, artHeaders.length).setValues(nuevosArt);
      res.articulosNuevos = nuevosArt.length;
    }

    // ---- 3) PRECIOS (clave artículo|proveedor; idempotente) ----
    var preSh = getSheet(SHEETS.PRECIOS_COMPRA);
    var preData = preSh.getDataRange().getValues();
    var PH = preData[0];
    var pcol = {}; PH.forEach(function(h, i){ pcol[h] = i; });
    var existePrecio = {}; // "idArt|idProv" -> fila (1-indexed)
    for (var i = 1; i < preData.length; i++) {
      var key = String(preData[i][pcol['ID_Articulo']]) + '|' + String(preData[i][pcol['ID_Proveedor']]);
      existePrecio[key] = i + 1;
    }
    var nuevosPre = [];
    (d.precios || []).forEach(function(pr){
      var idArt = artPorNombre[normNombre_(pr.articulo)];
      var idProv = provPorNombre[normNombre_(pr.proveedor)];
      if (!idArt || !idProv) return;
      var key = idArt + '|' + idProv;
      if (existePrecio[key]) {
        // Actualizar precio/descuento de la fila existente
        preSh.getRange(existePrecio[key], pcol['Precio'] + 1).setValue(num_(pr.precio));
        preSh.getRange(existePrecio[key], pcol['Descuento'] + 1).setValue(num_(pr.descuento));
        preSh.getRange(existePrecio[key], pcol['Fecha_Actualizacion'] + 1).setValue(hoy);
        res.preciosActualizados++;
        return;
      }
      var obj = {
        'ID_Precio': 'PR-' + idArt + '-' + idProv,
        'ID_Articulo': idArt, 'Nombre_Articulo': pr.articulo,
        'ID_Proveedor': idProv, 'Nombre_Proveedor': pr.proveedor,
        'Precio': num_(pr.precio), 'Descuento': num_(pr.descuento),
        'Moneda': 'MXN', 'Fecha_Actualizacion': hoy
      };
      existePrecio[key] = -1; // marcar para no duplicar dentro del mismo lote
      nuevosPre.push(PH.map(function(h){ return obj.hasOwnProperty(h) ? obj[h] : ''; }));
    });
    if (nuevosPre.length) {
      preSh.getRange(preSh.getLastRow() + 1, 1, nuevosPre.length, PH.length).setValues(nuevosPre);
      res.preciosNuevos = nuevosPre.length;
    }

    return res;
  } finally {
    lock.releaseLock();
  }
}

function ocRound_(n) { return Math.round((num_(n) + Number.EPSILON) * 100) / 100; }

// ---------- PROVEEDORES ----------

function getProveedores() {
  ensureComprasSheets_();
  var data = sheetToObjects(SHEETS.PROVEEDORES)
    .filter(function(p){ return esActivo(p.Activo); })
    .map(function(p){
      return {
        idProveedor: p.ID_Proveedor,
        nombre: p.Nombre,
        rfc: p.RFC,
        direccion: p.Direccion,
        ciudad: p.Ciudad,
        telefono: p.Telefono,
        email: p.Email,
        condicionesPago: p.Condiciones_Pago,
        notas: p.Notas
      };
    });
  data.sort(function(a, b){ return String(a.nombre||'').localeCompare(String(b.nombre||'')); });
  return { ok: true, data: data };
}

function altaProveedor(d) {
  if (!tienePermiso(d.rolUsuario, 'alta_proveedor')) {
    return errorSinPermiso(d.rolUsuario, 'alta_proveedor');
  }
  if (!d.nombre || !String(d.nombre).trim()) return { ok: false, error: 'El nombre del proveedor es obligatorio' };
  ensureComprasSheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var rows = sheetToObjects(SHEETS.PROVEEDORES);
    var num = 0;
    rows.forEach(function(p){
      var m = String(p.ID_Proveedor || '').match(/^PROV-?(\d+)$/);
      if (m) num = Math.max(num, parseInt(m[1], 10) || 0);
    });
    var id = 'PROV-' + String(num + 1).padStart(3, '0');
    appendRowByHeader(SHEETS.PROVEEDORES, {
      'ID_Proveedor': id,
      'Nombre': String(d.nombre).trim(),
      'RFC': d.rfc || '',
      'Direccion': d.direccion || '',
      'Ciudad': d.ciudad || '',
      'Telefono': d.telefono || '',
      'Email': d.email || '',
      'Condiciones_Pago': d.condicionesPago || '',
      'Activo': 'SI',
      'Notas': d.notas || '',
      'Capturado_Por': d.capturadoPor || '',
      'Timestamp_Captura': nowTs()
    });
    return { ok: true, idProveedor: id };
  } finally {
    lock.releaseLock();
  }
}

function editarProveedor(d) {
  if (!tienePermiso(d.rolUsuario, 'editar_proveedor')) {
    return errorSinPermiso(d.rolUsuario, 'editar_proveedor');
  }
  if (!d.idProveedor) return { ok: false, error: 'Proveedor requerido' };
  var sh = getSheet(SHEETS.PROVEEDORES);
  var data = sh.getDataRange().getValues();
  var H = data[0];
  var col = {};
  H.forEach(function(h, i){ col[h] = i; });
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col['ID_Proveedor']]) === String(d.idProveedor)) {
      var campos = { 'Nombre': d.nombre, 'RFC': d.rfc, 'Direccion': d.direccion, 'Ciudad': d.ciudad,
        'Telefono': d.telefono, 'Email': d.email, 'Condiciones_Pago': d.condicionesPago, 'Notas': d.notas };
      if (d.activo != null) campos['Activo'] = d.activo;
      Object.keys(campos).forEach(function(k){
        if (campos[k] != null && col[k] != null) sh.getRange(i + 1, col[k] + 1).setValue(campos[k]);
      });
      return { ok: true };
    }
  }
  return { ok: false, error: 'Proveedor no encontrado' };
}

// ---------- ÓRDENES DE COMPRA ----------

/** Siguiente folio de OC. Usa el contador CONFIG UltimoFolioOC (prefijo PrefijoOC, default 'OC'). */
function nextFolioOC_() {
  var prefijo = getConfig('PrefijoOC');
  if (prefijo == null || prefijo === '') prefijo = 'OC';
  var ultimo = parseInt(getConfig('UltimoFolioOC'), 10);
  if (isNaN(ultimo)) {
    // Sembrar desde las OC existentes si el contador no está configurado
    ultimo = 0;
    sheetToObjects(SHEETS.ORDENES_COMPRA).forEach(function(o){
      var m = String(o.Folio_OC || '').match(/(\d+)\s*$/);
      if (m) ultimo = Math.max(ultimo, parseInt(m[1], 10) || 0);
    });
  }
  var nuevo = ultimo + 1;
  setConfig('UltimoFolioOC', nuevo);
  return prefijo + nuevo;
}

/** Calcula importe de una partida: cantidad*precio - descuento. */
function ocImportePartida_(it) {
  var bruto = num_(it.cantidad) * num_(it.precioUnitario);
  return ocRound_(bruto - num_(it.descuento));
}

/**
 * Lista de órdenes de compra (encabezados). Filtros opcionales por
 * estado y rango de fechas.
 */
function getOrdenesCompra(estado, desde, hasta) {
  ensureComprasSheets_();
  var rows = sheetToObjects(SHEETS.ORDENES_COMPRA);
  var data = rows.map(function(o){
    return {
      folioOC: o.Folio_OC,
      fecha: dateOnly(o.Fecha),
      idProveedor: o.ID_Proveedor,
      nombreProveedor: o.Nombre_Proveedor,
      condiciones: o.Condiciones,
      fechaEntrega: dateOnly(o.Fecha_Entrega),
      estado: o.Estado,
      subtotal: num_(o.Subtotal),
      iva: num_(o.IVA),
      total: num_(o.Total),
      creadoPor: o.Creado_Por,
      timestampCreacion: o.Timestamp_Creacion
    };
  });
  if (estado && estado !== 'TODAS') data = data.filter(function(o){ return o.estado === estado; });
  if (desde) data = data.filter(function(o){ return String(o.fecha) >= desde; });
  if (hasta) data = data.filter(function(o){ return String(o.fecha) <= hasta; });
  data.sort(function(a, b){ return String(b.folioOC||'').localeCompare(String(a.folioOC||'')); });
  return { ok: true, data: data };
}

/** Detalle de una OC: encabezado + partidas. */
function getOrdenCompra(folioOC) {
  if (!folioOC) return { ok: false, error: 'Folio requerido' };
  ensureComprasSheets_();
  var oc = sheetToObjects(SHEETS.ORDENES_COMPRA).filter(function(o){ return String(o.Folio_OC) === String(folioOC); })[0];
  if (!oc) return { ok: false, error: 'OC no encontrada: ' + folioOC };
  var items = sheetToObjects(SHEETS.OC_ITEMS)
    .filter(function(it){ return String(it.Folio_OC) === String(folioOC); })
    .map(function(it){
      return {
        idOCItem: it.ID_OC_Item,
        idArticulo: it.ID_Articulo,
        codigo: it.Codigo,
        descripcion: it.Descripcion,
        unidad: it.Unidad,
        cantidad: num_(it.Cantidad),
        precioUnitario: num_(it.Precio_Unitario),
        descuento: num_(it.Descuento),
        importe: num_(it.Importe),
        cantidadRecibida: num_(it.Cantidad_Recibida),
        estadoItem: it.Estado_Item
      };
    });
  return { ok: true, data: {
    folioOC: oc.Folio_OC,
    fecha: dateOnly(oc.Fecha),
    idProveedor: oc.ID_Proveedor,
    nombreProveedor: oc.Nombre_Proveedor,
    condiciones: oc.Condiciones,
    viaEmbarque: oc.Via_Embarque,
    fechaEntrega: dateOnly(oc.Fecha_Entrega),
    estado: oc.Estado,
    subtotal: num_(oc.Subtotal),
    iva: num_(oc.IVA),
    total: num_(oc.Total),
    moneda: oc.Moneda || 'MXN',
    observaciones: oc.Observaciones,
    creadoPor: oc.Creado_Por,
    recibidoPor: oc.Recibido_Por,
    items: items
  } };
}

/**
 * Crea una orden de compra (encabezado + partidas) en estado BORRADOR.
 * Requeridos: idProveedor (o nombreProveedor), items[].
 * Cada item: idArticulo, codigo, descripcion, unidad, cantidad, precioUnitario, descuento.
 * Los totales (subtotal, IVA, total) se calculan en el servidor.
 */
function crearOrdenCompra(d) {
  if (!tienePermiso(d.rolUsuario, 'crear_oc')) {
    return errorSinPermiso(d.rolUsuario, 'crear_oc');
  }
  var items = d.items || [];
  if (!items.length) return { ok: false, error: 'La orden debe tener al menos una partida' };
  if (!d.idProveedor && !d.nombreProveedor) return { ok: false, error: 'El proveedor es obligatorio' };

  ensureComprasSheets_();
  var prov = null;
  if (d.idProveedor) {
    prov = sheetToObjects(SHEETS.PROVEEDORES).filter(function(p){ return String(p.ID_Proveedor) === String(d.idProveedor); })[0];
  }
  var nombreProv = d.nombreProveedor || (prov ? prov.Nombre : '');

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var folioOC = d.folioOC && String(d.folioOC).trim() ? String(d.folioOC).trim() : nextFolioOC_();
    var subtotal = 0;
    items.forEach(function(it){ subtotal += ocImportePartida_(it); });
    subtotal = ocRound_(subtotal);
    var aplicaIVA = (d.aplicaIVA === false) ? false : true;
    var iva = aplicaIVA ? ocRound_(subtotal * OC_IVA_TASA) : 0;
    var total = ocRound_(subtotal + iva);

    appendRowByHeader(SHEETS.ORDENES_COMPRA, {
      'Folio_OC': folioOC,
      'Fecha': d.fecha || todayStr(),
      'ID_Proveedor': d.idProveedor || '',
      'Nombre_Proveedor': nombreProv,
      'Condiciones': d.condiciones || (prov ? prov.Condiciones_Pago : '') || '',
      'Via_Embarque': d.viaEmbarque || '',
      'Fecha_Entrega': d.fechaEntrega || '',
      'Estado': 'BORRADOR',
      'Subtotal': subtotal,
      'IVA': iva,
      'Total': total,
      'Moneda': d.moneda || 'MXN',
      'Observaciones': d.observaciones || '',
      'Creado_Por': d.capturadoPor || '',
      'Timestamp_Creacion': nowTs(),
      'Recibido_Por': '',
      'Timestamp_Recepcion': ''
    });

    items.forEach(function(it, idx){
      appendRowByHeader(SHEETS.OC_ITEMS, {
        'ID_OC_Item': folioOC + '-' + String(idx + 1).padStart(3, '0'),
        'Folio_OC': folioOC,
        'ID_Articulo': it.idArticulo || '',
        'Codigo': it.codigo || '',
        'Descripcion': it.descripcion || '',
        'Unidad': it.unidad || '',
        'Cantidad': num_(it.cantidad),
        'Precio_Unitario': num_(it.precioUnitario),
        'Descuento': num_(it.descuento),
        'Importe': ocImportePartida_(it),
        'Cantidad_Recibida': 0,
        'Estado_Item': 'PENDIENTE'
      });
    });

    return { ok: true, folioOC: folioOC, subtotal: subtotal, iva: iva, total: total };
  } finally {
    lock.releaseLock();
  }
}

/** Helper interno: fija campos del encabezado de una OC por folio. */
function setOCCampos_(folioOC, campos) {
  var sh = getSheet(SHEETS.ORDENES_COMPRA);
  var data = sh.getDataRange().getValues();
  var H = data[0];
  var col = {};
  H.forEach(function(h, i){ col[h] = i; });
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col['Folio_OC']]) === String(folioOC)) {
      Object.keys(campos).forEach(function(k){
        if (col[k] != null) sh.getRange(i + 1, col[k] + 1).setValue(campos[k]);
      });
      return true;
    }
  }
  return false;
}

/** Cambia el estado de una OC (enviar / cancelar). */
function cambiarEstadoOC(d) {
  var destino = String(d.estado || '').toUpperCase();
  var accion = destino === 'CANCELADA' ? 'cancelar_oc' : 'enviar_oc';
  if (!tienePermiso(d.rolUsuario, accion)) return errorSinPermiso(d.rolUsuario, accion);
  if (!d.folioOC) return { ok: false, error: 'Folio requerido' };
  var oc = getOrdenCompra(d.folioOC);
  if (!oc.ok) return oc;
  var actual = oc.data.estado;
  if (actual === 'RECIBIDA' || actual === 'CANCELADA') {
    return { ok: false, error: 'La OC ya está ' + actual + ' y no se puede cambiar' };
  }
  if (!setOCCampos_(d.folioOC, { 'Estado': destino })) return { ok: false, error: 'OC no encontrada' };
  return { ok: true, estado: destino };
}

/**
 * Recibe partidas de una OC y genera las entradas a inventario.
 * d.items: [{ idOCItem, cantidadRecibida, loteFabricante, fechaCaducidad, folioReceta }]
 * Valida lote/caducidad/receta por categoría antes de escribir nada.
 * Recalcula el estado de la OC (RECIBIDA_PARCIAL / RECIBIDA).
 */
/** Registra un nuevo precio de compra (historial). El más reciente define el costo. */
function registrarPrecioCompra_(idArticulo, nombreArticulo, idProveedor, nombreProveedor, precio) {
  if (!idArticulo || !(num_(precio) > 0)) return;
  ensureComprasSheets_();
  var num = 0;
  sheetToObjects(SHEETS.PRECIOS_COMPRA).forEach(function (p) {
    var m = String(p.ID_Precio || '').match(/^PRC-?(\d+)$/);
    if (m) num = Math.max(num, parseInt(m[1], 10) || 0);
  });
  appendRowByHeader(SHEETS.PRECIOS_COMPRA, {
    'ID_Precio': 'PRC-' + String(num + 1).padStart(4, '0'),
    'ID_Articulo': idArticulo, 'Nombre_Articulo': nombreArticulo || '',
    'ID_Proveedor': idProveedor || '', 'Nombre_Proveedor': nombreProveedor || '',
    'Precio': num_(precio), 'Descuento': 0, 'Moneda': 'MXN',
    'Fecha_Actualizacion': todayStr()
  });
}

/** Recalcula Subtotal/IVA/Total de una OC desde sus partidas. */
function recalcularTotalesOC_(folioOC) {
  var subtotal = 0;
  sheetToObjects(SHEETS.OC_ITEMS).forEach(function (it) {
    if (String(it.Folio_OC) === String(folioOC)) subtotal += num_(it.Importe);
  });
  subtotal = ocRound_(subtotal);
  var iva = ocRound_(subtotal * OC_IVA_TASA);
  setOCCampos_(folioOC, { 'Subtotal': subtotal, 'IVA': iva, 'Total': ocRound_(subtotal + iva) });
}

function recibirOrdenCompra(d) {
  if (!tienePermiso(d.rolUsuario, 'recibir_oc')) {
    return errorSinPermiso(d.rolUsuario, 'recibir_oc');
  }
  if (!d.folioOC) return { ok: false, error: 'Folio requerido' };
  var recibos = (d.items || []).filter(function(r){ return num_(r.cantidadRecibida) > 0; });
  if (!recibos.length) return { ok: false, error: 'No hay cantidades a recibir' };

  var ocSh = getSheet(SHEETS.ORDENES_COMPRA);
  var oc = sheetToObjects(SHEETS.ORDENES_COMPRA).filter(function(o){ return String(o.Folio_OC) === String(d.folioOC); })[0];
  if (!oc) return { ok: false, error: 'OC no encontrada: ' + d.folioOC };
  if (oc.Estado === 'CANCELADA' || oc.Estado === 'RECIBIDA') {
    return { ok: false, error: 'La OC está ' + oc.Estado + ' y no admite recepciones' };
  }

  var itemsOC = sheetToObjects(SHEETS.OC_ITEMS).filter(function(it){ return String(it.Folio_OC) === String(d.folioOC); });
  var itemPorId = {};
  itemsOC.forEach(function(it){ itemPorId[String(it.ID_OC_Item)] = it; });

  // 1) Validación previa (sin escribir): artículo existe y cumple requisitos de categoría
  var preparados = [];
  for (var i = 0; i < recibos.length; i++) {
    var r = recibos[i];
    var itOC = itemPorId[String(r.idOCItem)];
    if (!itOC) return { ok: false, error: 'Partida no encontrada en la OC: ' + r.idOCItem };
    // El proveedor puede mandar OTRO producto: se permite sustituir el artículo de la partida.
    var idArt = (r.idArticulo && String(r.idArticulo).trim()) ? String(r.idArticulo).trim() : String(itOC.ID_Articulo || '').trim();
    if (!idArt) return { ok: false, error: 'Selecciona el artículo recibido en la partida "' + (itOC.Descripcion || r.idOCItem) + '"' };
    var art = getArticuloRaw_(idArt);
    if (!art) return { ok: false, error: 'Artículo no encontrado: ' + idArt };
    var cant = num_(r.cantidadRecibida);
    // Se permite recibir de MÁS o de MENOS de lo pedido (el proveedor cambia cantidades).
    var entradaData = {
      idArticulo: idArt,
      cantidad: cant,
      unidad: art.Unidad || itOC.Unidad,
      loteFabricante: r.loteFabricante || '',
      fechaCaducidad: r.fechaCaducidad || '',
      folioReceta: r.folioReceta || '',
      proveedor: oc.Nombre_Proveedor || '',
      referencia: 'OC ' + d.folioOC,
      observaciones: r.observaciones || '',
      capturadoPor: d.capturadoPor || '',
      fecha: d.fecha || todayStr()
    };
    var verr = validarRequisitosEntrada_(art, entradaData);
    if (verr) return verr;
    var cambioArt = (String(idArt) !== String(itOC.ID_Articulo || ''));
    preparados.push({
      art: art, cant: cant, entradaData: entradaData, itOC: itOC,
      precioUnitario: (r.precioUnitario != null && r.precioUnitario !== '') ? num_(r.precioUnitario) : null,
      codigoBarras: (r.codigoBarras != null) ? String(r.codigoBarras).trim() : '',
      nuevoArticulo: cambioArt ? { idArticulo: idArt, codigo: art.Codigo || idArt, descripcion: art.Nombre || '', unidad: art.Unidad || '' } : null
    });
  }

  // 2) Escritura bajo lock (entradas + actualización de partidas)
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var entradas = 0, avisos = [];
    preparados.forEach(function(p, idx){
      p.entradaData._seq = idx; // sufijo único para IDs de lote/movimiento en lote
      entradaArticuloEscribir_(p.art, p.cant, p.entradaData);
      entradas++;
      // Agregar el código de barras al artículo recibido (etiquetado con el proveedor de la OC)
      if (p.codigoBarras) {
        var rb = agregarCodigoBarras_(p.entradaData.idArticulo, p.codigoBarras, oc.Nombre_Proveedor || '', d.capturadoPor || '');
        if (rb && !rb.ok) avisos.push(rb.error);
      }
    });

    // Actualizar Cantidad_Recibida / Estado_Item por partida
    var itSh = getSheet(SHEETS.OC_ITEMS);
    var itData = itSh.getDataRange().getValues();
    var IH = itData[0];
    var icol = {};
    IH.forEach(function(h, i){ icol[h] = i; });
    var recibidoPorId = {}, precioPorId = {}, nuevoArtPorId = {};
    preparados.forEach(function(p){
      recibidoPorId[String(p.itOC.ID_OC_Item)] = p.cant;
      if (p.precioUnitario != null && p.precioUnitario > 0) precioPorId[String(p.itOC.ID_OC_Item)] = p.precioUnitario;
      if (p.nuevoArticulo) nuevoArtPorId[String(p.itOC.ID_OC_Item)] = p.nuevoArticulo;
    });

    var todoCompleto = true, precioCambio = false;
    for (var i = 1; i < itData.length; i++) {
      if (String(itData[i][icol['Folio_OC']]) !== String(d.folioOC)) continue;
      var idIt = String(itData[i][icol['ID_OC_Item']]);
      var pedido = num_(itData[i][icol['Cantidad']]);
      var prev = num_(itData[i][icol['Cantidad_Recibida']]);
      var add = num_(recibidoPorId[idIt]);
      var nuevo = prev + add;
      if (add > 0) {
        itSh.getRange(i + 1, icol['Cantidad_Recibida'] + 1).setValue(nuevo);
        itSh.getRange(i + 1, icol['Estado_Item'] + 1).setValue(nuevo >= pedido - 0.0001 ? 'RECIBIDO' : 'PARCIAL');
        // Sustitución de artículo: el proveedor mandó otro producto -> actualizar la partida
        var artIdLinea = String(itData[i][icol['ID_Articulo']]);
        if (nuevoArtPorId.hasOwnProperty(idIt)) {
          var na = nuevoArtPorId[idIt];
          artIdLinea = na.idArticulo;
          if (icol['ID_Articulo'] != null) itSh.getRange(i + 1, icol['ID_Articulo'] + 1).setValue(na.idArticulo);
          if (icol['Codigo'] != null) itSh.getRange(i + 1, icol['Codigo'] + 1).setValue(na.codigo);
          if (icol['Descripcion'] != null) itSh.getRange(i + 1, icol['Descripcion'] + 1).setValue(na.descripcion);
          if (icol['Unidad'] != null) itSh.getRange(i + 1, icol['Unidad'] + 1).setValue(na.unidad);
        }
        // Precio ajustado en la recepción: actualiza la partida y registra el costo
        if (precioPorId.hasOwnProperty(idIt)) {
          var nuevoPrecio = precioPorId[idIt];
          var descLinea = (icol['Descuento'] != null) ? num_(itData[i][icol['Descuento']]) : 0;
          if (icol['Precio_Unitario'] != null) itSh.getRange(i + 1, icol['Precio_Unitario'] + 1).setValue(nuevoPrecio);
          if (icol['Importe'] != null) itSh.getRange(i + 1, icol['Importe'] + 1).setValue(ocImportePartida_({ cantidad: pedido, precioUnitario: nuevoPrecio, descuento: descLinea }));
          registrarPrecioCompra_(artIdLinea, (nuevoArtPorId[idIt] ? nuevoArtPorId[idIt].descripcion : String(itData[i][icol['Descripcion']])), oc.ID_Proveedor, oc.Nombre_Proveedor, nuevoPrecio);
          precioCambio = true;
        }
      }
      if (nuevo < pedido - 0.0001) todoCompleto = false;
    }

    var nuevoEstado = todoCompleto ? 'RECIBIDA' : 'RECIBIDA_PARCIAL';
    setOCCampos_(d.folioOC, {
      'Estado': nuevoEstado,
      'Recibido_Por': d.capturadoPor || '',
      'Timestamp_Recepcion': nowTs()
    });
    if (precioCambio) recalcularTotalesOC_(d.folioOC);

    return { ok: true, folioOC: d.folioOC, estado: nuevoEstado, entradas: entradas, avisos: avisos };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// DASHBOARD
// ============================================================

function getDashboard(horizonteDias) {
  horizonteDias = parseInt(horizonteDias, 10) || 7;
  var tz = getConfig('ZonaHoraria') || 'America/Chihuahua';

  function dStr(d) {
    if (!d) return '';
    if (d instanceof Date) return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    return String(d).substring(0, 10);
  }

  var hoy = todayStr();
  var hoyDate = new Date(hoy + 'T00:00:00');
  var manana = Utilities.formatDate(new Date(hoyDate.getTime() + 86400000), tz, 'yyyy-MM-dd');
  var horizonteFin = Utilities.formatDate(new Date(hoyDate.getTime() + horizonteDias * 86400000), tz, 'yyyy-MM-dd');

  var cirugias = sheetToObjects(SHEETS.CIRUGIAS);

  // Filtros temporales
  var cirugiasHoy = cirugias.filter(function(c){ return dStr(c.Fecha_Programada) === hoy && c.Estado !== 'CANCELADA'; });
  var cirugiasManana = cirugias.filter(function(c){ return dStr(c.Fecha_Programada) === manana && c.Estado !== 'CANCELADA'; });
  var cirugiasHorizonte = cirugias.filter(function(c){
    var f = dStr(c.Fecha_Programada);
    return f >= hoy && f <= horizonteFin && c.Estado !== 'CANCELADA';
  }).sort(function(a, b){ return dStr(a.Fecha_Programada).localeCompare(dStr(b.Fecha_Programada)); });

  // Pendientes: cirugías sin receta vinculada (estado PROGRAMADA)
  var sinReceta = cirugias.filter(function(c){
    var f = dStr(c.Fecha_Programada);
    return c.Estado === 'PROGRAMADA' && f >= hoy && f <= horizonteFin;
  });

  // Inventario en alerta
  var inv = getInventario().data;
  var alertas = inv.filter(function(i){ return i.alerta; });

  // Ocupación de habitaciones
  var ocupacion = calcularOcupacion();

  return {
    ok: true,
    horizonteDias: horizonteDias,
    fechas: { hoy: hoy, manana: manana, horizonteFin: horizonteFin },
    contadores: {
      cirugiasHoy: cirugiasHoy.length,
      cirugiasManana: cirugiasManana.length,
      cirugiasHorizonte: cirugiasHorizonte.length,
      sinReceta: sinReceta.length,
      alertasInventario: alertas.length,
      ocupacionTotal: ocupacion.total,
      ocupacionPorTipo: ocupacion.porTipo,
      alertasOcupacion: ocupacion.alertas
    },
    pendientes: {
      sinReceta: sinReceta.map(function(c){
        return {
          folio: c.Folio_Cirugia,
          fecha: dStr(c.Fecha_Programada),
          paciente: c.Nombre_Paciente,
          medico: c.Nombre_Medico,
          tipo: c.Tipo_Cirugia
        };
      }),
      inventario: alertas
    },
    cirugiasProximas: cirugiasHorizonte.map(function(c){
      return {
        folio: c.Folio_Cirugia,
        fecha: dStr(c.Fecha_Programada),
        hora: c.Hora_Programada,
        paciente: c.Nombre_Paciente,
        medico: c.Nombre_Medico,
        tipo: c.Tipo_Cirugia,
        estado: c.Estado,
        folioReceta: c.Folio_Receta_Asociada
      };
    })
  };
}

// ============================================================
// ALTAS DE CATÁLOGOS (desde el HTML)
// ============================================================

/**
 * Helper genérico: escribe una fila usando los nombres de columna como llaves.
 * Permite que el orden/cantidad de columnas pueda cambiar sin romper el código.
 */
function appendRowByHeader(sheetName, dataObj) {
  var sh = getSheet(sheetName);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var row = headers.map(function(h){
    if (dataObj.hasOwnProperty(h)) return dataObj[h];
    return '';
  });
  sh.appendRow(row);
  return sh.getLastRow();
}

/**
 * Garantiza que existan ciertos encabezados (en la fila 1) de una pestaña.
 * Los que falten se agregan al final. Útil para que appendRowByHeader nunca
 * descarte un valor por una columna que el usuario no haya creado todavía.
 */
function ensureHeaders_(sheetName, names) {
  var sh = getSheet(sheetName);
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  names.forEach(function(n){
    if (headers.indexOf(n) === -1) {
      sh.getRange(1, headers.length + 1).setValue(n);
      headers.push(n);
    }
  });
}

// ============================================================
// MÓDULO BOM — Hojas y encabezados
// ------------------------------------------------------------
// Ciclo de vida: SOLICITADO -> PROPUESTO -> AUTORIZADO -> ENTREGADO
// (RECHAZADO regresa a PROPUESTO). La entrega se habilita en cuanto
// el DIRECTOR_MEDICO autoriza. Una cirugía puede llevar 0, 1 o varios
// paquetes; cada renglón de BOM_Items guarda su Clave_Paquete origen
// (o 'MANUAL'). Si la cirugía va sin paquete, Comentario_Sin_Paquete
// es obligatorio.
// ============================================================
var PAQUETES_HEADERS = ['Clave_Paquete','Nombre_Paquete','Especialidad','Activo'];
var INSUMOS_HEADERS = ['Codigo','Descripcion','Unidad','Categoria','Activo'];
var BOM_PLANTILLA_HEADERS = ['Clave_Paquete','Tipo_Item','Codigo','Descripcion','Cantidad_S','Unidad','Orden','Activo'];
var BOM_CIRUGIA_HEADERS = ['ID_BOM','Folio_Cirugia','Paquetes','Comentario_Sin_Paquete','Estado_BOM',
  'Solicitado_Por','Solicitado_TS','Propuesto_Por','Propuesto_TS',
  'Autorizado_Por','Autorizado_TS','Motivo_Rechazo','Entregado_Por','Entregado_TS','Observaciones'];
var BOM_ITEMS_HEADERS = ['ID_BOM_Item','ID_BOM','Folio_Cirugia','Clave_Paquete','Tipo_Item','Codigo',
  'Descripcion','Cantidad_S','Cantidad_U','Cantidad_R','Unidad','Lote','Observaciones'];

/**
 * Crea una pestaña con sus encabezados si no existe; si ya existe,
 * garantiza que no falte ninguna columna (sin borrar las que haya).
 */
function ensureSheetConHeaders_(name, headers) {
  var sh = SS.getSheetByName(name);
  if (!sh) {
    sh = SS.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    ensureHeaders_(name, headers);
  }
  return sh;
}

/** Garantiza todas las hojas del módulo BOM (catálogos, plantilla e instancia). */
function ensureBOMSheets_() {
  ensureSheetConHeaders_(SHEETS.PAQUETES, PAQUETES_HEADERS);
  ensureSheetConHeaders_(SHEETS.INSUMOS, INSUMOS_HEADERS);
  ensureSheetConHeaders_(SHEETS.BOM_PLANTILLA, BOM_PLANTILLA_HEADERS);
  ensureSheetConHeaders_(SHEETS.BOM_CIRUGIA, BOM_CIRUGIA_HEADERS);
  ensureSheetConHeaders_(SHEETS.BOM_ITEMS, BOM_ITEMS_HEADERS);
}

function altaPaciente(d) {
  // Validación de permisos:
  // El alta de paciente se puede invocar desde DOS contextos distintos:
  //   1. Recepción (módulo de admisión) → acción "nuevo_paciente_recep"
  //   2. Directorio de pacientes (Pacientes) → acción "nuevo_paciente_dir"
  // Si NO se manda rolUsuario, es un llamado interno desde ingresarPaciente()
  // (ingresar a habitación sin paciente previo) y se permite.
  if (d.rolUsuario) {
    var accion = d.contexto === 'recepcion' ? 'nuevo_paciente_recep' : 'nuevo_paciente_dir';
    if (!tienePermiso(d.rolUsuario, accion)) {
      return errorSinPermiso(d.rolUsuario, accion);
    }
  }

  var sh = getSheet(SHEETS.PACIENTES);
  var data = sh.getDataRange().getValues();
  var num = 0;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).indexOf('PAC-') === 0) {
      var n = parseInt(String(data[i][0]).replace('PAC-', ''), 10);
      if (!isNaN(n)) num = Math.max(num, n);
    }
  }
  var id = 'PAC-' + String(num + 1).padStart(5, '0');

  // Validaciones suaves (no bloquean si vienen vacíos, pero validan formato si vienen)
  if (!d.nombre || !String(d.nombre).trim()) {
    return { ok: false, error: 'Nombre completo es obligatorio' };
  }
  // CURP obligatorio salvo en consulta externa (datos más simples) o
  // paciente extranjero (no cuenta con CURP).
  var exentoCurp = (d.origen === 'CONSULTA_EXTERNA') || esVerdadero(d.esExtranjero);
  if (!exentoCurp && (!d.curp || !String(d.curp).trim())) {
    return { ok: false, error: 'El CURP es obligatorio para dar de alta al paciente (o marca al paciente como extranjero)' };
  }
  if (d.curp && !validarCURP(d.curp)) {
    return { ok: false, error: 'CURP inválido (debe tener 18 caracteres alfanuméricos)' };
  }
  if (d.cp && !/^\d{5}$/.test(String(d.cp))) {
    return { ok: false, error: 'Código Postal debe ser de 5 dígitos' };
  }

  // Generar folio de recepción
  var prefijoRec = getConfig('FolioRecepcionPrefijo') || 'REC-2026-';
  var numRec = 0;
  for (var j = 1; j < data.length; j++) {
    var folioRec = String(data[j][1] || '');  // Columna B: Folio_Recepcion
    if (folioRec.indexOf(prefijoRec) === 0) {
      var n2 = parseInt(folioRec.replace(prefijoRec, ''), 10);
      if (!isNaN(n2)) numRec = Math.max(numRec, n2);
    }
  }
  var folioRecepcion = prefijoRec + String(numRec + 1).padStart(5, '0');

  appendRowByHeader(SHEETS.PACIENTES, {
    // Identificación
    'ID_Paciente': id,
    'Folio_Recepcion': folioRecepcion,
    'Fecha_Alta': todayStr(),
    'Estatus': 'Activo',
    'Fecha_Suspension': '',
    'Causa_Suspension': '',
    // General
    'Nombre_Completo': d.nombre || '',
    'Contacto_1': d.contacto1 || '',
    'Contacto_2': d.contacto2 || '',
    'Tipo_Cliente': d.tipoCliente || 'CLINICA ESTAR BIEN',
    'Vendedor_Medico': d.vendedorMedico || '',
    // Dirección
    'Domicilio': d.domicilio || '',
    'Calle': d.calle || '',
    'Numero_Exterior': d.numeroExterior || '',
    'Numero_Interior': d.numeroInterior || '',
    'Colonia': d.colonia || '',
    'Ciudad': d.ciudad || '',
    'Estado': d.estado || '',
    'CP': d.cp || '',
    'Telefono_1': d.telefono1 || d.telefono || '',
    'Telefono_2': d.telefono2 || '',
    'Email': d.email || '',
    // Datos particulares / clínicos
    'Fecha_Ingreso': d.fechaIngreso || todayStr(),
    'ID_Aseguradora': d.idAseguradora || '',
    'Nombre_Aseguradora': d.nombreAseguradora || '',
    'Numero_Poliza': d.numeroPoliza || '',
    'Caso': d.caso || '',
    'Servicio': d.servicio || 'PARTICULAR',
    'Habitacion_Asignada': d.habitacionAsignada || '',
    'Procedimiento_Inicial': d.procedimientoInicial || '',
    'Fecha_Nacimiento': d.fechaNacimiento || '',
    'Edad': d.edad || '',
    'Genero': d.genero || '',
    'Estado_Civil': d.estadoCivil || '',
    'Religion': d.religion || '',
    'Conyuge': d.conyuge || '',
    'Responsable': d.responsable || '',
    'Telefono_Responsable': d.telefonoResponsable || '',
    'CURP': (d.curp || '').toUpperCase(),
    'RFC': (d.rfc || '').toUpperCase(),
    'Alergias': d.alergias || '',
    'Medico_Tratante': d.medicoTratante || '',
    'Especialidad': d.especialidad || '',
    'Num_Meses_Caducidad_Min': d.numMesesCaducidadMin || 0,
    // Audit
    'Observaciones': d.observaciones || '',
    'Capturado_Por': d.capturadoPor || '',
    'Timestamp_Captura': nowTs(),
    'Actualizado_Por': '',
    'Timestamp_Actualizacion': ''
  });

  // Ocupación inmediata de habitación (Cambio 2):
  // Si recepción asignó una habitación (d.idHabitacion), se crea la
  // hospitalización ACTIVA en el momento del alta. Llamada INTERNA a
  // ingresarPaciente (sin rolUsuario) porque el permiso de recepción ya se validó.
  var hospResult = null;
  if (d.idHabitacion) {
    hospResult = ingresarPaciente({
      idHabitacion: d.idHabitacion,
      idPaciente: id,
      nombrePaciente: d.nombre || '',
      edadPaciente: d.edad || '',
      telefono: d.telefono1 || d.telefono || '',
      diagnostico: d.procedimientoInicial || d.caso || '',
      idDoctor: d.idMedicoTratante || '',
      nombreDoctor: d.medicoTratante || '',
      observaciones: d.observaciones || '',
      fechaIngreso: d.fechaIngreso || todayStr(),
      origen: 'RECEPCION'
      // sin rolUsuario → llamada interna permitida
    });
  }

  return { ok: true, idPaciente: id, folioRecepcion: folioRecepcion, hospitalizacion: hospResult };
}

/**
 * Cambia el campo Estatus de un paciente.
 * @param {string} idPaciente
 * @param {string} nuevoEstatus - ej. 'Activo', 'Atendido', 'Suspendido'
 * @return {boolean} true si se actualizó, false si no se encontró el paciente
 */
function marcarEstatusPaciente(idPaciente, nuevoEstatus) {
  if (!idPaciente) return false;
  var sh = getSheet(SHEETS.PACIENTES);
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var colEstatus = headers.indexOf('Estatus');
  if (colEstatus === -1) return false;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === idPaciente) {
      sh.getRange(i + 1, colEstatus + 1).setValue(nuevoEstatus);
      return true;
    }
  }
  return false;
}

/**
 * Cuenta el historial de un paciente en todas las pestañas relevantes.
 * Devuelve un objeto con los conteos y un total.
 */
function contarHistorialPaciente(idPaciente) {
  var cirugias = sheetToObjects(SHEETS.CIRUGIAS).filter(function(c){
    return c.ID_Paciente === idPaciente;
  }).length;

  var consumos = sheetToObjects(SHEETS.CONSUMOS).filter(function(c){
    return c.ID_Paciente === idPaciente;
  }).length;

  var hospitalizaciones = sheetToObjects(SHEETS.HOSPITALIZACIONES).filter(function(h){
    return h.ID_Paciente === idPaciente;
  }).length;

  var consultas = 0;
  try {
    consultas = sheetToObjects(SHEETS.CONSULTAS).filter(function(c){
      return c.ID_Paciente === idPaciente;
    }).length;
  } catch (e) {
    // La pestaña Consultas puede no existir aún; se ignora
    consultas = 0;
  }

  var total = cirugias + consumos + hospitalizaciones + consultas;
  return {
    cirugias: cirugias,
    consumos: consumos,
    hospitalizaciones: hospitalizaciones,
    consultas: consultas,
    total: total
  };
}

/**
 * Borra un paciente de la pestaña Pacientes.
 *
 * REGLAS DE PERMISOS:
 *  - Si el paciente NO tiene historial → ADMIN, JEFE_ENFERMERIA o RECEPCION pueden borrarlo.
 *  - Si el paciente SÍ tiene historial (cirugías, consumos, hospitalizaciones, consultas)
 *    → solo ADMIN puede borrarlo, y debe mandar d.forzar = true para confirmar.
 *
 * Datos: d.idPaciente, d.rolUsuario, d.forzar (opcional)
 */
function borrarPaciente(d) {
  if (!d.idPaciente) return { ok: false, error: 'idPaciente requerido' };
  var rol = d.rolUsuario;

  // Roles que pueden borrar (en general)
  var rolesPermitidos = ['ADMIN', 'JEFE_ENFERMERIA', 'RECEPCION'];
  if (rolesPermitidos.indexOf(rol) === -1) {
    return {
      ok: false,
      error: 'El rol ' + (rol || 'desconocido') + ' no tiene permiso para borrar pacientes.'
    };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // Verificar que el paciente existe y obtener su fila
    var sh = getSheet(SHEETS.PACIENTES);
    var data = sh.getDataRange().getValues();
    var rowIdx = -1;
    var nombrePaciente = '';
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === d.idPaciente) {
        rowIdx = i;
        nombrePaciente = data[i][6];  // Nombre_Completo
        break;
      }
    }
    if (rowIdx === -1) return { ok: false, error: 'Paciente no encontrado: ' + d.idPaciente };

    // Revisar historial
    var hist = contarHistorialPaciente(d.idPaciente);

    if (hist.total > 0) {
      // El paciente TIENE historial → solo ADMIN, y debe forzar
      if (rol !== 'ADMIN') {
        return {
          ok: false,
          error: 'Este paciente tiene historial cargado (' +
                 hist.cirugias + ' cirugías, ' + hist.consultas + ' consultas, ' +
                 hist.consumos + ' consumos, ' + hist.hospitalizaciones + ' hospitalizaciones). ' +
                 'Solo un ADMIN puede borrarlo. Considera suspenderlo en lugar de borrarlo.'
        };
      }
      // Es ADMIN pero no ha confirmado el forzado
      if (!d.forzar) {
        return {
          ok: false,
          requiereConfirmacion: true,
          historial: hist,
          error: 'ADVERTENCIA: este paciente tiene ' + hist.total + ' registros vinculados ' +
                 '(' + hist.cirugias + ' cirugías, ' + hist.consultas + ' consultas, ' +
                 hist.consumos + ' consumos, ' + hist.hospitalizaciones + ' hospitalizaciones). ' +
                 'Si lo borras, esos registros quedarán sin paciente asociado. ' +
                 'Confirma para proceder de todas formas.'
        };
      }
      // ADMIN confirmó: se procede aunque tenga historial
    }

    // Borrar la fila del paciente
    sh.deleteRow(rowIdx + 1);

    return {
      ok: true,
      idPaciente: d.idPaciente,
      nombrePaciente: nombrePaciente,
      teniaHistorial: hist.total > 0,
      historial: hist
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Actualiza datos del paciente. Cualquier campo que se mande, se actualiza;
 * los que no se manden, se conservan.
 */
function actualizarPaciente(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'editar_paciente')) {
    return errorSinPermiso(d.rolUsuario, 'editar_paciente');
  }
  if (!d.idPaciente) return { ok: false, error: 'idPaciente requerido' };

  // Validaciones suaves
  if (d.curp && !validarCURP(d.curp)) {
    return { ok: false, error: 'CURP inválido (debe tener 18 caracteres alfanuméricos)' };
  }
  if (d.cp && !/^\d{5}$/.test(String(d.cp))) {
    return { ok: false, error: 'Código Postal debe ser de 5 dígitos' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet(SHEETS.PACIENTES);
    var data = sh.getDataRange().getValues();
    var headers = data[0];

    // Mapa de nombre de campo del frontend → nombre de columna del Sheet
    var fieldMap = {
      // General
      'nombre': 'Nombre_Completo',
      'contacto1': 'Contacto_1',
      'contacto2': 'Contacto_2',
      'tipoCliente': 'Tipo_Cliente',
      'vendedorMedico': 'Vendedor_Medico',
      'estatus': 'Estatus',
      // Dirección
      'domicilio': 'Domicilio',
      'calle': 'Calle',
      'numeroExterior': 'Numero_Exterior',
      'numeroInterior': 'Numero_Interior',
      'colonia': 'Colonia',
      'ciudad': 'Ciudad',
      'estado': 'Estado',
      'cp': 'CP',
      'telefono1': 'Telefono_1',
      'telefono': 'Telefono_1',  // alias
      'telefono2': 'Telefono_2',
      'email': 'Email',
      // Datos particulares
      'fechaIngreso': 'Fecha_Ingreso',
      'idAseguradora': 'ID_Aseguradora',
      'nombreAseguradora': 'Nombre_Aseguradora',
      'numeroPoliza': 'Numero_Poliza',
      'caso': 'Caso',
      'servicio': 'Servicio',
      'habitacionAsignada': 'Habitacion_Asignada',
      'procedimientoInicial': 'Procedimiento_Inicial',
      'fechaNacimiento': 'Fecha_Nacimiento',
      'edad': 'Edad',
      'genero': 'Genero',
      'estadoCivil': 'Estado_Civil',
      'religion': 'Religion',
      'conyuge': 'Conyuge',
      'responsable': 'Responsable',
      'telefonoResponsable': 'Telefono_Responsable',
      'curp': 'CURP',
      'rfc': 'RFC',
      'alergias': 'Alergias',
      'medicoTratante': 'Medico_Tratante',
      'especialidad': 'Especialidad',
      'observaciones': 'Observaciones'
    };

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === d.idPaciente) {
        // También actualizar Nombre_Paciente en cirugías y hospitalizaciones si cambia el nombre
        var nombreAnterior = data[i][headers.indexOf('Nombre_Completo')];

        Object.keys(fieldMap).forEach(function(frontKey){
          if (d.hasOwnProperty(frontKey)) {
            var colIdx = headers.indexOf(fieldMap[frontKey]);
            if (colIdx !== -1) {
              var valor = d[frontKey];
              if (frontKey === 'curp' && valor) valor = String(valor).toUpperCase();
              if (frontKey === 'rfc' && valor) valor = String(valor).toUpperCase();
              sh.getRange(i + 1, colIdx + 1).setValue(valor);
            }
          }
        });

        // Audit trail: registrar quién actualizó y cuándo
        var colActualizadoPor = headers.indexOf('Actualizado_Por');
        var colTimestampAct = headers.indexOf('Timestamp_Actualizacion');
        if (colActualizadoPor !== -1 && d.actualizadoPor) {
          sh.getRange(i + 1, colActualizadoPor + 1).setValue(d.actualizadoPor);
        }
        if (colTimestampAct !== -1) {
          sh.getRange(i + 1, colTimestampAct + 1).setValue(nowTs());
        }

        // Si cambió el nombre, propagar a cirugías y hospitalizaciones activas
        if (d.hasOwnProperty('nombre') && d.nombre && d.nombre !== nombreAnterior) {
          propagarCambioNombrePaciente(d.idPaciente, d.nombre);
        }

        return {
          ok: true,
          idPaciente: d.idPaciente,
          mensaje: 'Paciente actualizado'
        };
      }
    }
    return { ok: false, error: 'Paciente no encontrado' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cuando se actualiza el nombre de un paciente, propaga el cambio a cirugías
 * y hospitalizaciones activas para que sigan reflejando el nombre correcto.
 */
function propagarCambioNombrePaciente(idPaciente, nuevoNombre) {
  // Cirugías
  var shCx = getSheet(SHEETS.CIRUGIAS);
  var dataCx = shCx.getDataRange().getValues();
  var headersCx = dataCx[0];
  var colIdPacCx = headersCx.indexOf('ID_Paciente');
  var colNomPacCx = headersCx.indexOf('Nombre_Paciente');
  if (colIdPacCx !== -1 && colNomPacCx !== -1) {
    for (var i = 1; i < dataCx.length; i++) {
      if (dataCx[i][colIdPacCx] === idPaciente) {
        shCx.getRange(i + 1, colNomPacCx + 1).setValue(nuevoNombre);
      }
    }
  }

  // Hospitalizaciones activas
  var shHosp = getSheet(SHEETS.HOSPITALIZACIONES);
  var dataHosp = shHosp.getDataRange().getValues();
  var headersHosp = dataHosp[0];
  var colIdPacHosp = headersHosp.indexOf('ID_Paciente');
  var colNomPacHosp = headersHosp.indexOf('Nombre_Paciente');
  var colEstHosp = headersHosp.indexOf('Estado');
  if (colIdPacHosp !== -1 && colNomPacHosp !== -1) {
    for (var i = 1; i < dataHosp.length; i++) {
      if (dataHosp[i][colIdPacHosp] === idPaciente && dataHosp[i][colEstHosp] === 'ACTIVA') {
        shHosp.getRange(i + 1, colNomPacHosp + 1).setValue(nuevoNombre);
      }
    }
  }
}

/**
 * Devuelve lista de pacientes con todos sus datos. Soporta búsqueda por nombre o CURP.
 */
function getPacientes(busqueda) {
  var rows = sheetToObjects(SHEETS.PACIENTES);
  if (busqueda) {
    var q = String(busqueda).trim().toLowerCase();
    rows = rows.filter(function(p){
      return (String(p.Nombre_Completo||'').toLowerCase().indexOf(q) !== -1) ||
             (String(p.CURP||'').toLowerCase().indexOf(q) !== -1) ||
             (String(p.ID_Paciente||'').toLowerCase().indexOf(q) !== -1);
    });
  }
  return { ok: true, data: rows };
}

function getPaciente(idPaciente) {
  if (!idPaciente) return { ok: false, error: 'idPaciente requerido' };
  var rows = sheetToObjects(SHEETS.PACIENTES);
  var p = rows.filter(function(x){ return x.ID_Paciente === idPaciente; })[0];
  if (!p) return { ok: false, error: 'Paciente no encontrado' };
  return { ok: true, data: p };
}

/**
 * Validador de CURP: 18 caracteres alfanuméricos con formato CCCC######HCCCCCCCC#
 * Validación básica (no checa el dígito verificador completo).
 */
function validarCURP(curp) {
  if (!curp) return false;
  var s = String(curp).toUpperCase().trim();
  return /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(s);
}

function altaMedicamento(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'alta_medicamento')) {
    return errorSinPermiso(d.rolUsuario, 'alta_medicamento');
  }
  var sh = getSheet(SHEETS.MEDICAMENTOS);
  var data = sh.getDataRange().getValues();
  var num = 0;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).indexOf('MED-') === 0) {
      var n = parseInt(String(data[i][0]).replace('MED-', ''), 10);
      if (!isNaN(n)) num = Math.max(num, n);
    }
  }
  var id = 'MED-' + String(num + 1).padStart(3, '0');
  sh.appendRow([id, d.nombreComercial, d.sustanciaActiva, d.presentacion,
                d.concentracion, d.fraccion, d.unidad, d.stockMinimo || 5, 'SI', d.notas || '']);
  return { ok: true, idMedicamento: id };
}

function altaMedico(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'alta_medico')) {
    return errorSinPermiso(d.rolUsuario, 'alta_medico');
  }
  var sh = getSheet(SHEETS.MEDICOS);
  var data = sh.getDataRange().getValues();
  var num = 0;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).indexOf('MED-') === 0) {
      var n = parseInt(String(data[i][0]).replace('MED-', ''), 10);
      if (!isNaN(n)) num = Math.max(num, n);
    }
  }
  var id = 'MED-' + String(num + 1).padStart(3, '0');
  sh.appendRow([id, d.nombreCompleto, d.cedulaProfesional, d.especialidad,
                d.cedulaEspecialidad || '', d.telefono || '', 'SI']);
  return { ok: true, idMedico: id };
}

/**
 * Da de alta un MÉDICO DE CONSULTA EXTERNA en la hoja CAT_MedicosConsulta.
 * Es un catálogo independiente del de cirujanos (CAT_Medicos): aquí solo se
 * guardan los médicos que atienden consulta/urgencia, con nombre, título y
 * cédula. Se crea la hoja en el primer uso si aún no existe.
 *
 * Payload esperado: { nombreCompleto, titulo, cedulaProfesional, capturadoPor }
 * Respuesta: { ok, idMedicoConsulta, nombreCompleto, titulo, cedulaProfesional }
 * Permiso: alta_medico_consulta (incluye RECEPCION).
 */
function altaMedicoConsulta(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'alta_medico_consulta')) {
    return errorSinPermiso(d.rolUsuario, 'alta_medico_consulta');
  }

  var nombre = String(d.nombreCompleto || '').trim();
  if (!nombre) {
    return { ok: false, error: 'El nombre del médico de consulta es obligatorio.' };
  }
  var titulo = String(d.titulo || '').trim();
  var cedula = String(d.cedulaProfesional || '').trim();

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // Garantiza la hoja y sus encabezados antes de leer/escribir.
    ensureSheetConHeaders_(SHEETS.MEDICOS_CONSULTA, MEDICOS_CONSULTA_HEADERS);

    var sh = getSheet(SHEETS.MEDICOS_CONSULTA);
    var data = sh.getDataRange().getValues();

    // Generar ID consecutivo: MC-XXX
    var num = 0;
    for (var i = 1; i < data.length; i++) {
      var v = String(data[i][0] || '');
      if (v.indexOf('MC-') === 0) {
        var n = parseInt(v.replace('MC-', ''), 10);
        if (!isNaN(n)) num = Math.max(num, n);
      }
    }
    var id = 'MC-' + String(num + 1).padStart(3, '0');

    appendRowByHeader(SHEETS.MEDICOS_CONSULTA, {
      'ID_MedicoConsulta': id,
      'Nombre_Completo': nombre,
      'Titulo': titulo,
      'Cedula_Profesional': cedula,
      'Activo': 'SI',
      'Capturado_Por': d.capturadoPor || '',
      'Timestamp_Captura': nowTs()
    });

    return {
      ok: true,
      idMedicoConsulta: id,
      nombreCompleto: nombre,
      titulo: titulo,
      cedulaProfesional: cedula
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Da de alta una cirugía personalizada en CAT_Cirugias.
 * Genera ID_Cirugia_Tipo siguiente (CXT-XXXXX), conservando el catálogo CPT existente.
 */
function altaCirugiaTipo(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'alta_tipo_cirugia')) {
    return errorSinPermiso(d.rolUsuario, 'alta_tipo_cirugia');
  }
  if (!d.nombreCirugia || !String(d.nombreCirugia).trim()) {
    return { ok: false, error: 'El nombre de la cirugía es obligatorio' };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet(SHEETS.CIRUGIAS_TIPO);
    var dataRange = sh.getDataRange().getValues();
    var num = 0;
    for (var i = 1; i < dataRange.length; i++) {
      var v = String(dataRange[i][0] || '');
      if (v.indexOf('CXT-') === 0) {
        var n = parseInt(v.replace('CXT-', ''), 10);
        if (!isNaN(n)) num = Math.max(num, n);
      }
    }
    var id = 'CXT-' + String(num + 1).padStart(5, '0');
    appendRowByHeader(SHEETS.CIRUGIAS_TIPO, {
      'ID_Cirugia_Tipo': id,
      'Clave_CPT': d.claveCPT || '',
      'Nombre_Cirugia': String(d.nombreCirugia).trim(),
      'Sistema': d.sistema || '',
      'Sub_sistema': d.subSistema || '',
      'Tipo_Procedimiento': d.tipoProcedimiento || '',
      'Categoria': d.categoria || '',
      'Duracion_Estimada_Min': d.duracionEstimada || '',
      'Medicamentos_Tipicos': d.medicamentosTipicos || '',
      'Activo': 'SI'
    });
    return { ok: true, idCirugiaTipo: id, nombreCirugia: d.nombreCirugia };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// HABITACIONES — módulo de gestión de hospitalizaciones
// ============================================================

/**
 * Devuelve el tablero completo: todas las habitaciones del catálogo + el paciente
 * actualmente ocupando cada una (si la hay), y una bandera de disponibilidad.
 */
function getTableroHabitaciones() {
  var habs = sheetToObjects(SHEETS.HABITACIONES).filter(function(h){return esActivo(h.Activo);});
  var hosp = sheetToObjects(SHEETS.HOSPITALIZACIONES).filter(function(h){return h.Estado==='ACTIVA';});

  // Índice de pacientes VIVO (fuente de verdad): para reflejar al instante
  // cualquier edición del paciente en el tablero, sin depender del snapshot
  // que se guardó al ingresar.
  var pacIndex = {};
  sheetToObjects(SHEETS.PACIENTES).forEach(function(p){ pacIndex[String(p.ID_Paciente)] = p; });

  // Mapa idHabitacion -> hospitalizacion activa
  var ocupadas = {};
  hosp.forEach(function(h){
    if (h.ID_Habitacion) ocupadas[h.ID_Habitacion] = h;
  });

  var resultado = habs.map(function(h){
    var ocup = ocupadas[h.ID_Habitacion];
    var pac = (ocup && pacIndex[String(ocup.ID_Paciente)]) ? pacIndex[String(ocup.ID_Paciente)] : {};
    return {
      idHabitacion: h.ID_Habitacion,
      numero: h.Numero,
      tipo: h.Tipo,
      colorHex: h.Color_Hex,
      ocupada: !!ocup,
      hospitalizacion: ocup ? {
        id: ocup.ID_Hospitalizacion,
        idPaciente: ocup.ID_Paciente,
        nombrePaciente: pac.Nombre_Completo || ocup.Nombre_Paciente,
        edadPaciente: (pac.Edad !== undefined && pac.Edad !== '') ? pac.Edad : ocup.Edad_Paciente,
        telefono: pac.Telefono_1 || ocup.Telefono_Paciente,
        diagnostico: pac.Procedimiento_Inicial || ocup.Diagnostico,
        nombreDoctor: pac.Medico_Tratante || ocup.Nombre_Doctor,
        fechaIngreso: dateOnly(ocup.Fecha_Ingreso),
        horaIngreso: timeOnly(ocup.Hora_Ingreso),
        observaciones: ocup.Observaciones,
        folioCirugiaRelacionada: ocup.Folio_Cirugia_Relacionada,
        diasEstancia: calcularDiasEstancia(ocup.Fecha_Ingreso)
      } : null
    };
  });

// Agrupar por tipo
  var porTipo = { PRIVADA: [], SALA_GENERAL: [], URGENCIAS: [], TERAPIA_INTENSIVA: [] };
  resultado.forEach(function(r){
    if (porTipo[r.tipo]) porTipo[r.tipo].push(r);
  });
  // Ordenar por número dentro de cada tipo
  Object.keys(porTipo).forEach(function(k){
    porTipo[k].sort(function(a, b){ return parseInt(a.numero, 10) - parseInt(b.numero, 10); });
  });

  return {
    ok: true,
    habitaciones: resultado,
    porTipo: porTipo,
    ocupacion: calcularOcupacion()
  };
}

/**
 * Ocupación de habitaciones para una FECHA (reporte).
 *  - Si la fecha es hoy o futura → estado actual (hospitalizaciones ACTIVA).
 *  - Si es una fecha pasada → reconstruye quién estaba internado ese día
 *    (Ingreso ≤ fecha y sin egreso o egreso ≥ fecha). El cuarto es el
 *    registrado en la hospitalización (aproximado si hubo cambios de cama).
 */
function getOcupacionEnFecha(fecha) {
  var hoy = todayStr();
  var D = (fecha && String(fecha).trim()) ? String(fecha).substring(0, 10) : hoy;
  var esHoy = (D >= hoy);

  var habs = sheetToObjects(SHEETS.HABITACIONES).filter(function(h){ return esActivo(h.Activo); });
  var hospAll = sheetToObjects(SHEETS.HOSPITALIZACIONES);
  var pacIndex = {};
  sheetToObjects(SHEETS.PACIENTES).forEach(function(p){ pacIndex[String(p.ID_Paciente)] = p; });

  // Hospitalización que ocupaba cada habitación en la fecha D
  var ocupadas = {};
  hospAll.forEach(function(h){
    var ingreso = dateOnly(h.Fecha_Ingreso);
    if (!ingreso || ingreso > D) return;
    var ocupa;
    if (esHoy) {
      ocupa = (h.Estado === 'ACTIVA');
    } else {
      var egreso = dateOnly(h.Fecha_Egreso);
      ocupa = egreso ? (egreso >= D) : true; // sin egreso = seguía internado
    }
    if (!ocupa || !h.ID_Habitacion) return;
    var prev = ocupadas[h.ID_Habitacion];
    if (!prev || dateOnly(prev.Fecha_Ingreso) <= ingreso) ocupadas[h.ID_Habitacion] = h;
  });

  function diasEntre(ing, hasta) {
    if (!ing) return 0;
    var a = new Date(ing + 'T00:00:00'), b = new Date(hasta + 'T00:00:00');
    return Math.max(0, Math.floor((b - a) / 86400000));
  }

  var GRUPOS = [
    { tipo: 'PRIVADA', label: 'Habitaciones Privadas' },
    { tipo: 'SALA_GENERAL', label: 'Sala General' },
    { tipo: 'URGENCIAS', label: 'Urgencias' },
    { tipo: 'TERAPIA_INTENSIVA', label: 'Terapia Intensiva' }
  ];

  var totalOcup = 0;
  var grupos = GRUPOS.map(function(g){
    var ocupCount = 0;
    var rooms = habs.filter(function(h){ return h.Tipo === g.tipo; })
      .sort(function(a, b){ return parseInt(a.Numero, 10) - parseInt(b.Numero, 10); })
      .map(function(h){
        var ocup = ocupadas[h.ID_Habitacion];
        if (ocup) ocupCount++;
        var pac = (ocup && pacIndex[String(ocup.ID_Paciente)]) ? pacIndex[String(ocup.ID_Paciente)] : {};
        return {
          numero: h.Numero,
          ocupada: !!ocup,
          paciente: ocup ? (pac.Nombre_Completo || ocup.Nombre_Paciente || '') : '',
          edad: ocup ? ((pac.Edad !== undefined && pac.Edad !== '') ? pac.Edad : ocup.Edad_Paciente) : '',
          procedimiento: ocup ? (pac.Procedimiento_Inicial || ocup.Diagnostico || '') : '',
          doctor: ocup ? (pac.Medico_Tratante || ocup.Nombre_Doctor || '') : '',
          fechaIngreso: ocup ? dateOnly(ocup.Fecha_Ingreso) : '',
          dias: ocup ? diasEntre(dateOnly(ocup.Fecha_Ingreso), D) : ''
        };
      });
    totalOcup += ocupCount;
    return { tipo: g.tipo, label: g.label, total: rooms.length, ocupadas: ocupCount, habitaciones: rooms };
  });

  return {
    ok: true,
    fecha: D,
    esHoy: esHoy,
    totalOcupadas: totalOcup,
    totalHabitaciones: habs.length,
    grupos: grupos
  };
}

function dateOnly(v) {
  if (!v) return '';
  if (v instanceof Date) {
    var tz = getConfig('ZonaHoraria') || 'America/Chihuahua';
    return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  }
  return String(v).substring(0, 10);
}

function timeOnly(v) {
  if (!v) return '';
  if (v instanceof Date) {
    var tz = getConfig('ZonaHoraria') || 'America/Chihuahua';
    return Utilities.formatDate(v, tz, 'HH:mm');
  }
  return String(v).replace(/^'/, '').substring(0, 5);
}

function calcularDiasEstancia(fechaIngreso) {
  if (!fechaIngreso) return 0;
  var f = fechaIngreso instanceof Date ? fechaIngreso : new Date(String(fechaIngreso).substring(0, 10) + 'T00:00:00');
  var hoy = new Date();
  hoy.setHours(0,0,0,0);
  f.setHours(0,0,0,0);
  var dias = Math.floor((hoy - f) / 86400000);
  return Math.max(0, dias);
}

function calcularOcupacion() {
  var habs = sheetToObjects(SHEETS.HABITACIONES).filter(function(h){return esActivo(h.Activo);});
  var hosp = sheetToObjects(SHEETS.HOSPITALIZACIONES).filter(function(h){return h.Estado==='ACTIVA';});

  var totalPorTipo = { PRIVADA: 0, SALA_GENERAL: 0, URGENCIAS: 0, TERAPIA_INTENSIVA: 0 };
  habs.forEach(function(h){ if (totalPorTipo[h.Tipo] !== undefined) totalPorTipo[h.Tipo]++; });

  var ocupPorTipo = { PRIVADA: 0, SALA_GENERAL: 0, URGENCIAS: 0, TERAPIA_INTENSIVA: 0 };
  hosp.forEach(function(h){ if (ocupPorTipo[h.Tipo_Habitacion] !== undefined) ocupPorTipo[h.Tipo_Habitacion]++; });

  var alertas = [];
  Object.keys(totalPorTipo).forEach(function(t){
    if (totalPorTipo[t] === 0) return;
    var pct = ocupPorTipo[t] / totalPorTipo[t];
    if (pct >= 0.8) {
      alertas.push({
        tipo: t,
        ocupadas: ocupPorTipo[t],
        total: totalPorTipo[t],
        porcentaje: Math.round(pct * 100)
      });
    }
  });

  return {
    total: { ocupadas: hosp.length, total: habs.length },
    porTipo: {
      PRIVADA: { ocupadas: ocupPorTipo.PRIVADA, total: totalPorTipo.PRIVADA },
      SALA_GENERAL: { ocupadas: ocupPorTipo.SALA_GENERAL, total: totalPorTipo.SALA_GENERAL },
      URGENCIAS: { ocupadas: ocupPorTipo.URGENCIAS, total: totalPorTipo.URGENCIAS },
      TERAPIA_INTENSIVA: { ocupadas: ocupPorTipo.TERAPIA_INTENSIVA, total: totalPorTipo.TERAPIA_INTENSIVA }
    },
    alertas: alertas
  };
}

/**
 * Devuelve cirugías REALIZADAS en las últimas 48 horas que no tienen
 * hospitalización activa vinculada — para sugerir al ingresar pacientes.
 */
function getCirugiasParaHospitalizar() {
  var tz = getConfig('ZonaHoraria') || 'America/Chihuahua';
  var hoy = new Date();
  var hace48 = new Date(hoy.getTime() - 48 * 3600 * 1000);
  var hace48Str = Utilities.formatDate(hace48, tz, 'yyyy-MM-dd');

  function dStr(d) {
    if (!d) return '';
    if (d instanceof Date) return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    return String(d).substring(0, 10);
  }

  var cirugias = sheetToObjects(SHEETS.CIRUGIAS).filter(function(r){
    return r.Estado === 'REALIZADA' && dStr(r.Fecha_Programada) >= hace48Str;
  });

  var hosp = sheetToObjects(SHEETS.HOSPITALIZACIONES);
  var foliosConHosp = {};
  hosp.forEach(function(h){
    if (h.Folio_Cirugia_Relacionada) foliosConHosp[h.Folio_Cirugia_Relacionada] = true;
  });

  var disponibles = cirugias.filter(function(c){
    return !foliosConHosp[c.Folio_Cirugia];
  }).map(function(c){
    return {
      folioCirugia: c.Folio_Cirugia,
      fecha: dStr(c.Fecha_Programada),
      idPaciente: c.ID_Paciente,
      nombrePaciente: c.Nombre_Paciente,
      edadPaciente: c.Edad_Paciente,
      tipoCirugia: c.Tipo_Cirugia,
      nombreMedico: c.Nombre_Medico,
      idQuirofano: c.ID_Quirofano,
      numeroQuirofano: c.Numero_Quirofano
    };
  });

  return { ok: true, data: disponibles };
}

/**
 * Devuelve historial de hospitalizaciones de una habitación específica.
 */
function getHistorialHabitacion(idHabitacion) {
  if (!idHabitacion) return { ok: false, error: 'idHabitacion requerido' };
  var hosp = sheetToObjects(SHEETS.HOSPITALIZACIONES).filter(function(h){
    return h.ID_Habitacion === idHabitacion;
  });
  hosp.sort(function(a, b){
    return String(b.Fecha_Ingreso || '').localeCompare(String(a.Fecha_Ingreso || ''));
  });
  return { ok: true, data: hosp };
}

/**
 * Ingresa un paciente a una habitación.
 *
 * Datos requeridos:
 *   d.idHabitacion, d.nombrePaciente, d.diagnostico, d.idDoctor, d.nombreDoctor
 * Opcionales:
 *   d.idPaciente (si ya existe), d.edadPaciente, d.telefono,
 *   d.folioCirugiaRelacionada, d.observaciones, d.fechaIngreso, d.horaIngreso
 */
function ingresarPaciente(d) {
  // Validación de permisos.
  // Si NO se manda rolUsuario, es una llamada INTERNA (p.ej. desde altaPaciente
  // en recepción, que ya validó su propio permiso 'nuevo_paciente_recep').
  if (d.rolUsuario) {
    if (!tienePermiso(d.rolUsuario, 'ingresar_habitacion')) {
      return errorSinPermiso(d.rolUsuario, 'ingresar_habitacion');
    }
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!d.idHabitacion) return { ok: false, error: 'Habitación requerida' };
    if (!d.nombrePaciente) return { ok: false, error: 'Paciente requerido' };

    // Validar que la habitación esté disponible
    var hospAct = sheetToObjects(SHEETS.HOSPITALIZACIONES).filter(function(h){
      return h.ID_Habitacion === d.idHabitacion && h.Estado === 'ACTIVA';
    });
    if (hospAct.length > 0) {
      return {
        ok: false,
        error: 'La habitación ya está ocupada por ' + hospAct[0].Nombre_Paciente
      };
    }

    // Buscar info de la habitación
    var habs = sheetToObjects(SHEETS.HABITACIONES);
    var hab = habs.filter(function(h){return h.ID_Habitacion === d.idHabitacion;})[0];
    if (!hab) return { ok: false, error: 'Habitación no encontrada' };

    // Si no se proporcionó idPaciente, dar de alta (llamada interna sin rolUsuario)
    var idPaciente = d.idPaciente;
    if (!idPaciente) {
      var altaResp = altaPaciente({ nombre: d.nombrePaciente });
      idPaciente = altaResp.idPaciente;
    }

    var idHosp = 'HOSP-' + new Date().getTime();
    var fechaIng = d.fechaIngreso || todayStr();
    var horaIng = d.horaIngreso || Utilities.formatDate(new Date(), getConfig('ZonaHoraria') || 'America/Chihuahua', 'HH:mm');

    var shHosp = getSheet(SHEETS.HOSPITALIZACIONES);
    shHosp.appendRow([
      idHosp,
      d.idHabitacion,
      hab.Numero,
      hab.Tipo,
      idPaciente,
      d.nombrePaciente,
      d.edadPaciente || '',
      d.telefono || '',
      d.diagnostico || '',
      d.idDoctor || '',
      d.nombreDoctor || '',
      fechaIng,
      "'" + horaIng,
      '',  // Fecha_Egreso vacía
      '',  // Hora_Egreso vacía
      'ACTIVA',
      d.folioCirugiaRelacionada || '',
      d.observaciones || '',
      '',  // Motivo_Egreso vacío
      d.capturadoPor,
      nowTs()
    ]);

    // Origen del ingreso (RECEPCION / CIRUGIA / DIRECTO) — solo si la columna existe
    var hHosp = shHosp.getRange(1, 1, 1, shHosp.getLastColumn()).getValues()[0];
    var colOrigen = hHosp.indexOf('Origen_Ingreso');
    if (colOrigen !== -1) {
      shHosp.getRange(shHosp.getLastRow(), colOrigen + 1).setValue(d.origen || 'DIRECTO');
    }

    return { ok: true, idHospitalizacion: idHosp, habitacion: hab.Tipo + ' ' + hab.Numero };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Egresa al paciente (cierra la hospitalización activa).
 *
 * Datos: d.idHospitalizacion, d.motivoEgreso (opcional), d.capturadoPor
 */
function egresarPaciente(d) {
  // Validación de permisos: misma acción que ingresar habitación
  if (!tienePermiso(d.rolUsuario, 'ingresar_habitacion')) {
    return errorSinPermiso(d.rolUsuario, 'ingresar_habitacion');
  }
  if (!d.idHospitalizacion) return { ok: false, error: 'idHospitalizacion requerido' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet(SHEETS.HOSPITALIZACIONES);
    var data = sh.getDataRange().getValues();
    var headers = data[0];
    var colEstado = headers.indexOf('Estado');
    var colFechaEg = headers.indexOf('Fecha_Egreso');
    var colHoraEg = headers.indexOf('Hora_Egreso');
    var colMotivoEg = headers.indexOf('Motivo_Egreso');

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === d.idHospitalizacion) {
        if (data[i][colEstado] === 'EGRESADA') {
          return { ok: false, error: 'Esta hospitalización ya fue egresada' };
        }
        sh.getRange(i + 1, colEstado + 1).setValue('EGRESADA');
        sh.getRange(i + 1, colFechaEg + 1).setValue(d.fechaEgreso || todayStr());
        sh.getRange(i + 1, colHoraEg + 1).setValue("'" + (d.horaEgreso || Utilities.formatDate(new Date(), getConfig('ZonaHoraria') || 'America/Chihuahua', 'HH:mm')));
        sh.getRange(i + 1, colMotivoEg + 1).setValue(d.motivoEgreso || '');
        return { ok: true, idHospitalizacion: d.idHospitalizacion };
      }
    }
    return { ok: false, error: 'Hospitalización no encontrada' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mueve un paciente de una habitación a otra. Registra audit trail con motivo.
 *
 * Datos: d.idHospitalizacion, d.idHabitacionNueva, d.motivo, d.capturadoPor
 */
function moverPaciente(d) {
  // Validación de permisos: misma acción que ingresar habitación
  if (!tienePermiso(d.rolUsuario, 'ingresar_habitacion')) {
    return errorSinPermiso(d.rolUsuario, 'ingresar_habitacion');
  }
  if (!d.idHospitalizacion) return { ok: false, error: 'idHospitalizacion requerido' };
  if (!d.idHabitacionNueva) return { ok: false, error: 'Habitación nueva requerida' };
  if (!d.motivo || d.motivo.trim().length < 5) {
    return { ok: false, error: 'Motivo requerido (mínimo 5 caracteres)' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet(SHEETS.HOSPITALIZACIONES);
    var data = sh.getDataRange().getValues();
    var headers = data[0];
    var colIdHab = headers.indexOf('ID_Habitacion');
    var colNumHab = headers.indexOf('Numero_Habitacion');
    var colTipoHab = headers.indexOf('Tipo_Habitacion');
    var colEstado = headers.indexOf('Estado');
    var colNombrePac = headers.indexOf('Nombre_Paciente');

    // ---- Localizar la hospitalización a mover (paciente A) ----
    var filaA = -1, hospA = null;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === d.idHospitalizacion) {
        filaA = i + 1;
        hospA = data[i];
        break;
      }
    }
    if (filaA === -1) return { ok: false, error: 'Hospitalización no encontrada' };

    var idHabOrigen = hospA[colIdHab];
    if (idHabOrigen === d.idHabitacionNueva) {
      return { ok: false, error: 'El paciente ya está en esa habitación' };
    }

    // ---- Info de la habitación destino ----
    var habs = sheetToObjects(SHEETS.HABITACIONES);
    var habDestino = habs.filter(function(h){return h.ID_Habitacion === d.idHabitacionNueva;})[0];
    if (!habDestino) return { ok: false, error: 'Habitación destino no encontrada' };

    // ---- ¿El destino está ocupado por otra hospitalización activa (paciente B)? ----
    var filaB = -1, hospB = null;
    for (var j = 1; j < data.length; j++) {
      if (data[j][colIdHab] === d.idHabitacionNueva &&
          data[j][colEstado] === 'ACTIVA' &&
          data[j][0] !== d.idHospitalizacion) {
        filaB = j + 1;
        hospB = data[j];
        break;
      }
    }

    var habOrigenLabel = hospA[colTipoHab] + ' ' + hospA[colNumHab];
    var habDestinoLabel = habDestino.Tipo + ' ' + habDestino.Numero;
    var horaAhora = "'" + Utilities.formatDate(new Date(), getConfig('ZonaHoraria') || 'America/Chihuahua', 'HH:mm');
    var shMov = getSheet(SHEETS.MOVIMIENTOS_HAB);

    // ============ CASO 1: destino LIBRE → movimiento simple ============
    if (filaB === -1) {
      sh.getRange(filaA, colIdHab + 1).setValue(d.idHabitacionNueva);
      sh.getRange(filaA, colNumHab + 1).setValue(habDestino.Numero);
      sh.getRange(filaA, colTipoHab + 1).setValue(habDestino.Tipo);

      shMov.appendRow([
        'MOV-HAB-' + new Date().getTime(),
        d.idHospitalizacion,
        hospA[colNombrePac],
        habOrigenLabel,
        habDestinoLabel,
        todayStr(),
        horaAhora,
        d.motivo.trim(),
        d.capturadoPor,
        nowTs()
      ]);

      return { ok: true, intercambio: false, habitacionAnterior: habOrigenLabel, habitacionNueva: habDestinoLabel };
    }

    // ============ CASO 2: destino OCUPADO → intercambio de camas ============
    // Salvaguarda: si el frontend no confirmó el intercambio, se pide confirmación
    // (evita un intercambio accidental si otro usuario ocupó la cama hace segundos).
    if (!d.confirmarIntercambio) {
      return {
        ok: false,
        requiereIntercambio: true,
        ocupante: hospB[colNombrePac],
        habitacionDestino: habDestinoLabel,
        habitacionOrigen: habOrigenLabel,
        error: 'La habitación ' + habDestinoLabel + ' está ocupada por ' + hospB[colNombrePac] +
               '. Confirma el intercambio: ' + hospA[colNombrePac] + ' pasará a ' + habDestinoLabel +
               ' y ' + hospB[colNombrePac] + ' a ' + habOrigenLabel + '.'
      };
    }

    // Datos de la habitación de origen (para enviar ahí al paciente B)
    var habOrigen = habs.filter(function(h){return h.ID_Habitacion === idHabOrigen;})[0];
    var numOrigen = habOrigen ? habOrigen.Numero : hospA[colNumHab];
    var tipoOrigen = habOrigen ? habOrigen.Tipo : hospA[colTipoHab];

    // A → destino
    sh.getRange(filaA, colIdHab + 1).setValue(d.idHabitacionNueva);
    sh.getRange(filaA, colNumHab + 1).setValue(habDestino.Numero);
    sh.getRange(filaA, colTipoHab + 1).setValue(habDestino.Tipo);

    // B → origen
    sh.getRange(filaB, colIdHab + 1).setValue(idHabOrigen);
    sh.getRange(filaB, colNumHab + 1).setValue(numOrigen);
    sh.getRange(filaB, colTipoHab + 1).setValue(tipoOrigen);

    // Audit trail: una fila por cada paciente movido
    var tsBase = new Date().getTime();
    var motivoSwap = d.motivo.trim() + ' [Intercambio de camas]';
    shMov.appendRow([
      'MOV-HAB-' + tsBase,
      d.idHospitalizacion,
      hospA[colNombrePac],
      habOrigenLabel,
      habDestinoLabel,
      todayStr(),
      horaAhora,
      motivoSwap + ' (con ' + hospB[colNombrePac] + ')',
      d.capturadoPor,
      nowTs()
    ]);
    shMov.appendRow([
      'MOV-HAB-' + (tsBase + 1),
      hospB[0],
      hospB[colNombrePac],
      habDestinoLabel,
      habOrigenLabel,
      todayStr(),
      horaAhora,
      motivoSwap + ' (con ' + hospA[colNombrePac] + ')',
      d.capturadoPor,
      nowTs()
    ]);

    return {
      ok: true,
      intercambio: true,
      ocupante: hospB[colNombrePac],
      habitacionAnterior: habOrigenLabel,
      habitacionNueva: habDestinoLabel
    };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// ASEGURADORAS
// ============================================================

function getAseguradoras() {
  var rows = sheetToObjects(SHEETS.ASEGURADORAS).filter(function(a){ return esActivo(a.Activo); });
  return { ok: true, data: rows };
}

function altaAseguradora(d) {
  if (!d.nombre || !String(d.nombre).trim()) {
    return { ok: false, error: 'Nombre de aseguradora es obligatorio' };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet(SHEETS.ASEGURADORAS);
    var data = sh.getDataRange().getValues();
    var num = 0;
    for (var i = 1; i < data.length; i++) {
      var v = String(data[i][0] || '');
      if (v.indexOf('ASE-') === 0) {
        var n = parseInt(v.replace('ASE-', ''), 10);
        if (!isNaN(n)) num = Math.max(num, n);
      }
    }
    var id = 'ASE-' + String(num + 1).padStart(3, '0');
    sh.appendRow([
      id,
      d.nombre,
      d.razonSocial || '',
      d.rfc || '',
      d.telefonoContacto || '',
      d.emailContacto || '',
      d.direccion || '',
      d.observaciones || '',
      'SI'
    ]);
    return { ok: true, idAseguradora: id, nombre: d.nombre };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// EDITAR CIRUGÍA (paciente, doctor, fecha, hora, quirófano, etc.)
// ============================================================

function editarCirugia(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'editar_cirugia')) {
    return errorSinPermiso(d.rolUsuario, 'editar_cirugia');
  }
  if (!d.folio) return { ok: false, error: 'Folio requerido' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet(SHEETS.CIRUGIAS);
    var data = sh.getDataRange().getValues();
    var headers = data[0];
    var colFolio = headers.indexOf('Folio_Cirugia');
    var colEstado = headers.indexOf('Estado');

    var rowIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][colFolio] === d.folio) {
        rowIdx = i;
        break;
      }
    }
    if (rowIdx === -1) return { ok: false, error: 'Cirugía no encontrada' };

    var estadoActual = String(data[rowIdx][colEstado] || '').toUpperCase();

    // No se pueden editar cirugías ya terminadas o canceladas
    // (deben reabrirse primero, lo cual solo puede hacer un rol con permiso reabrir_cirugia)
    if (estadoActual === 'CANCELADA') {
      return { ok: false, error: 'Esta cirugía está CANCELADA. Reábrela primero antes de editar.' };
    }
    if (estadoActual === 'TERMINADA') {
      return { ok: false, error: 'Esta cirugía está TERMINADA. Reábrela primero antes de editar.' };
    }

    // Mapa de campos editables
    var fieldMap = {
      'fechaProgramada': 'Fecha_Programada',
      'horaProgramada': 'Hora_Programada',
      'horaFinProgramada': 'Hora_Fin_Programada',
      'tqxHoras': 'TQX_Horas',
      'idQuirofano': 'ID_Quirofano',
      'numeroQuirofano': 'Numero_Quirofano',
      'idPaciente': 'ID_Paciente',
      'nombrePaciente': 'Nombre_Paciente',
      'edadPaciente': 'Edad_Paciente',
      'idMedico': 'ID_Medico',
      'nombreMedico': 'Nombre_Medico',
      'idCirugiaTipo': 'ID_Cirugia_Tipo',
      'tipoCirugia': 'Tipo_Cirugia',
      'claveCPT': 'Clave_CPT',
      'idAyudante': 'ID_Ayudante',
      'nombreAyudante': 'Nombre_Ayudante',
      'idAnestesiologo': 'ID_Anestesiologo',
      'nombreAnestesiologo': 'Nombre_Anestesiologo',
      'materialEspecial': 'Material_Especial',
      'observaciones': 'Observaciones'
    };

    // Recolectar valores anteriores de campos a cambiar para audit
    var cambios = {};

    Object.keys(fieldMap).forEach(function(frontKey){
      if (d.hasOwnProperty(frontKey)) {
        var colIdx = headers.indexOf(fieldMap[frontKey]);
        if (colIdx !== -1) {
          var anterior = data[rowIdx][colIdx];
          var nuevo = d[frontKey];
          if (String(anterior) !== String(nuevo)) {
            cambios[fieldMap[frontKey]] = { antes: anterior, despues: nuevo };
            sh.getRange(rowIdx + 1, colIdx + 1).setValue(nuevo);
          }
        }
      }
    });

    // Marcar auditoría dentro de Cirugias (campos Actualizado_Por, Timestamp_Actualizacion)
    var colActPor = headers.indexOf('Actualizado_Por');
    var colTSAct = headers.indexOf('Timestamp_Actualizacion');
    if (colActPor !== -1 && d.realizadoPor) sh.getRange(rowIdx + 1, colActPor + 1).setValue(d.realizadoPor);
    if (colTSAct !== -1) sh.getRange(rowIdx + 1, colTSAct + 1).setValue(nowTs());

    // Audit trail en pestaña Audit_Cirugias
    registrarAuditCirugia({
      folio: d.folio,
      accion: 'EDITAR',
      estadoAnterior: estadoActual,
      estadoNuevo: estadoActual,  // no cambia
      cambios: cambios,
      motivo: d.motivo || '',
      realizadoPor: d.realizadoPor || 'Sistema'
    });

    return { ok: true, folio: d.folio, camposActualizados: Object.keys(cambios).length };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// CANCELAR CIRUGÍA
// ============================================================

function cancelarCirugia(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'cancelar_cirugia')) {
    return errorSinPermiso(d.rolUsuario, 'cancelar_cirugia');
  }
  if (!d.folio) return { ok: false, error: 'Folio requerido' };
  if (!d.motivo || String(d.motivo).trim().length < 10) {
    return { ok: false, error: 'Motivo obligatorio (mínimo 10 caracteres)' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet(SHEETS.CIRUGIAS);
    var data = sh.getDataRange().getValues();
    var headers = data[0];
    var colFolio = headers.indexOf('Folio_Cirugia');
    var colEstado = headers.indexOf('Estado');

    var rowIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][colFolio] === d.folio) {
        rowIdx = i;
        break;
      }
    }
    if (rowIdx === -1) return { ok: false, error: 'Cirugía no encontrada' };

    var estadoActual = String(data[rowIdx][colEstado] || '').toUpperCase();

    if (estadoActual === 'CANCELADA') {
      return { ok: false, error: 'Esta cirugía ya está cancelada' };
    }

    // Marcar como CANCELADA
    sh.getRange(rowIdx + 1, colEstado + 1).setValue('CANCELADA');
    var colCancPor = headers.indexOf('Cancelada_Por');
    var colFecCanc = headers.indexOf('Fecha_Cancelacion');
    var colMotivoCanc = headers.indexOf('Cancelacion_Motivo');
    if (colCancPor !== -1) sh.getRange(rowIdx + 1, colCancPor + 1).setValue(d.realizadoPor || '');
    if (colFecCanc !== -1) sh.getRange(rowIdx + 1, colFecCanc + 1).setValue(nowTs());
    if (colMotivoCanc !== -1) sh.getRange(rowIdx + 1, colMotivoCanc + 1).setValue(d.motivo);

    // Audit trail
    registrarAuditCirugia({
      folio: d.folio,
      accion: 'CANCELAR',
      estadoAnterior: estadoActual,
      estadoNuevo: 'CANCELADA',
      cambios: {},
      motivo: d.motivo,
      realizadoPor: d.realizadoPor || 'Sistema'
    });

    return { ok: true, folio: d.folio, estadoNuevo: 'CANCELADA' };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// TERMINAR CIRUGÍA
// ============================================================

function terminarCirugia(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'terminar_cirugia')) {
    return errorSinPermiso(d.rolUsuario, 'terminar_cirugia');
  }
  if (!d.folio) return { ok: false, error: 'Folio requerido' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet(SHEETS.CIRUGIAS);
    var data = sh.getDataRange().getValues();
    var headers = data[0];
    var colFolio = headers.indexOf('Folio_Cirugia');
    var colEstado = headers.indexOf('Estado');

    var rowIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][colFolio] === d.folio) {
        rowIdx = i;
        break;
      }
    }
    if (rowIdx === -1) return { ok: false, error: 'Cirugía no encontrada' };

    var estadoActual = String(data[rowIdx][colEstado] || '').toUpperCase();
    if (estadoActual === 'TERMINADA') {
      return { ok: false, error: 'Esta cirugía ya está terminada' };
    }
    if (estadoActual === 'CANCELADA') {
      return { ok: false, error: 'No se puede terminar una cirugía cancelada. Pide a un usuario con permiso de "reabrir" que la reabra primero.' };
    }

    // ===== Validación: la cirugía debe tener un PACIENTE REGISTRADO =====
    // Una cirugía pudo programarse con paciente texto libre (sin alta).
    // No se puede terminar hasta que se le asigne un paciente del catálogo
    // con el botón "Asignar paciente registrado".
    var colIdPac = headers.indexOf('ID_Paciente');
    var idPacienteCx = colIdPac !== -1 ? String(data[rowIdx][colIdPac] || '').trim() : '';
    if (!idPacienteCx) {
      return {
        ok: false,
        error: 'No se puede terminar esta cirugía: todavía no tiene un paciente registrado asignado. ' +
               'Recepción debe dar de alta al paciente y luego usar "Asignar paciente registrado" en el detalle de la cirugía.'
      };
    }
    // Verificar que ese ID realmente exista en el catálogo de pacientes
    var pacExiste = sheetToObjects(SHEETS.PACIENTES).some(function(p){
      return p.ID_Paciente === idPacienteCx;
    });
    if (!pacExiste) {
      return {
        ok: false,
        error: 'El paciente asignado a esta cirugía (' + idPacienteCx + ') no existe en el catálogo. ' +
               'Vuelve a asignar un paciente registrado válido antes de terminar.'
      };
    }

    // Verificar si tiene consumos registrados
    var consumos = sheetToObjects(SHEETS.CONSUMOS).filter(function(c){
      return c.Folio_Cirugia === d.folio && c.Estado !== 'CANCELADO';
    });
    var tieneConsumos = consumos.length > 0;

    // Si no tiene consumos y no se forzó, advertir
    if (!tieneConsumos && !d.forzar) {
      return {
        ok: false,
        warning: true,
        error: 'Esta cirugía no tiene consumos registrados. ¿Estás seguro de terminarla sin registrar consumos? Confirma para forzar.',
        requiereConfirmacion: true
      };
    }

    sh.getRange(rowIdx + 1, colEstado + 1).setValue('TERMINADA');
    var colTermPor = headers.indexOf('Terminada_Por');
    var colFecTerm = headers.indexOf('Fecha_Terminacion');
    var colMotivoTerm = headers.indexOf('Terminacion_Motivo');
    if (colTermPor !== -1) sh.getRange(rowIdx + 1, colTermPor + 1).setValue(d.realizadoPor || '');
    if (colFecTerm !== -1) sh.getRange(rowIdx + 1, colFecTerm + 1).setValue(nowTs());
    if (colMotivoTerm !== -1) sh.getRange(rowIdx + 1, colMotivoTerm + 1).setValue(d.motivo || '');

    // Audit
    registrarAuditCirugia({
      folio: d.folio,
      accion: 'TERMINAR',
      estadoAnterior: estadoActual,
      estadoNuevo: 'TERMINADA',
      cambios: {},
      motivo: d.motivo || '(sin motivo)',
      realizadoPor: d.realizadoPor || 'Sistema'
    });

    return {
      ok: true,
      folio: d.folio,
      estadoNuevo: 'TERMINADA',
      sinConsumos: !tieneConsumos
    };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// REABRIR CIRUGÍA (roles con permiso reabrir_cirugia)
// ============================================================

function reabrirCirugia(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'reabrir_cirugia')) {
    return errorSinPermiso(d.rolUsuario, 'reabrir_cirugia');
  }
  if (!d.folio) return { ok: false, error: 'Folio requerido' };
  if (!d.motivo || String(d.motivo).trim().length < 10) {
    return { ok: false, error: 'Motivo obligatorio para reabrir (mínimo 10 caracteres)' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet(SHEETS.CIRUGIAS);
    var data = sh.getDataRange().getValues();
    var headers = data[0];
    var colFolio = headers.indexOf('Folio_Cirugia');
    var colEstado = headers.indexOf('Estado');

    var rowIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][colFolio] === d.folio) {
        rowIdx = i;
        break;
      }
    }
    if (rowIdx === -1) return { ok: false, error: 'Cirugía no encontrada' };

    var estadoActual = String(data[rowIdx][colEstado] || '').toUpperCase();
    if (estadoActual !== 'CANCELADA' && estadoActual !== 'TERMINADA') {
      return { ok: false, error: 'Solo se pueden reabrir cirugías CANCELADAS o TERMINADAS' };
    }

    // Determinar a qué estado regresar
    // Si tenía receta vinculada, vuelve a RECETA_VINCULADA, si no a PROGRAMADA
    var recetas = sheetToObjects(SHEETS.RECETAS).filter(function(r){
      return r.Folio_Cirugia === d.folio && r.Estado !== 'CANCELADA';
    });
    var nuevoEstado = recetas.length > 0 ? 'RECETA_VINCULADA' : 'PROGRAMADA';

    sh.getRange(rowIdx + 1, colEstado + 1).setValue(nuevoEstado);

    registrarAuditCirugia({
      folio: d.folio,
      accion: 'REABRIR',
      estadoAnterior: estadoActual,
      estadoNuevo: nuevoEstado,
      cambios: {},
      motivo: d.motivo,
      realizadoPor: d.realizadoPor || 'Sistema'
    });

    return { ok: true, folio: d.folio, estadoNuevo: nuevoEstado };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// HELPERS DE AUDIT
// ============================================================

function registrarAuditCirugia(d) {
  var sh = getSheet(SHEETS.AUDIT_CIRUGIAS);
  var data = sh.getDataRange().getValues();
  var num = 0;
  for (var i = 1; i < data.length; i++) {
    var v = String(data[i][0] || '');
    if (v.indexOf('AUD-') === 0) {
      var n = parseInt(v.replace('AUD-', ''), 10);
      if (!isNaN(n)) num = Math.max(num, n);
    }
  }
  var id = 'AUD-' + String(num + 1).padStart(6, '0');
  sh.appendRow([
    id,
    d.folio,
    d.accion,
    d.estadoAnterior || '',
    d.estadoNuevo || '',
    JSON.stringify(d.cambios || {}),
    d.motivo || '',
    d.realizadoPor || '',
    nowTs()
  ]);
}

function getAuditCirugia(folio) {
  if (!folio) return { ok: false, error: 'folio requerido' };
  var rows = sheetToObjects(SHEETS.AUDIT_CIRUGIAS).filter(function(a){
    return a.Folio_Cirugia === folio;
  }).sort(function(a, b){
    return new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime();
  });
  return { ok: true, data: rows };
}

// ============================================================
// CONSULTAS Y URGENCIAS MÉDICAS
// ============================================================
// Módulo independiente: NO toca inventario, libro COFEPRIS ni recetas.
// La columna "Tipo" distingue entre 'CONSULTA' y 'URGENCIA'.
// ============================================================

/**
 * Devuelve la lista de consultas/urgencias.
 * @param {string} tipo - 'CONSULTA', 'URGENCIA', o vacío para todas.
 * @param {string} desde - fecha mínima yyyy-MM-dd (opcional)
 * @param {string} hasta - fecha máxima yyyy-MM-dd (opcional)
 */
function getConsultas(tipo, desde, hasta) {
  var rows = sheetToObjects(SHEETS.CONSULTAS);
  var tz = getConfig('ZonaHoraria') || 'America/Chihuahua';

  function dStr(d) {
    if (!d) return '';
    if (d instanceof Date) return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    return String(d).substring(0, 10);
  }

  if (tipo)  rows = rows.filter(function(r){ return String(r.Tipo).toUpperCase() === String(tipo).toUpperCase(); });
  if (desde) rows = rows.filter(function(r){ return dStr(r.Fecha) >= desde; });
  if (hasta) rows = rows.filter(function(r){ return dStr(r.Fecha) <= hasta; });

  // Normalizar fecha/hora en la respuesta
  rows = rows.map(function(r){
    r.Fecha = dStr(r.Fecha);
    if (r.Hora instanceof Date) {
      r.Hora = Utilities.formatDate(r.Hora, tz, 'HH:mm');
    } else {
      r.Hora = String(r.Hora || '').replace(/^'/, '').substring(0, 5);
    }
    return r;
  });

  // Ordenar por fecha/hora descendente (más reciente primero)
  rows.sort(function(a, b){
    return String(b.Fecha + b.Hora).localeCompare(String(a.Fecha + a.Hora));
  });

  return { ok: true, data: rows };
}

/**
 * Registra una nueva consulta o urgencia médica.
 *
 * Datos requeridos:
 *   d.tipo            - 'CONSULTA' o 'URGENCIA'
 *   d.idPaciente      - ID del paciente (del catálogo)
 *   d.nombrePaciente  - nombre del paciente
 * Opcionales:
 *   d.idMedico, d.nombreMedico, d.motivo, d.indicaciones,
 *   d.fecha, d.hora, d.capturadoPor
 */
function registrarConsulta(d) {
  // Validación de permisos
  if (!tienePermiso(d.rolUsuario, 'registrar_consulta')) {
    return errorSinPermiso(d.rolUsuario, 'registrar_consulta');
  }

  // Validar tipo
  var tipo = String(d.tipo || '').toUpperCase();
  if (tipo !== 'CONSULTA' && tipo !== 'URGENCIA') {
    return { ok: false, error: 'Tipo inválido. Debe ser CONSULTA o URGENCIA.' };
  }

  // Validar paciente
  if (!d.idPaciente || !d.nombrePaciente) {
    return { ok: false, error: 'Debes seleccionar un paciente del catálogo.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet(SHEETS.CONSULTAS);
    var data = sh.getDataRange().getValues();

    // Generar folio: CONS-XXXXX para consultas, URG-XXXXX para urgencias
    var prefijo = tipo === 'URGENCIA' ? 'URG-' : 'CONS-';
    var num = 0;
    for (var i = 1; i < data.length; i++) {
      var v = String(data[i][0] || '');
      if (v.indexOf(prefijo) === 0) {
        var n = parseInt(v.replace(prefijo, ''), 10);
        if (!isNaN(n)) num = Math.max(num, n);
      }
    }
    var folio = prefijo + String(num + 1).padStart(5, '0');

    var fecha = d.fecha || todayStr();
    var hora = d.hora || Utilities.formatDate(new Date(), getConfig('ZonaHoraria') || 'America/Chihuahua', 'HH:mm');

    appendRowByHeader(SHEETS.CONSULTAS, {
      'Folio': folio,
      'Tipo': tipo,
      'Fecha': fecha,
      'Hora': "'" + hora,
      'ID_Paciente': d.idPaciente,
      'Nombre_Paciente': d.nombrePaciente,
      'ID_Medico': d.idMedico || '',
      'Nombre_Medico': d.nombreMedico || '',
      'Motivo': d.motivo || '',
      'Indicaciones': d.indicaciones || '',
      'Capturado_Por': d.capturadoPor || '',
      'Timestamp_Captura': nowTs()
    });

    // CIERRE DE CICLO: si es CONSULTA, el paciente cierra su ciclo en la clínica.
    // Se marca su Estatus como 'Atendido'. Las URGENCIAS NO cierran ciclo
    // (el paciente puede continuar a cirugía u otro proceso) — y si el paciente
    // venía 'Atendido', una urgencia lo reactiva a 'Activo'.
    var cicloCerrado = false;
    if (tipo === 'CONSULTA') {
      try {
        cicloCerrado = marcarEstatusPaciente(d.idPaciente, 'Atendido');
      } catch (e) {
        cicloCerrado = false;
      }
    } else if (tipo === 'URGENCIA') {
      try {
        var pac = getPaciente(d.idPaciente);
        if (pac.ok && String(pac.data.Estatus) === 'Atendido') {
          marcarEstatusPaciente(d.idPaciente, 'Activo');
        }
      } catch (e) {}
    }

    return { ok: true, folio: folio, tipo: tipo, cicloCerrado: cicloCerrado };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// ASIGNAR PACIENTE REGISTRADO A UNA CIRUGÍA
// ============================================================

/**
 * Vincula un paciente del catálogo a una cirugía que se programó con
 * paciente "texto libre" (sin ID). Reemplaza ID_Paciente y Nombre_Paciente.
 *
 * Permisos: los mismos que pueden terminar cirugías (acción terminar_cirugia).
 *
 * Datos: d.folio, d.idPaciente, d.rolUsuario
 */
function asignarPacienteCirugia(d) {
  // Mismos permisos que terminar cirugía
  if (!tienePermiso(d.rolUsuario, 'terminar_cirugia')) {
    return errorSinPermiso(d.rolUsuario, 'terminar_cirugia');
  }
  if (!d.folio) return { ok: false, error: 'Folio de cirugía requerido' };
  if (!d.idPaciente) return { ok: false, error: 'Debes seleccionar un paciente del catálogo' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // Verificar que el paciente exista y no esté suspendido
    var paciente = null;
    var pacientes = sheetToObjects(SHEETS.PACIENTES);
    for (var p = 0; p < pacientes.length; p++) {
      if (pacientes[p].ID_Paciente === d.idPaciente) {
        paciente = pacientes[p];
        break;
      }
    }
    if (!paciente) return { ok: false, error: 'El paciente seleccionado no existe en el catálogo' };
    if (String(paciente.Estatus) === 'Suspendido') {
      return { ok: false, error: 'El paciente está suspendido. No se puede vincular a una cirugía.' };
    }

    // Buscar la cirugía
    var sh = getSheet(SHEETS.CIRUGIAS);
    var data = sh.getDataRange().getValues();
    var headers = data[0];
    var colFolio = headers.indexOf('Folio_Cirugia');
    var colIdPac = headers.indexOf('ID_Paciente');
    var colNomPac = headers.indexOf('Nombre_Paciente');
    var colEstado = headers.indexOf('Estado');

    var rowIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][colFolio] === d.folio) { rowIdx = i; break; }
    }
    if (rowIdx === -1) return { ok: false, error: 'Cirugía no encontrada: ' + d.folio };

    var estadoActual = String(data[rowIdx][colEstado] || '').toUpperCase();
    if (estadoActual === 'CANCELADA') {
      return { ok: false, error: 'No se puede asignar paciente a una cirugía cancelada' };
    }

    var nombreAnterior = data[rowIdx][colNomPac];

    // Actualizar ID y nombre del paciente en la cirugía
    sh.getRange(rowIdx + 1, colIdPac + 1).setValue(d.idPaciente);
    sh.getRange(rowIdx + 1, colNomPac + 1).setValue(paciente.Nombre_Completo);

    // Audit trail
    registrarAuditCirugia({
      folio: d.folio,
      accion: 'ASIGNAR_PACIENTE',
      estadoAnterior: estadoActual,
      estadoNuevo: estadoActual,
      cambios: {
        Paciente: { antes: nombreAnterior || '(texto libre)', despues: paciente.Nombre_Completo }
      },
      motivo: 'Vinculación de paciente registrado del catálogo',
      realizadoPor: d.realizadoPor || 'Sistema'
    });

    return {
      ok: true,
      folio: d.folio,
      idPaciente: d.idPaciente,
      nombrePaciente: paciente.Nombre_Completo
    };
  } finally {
    lock.releaseLock();
  }
}


// ============================================================
// MÓDULO: RECIBOS DE CAJA
// ------------------------------------------------------------
// Basado en el archivo RECIBO_DE_HONORARIOS_VF.xlsm. Cubre cuatro
// tipos de recibo (CAJA, NOMINA, LIMPIEZA, PAGO) y los registra todos
// en la pestaña "Recibos" (libro mayor, equivalente a la hoja
// "Registro" del Excel). Los beneficiarios de nómina/limpieza/caja
// salen del catálogo "CAT_Beneficiarios" (con alta en línea); los
// recibos de pago de paciente reusan el catálogo de Pacientes.
//
// Las pestañas se crean solas si no existen (no requiere preparar
// el Sheet a mano).
// ============================================================

var RECIBOS_HEADERS = [
  'Folio', 'Fecha', 'Dia', 'Mes', 'Anio', 'Tipo',
  'Beneficiario', 'Puesto', 'ID_Paciente', 'Concepto', 'Periodo',
  'Monto', 'MontoLetra', 'FormaPago',
  'Cuenta', 'Grupo', 'ConceptoContable', 'Observaciones',
  'CapturadoPor', 'Timestamp', 'Estado'
];

var BENEFICIARIOS_HEADERS = ['ID_Beneficiario', 'Nombre', 'Puesto', 'Tipo', 'Activo'];

var TIPOS_RECIBO = ['CAJA', 'NOMINA', 'LIMPIEZA', 'PAGO'];
var FORMAS_PAGO_RECIBO = ['EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO'];

/**
 * Devuelve la pestaña Recibos; la crea con encabezados si no existe.
 */
function ensureRecibosSheet() {
  var sh = SS.getSheetByName(SHEETS.RECIBOS);
  if (!sh) {
    sh = SS.insertSheet(SHEETS.RECIBOS);
    sh.getRange(1, 1, 1, RECIBOS_HEADERS.length).setValues([RECIBOS_HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Devuelve el catálogo de beneficiarios; lo crea si no existe.
 */
function ensureBeneficiariosSheet() {
  var sh = SS.getSheetByName(SHEETS.BENEFICIARIOS);
  if (!sh) {
    sh = SS.insertSheet(SHEETS.BENEFICIARIOS);
    sh.getRange(1, 1, 1, BENEFICIARIOS_HEADERS.length).setValues([BENEFICIARIOS_HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// ------------------------------------------------------------
// CATÁLOGO DE BENEFICIARIOS
// ------------------------------------------------------------

function getBeneficiarios() {
  ensureBeneficiariosSheet();
  var rows = sheetToObjects(SHEETS.BENEFICIARIOS).filter(function (b) {
    return esActivo(b.Activo);
  });
  return { ok: true, data: rows };
}

function altaBeneficiario(d) {
  if (!tienePermiso(d.rolUsuario, 'alta_beneficiario')) {
    return errorSinPermiso(d.rolUsuario, 'alta_beneficiario');
  }
  if (!d.nombre || !String(d.nombre).trim()) {
    return { ok: false, error: 'El nombre del beneficiario es obligatorio' };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = ensureBeneficiariosSheet();
    var data = sh.getDataRange().getValues();
    var headers = data[0];
    var colNom = headers.indexOf('Nombre');
    var colId = headers.indexOf('ID_Beneficiario');
    var colPue = headers.indexOf('Puesto');
    var colAct = headers.indexOf('Activo');

    // Detección de duplicado: mismo nombre normalizado y activo
    var objetivo = normNombreBenef(d.nombre);
    if (!(d.permitirDuplicado === true)) {
      for (var k = 1; k < data.length; k++) {
        if (normNombreBenef(data[k][colNom]) === objetivo && esActivo(data[k][colAct])) {
          return {
            ok: false, duplicado: true,
            error: 'Ya existe un beneficiario con ese nombre.',
            existente: {
              idBeneficiario: data[k][colId],
              nombre: data[k][colNom],
              puesto: data[k][colPue] || ''
            }
          };
        }
      }
    }

    var num = 0;
    for (var i = 1; i < data.length; i++) {
      var v = String(data[i][0] || '');
      if (v.indexOf('BEN-') === 0) {
        var n = parseInt(v.replace('BEN-', ''), 10);
        if (!isNaN(n)) num = Math.max(num, n);
      }
    }
    var id = 'BEN-' + String(num + 1).padStart(4, '0');
    appendRowByHeader(SHEETS.BENEFICIARIOS, {
      'ID_Beneficiario': id,
      'Nombre': String(d.nombre).trim(),
      'Puesto': d.puesto || '',
      'Tipo': d.tipo || 'GENERAL',
      'Activo': 'SI'
    });
    return { ok: true, idBeneficiario: id, nombre: String(d.nombre).trim(), puesto: d.puesto || '' };
  } finally {
    lock.releaseLock();
  }
}

// Normaliza un nombre para comparar duplicados: sin acentos, mayúsculas,
// espacios colapsados.
function normNombreBenef(s) {
  return String(s == null ? '' : s)
    .trim().toUpperCase()
    .replace(/[ÁÀÄÂ]/g, 'A').replace(/[ÉÈËÊ]/g, 'E').replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[ÓÒÖÔ]/g, 'O').replace(/[ÚÙÜÛ]/g, 'U').replace(/Ñ/g, 'N')
    .replace(/\s+/g, ' ');
}

// Devuelve TODOS los beneficiarios (activos e inactivos) con bandera de
// duplicado, para la pantalla de administración del catálogo.
function getBeneficiariosAdmin() {
  ensureBeneficiariosSheet();
  var rows = sheetToObjects(SHEETS.BENEFICIARIOS);
  var conteo = {};
  rows.forEach(function (b) {
    if (esActivo(b.Activo)) {
      var n = normNombreBenef(b.Nombre);
      conteo[n] = (conteo[n] || 0) + 1;
    }
  });
  var data = rows.map(function (b) {
    return {
      idBeneficiario: b.ID_Beneficiario,
      nombre: b.Nombre,
      puesto: b.Puesto || '',
      tipo: b.Tipo || 'GENERAL',
      activo: esActivo(b.Activo),
      duplicado: esActivo(b.Activo) && conteo[normNombreBenef(b.Nombre)] > 1
    };
  });
  return { ok: true, data: data };
}

// Edita un beneficiario existente (nombre, puesto, tipo, activo).
function editarBeneficiario(d) {
  if (!tienePermiso(d.rolUsuario, 'editar_beneficiario')) {
    return errorSinPermiso(d.rolUsuario, 'editar_beneficiario');
  }
  if (!d.idBeneficiario) return { ok: false, error: 'Falta el ID del beneficiario.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = ensureBeneficiariosSheet();
    var data = sh.getDataRange().getValues();
    var headers = data[0];
    var colId = headers.indexOf('ID_Beneficiario');
    var colNom = headers.indexOf('Nombre');
    var colPue = headers.indexOf('Puesto');
    var colTipo = headers.indexOf('Tipo');
    var colAct = headers.indexOf('Activo');

    var fila = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][colId]) === String(d.idBeneficiario)) { fila = i; break; }
    }
    if (fila === -1) return { ok: false, error: 'No se encontró el beneficiario ' + d.idBeneficiario };

    if (d.nombre !== undefined && String(d.nombre).trim()) {
      // Si cambia el nombre, evitar chocar con otro activo
      var objetivo = normNombreBenef(d.nombre);
      for (var k = 1; k < data.length; k++) {
        if (k !== fila && normNombreBenef(data[k][colNom]) === objetivo && esActivo(data[k][colAct])) {
          return { ok: false, duplicado: true, error: 'Ya existe otro beneficiario activo con ese nombre.' };
        }
      }
      sh.getRange(fila + 1, colNom + 1).setValue(String(d.nombre).trim());
    }
    if (d.puesto !== undefined) sh.getRange(fila + 1, colPue + 1).setValue(d.puesto || '');
    if (d.tipo !== undefined && d.tipo) sh.getRange(fila + 1, colTipo + 1).setValue(d.tipo);
    if (d.activo !== undefined) sh.getRange(fila + 1, colAct + 1).setValue(d.activo ? 'SI' : 'NO');

    return { ok: true, idBeneficiario: d.idBeneficiario };
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
// RECIBOS
// ------------------------------------------------------------

function getRecibos(desde, hasta) {
  ensureRecibosSheet();
  var rows = sheetToObjects(SHEETS.RECIBOS);
  if (desde) rows = rows.filter(function (r) { return dateOnly(r.Fecha) >= desde; });
  if (hasta) rows = rows.filter(function (r) { return dateOnly(r.Fecha) <= hasta; });
  // Orden descendente por folio (más reciente primero)
  rows.sort(function (a, b) {
    return String(b.Folio || '').localeCompare(String(a.Folio || ''));
  });
  return { ok: true, data: rows };
}

/**
 * Emite un recibo de caja y lo registra en la pestaña Recibos.
 * Campos esperados en d:
 *   tipo (CAJA|NOMINA|LIMPIEZA|PAGO), fecha (yyyy-mm-dd),
 *   beneficiario, puesto, idPaciente, concepto, periodo,
 *   monto (número), formaPago, observaciones, capturadoPor
 */
function emitirRecibo(d) {
  if (!tienePermiso(d.rolUsuario, 'emitir_recibo')) {
    return errorSinPermiso(d.rolUsuario, 'emitir_recibo');
  }

  var tipo = String(d.tipo || '').toUpperCase().trim();
  if (TIPOS_RECIBO.indexOf(tipo) === -1) {
    return { ok: false, error: 'Tipo de recibo inválido. Debe ser CAJA, NOMINA, LIMPIEZA o PAGO.' };
  }

  var monto = Number(d.monto);
  if (isNaN(monto) || monto <= 0) {
    return { ok: false, error: 'El monto debe ser un número mayor a 0.' };
  }

  var beneficiario = String(d.beneficiario || '').trim();
  if (!beneficiario) {
    return { ok: false, error: 'Debes indicar el beneficiario / paciente del recibo.' };
  }

  var formaPago = String(d.formaPago || 'EFECTIVO').toUpperCase().trim();
  if (FORMAS_PAGO_RECIBO.indexOf(formaPago) === -1) formaPago = 'EFECTIVO';

  var puesto = (tipo === 'LIMPIEZA') ? 'LIMPIEZA' : String(d.puesto || '').trim();

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = ensureRecibosSheet();
    var data = sh.getDataRange().getValues();

    // Folio REC-XXXXX (auto, basado en el máximo existente)
    var num = 0;
    for (var i = 1; i < data.length; i++) {
      var v = String(data[i][0] || '');
      if (v.indexOf('REC-') === 0) {
        var n = parseInt(v.replace('REC-', ''), 10);
        if (!isNaN(n)) num = Math.max(num, n);
      }
    }
    var folio = 'REC-' + String(num + 1).padStart(5, '0');

    var fecha = d.fecha || todayStr();
    var partes = String(fecha).substring(0, 10).split('-'); // yyyy-mm-dd
    var anio = partes[0] || '';
    var mes = partes[1] ? parseInt(partes[1], 10) : '';
    var dia = partes[2] ? parseInt(partes[2], 10) : '';

    var montoLetra = numeroALetrasRecibo(monto);

    appendRowByHeader(SHEETS.RECIBOS, {
      'Folio': folio,
      'Fecha': fecha,
      'Dia': dia,
      'Mes': mes,
      'Anio': anio,
      'Tipo': tipo,
      'Beneficiario': beneficiario,
      'Puesto': puesto,
      'ID_Paciente': d.idPaciente || '',
      'Concepto': String(d.concepto || '').trim(),
      'Periodo': String(d.periodo || '').trim(),
      'Monto': monto,
      'MontoLetra': montoLetra,
      'FormaPago': formaPago,
      'Cuenta': d.cuenta || '',
      'Grupo': d.grupo || '',
      'ConceptoContable': d.conceptoContable || '',
      'Observaciones': String(d.observaciones || '').trim(),
      'CapturadoPor': d.capturadoPor || '',
      'Timestamp': nowTs(),
      'Estado': 'EMITIDO'
    });

    return {
      ok: true,
      folio: folio,
      tipo: tipo,
      fecha: fecha,
      beneficiario: beneficiario,
      puesto: puesto,
      idPaciente: d.idPaciente || '',
      concepto: String(d.concepto || '').trim(),
      periodo: String(d.periodo || '').trim(),
      monto: monto,
      montoLetra: montoLetra,
      formaPago: formaPago
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cancela un recibo (no lo borra; marca Estado = CANCELADO).
 */
function cancelarRecibo(d) {
  if (!tienePermiso(d.rolUsuario, 'cancelar_recibo')) {
    return errorSinPermiso(d.rolUsuario, 'cancelar_recibo');
  }
  if (!d.folio) return { ok: false, error: 'Falta el folio del recibo a cancelar.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = ensureRecibosSheet();
    var data = sh.getDataRange().getValues();
    var headers = data[0];
    var colFolio = headers.indexOf('Folio');
    var colEstado = headers.indexOf('Estado');
    if (colEstado === -1) return { ok: false, error: 'La pestaña Recibos no tiene columna Estado.' };

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][colFolio]) === String(d.folio)) {
        if (String(data[i][colEstado]).toUpperCase() === 'CANCELADO') {
          return { ok: false, error: 'El recibo ' + d.folio + ' ya estaba cancelado.' };
        }
        sh.getRange(i + 1, colEstado + 1).setValue('CANCELADO');
        return { ok: true, folio: d.folio };
      }
    }
    return { ok: false, error: 'No se encontró el recibo ' + d.folio };
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
// NÚMERO A LETRAS (formato fiscal mexicano)
// ------------------------------------------------------------
/**
 * Convierte un monto a su representación en letra para recibos.
 * Ej: 8000 -> "OCHO MIL PESOS 00/100 M.N."
 *     1250.5 -> "MIL DOSCIENTOS CINCUENTA PESOS 50/100 M.N."
 * Soporta hasta 999,999,999.
 */
function numeroALetrasRecibo(monto) {
  var n = Math.floor(Math.abs(Number(monto)));
  var centavos = Math.round((Math.abs(Number(monto)) - n) * 100);
  if (centavos === 100) { n += 1; centavos = 0; }

  var letras;
  if (n === 0) letras = 'CERO';
  else letras = _numAFraseEspanol(n);

  // Apócope: "UNO" -> "UN" antes de PESO/PESOS (UN PESO, VEINTIUN PESOS, ...)
  if (/UNO$/.test(letras)) letras = letras.replace(/UNO$/, 'UN');

  var moneda = (n === 1) ? 'PESO' : 'PESOS';
  var cent = (centavos < 10 ? '0' + centavos : String(centavos));
  return (letras + ' ' + moneda + ' ' + cent + '/100 M.N.').toUpperCase();
}

function _numAFraseEspanol(num) {
  if (num === 0) return 'CERO';
  if (num === 100) return 'CIEN';

  var unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE',
    'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
  var decenas = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  var centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function tresDigitos(c) {
    if (c === 100) return 'CIEN';
    var resultado = '';
    var cen = Math.floor(c / 100);
    var resto = c % 100;
    if (cen > 0) resultado += centenas[cen];
    if (resto > 0) {
      if (resultado) resultado += ' ';
      if (resto <= 20) {
        resultado += unidades[resto];
      } else {
        var dec = Math.floor(resto / 10);
        var uni = resto % 10;
        if (dec === 2) {
          resultado += 'VEINTI' + unidades[uni]; // VEINTIUNO, VEINTIDOS, ...
        } else {
          resultado += decenas[dec];
          if (uni > 0) resultado += ' Y ' + unidades[uni];
        }
      }
    }
    return resultado;
  }

  var millones = Math.floor(num / 1000000);
  var miles = Math.floor((num % 1000000) / 1000);
  var resto = num % 1000;
  var partes = [];

  if (millones > 0) {
    if (millones === 1) partes.push('UN MILLON');
    else partes.push(tresDigitos(millones) + ' MILLONES');
  }
  if (miles > 0) {
    if (miles === 1) partes.push('MIL');
    else partes.push(tresDigitos(miles) + ' MIL');
  }
  if (resto > 0) {
    partes.push(tresDigitos(resto));
  }
  return partes.join(' ').replace(/\s+/g, ' ').trim();
}


// ============================================================
// MÓDULO: COBRO DE CAJA (cuenta del paciente)
// ------------------------------------------------------------
// Endpoints que consume el frontend (page-cobro):
//   GET  buscarPacientesCobro      -> lista de pacientes por nombre
//   GET  getDatosPacienteParaCobro -> datos + cirugías + cuenta previa
//   POST guardarIngreso            -> alta/edición de la cuenta de caja
//
// La cuenta se guarda en la pestaña "Caja" (una fila por expediente;
// se crea sola si no existe). El sistema NO almacena precios, así que
// los montos los captura el cajero; la autocarga trae lo ya capturado
// del paciente (datos, fechas, habitación, cirugías y cirujano).
//
// Comisión bancaria: solo aplica a TD/TC. El monto que captura el
// cajero es lo que se ABONA a la cuenta (base); la terminal cobra
// base / 0.96. Efectivo y transferencia nunca generan comisión.
// ============================================================

var FACTOR_COMISION_CAJA = 0.96;

var CAJA_HEADERS = [
  'Expediente', 'ID_Paciente', 'Nombre_Paciente', 'Factura',
  'Fecha_Ingreso', 'Fecha_Egreso', 'Tipo_Cliente', 'Habitacion', 'Cirugias_JSON',
  'Hospitalizacion', 'Consulta_Externa', 'Hora_Extra', 'Dia_Extra',
  'Materiales_Medicamentos', 'Oxigeno', 'Paquete_Globular', 'Noche_Terapia',
  'Bomba_Infusion', 'Fluoroscopio', 'Laparoscopio', 'Artroscopio', 'Ligasure',
  'Ambulancia', 'Monitor', 'Ventilador',
  'Laboratorio', 'Imagen', 'Anestesia_Mixta',
  'Cirujano', 'Hon_Cirujano', 'Primer_Ayudante', 'Hon_1er_Ayudante',
  'Segundo_Ayudante', 'Hon_2do_Ayudante', 'Anestesiologo', 'Hon_Anestesiologo',
  'Patologo', 'Hon_Patologo', 'Medico_Internista', 'Hon_Medico_Internista',
  'Otros_Medicos', 'Hon_Otros_Medicos',
  'Det_Deposito_Efectivo', 'Det_Deposito_TD', 'Det_Deposito_TC', 'Det_Deposito_Transferencia',
  'Det_Pago_Efectivo', 'Det_Pago_TD', 'Det_Pago_TC', 'Det_Pago_Transferencia',
  'Operacion', 'Aplicar_Comision',
  'Total_Cuenta', 'Total_Abonado', 'Saldo_Pendiente', 'Comision_Total',
  'Capturado_Por', 'Timestamp_Creacion', 'Timestamp_Actualizacion', 'Estado'
];

function ensureCajaSheet() {
  var sh = SS.getSheetByName(SHEETS.CAJA);
  if (!sh) {
    sh = SS.insertSheet(SHEETS.CAJA);
    sh.getRange(1, 1, 1, CAJA_HEADERS.length).setValues([CAJA_HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function cajaNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  var s = String(v).replace(/[$\s,]/g, '').replace(/MXN/gi, '');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function cajaRound(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// ------------------------------------------------------------
// BÚSQUEDA DE PACIENTES PARA COBRO
// ------------------------------------------------------------
function buscarPacientesCobro(q) {
  var query = String(q || '').trim().toLowerCase();
  if (query.length < 2) return { ok: true, resultados: [] };
  var rows = sheetToObjects(SHEETS.PACIENTES).filter(function (p) {
    return (String(p.Nombre_Completo || '').toLowerCase().indexOf(query) !== -1) ||
           (String(p.CURP || '').toLowerCase().indexOf(query) !== -1) ||
           (String(p.ID_Paciente || '').toLowerCase().indexOf(query) !== -1);
  });
  var resultados = rows.slice(0, 15).map(function (p) {
    return {
      idPaciente: p.ID_Paciente,
      nombrePaciente: p.Nombre_Completo,
      curp: p.CURP || '',
      edad: p.Edad || ''
    };
  });
  return { ok: true, resultados: resultados };
}

// ------------------------------------------------------------
// AUTOCARGA: datos del paciente + cirugías + cuenta previa
// ------------------------------------------------------------
function getDatosPacienteParaCobro(idPaciente) {
  if (!idPaciente) return { ok: false, error: 'Falta el ID del paciente.' };

  var pac = sheetToObjects(SHEETS.PACIENTES).filter(function (p) {
    return String(p.ID_Paciente) === String(idPaciente);
  })[0];
  if (!pac) return { ok: false, error: 'Paciente no encontrado: ' + idPaciente };

  // Mapa de especialidad por médico (la cirugía no la guarda; se deriva)
  var espPorMedico = {};
  sheetToObjects(SHEETS.MEDICOS).forEach(function (m) {
    espPorMedico[String(m.ID_Medico)] = m.Especialidad || '';
  });

  // Cirugías del paciente
  var cxs = sheetToObjects(SHEETS.CIRUGIAS).filter(function (c) {
    return String(c.ID_Paciente) === String(idPaciente) && String(c.Estado) !== 'CANCELADA';
  });
  cxs.sort(function (a, b) { return dateOnly(b.Fecha_Programada).localeCompare(dateOnly(a.Fecha_Programada)); });
  var cirugias = cxs.map(function (c) {
    return {
      cirugia: c.Tipo_Cirugia || '',
      tiempo: '',
      especialidad: espPorMedico[String(c.ID_Medico)] || '',
      anestesia: '',
      cirujano: c.Nombre_Medico || '',
      fecha: dateOnly(c.Fecha_Programada)
    };
  });

  // Hospitalización (para fechas y habitación)
  var hosps = sheetToObjects(SHEETS.HOSPITALIZACIONES).filter(function (h) {
    return String(h.ID_Paciente) === String(idPaciente);
  });
  hosps.sort(function (a, b) { return dateOnly(b.Fecha_Ingreso).localeCompare(dateOnly(a.Fecha_Ingreso)); });
  var hosp = hosps[0];

  var fechaIngreso = '';
  if (cxs.length) fechaIngreso = dateOnly(cxs[cxs.length - 1].Fecha_Programada); // primera cirugía
  if (!fechaIngreso && hosp) fechaIngreso = dateOnly(hosp.Fecha_Ingreso);
  if (!fechaIngreso) fechaIngreso = dateOnly(pac.Fecha_Ingreso);

  var fechaEgreso = hosp ? dateOnly(hosp.Fecha_Egreso) : '';

  var habitacion = '';
  if (hosp && (hosp.Tipo_Habitacion || hosp.Numero_Habitacion)) {
    habitacion = String(hosp.Tipo_Habitacion || '') + (hosp.Numero_Habitacion ? ' | ' + hosp.Numero_Habitacion : '');
    habitacion = habitacion.trim();
  } else if (pac.Habitacion_Asignada) {
    habitacion = pac.Habitacion_Asignada;
  }

  var paciente = {
    idPaciente: pac.ID_Paciente,
    nombrePaciente: pac.Nombre_Completo,
    expediente: pac.ID_Paciente,           // por defecto el expediente = ID del paciente
    curp: pac.CURP || '',
    edad: pac.Edad || '',
    telefono: pac.Telefono_1 || '',
    tipoCliente: pac.Tipo_Cliente || '',
    habitacion: habitacion,
    fechaIngreso: fechaIngreso,
    fechaEgreso: fechaEgreso
  };

  // ¿Ya tiene una cuenta de caja empezada?
  var cuentaExistente = leerCuentaCaja(pac.ID_Paciente) || leerCuentaCajaPorExpediente(pac.ID_Paciente);

  // Total cobrable de materiales/medicamentos consumidos (remisión) para
  // auto-alimentar el campo Materiales_Medicamentos de la cuenta.
  var materialesRemision = totalRemisionMateriales_(pac.ID_Paciente);

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

  return { ok: true, paciente: paciente, cirugias: cirugias, cuentaExistente: cuentaExistente,
           materialesRemision: materialesRemision, cargosPorConcepto: cargosPorConcepto,
           hospitalizacionCalculada: hospitalizacionCalculada, diasEstancia: diasEstancia,
           totalConsumoValorado: totalConsumoValorado };
}

function leerCuentaCajaPorExpediente(expediente) {
  ensureCajaSheet();
  var rows = sheetToObjects(SHEETS.CAJA).filter(function (r) {
    return String(r.Expediente) === String(expediente) && String(r.Estado).toUpperCase() !== 'CANCELADO';
  });
  return rows.length ? cuentaRowToObj(rows[0]) : null;
}

function leerCuentaCaja(idPaciente) {
  ensureCajaSheet();
  var rows = sheetToObjects(SHEETS.CAJA).filter(function (r) {
    return String(r.ID_Paciente) === String(idPaciente) && String(r.Estado).toUpperCase() !== 'CANCELADO';
  });
  return rows.length ? cuentaRowToObj(rows[0]) : null;
}

/** ¿La cuenta del paciente está CERRADA? (no admite más consumos/remisión). */
function cuentaCerrada_(idPaciente) {
  if (!idPaciente) return false;
  ensureCajaSheet();
  return sheetToObjects(SHEETS.CAJA).some(function (r) {
    return String(r.ID_Paciente) === String(idPaciente) && String(r.Estado).toUpperCase() === 'CERRADA';
  });
}

/** Cambia el Estado de la cuenta de caja del paciente (CERRADA / ACTIVO). */
function setEstadoCuenta_(idPaciente, nuevoEstado) {
  var sh = getSheet(SHEETS.CAJA);
  var data = sh.getDataRange().getValues();
  var H = data[0];
  var cPac = H.indexOf('ID_Paciente');
  var cEstado = H.indexOf('Estado');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][cPac]) === String(idPaciente) && String(data[i][cEstado]).toUpperCase() !== 'CANCELADO') {
      sh.getRange(i + 1, cEstado + 1).setValue(nuevoEstado);
      return true;
    }
  }
  return false;
}

/**
 * Cierra la cuenta del paciente al alta: marca la cuenta de caja como CERRADA.
 * A partir de aquí no se aceptan más consumos (remisión) hasta reabrir.
 * Requiere que ya exista la cuenta de caja (que el cajero la haya guardado).
 */
function cerrarCuentaCobro(d) {
  if (!tienePermiso(d.rolUsuario, 'cobro_caja')) return errorSinPermiso(d.rolUsuario, 'cobro_caja');
  if (!d.idPaciente) return { ok: false, error: 'Paciente requerido' };
  if (!leerCuentaCaja(d.idPaciente)) {
    return { ok: false, error: 'Primero guarda la cuenta de caja del paciente; luego se puede cerrar.' };
  }
  if (!setEstadoCuenta_(d.idPaciente, 'CERRADA')) return { ok: false, error: 'No se encontró la cuenta a cerrar.' };
  return { ok: true, estado: 'CERRADA' };
}

/** Reabre una cuenta CERRADA (para corregir/agregar consumos). */
function reabrirCuentaCobro(d) {
  if (!tienePermiso(d.rolUsuario, 'cobro_caja')) return errorSinPermiso(d.rolUsuario, 'cobro_caja');
  if (!d.idPaciente) return { ok: false, error: 'Paciente requerido' };
  if (!setEstadoCuenta_(d.idPaciente, 'ACTIVO')) return { ok: false, error: 'No se encontró la cuenta a reabrir.' };
  return { ok: true, estado: 'ACTIVO' };
}

// Convierte una fila de la pestaña Caja al objeto que espera el frontend
function cuentaRowToObj(r) {
  return {
    expediente: r.Expediente,
    idPaciente: r.ID_Paciente,
    nombrePaciente: r.Nombre_Paciente,
    factura: r.Factura,
    fechaIngreso: dateOnly(r.Fecha_Ingreso),
    fechaEgreso: dateOnly(r.Fecha_Egreso),
    tipoCliente: r.Tipo_Cliente,
    habitacion: r.Habitacion,
    cirugias: (function () { try { return JSON.parse(r.Cirugias_JSON || '[]'); } catch (e) { return []; } })(),
    hospitalizacion: cajaNum(r.Hospitalizacion),
    consultaExterna: cajaNum(r.Consulta_Externa),
    horaExtra: cajaNum(r.Hora_Extra),
    diaExtra: cajaNum(r.Dia_Extra),
    materialesYMedicamentos: cajaNum(r.Materiales_Medicamentos),
    oxigeno: cajaNum(r.Oxigeno),
    paqueteGlobular: cajaNum(r.Paquete_Globular),
    nocheTerapia: cajaNum(r.Noche_Terapia),
    bombaInfusion: cajaNum(r.Bomba_Infusion),
    fluoroscopio: cajaNum(r.Fluoroscopio),
    laparoscopio: cajaNum(r.Laparoscopio),
    artroscopio: cajaNum(r.Artroscopio),
    ligasure: cajaNum(r.Ligasure),
    ambulancia: cajaNum(r.Ambulancia),
    monitor: cajaNum(r.Monitor),
    ventilador: cajaNum(r.Ventilador),
    laboratorioDinero: cajaNum(r.Laboratorio),
    imagenDinero: cajaNum(r.Imagen),
    anestesiaMixta: cajaNum(r.Anestesia_Mixta),
    cirujano: r.Cirujano,
    honCirujano: cajaNum(r.Hon_Cirujano),
    primerAyudante: r.Primer_Ayudante,
    hon1erAyudante: cajaNum(r.Hon_1er_Ayudante),
    segundoAyudante: r.Segundo_Ayudante,
    hon2doAyudante: cajaNum(r.Hon_2do_Ayudante),
    anestesiologo: r.Anestesiologo,
    honAnestesiologo: cajaNum(r.Hon_Anestesiologo),
    patologo: r.Patologo,
    honPatologo: cajaNum(r.Hon_Patologo),
    medicoInternista: r.Medico_Internista,
    honMedicoInternista: cajaNum(r.Hon_Medico_Internista),
    otrosMedicos: r.Otros_Medicos,
    honOtrosMedicos: cajaNum(r.Hon_Otros_Medicos),
    detDepositoEfectivo: r.Det_Deposito_Efectivo,
    detDepositoTD: r.Det_Deposito_TD,
    detDepositoTC: r.Det_Deposito_TC,
    detDepositoTransferencia: r.Det_Deposito_Transferencia,
    detPagoEfectivo: r.Det_Pago_Efectivo,
    detPagoTD: r.Det_Pago_TD,
    detPagoTC: r.Det_Pago_TC,
    detPagoTransferencia: r.Det_Pago_Transferencia,
    operacion: esVerdadero(r.Operacion),
    aplicarComision: esVerdadero(r.Aplicar_Comision),
    estado: r.Estado || 'ACTIVO'
  };
}

function esVerdadero(v) {
  if (v === true) return true;
  var s = String(v == null ? '' : v).trim().toUpperCase();
  return s === 'TRUE' || s === 'SI' || s === 'SÍ' || s === 'X' || s === '1';
}

// ------------------------------------------------------------
// GUARDAR / ACTUALIZAR LA CUENTA DE CAJA
// ------------------------------------------------------------
function guardarIngreso(d) {
  if (!tienePermiso(d.rolUsuario, 'cobro_caja')) {
    return errorSinPermiso(d.rolUsuario, 'cobro_caja');
  }

  var expediente = String(d.expediente || d.idPaciente || '').trim();
  if (!expediente) return { ok: false, error: 'Falta el número de expediente.' };
  if (!d.nombrePaciente) return { ok: false, error: 'Falta el nombre del paciente.' };

  var aplicaComision = !!d.aplicarComision;

  // Detalles de depósitos/pagos agrupados por forma de pago.
  // Depósitos con TD/TC y comisión activa se guardan ya "inflados"
  // (lo que cobró la terminal); el frontend revierte ×0.96 al recargar.
  // Los pagos finales se guardan en base (el frontend reaplica la comisión).
  var dep = construirDetalles(d.depositos || [], aplicaComision);
  var pag = construirDetalles(d.pagos || [], false);

  // Totales (autoritativos para reporte)
  var totalCuenta = cajaRound(
    cajaNum(d.hospitalizacion) + cajaNum(d.consultaExterna) + cajaNum(d.horaExtra) +
    cajaNum(d.diaExtra) + cajaNum(d.materialesYMedicamentos) + cajaNum(d.oxigeno) +
    cajaNum(d.paqueteGlobular) + cajaNum(d.nocheTerapia) +
    cajaNum(d.bombaInfusion) + cajaNum(d.fluoroscopio) + cajaNum(d.laparoscopio) +
    cajaNum(d.artroscopio) + cajaNum(d.ligasure) + cajaNum(d.ambulancia) +
    cajaNum(d.monitor) + cajaNum(d.ventilador) +
    cajaNum(d.laboratorioDinero) + cajaNum(d.imagenDinero) + cajaNum(d.anestesiaMixta) +
    cajaNum(d.honCirujano) + cajaNum(d.hon1erAyudante) + cajaNum(d.hon2doAyudante) +
    cajaNum(d.honAnestesiologo) + cajaNum(d.honPatologo) + cajaNum(d.honMedicoInternista) +
    cajaNum(d.honOtrosMedicos)
  );

  var resumenDep = resumenMovs(d.depositos || [], aplicaComision);
  var resumenPag = resumenMovs(d.pagos || [], aplicaComision);
  var abonado = cajaRound(resumenDep.base + resumenPag.base);
  var comisionTotal = cajaRound(resumenDep.comision + resumenPag.comision);
  var saldo = cajaRound(totalCuenta - abonado);
  if (Math.abs(saldo) <= 0.01) saldo = 0;

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = ensureCajaSheet();
    var data = sh.getDataRange().getValues();
    var headers = data[0];
    var colExp = headers.indexOf('Expediente');

    var filaExistente = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][colExp]) === expediente) { filaExistente = i; break; }
    }

    var ahora = nowTs();
    var registro = {
      'Expediente': expediente,
      'ID_Paciente': d.idPaciente || '',
      'Nombre_Paciente': d.nombrePaciente || '',
      'Factura': d.factura || '',
      'Fecha_Ingreso': d.fechaIngreso || '',
      'Fecha_Egreso': d.fechaEgreso || '',
      'Tipo_Cliente': d.tipoCliente || '',
      'Habitacion': d.habitacion || '',
      'Cirugias_JSON': JSON.stringify(d.cirugias || []),
      'Hospitalizacion': cajaNum(d.hospitalizacion),
      'Consulta_Externa': cajaNum(d.consultaExterna),
      'Hora_Extra': cajaNum(d.horaExtra),
      'Dia_Extra': cajaNum(d.diaExtra),
      'Materiales_Medicamentos': cajaNum(d.materialesYMedicamentos),
      'Oxigeno': cajaNum(d.oxigeno),
      'Paquete_Globular': cajaNum(d.paqueteGlobular),
      'Noche_Terapia': cajaNum(d.nocheTerapia),
      'Bomba_Infusion': cajaNum(d.bombaInfusion),
      'Fluoroscopio': cajaNum(d.fluoroscopio),
      'Laparoscopio': cajaNum(d.laparoscopio),
      'Artroscopio': cajaNum(d.artroscopio),
      'Ligasure': cajaNum(d.ligasure),
      'Ambulancia': cajaNum(d.ambulancia),
      'Monitor': cajaNum(d.monitor),
      'Ventilador': cajaNum(d.ventilador),
      'Laboratorio': cajaNum(d.laboratorioDinero),
      'Imagen': cajaNum(d.imagenDinero),
      'Anestesia_Mixta': cajaNum(d.anestesiaMixta),
      'Cirujano': d.cirujano || '',
      'Hon_Cirujano': cajaNum(d.honCirujano),
      'Primer_Ayudante': d.primerAyudante || '',
      'Hon_1er_Ayudante': cajaNum(d.hon1erAyudante),
      'Segundo_Ayudante': d.segundoAyudante || '',
      'Hon_2do_Ayudante': cajaNum(d.hon2doAyudante),
      'Anestesiologo': d.anestesiologo || '',
      'Hon_Anestesiologo': cajaNum(d.honAnestesiologo),
      'Patologo': d.patologo || '',
      'Hon_Patologo': cajaNum(d.honPatologo),
      'Medico_Internista': d.medicoInternista || '',
      'Hon_Medico_Internista': cajaNum(d.honMedicoInternista),
      'Otros_Medicos': d.otrosMedicos || '',
      'Hon_Otros_Medicos': cajaNum(d.honOtrosMedicos),
      'Det_Deposito_Efectivo': dep.EFECTIVO,
      'Det_Deposito_TD': dep.TD,
      'Det_Deposito_TC': dep.TC,
      'Det_Deposito_Transferencia': dep.TRANSFERENCIA,
      'Det_Pago_Efectivo': pag.EFECTIVO,
      'Det_Pago_TD': pag.TD,
      'Det_Pago_TC': pag.TC,
      'Det_Pago_Transferencia': pag.TRANSFERENCIA,
      'Operacion': d.operacion ? 'SI' : 'NO',
      'Aplicar_Comision': aplicaComision ? 'SI' : 'NO',
      'Total_Cuenta': totalCuenta,
      'Total_Abonado': abonado,
      'Saldo_Pendiente': saldo,
      'Comision_Total': comisionTotal,
      'Capturado_Por': d.capturadoPor || '',
      'Estado': 'ACTIVO'
    };

    var actualizado = false;
    if (filaExistente !== -1) {
      // Conservar el timestamp de creación
      var colCrea = headers.indexOf('Timestamp_Creacion');
      registro['Timestamp_Creacion'] = data[filaExistente][colCrea] || ahora;
      registro['Timestamp_Actualizacion'] = ahora;
      var fila = headers.map(function (h) { return registro.hasOwnProperty(h) ? registro[h] : data[filaExistente][headers.indexOf(h)]; });
      sh.getRange(filaExistente + 1, 1, 1, headers.length).setValues([fila]);
      actualizado = true;
    } else {
      registro['Timestamp_Creacion'] = ahora;
      registro['Timestamp_Actualizacion'] = ahora;
      var nueva = headers.map(function (h) { return registro.hasOwnProperty(h) ? registro[h] : ''; });
      sh.appendRow(nueva);
    }

    return {
      ok: true, expediente: expediente, actualizado: actualizado,
      totalCuenta: totalCuenta, saldoPendiente: saldo, comisionTotal: comisionTotal
    };
  } finally {
    lock.releaseLock();
  }
}

// Agrupa una lista de movimientos en cadenas de detalle por forma de pago.
// Para TD/TC con gross-up, guarda el monto inflado (lo que cobró la terminal).
function construirDetalles(lista, aplicaGrossUp) {
  var grupos = { EFECTIVO: [], TD: [], TC: [], TRANSFERENCIA: [] };
  (lista || []).forEach(function (mov) {
    var tipo = String(mov.tipo || '').toUpperCase();
    if (!grupos.hasOwnProperty(tipo)) return;
    var base = cajaNum(mov.monto);
    if (base <= 0) return;
    var monto = base;
    if (aplicaGrossUp && (tipo === 'TD' || tipo === 'TC')) {
      monto = cajaRound(base / FACTOR_COMISION_CAJA);
    }
    var txt = monto.toFixed(2) + (mov.banco ? ' (' + mov.banco + ')' : '');
    grupos[tipo].push(txt);
  });
  return {
    EFECTIVO: grupos.EFECTIVO.join(' + '),
    TD: grupos.TD.join(' + '),
    TC: grupos.TC.join(' + '),
    TRANSFERENCIA: grupos.TRANSFERENCIA.join(' + ')
  };
}

// Suma base y comisión de una lista de movimientos.
function resumenMovs(lista, aplicaGrossUp) {
  var base = 0, comision = 0;
  (lista || []).forEach(function (mov) {
    var tipo = String(mov.tipo || '').toUpperCase();
    var b = cajaNum(mov.monto);
    if (b <= 0) return;
    base += b;
    if (aplicaGrossUp && (tipo === 'TD' || tipo === 'TC')) {
      comision += cajaRound(b / FACTOR_COMISION_CAJA) - b;
    }
  });
  return { base: cajaRound(base), comision: cajaRound(comision) };
}


// ============================================================
// REGISTRO DE VENTAS (proyección de la pestaña Caja)
// ------------------------------------------------------------
// Cada cobro guardado en "Caja" es una venta. Aquí se proyecta
// a un renglón plano estilo la pestaña "Ingresos" del archivo de
// relación I y G: conceptos, total, forma(s) de pago, banco(s),
// comisión y dimensiones de tiempo (semana/año/día/mes).
// NO calcula precios ni repartos "Clínica" (eso es fase posterior).
// ============================================================

var VENTA_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
var VENTA_DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function ventaMesNombre(d) {
  if (!d) return '';
  var dt = ventaParseFecha(d);
  return dt ? VENTA_MESES[dt.getMonth()] : '';
}
function ventaDiaNombre(d) {
  var dt = ventaParseFecha(d);
  return dt ? VENTA_DIAS[dt.getDay()] : '';
}
function ventaAnio(d) {
  var dt = ventaParseFecha(d);
  return dt ? dt.getFullYear() : '';
}
// Semana estilo Excel WEEKNUM(fecha, 2): semanas inician lunes.
function ventaSemana(d) {
  var dt = ventaParseFecha(d);
  if (!dt) return '';
  var jan1 = new Date(dt.getFullYear(), 0, 1);
  var dias = Math.floor((dt - jan1) / 86400000);
  var jan1Dow = (jan1.getDay() + 6) % 7; // Lunes=0 .. Domingo=6
  return Math.floor((dias + jan1Dow) / 7) + 1;
}
function ventaParseFecha(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  var s = String(v).substring(0, 10);
  var p = s.split('-');
  if (p.length === 3) return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  return null;
}

// Resume las formas de pago y bancos a partir de las columnas de detalle.
function ventaResumenPago(r) {
  var formas = [];
  var bancos = [];
  var defs = [
    ['Det_Deposito_Efectivo', 'EFECTIVO'], ['Det_Pago_Efectivo', 'EFECTIVO'],
    ['Det_Deposito_TD', 'TARJETA DE DEBITO'], ['Det_Pago_TD', 'TARJETA DE DEBITO'],
    ['Det_Deposito_TC', 'TARJETA DE CREDITO'], ['Det_Pago_TC', 'TARJETA DE CREDITO'],
    ['Det_Deposito_Transferencia', 'TRANSFERENCIA'], ['Det_Pago_Transferencia', 'TRANSFERENCIA']
  ];
  defs.forEach(function (d) {
    var val = String(r[d[0]] || '').trim();
    if (val) {
      if (formas.indexOf(d[1]) === -1) formas.push(d[1]);
      var m = val.match(/\(([^)]+)\)/g);
      if (m) m.forEach(function (b) {
        var banco = b.replace(/[()]/g, '').trim();
        if (banco && bancos.indexOf(banco) === -1) bancos.push(banco);
      });
    }
  });
  return { formaPago: formas.join(' + '), banco: bancos.join(' + ') };
}

function getIngresos(desde, hasta) {
  ensureCajaSheet();
  var rows = sheetToObjects(SHEETS.CAJA).filter(function (r) {
    return String(r.Estado).toUpperCase() !== 'CANCELADO' && (r.Expediente || r.Nombre_Paciente);
  });

  var data = rows.map(function (r) {
    var pago = ventaResumenPago(r);
    var fechaEgreso = dateOnly(r.Fecha_Egreso);
    var fechaIngreso = dateOnly(r.Fecha_Ingreso);
    var fechaBase = fechaEgreso || fechaIngreso;          // base de la estadística
    var fechaPago = dateOnly(r.Timestamp_Actualizacion) || fechaBase;

    // Cirugía / especialidad: del primer elemento del JSON de cirugías
    var cirugia = '', especialidad = '';
    try {
      var cxs = JSON.parse(r.Cirugias_JSON || '[]');
      if (cxs.length) { cirugia = cxs[0].cirugia || ''; especialidad = cxs[0].especialidad || ''; }
    } catch (e) {}

    var honorarios = cajaNum(r.Hon_Cirujano) + cajaNum(r.Hon_1er_Ayudante) + cajaNum(r.Hon_2do_Ayudante) +
      cajaNum(r.Hon_Anestesiologo) + cajaNum(r.Hon_Patologo) + cajaNum(r.Hon_Medico_Internista) +
      cajaNum(r.Hon_Otros_Medicos);

    return {
      expediente: r.Expediente,
      idPaciente: r.ID_Paciente,
      nombrePaciente: r.Nombre_Paciente,
      tipoCliente: r.Tipo_Cliente,
      cirugia: cirugia,
      especialidad: especialidad,
      fechaIngreso: fechaIngreso,
      fechaEgreso: fechaEgreso,
      // Conceptos (montos crudos, tal como se capturaron)
      hospitalizacion: cajaNum(r.Hospitalizacion),
      consultasUrgencias: cajaNum(r.Consulta_Externa),
      horaExtra: cajaNum(r.Hora_Extra),
      diaExtra: cajaNum(r.Dia_Extra),
      materiales: cajaNum(r.Materiales_Medicamentos),
      ambulancia: cajaNum(r.Ambulancia),
      monitor: cajaNum(r.Monitor),
      ventilador: cajaNum(r.Ventilador),
      nocheTerapia: cajaNum(r.Noche_Terapia),
      oxigeno: cajaNum(r.Oxigeno),
      bombaInfusion: cajaNum(r.Bomba_Infusion),
      paqueteGlobular: cajaNum(r.Paquete_Globular),
      laboratorio: cajaNum(r.Laboratorio),
      imagen: cajaNum(r.Imagen),
      honorariosMedicos: cajaRound(honorarios),
      rentaArtroscopio: cajaNum(r.Artroscopio),
      rentaLaparoscopio: cajaNum(r.Laparoscopio),
      fluoroscopio: cajaNum(r.Fluoroscopio),
      ligasure: cajaNum(r.Ligasure),
      anestesiaMixta: cajaNum(r.Anestesia_Mixta),
      // Totales y pago
      total: cajaNum(r.Total_Cuenta),
      abonado: cajaNum(r.Total_Abonado),
      saldoPendiente: cajaNum(r.Saldo_Pendiente),
      formaPago: pago.formaPago,
      banco: pago.banco,
      comision: cajaNum(r.Comision_Total),
      facturado: '',                       // "SE FACTURA": se llenará en fase posterior
      comentarios: '',
      // Dimensiones de tiempo
      semana: ventaSemana(fechaBase),
      anio: ventaAnio(fechaBase),
      dia: ventaDiaNombre(fechaBase),
      mes: ventaMesNombre(fechaBase),
      mesPago: ventaMesNombre(fechaPago),
      capturadoPor: r.Capturado_Por,
      _fechaFiltro: fechaBase
    };
  });

  var out = data;
  if (desde) out = out.filter(function (v) { return v._fechaFiltro && v._fechaFiltro >= desde; });
  if (hasta) out = out.filter(function (v) { return v._fechaFiltro && v._fechaFiltro <= hasta; });
  out.sort(function (a, b) { return String(b._fechaFiltro).localeCompare(String(a._fechaFiltro)); });

  // Total del periodo (suma de ventas), para encabezado
  var totalPeriodo = 0;
  out.forEach(function (v) { totalPeriodo += v.total; });

  return { ok: true, data: out, totalPeriodo: cajaRound(totalPeriodo), conteo: out.length };
}

// ============================================================
// MÓDULO BOM — CICLO DE VIDA
// SOLICITADO -> PROPUESTO -> AUTORIZADO -> ENTREGADO
// RECHAZADO regresa a PROPUESTO. La entrega se habilita al AUTORIZAR (director).
// ============================================================

/** Lee las partidas de plantilla activas de un paquete. */
function getBOMPlantilla(clavePaquete) {
  ensureBOMSheets_();
  var rows = sheetToObjects(SHEETS.BOM_PLANTILLA).filter(function (r) {
    return String(r.Clave_Paquete) === String(clavePaquete) && esActivo(r.Activo);
  });
  return { ok: true, items: rows };
}

/**
 * Administración de paquetes de BOM: devuelve TODOS los paquetes (activos e
 * inactivos) con el conteo de partidas activas de cada uno. Lo usa la pantalla
 * de Catálogos para listar y editar los paquetes.
 */
function getPaquetesAdmin() {
  ensureBOMSheets_();
  var plantilla = sheetToObjects(SHEETS.BOM_PLANTILLA);
  var conteo = {};
  plantilla.forEach(function (r) {
    if (!esActivo(r.Activo)) return;
    var k = String(r.Clave_Paquete).trim().toUpperCase();
    conteo[k] = (conteo[k] || 0) + 1;
  });
  var lista = sheetToObjects(SHEETS.PAQUETES).map(function (p) {
    var k = String(p.Clave_Paquete).trim().toUpperCase();
    return {
      Clave_Paquete: p.Clave_Paquete,
      Nombre_Paquete: p.Nombre_Paquete,
      Especialidad: p.Especialidad,
      Activo: esActivo(p.Activo),
      items: conteo[k] || 0
    };
  });
  return { ok: true, paquetes: lista };
}

/**
 * Crea o actualiza la cabecera de un paquete de BOM (hoja CAT_Paquetes).
 * La clave es la llave: si ya existe se actualiza nombre/especialidad/activo,
 * si no, se agrega una fila nueva.
 */
function guardarPaquete(d) {
  if (!tienePermiso(d.rolUsuario, 'editar_plantilla_bom')) {
    return errorSinPermiso(d.rolUsuario, 'editar_plantilla_bom');
  }
  var clave = String(d.clave || '').trim().toUpperCase();
  if (!clave) return { ok: false, error: 'La clave del paquete es obligatoria' };
  if (!d.nombre || !String(d.nombre).trim()) return { ok: false, error: 'El nombre del paquete es obligatorio' };
  ensureBOMSheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet(SHEETS.PAQUETES);
    var data = sh.getDataRange().getValues();
    var H = data[0];
    var cClave = H.indexOf('Clave_Paquete'), cNom = H.indexOf('Nombre_Paquete'),
        cEsp = H.indexOf('Especialidad'), cAct = H.indexOf('Activo');
    var activoStr = (d.activo === false || String(d.activo).toUpperCase() === 'NO') ? 'NO' : 'SI';
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][cClave]).trim().toUpperCase() === clave) {
        sh.getRange(i + 1, cNom + 1).setValue(String(d.nombre).trim());
        if (cEsp !== -1) sh.getRange(i + 1, cEsp + 1).setValue(d.especialidad || '');
        if (cAct !== -1) sh.getRange(i + 1, cAct + 1).setValue(activoStr);
        return { ok: true, clave: clave, creado: false };
      }
    }
    appendRowByHeader(SHEETS.PAQUETES, {
      Clave_Paquete: clave,
      Nombre_Paquete: String(d.nombre).trim(),
      Especialidad: d.especialidad || '',
      Activo: activoStr
    });
    return { ok: true, clave: clave, creado: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Reemplaza las partidas de plantilla (materiales/medicamentos) de un paquete.
 * Borra las filas existentes de esa clave en BOM_Plantilla_Items y vuelve a
 * escribir las que llegan en d.items, numerando el Orden. Solo guarda partidas
 * con descripción.
 */
function guardarPlantillaBOM(d) {
  if (!tienePermiso(d.rolUsuario, 'editar_plantilla_bom')) {
    return errorSinPermiso(d.rolUsuario, 'editar_plantilla_bom');
  }
  var clave = String(d.clave || '').trim().toUpperCase();
  if (!clave) return { ok: false, error: 'Falta la clave del paquete' };
  var items = Array.isArray(d.items) ? d.items : [];
  ensureBOMSheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getSheet(SHEETS.BOM_PLANTILLA);
    var data = sh.getDataRange().getValues();
    var cClave = data[0].indexOf('Clave_Paquete');
    // Borrar de abajo hacia arriba las partidas previas de esta clave.
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][cClave]).trim().toUpperCase() === clave) sh.deleteRow(i + 1);
    }
    var n = 0;
    items.forEach(function (it) {
      var desc = String(it.descripcion != null ? it.descripcion : (it.Descripcion || '')).trim();
      if (!desc) return;
      n++;
      appendRowByHeader(SHEETS.BOM_PLANTILLA, {
        Clave_Paquete: clave,
        Tipo_Item: it.tipo || it.Tipo_Item || '',
        Codigo: it.codigo || it.Codigo || '',
        Descripcion: desc,
        Cantidad_S: it.cantidad != null ? it.cantidad : (it.Cantidad_S || ''),
        Unidad: it.unidad || it.Unidad || '',
        Orden: n,
        Activo: 'SI'
      });
    });
    return { ok: true, clave: clave, partidas: n };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// MÓDULO PEDIDOS — solicitudes de material de enfermería
// ------------------------------------------------------------
// Flujo: enfermería arma un pedido por paciente (cabecera + partidas) ->
// almacén lo ve y lo surte. Estados: SOLICITADO -> SURTIDO (o CANCELADO).
// NOTA: en esta etapa "surtir" solo registra quién/cuándo preparó el pedido;
// el descuento de inventario y el cobro siguen por la remisión hasta que se
// integre el escaneo de código de barras (siguiente etapa de la minuta).
// ============================================================
var PEDIDOS_HEADERS = ['ID_Pedido','Folio','Fecha','ID_Paciente','Nombre_Paciente','Origen',
  'Folio_Cirugia','Ubicacion_Texto','Estado','Solicitado_Por','Timestamp_Solicitud',
  'Observaciones','Surtido_Por','Timestamp_Surtido'];
var PEDIDO_ITEMS_HEADERS = ['ID_Pedido_Item','ID_Pedido','ID_Articulo','Codigo','Descripcion',
  'Categoria','Unidad','Cantidad_Solicitada','Cantidad_Surtida','Estado_Item'];

function ensurePedidosSheets_() {
  ensureSheetConHeaders_(SHEETS.PEDIDOS, PEDIDOS_HEADERS);
  ensureSheetConHeaders_(SHEETS.PEDIDO_ITEMS, PEDIDO_ITEMS_HEADERS);
}

/** Siguiente folio PED-#### (escanea el máximo existente). */
function siguienteFolioPedido_() {
  var num = 0;
  sheetToObjects(SHEETS.PEDIDOS).forEach(function (p) {
    var m = String(p.ID_Pedido || '').match(/^PED-(\d+)$/);
    if (m) num = Math.max(num, parseInt(m[1], 10) || 0);
  });
  return 'PED-' + String(num + 1).padStart(4, '0');
}

/** Crea un pedido (cabecera + partidas). Lo usa enfermería. */
function crearPedido(d) {
  if (!tienePermiso(d.rolUsuario, 'crear_pedido')) {
    return errorSinPermiso(d.rolUsuario, 'crear_pedido');
  }
  if (!d.idPaciente) return { ok: false, error: 'Falta el paciente del pedido' };
  var items = Array.isArray(d.items) ? d.items.filter(function (it) {
    return it && it.idArticulo && (parseFloat(it.cantidad) || 0) > 0;
  }) : [];
  if (!items.length) return { ok: false, error: 'Agrega al menos un artículo con cantidad' };

  ensurePedidosSheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var id = siguienteFolioPedido_();
    appendRowByHeader(SHEETS.PEDIDOS, {
      ID_Pedido: id,
      Folio: id,
      Fecha: todayStr(),
      ID_Paciente: d.idPaciente,
      Nombre_Paciente: d.nombrePaciente || '',
      Origen: d.origen || '',
      Folio_Cirugia: d.folioCirugia || '',
      Ubicacion_Texto: d.ubicacionTexto || '',
      Estado: 'SOLICITADO',
      Solicitado_Por: d.solicitadoPor || d.rolUsuario || '',
      Timestamp_Solicitud: nowTs(),
      Observaciones: d.observaciones || '',
      Surtido_Por: '',
      Timestamp_Surtido: ''
    });
    var n = 0;
    items.forEach(function (it) {
      n++;
      appendRowByHeader(SHEETS.PEDIDO_ITEMS, {
        ID_Pedido_Item: id + '-' + String(n).padStart(3, '0'),
        ID_Pedido: id,
        ID_Articulo: it.idArticulo,
        Codigo: it.codigo || '',
        Descripcion: it.descripcion || '',
        Categoria: it.categoria || '',
        Unidad: it.unidad || '',
        Cantidad_Solicitada: parseFloat(it.cantidad) || 0,
        Cantidad_Surtida: '',
        Estado_Item: 'SOLICITADO'
      });
    });
    return { ok: true, idPedido: id, partidas: n };
  } finally {
    lock.releaseLock();
  }
}

/** Lista de pedidos (cabecera + nº de partidas), filtrable por estado/fechas. */
function getPedidos(estado, desde, hasta) {
  ensurePedidosSheets_();
  var items = sheetToObjects(SHEETS.PEDIDO_ITEMS);
  var conteo = {};
  items.forEach(function (it) {
    var k = String(it.ID_Pedido);
    conteo[k] = (conteo[k] || 0) + 1;
  });
  var filtroEstado = estado ? String(estado).toUpperCase() : '';
  var lista = sheetToObjects(SHEETS.PEDIDOS).map(function (p) {
    return {
      idPedido: p.ID_Pedido,
      folio: p.Folio || p.ID_Pedido,
      fecha: dateOnly(p.Fecha),
      idPaciente: p.ID_Paciente,
      nombrePaciente: p.Nombre_Paciente,
      origen: p.Origen,
      folioCirugia: p.Folio_Cirugia,
      ubicacionTexto: p.Ubicacion_Texto,
      estado: String(p.Estado || 'SOLICITADO').toUpperCase(),
      solicitadoPor: p.Solicitado_Por,
      timestampSolicitud: p.Timestamp_Solicitud,
      surtidoPor: p.Surtido_Por,
      observaciones: p.Observaciones,
      partidas: conteo[String(p.ID_Pedido)] || 0
    };
  }).filter(function (p) {
    if (filtroEstado && filtroEstado !== 'TODOS' && p.estado !== filtroEstado) return false;
    if (desde && String(p.fecha) < String(desde)) return false;
    if (hasta && String(p.fecha) > String(hasta)) return false;
    return true;
  });
  // Más recientes primero
  lista.sort(function (a, b) { return String(b.timestampSolicitud).localeCompare(String(a.timestampSolicitud)); });
  return { ok: true, pedidos: lista };
}

/** Detalle de un pedido (cabecera + partidas). */
function getPedido(idPedido) {
  ensurePedidosSheets_();
  var cab = sheetToObjects(SHEETS.PEDIDOS).filter(function (p) { return String(p.ID_Pedido) === String(idPedido); })[0];
  if (!cab) return { ok: false, error: 'Pedido no encontrado: ' + idPedido };
  var items = sheetToObjects(SHEETS.PEDIDO_ITEMS).filter(function (it) { return String(it.ID_Pedido) === String(idPedido); });
  return { ok: true, cabecera: cab, items: items };
}

/** Cambia el estado de un pedido a un valor de columna en la hoja Pedidos. */
function setEstadoPedido_(idPedido, nuevoEstado, usuario) {
  var sh = getSheet(SHEETS.PEDIDOS);
  var data = sh.getDataRange().getValues();
  var H = data[0];
  var cId = H.indexOf('ID_Pedido'), cEst = H.indexOf('Estado'),
      cSurtPor = H.indexOf('Surtido_Por'), cSurtTs = H.indexOf('Timestamp_Surtido');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][cId]) === String(idPedido)) {
      sh.getRange(i + 1, cEst + 1).setValue(nuevoEstado);
      if (nuevoEstado === 'SURTIDO') {
        if (cSurtPor !== -1) sh.getRange(i + 1, cSurtPor + 1).setValue(usuario || '');
        if (cSurtTs !== -1) sh.getRange(i + 1, cSurtTs + 1).setValue(nowTs());
      }
      return true;
    }
  }
  return false;
}

/** Marca un pedido como surtido (registro de quién/cuándo lo preparó). */
function surtirPedido(d) {
  if (!tienePermiso(d.rolUsuario, 'surtir_pedido')) {
    return errorSinPermiso(d.rolUsuario, 'surtir_pedido');
  }
  if (!d.idPedido) return { ok: false, error: 'Falta el pedido' };
  ensurePedidosSheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ok = setEstadoPedido_(d.idPedido, 'SURTIDO', d.realizadoPor || d.rolUsuario || '');
    if (!ok) return { ok: false, error: 'Pedido no encontrado: ' + d.idPedido };
    return { ok: true, idPedido: d.idPedido, estado: 'SURTIDO' };
  } finally {
    lock.releaseLock();
  }
}

/** Cancela un pedido. */
function cancelarPedido(d) {
  if (!tienePermiso(d.rolUsuario, 'cancelar_pedido')) {
    return errorSinPermiso(d.rolUsuario, 'cancelar_pedido');
  }
  if (!d.idPedido) return { ok: false, error: 'Falta el pedido' };
  ensurePedidosSheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ok = setEstadoPedido_(d.idPedido, 'CANCELADO', d.rolUsuario || '');
    if (!ok) return { ok: false, error: 'Pedido no encontrado: ' + d.idPedido };
    return { ok: true, idPedido: d.idPedido, estado: 'CANCELADO' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lotes ABIERTOS con saldo de un artículo en un almacén, ordenados PEPS
 * (primeras entradas primeras salidas): por Fecha_Entrada asc, luego captura/ID.
 */
function lotesDisponiblesFIFO_(idArticulo, ubicacion) {
  var ubi = ubicacion || UBICACION_DEFAULT;
  var rows = sheetToObjects(SHEETS.LOTES).filter(function (l) {
    if (String(l.ID_Medicamento) !== String(idArticulo)) return false;
    if (String(l.Estado) !== 'ABIERTA') return false;
    if ((l.Ubicacion || UBICACION_DEFAULT) !== ubi) return false;
    var inicial = parseFloat(l.Cantidad_Inicial) || 0;
    var consumida = parseFloat(l.Cantidad_Consumida) || 0;
    var saldo = (l.Saldo === '' || l.Saldo == null) ? (inicial - consumida) : parseFloat(l.Saldo);
    l.__saldo = saldo;
    return saldo > 0;
  });
  rows.sort(function (a, b) {
    var fa = String(a.Fecha_Entrada || a.Timestamp_Captura || '');
    var fb = String(b.Fecha_Entrada || b.Timestamp_Captura || '');
    if (fa !== fb) return fa < fb ? -1 : 1;
    return String(a.ID_Lote).localeCompare(String(b.ID_Lote));
  });
  return rows;
}

/**
 * Reparte una cantidad entre lotes por PEPS. Devuelve {ok, asignaciones:[{idLote,cantidad}]}
 * o {ok:false, faltante} si el saldo por lote no alcanza en ese almacén.
 */
function asignarLotesFIFO_(idArticulo, cantidad, ubicacion) {
  var disp = lotesDisponiblesFIFO_(idArticulo, ubicacion);
  var restante = cantidad;
  var asign = [];
  for (var i = 0; i < disp.length && restante > 0.0001; i++) {
    var tomar = Math.min(restante, disp[i].__saldo);
    if (tomar > 0) { asign.push({ idLote: disp[i].ID_Lote, cantidad: tomar }); restante -= tomar; }
  }
  if (restante > 0.0001) return { ok: false, faltante: restante };
  return { ok: true, asignaciones: asign };
}

/**
 * Surte un pedido validado por escáner: descuenta del inventario y lo carga a
 * la cuenta del paciente (reutiliza registrarRemision), luego marca el pedido y
 * sus partidas como surtidas. d.items = [{idArticulo, cantidad, ubicacion, unidad}].
 * El lote NO se captura al surtir: para artículos con lote se asigna automático
 * por PEPS (FIFO) sobre el almacén elegido, partiendo en varios lotes si hace falta.
 */
function surtirPedidoConEscaneo(d) {
  if (!tienePermiso(d.rolUsuario, 'surtir_pedido')) {
    return errorSinPermiso(d.rolUsuario, 'surtir_pedido');
  }
  if (!d.idPedido) return { ok: false, error: 'Falta el pedido' };
  if (!d.idPaciente) return { ok: false, error: 'Falta el paciente del pedido' };
  var items = Array.isArray(d.items) ? d.items.filter(function (it) {
    return it && it.idArticulo && (parseFloat(it.cantidad) || 0) > 0;
  }) : [];
  if (!items.length) return { ok: false, error: 'No hay artículos surtidos para descontar' };

  // 1) Resolver lotes por PEPS: los artículos con lote se parten en uno o varios
  //    renglones (uno por lote) tomando primero el de entrada más antigua.
  var remItems = [];
  for (var x = 0; x < items.length; x++) {
    var it = items[x];
    var art = getArticuloRaw_(it.idArticulo);
    if (!art) return { ok: false, error: 'Artículo no encontrado: ' + it.idArticulo };
    var cant = parseFloat(it.cantidad) || 0;
    var ubic = it.ubicacion || UBICACION_DEFAULT;
    if (categoriaRequiereLote_(normCategoria_(art.Categoria))) {
      var fifo = asignarLotesFIFO_(it.idArticulo, cant, ubic);
      if (!fifo.ok) {
        return { ok: false, error: 'Saldo por lote insuficiente de "' + (art.Nombre || it.idArticulo) + '" en ese almacén (faltan ' + fifo.faltante + ' ' + (it.unidad || '') + ')' };
      }
      fifo.asignaciones.forEach(function (a) {
        remItems.push({ idArticulo: it.idArticulo, cantidad: a.cantidad, ubicacion: ubic, idLote: a.idLote, unidad: it.unidad || '' });
      });
    } else {
      remItems.push({ idArticulo: it.idArticulo, cantidad: cant, ubicacion: ubic, idLote: '', unidad: it.unidad || '' });
    }
  }

  // 2) Descuento de inventario + cobro a la cuenta del paciente (NO sostener lock:
  //    registrarRemision toma su propio ScriptLock).
  var rem = registrarRemision({
    rolUsuario: d.rolUsuario,
    idPaciente: d.idPaciente,
    nombrePaciente: d.nombrePaciente || '',
    origen: d.origen || '',
    folioCirugia: d.folioCirugia || '',
    idMedico: d.idMedico || '',
    nombreMedico: d.nombreMedico || '',
    items: remItems,
    capturadoPor: d.realizadoPor || d.rolUsuario || ''
  });
  if (!rem.ok) return rem;

  // 3) Marcar el pedido y sus partidas como surtidas.
  ensurePedidosSheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var surtPorArt = {};
    items.forEach(function (it) {
      var k = String(it.idArticulo);
      surtPorArt[k] = (surtPorArt[k] || 0) + (parseFloat(it.cantidad) || 0);
    });
    var shI = getSheet(SHEETS.PEDIDO_ITEMS);
    var di = shI.getDataRange().getValues();
    var HI = di[0];
    var cPed = HI.indexOf('ID_Pedido'), cArt = HI.indexOf('ID_Articulo'),
        cSur = HI.indexOf('Cantidad_Surtida'), cEstI = HI.indexOf('Estado_Item'),
        cSol = HI.indexOf('Cantidad_Solicitada');
    for (var i = 1; i < di.length; i++) {
      if (String(di[i][cPed]) === String(d.idPedido) && surtPorArt.hasOwnProperty(String(di[i][cArt]))) {
        var s = surtPorArt[String(di[i][cArt])];
        if (cSur !== -1) shI.getRange(i + 1, cSur + 1).setValue(s);
        if (cEstI !== -1) {
          var sol = parseFloat(di[i][cSol]) || 0;
          shI.getRange(i + 1, cEstI + 1).setValue(s >= sol ? 'SURTIDO' : 'PARCIAL');
        }
      }
    }
    setEstadoPedido_(d.idPedido, 'SURTIDO', d.realizadoPor || d.rolUsuario || '');
    return { ok: true, idPedido: d.idPedido, lineas: rem.lineas, totalCuentaMateriales: rem.totalCuentaMateriales };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Crea el BOM de una cirugía: cabecera en BOM_Cirugia (SOLICITADO) y copia
 * las partidas de los paquetes a BOM_Items (columna S). Se invoca desde crearCirugia.
 */
function crearBOMParaCirugia(folioCirugia, paquetes, comentario, usuario) {
  ensureBOMSheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var idBOM = 'BOM-' + folioCirugia;
    var claves = Array.isArray(paquetes) ? paquetes.filter(function (x) { return x; }) : [];

    appendRowByHeader(SHEETS.BOM_CIRUGIA, {
      ID_BOM: idBOM,
      Folio_Cirugia: folioCirugia,
      Paquetes: claves.join(', '),
      Comentario_Sin_Paquete: claves.length === 0 ? String(comentario || '') : '',
      Estado_BOM: 'SOLICITADO',
      Solicitado_Por: usuario || '',
      Solicitado_TS: nowTs(),
      Propuesto_Por: '', Propuesto_TS: '',
      Autorizado_Por: '', Autorizado_TS: '',
      Motivo_Rechazo: '',
      Entregado_Por: '', Entregado_TS: '',
      Observaciones: ''
    });

    var plantilla = sheetToObjects(SHEETS.BOM_PLANTILLA);
    var nItem = 0, nPartidas = 0;
    claves.forEach(function (clave) {
      plantilla.filter(function (r) {
        return String(r.Clave_Paquete) === String(clave) && esActivo(r.Activo);
      }).forEach(function (r) {
        nItem++;
        nPartidas++;
        appendRowByHeader(SHEETS.BOM_ITEMS, {
          ID_BOM_Item: idBOM + '-' + String(nItem).padStart(4, '0'),
          ID_BOM: idBOM,
          Folio_Cirugia: folioCirugia,
          Clave_Paquete: clave,
          Tipo_Item: r.Tipo_Item || '',
          Codigo: r.Codigo || '',
          Descripcion: r.Descripcion || '',
          Cantidad_S: r.Cantidad_S || '',
          Cantidad_U: '',
          Cantidad_R: '',
          Unidad: r.Unidad || '',
          Lote: '',
          Observaciones: ''
        });
      });
    });

    return { ok: true, idBOM: idBOM, partidas: nPartidas, paquetes: claves.length };
  } finally {
    lock.releaseLock();
  }
}

/** Busca la fila (1-indexed en hoja) y el objeto del BOM por folio de cirugía. */
function buscarBOMPorFolio_(folioCirugia) {
  var sh = getSheet(SHEETS.BOM_CIRUGIA);
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var colFolio = headers.indexOf('Folio_Cirugia');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colFolio]) === String(folioCirugia)) {
      return { fila: i + 1, headers: headers, valores: data[i], sheet: sh };
    }
  }
  return null;
}

/** Escribe un conjunto de campos en la fila del BOM (por nombre de columna). */
function setBOMCampos_(ref, campos) {
  Object.keys(campos).forEach(function (k) {
    var c = ref.headers.indexOf(k);
    if (c !== -1) ref.sheet.getRange(ref.fila, c + 1).setValue(campos[k]);
  });
}

/** Devuelve cabecera + partidas del BOM de una cirugía. */
function getBOM(folioCirugia) {
  ensureBOMSheets_();
  var cab = sheetToObjects(SHEETS.BOM_CIRUGIA).filter(function (b) {
    return String(b.Folio_Cirugia) === String(folioCirugia);
  })[0] || null;
  var items = sheetToObjects(SHEETS.BOM_ITEMS).filter(function (it) {
    return String(it.Folio_Cirugia) === String(folioCirugia);
  });
  return { ok: true, cabecera: cab, items: items };
}

/**
 * Pendientes para la alerta a almacén / dashboard.
 * Devuelve los BOM que no están ENTREGADO, con conteos por estado.
 */
function getBOMPendientes() {
  ensureBOMSheets_();
  var cirugias = sheetToObjects(SHEETS.CIRUGIAS);
  var idxCir = {};
  cirugias.forEach(function (c) { idxCir[String(c.Folio_Cirugia)] = c; });

  var bom = sheetToObjects(SHEETS.BOM_CIRUGIA).filter(function (b) {
    return String(b.Estado_BOM) !== 'ENTREGADO';
  });
  var conteos = { SOLICITADO: 0, PROPUESTO: 0, AUTORIZADO: 0, RECHAZADO: 0 };
  var lista = bom.map(function (b) {
    var est = String(b.Estado_BOM || '');
    if (conteos.hasOwnProperty(est)) conteos[est]++;
    var c = idxCir[String(b.Folio_Cirugia)] || {};
    return {
      idBOM: b.ID_BOM,
      folioCirugia: b.Folio_Cirugia,
      estado: est,
      paquetes: b.Paquetes,
      comentario: b.Comentario_Sin_Paquete,
      paciente: c.Nombre_Paciente || '',
      tipoCirugia: c.Tipo_Cirugia || '',
      fechaProgramada: c.Fecha_Programada || '',
      medico: c.Nombre_Medico || ''
    };
  });
  return { ok: true, total: lista.length, conteos: conteos, pendientes: lista };
}

/** Aplica las cantidades U/lote/observaciones enviadas por partida (opcional). */
function aplicarItemsBOM_(folioCirugia, items, campoCantidad) {
  if (!Array.isArray(items) || !items.length) return;
  var sh = getSheet(SHEETS.BOM_ITEMS);
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var cId = headers.indexOf('ID_BOM_Item');
  var cU = headers.indexOf(campoCantidad);
  var cLote = headers.indexOf('Lote');
  var cObs = headers.indexOf('Observaciones');
  var mapa = {};
  items.forEach(function (it) { mapa[String(it.idItem)] = it; });
  for (var i = 1; i < data.length; i++) {
    var it = mapa[String(data[i][cId])];
    if (!it) continue;
    if (cU !== -1 && it.cantidad !== undefined && it.cantidad !== null && it.cantidad !== '')
      sh.getRange(i + 1, cU + 1).setValue(it.cantidad);
    if (cLote !== -1 && it.lote !== undefined) sh.getRange(i + 1, cLote + 1).setValue(it.lote);
    if (cObs !== -1 && it.observaciones !== undefined) sh.getRange(i + 1, cObs + 1).setValue(it.observaciones);
  }
}

/** SOLICITADO/RECHAZADO -> PROPUESTO (almacén propone/ajusta). */
function proponerBOM(d) {
  if (!tienePermiso(d.rolUsuario, 'proponer_bom')) return errorSinPermiso(d.rolUsuario, 'proponer_bom');
  ensureBOMSheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ref = buscarBOMPorFolio_(d.folioCirugia);
    if (!ref) return { ok: false, error: 'No existe BOM para la cirugía ' + d.folioCirugia + '.' };
    var estado = String(ref.valores[ref.headers.indexOf('Estado_BOM')]);
    if (estado !== 'SOLICITADO' && estado !== 'RECHAZADO') {
      return { ok: false, error: 'Solo se puede proponer un BOM en estado SOLICITADO o RECHAZADO (actual: ' + estado + ').' };
    }
    if (d.items) aplicarItemsBOM_(d.folioCirugia, d.items, 'Cantidad_S');
    setBOMCampos_(ref, {
      Estado_BOM: 'PROPUESTO',
      Propuesto_Por: d.realizadoPor || d.rolUsuario || '',
      Propuesto_TS: nowTs(),
      Motivo_Rechazo: ''
    });
    return { ok: true, estado: 'PROPUESTO' };
  } finally {
    lock.releaseLock();
  }
}

/** PROPUESTO -> AUTORIZADO (solo DIRECTOR_MEDICO/ADMIN). Habilita entrega. */
function autorizarBOM(d) {
  if (!tienePermiso(d.rolUsuario, 'autorizar_bom')) return errorSinPermiso(d.rolUsuario, 'autorizar_bom');
  ensureBOMSheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ref = buscarBOMPorFolio_(d.folioCirugia);
    if (!ref) return { ok: false, error: 'No existe BOM para la cirugía ' + d.folioCirugia + '.' };
    var estado = String(ref.valores[ref.headers.indexOf('Estado_BOM')]);
    if (estado !== 'PROPUESTO') {
      return { ok: false, error: 'Solo se puede autorizar un BOM en estado PROPUESTO (actual: ' + estado + ').' };
    }
    setBOMCampos_(ref, {
      Estado_BOM: 'AUTORIZADO',
      Autorizado_Por: d.realizadoPor || d.rolUsuario || '',
      Autorizado_TS: nowTs(),
      Motivo_Rechazo: ''
    });
    return { ok: true, estado: 'AUTORIZADO' };
  } finally {
    lock.releaseLock();
  }
}

/** PROPUESTO -> RECHAZADO con motivo (luego puede volver a PROPUESTO). */
function rechazarBOM(d) {
  if (!tienePermiso(d.rolUsuario, 'rechazar_bom')) return errorSinPermiso(d.rolUsuario, 'rechazar_bom');
  ensureBOMSheets_();
  var motivo = String(d.motivo || '').trim();
  if (!motivo) return { ok: false, error: 'Indica el motivo del rechazo.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ref = buscarBOMPorFolio_(d.folioCirugia);
    if (!ref) return { ok: false, error: 'No existe BOM para la cirugía ' + d.folioCirugia + '.' };
    var estado = String(ref.valores[ref.headers.indexOf('Estado_BOM')]);
    if (estado !== 'PROPUESTO') {
      return { ok: false, error: 'Solo se puede rechazar un BOM en estado PROPUESTO (actual: ' + estado + ').' };
    }
    setBOMCampos_(ref, {
      Estado_BOM: 'RECHAZADO',
      Motivo_Rechazo: motivo,
      Autorizado_Por: d.realizadoPor || d.rolUsuario || '',
      Autorizado_TS: nowTs()
    });
    return { ok: true, estado: 'RECHAZADO' };
  } finally {
    lock.releaseLock();
  }
}

/** AUTORIZADO -> ENTREGADO (almacén). Acepta cantidades U por partida (opcional). */
function entregarBOM(d) {
  if (!tienePermiso(d.rolUsuario, 'entregar_bom')) return errorSinPermiso(d.rolUsuario, 'entregar_bom');
  ensureBOMSheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ref = buscarBOMPorFolio_(d.folioCirugia);
    if (!ref) return { ok: false, error: 'No existe BOM para la cirugía ' + d.folioCirugia + '.' };
    var estado = String(ref.valores[ref.headers.indexOf('Estado_BOM')]);
    if (estado !== 'AUTORIZADO') {
      return { ok: false, error: 'Solo se puede entregar un BOM AUTORIZADO por el director (actual: ' + estado + ').' };
    }
    if (d.items) aplicarItemsBOM_(d.folioCirugia, d.items, 'Cantidad_U');
    setBOMCampos_(ref, {
      Estado_BOM: 'ENTREGADO',
      Entregado_Por: d.realizadoPor || d.rolUsuario || '',
      Entregado_TS: nowTs()
    });
    return { ok: true, estado: 'ENTREGADO' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * SOLICITADO/RECHAZADO -> (sigue SOLICITADO/RECHAZADO) con el/los paquete(s) asignados.
 * Es responsabilidad del Director Médico definir el tipo de BOM que corresponde a la
 * cirugía cuando se programó sin paquete. Regenera las partidas desde la plantilla.
 */
function asignarBOMPaquetes(d) {
  if (!tienePermiso(d.rolUsuario, 'asignar_bom')) return errorSinPermiso(d.rolUsuario, 'asignar_bom');
  ensureBOMSheets_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ref = buscarBOMPorFolio_(d.folioCirugia);
    if (!ref) return { ok: false, error: 'No existe BOM para la cirugía ' + d.folioCirugia + '.' };
    var estado = String(ref.valores[ref.headers.indexOf('Estado_BOM')]);
    if (estado !== 'SOLICITADO' && estado !== 'RECHAZADO') {
      return { ok: false, error: 'Solo se puede asignar el paquete mientras el BOM está SOLICITADO o RECHAZADO (actual: ' + estado + ').' };
    }
    var claves = Array.isArray(d.paquetes) ? d.paquetes.filter(function (x) { return x; }) : [];
    if (!claves.length) return { ok: false, error: 'Selecciona al menos un paquete de BOM para asignar.' };

    var idBOM = String(ref.valores[ref.headers.indexOf('ID_BOM')]);
    // Limpiar las partidas previas de este BOM y regenerarlas desde la plantilla.
    eliminarItemsBOM_(idBOM);
    var plantilla = sheetToObjects(SHEETS.BOM_PLANTILLA);
    var nItem = 0;
    claves.forEach(function (clave) {
      plantilla.filter(function (r) {
        return String(r.Clave_Paquete) === String(clave) && esActivo(r.Activo);
      }).forEach(function (r) {
        nItem++;
        appendRowByHeader(SHEETS.BOM_ITEMS, {
          ID_BOM_Item: idBOM + '-' + String(nItem).padStart(4, '0'),
          ID_BOM: idBOM,
          Folio_Cirugia: d.folioCirugia,
          Clave_Paquete: clave,
          Tipo_Item: r.Tipo_Item || '',
          Codigo: r.Codigo || '',
          Descripcion: r.Descripcion || '',
          Cantidad_S: r.Cantidad_S || '',
          Cantidad_U: '',
          Cantidad_R: '',
          Unidad: r.Unidad || '',
          Lote: '',
          Observaciones: ''
        });
      });
    });

    setBOMCampos_(ref, {
      Paquetes: claves.join(', '),
      Comentario_Sin_Paquete: '',
      Observaciones: 'BOM asignado por ' + (d.realizadoPor || d.rolUsuario || '') + ' (' + nowTs() + ')'
    });
    return { ok: true, idBOM: idBOM, partidas: nItem, paquetes: claves.length, estado: estado };
  } finally {
    lock.releaseLock();
  }
}

/** Elimina todas las partidas (filas) de BOM_Items que pertenezcan a un ID_BOM. */
function eliminarItemsBOM_(idBOM) {
  var sh = getSheet(SHEETS.BOM_ITEMS);
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return;
  var cId = data[0].indexOf('ID_BOM');
  if (cId === -1) return;
  // De abajo hacia arriba para no romper los índices al borrar.
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][cId]) === String(idBOM)) sh.deleteRow(i + 1);
  }
}

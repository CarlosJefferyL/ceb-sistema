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
  CONSULTAS: 'Consultas',
  RECIBOS: 'Recibos',
  BENEFICIARIOS: 'CAT_Beneficiarios',
  CAJA: 'Caja'
};

// ============================================================
// MATRIZ DE PERMISOS — DEBE COINCIDIR EXACTAMENTE CON LA DEL FRONTEND
// ============================================================
// Si modificas la matriz del frontend (index.html), modifica también ésta.
// El backend es la fuente de verdad: aunque alguien manipule el frontend,
// estas validaciones se aplican siempre.
// ============================================================
var PERMISOS_ACCIONES = {
  'programar_cirugia':    ['ADMIN','JEFE_ENFERMERIA','DIRECTOR_MEDICO'],
  'nueva_cirugia':        ['ADMIN','JEFE_ENFERMERIA','DIRECTOR_MEDICO'],
  'ingresar_habitacion':  ['ADMIN','JEFE_ENFERMERIA','ENFERMERIA','DIRECTOR_MEDICO','RECEPCION'],
  'nuevo_paciente_recep': ['ADMIN','JEFE_ENFERMERIA','DIRECTOR_MEDICO','RECEPCION'],
  'nuevo_paciente_dir':   ['ADMIN','JEFE_ENFERMERIA','DIRECTOR_MEDICO','RECEPCION'],
  'editar_paciente':      ['ADMIN','JEFE_ENFERMERIA','ALMACEN','DIRECTOR_MEDICO','RECEPCION'],
  'vincular_receta':      ['ADMIN','JEFE_ENFERMERIA','ENFERMERIA','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'registrar_consumo':    ['ADMIN','JEFE_ENFERMERIA','ENFERMERIA','ALMACEN','DIRECTOR_MEDICO'],
  'cancelar_consumo':     ['ADMIN','JEFE_ENFERMERIA','ALMACEN','DIRECTOR_MEDICO'],
  'nueva_entrada':        ['ADMIN','JEFE_ENFERMERIA','ENFERMERIA','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'alta_medicamento':     ['ADMIN','JEFE_ENFERMERIA','ALMACEN','DIRECTOR_MEDICO'],
  'alta_medico':          ['ADMIN','JEFE_ENFERMERIA','ENFERMERIA','DIRECTOR_MEDICO','RECEPCION'],
  'alta_medico_consulta': ['ADMIN','JEFE_ENFERMERIA','ENFERMERIA','DIRECTOR_MEDICO','RECEPCION'],
  'alta_tipo_cirugia':    ['ADMIN','JEFE_ENFERMERIA','DIRECTOR_MEDICO'],
  'editar_cirugia':       ['ADMIN','JEFE_ENFERMERIA','ENFERMERIA','DIRECTOR_MEDICO'],
  'cancelar_cirugia':     ['ADMIN','JEFE_ENFERMERIA','DIRECTOR_MEDICO'],
  'terminar_cirugia':     ['ADMIN','JEFE_ENFERMERIA','ENFERMERIA','DIRECTOR_MEDICO'],
  'reabrir_cirugia':      ['ADMIN','JEFE_ENFERMERIA','DIRECTOR_MEDICO'],
  'exportar_libro':       ['ADMIN','JEFE_ENFERMERIA','ALMACEN','GESTORIA','DIRECTOR_MEDICO'],
  'registrar_consulta':   ['ADMIN','JEFE_ENFERMERIA','ENFERMERIA','DIRECTOR_MEDICO','RECEPCION'],
  'cobro_caja':           ['ADMIN','DIRECTOR_MEDICO','CAJERO'],
  'emitir_recibo':        ['ADMIN','DIRECTOR_MEDICO','CAJERO'],
  'cancelar_recibo':      ['ADMIN','DIRECTOR_MEDICO','CAJERO'],
  'alta_beneficiario':    ['ADMIN','DIRECTOR_MEDICO','CAJERO'],
  'editar_beneficiario':  ['ADMIN','DIRECTOR_MEDICO','CAJERO']
};

var ROLES_VALIDOS = ['ADMIN','JEFE_ENFERMERIA','ENFERMERIA','ALMACEN','GESTORIA','DIRECTOR_MEDICO','RECEPCION','CAJERO'];

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
      case 'getLotes':     result = getLotes(e.parameter.estado, e.parameter.idMedicamento); break;
      case 'getConsumosPorLote': result = getConsumosPorLote(e.parameter.idLote); break;
      case 'getDashboard': result = getDashboard(e.parameter.horizonte); break;
      case 'getProgramacionDia': result = getProgramacionDia(e.parameter.fecha); break;
      case 'getProgramacionMes': result = getProgramacionMes(e.parameter.anio, e.parameter.mes); break;
      case 'validarConflictoHorario': result = validarConflictoHorario(e.parameter.idQuirofano, e.parameter.fecha, e.parameter.horaInicio, e.parameter.tqxHoras, e.parameter.folioExcluir); break;
      case 'getTableroHabitaciones': result = getTableroHabitaciones(); break;
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
      case 'getIngresos':    result = getIngresos(e.parameter.desde, e.parameter.hasta); break;
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
  return {
    ok: true,
    medicamentos: sheetToObjects(SHEETS.MEDICAMENTOS).filter(function(m){return esActivo(m.Activo);}),
    medicos:      sheetToObjects(SHEETS.MEDICOS).filter(function(m){return esActivo(m.Activo);}),
    medicosConsulta: getMedicosConsultaList(),
    quirofanos:   sheetToObjects(SHEETS.QUIROFANOS).filter(function(q){return esActivo(q.Activo);}),
    habitaciones: sheetToObjects(SHEETS.HABITACIONES).filter(function(h){return esActivo(h.Activo);}),
    aseguradoras: sheetToObjects(SHEETS.ASEGURADORAS).filter(function(a){return esActivo(a.Activo);}),
    pacientes:    sheetToObjects(SHEETS.PACIENTES).filter(function(p){return p.Estatus!=='Suspendido';}),
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

  return { ok: true, folio: folio };
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

function calcularSaldo(idMedicamento) {
  var movs = sheetToObjects(SHEETS.INV_MOV);
  var saldo = 0;
  for (var i = 0; i < movs.length; i++) {
    var m = movs[i];
    if (m.ID_Medicamento !== idMedicamento) continue;
    var qty = parseFloat(m.Cantidad) || 0;
    if (m.Tipo === 'ENTRADA') saldo += qty;
    else if (m.Tipo === 'SALIDA') saldo -= qty;
    else if (m.Tipo === 'AJUSTE') saldo += qty; // los ajustes pueden ser positivos o negativos
  }
  return saldo;
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
  // Paciente extranjero: la CURP no aplica, se omite su validación.
  if (!d.esExtranjero && d.curp && !validarCURP(d.curp)) {
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

  ensureHeaders_(SHEETS.PACIENTES, ['Es_Extranjero']);
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
    'CURP': d.esExtranjero ? '' : (d.curp || '').toUpperCase(),
    'Es_Extranjero': d.esExtranjero ? 'SI' : '',
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
  // Paciente extranjero: la CURP no aplica, se omite su validación.
  if (!d.esExtranjero && d.curp && !validarCURP(d.curp)) {
    return { ok: false, error: 'CURP inválido (debe tener 18 caracteres alfanuméricos)' };
  }
  if (d.cp && !/^\d{5}$/.test(String(d.cp))) {
    return { ok: false, error: 'Código Postal debe ser de 5 dígitos' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet(SHEETS.PACIENTES);
    ensureHeaders_(SHEETS.PACIENTES, ['Es_Extranjero']);
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
      'esExtranjero': 'Es_Extranjero',
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
              if (frontKey === 'curp') valor = d.esExtranjero ? '' : (valor ? String(valor).toUpperCase() : valor);
              if (frontKey === 'rfc' && valor) valor = String(valor).toUpperCase();
              if (frontKey === 'esExtranjero') valor = valor ? 'SI' : '';
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

// ============================================================
// CATÁLOGO: MÉDICOS DE CONSULTA (propios de Clínica Estar Bien)
// Distinto del catálogo de médicos cirujanos (CAT_Medicos).
// Campos: nombre completo, título (Médico General, Especialista, etc.)
// y cédula profesional. Se usa para el consentimiento de consulta.
// ============================================================

var MEDICOS_CONSULTA_HEADERS = ['ID_MedicoConsulta', 'Nombre_Completo', 'Titulo', 'Cedula_Profesional', 'Activo', 'Capturado_Por', 'Timestamp_Captura'];

function ensureMedicosConsultaSheet() {
  var sh = SS.getSheetByName(SHEETS.MEDICOS_CONSULTA);
  if (!sh) {
    sh = SS.insertSheet(SHEETS.MEDICOS_CONSULTA);
    sh.getRange(1, 1, 1, MEDICOS_CONSULTA_HEADERS.length).setValues([MEDICOS_CONSULTA_HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function getMedicosConsultaList() {
  ensureMedicosConsultaSheet();
  return sheetToObjects(SHEETS.MEDICOS_CONSULTA).filter(function(m){ return esActivo(m.Activo); });
}

function altaMedicoConsulta(d) {
  if (!tienePermiso(d.rolUsuario, 'alta_medico_consulta')) {
    return errorSinPermiso(d.rolUsuario, 'alta_medico_consulta');
  }
  if (!d.nombreCompleto || !String(d.nombreCompleto).trim()) {
    return { ok: false, error: 'El nombre completo del médico es obligatorio' };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = ensureMedicosConsultaSheet();
    var data = sh.getDataRange().getValues();
    var num = 0;
    for (var i = 1; i < data.length; i++) {
      var v = String(data[i][0] || '');
      if (v.indexOf('MCON-') === 0) {
        var n = parseInt(v.replace('MCON-', ''), 10);
        if (!isNaN(n)) num = Math.max(num, n);
      }
    }
    var id = 'MCON-' + String(num + 1).padStart(4, '0');
    var nombre = String(d.nombreCompleto).trim();
    var titulo = String(d.titulo || '').trim();
    var cedula = String(d.cedulaProfesional || '').trim();
    appendRowByHeader(SHEETS.MEDICOS_CONSULTA, {
      'ID_MedicoConsulta': id,
      'Nombre_Completo': nombre,
      'Titulo': titulo,
      'Cedula_Profesional': cedula,
      'Activo': 'SI',
      'Capturado_Por': d.capturadoPor || '',
      'Timestamp_Captura': nowTs()
    });
    return { ok: true, idMedicoConsulta: id, nombreCompleto: nombre, titulo: titulo, cedulaProfesional: cedula };
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

  return { ok: true, paciente: paciente, cirugias: cirugias, cuentaExistente: cuentaExistente };
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
    aplicarComision: esVerdadero(r.Aplicar_Comision)
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

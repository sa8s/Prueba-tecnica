// ==============================================
// MÓDULO: REPORTES
// Descripción: Funciones para reportes simples
// ==============================================

const API_BASE = "http://localhost:3000";

/**
 * Obtiene reporte de tickets con filtros
 */
async function obtenerReporte(filtros = {}) {
    try {
        const params = new URLSearchParams();
        
        // Agregar filtros a los parámetros
        if (filtros.desde) params.append('desde', filtros.desde);
        if (filtros.hasta) params.append('hasta', filtros.hasta);
        if (filtros.estado) params.append('estado', filtros.estado);
        if (filtros.final) params.append('final', filtros.final);
        
        const url = `${API_BASE}/Reporte?${params.toString()}`;
        console.log(`Solicitando reporte: ${url}`);
        
        const res = await fetch(url);
        
        if (res.status === 404) {
            return {
                exito: true,
                datos: [],
                mensaje: 'No hay datos para el reporte solicitado'
            };
        }
        
        if (!res.ok) {
            throw new Error(`Error ${res.status}: ${res.statusText}`);
        }
        
        const datos = await res.json();
        
        return {
            exito: true,
            datos: datos,
            mensaje: `${datos.length} tickets encontrados`
        };
    } catch (error) {
        console.error("Error obteniendo reporte:", error);
        return {
            exito: false,
            datos: [],
            error: error.message,
            mensaje: `Error al obtener reporte: ${error.message}`
        };
    }
}

/**
 * Obtiene acciones de tickets con filtros
 */
async function obtenerAcciones(filtros = {}) {
    try {
        let url;
        
        if (filtros.tid) {
            // Acciones de un ticket específico
            url = `${API_BASE}/Acciones/Ticket/${encodeURIComponent(filtros.tid)}`;
        } else {
            // Todas las acciones con filtros
            url = `${API_BASE}/Acciones`;
        }
        
        const params = new URLSearchParams();
        if (filtros.tipo) params.append('tipo', filtros.tipo);
        if (filtros.desde) params.append('desde', filtros.desde);
        if (filtros.hasta) params.append('hasta', filtros.hasta);
        
        const urlCompleta = `${url}?${params.toString()}`;
        console.log(`Solicitando acciones: ${urlCompleta}`);
        
        const res = await fetch(urlCompleta);
        
        if (res.status === 404) {
            return {
                exito: true,
                datos: [],
                mensaje: 'No hay acciones para los filtros solicitados'
            };
        }
        
        if (!res.ok) {
            throw new Error(`Error ${res.status}: ${res.statusText}`);
        }
        
        const datos = await res.json();
        
        return {
            exito: true,
            datos: Array.isArray(datos) ? datos : [datos],
            mensaje: `${Array.isArray(datos) ? datos.length : 1} acciones encontradas`
        };
    } catch (error) {
        console.error("Error obteniendo acciones:", error);
        return {
            exito: false,
            datos: [],
            error: error.message,
            mensaje: `Error al obtener acciones: ${error.message}`
        };
    }
}

/**
 * Formatea una fecha para mostrar
 */
function formatearFecha(fecha, incluirHora = true) {
    if (!fecha) return "—";
    
    try {
        const fechaObj = new Date(fecha);
        if (isNaN(fechaObj.getTime())) {
            // Intentar con formato $date de MongoDB
            if (fecha.$date) {
                return formatearFecha(fecha.$date, incluirHora);
            }
            return String(fecha);
        }
        
        const opciones = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        };
        
        if (incluirHora) {
            opciones.hour = '2-digit';
            opciones.minute = '2-digit';
        }
        
        return fechaObj.toLocaleDateString('es-ES', opciones);
    } catch (e) {
        console.warn("Error formateando fecha:", fecha, e);
        return String(fecha);
    }
}

/**
 * Crea un badge de estado
 */
function crearBadgeEstado(estado) {
    if (!estado) return "—";
    
    const estadoLower = estado.toLowerCase().replace(' ', '_');
    let clase = '';
    let texto = estado;
    
    switch(estadoLower) {
        case 'open':
        case 'abierto':
            clase = 'status-open';
            texto = 'Abierto';
            break;
        case 'in_progress':
        case 'en_progreso':
            clase = 'status-in_progress';
            texto = 'En Progreso';
            break;
        case 'closed':
        case 'cerrado':
            clase = 'status-closed';
            texto = 'Cerrado';
            break;
        case 'rejected':
        case 'rechazado':
            clase = 'status-closed';
            texto = 'Rechazado';
            break;
        default:
            clase = 'status-badge';
    }
    
    return `<span class="status-badge ${clase}">${texto}</span>`;
}

/**
 * Renderiza una tabla de tickets
 */
function renderizarTablaTickets(tickets, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) {
        console.error(`Elemento ${tbodyId} no encontrado`);
        return;
    }
    
    // Limpiar tabla
    tbody.innerHTML = '';
    
    if (!tickets || tickets.length === 0) {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td colspan="5" style="text-align: center; color: #777;">No hay tickets para mostrar</td>`;
        tbody.appendChild(fila);
        return;
    }
    
    // Agregar filas
    tickets.forEach(ticket => {
        const fila = document.createElement('tr');
        
        const estadoInicial = crearBadgeEstado(ticket.EstadoInicial);
        const estadoFinal = crearBadgeEstado(ticket.EstadoFinal);
        const ultimaAccion = formatearFecha(ticket.UltimaAccion);
        
        fila.innerHTML = `
            <td><strong>${ticket.Tid || "—"}</strong></td>
            <td>${ticket.Nombre || "—"}</td>
            <td>${estadoInicial}</td>
            <td>${estadoFinal}</td>
            <td>${ultimaAccion}</td>
        `;
        
        tbody.appendChild(fila);
    });
}

/**
 * Renderiza una tabla de acciones
 */
function renderizarTablaAcciones(acciones, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) {
        console.error(`Elemento ${tbodyId} no encontrado`);
        return;
    }
    
    // Limpiar tabla
    tbody.innerHTML = '';
    
    if (!acciones || acciones.length === 0) {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td colspan="6" style="text-align: center; color: #777;">No hay acciones para mostrar</td>`;
        tbody.appendChild(fila);
        return;
    }
    
    // Ordenar por fecha (más reciente primero)
    const accionesOrdenadas = [...acciones].sort((a, b) => {
        const fechaA = new Date(a.Fecha || a.Fecha?.$date || 0);
        const fechaB = new Date(b.Fecha || b.Fecha?.$date || 0);
        return fechaB - fechaA;
    });
    
    // Agregar filas
    accionesOrdenadas.forEach(accion => {
        const fila = document.createElement('tr');
        
        // Formatear valores From/To
        const from = Array.isArray(accion.From) ? 
            accion.From.join(', ') : 
            (accion.From || '—');
        
        const to = Array.isArray(accion.To) ? 
            accion.To.join(', ') : 
            (accion.To || '—');
        
        const fecha = formatearFecha(accion.Fecha);
        
        fila.innerHTML = `
            <td>${accion.Aid || "—"}</td>
            <td><strong>${accion.TicketId || accion.Tid || "—"}</strong></td>
            <td>${accion.Tipo_de_accion || accion.Tipo || "—"}</td>
            <td>${from}</td>
            <td>${to}</td>
            <td>${fecha}</td>
        `;
        
        tbody.appendChild(fila);
    });
}

/**
 * Muestra mensaje de error
 */
function mostrarError(mensaje, containerSelector = '.container') {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    
    // Crear elemento de error
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<strong>Error:</strong> ${mensaje}`;
    
    // Insertar al principio
    if (container.firstChild) {
        container.insertBefore(errorDiv, container.firstChild);
    } else {
        container.appendChild(errorDiv);
    }
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

/**
 * Muestra mensaje de éxito
 */
function mostrarExito(mensaje, containerSelector = '.container') {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    
    // Crear elemento de éxito
    const exitoDiv = document.createElement('div');
    exitoDiv.className = 'error-message';
    exitoDiv.style.borderLeftColor = '#27ae60';
    exitoDiv.style.background = '#d5f4e6';
    exitoDiv.style.color = '#137333';
    exitoDiv.innerHTML = `<strong>Éxito:</strong> ${mensaje}`;
    
    // Insertar al principio
    if (container.firstChild) {
        container.insertBefore(exitoDiv, container.firstChild);
    } else {
        container.appendChild(exitoDiv);
    }
    
    // Auto-remover después de 3 segundos
    setTimeout(() => {
        if (exitoDiv.parentNode) {
            exitoDiv.parentNode.removeChild(exitoDiv);
        }
    }, 3000);
}

// Exportar para uso global
window.Reportes = {
    obtenerReporte,
    obtenerAcciones,
    formatearFecha,
    crearBadgeEstado,
    renderizarTablaTickets,
    renderizarTablaAcciones,
    mostrarError,
    mostrarExito
};
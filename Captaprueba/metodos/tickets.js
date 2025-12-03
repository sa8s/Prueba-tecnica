// ==============================================
// MÓDULO: TICKETS
// Descripción: Funciones para gestión de tickets
// ==============================================

const API_BASE = "http://localhost:3000";

// Cache para tickets
const ticketsCache = new Map();
let todosLosTicketsCache = null;

/**
 * Maneja errores de API de forma consistente
 */
function manejarErrorAPI(error, operacion = 'operación') {
    console.error(`Error en ${operacion}:`, error);
    
    let mensajeUsuario = 'Error desconocido';
    if (error.message.includes('Failed to fetch')) {
        mensajeUsuario = 'Error de conexión con el servidor';
    } else if (error.message.includes('404')) {
        mensajeUsuario = 'Recurso no encontrado';
    } else if (error.message.includes('NetworkError')) {
        mensajeUsuario = 'Error de red. Verifica tu conexión';
    } else {
        mensajeUsuario = error.message;
    }
    
    return {
        exito: false,
        error: error.message,
        mensaje: mensajeUsuario
    };
}

/**
 * Crea un nuevo ticket
 */
async function crearTicket(datosTicket) {
    try {
        // Validaciones básicas
        if (!datosTicket.Nombre || datosTicket.Nombre.trim() === '') {
            throw new Error('El nombre del ticket es requerido');
        }
        
        const res = await fetch(`${API_BASE}/Tickets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datosTicket)
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || `Error ${res.status}`);
        }
        
        const ticketCreado = await res.json();
        
        // Invalidar cache
        ticketsCache.delete('todos');
        todosLosTicketsCache = null;
        
        return {
            exito: true,
            datos: ticketCreado,
            mensaje: `Ticket creado exitosamente: ${ticketCreado.Tid}`
        };
    } catch (error) {
        return manejarErrorAPI(error, 'creación de ticket');
    }
}

/**
 * Obtiene un ticket por su ID
 */
async function obtenerTicket(tid, forzarActualizacion = false) {
    try {
        // Verificar cache
        if (!forzarActualizacion && ticketsCache.has(tid)) {
            console.log(`Ticket ${tid} obtenido de cache`);
            return {
                exito: true,
                datos: ticketsCache.get(tid),
                mensaje: `Ticket ${tid} cargado de cache`
            };
        }
        
        const res = await fetch(`${API_BASE}/Tickets/${tid}`);
        
        if (res.status === 404) {
            throw new Error(`Ticket ${tid} no encontrado`);
        }
        
        if (!res.ok) {
            throw new Error(`Error ${res.status}: ${res.statusText}`);
        }
        
        const ticket = await res.json();
        
        // Guardar en cache
        ticketsCache.set(tid, ticket);
        
        return {
            exito: true,
            datos: ticket,
            mensaje: `Ticket ${tid} cargado exitosamente`
        };
    } catch (error) {
        return manejarErrorAPI(error, `obtención de ticket ${tid}`);
    }
}

/**
 * Obtiene todos los tickets
 */
async function obtenerTodosLosTickets(forzarActualizacion = false) {
    try {
        // Verificar cache
        if (!forzarActualizacion && todosLosTicketsCache) {
            console.log("Tickets obtenidos de cache");
            return {
                exito: true,
                datos: todosLosTicketsCache,
                mensaje: `${todosLosTicketsCache.length} tickets cargados de cache`
            };
        }
        
        const todos = [];
        let pagina = 0;
        let hayMasPaginas = true;
        
        while (hayMasPaginas) {
            const res = await fetch(`${API_BASE}/Tickets?p=${pagina}`);
            
            if (!res.ok) {
                throw new Error(`Error ${res.status}: ${res.statusText}`);
            }
            
            const datosPagina = await res.json();
            
            if (!Array.isArray(datosPagina) || datosPagina.length === 0) {
                hayMasPaginas = false;
            } else {
                todos.push(...datosPagina);
                pagina++;
                
                // Prevenir bucles infinitos
                if (pagina > 100) {
                    console.warn("Límite de páginas alcanzado");
                    hayMasPaginas = false;
                }
            }
        }
        
        // Guardar en cache
        todosLosTicketsCache = todos;
        ticketsCache.set('todos', todos);
        
        console.log(`Total de tickets cargados: ${todos.length}`);
        
        return {
            exito: true,
            datos: todos,
            mensaje: `${todos.length} tickets cargados exitosamente`
        };
    } catch (error) {
        return manejarErrorAPI(error, 'obtención de todos los tickets');
    }
}

/**
 * Actualiza un ticket existente
 */
async function actualizarTicket(tid, datosActualizados) {
    try {
        const res = await fetch(`${API_BASE}/Tickets/${tid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datosActualizados)
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || `Error ${res.status}`);
        }
        
        const resultado = await res.json();
        
        // Actualizar cache
        ticketsCache.delete(tid);
        ticketsCache.delete('todos');
        todosLosTicketsCache = null;
        
        return {
            exito: true,
            datos: resultado,
            mensaje: `Ticket ${tid} actualizado exitosamente`
        };
    } catch (error) {
        return manejarErrorAPI(error, `actualización de ticket ${tid}`);
    }
}

/**
 * Agrega un comentario a un ticket
 */
async function agregarComentario(tid, datosComentario) {
    try {
        // Validaciones
        if (!datosComentario.Comentador || !datosComentario.Comentario) {
            throw new Error('Comentador y comentario son requeridos');
        }
        
        const res = await fetch(`${API_BASE}/Tickets/${tid}/Comentario`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datosComentario)
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || `Error ${res.status}`);
        }
        
        const resultado = await res.json();
        
        // Invalidar cache del ticket
        ticketsCache.delete(tid);
        
        return {
            exito: true,
            datos: resultado,
            mensaje: `Comentario agregado al ticket ${tid}`
        };
    } catch (error) {
        return manejarErrorAPI(error, `agregar comentario a ticket ${tid}`);
    }
}

/**
 * Valida los datos de un ticket
 */
function validarDatosTicket(datos) {
    const errores = [];
    
    if (!datos.Nombre || datos.Nombre.trim() === '') {
        errores.push('El nombre es requerido');
    }
    
    if (datos.Nombre && datos.Nombre.length > 200) {
        errores.push('El nombre no puede exceder 200 caracteres');
    }
    
    if (datos.Estado && !['open', 'in_progress', 'closed', 'rejected'].includes(datos.Estado)) {
        errores.push('Estado inválido. Valores permitidos: open, in_progress, closed, rejected');
    }
    
    if (datos.Prioridad && !['low', 'medium', 'high'].includes(datos.Prioridad)) {
        errores.push('Prioridad inválida. Valores permitidos: low, medium, high');
    }
    
    return {
        valido: errores.length === 0,
        errores: errores
    };
}

/**
 * Formatea un ticket para mostrar
 */
function formatearTicket(ticket) {
    if (!ticket) return 'No hay información del ticket';
    
    const partes = [
        `ID: ${ticket.Tid || 'N/A'}`,
        `Nombre: ${ticket.Nombre || 'N/A'}`,
        `Estado: ${ticket.Estado || 'N/A'}`,
        `Prioridad: ${ticket.Prioridad || 'N/A'}`,
        `Asignado a: ${Array.isArray(ticket.Asignado_a) ? ticket.Asignado_a.join(', ') : 'Nadie'}`,
        `Creado: ${ticket.Creado_en ? new Date(ticket.Creado_en).toLocaleString() : 'N/A'}`,
        `Última acción: ${ticket.Ultima_accion ? new Date(ticket.Ultima_accion).toLocaleString() : 'N/A'}`
    ];
    
    if (ticket.Descripcion) {
        partes.push(`Descripción: ${ticket.Descripcion}`);
    }
    
    if (ticket.Path && Array.isArray(ticket.Path)) {
        partes.push(`Ubicación: ${ticket.Path.join(' → ')}`);
    }
    
    return partes.join('\n');
}

/**
 * Limpia el cache de tickets
 */
function limpiarCacheTickets() {
    ticketsCache.clear();
    todosLosTicketsCache = null;
    console.log("Cache de tickets limpiado");
}

// Exportar para uso global
window.Tickets = {
    crearTicket,
    obtenerTicket,
    obtenerTodosLosTickets,
    actualizarTicket,
    agregarComentario,
    validarDatosTicket,
    formatearTicket,
    limpiarCacheTickets,
    
    // Propiedades útiles para debugging
    get cacheInfo() {
        return {
            ticketsIndividuales: ticketsCache.size,
            tieneTodos: !!todosLosTicketsCache
        };
    }
};
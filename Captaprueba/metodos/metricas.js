// ==============================================
// MÓDULO: MÉTRICAS
// Descripción: Funciones para análisis avanzado
// ==============================================

const API_BASE = "http://localhost:3000";

/**
 * Parsea una fecha de cualquier formato común
 */
function parsearFecha(valor) {
    if (!valor) return null;
    
    if (valor instanceof Date) return valor;
    
    if (typeof valor === 'string') {
        const fecha = new Date(valor);
        if (!isNaN(fecha.getTime())) return fecha;
        
        // Intentar otros formatos
        const fechaISO = new Date(valor.replace(' ', 'T'));
        if (!isNaN(fechaISO.getTime())) return fechaISO;
    }
    
    if (valor.$date) {
        return new Date(valor.$date);
    }
    
    return new Date(valor);
}

/**
 * Determina si una acción es reapertura
 */
function esReapertura(accion) {
    if (!accion || accion.From === undefined || accion.To === undefined) {
        return false;
    }
    
    const desde = String(accion.From).toLowerCase();
    const hacia = String(accion.To).toLowerCase();
    
    const estadosCerrados = ['closed', 'rejected', 'cerrado', 'rechazado'];
    const estadosAbiertos = ['open', 'in_progress', 'abierto', 'en progreso'];
    
    return estadosCerrados.includes(desde) && estadosAbiertos.includes(hacia);
}

/**
 * Determina si una acción es cierre
 */
function esCierre(accion) {
    if (!accion || accion.To === undefined) return false;
    
    const hacia = String(accion.To).toLowerCase();
    const estadosCerrados = ['closed', 'rejected', 'cerrado', 'rechazado'];
    
    return estadosCerrados.includes(hacia);
}

/**
 * Calcula métricas avanzadas para un período
 */
async function calcularMetricas(parametros) {
    const { desde, hasta, clasificadorCid, criterioEstado = 'rango' } = parametros;
    
    try {
        console.log("Calculando métricas con:", parametros);
        
        // 1. Obtener reporte base
        const resultadoReporte = await window.Reportes.obtenerReporte({
            desde,
            hasta,
            final: criterioEstado
        });
        
        if (!resultadoReporte.exito) {
            throw new Error(resultadoReporte.mensaje);
        }
        
        const reporte = resultadoReporte.datos;
        
        // 2. Obtener todos los tickets
        const resultadotickets = await window.Tickets.obtenerTodosLosTickets();
        if (!resultadotickets.exito) {
            throw new Error(resultadotickets.mensaje);
        }
        
        const todosLosTickets = resultadotickets.datos;
        const mapaTickets = new Map(todosLosTickets.map(t => [t.Tid, t]));
        
        // 3. Obtener acciones en el período
        const resultadoAcciones = await window.Reportes.obtenerAcciones({ desde, hasta });
        if (!resultadoAcciones.exito) {
            throw new Error(resultadoAcciones.mensaje);
        }
        
        const acciones = resultadoAcciones.datos;
        
        // 4. Identificar tickets con actividad
        const ticketsConActividad = new Set();
        
        // Por acciones
        acciones.forEach(accion => {
            if (accion.TicketId) ticketsConActividad.add(accion.TicketId);
        });
        
        // Por creación en el período
        todosLosTickets.forEach(ticket => {
            const fechaCreacion = parsearFecha(ticket.Creado_en);
            const fechaDesde = parsearFecha(desde);
            const fechaHasta = parsearFecha(hasta);
            
            if (fechaCreacion && fechaDesde && fechaHasta) {
                if (fechaCreacion >= fechaDesde && fechaCreacion <= fechaHasta) {
                    ticketsConActividad.add(ticket.Tid);
                }
            }
        });
        
        // 5. Filtrar reporte por actividad y clasificador
        let reporteFiltrado = reporte.filter(item => {
            return ticketsConActividad.has(item.Tid);
        });
        
        // Filtrar por clasificador si se especifica
        if (clasificadorCid) {
            reporteFiltrado = reporteFiltrado.filter(item => {
                const ticket = mapaTickets.get(item.Tid);
                if (!ticket || !ticket.Path) return false;
                
                // Verificar si el clasificador está en el path
                const path = Array.isArray(ticket.Path) ? ticket.Path : [];
                return path.includes(parseInt(clasificadorCid));
            });
        }
        
        // 6. Calcular métricas
        const metricas = {
            // Totales
            totalTickets: reporteFiltrado.length,
            ticketsConActividad: ticketsConActividad.size,
            totalAcciones: acciones.length,
            
            // Estados iniciales
            abiertosInicio: reporteFiltrado.filter(item => {
                const estado = String(item.EstadoInicial || '').toLowerCase();
                return ['open', 'in_progress', 'abierto', 'en progreso'].includes(estado);
            }).length,
            
            cerradosInicio: reporteFiltrado.filter(item => {
                const estado = String(item.EstadoInicial || '').toLowerCase();
                return ['closed', 'rejected', 'cerrado', 'rechazado'].includes(estado);
            }).length,
            
            // Estados finales
            abiertosFinal: reporteFiltrado.filter(item => {
                const estado = String(item.EstadoFinal || '').toLowerCase();
                return ['open', 'in_progress', 'abierto', 'en progreso'].includes(estado);
            }).length,
            
            cerradosFinal: reporteFiltrado.filter(item => {
                const estado = String(item.EstadoFinal || '').toLowerCase();
                return ['closed', 'rejected', 'cerrado', 'rechazado'].includes(estado);
            }).length,
            
            // Transiciones
            cierres: reporteFiltrado.filter(item => {
                const inicio = String(item.EstadoInicial || '').toLowerCase();
                const fin = String(item.EstadoFinal || '').toLowerCase();
                
                const estabaAbierto = ['open', 'in_progress', 'abierto', 'en progreso'].includes(inicio);
                const terminoCerrado = ['closed', 'rejected', 'cerrado', 'rechazado'].includes(fin);
                
                return estabaAbierto && terminoCerrado;
            }).length,
            
            reaperturas: reporteFiltrado.filter(item => {
                const inicio = String(item.EstadoInicial || '').toLowerCase();
                const fin = String(item.EstadoFinal || '').toLowerCase();
                
                const estabaCerrado = ['closed', 'rejected', 'cerrado', 'rechazado'].includes(inicio);
                const terminoAbierto = ['open', 'in_progress', 'abierto', 'en progreso'].includes(fin);
                
                return estabaCerrado && terminoAbierto;
            }).length,
            
            // Acciones específicas
            accionesCierre: acciones.filter(esCierre).length,
            accionesReapertura: acciones.filter(esReapertura).length
        };
        
        // 7. Calcular derivadas
        metricas.balance = metricas.abiertosInicio - metricas.cierres + metricas.reaperturas;
        metricas.balanceCorrecto = metricas.balance === metricas.abiertosFinal;
        
        metricas.tasaCierre = metricas.totalTickets > 0 ?
            ((metricas.cerradosFinal / metricas.totalTickets) * 100).toFixed(1) + '%' :
            '0%';
            
        metricas.tasaReapertura = metricas.totalTickets > 0 ?
            ((metricas.reaperturas / metricas.totalTickets) * 100).toFixed(1) + '%' :
            '0%';
        
        console.log("Métricas calculadas:", metricas);
        return {
            exito: true,
            metricas: metricas,
            datos: {
                reporte: reporteFiltrado,
                acciones: acciones,
                ticketsConActividad: Array.from(ticketsConActividad)
            }
        };
        
    } catch (error) {
        console.error("Error calculando métricas:", error);
        return {
            exito: false,
            error: error.message,
            mensaje: `Error calculando métricas: ${error.message}`
        };
    }
}

/**
 * Renderiza métricas en un contenedor
 */
function renderizarMetricas(metricas, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Contenedor ${containerId} no encontrado`);
        return;
    }
    
    container.innerHTML = '';
    
    const metricasParaMostrar = [
        { titulo: 'Tickets Totales', valor: metricas.totalTickets },
        { titulo: 'Tickets con Actividad', valor: metricas.ticketsConActividad },
        { titulo: 'Acciones en Período', valor: metricas.totalAcciones },
        { titulo: 'Abiertos al Inicio', valor: metricas.abiertosInicio },
        { titulo: 'Cerrados al Inicio', valor: metricas.cerradosInicio },
        { titulo: 'Abiertos al Final', valor: metricas.abiertosFinal },
        { titulo: 'Cerrados al Final', valor: metricas.cerradosFinal },
        { titulo: 'Cierres', valor: metricas.cierres },
        { titulo: 'Reaperturas', valor: metricas.reaperturas },
        { titulo: 'Balance', valor: `${metricas.balance} ${metricas.balanceCorrecto ? '✓' : '✗'}` },
        { titulo: 'Tasa de Cierre', valor: metricas.tasaCierre },
        { titulo: 'Tasa de Reapertura', valor: metricas.tasaReapertura }
    ];
    
    metricasParaMostrar.forEach(metrica => {
        const div = document.createElement('div');
        div.className = 'metric';
        div.innerHTML = `
            <div class="metric-title">${metrica.titulo}</div>
            <div class="metric-value">${metrica.valor}</div>
        `;
        container.appendChild(div);
    });
}

/**
 * Genera reporte completo con análisis
 */
async function generarReporteCompleto(parametros) {
    try {
        const resultado = await calcularMetricas(parametros);
        
        if (!resultado.exito) {
            throw new Error(resultado.mensaje);
        }
        
        const reporte = {
            parametros: parametros,
            fechaGeneracion: new Date().toISOString(),
            resumen: {
                periodo: `${parametros.desde} - ${parametros.hasta}`,
                clasificador: parametros.clasificadorCid || 'Todos',
                criterioEstado: parametros.criterioEstado || 'rango'
            },
            metricas: resultado.metricas,
            datos: resultado.datos
        };
        
        return {
            exito: true,
            reporte: reporte,
            mensaje: 'Reporte generado exitosamente'
        };
        
    } catch (error) {
        console.error("Error generando reporte completo:", error);
        return {
            exito: false,
            error: error.message,
            mensaje: `Error generando reporte: ${error.message}`
        };
    }
}

/**
 * Exporta reporte a JSON
 */
function exportarReporteJSON(reporte, nombre = 'reporte-tickets.json') {
    try {
        const datosJSON = JSON.stringify(reporte, null, 2);
        const blob = new Blob([datosJSON], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = nombre;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        return true;
    } catch (error) {
        console.error("Error exportando reporte:", error);
        return false;
    }
}

// Exportar para uso global
window.Metricas = {
    parsearFecha,
    esReapertura,
    esCierre,
    calcularMetricas,
    renderizarMetricas,
    generarReporteCompleto,
    exportarReporteJSON
};
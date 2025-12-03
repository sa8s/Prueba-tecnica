// ==============================================
// MÓDULO: CLASIFICADORES
// Descripción: Funciones para manejar clasificadores
// ==============================================

const API_BASE = "http://localhost:3000";

// Cache para clasificadores
let clasificadoresCache = null;
let ultimaActualizacion = null;

/**
 * Obtiene todos los clasificadores con cache
 */
async function obtenerClasificadores(forceRefresh = false) {
    // Verificar cache (válido por 5 minutos)
    const ahora = new Date();
    if (!forceRefresh && clasificadoresCache && ultimaActualizacion) {
        const minutosDesdeActualizacion = (ahora - ultimaActualizacion) / (1000 * 60);
        if (minutosDesdeActualizacion < 5) {
            console.log("Usando cache de clasificadores");
            return clasificadoresCache;
        }
    }
    
    try {
        const res = await fetch(`${API_BASE}/Clasificadores`);
        if (!res.ok) throw new Error(`Error ${res.status}: No se pudieron cargar clasificadores`);
        
        clasificadoresCache = await res.json();
        ultimaActualizacion = ahora;
        console.log(`Clasificadores cargados: ${clasificadoresCache.length} items`);
        return clasificadoresCache;
    } catch (error) {
        console.error("Error obteniendo clasificadores:", error);
        throw error;
    }
}

/**
 * Construye la estructura jerárquica de clasificadores
 */
function construirEstructuraClasificadores(listaClasificadores) {
    // Crear mapa de nodos
    const mapa = new Map(listaClasificadores.map(n => [n.Cid, { 
        ...n, 
        hijos: [] 
    }]));
    
    // Asignar hijos a padres
    for (const nodo of mapa.values()) {
        if (nodo.Padre && mapa.has(nodo.Padre)) {
            mapa.get(nodo.Padre).hijos.push(nodo);
        }
    }
    
    // Encontrar raíces
    const raices = [];
    for (const nodo of mapa.values()) {
        if (!nodo.Padre || !mapa.has(nodo.Padre)) {
            raices.push(nodo);
        }
    }
    
    // Generar lista ordenada y paths
    const listaOrdenada = [];
    const paths = {};
    
    function recorrerProfundidad(nodo, ancestros) {
        const camino = [...ancestros, nodo.Cid];
        listaOrdenada.push({
            Cid: nodo.Cid,
            nombre: nodo.Clasificador,
            profundidad: ancestros.length,
            camino: camino
        });
        paths[nodo.Cid] = camino;
        
        // Ordenar hijos alfabéticamente
        const hijosOrdenados = [...nodo.hijos].sort((a, b) => 
            a.Clasificador.localeCompare(b.Clasificador)
        );
        
        for (const hijo of hijosOrdenados) {
            recorrerProfundidad(hijo, camino);
        }
    }
    
    raices.forEach(raiz => recorrerProfundidad(raiz, []));
    return { listaOrdenada, paths };
}

/**
 * Rellena un select con opciones de clasificadores
 */
function llenarSelectClasificadores(selectElement, listaOrdenada, valorSeleccionado = '') {
    if (!selectElement) return;
    
    // Limpiar opciones existentes
    selectElement.innerHTML = '<option value="">-- Todos --</option>';
    
    // Agregar opciones con indentación
    for (const clasificador of listaOrdenada) {
        const opcion = document.createElement('option');
        opcion.value = clasificador.Cid;
        opcion.textContent = `${'  '.repeat(clasificador.profundidad)}${clasificador.nombre}`;
        
        if (valorSeleccionado && clasificador.Cid == valorSeleccionado) {
            opcion.selected = true;
        }
        
        selectElement.appendChild(opcion);
    }
}

/**
 * Inicializa todos los selects de clasificadores en la página
 */
async function inicializarSelectsClasificadores() {
    try {
        const clasificadores = await obtenerClasificadores();
        const { listaOrdenada } = construirEstructuraClasificadores(clasificadores);
        
        // Buscar todos los selects que necesiten clasificadores
        const selects = document.querySelectorAll('[data-clasificadores]');
        
        selects.forEach(select => {
            llenarSelectClasificadores(select, listaOrdenada);
        });
        
        console.log(`Selects inicializados: ${selects.length}`);
        return listaOrdenada;
    } catch (error) {
        console.error("Error inicializando selects:", error);
        throw error;
    }
}

/**
 * Obtiene información de un clasificador específico
 */
async function obtenerClasificador(cid) {
    try {
        const clasificadores = await obtenerClasificadores();
        const clasificador = clasificadores.find(c => c.Cid == cid);
        
        if (!clasificador) {
            throw new Error(`Clasificador ${cid} no encontrado`);
        }
        
        return clasificador;
    } catch (error) {
        console.error(`Error obteniendo clasificador ${cid}:`, error);
        throw error;
    }
}

/**
 * Obtiene el camino completo de un clasificador
 */
async function obtenerCaminoClasificador(cid) {
    try {
        const clasificadores = await obtenerClasificadores();
        const { paths } = construirEstructuraClasificadores(clasificadores);
        
        return paths[cid] || [];
    } catch (error) {
        console.error(`Error obteniendo camino para ${cid}:`, error);
        return [];
    }
}

/**
 * Verifica si un clasificador es ancestro de otro
 */
async function esAncestro(clasificadorCid, posibleDescendienteCid) {
    try {
        const camino = await obtenerCaminoClasificador(posibleDescendienteCid);
        return camino.includes(parseInt(clasificadorCid));
    } catch (error) {
        console.error("Error verificando ancestro:", error);
        return false;
    }
}

/**
 * Filtra tickets por clasificador
 */
function filtrarPorClasificador(tickets, clasificadorCid, incluirDescendientes = false) {
    if (!clasificadorCid) return tickets;
    
    return tickets.filter(ticket => {
        if (!ticket.Path || !Array.isArray(ticket.Path)) return false;
        
        if (incluirDescendientes) {
            return ticket.Path.includes(parseInt(clasificadorCid));
        } else {
            // Solo el último elemento del path
            const ultimoCid = ticket.Path[ticket.Path.length - 1];
            return ultimoCid == clasificadorCid;
        }
    });
}

// Funciones auxiliares para debugging
function debugClasificadores() {
    return {
        cache: clasificadoresCache,
        ultimaActualizacion,
        estado: clasificadoresCache ? 'Cargado' : 'No cargado'
    };
}

function limpiarCacheClasificadores() {
    clasificadoresCache = null;
    ultimaActualizacion = null;
    console.log("Cache de clasificadores limpiado");
}

// Exportar para uso global
window.Clasificadores = {
    obtenerClasificadores,
    construirEstructuraClasificadores,
    llenarSelectClasificadores,
    inicializarSelectsClasificadores,
    obtenerClasificador,
    obtenerCaminoClasificador,
    esAncestro,
    filtrarPorClasificador,
    debugClasificadores,
    limpiarCacheClasificadores
};
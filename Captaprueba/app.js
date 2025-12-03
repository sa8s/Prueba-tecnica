const express =require("express")
const{ObjectId}=require("mongodb")
const{connectToDb,getDb}=require("./db")
//init app$ middleware
const app =express()


const cors = require("cors");
app.use(cors());
//const getRoutes = require("./metodos/get");
app.use(express.json())
//db connection
let db
connectToDb((err)=>{
    if(!err){
    app.listen(3000,()=>{
        console.log("app listening on port 3000")
    })
    db=getDb()
    }

})

// Devuelve el path de ids desde la raíz hasta el nodo (ej: ["C000","C002"])
async function getPathForCid(db, cid) {
    if (!cid) return [];
    const all = await db.collection("Clasificadores").find().toArray();
    const map = new Map(all.map(n => [n.Cid, n]));
    const path = [];
    let cur = map.get(cid);
    // si el cid no existe, retornar []
    while (cur) {
        path.unshift(cur.Cid);
        if (!cur.Padre) break;
        cur = map.get(cur.Padre);
    }
    return path;
}


//routes

app.get("/Tickets", (req, res) => {
    const page = parseInt(req.query.p) || 0;
    const itemsPerPage = 20;

    let Tickets = [];

    db.collection("Tickets")
        .find({}, { projection: { _id: 0 } })
        .sort({ Tid: 1 })
        .skip(page * itemsPerPage)
        .limit(itemsPerPage)
        .forEach(item => {

            // Reordenar campos antes de enviarlos
            const reordered = {
                Tid: item.Tid,
                Nombre: item.Nombre,
                Descripcion: item.Descripcion,
                Estado: item.Estado,
                Creado_en: item.Creado_en,
                Ultima_actualizacion: item.Ultima_actualizacion,
                Asignado_a: item.Asignado_a || [],
                Prioridad: item.Prioridad,
                Path:item.Path,
                Comentarios: item.Comentarios || []
            };

            Tickets.push(reordered);
        })
        .then(() => {
            res.status(200).json(Tickets);
        })
        .catch(() => {
            res.status(500).json({ error: "could not fetch tickets" });
        });
});


app.get("/Tickets/:Tid", (req, res) => {

    const Tid = req.params.Tid;

    db.collection("Tickets")
        .findOne({ Tid: Tid })
        .then(doc => {
            if (doc) {
                res.status(200).json(doc);
            } else {
                res.status(404).json({ error: "No ticket found with that Aid" });
            }
        })
        .catch(err => {
            res.status(500).json({ error: "Could not fetch" });
        });
});


app.delete("/Tickets/:Tid", (req, res) => {

    const Tid = req.params.Tid; // viene como string

    db.collection("Tickets")
        .deleteOne({ Tid: Tid })
        .then(result => {
            if (result.deletedCount === 1) {
                res.status(200).json({ message: "Ticket deleted", result });
            } else {
                res.status(404).json({ error: "No ticket found with that Tid" });
            }
        })
        .catch(err => {
            res.status(500).json({ error: "Could not delete" });
        });
});



app.patch("/Tickets/:Tid", async (req, res) => {
    const Tid = req.params.Tid;
    const updates = req.body;

    try {
        const ticket = await db.collection("Tickets").findOne({ Tid });

        if (!ticket) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        const now = new Date();
        const accionesCol = db.collection("Acciones");

        // Helper para crear acciones
        async function registrarAccion(tipo, from, to) {
            const accionesCount = await accionesCol.countDocuments();
            const Aid = "A" + String(accionesCount + 1).padStart(3, "0");

            const accion = {
                Aid,
                TicketId: Tid,
                Tipo_de_accion: tipo,
                From: from,
                To: to,
                Fecha: now
            };

            await accionesCol.insertOne(accion);
            return accion;
        }

        const cambiosRealizados = [];

        // ------------------------------------
        // MANEJO ESPECIAL: CAMBIO DE CLASIFICADOR
        // ------------------------------------
        if (updates.selectedCid) {
            const newPath = await getPathForCid(db, updates.selectedCid);

            const oldPath = Array.isArray(ticket.Path) ? ticket.Path : [];
            const newPathArr = Array.isArray(newPath) ? newPath : [];

            if (JSON.stringify(oldPath) !== JSON.stringify(newPathArr)) {
                const acc = await registrarAccion(
                    "Cambio_clasificacion",
                    oldPath,
                    newPathArr
                );
                cambiosRealizados.push(acc);

                updates.Path = newPathArr;
                updates.Ultima_actualizacion = now;
            }

            delete updates.selectedCid;
        }

        // ------------------------------------
        // CAMBIOS GENERALES (Nombre, Estado, etc.)
        // ------------------------------------
        const mapping = {
            Nombre: "Cambio de nombre",
            Descripcion: "Cambio de descripción",
            Estado: "Cambio de estado",
            Prioridad: "Cambio de prioridad",
            Asignado_a: "Cambio de asignación"
        };

        for (let campo in mapping) {
            if (updates[campo] !== undefined) {
                const oldVal = Array.isArray(ticket[campo]) ? ticket[campo].join(",") : ticket[campo];
                const newVal = Array.isArray(updates[campo]) ? updates[campo].join(",") : updates[campo];

                if (oldVal != newVal) {
                    const acc = await registrarAccion(
                        mapping[campo],
                        oldVal,
                        newVal
                    );
                    cambiosRealizados.push(acc);

                    updates.Ultima_actualizacion = now;
                }
            }
        }

        // ------------------------------------
        // Aplicar el update si hubo cambios
        // ------------------------------------
        if (Object.keys(updates).length > 0) {
            await db.collection("Tickets").updateOne(
                { Tid },
                { $set: updates }
            );
        }

        return res.status(200).json({
            cambios_realizados: cambiosRealizados.length,
            acciones_generadas: cambiosRealizados
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Could not update ticket" });
    }
});





// ---------------------------------------------------------
// 📌 REPORTE PRINCIPAL
// ---------------------------------------------------------
app.get("/Reporte", async (req, res) => {
    try {
        const desde = req.query.desde ? new Date(req.query.desde) : null;
        const hasta = req.query.hasta ? new Date(req.query.hasta) : null;
        const estadoSeleccionado = req.query.estado || null; 
        const finalSel = req.query.final || "actual"; // actual, rango, ambos

        // Obtener todos los tickets
        const tickets = await db.collection("Tickets").find().toArray();
        const acciones = await db.collection("Acciones").find().sort({ Fecha: 1 }).toArray();

        const resultado = [];

        for (const ticket of tickets) {
            const Tid = ticket.Tid;

            // Acciones de este ticket
            const accionesTicket = acciones.filter(a => a.TicketId === Tid);

            if (accionesTicket.length === 0) continue;

            // -----------------------------------------------------
            // 1. Estado inicial DEL RANGO
            // -----------------------------------------------------
            let estadoInicial = null;
            for (const acc of accionesTicket) {
                if (acc.Tipo_de_accion === "Cambio de estado") {
                    if (desde && acc.Fecha < desde) {
                        estadoInicial = acc.To; // último antes del rango
                    }
                }
            }

            if (!estadoInicial) {
                // si no hubo cambios antes del rango, usamos el estado más antiguo
                const primeraAccionEstado = accionesTicket.find(a => a.Tipo_de_accion === "Cambio de estado");
                estadoInicial = primeraAccionEstado ? primeraAccionEstado.From : ticket.Estado;
            }

            // -----------------------------------------------------
            // 2. Estado final (dependiendo de opción)
            // -----------------------------------------------------
            let estadoFinal = estadoInicial;

            if (finalSel === "actual") {
                // Estado actual = último cambio de estado en cualquier fecha
                const ult = [...accionesTicket]
                    .reverse()
                    .find(a => a.Tipo_de_accion === "Cambio de estado");
                
                if (ult) estadoFinal = ult.To;
            }

            if (finalSel === "rango") {
                // Estado final dentro del rango
                let ultimoDentro = null;

                for (const acc of accionesTicket) {
                    if (
                        acc.Tipo_de_accion === "Cambio de estado" &&
                        (!desde || acc.Fecha >= desde) &&
                        (!hasta || acc.Fecha <= hasta)
                    ) {
                        ultimoDentro = acc.To;
                    }
                }

                if (ultimoDentro) estadoFinal = ultimoDentro;
            }

            if (finalSel === "ambos") {
                const ult = [...accionesTicket]
                    .reverse()
                    .find(a => a.Tipo_de_accion === "Cambio de estado");
                if (ult) estadoFinal = ult.To;
            }

            // -----------------------------------------------------
            // 3. Filtrar por estado seleccionado
            // -----------------------------------------------------
            if (estadoSeleccionado) {
                if (finalSel === "actual" && estadoFinal !== estadoSeleccionado) continue;
                if (finalSel === "rango" && estadoFinal !== estadoSeleccionado) continue;
                if (finalSel === "ambos" && estadoFinal !== estadoSeleccionado) continue;
            }

            // -----------------------------------------------------
            // 4. Última acción (informativo)
            // -----------------------------------------------------
            const ultimaAccion = accionesTicket[accionesTicket.length - 1];
            const textoUltimaAccion = `${ultimaAccion.Tipo_de_accion} el ${ultimaAccion.Fecha.toLocaleString()}`;

            // -----------------------------------------------------
            // 5. Agregar al resultado
            // -----------------------------------------------------
            resultado.push({
                Tid: ticket.Tid,
                Nombre: ticket.Nombre,
                EstadoInicial: estadoInicial,
                EstadoFinal: estadoFinal,
                UltimaAccion: textoUltimaAccion
            });
        }

        if (resultado.length === 0) {
            return res.status(404).json({ error: "No tickets found under given criteria" });
        }

        res.status(200).json(resultado);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not generate report" });
    }
});


app.patch("/Tickets/:Tid/Comentario", async (req, res) => {
    const Tid = req.params.Tid;
    const { Comentador, Comentario } = req.body;

    if (!Comentador || !Comentario) {
        return res.status(400).json({ error: "Faltan campos del comentario" });
    }

    const fechaComentario = new Date();

    db.collection("Tickets")
        .updateOne(
            { Tid: Tid },
            {
                $push: {
                    Comentarios: {
                        Comentador,
                        Comentario,
                        Fecha_comentario: fechaComentario
                    }
                }
            }
        )
        .then(result => res.status(200).json(result))
        .catch(err => res.status(500).json({ error: "No se pudo agregar el comentario" }));
});





//routes

app.get("/Clasificadores", (req, res) => {
    const page = parseInt(req.query.p) || 0;
    const itemsPerPage = 2000;

    let Clasificadores = [];

    db.collection("Clasificadores")
        .find({}, { projection: { _id: 0 } })
        .sort({ Cid: 1 })
        .skip(page * itemsPerPage)
        .limit(itemsPerPage)
        .forEach(item => {

            // Reordenar campos antes de devolverlos
            const reordered = {
                Cid: item.Cid,
                Clasificador: item.Clasificador,
                Padre: item.Padre || "",
                Hijos: item.Hijos || []
            };

            Clasificadores.push(reordered);
        })
        .then(() => {
            res.status(200).json(Clasificadores);
        })
        .catch(() => {
            res.status(500).json({ error: "could not fetch documents" });
        });
});

app.get("/Clasificadores/:Cid", (req, res) => {

    const Cid = req.params.Cid;

    db.collection("Clasificadores")
        .findOne({ Cid: Cid })
        .then(doc => {
            if (doc) {
                res.status(200).json(doc);
            } else {
                res.status(404).json({ error: "No classifier found with that Aid" });
            }
        })
        .catch(err => {
            res.status(500).json({ error: "Could not fetch" });
        });
});


app.delete("/Clasificadores/:Cid", (req, res) => {
    const Cid = req.params.Cid;

    db.collection("Clasificadores")
        .deleteOne({ Cid: Cid })
        .then(result => {
            if (result.deletedCount === 1) {
                res.status(200).json(result);
            } else {
                res.status(404).json({ error: "No classifier found with that Cid" });
            }
        })
        .catch(err => {
            res.status(500).json({ error: "Could not delete" });
        });
});


app.patch("/Clasificadores/:Cid", async (req, res) => {
    const Cid = req.params.Cid;
    const updates = req.body;

    try {
        const clas = await db.collection("Clasificadores").findOne({ Cid });

        if (!clas) {
            return res.status(404).json({ error: "Clasificador no encontrado" });
        }

        const padreAnterior = clas.Padre;
        const padreNuevo = updates.Padre !== undefined ? updates.Padre : padreAnterior;

        // ========================
        // 1. Si cambió el padre
        // ========================
        if (padreNuevo !== padreAnterior) {

            // Quitar de los hijos del padre ANTERIOR
            if (padreAnterior) {
                await db.collection("Clasificadores").updateOne(
                    { Cid: padreAnterior },
                    { $pull: { Hijos: Cid } }
                );
            }

            // Agregar a los hijos del padre NUEVO
            if (padreNuevo) {
                await db.collection("Clasificadores").updateOne(
                    { Cid: padreNuevo },
                    { $push: { Hijos: Cid } }
                );
            }
        }

        // ========================
        // 2. Actualizar el nombre o padre en el documento actual
        // ========================
        await db.collection("Clasificadores")
            .updateOne({ Cid }, { $set: updates });

        res.status(200).json({ message: "Clasificador actualizado" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo actualizar" });
    }
});



//routes

app.get("/Acciones", async (req, res) => {
    const tipo = req.query.tipo || null;
    const desde = req.query.desde || null;
    const hasta = req.query.hasta || null;

    try {
        const filtro = {};

        // Filtrar por tipo si viene
        if (tipo) {
            filtro.Tipo_de_accion = tipo;
        }

        // Filtrar por fechas si vienen
        if (desde || hasta) {
            filtro.Fecha = {};

            if (desde) filtro.Fecha.$gte = new Date(desde);
            if (hasta) filtro.Fecha.$lte = new Date(hasta);
        }

        const acciones = await db.collection("Acciones")
            .find(filtro, { projection: { _id: 0 } })
            .sort({ Fecha: 1 })
            .toArray();

        if (acciones.length === 0) {
            return res.status(404).json({ error: "No actions found" });
        }

        res.status(200).json(acciones);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not fetch actions" });
    }
});



app.get("/Acciones/Ticket/:Tid", async (req, res) => {
    const Tid = req.params.Tid;

    const tipo = req.query.tipo || null;
    const desde = req.query.desde || null;
    const hasta = req.query.hasta || null;

    try {
        const filtro = { TicketId: Tid };

        // si filtran tipo
        if (tipo) {
            filtro.Tipo_de_accion = tipo;
        }

        // si filtran por fechas
        if (desde || hasta) {
            filtro.Fecha = {};

            if (desde) filtro.Fecha.$gte = new Date(desde);
            if (hasta) filtro.Fecha.$lte = new Date(hasta);
        }

        const acciones = await db.collection("Acciones")
            .find(filtro, { projection: { _id: 0 } })
            .sort({ Fecha: 1 })
            .toArray();

        if (acciones.length === 0) {
            return res.status(404).json({ error: "No actions found for that criteria" });
        }

        res.status(200).json(acciones);

    } catch (err) {
        res.status(500).json({ error: "Could not fetch actions" });
    }
});




app.delete("/Acciones/_id", (req, res) => {
    //las acciones deberían estar protegidas de cualquier manipulación que pueda ocultar movimientos sospechosos
});

app.patch("/Acciones/_id", (req, res) => {
    //Del mismo modo actualizar las acciones no debería ser permitido
});



async function generateSequentialId(db, collectionName, prefix) {
    const last = await db.collection(collectionName)
        .find({ [prefix + "id"]: { $exists: true } })
        .sort({ [prefix + "id"]: -1 })
        .limit(1)
        .toArray();

    if (last.length === 0) {
        return prefix + "001";
    }

    // extraer número
    const lastId = last[0][prefix + "id"]; // Ej: "T012"
    const num = parseInt(lastId.slice(1)); // → 12
    const next = (num + 1).toString().padStart(3, "0");

    return prefix + next; // Ej: T013
}


app.post("/Tickets", async (req, res) => {
    try {
        const ticket = req.body;

        // Generar Tid secuencial
        ticket.Tid = await generateSequentialId(db, "Tickets", "T");

        // Fechas como Date
        const now = new Date();
        ticket.Creado_en = now;
        ticket.Ultima_actualizacion = now;

        // Asegurar Path: si el frontend envía selectedCid, convertir a path completo
        if (ticket.selectedCid) {
            const path = await getPathForCid(db, ticket.selectedCid);
            ticket.Path = path; // array de Cid
            delete ticket.selectedCid;
        }
        ticket.Path = ticket.Path || [];

        // Insertar ticket
        const result = await db.collection("Tickets").insertOne(ticket);

        // Registrar acción de creación - incluye Path en To si existe
        const accionesCount = await db.collection("Acciones").countDocuments();
        const Aid = "A" + String(accionesCount + 1).padStart(3, "0");

        const accion = {
            Aid,
            TicketId: ticket.Tid,
            Tipo_de_accion: "Creación de Ticket",
            From: [],
            To: "Open",
            Fecha: now
        };

        await db.collection("Acciones").insertOne(accion);

        res.status(201).json({ message: "Ticket creado", Tid: ticket.Tid, result });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "could not create ticket" });
    }
});



app.post("/Acciones", async (req, res) => {
    try {
        const accion = req.body;

        accion.Aid = await generateSequentialId(db, "Acciones", "A");

        const result = await db.collection("Acciones").insertOne(accion);
        res.status(201).json(result);

    } catch (err) {
        res.status(500).json({ error: "could not create action" });
    }
});

app.post("/Clasificadores", async (req, res) => {
    try {
        const clasificador = req.body;

        // 1. Generar Cid secuencial
        clasificador.Cid = await generateSequentialId(db, "Clasificadores", "C");

        // 2. Asegurar campos
        clasificador.Hijos = clasificador.Hijos || [];
        clasificador.Padre = clasificador.Padre || null;

        // 3. Insertar clasificador
        await db.collection("Clasificadores").insertOne(clasificador);

        // 4. Si tiene padre, actualizar la lista de hijos
        if (clasificador.Padre) {
            await db.collection("Clasificadores").updateOne(
                { Cid: clasificador.Padre },
                { $push: { Hijos: clasificador.Cid } }
            );
        }

        res.status(201).json({ message: "Clasificador creado", Cid: clasificador.Cid });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo crear el clasificador" });
    }
});

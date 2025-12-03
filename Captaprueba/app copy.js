/*const express =require("express")
const{ObjectId}=require("mongodb")
const{connectToDb,getDb}=require("./db")
//init app$ middleware
const app =express()


const cors = require("cors");
app.use(cors());

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



//routes

app.get("/Tickets", async (req, res) => {
    try {
        const tickets = await db.collection("Tickets")
            .find({}, { projection: { _id: 0 } })
            .toArray();

        // Reordenar cada ticket para que Tid aparezca primero
        const reordered = tickets.map(t => ({
            Tid: t.Tid,
            Nombre: t.Nombre,
            Descripcion: t.Descripcion,
            Estado: t.Estado,
            Creado_en: t.Creado_en,
            Ultima_actualizacion: t.Ultima_actualizacion,
            Asignado_a: t.Asignado_a,
            Prioridad: t.Prioridad,
            Comentarios: t.Comentarios
        }));

        res.json(reordered);

    } catch (err) {
        res.status(500).json({ error: "could not load tickets" });
    }
});
/*
app.get("/Tickets/:id",(req,res)=>{

    if(ObjectId.isValid(req.params.id)){
    //req.params.id
    db.collection("Tickets")
        .findOne({_id: new ObjectId(req.params.id)})
        .then(doc=>{
            res.status(200).json(doc)
        })
        .catch(err=>{
            res.status(500).json({error:"could not fetch"})
        })
    }else{
        res.status(500).json({error:"Not valid id"})
    }
})*/
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

/*
app.post("/Tickets",(req,res)=>{
    const Ticket=req.body
    db.collection("Tickets")
    .insertOne(Ticket)
    .then(result=>{
        res.status(201).json(result)
    })
    .catch(error=>{
        res.status(500).json({err: "could not create"})
    })
})*/

/*
app.delete("/Tickets/:id",(req,res)=>{
    if(ObjectId.isValid(req.params.id)){
    //req.params.id
    db.collection("Tickets")
        .deleteOne({_id: new ObjectId(req.params.id)})
        .then(result=>{
            res.status(200).json(result)
        })
        .catch(err=>{
            res.status(500).json({error:"Could not delete"})
        })
    }else{
        res.status(500).json({error:"Not valid id"})
    }
})*/
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

        // ==============
        // 1. Comparar cambios para generar acciones
        // ==============
        const cambios = [];

        const mapping = {
            Nombre: "Cambio de nombre",
            Descripcion: "Cambio de descripción",
            Estado: "Cambio de estado",
            Prioridad: "Cambio de prioridad",
            Asignado_a: "Cambio de asignación"
        };

        for (let campo in updates) {
            if (ticket[campo] !== undefined && updates[campo] !== undefined) {

                const oldVal = Array.isArray(ticket[campo])
                    ? ticket[campo].join(",")
                    : ticket[campo];

                const newVal = Array.isArray(updates[campo])
                    ? updates[campo].join(",")
                    : updates[campo];

                if (oldVal != newVal) {
                    cambios.push({
                        campo,
                        Tipo_de_accion: mapping[campo],
                        From: oldVal,
                        To: newVal
                    });
                }
            }
        }


        // ==============
        // 2. Insertar acciones por cada cambio detectado
        // ==============
        for (const cambio of cambios) {
            const count = await db.collection("Acciones").countDocuments();
            const Aid = "A" + String(count + 1).padStart(3, "0");

            await db.collection("Acciones").insertOne({
                Aid,
                TicketId: Tid,
                Tipo_de_accion: cambio.Tipo_de_accion,
                From: cambio.From,
                To: cambio.To,
                Fecha: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })
            });
        }

        // ==============
        // 3. Añadir Ultima_actualizacion SOLO si hubo cambios
        // ==============
        if (cambios.length > 0) {
            updates.Ultima_actualizacion = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })
        }

        // ==============
        // 4. Actualizar ticket en la BD
        // ==============
        const result = await db.collection("Tickets")
            .updateOne({ Tid }, { $set: updates });

        res.status(200).json({
            cambios_realizados: cambios.length,
            acciones_creadas: cambios.map(c => c.Tipo_de_accion),
            result
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Could not update ticket" });
    }
});



/*
app.patch("/Tickets/:Tid", (req, res) => {
    const updates = req.body;
    const Tid = req.params.Tid;

    updates.Ultima_actualizacion = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })
;

    db.collection("Tickets")
        .updateOne({ Tid: Tid }, { $set: updates })
        .then(result => {
            if (result.matchedCount === 1) {
                res.status(200).json(result);
            } else {
                res.status(404).json({ error: "No ticket found with that Tid" });
            }
        })
        .catch(err => {
            res.status(500).json({ error: "Could not update" });
        });
});

*/



app.patch("/Tickets/:Tid/Comentario", async (req, res) => {
    const Tid = req.params.Tid;
    const { Comentador, Comentario } = req.body;

    if (!Comentador || !Comentario) {
        return res.status(400).json({ error: "Faltan campos del comentario" });
    }

    const fechaComentario = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

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

/*
app.patch("/Tickets/:Tid", (req, res) => {
    const updates = req.body;   // valores a actualizar
    const Tid = req.params.Tid; // viene como string

    db.collection("Tickets")
        .updateOne({ Tid: Tid }, { $set: updates })
        .then(result => {
            if (result.matchedCount === 1) {
                res.status(200).json(result);
            } else {
                res.status(404).json({ error: "No ticket found with that Tid" });
            }
        })
        .catch(err => {
            res.status(500).json({ error: "Could not update" });
        });
});*/
/*
app.patch("/Tickets/:id",(req,res)=>{
    const updates=req.body
    //{"title":"new value","rating":6}
    if(ObjectId.isValid(req.params.id)){
    //req.params.id
    db.collection("Tickets")
        .updateOne({_id: new ObjectId(req.params.id)},{$set:updates})
        .then(result=>{
            res.status(200).json(result)
        })
        .catch(err=>{
            res.status(500).json({error:"Could not update"})
        })
    }else{
        res.status(500).json({error:"Not valid id"})
    }
})  



//routes

app.get("/Clasificadores", (req, res) => {
    const page = parseInt(req.query.p) || 0;
    const itemsPerPage = 2;

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

/*
app.get("/Clasificadores/:id", (req, res) => {
    if (ObjectId.isValid(req.params.id)) {
        db.collection("Clasificadores")
            .findOne({ _id: new ObjectId(req.params.id) })
            .then(doc => {
                res.status(200).json(doc);
            })
            .catch(err => {
                res.status(500).json({ error: "could not fetch" });
            });
    } else {
        res.status(500).json({ error: "Not valid id" });
    }
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


app.post("/Clasificadores", (req, res) => {
    const Clasificador = req.body;

    db.collection("Clasificadores")
        .insertOne(Clasificador)
        .then(result => {
            res.status(201).json(result);
        })
        .catch(error => {
            res.status(500).json({ err: "could not create" });
        });
});*/
/*
app.delete("/Clasificadores/:id", (req, res) => {
    if (ObjectId.isValid(req.params.id)) {
        db.collection("Clasificadores")
            .deleteOne({ _id: new ObjectId(req.params.id) })
            .then(result => {
                res.status(200).json(result);
            })
            .catch(err => {
                res.status(500).json({ error: "Could not delete" });
            });
    } else {
        res.status(500).json({ error: "Not valid id" });
    }
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


app.patch("/Clasificadores/:Cid", (req, res) => {
    const updates = req.body;
    const Cid = req.params.Cid;

    db.collection("Clasificadores")
        .updateOne({ Cid: Cid }, { $set: updates })
        .then(result => {
            if (result.matchedCount === 1) {
                res.status(200).json(result);
            } else {
                res.status(404).json({ error: "No classifier found with that Cid" });
            }
        })
        .catch(err => {
            res.status(500).json({ error: "Could not update" });
        });
});
/*
app.patch("/Clasificadores/:id", (req, res) => {
    const updates = req.body;

    if (ObjectId.isValid(req.params.id)) {
        db.collection("Clasificadores")
            .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates })
            .then(result => {
                res.status(200).json(result);
            })
            .catch(err => {
                res.status(500).json({ error: "Could not update" });
            });
    } else {
        res.status(500).json({ error: "Not valid id" });
    }
});

//routes

app.get("/Acciones", (req, res) => {
    const page = req.query.p || 0;
    const itemsPerPage = 12;

    let Acciones = [];

    db.collection("Acciones")
        .find({}, { projection: { _id: 0 } })
        .sort({ Aid: 1 })
        .skip(page * itemsPerPage)
        .limit(itemsPerPage)
        .forEach(item => Acciones.push(item))
        .then(() => {
            res.status(200).json(Acciones);
        })
        .catch(() => {
            res.status(500).json({ error: "could not fetch documents" });
        });
});
/*
app.get("/Acciones/:id", (req, res) => {
    if (ObjectId.isValid(req.params.id)) {
        db.collection("Acciones")
            .findOne({ _id: new ObjectId(req.params.id) })
            .then(doc => {
                res.status(200).json(doc);
            })
            .catch(err => {
                res.status(500).json({ error: "could not fetch" });
            });
    } else {
        res.status(500).json({ error: "Not valid id" });
    }
});


app.get("/Acciones/:Aid", (req, res) => {
    
    const Aid = req.params.Aid;  // viene como string

    db.collection("Acciones")
        .findOne({ Aid: Aid })
        .then(doc => {
            if (doc) {
                res.status(200).json(doc);
            } else {
                res.status(404).json({ error: "No action found with that Aid" });
            }
        })
        .catch(err => {
            res.status(500).json({ error: "Could not fetch" });
        });
});

/*
app.post("/Acciones", (req, res) => {
    const Accion = req.body;

    db.collection("Acciones")
        .insertOne(Accion)
        .then(result => {
            res.status(201).json(result);
        })
        .catch(error => {
            res.status(500).json({ err: "could not create" });
        });
});
app.delete("/Acciones/:Aid", (req, res) => {
    const Aid = req.params.Aid;

    db.collection("Acciones")
        .deleteOne({ Aid: Aid })
        .then(result => {
            if (result.deletedCount === 1) {
                res.status(200).json(result);
            } else {
                res.status(404).json({ error: "No action found with that Aid" });
            }
        })
        .catch(err => {
            res.status(500).json({ error: "Could not delete" });
        });
});
/*
app.delete("/Acciones/:id", (req, res) => {
    if (ObjectId.isValid(req.params.id)) {
        db.collection("Acciones")
            .deleteOne({ _id: new ObjectId(req.params.id) })
            .then(result => {
                res.status(200).json(result);
            })
            .catch(err => {
                res.status(500).json({ error: "Could not delete" });
            });
    } else {
        res.status(500).json({ error: "Not valid id" });
    }
});*/
/*
app.patch("/Acciones/:id", (req, res) => {
    const updates = req.body;

    if (ObjectId.isValid(req.params.id)) {
        db.collection("Acciones")
            .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates })
            .then(result => {
                res.status(200).json(result);
            })
            .catch(err => {
                res.status(500).json({ error: "Could not update" });
            });
    } else {
        res.status(500).json({ error: "Not valid id" });
    }
});
app.patch("/Acciones/:Aid", (req, res) => {
    const updates = req.body;
    const Aid = req.params.Aid;

    db.collection("Acciones")
        .updateOne({ Aid: Aid }, { $set: updates })
        .then(result => {
            if (result.matchedCount === 1) {
                res.status(200).json(result);
            } else {
                res.status(404).json({ error: "No action found with that Aid" });
            }
        })
        .catch(err => {
            res.status(500).json({ error: "Could not update" });
        });
});
//-------------------------------------------------


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

/*
app.post("/Tickets", async (req, res) => {
    try {
        const ticket = req.body;

        // generar Tid secuencial
        ticket.Tid = await generateSequentialId(db, "Tickets", "T");

        const result = await db.collection("Tickets").insertOne(ticket);
        res.status(201).json(result);

    } catch (err) {
        res.status(500).json({ error: "could not create ticket" });
    }
});
app.post("/Tickets", async (req, res) => {
    try {
        const ticket = req.body;

        // Generar Tid secuencial
        ticket.Tid = await generateSequentialId(db, "Tickets", "T");

        // Fechas con Bogotá
        const now = new Date().toLocaleString("es-CO", {
            timeZone: "America/Bogota"
        });

        ticket.Creado_en = now;
        ticket.Ultima_actualizacion = now;

        // Insertar ticket
        const result = await db.collection("Tickets").insertOne(ticket);

        // ---------------------------------------------------------
        // 📌 REGISTRAR LA ACCIÓN (corregido)
        // ---------------------------------------------------------

        const accionesCount = await db.collection("Acciones").countDocuments();
        const Aid = "A" + String(accionesCount + 1).padStart(3, "0");

        await db.collection("Acciones").insertOne({
            Aid,
            TicketId: ticket.Tid,        // 🔥 CORREGIDO
            Tipo_de_accion: "Creación de Ticket",
            From: "",
            To: ticket.Nombre,
            Fecha: now                   // 🔥 MISMA ZONA HORARIA
        });

        // ---------------------------------------------------------
        // 📌 RESPONDER SOLO DESPUÉS DE GUARDAR TODO
        // ---------------------------------------------------------
        res.status(201).json(result);

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

        clasificador.Cid = await generateSequentialId(db, "Clasificadores", "C");

        const result = await db.collection("Clasificadores").insertOne(clasificador);
        res.status(201).json(result);

    } catch (err) {
        res.status(500).json({ error: "could not create classifier" });
    }
})*/

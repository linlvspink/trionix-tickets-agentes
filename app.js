import "dotenv/config"; // carga las variables del archivo .env (en producción vienen del panel de la plataforma)
import express from "express";
import { fileURLToPath } from "node:url";
import { conectarDB } from "./db.js";
import Ticket from "./models/Ticket.js";
import Agente from "./models/Agente.js";
import ticketsRouter from "./routes/tickets.js";
import agentesRouter from "./routes/agentes.js";
import { manejarErrores } from "./middleware/errores.js";

const app = express();

// Lee el JSON que llega en el body de las peticiones POST/PUT
app.use(express.json());

// Sirve el frontend (carpeta public/)
app.use(express.static(fileURLToPath(new URL("./public", import.meta.url))));

// Rutas de la API
app.use("/api/tickets", ticketsRouter);
app.use("/api/agentes", agentesRouter);

// Cualquier otra ruta que empiece con /api no existe
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// El middleware de errores SIEMPRE va al final
app.use(manejarErrores);

// En Render/Railway el puerto lo da la plataforma en la variable PORT.
const PORT = process.env.PORT || 10000;

async function iniciar() {
  // 1. Primero se conecta a MongoDB
  await conectarDB();

  // 2. Se asegura de que los índices existan (incluido el unique de email) también en producción
  await Promise.all([Ticket.init(), Agente.init()]);

  // 3. Solo entonces se empieza a escuchar peticiones
  app.listen(PORT, () => {
    console.log(`Servidor Trionix Tickets corriendo en el puerto ${PORT}`);
  });
}

iniciar().catch((err) => {
  console.error("No se pudo iniciar la aplicación:", err.message);
  process.exit(1);
});

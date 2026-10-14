import "dotenv/config";
import mongoose from "mongoose";
import { conectarDB } from "./db.js";
import Agente from "./models/Agente.js";
import Ticket from "./models/Ticket.js";

// ATENCIÓN: este script BORRA las colecciones agentes y tickets y las vuelve a llenar.
// Uso: npm run seed
async function sembrar() {
  await conectarDB();
  await Promise.all([Agente.init(), Ticket.init()]);

  await Ticket.deleteMany({});
  await Agente.deleteMany({});

  const [laura, diego, marta, pablo] = await Agente.insertMany([
    { nombre: "Laura Gómez", email: "laura.gomez@trionix.com", especialidad: "redes" },
    { nombre: "Diego Ramírez", email: "diego.ramirez@trionix.com", especialidad: "software" },
    { nombre: "Marta Pérez", email: "marta.perez@trionix.com", especialidad: "hardware" },
    { nombre: "Pablo Núñez", email: "pablo.nunez@trionix.com", especialidad: "general", activo: false },
  ]);

  await Ticket.insertMany([
    {
      cliente: "Comercial Andina",
      asunto: "No carga el módulo de facturación",
      prioridad: "alta",
      agenteId: diego._id,
      comentarios: [{ autor: "Diego Ramírez", texto: "Reproduje el error, revisando logs." }],
    },
    {
      cliente: "Laboratorios Vitalis",
      asunto: "Duda sobre exportar reportes a Excel",
      prioridad: "baja",
    },
    {
      cliente: "Distribuidora Norte",
      asunto: "Error al iniciar sesión en la plataforma",
      prioridad: "media",
      estado: "resuelto",
      agenteId: diego._id,
    },
    {
      cliente: "Clínica San Rafael",
      asunto: "Sin conexión en la sede principal",
      prioridad: "alta",
      agenteId: laura._id,
    },
    {
      cliente: "Textiles del Caribe",
      asunto: "Impresora de red no responde",
      prioridad: "media",
      agenteId: marta._id,
    },
    {
      cliente: "Grupo Aurora",
      asunto: "Solicitud de nuevo usuario en el sistema",
      prioridad: "baja",
    },
  ]);

  console.log("Datos de prueba creados: 4 agentes y 6 tickets");
  await mongoose.disconnect();
}

sembrar().catch((err) => {
  console.error("Error al sembrar datos:", err.message);
  process.exit(1);
});

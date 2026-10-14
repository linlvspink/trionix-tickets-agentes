import mongoose from "mongoose";

// Esquema de la colección "tickets".
// "comentarios" va EMBEBIDO (dentro del mismo documento).
// "agenteId" es una REFERENCIA (ObjectId) hacia la colección "agentes".
const ticketSchema = new mongoose.Schema(
  {
    cliente: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    asunto: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    prioridad: { type: String, enum: ["baja", "media", "alta"], required: true },
    estado: { type: String, enum: ["abierto", "resuelto"], default: "abierto" },
    comentarios: [
      {
        autor: String,
        texto: String,
        fecha: { type: Date, default: Date.now },
      },
    ],
    // Sin el "ref: 'Agente'", populate() no funcionaría.
    agenteId: { type: mongoose.Schema.Types.ObjectId, ref: "Agente", default: null },
  },
  { timestamps: true }
);

// Índice compuesto (bonus 23): acelera las consultas por agente y estado, por ejemplo
// "¿este agente tiene tickets abiertos?" (DELETE de agentes) y GET /api/agentes/:id/tickets.
ticketSchema.index({ agenteId: 1, estado: 1 });

export default mongoose.model("Ticket", ticketSchema);

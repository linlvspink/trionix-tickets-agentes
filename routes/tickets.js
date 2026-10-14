import { Router } from "express";
import Joi from "joi";
import Ticket from "../models/Ticket.js";
import Agente from "../models/Agente.js";
import { validar, esObjectId } from "../utils/validar.js";
import { poblarAgente, formatearTicket } from "../utils/formatoTicket.js";
import { validarId } from "../middleware/validarId.js";

const router = Router();

// Toda ruta que tenga ":id" pasa primero por validarId (400 si no es un ObjectId).
router.param("id", validarId);

// ---------------------------------------------------------------
// Esquemas de Joi
// ---------------------------------------------------------------
const PRIORIDADES = ["baja", "media", "alta"];
const ESTADOS = ["abierto", "resuelto"];

// Se usa en POST y PUT. "estado" es opcional: en POST se ignora (siempre nace "abierto").
const esquemaTicket = Joi.object({
  cliente: Joi.string().trim().min(2).max(100).required(),
  asunto: Joi.string().trim().min(5).max(200).required(),
  prioridad: Joi.string().valid(...PRIORIDADES).required(),
  estado: Joi.string().valid(...ESTADOS),
});

// Filtros opcionales de GET /api/tickets (?estado= ?prioridad= ?q=)
const esquemaFiltros = Joi.object({
  estado: Joi.string().valid(...ESTADOS),
  prioridad: Joi.string().valid(...PRIORIDADES),
  q: Joi.string().trim().max(100).allow(""),
});

const esquemaComentario = Joi.object({
  autor: Joi.string().trim().min(2).max(100).required(),
  texto: Joi.string().trim().min(3).max(1000).required(),
});

const esquemaAsignar = Joi.object({
  agenteId: Joi.string().required(),
});

// Escapa los caracteres especiales de regex para que ?q=a.b busque literalmente "a.b"
function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------
// 1. GET /api/tickets  (filtros opcionales: ?estado= ?prioridad= ?q=)
// ---------------------------------------------------------------
router.get("/", async (req, res) => {
  const { error, value } = validar(esquemaFiltros, req.query);
  if (error) return res.status(400).json({ error });

  const filtro = {};
  if (value.estado) filtro.estado = value.estado;
  if (value.prioridad) filtro.prioridad = value.prioridad;

  // Bonus 22: búsqueda por texto en asunto o cliente (sin distinguir mayúsculas)
  if (value.q) {
    const patron = new RegExp(escaparRegex(value.q), "i");
    filtro.$or = [{ asunto: patron }, { cliente: patron }];
  }

  const tickets = await poblarAgente(Ticket.find(filtro).sort({ createdAt: -1 }));
  res.json(tickets.map(formatearTicket));
});

// ---------------------------------------------------------------
// 2. GET /api/tickets/:id
// ---------------------------------------------------------------
router.get("/:id", async (req, res) => {
  const ticket = await poblarAgente(Ticket.findById(req.params.id));

  if (!ticket) {
    return res.status(404).json({ error: "Ticket no encontrado" });
  }

  res.json(formatearTicket(ticket));
});

// ---------------------------------------------------------------
// 3. POST /api/tickets  -> el estado siempre nace "abierto"
// ---------------------------------------------------------------
router.post("/", async (req, res) => {
  const { error, value } = validar(esquemaTicket, req.body);
  if (error) return res.status(400).json({ error });

  // Se copian solo estos 3 campos: cualquier "estado" que envíe el cliente se ignora.
  const ticket = await Ticket.create({
    cliente: value.cliente,
    asunto: value.asunto,
    prioridad: value.prioridad,
  });

  res.status(201).json(formatearTicket(ticket));
});

// ---------------------------------------------------------------
// 4. PUT /api/tickets/:id  (también se usa para marcar como resuelto)
// ---------------------------------------------------------------
router.put("/:id", async (req, res) => {
  const { error, value } = validar(esquemaTicket, req.body);
  if (error) return res.status(400).json({ error });

  const ticket = await poblarAgente(
    Ticket.findByIdAndUpdate(req.params.id, value, {
      returnDocument: "after", // devuelve el documento ya actualizado (equivale a { new: true })
      runValidators: true, // aplica las validaciones del esquema de Mongoose
    })
  );

  if (!ticket) {
    return res.status(404).json({ error: "Ticket no encontrado" });
  }

  res.json(formatearTicket(ticket));
});

// ---------------------------------------------------------------
// 5. DELETE /api/tickets/:id
// ---------------------------------------------------------------
router.delete("/:id", async (req, res) => {
  const eliminado = await Ticket.findByIdAndDelete(req.params.id);

  if (!eliminado) {
    return res.status(404).json({ error: "Ticket no encontrado" });
  }

  res.status(204).send();
});

// ---------------------------------------------------------------
// 6. POST /api/tickets/:id/comentarios  -> agrega un comentario embebido
// ---------------------------------------------------------------
router.post("/:id/comentarios", async (req, res) => {
  const { error, value } = validar(esquemaComentario, req.body);
  if (error) return res.status(400).json({ error });

  const ticket = await poblarAgente(
    Ticket.findByIdAndUpdate(
      req.params.id,
      { $push: { comentarios: value } }, // agrega al array sin tocar el resto del documento
      { returnDocument: "after", runValidators: true }
    )
  );

  if (!ticket) {
    return res.status(404).json({ error: "Ticket no encontrado" });
  }

  res.status(201).json(formatearTicket(ticket));
});

// ---------------------------------------------------------------
// 12. POST /api/tickets/:id/asignar   body: { "agenteId": "<id>" }
// ---------------------------------------------------------------
router.post("/:id/asignar", async (req, res) => {
  // a) El body debe traer agenteId, con formato de ObjectId  -> 400
  const { error, value } = validar(esquemaAsignar, req.body);
  if (error) return res.status(400).json({ error });

  if (!esObjectId(value.agenteId)) {
    return res.status(400).json({ error: `El agenteId "${value.agenteId}" no tiene formato válido de ObjectId` });
  }

  // b) El ticket debe existir  -> 404
  const ticketExiste = await Ticket.exists({ _id: req.params.id });
  if (!ticketExiste) {
    return res.status(404).json({ error: "Ticket no encontrado" });
  }

  // c) El agente debe existir (404) y estar activo (400)
  const agente = await Agente.findById(value.agenteId);
  if (!agente) {
    return res.status(404).json({ error: "Agente no encontrado" });
  }
  if (!agente.activo) {
    return res.status(400).json({ error: `El agente ${agente.nombre} está inactivo y no puede recibir tickets` });
  }

  // d) Todo es válido: se escribe la asignación y se devuelve el ticket con el agente resuelto
  const ticket = await poblarAgente(
    Ticket.findByIdAndUpdate(req.params.id, { agenteId: agente._id }, { returnDocument: "after", runValidators: true })
  );

  if (!ticket) {
    return res.status(404).json({ error: "Ticket no encontrado" });
  }

  res.json(formatearTicket(ticket));
});

export default router;

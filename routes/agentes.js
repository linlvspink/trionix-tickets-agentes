import { Router } from "express";
import Joi from "joi";
import Agente from "../models/Agente.js";
import Ticket from "../models/Ticket.js";
import { validar } from "../utils/validar.js";
import { poblarAgente, formatearTicket } from "../utils/formatoTicket.js";
import { validarId } from "../middleware/validarId.js";

const router = Router();

// Toda ruta que tenga ":id" pasa primero por validarId (400 si no es un ObjectId).
router.param("id", validarId);

// ---------------------------------------------------------------
// Esquemas de Joi
// ---------------------------------------------------------------
const ESPECIALIDADES = ["redes", "software", "hardware", "general"];

// Se usa en POST y PUT
const esquemaAgente = Joi.object({
  nombre: Joi.string().trim().min(3).max(100).required(),
  email: Joi.string().trim().email().required(),
  especialidad: Joi.string().valid(...ESPECIALIDADES).required(),
  activo: Joi.boolean(),
});

// Filtros opcionales de GET /api/agentes (?especialidad= ?activo=)
const esquemaFiltros = Joi.object({
  especialidad: Joi.string().valid(...ESPECIALIDADES),
  activo: Joi.boolean(), // convierte "true"/"false" (texto de la URL) a booleano
});

// ---------------------------------------------------------------
// 7. GET /api/agentes  (filtros opcionales: ?especialidad= ?activo=)
// ---------------------------------------------------------------
router.get("/", async (req, res) => {
  const { error, value } = validar(esquemaFiltros, req.query);
  if (error) return res.status(400).json({ error });

  const filtro = {};
  if (value.especialidad) filtro.especialidad = value.especialidad;
  if (value.activo !== undefined) filtro.activo = value.activo;

  const agentes = await Agente.find(filtro).sort({ nombre: 1 });
  res.json(agentes);
});

// ---------------------------------------------------------------
// Bonus 21: GET /api/agentes/stats
// IMPORTANTE: va ANTES de "/:id"; si no, Express leería "stats" como si fuera un id.
// ---------------------------------------------------------------
router.get("/stats", async (req, res) => {
  const stats = await Agente.aggregate([
    {
      // Une cada agente con todos los tickets cuyo agenteId sea el _id del agente
      $lookup: {
        from: Ticket.collection.name, // "tickets"
        localField: "_id",
        foreignField: "agenteId",
        as: "tickets",
      },
    },
    {
      $project: {
        nombre: 1,
        especialidad: 1,
        activo: 1,
        abiertos: {
          $size: { $filter: { input: "$tickets", as: "t", cond: { $eq: ["$$t.estado", "abierto"] } } },
        },
        resueltos: {
          $size: { $filter: { input: "$tickets", as: "t", cond: { $eq: ["$$t.estado", "resuelto"] } } },
        },
      },
    },
    { $sort: { nombre: 1 } },
  ]);

  res.json(stats);
});

// ---------------------------------------------------------------
// 8. GET /api/agentes/:id
// ---------------------------------------------------------------
router.get("/:id", async (req, res) => {
  const agente = await Agente.findById(req.params.id);

  if (!agente) {
    return res.status(404).json({ error: "Agente no encontrado" });
  }

  res.json(agente);
});

// ---------------------------------------------------------------
// 14. GET /api/agentes/:id/tickets  -> tickets asignados a ese agente
// ---------------------------------------------------------------
router.get("/:id/tickets", async (req, res) => {
  const existe = await Agente.exists({ _id: req.params.id });
  if (!existe) {
    return res.status(404).json({ error: "Agente no encontrado" });
  }

  const tickets = await poblarAgente(Ticket.find({ agenteId: req.params.id }).sort({ createdAt: -1 }));
  res.json(tickets.map(formatearTicket));
});

// ---------------------------------------------------------------
// 9. POST /api/agentes
// Si el correo ya existe, MongoDB lanza un error con code 11000; no se captura aquí:
// llega al middleware de errores (middleware/errores.js), que lo traduce a un 400 legible.
// ---------------------------------------------------------------
router.post("/", async (req, res) => {
  const { error, value } = validar(esquemaAgente, req.body);
  if (error) return res.status(400).json({ error });

  const agente = await Agente.create(value);
  res.status(201).json(agente);
});

// ---------------------------------------------------------------
// 10. PUT /api/agentes/:id  (mismo manejo de correo duplicado que en el POST)
// ---------------------------------------------------------------
router.put("/:id", async (req, res) => {
  const { error, value } = validar(esquemaAgente, req.body);
  if (error) return res.status(400).json({ error });

  const agente = await Agente.findByIdAndUpdate(req.params.id, value, {
    returnDocument: "after", // devuelve el documento ya actualizado (equivale a { new: true })
    runValidators: true,
  });

  if (!agente) {
    return res.status(404).json({ error: "Agente no encontrado" });
  }

  res.json(agente);
});

// ---------------------------------------------------------------
// 11. DELETE /api/agentes/:id
// Solo se elimina si no tiene tickets ABIERTOS asignados (409 Conflict si los tiene).
// ---------------------------------------------------------------
router.delete("/:id", async (req, res) => {
  const agente = await Agente.findById(req.params.id);

  if (!agente) {
    return res.status(404).json({ error: "Agente no encontrado" });
  }

  const abiertos = await Ticket.countDocuments({ agenteId: agente._id, estado: "abierto" });

  if (abiertos > 0) {
    return res.status(409).json({
      error: `No se puede eliminar a ${agente.nombre}: tiene ${abiertos} ticket(s) abierto(s) asignado(s). Resuélvelos o reasígnalos primero.`,
    });
  }

  // Los tickets ya resueltos de este agente dejan de apuntar a un agente que ya no existe.
  await Ticket.updateMany({ agenteId: agente._id }, { $set: { agenteId: null } });
  await agente.deleteOne();

  res.status(204).send();
});

export default router;

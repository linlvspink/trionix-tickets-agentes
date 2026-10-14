// Helpers compartidos por las rutas de tickets y de agentes.

// Resuelve la referencia agenteId -> trae nombre y especialidad del agente (populate).
// Recibe una consulta de Mongoose y devuelve la misma consulta con populate aplicado.
export function poblarAgente(consulta) {
  return consulta.populate("agenteId", "nombre especialidad");
}

// Convierte un documento de Mongoose en el JSON que ve el cliente:
// el campo "agenteId" (ya resuelto) se renombra a "agente", y es null si no hay nadie asignado.
export function formatearTicket(doc) {
  const { agenteId, __v, ...resto } = doc.toObject();
  return { ...resto, agente: agenteId || null };
}

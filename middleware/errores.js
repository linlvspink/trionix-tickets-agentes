// Middleware de errores: se ejecuta cuando alguna ruta lanza un error.
// Aquí se traducen los errores de MongoDB/Mongoose a respuestas HTTP legibles.
export function manejarErrores(err, req, res, next) {
  // 1. Violación de índice único (por ejemplo, correo de agente repetido): code 11000
  if (err.code === 11000) {
    // MongoDB indica en keyPattern cuál índice se violó, por ejemplo { email: 1 }
    let campo = Object.keys(err.keyPattern || err.keyValue || {})[0];
    // Si el motor no informa el campo: en la colección agentes la única restricción unique es email
    if (!campo && req.originalUrl.startsWith("/api/agentes")) campo = "email";

    const mensaje =
      campo === "email"
        ? "Ya existe un agente registrado con ese correo"
        : "Ya existe un registro con ese valor; no se permiten duplicados";
    return res.status(400).json({ error: mensaje });
  }

  // 2. Error de validación de Mongoose (runValidators, enum, minlength, etc.)
  if (err.name === "ValidationError") {
    const mensajes = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: mensajes.join(". ") });
  }

  // 3. Valor con tipo incorrecto (por ejemplo un id mal formado que llegó a Mongoose)
  if (err.name === "CastError") {
    return res.status(400).json({ error: `Valor inválido para ${err.path}` });
  }

  // 4. JSON mal formado en el body (lo lanza express.json())
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la petición no es un JSON válido" });
  }

  // 5. Cualquier otro error: se registra en el servidor y el cliente solo ve un mensaje genérico
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}

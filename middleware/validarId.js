import { esObjectId } from "../utils/validar.js";

// Se usa con router.param("id", validarId): corre automáticamente en toda ruta que tenga ":id".
// Si el id no tiene formato de ObjectId responde 400 antes de consultar la base de datos.
export function validarId(req, res, next, valor) {
  if (!esObjectId(valor)) {
    return res.status(400).json({ error: `El id "${valor}" no tiene formato válido de ObjectId` });
  }
  next();
}

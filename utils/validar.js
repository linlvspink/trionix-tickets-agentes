// Utilidades de validación compartidas por las rutas.

// Mensajes de Joi en español. {#label} es el nombre del campo, {#limit} el valor del límite.
const mensajesJoi = {
  "any.required": "El campo {#label} es obligatorio",
  "string.base": "El campo {#label} debe ser texto",
  "string.empty": "El campo {#label} no puede estar vacío",
  "string.min": "El campo {#label} debe tener al menos {#limit} caracteres",
  "string.max": "El campo {#label} no puede superar {#limit} caracteres",
  "string.email": "El campo {#label} no tiene formato de correo válido",
  "string.pattern.base": "El campo {#label} no tiene un formato válido",
  "boolean.base": "El campo {#label} debe ser verdadero o falso",
  "any.only": "El campo {#label} tiene un valor no permitido",
  "object.unknown": "El campo {#label} no está permitido",
  "object.base": "El cuerpo de la petición debe ser un objeto JSON",
};

// Valida "datos" contra un esquema de Joi.
// Devuelve { error: "mensaje legible" | null, value: datosLimpios }.
export function validar(esquema, datos) {
  const { error, value } = esquema.validate(datos ?? {}, {
    messages: mensajesJoi,
    errors: { wrap: { label: false } }, // sin comillas alrededor del nombre del campo
  });

  return { error: error ? error.details[0].message : null, value };
}

// Un ObjectId de MongoDB son exactamente 24 caracteres hexadecimales.
export function esObjectId(texto) {
  return typeof texto === "string" && /^[0-9a-fA-F]{24}$/.test(texto);
}

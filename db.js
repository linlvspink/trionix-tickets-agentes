import mongoose from "mongoose";

// Conecta a MongoDB usando la cadena guardada en la variable de entorno MONGODB_URI.
export async function conectarDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Falta la variable de entorno MONGODB_URI");
  }

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");
}

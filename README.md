# Trionix Tickets: Sistema de Soporte con Agentes

**Estudiante:** Carolina Santiago
**Asignatura:** Desarrollo Web Backend · Node.js — Parcial Segundo Corte

Aplicación web para gestionar los tickets de soporte de Trionix Labs y los agentes que los atienden.
Incluye una API REST (Express + Joi + Mongoose) sobre MongoDB con dos colecciones relacionadas
(`tickets` y `agentes`), un endpoint para asignar un agente a un ticket, y un frontend en HTML/CSS/JS
plano que consume la API sin recargar la página.

## URL pública

https://trionix-tickets-agentes-zfg0.onrender.com/

## Correr el proyecto localmente

Requisitos: Node.js 20 o superior y una base de datos MongoDB (local o MongoDB Atlas).

```bash
git clone <url-del-repositorio>
cd trionix-tickets-agentes
npm install
cp .env.example .env        # y edita MONGODB_URI con tu cadena de conexión
npm run seed                # opcional: carga agentes y tickets de prueba (BORRA las colecciones)
npm start                   # http://localhost:8080
```

## Variables de entorno

Se definen en un archivo `.env` (local, no se sube al repositorio) o en el panel de la plataforma de despliegue.
El archivo `.env.example` muestra el formato sin valores reales.

| Variable | Descripción |
|---|---|
| `MONGODB_URI` | Cadena de conexión a MongoDB (en producción, la de MongoDB Atlas). |
| `PORT` | Puerto del servidor. Opcional: por defecto 8080 (las plataformas de despliegue lo asignan solas). |

## Estructura

```
├── public/               frontend estático (index.html, style.css, script.js)
├── models/               Ticket.js y Agente.js (esquemas de Mongoose)
├── routes/               tickets.js y agentes.js (endpoints)
├── middleware/           errores.js (manejo central de errores) y validarId.js
├── utils/                validar.js (Joi en español) y formatoTicket.js (populate y forma de la respuesta)
├── db.js                 conexión a MongoDB
├── seed.js               datos de prueba
└── app.js                arranque de Express
```

## Endpoints

| Método | Ruta | Descripción | Códigos |
|---|---|---|---|
| GET | `/api/tickets` | Lista tickets. Filtros: `?estado=` `?prioridad=` `?q=` | 200, 400 |
| GET | `/api/tickets/:id` | Un ticket (con el agente resuelto en `agente`) | 200, 400, 404 |
| POST | `/api/tickets` | Crea un ticket (siempre nace `abierto`) | 201, 400 |
| PUT | `/api/tickets/:id` | Actualiza un ticket | 200, 400, 404 |
| DELETE | `/api/tickets/:id` | Elimina un ticket | 204, 400, 404 |
| POST | `/api/tickets/:id/comentarios` | Agrega un comentario embebido | 201, 400, 404 |
| POST | `/api/tickets/:id/asignar` | Asigna un agente: body `{ "agenteId": "..." }` | 200, 400, 404 |
| GET | `/api/agentes` | Lista agentes. Filtros: `?especialidad=` `?activo=` | 200, 400 |
| GET | `/api/agentes/stats` | Tickets abiertos/resueltos por agente (bonus) | 200 |
| GET | `/api/agentes/:id` | Un agente | 200, 400, 404 |
| GET | `/api/agentes/:id/tickets` | Tickets asignados a ese agente | 200, 400, 404 |
| POST | `/api/agentes` | Crea un agente (correo único) | 201, 400 |
| PUT | `/api/agentes/:id` | Actualiza un agente | 200, 400, 404 |
| DELETE | `/api/agentes/:id` | Elimina un agente solo si no tiene tickets abiertos | 204, 404, 409 |

Todos los errores responden con el formato `{ "error": "mensaje legible" }`.
El correo duplicado (error 11000 de MongoDB) se captura en `middleware/errores.js` y se traduce a un 400.

## Bonus implementados

- **21.** `GET /api/agentes/stats`: agregación con `$lookup` entre `agentes` y `tickets`, que cuenta abiertos y resueltos por agente.
- **22.** `GET /api/tickets?q=texto`: búsqueda con `$regex` (sin distinguir mayúsculas) sobre `asunto` y `cliente`.
- **23.** Índice compuesto `{ agenteId: 1, estado: 1 }` en `tickets`.

### Justificación del índice compuesto

Las consultas más frecuentes sobre tickets por agente filtran por `agenteId` y, muchas veces, también por `estado`:

- `DELETE /api/agentes/:id` cuenta los tickets **abiertos** de ese agente antes de permitir eliminarlo.
- `GET /api/agentes/:id/tickets` lista los tickets de un agente.
- `GET /api/agentes/stats` agrupa tickets por agente y estado.

Con el índice, MongoDB encuentra esos tickets sin recorrer toda la colección. Como el campo que más se filtra
(`agenteId`) va primero, el mismo índice también sirve para consultas que solo filtran por agente.
Además, el índice `unique` sobre `email` en `agentes` impide correos repetidos a nivel de base de datos.

## Despliegue

Desplegado en [Render / Railway / otro] con MongoDB Atlas como base de datos en producción.
La cadena de conexión se configura como variable de entorno `MONGODB_URI` en el panel de la plataforma;
no existe en el código ni en el repositorio. Los índices (incluido el `unique` de `email`) se crean al iniciar
la aplicación (`Model.init()` en `app.js`), también en la base de producción.

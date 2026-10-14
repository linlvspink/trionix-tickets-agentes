// ------------------------------------------------------------------
// Estado local del navegador
// ------------------------------------------------------------------
let tickets = [];
let agentes = [];
let filtroActivo = "todos";
const detallesAbiertos = new Set(); // ids de tickets cuyos comentarios están desplegados

const listaTicketsEl = document.getElementById("lista-tickets");
const listaAgentesEl = document.getElementById("lista-agentes");
const avisoEl = document.getElementById("aviso");

// ------------------------------------------------------------------
// Función única para hablar con la API.
// Si la respuesta no es exitosa, lanza un Error con el mensaje legible que mandó el servidor.
// ------------------------------------------------------------------
async function api(url, metodo = "GET", cuerpo) {
  const opciones = { method: metodo, headers: {} };

  if (cuerpo !== undefined) {
    opciones.headers["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(cuerpo);
  }

  let respuesta;
  try {
    respuesta = await fetch(url, opciones);
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }

  if (respuesta.status === 204) return null; // eliminado: no hay cuerpo

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    // la respuesta no traía JSON
  }

  if (!respuesta.ok) {
    throw new Error((datos && datos.error) || `Error ${respuesta.status}`);
  }

  return datos;
}

// ------------------------------------------------------------------
// Aviso global: muestra errores (400, 404, 409...) o confirmaciones
// ------------------------------------------------------------------
let temporizadorAviso;

function mostrarAviso(mensaje, tipo = "error") {
  avisoEl.textContent = mensaje;
  avisoEl.className = `aviso ${tipo}`;
  avisoEl.hidden = false;

  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (avisoEl.hidden = true), 7000);
}

avisoEl.addEventListener("click", () => (avisoEl.hidden = true));

// Evita que texto escrito por el usuario se interprete como HTML
function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// ------------------------------------------------------------------
// Carga de datos
// ------------------------------------------------------------------
async function cargarTodo() {
  try {
    [tickets, agentes] = await Promise.all([api("/api/tickets"), api("/api/agentes")]);
    renderizarTickets();
    renderizarAgentes();
  } catch (err) {
    mostrarAviso(err.message);
  }
}

// ------------------------------------------------------------------
// Renderizado de tickets
// ------------------------------------------------------------------
function htmlTicket(t) {
  const agentesActivos = agentes.filter((a) => a.activo);
  const idAgenteActual = t.agente ? t.agente._id : "";

  const opciones = agentesActivos
    .map(
      (a) =>
        `<option value="${a._id}" ${a._id === idAgenteActual ? "selected" : ""}>${escapeHtml(a.nombre)} (${a.especialidad})</option>`
    )
    .join("");

  const filaAsignar = agentesActivos.length
    ? `<div class="fila-asignar">
         <select id="sel-${t._id}" aria-label="Agente para el ticket de ${escapeHtml(t.cliente)}">
           <option value="" ${idAgenteActual ? "" : "selected"} disabled>Elegir agente</option>
           ${opciones}
         </select>
         <button class="btn-chico btn-asignar" onclick="asignarAgente('${t._id}')">${t.agente ? "Reasignar" : "Asignar"}</button>
       </div>`
    : `<p class="ticket-agente"><span class="sin-asignar">No hay agentes activos para asignar.</span></p>`;

  const comentarios = t.comentarios
    .map(
      (c) => `<li>
        <strong>${escapeHtml(c.autor || "")}</strong> ${escapeHtml(c.texto || "")}
        <span class="meta">${new Date(c.fecha).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</span>
      </li>`
    )
    .join("");

  return `
    <article class="ticket prioridad-${t.prioridad} ${t.estado === "resuelto" ? "resuelto" : ""}">
      <div class="ticket-principal">
        <div class="ticket-cabecera">
          <h3>${escapeHtml(t.cliente)}</h3>
          <div class="etiquetas">
            <span class="etiqueta ${t.prioridad}">${t.prioridad}</span>
            <span class="etiqueta estado-${t.estado}">${t.estado}</span>
          </div>
        </div>
        <p class="ticket-asunto">${escapeHtml(t.asunto)}</p>
        <p class="ticket-agente">Agente: ${
          t.agente
            ? `<strong>${escapeHtml(t.agente.nombre)}</strong> (${t.agente.especialidad})`
            : `<span class="sin-asignar">Sin asignar</span>`
        }</p>
      </div>

      ${filaAsignar}

      <div class="acciones">
        ${t.estado === "abierto" ? `<button class="btn-chico btn-resolver" onclick="marcarResuelto('${t._id}')">Marcar como resuelto</button>` : ""}
        <button class="btn-chico btn-eliminar" onclick="eliminarTicket('${t._id}')">Eliminar</button>
      </div>

      <details class="comentarios" ${detallesAbiertos.has(t._id) ? "open" : ""} ontoggle="recordarDetalle('${t._id}', this.open)">
        <summary>Comentarios (${t.comentarios.length})</summary>
        <ul class="lista-comentarios">${comentarios}</ul>
        <form class="form-comentario" onsubmit="agregarComentario(event, '${t._id}')" novalidate>
          <input type="text" name="autor" placeholder="Tu nombre" aria-label="Autor del comentario" />
          <input type="text" name="texto" placeholder="Escribe un comentario" aria-label="Texto del comentario" />
          <button type="submit" class="btn-chico btn-neutro">Comentar</button>
        </form>
      </details>
    </article>`;
}

function renderizarTickets() {
  let visibles = tickets;

  if (filtroActivo === "abierto" || filtroActivo === "resuelto") {
    visibles = tickets.filter((t) => t.estado === filtroActivo);
  } else if (["baja", "media", "alta"].includes(filtroActivo)) {
    visibles = tickets.filter((t) => t.prioridad === filtroActivo);
  }

  if (visibles.length === 0) {
    listaTicketsEl.innerHTML = `<p class="vacio">No hay tickets para mostrar.</p>`;
    return;
  }

  listaTicketsEl.innerHTML = visibles.map(htmlTicket).join("");
}

function recordarDetalle(id, abierto) {
  if (abierto) detallesAbiertos.add(id);
  else detallesAbiertos.delete(id);
}

// ------------------------------------------------------------------
// Renderizado de agentes
// ------------------------------------------------------------------
function renderizarAgentes() {
  if (agentes.length === 0) {
    listaAgentesEl.innerHTML = `<p class="vacio">Todavía no hay agentes registrados.</p>`;
    return;
  }

  listaAgentesEl.innerHTML = agentes
    .map(
      (a) => `
      <div class="agente ${a.activo ? "" : "inactivo"}">
        <div class="agente-datos">
          <strong>${escapeHtml(a.nombre)}</strong>
          <span>${escapeHtml(a.email)} · ${a.especialidad} · ${a.activo ? "activo" : "inactivo"}</span>
        </div>
        <div class="acciones" style="margin-top:0">
          <button class="btn-chico btn-neutro" onclick="alternarActivo('${a._id}')">${a.activo ? "Desactivar" : "Activar"}</button>
          <button class="btn-chico btn-eliminar" onclick="eliminarAgente('${a._id}')">Eliminar</button>
        </div>
      </div>`
    )
    .join("");
}

// ------------------------------------------------------------------
// Tickets: crear, resolver, eliminar, asignar, comentar
// ------------------------------------------------------------------
document.getElementById("form-ticket").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const errorEl = document.getElementById("error-ticket");
  errorEl.textContent = "";

  try {
    await api("/api/tickets", "POST", {
      cliente: document.getElementById("cliente").value,
      asunto: document.getElementById("asunto").value,
      prioridad: document.getElementById("prioridad").value,
    });
    evento.target.reset();
    mostrarAviso("Ticket creado", "ok");
    await cargarTodo();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

async function marcarResuelto(id) {
  const t = tickets.find((x) => x._id === id);
  if (!t) return;

  try {
    await api(`/api/tickets/${id}`, "PUT", {
      cliente: t.cliente,
      asunto: t.asunto,
      prioridad: t.prioridad,
      estado: "resuelto",
    });
    await cargarTodo();
  } catch (err) {
    mostrarAviso(err.message);
  }
}

async function eliminarTicket(id) {
  if (!confirm("¿Seguro que quieres eliminar este ticket? Esta acción no se puede deshacer.")) return;

  try {
    await api(`/api/tickets/${id}`, "DELETE");
    await cargarTodo();
  } catch (err) {
    mostrarAviso(err.message);
  }
}

async function asignarAgente(id) {
  const agenteId = document.getElementById(`sel-${id}`).value;

  if (!agenteId) {
    mostrarAviso("Elige un agente antes de asignar");
    return;
  }

  try {
    await api(`/api/tickets/${id}/asignar`, "POST", { agenteId });
    mostrarAviso("Agente asignado", "ok");
    await cargarTodo();
  } catch (err) {
    mostrarAviso(err.message);
  }
}

async function agregarComentario(evento, id) {
  evento.preventDefault();
  const campos = evento.target.elements;

  try {
    await api(`/api/tickets/${id}/comentarios`, "POST", {
      autor: campos.autor.value,
      texto: campos.texto.value,
    });
    detallesAbiertos.add(id); // mantiene desplegados los comentarios tras recargar la lista
    await cargarTodo();
  } catch (err) {
    mostrarAviso(err.message);
  }
}

// ------------------------------------------------------------------
// Agentes: crear, activar/desactivar, eliminar
// ------------------------------------------------------------------
document.getElementById("form-agente").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const errorEl = document.getElementById("error-agente");
  errorEl.textContent = "";

  try {
    await api("/api/agentes", "POST", {
      nombre: document.getElementById("agente-nombre").value,
      email: document.getElementById("agente-email").value,
      especialidad: document.getElementById("agente-especialidad").value,
    });
    evento.target.reset();
    mostrarAviso("Agente creado", "ok");
    await cargarTodo();
  } catch (err) {
    errorEl.textContent = err.message; // por ejemplo: "Ya existe un agente registrado con ese correo"
  }
});

async function alternarActivo(id) {
  const a = agentes.find((x) => x._id === id);
  if (!a) return;

  try {
    await api(`/api/agentes/${id}`, "PUT", {
      nombre: a.nombre,
      email: a.email,
      especialidad: a.especialidad,
      activo: !a.activo,
    });
    await cargarTodo();
  } catch (err) {
    mostrarAviso(err.message);
  }
}

async function eliminarAgente(id) {
  if (!confirm("¿Seguro que quieres eliminar este agente?")) return;

  try {
    await api(`/api/agentes/${id}`, "DELETE");
    await cargarTodo();
  } catch (err) {
    mostrarAviso(err.message); // por ejemplo el 409: el agente tiene tickets abiertos asignados
  }
}

// ------------------------------------------------------------------
// Filtros (se aplican en el navegador, sin pedir datos otra vez)
// ------------------------------------------------------------------
document.querySelectorAll(".btn-filtro").forEach((boton) => {
  boton.addEventListener("click", () => {
    document.querySelectorAll(".btn-filtro").forEach((b) => b.classList.remove("activo"));
    boton.classList.add("activo");
    filtroActivo = boton.dataset.filtro;
    renderizarTickets();
  });
});

// Carga inicial
cargarTodo();

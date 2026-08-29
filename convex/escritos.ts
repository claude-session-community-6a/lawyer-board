import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { preceptoA } from "./corpus/lft";
import { resolucionDe } from "./dominio";
import { pesoProbatorio } from "./prelacion";

/**
 * Generación de escritos por secciones.
 *
 * La redacción está simulada —arma texto con plantillas a partir de los campos
 * validados—, pero las tres reglas que la gobiernan son reales y son código:
 *
 *   · una afirmación sin documento validado detrás nace `Supuesto`;
 *   · un `Supuesto` bloquea la exportación;
 *   · una cita que no coincide con el corpus en la vigencia del asunto también
 *     bloquea, aunque el texto se lea perfecto.
 *
 * Cambiar la plantilla por un modelo no toca ninguna de esas tres.
 */

const SECCIONES = [
  "Proemio",
  "Personalidad",
  "Hechos",
  "Excepciones y defensas",
  "Pruebas",
  "Petitorios",
] as const;

export const list = query({
  args: { expedienteId: v.id("expedientes") },
  handler: async (ctx, { expedienteId }) =>
    ctx.db
      .query("escritos")
      .withIndex("by_expediente", (q) => q.eq("expedienteId", expedienteId))
      .order("desc")
      .collect(),
});

export const get = query({
  args: { id: v.id("escritos") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const crear = mutation({
  args: {
    expedienteId: v.id("expedientes"),
    titulo: v.string(),
    instruccion: v.string(),
  },
  handler: async (ctx, { expedienteId, titulo, instruccion }) => {
    const ahora = new Date().toISOString();
    const id = await ctx.db.insert("escritos", {
      expedienteId,
      titulo,
      instruccion,
      // Nace vacío: cada sección se genera —y se regenera— por separado.
      secciones: SECCIONES.map((nombre) => ({
        nombre,
        contenido: "",
        origen: "sin generar",
        verificacion: "Por verificar" as const,
        citas: [],
      })),
      creadoEn: ahora,
      actualizadoEn: ahora,
    });

    await ctx.db.insert("bitacora", {
      expedienteId,
      evento: "Escrito creado",
      detalle: `${titulo} · instrucción: «${instruccion.slice(0, 120)}»`,
      en: ahora,
    });

    return id;
  },
});

export const generarSeccion = mutation({
  args: { id: v.id("escritos"), seccion: v.string() },
  handler: async (ctx, { id, seccion }) => {
    const escrito = await ctx.db.get(id);
    if (!escrito) return;

    const expediente = await ctx.db.get(escrito.expedienteId);
    if (!expediente) return;

    const documentos = await ctx.db
      .query("documentos")
      .withIndex("by_expediente", (q) => q.eq("expedienteId", escrito.expedienteId))
      .collect();

    const campos = await ctx.db
      .query("campos")
      .withIndex("by_expediente", (q) => q.eq("expedienteId", escrito.expedienteId))
      .collect();

    // Contexto: SÓLO campos validados. Lo no validado no alimenta escritos.
    const validados = campos.filter(
      (c) => c.valor.trim() !== "" && (c.estado === "Confirmado" || c.estado === "Corregido"),
    );
    const dato = (clave: string) => validados.find((c) => c.clave === clave)?.valor ?? null;

    const porTipo = new Map(documentos.map((d) => [d._id, d.tipo]));
    const deDemanda = (clave: string) =>
      validados.find((c) => c.clave === clave && porTipo.get(c.documentoId) === "Demanda")?.valor ??
      null;
    // Mismo criterio de prelación que la tabla de contradicciones, para que el
    // escrito cite exactamente la cifra que el abogado vio en pantalla.
    const deCliente = (clave: string) =>
      validados
        .filter((c) => c.clave === clave && porTipo.get(c.documentoId) !== "Demanda")
        .sort(
          (a, b) =>
            pesoProbatorio(porTipo.get(a.documentoId) ?? "") -
            pesoProbatorio(porTipo.get(b.documentoId) ?? ""),
        )[0]?.valor ?? null;

    const resolucion = resolucionDe(expediente.regimen);
    const autoridad = `${expediente.autoridadTipo} ${expediente.fuero === "Federal" ? "Federal" : "Local"} de ${expediente.plaza}`;

    let contenido = "";
    let citas: string[] = [];
    let faltantes: string[] = [];

    switch (seccion) {
      case "Proemio": {
        contenido = `C. ${autoridad}.\nP R E S E N T E.\n\n${expediente.cliente}, por conducto de su apoderado legal, en el expediente laboral ${expediente.numero}, promovido por ${expediente.actor} en contra de ${expediente.demandado}, comparezco a exponer:`;
        break;
      }

      case "Personalidad": {
        const escritura = dato("escritura");
        const notario = dato("notario");
        if (!escritura || !notario) faltantes.push("poder notarial validado");
        contenido = escritura
          ? `La personalidad con que comparezco está acreditada mediante la escritura pública número ${escritura}, otorgada ante ${notario}, cuyo testimonio obra en autos.`
          : `La personalidad con que comparezco se acredita con el instrumento notarial que obra en autos. [Pendiente: número de escritura y fedatario]`;
        break;
      }

      case "Hechos": {
        const ingreso = deCliente("fechaIngreso") ?? deDemanda("fechaIngreso");
        const salario = deCliente("salarioDiario");
        const baja = deCliente("fechaBaja");
        const causa = deCliente("causaSeparacion");

        if (!ingreso) faltantes.push("fecha de ingreso");
        if (!salario) faltantes.push("salario diario documentado");
        if (!baja) faltantes.push("fecha de separación documentada");

        contenido = [
          ingreso
            ? `1. La relación de trabajo inició el ${ingreso}, en los términos del contrato individual que obra en autos.`
            : `1. La relación de trabajo inició en la fecha que consta en el contrato individual. [Pendiente: fecha de ingreso]`,
          salario
            ? `2. El salario diario efectivamente percibido fue de $${salario}, según consta en los recibos de nómina exhibidos, y no el que la actora afirma.`
            : `2. El salario diario es el que consta en los recibos de nómina. [Pendiente: salario documentado]`,
          baja
            ? `3. La relación concluyó el ${baja}${causa ? `, por ${causa.toLowerCase()}` : ""}, según consta en la documental respectiva.`
            : `3. La relación concluyó en la fecha que consta en la documental respectiva. [Pendiente: fecha de separación]`,
        ].join("\n\n");
        break;
      }

      case "Excepciones y defensas": {
        const salarioAlegado = deDemanda("salarioDiario");
        const salarioDoc = deCliente("salarioDiario");
        const bloques: string[] = [];

        if (salarioAlegado && salarioDoc) {
          const factor = Number(salarioAlegado.replace(/,/g, "")) / Number(salarioDoc.replace(/,/g, ""));
          bloques.push(
            `EXCEPCIÓN DE INEXACTITUD DEL SALARIO. La actora alega un salario diario de $${salarioAlegado}, mientras que los recibos de nómina acreditan $${salarioDoc}, esto es, ${factor.toFixed(2)} veces el efectivamente percibido. El salario que debe servir de base al cálculo es el que se integra en términos del artículo 84 de la Ley Federal del Trabajo.`,
          );
          citas.push("84");
        } else {
          faltantes.push("cruce de salario alegado contra documentado");
        }

        const causaDoc = deCliente("causaSeparacion");
        if (causaDoc && !causaDoc.toLowerCase().includes("despido")) {
          bloques.push(
            `EXCEPCIÓN DE INEXISTENCIA DEL DESPIDO. No hubo despido: la documental exhibida acredita ${causaDoc.toLowerCase()}, lo que excluye la acción principal.`,
          );
        }

        bloques.push(
          `EXCEPCIÓN DE PRESCRIPCIÓN. Se opone en términos de los artículos 516 y 518 de la Ley Federal del Trabajo respecto de las prestaciones exigibles con anterioridad a los plazos que dichos preceptos establecen.`,
        );
        citas.push("516", "518");

        contenido = bloques.join("\n\n");
        break;
      }

      case "Pruebas": {
        const validadosDocs = documentos.filter((d) => d.estado === "Validado");
        if (validadosDocs.length === 0) faltantes.push("documentos validados que ofrecer");
        contenido = [
          `Se ofrecen las siguientes pruebas, en términos del artículo 804 de la Ley Federal del Trabajo:`,
          ...validadosDocs.map(
            (d, i) =>
              `${String(i + 1).padStart(2, "0")}.- DOCUMENTAL. Consistente en ${d.tipo.toLowerCase()} (${d.nombre}), que obra en autos.`,
          ),
        ].join("\n\n");
        citas.push("804");
        break;
      }

      case "Petitorios": {
        contenido = [
          `Por lo expuesto, a esa autoridad atentamente pido:`,
          `PRIMERO. Tenerme por presentado en los términos del presente escrito.`,
          `SEGUNDO. Tener por opuestas las excepciones y defensas hechas valer.`,
          `TERCERO. En su oportunidad, dictar ${resolucion} que absuelva a mi representada de todas y cada una de las prestaciones reclamadas.`,
        ].join("\n\n");
        break;
      }

      default:
        return;
    }

    // Sin dato validado detrás, la sección nace SUPUESTO y bloquea la salida.
    const verificacion =
      faltantes.length > 0 ? ("Supuesto" as const) : ("Verificado" as const);

    const secciones = escrito.secciones.map((s) =>
      s.nombre === seccion
        ? {
            ...s,
            contenido,
            origen: "generado",
            verificacion,
            citas,
          }
        : s,
    );

    await ctx.db.patch(id, { secciones, actualizadoEn: new Date().toISOString() });

    return { verificacion, faltantes };
  },
});

/** Una corrección del abogado marca la sección como escrita a mano. */
export const editarSeccion = mutation({
  args: { id: v.id("escritos"), seccion: v.string(), contenido: v.string() },
  handler: async (ctx, { id, seccion, contenido }) => {
    const escrito = await ctx.db.get(id);
    if (!escrito) return;

    const secciones = escrito.secciones.map((s) =>
      s.nombre === seccion
        ? {
            ...s,
            contenido,
            origen: "escrito a mano",
            // El abogado firma: lo que él escribe queda verificado por él.
            verificacion: "Verificado" as const,
          }
        : s,
    );

    await ctx.db.patch(id, { secciones, actualizadoEn: new Date().toISOString() });
  },
});

/**
 * Compuerta previa a exportar. Devuelve por qué no se puede, nunca un simple
 * `false`: un botón deshabilitado sin explicación es un fallo silencioso.
 */
export const validarCitas = query({
  args: { id: v.id("escritos") },
  handler: async (ctx, { id }) => {
    const escrito = await ctx.db.get(id);
    if (!escrito) return null;

    const expediente = await ctx.db.get(escrito.expedienteId);
    if (!expediente) return null;

    const bloqueos: string[] = [];
    const citas: Array<{
      articulo: string;
      seccion: string;
      valida: boolean;
      motivo: string;
    }> = [];

    for (const seccion of escrito.secciones) {
      if (seccion.verificacion === "Supuesto") {
        bloqueos.push(
          `«${seccion.nombre}» descansa en un supuesto: le falta documento validado que la sostenga.`,
        );
      }
      if (seccion.contenido.trim() === "") {
        bloqueos.push(`«${seccion.nombre}» está sin generar.`);
      }

      for (const articulo of seccion.citas) {
        // La cita se compara contra el corpus EN LA VIGENCIA de los hechos.
        const precepto = preceptoA(articulo, expediente.fechaHechos);
        const valida = Boolean(precepto);
        citas.push({
          articulo,
          seccion: seccion.nombre,
          valida,
          motivo: valida
            ? `Coincide con el texto indexado, vigente desde ${precepto!.vigenteDesde}.`
            : `No hay texto indexado del artículo ${articulo} vigente al ${expediente.fechaHechos}.`,
        });
        if (!valida) {
          bloqueos.push(
            `La cita al artículo ${articulo} en «${seccion.nombre}» no verifica contra el corpus.`,
          );
        }
      }
    }

    return { puedeExportar: bloqueos.length === 0, bloqueos, citas };
  },
});

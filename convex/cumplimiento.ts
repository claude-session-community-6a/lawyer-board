import { query } from "./_generated/server";
import { v } from "convex/values";
import { preceptoA } from "./corpus/lft";
import { pesoProbatorio } from "./prelacion";
import type { Doc } from "./_generated/dataModel";

/**
 * Motor de cumplimiento — reglas deterministas, cero modelo de lenguaje.
 *
 * Cada regla mira el expediente y sus campos VALIDADOS y devuelve uno de tres
 * estados. `Falta dato` es un estado de primera clase: no se colapsa con
 * `No cumple`, porque "no lo sé" y "está mal" mueven al abogado a cosas
 * distintas. Cada resultado cita el precepto en la vigencia que corresponde a
 * la fecha de los hechos del asunto.
 */

export type EstadoRegla = "Cumple" | "No cumple" | "Falta dato" | "No aplica";

interface Resultado {
  id: string;
  titulo: string;
  articulo: string;
  rubro: string;
  textoPrecepto: string;
  vigenteDesde: string;
  estado: EstadoRegla;
  hallazgo: string;
  accion: string | null;
}

function dias(desde: string, hasta: string): number | null {
  const a = Date.parse(desde);
  const b = Date.parse(hasta);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

export const evaluar = query({
  args: { expedienteId: v.id("expedientes") },
  handler: async (ctx, { expedienteId }) => {
    const expediente = await ctx.db.get(expedienteId);
    if (!expediente) return null;

    const documentos = await ctx.db
      .query("documentos")
      .withIndex("by_expediente", (q) => q.eq("expedienteId", expedienteId))
      .collect();

    const campos = await ctx.db
      .query("campos")
      .withIndex("by_expediente", (q) => q.eq("expedienteId", expedienteId))
      .collect();

    // Sólo cuenta lo que un humano validó. Un dato extraído y no confirmado no
    // acredita ni desacredita nada.
    const validados = campos.filter(
      (c) => c.valor.trim() !== "" && (c.estado === "Confirmado" || c.estado === "Corregido"),
    );

    const porTipo = new Map(documentos.map((d) => [d._id, d.tipo]));

    const valor = (clave: string, tipos?: string[]): string | null => {
      const encontrado = validados.find(
        (c) => c.clave === clave && (!tipos || tipos.includes(porTipo.get(c.documentoId) ?? "")),
      );
      return encontrado?.valor ?? null;
    };

    /**
     * Para evaluar cumplimiento, un dato que sólo aparece en la demanda es lo
     * que la contraparte AFIRMA, no lo que consta. Estas reglas se resuelven
     * contra la documental del cliente y sólo caen a la demanda si no hay otra.
     */
    const documentado = (clave: string): string | null => {
      const propios = validados
        .filter((c) => c.clave === clave && porTipo.get(c.documentoId) !== "Demanda")
        .sort(
          (a, b) =>
            pesoProbatorio(porTipo.get(a.documentoId) ?? "") -
            pesoProbatorio(porTipo.get(b.documentoId) ?? ""),
        );

      return propios[0]?.valor ?? null;
    };

    const hayTipo = (tipo: Doc<"documentos">["tipo"]) =>
      documentos.some((d) => d.tipo === tipo && d.estado === "Validado");

    const fecha = expediente.fechaHechos;
    const esPatronal = expediente.lado === "Patronal";
    const resultados: Resultado[] = [];

    const agregar = (
      id: string,
      titulo: string,
      articulo: string,
      estado: EstadoRegla,
      hallazgo: string,
      accion: string | null,
    ) => {
      const precepto = preceptoA(articulo, fecha);
      if (!precepto) {
        // El corpus no tiene versión de ese precepto a la fecha de los hechos.
        // Se reporta como laguna del corpus, jamás se omite la regla en silencio.
        resultados.push({
          id,
          titulo,
          articulo,
          rubro: "Sin versión indexada a la fecha de los hechos",
          textoPrecepto:
            "El corpus normativo no tiene texto de este precepto vigente al " +
            fecha +
            ". La regla no se pudo evaluar: eso es una laguna del corpus, no un cumplimiento.",
          vigenteDesde: fecha,
          estado: "Falta dato",
          hallazgo: `No hay texto indexado del artículo ${articulo} vigente al ${fecha}, así que esta revisión no se ejecutó.`,
          accion: "Cargar la versión del precepto que corresponde a la fecha de los hechos.",
        });
        return;
      }
      resultados.push({
        id,
        titulo,
        articulo: precepto.fraccion
          ? `${precepto.articulo}, ${precepto.fraccion}`
          : precepto.articulo,
        rubro: precepto.rubro,
        textoPrecepto: precepto.texto,
        vigenteDesde: precepto.vigenteDesde,
        estado,
        hallazgo,
        accion,
      });
    };

    // 1 · Requisitos del escrito de demanda (art. 872).
    const demanda = documentos.find((d) => d.tipo === "Demanda");
    if (!demanda) {
      agregar("872", "Requisitos de la demanda", "872", "Falta dato",
        "No hay escrito de demanda en el expediente.",
        "Cargar el escrito inicial para poder revisar sus requisitos.");
    } else if (demanda.estado !== "Validado") {
      agregar("872", "Requisitos de la demanda", "872", "Falta dato",
        `La demanda está en «${demanda.estado}»; sus campos no han sido validados.`,
        "Validar la extracción de la demanda.");
    } else {
      const faltan = (["actor", "demandado", "prestaciones"] as const).filter(
        (clave) => !valor(clave, ["Demanda"]),
      );
      agregar("872", "Requisitos de la demanda", "872",
        faltan.length === 0 ? "Cumple" : "No cumple",
        faltan.length === 0
          ? "Constan partes, prestaciones reclamadas y relación de hechos."
          : `Faltan elementos validados: ${faltan.join(", ")}.`,
        faltan.length === 0 ? null : "Oponer la irregularidad de la demanda o pedir prevención.");
    }

    // 2 · Documentos que el patrón debe conservar y exhibir (art. 804), con la
    // consecuencia del 805 si no los tiene.
    if (esPatronal) {
      const exigibles: Array<[string, boolean]> = [
        ["contrato individual", hayTipo("Contrato individual")],
        ["recibos de nómina", hayTipo("Recibo de nómina")],
        ["control de asistencia", hayTipo("Control de asistencia")],
      ];
      const faltantes = exigibles.filter(([, hay]) => !hay).map(([nombre]) => nombre);

      agregar("804", "Documentos que el patrón debe exhibir", "804",
        faltantes.length === 0 ? "Cumple" : "No cumple",
        faltantes.length === 0
          ? "Están en el expediente y validados los tres grupos documentales."
          : `No constan validados: ${faltantes.join(", ")}.`,
        faltantes.length === 0 ? null : "Recabarlos del cliente antes de ofrecer pruebas.");

      if (faltantes.length > 0) {
        agregar("805", "Presunción por no exhibir documentos", "805", "No cumple",
          "La ausencia de esos documentos hace presumir ciertos los hechos de la demanda relacionados con ellos.",
          "Prever la presunción del 805 en la estrategia probatoria.");
      }
    } else {
      agregar("784", "Carga probatoria del patrón", "784", "Cumple",
        "El lado es trabajador: la carga de estos hechos corresponde a la contraparte.",
        null);
    }

    // 3 · Aviso de rescisión (art. 47, último párrafo).
    const causa = documentado("causaSeparacion") ?? valor("causaSeparacion");
    if (esPatronal) {
      const hayAviso = hayTipo("Aviso de rescisión");
      const constancia = valor("constanciaEntrega", ["Aviso de rescisión"]);
      if (!hayAviso) {
        agregar("47", "Aviso de rescisión", "47", "No cumple",
          "No consta aviso de rescisión validado. Su falta, por sí sola, determina la separación como no justificada.",
          "Localizar el aviso y su constancia de entrega, o replantear la defensa sin él.");
      } else if (!constancia) {
        agregar("47", "Aviso de rescisión", "47", "Falta dato",
          "Hay aviso, pero no está validada la constancia de su entrega al trabajador o su comunicación a la autoridad.",
          "Validar la constancia de entrega en el documento del aviso.");
      } else {
        agregar("47", "Aviso de rescisión", "47", "Cumple",
          `Consta aviso con entrega: ${constancia}.`, null);
      }
    }

    // 4 · Prescripción para reclamar la separación (art. 518) — dos meses.
    const fechaBaja = documentado("fechaBaja") ?? expediente.fechaHechos;
    const transcurridos = dias(fechaBaja, expediente.fechaPresentacion);
    if (transcurridos === null) {
      agregar("518", "Prescripción de la acción de despido", "518", "Falta dato",
        "No hay fecha de separación validada con qué computar el plazo.",
        "Validar la fecha de separación en la nómina o en el aviso.");
    } else {
      // Cómputo determinista, con la operación a la vista: nunca lo hace un modelo.
      agregar("518", "Prescripción de la acción de despido", "518",
        transcurridos > 60 ? "Cumple" : "No cumple",
        `De la separación (${fechaBaja}) a la presentación (${expediente.fechaPresentacion}) corrieron ${transcurridos} días naturales. El plazo del 518 es de dos meses.`,
        transcurridos > 60
          ? "Oponer la excepción de prescripción."
          : "La acción se presentó dentro del plazo; la prescripción no prospera.");
    }

    // 5 · Prescripción general de un año (art. 516), para las demás prestaciones.
    if (transcurridos !== null) {
      agregar("516", "Prescripción general de un año", "516",
        transcurridos > 365 ? "Cumple" : "No cumple",
        `Transcurrieron ${transcurridos} días desde la exigibilidad. El plazo general es de un año.`,
        transcurridos > 365
          ? "Oponer prescripción sobre las prestaciones periódicas anteriores al año."
          : null);
    }

    // 6 · Conciliación prejudicial obligatoria (art. 684-E), sólo bajo el
    // régimen de Tribunal: en Junta no existía esa instancia.
    if (expediente.regimen === "Tribunal") {
      agregar("684-E", "Constancia de conciliación prejudicial", "684-E", "Falta dato",
        "No consta en el expediente la constancia de haber agotado la instancia conciliatoria.",
        "Verificar la constancia del Centro de Conciliación; es requisito de procedencia.");
    }

    // 7 · Salario base del cálculo (arts. 82 y 84).
    const salario = documentado("salarioDiario");
    agregar("84", "Salario base para el cálculo", "84",
      salario ? "Cumple" : "Falta dato",
      salario
        ? `Salario diario documentado en $${salario}. Toda liquidación se calcula sobre el salario integrado, no sobre el que alega la contraparte.`
        : "No hay salario diario documentado por el cliente; sin él ninguna liquidación es defendible.",
      salario ? null : "Validar el salario en el recibo de nómina o en el contrato.");

    // 8 · Tope de salarios vencidos (art. 48) — informativo pero decisivo.
    if (causa && causa.toLowerCase().includes("despido")) {
      agregar("48", "Tope de salarios vencidos", "48", "Cumple",
        "Los salarios vencidos se computan hasta por doce meses; después corren intereses sobre quince meses de salario.",
        "Acotar la cuantificación de la contraparte al tope de doce meses.");
    }

    const resumen = {
      cumple: resultados.filter((r) => r.estado === "Cumple").length,
      noCumple: resultados.filter((r) => r.estado === "No cumple").length,
      faltaDato: resultados.filter((r) => r.estado === "Falta dato").length,
    };

    return {
      fechaVigencia: fecha,
      documentosValidados: documentos.filter((d) => d.estado === "Validado").length,
      totalDocumentos: documentos.length,
      resumen,
      resultados,
    };
  },
});

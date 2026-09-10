import { query } from "./_generated/server";
import { v } from "convex/values";
import { PRECEPTOS, vigentesA } from "./corpus/lft";

/**
 * Biblioteca normativa. Toda consulta lleva fecha de vigencia: preguntar "qué
 * dice el 47" sin decir cuándo es una pregunta mal hecha, y el sistema no la
 * contesta a medias.
 */
export const buscar = query({
  args: { q: v.optional(v.string()), fechaVigencia: v.string() },
  handler: async (_ctx, { q, fechaVigencia }) => {
    const vigentes = vigentesA(fechaVigencia);
    const termino = (q ?? "").trim().toLowerCase();

    const filtrados = termino
      ? vigentes.filter((p) =>
          `${p.articulo} ${p.rubro} ${p.texto} ${p.ordenamiento}`
            .toLowerCase()
            .includes(termino),
        )
      : vigentes;

    return {
      fechaVigencia,
      total: filtrados.length,
      // El corpus completo incluye versiones derogadas; se dice cuántas quedaron
      // fuera para que nadie crea que el artículo no existe.
      fueraDeVigencia: PRECEPTOS.length - vigentes.length,
      preceptos: filtrados.sort((a, b) =>
        a.articulo.localeCompare(b.articulo, "es", { numeric: true }),
      ),
    };
  },
});

/** Todas las vigencias de un artículo, para ver su historial. */
export const historial = query({
  args: { articulo: v.string() },
  handler: async (_ctx, { articulo }) =>
    PRECEPTOS.filter((p) => p.articulo === articulo).sort((a, b) =>
      a.vigenteDesde.localeCompare(b.vigenteDesde),
    ),
});

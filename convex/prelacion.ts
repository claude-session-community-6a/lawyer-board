/**
 * Cuando varios documentos aportan el mismo dato, gana el más probatorio, no el
 * primero que aparezca: un salario en el recibo de nómina pesa más que el
 * pactado en el contrato, porque acredita lo efectivamente pagado.
 *
 * El orden vive aquí, en un solo lugar, porque la tabla de contradicciones, el
 * motor de cumplimiento y el generador de escritos tienen que elegir el MISMO
 * documento. Que una pantalla diga $120 y otra $112 destruye la confianza en
 * todas.
 */
export const PRELACION_PROBATORIA = [
  "Recibo de nómina",
  "Control de asistencia",
  "Aviso de rescisión",
  "Contrato individual",
  "Prueba documental",
];

export function pesoProbatorio(tipo: string): number {
  const indice = PRELACION_PROBATORIA.indexOf(tipo);
  return indice === -1 ? PRELACION_PROBATORIA.length : indice;
}

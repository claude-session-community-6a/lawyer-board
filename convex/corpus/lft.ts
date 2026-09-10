/**
 * Corpus normativo semilla — Ley Federal del Trabajo.
 *
 * Vive en código y no en la base porque en esta fase es una semilla de
 * demostración: así la biblioteca y el motor de cumplimiento nunca aparecen
 * vacíos y no hay un paso de sembrado que pueda quedarse a medias.
 *
 * `vigenteDesde` / `vigenteHasta` son ISO. Un precepto sin `vigenteHasta` está
 * vigente. La consulta SIEMPRE se filtra por la fecha de los hechos del asunto:
 * preguntar "qué decía el 47" sin fecha es una pregunta mal hecha.
 *
 * Los textos son extractos abreviados con fines de demostración, no la
 * transcripción oficial. La fuente de verdad es el DOF.
 */

export interface Precepto {
  ordenamiento: string;
  articulo: string;
  fraccion?: string;
  rubro: string;
  texto: string;
  vigenteDesde: string;
  vigenteHasta?: string;
}

const LFT = "Ley Federal del Trabajo";

/** Fecha en que entró en vigor la reforma en materia de justicia laboral. */
export const REFORMA_2019 = "2019-05-01";

export const PRECEPTOS: Precepto[] = [
  {
    ordenamiento: LFT,
    articulo: "20",
    rubro: "Relación de trabajo y contrato individual",
    texto:
      "Se entiende por relación de trabajo, cualquiera que sea el acto que le dé origen, la prestación de un trabajo personal subordinado a una persona, mediante el pago de un salario. Contrato individual de trabajo es aquel por virtud del cual una persona se obliga a prestar a otra un trabajo subordinado, mediante el pago de un salario.",
    vigenteDesde: "1970-05-01",
  },
  {
    ordenamiento: LFT,
    articulo: "25",
    rubro: "Requisitos del contrato individual por escrito",
    texto:
      "El escrito en que consten las condiciones de trabajo deberá contener: nombre, nacionalidad, edad, sexo, estado civil, CURP, RFC y domicilio del trabajador y del patrón; si la relación es por obra o tiempo determinado, por temporada, de capacitación inicial o por tiempo indeterminado; el servicio a prestar; el lugar de la prestación; la duración de la jornada; la forma y el monto del salario; el día y el lugar de pago; y la indicación de la capacitación o adiestramiento.",
    vigenteDesde: "1970-05-01",
  },
  {
    ordenamiento: LFT,
    articulo: "26",
    rubro: "Falta de contrato escrito",
    texto:
      "La falta del escrito a que se refieren los artículos 24 y 25 no priva al trabajador de los derechos que deriven de las normas de trabajo y de los servicios prestados, pues se imputará al patrón la falta de esa formalidad.",
    vigenteDesde: "1970-05-01",
  },
  {
    ordenamiento: LFT,
    articulo: "47",
    fraccion: "último párrafo",
    rubro: "Aviso de rescisión — versión anterior a la reforma de 2019",
    texto:
      "El patrón deberá dar al trabajador aviso escrito de la fecha y causa o causas de la rescisión. El aviso deberá entregarse personalmente al trabajador en el momento mismo del despido o bien comunicarlo a la Junta de Conciliación y Arbitraje dentro de los cinco días hábiles siguientes. La falta de aviso al trabajador o a la Junta por sí sola determinará la separación no justificada.",
    vigenteDesde: "1970-05-01",
    vigenteHasta: "2019-04-30",
  },
  {
    ordenamiento: LFT,
    articulo: "47",
    fraccion: "último párrafo",
    rubro: "Aviso de rescisión — vigente",
    texto:
      "El patrón deberá dar al trabajador aviso escrito de la fecha y causa o causas de la rescisión. El aviso deberá entregarse personalmente al trabajador en el momento del despido, y en caso de negativa, dentro de los cinco días hábiles siguientes el patrón lo hará del conocimiento del Tribunal, proporcionando el último domicilio registrado. La falta de aviso al trabajador o al Tribunal por sí sola determinará la separación no justificada.",
    vigenteDesde: REFORMA_2019,
  },
  {
    ordenamiento: LFT,
    articulo: "48",
    rubro: "Acciones del trabajador despedido y tope de salarios vencidos",
    texto:
      "El trabajador podrá solicitar que se le reinstale en el trabajo o que se le indemnice con el importe de tres meses de salario. Si no comprueba el patrón la causa de la rescisión, el trabajador tendrá derecho al pago de los salarios vencidos computados desde la fecha del despido hasta por un periodo máximo de doce meses. Si al término de ese plazo no ha concluido el procedimiento, se pagarán los intereses que se generen sobre el importe de quince meses de salario, a razón del dos por ciento mensual, capitalizable al momento del pago.",
    vigenteDesde: "2012-12-01",
  },
  {
    ordenamiento: LFT,
    articulo: "82",
    rubro: "Concepto de salario",
    texto:
      "Salario es la retribución que debe pagar el patrón al trabajador por su trabajo.",
    vigenteDesde: "1970-05-01",
  },
  {
    ordenamiento: LFT,
    articulo: "84",
    rubro: "Salario integrado",
    texto:
      "El salario se integra con los pagos hechos en efectivo por cuota diaria, gratificaciones, percepciones, habitación, primas, comisiones, prestaciones en especie y cualquiera otra cantidad o prestación que se entregue al trabajador por su trabajo.",
    vigenteDesde: "1970-05-01",
  },
  {
    ordenamiento: LFT,
    articulo: "76",
    rubro: "Vacaciones — versión anterior a la reforma de 2023",
    texto:
      "Los trabajadores que tengan más de un año de servicios disfrutarán de un periodo anual de vacaciones pagadas, que en ningún caso podrá ser inferior a seis días laborables, y que aumentará en dos días laborables, hasta llegar a doce, por cada año subsecuente de servicios.",
    vigenteDesde: "1970-05-01",
    vigenteHasta: "2022-12-31",
  },
  {
    ordenamiento: LFT,
    articulo: "76",
    rubro: "Vacaciones — vigente",
    texto:
      "Las personas trabajadoras que tengan más de un año de servicios disfrutarán de un periodo anual de vacaciones pagadas, que en ningún caso podrá ser inferior a doce días laborables, y que aumentará en dos días laborables, hasta llegar a veinte, por cada año subsecuente de servicios. A partir del sexto año, el periodo de vacaciones aumentará en dos días por cada cinco de servicios.",
    vigenteDesde: "2023-01-01",
  },
  {
    ordenamiento: LFT,
    articulo: "80",
    rubro: "Prima vacacional",
    texto:
      "Los trabajadores tendrán derecho a una prima no menor de veinticinco por ciento sobre los salarios que les correspondan durante el periodo de vacaciones.",
    vigenteDesde: "1970-05-01",
  },
  {
    ordenamiento: LFT,
    articulo: "87",
    rubro: "Aguinaldo",
    texto:
      "Los trabajadores tendrán derecho a un aguinaldo anual que deberá pagarse antes del día veinte de diciembre, equivalente a quince días de salario, por lo menos. Los que no hayan cumplido el año de servicios tendrán derecho a que se les pague en proporción al tiempo trabajado.",
    vigenteDesde: "1970-05-01",
  },
  {
    ordenamiento: LFT,
    articulo: "162",
    rubro: "Prima de antigüedad",
    texto:
      "Los trabajadores de planta tienen derecho a una prima de antigüedad, consistente en el importe de doce días de salario por cada año de servicios, que se pagará a los que se separen voluntariamente de su empleo siempre que hayan cumplido quince años de servicios por lo menos, y a los que se separen por causa justificada y a los que sean separados de su empleo, independientemente de la justificación o injustificación del despido.",
    vigenteDesde: "1970-05-01",
  },
  {
    ordenamiento: LFT,
    articulo: "516",
    rubro: "Prescripción general de un año",
    texto:
      "Las acciones de trabajo prescriben en un año contado desde el día siguiente a la fecha en que la obligación sea exigible, con las excepciones consignadas en los artículos siguientes.",
    vigenteDesde: "1970-05-01",
  },
  {
    ordenamiento: LFT,
    articulo: "518",
    rubro: "Prescripción de dos meses para reclamar el despido",
    texto:
      "Prescriben en dos meses las acciones de los trabajadores que sean separados del trabajo. La prescripción corre a partir del día siguiente a la fecha de la separación.",
    vigenteDesde: "1970-05-01",
  },
  {
    ordenamiento: LFT,
    articulo: "784",
    rubro: "Carga probatoria del patrón",
    texto:
      "El Tribunal eximirá de la carga de la prueba al trabajador cuando por otros medios esté en posibilidad de llegar al conocimiento de los hechos. En todo caso, corresponderá al patrón probar su dicho cuando exista controversia sobre: fecha de ingreso del trabajador; antigüedad; faltas de asistencia; causa de rescisión de la relación de trabajo; contrato de trabajo; jornada de trabajo; pago de días de descanso y obligatorios; disfrute y pago de vacaciones; pago de las primas dominical, vacacional y de antigüedad; monto y pago del salario; y incorporación y aportaciones al INFONAVIT.",
    vigenteDesde: "1980-01-01",
  },
  {
    ordenamiento: LFT,
    articulo: "804",
    rubro: "Documentos que el patrón debe conservar y exhibir",
    texto:
      "El patrón tiene obligación de conservar y exhibir en juicio los documentos siguientes: contratos individuales de trabajo; listas de raya o nómina cuando se lleven, o recibos de pago de salarios; controles de asistencia cuando se lleven; comprobantes de pago de participación de utilidades, de vacaciones y de aguinaldos, así como las primas a que se refiere esta Ley; y los demás que señalen las leyes. Los documentos deberán conservarse mientras dure la relación laboral y hasta un año después; los relativos a antigüedad, por todo el tiempo que dure la relación y hasta dos años después.",
    vigenteDesde: "1980-01-01",
  },
  {
    ordenamiento: LFT,
    articulo: "805",
    rubro: "Consecuencia de no exhibir los documentos",
    texto:
      "El incumplimiento a lo dispuesto por el artículo anterior establecerá la presunción de ser ciertos los hechos que el actor exprese en su demanda, en relación con tales documentos, salvo prueba en contrario.",
    vigenteDesde: "1980-01-01",
  },
  {
    ordenamiento: LFT,
    articulo: "872",
    rubro: "Requisitos del escrito de demanda — versión anterior a la reforma de 2019",
    texto:
      "La demanda se formulará por escrito, acompañando tantas copias de la misma como demandados haya. El actor en su escrito inicial de demanda expresará los hechos en que funde sus peticiones, pudiendo acompañar las pruebas que considere pertinentes, para demostrar sus pretensiones.",
    vigenteDesde: "1980-01-01",
    vigenteHasta: "2019-04-30",
  },
  {
    ordenamiento: LFT,
    articulo: "872",
    rubro: "Requisitos del escrito de demanda — vigente",
    texto:
      "La demanda se formulará por escrito y deberá contener: nombre y domicilio del actor; nombre y domicilio del demandado; las prestaciones que se reclamen; una relación de los hechos en que se funde la petición; y el ofrecimiento de las pruebas. Al escrito se acompañarán las pruebas documentales que se ofrezcan.",
    vigenteDesde: "2019-05-01",
  },
  {
    ordenamiento: LFT,
    articulo: "873",
    rubro: "Prevención y plazo para subsanar la demanda",
    texto:
      "El Tribunal, dentro de los tres días siguientes a la recepción de la demanda, dictará acuerdo en el que la admitirá o prevendrá al promovente. Si la demanda es oscura o irregular, prevendrá al actor para que la subsane dentro del término de tres días.",
    vigenteDesde: "2019-05-01",
  },
  {
    ordenamiento: LFT,
    articulo: "684-E",
    rubro: "Conciliación prejudicial obligatoria",
    texto:
      "Antes de acudir a los Tribunales laborales, los trabajadores y patrones deberán asistir al Centro de Conciliación correspondiente para solicitar el inicio del procedimiento de conciliación, con las excepciones que la propia Ley establece. La constancia de haber agotado esta instancia es requisito de procedencia de la demanda.",
    vigenteDesde: REFORMA_2019,
  },
  {
    ordenamiento: LFT,
    articulo: "899-C",
    rubro: "Prueba en conflictos de seguridad social",
    texto:
      "En los conflictos en materia de seguridad social, el actor deberá precisar el organismo de seguridad social ante el cual se encuentra inscrito, número de afiliación, semanas cotizadas, salarios base de cotización y el padecimiento que se reclama, según corresponda.",
    vigenteDesde: "2006-01-01",
  },
];

/** Preceptos vigentes a una fecha dada — nunca se consulta el corpus sin ella. */
export function vigentesA(fecha: string): Precepto[] {
  return PRECEPTOS.filter(
    (p) => p.vigenteDesde <= fecha && (!p.vigenteHasta || p.vigenteHasta >= fecha),
  );
}

/** Un precepto concreto en la vigencia que aplica a la fecha de los hechos. */
export function preceptoA(articulo: string, fecha: string): Precepto | undefined {
  return vigentesA(fecha).find((p) => p.articulo === articulo);
}

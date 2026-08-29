# Plataforma de control de juicios laborales
## Plan maestro de desarrollo por fases

| | |
|---|---|
| **Cliente** | Avila & Miranda — Isacc Alfonso Avila Miranda |
| **Fecha** | 29 de agosto de 2026 |
| **Versión** | 1.0 |
| **Base existente** | Aplicación Astro + shadcn/ui ya iniciada |
| **Documento previo** | `10.- Especificacion funcional - Plataforma de control de juicios laborales` — este plan la ejecuta |

---

## Supuestos declarados

Estos supuestos gobiernan todo el plan. Si alguno es falso, **avisar antes de codificar**, porque
cambian decisiones de arquitectura que después salen caras.

| # | Supuesto | Impacto si es falso |
|---|---|---|
| 1 | **Multi-tenant desde el día uno.** La plataforma servirá a más de un despacho, y dentro de un despacho hay segmentación por firma (maquila) | Retrofitear aislamiento de datos es reescribir el acceso a datos completo |
| 2 | Astro corre en **modo SSR**, no estático. La app es privada y con estado | Con `output: static` no hay sesión ni datos por usuario |
| 3 | Toda la infraestructura vive en **una sola región de AWS**, en México o en `us-east-1` con datos en reposo cifrados | Residencia de datos personales sensibles |
| 4 | El corpus normativo se carga desde **fuentes oficiales**, no de scraping de sitios secundarios | La confiabilidad de todo el sistema depende de esto |
| 5 | Los usuarios de fase 1 son **abogados del despacho**, no clientes finales | El portal de cliente cambia el modelo de permisos |

---

## Las cinco reglas del dominio que ninguna fase puede romper

Se repiten en cada documento de fase a propósito. Si el equipo las interioriza, el resto es
ingeniería normal.

1. **Nada falla en silencio.** "Cero resultados" y "no se ejecutó" son estados distintos y el
   sistema jamás los confunde.
2. **Cero aritmética jurídica con modelo de lenguaje.** Fechas, plazos y montos los calcula código
   determinista, con pruebas y con traza abrible.
3. **Cero cita sin verificar.** Ningún artículo ni criterio entra a un escrito sin coincidir con el
   texto recuperado de la base normativa. Si no verifica, no se inserta y el documento no exporta.
4. **El original nunca se modifica.** El archivo tal como entró se conserva íntegro para siempre.
5. **El abogado firma, no la máquina.** El sistema propone; una persona con cédula decide.

---

## El flujo end-to-end

Ésta es la cadena completa del producto, de la carga del archivo al recordatorio en el calendario.
Cada eslabón dice en qué fase entra.

```
1 · CARGAR                                                          FASE 1
    El abogado arrastra archivos en la UI de Astro.
    MD · PDF (con texto o escaneado) · DOCX · DOC · imágenes
    URL prefirmada → directo a S3. No pasa por el servidor.
              │
2 · NORMALIZAR A TEXTO                                              FASE 1
    Un adaptador por formato, misma salida: texto + páginas + metadatos
      MD    → parseo directo, ya es texto
      DOCX  → extracción de XML  ·  DOC → conversión previa
      PDF con capa de texto  → extracción directa (barato, instantáneo)
      PDF escaneado / imagen → Textract (caro, asíncrono)
    DETECTAR CUÁL ES ANTES DE MANDARLO A OCR. La mitad de los PDF no lo necesita.
              │
3 · ENTENDER                                                        FASE 1
    Clasificar tipo · extraer campos duros con confianza · validación humana
              │
4 · INDEXAR                                                         FASE 1
    Chunks del expediente → pgvector          (corpus A · el caso)
    Corpus normativo ya indexado aparte       (corpus B · las leyes)
              │
5 · ARMAR CONTEXTO                                                  FASE 1
    Al pedir un escrito, el backend junta cinco cosas:
      a) datos estructurados del expediente   (del esquema, no del RAG)
      b) chunks del expediente                (corpus A, por similitud)
      c) chunks de las leyes                  (corpus B, FILTRADOS por fecha_hechos)
      d) bloques argumentativos del despacho
      e) LA INSTRUCCIÓN DEL ABOGADO           ← el prompt que escribes tú
              │
6 · GENERAR                                                         FASE 1
    Escrito por secciones · validador de citas · exportación a .docx
              │
7 · RASTREAR EL ESTADO                                              FASE 1
    Días sin movimiento · semáforo de rezago · riesgo de caducidad
              │
8 · RECORDAR                                                        FASE 1 (simple)
    Plazo capturado → evento en Google Calendar con alertas          FASE 3 (completo)
```

### Los dos puntos donde el diseño se juega

**El punto 5(e) — tu prompt.** La instrucción que tú escribes antes de generar viaja como
**mensaje de usuario, nunca concatenada al prompt de sistema**. Las reglas duras ganan siempre
sobre ella: si escribes "cita la tesis tal", el sistema no la cita si no está verificada; te dice
que no puede. Esa instrucción se guarda junto a la versión del escrito, para poder reproducir
después con qué se generó.

**El punto 8 — la división que te recomiendo.** Empujar a Calendar un plazo que capturaste a mano
—"corrección, tres días"— es barato y entra en el MVP. Calcular solo que esos tres días hábiles,
con el calendario de inhábiles de esa autoridad, es otra cosa y va en fase 3 con su compuerta de
backtesting. Tienes el recordatorio desde el primer día sin cargar con el riesgo del cómputo.

---

## Mapa de fases

| Fase | Nombre | Objetivo | Duración estimada |
|---|---|---|---|
| **1** | **MVP — Expediente inteligente** | Cargar un expediente, entenderlo, consultarlo por lenguaje natural contra las leyes indexadas y generar el primer escrito | **12 semanas** |
| **2** | **Jurisprudencia** | Búsqueda y verificación de criterios del SJF, integrados a la redacción | 6 semanas |
| **3** | **El reloj** | Motor de cómputo de plazos, calendarios de inhábiles y sincronización con Google Calendar | 8 semanas |
| **4** | **Vigilancia y cálculo** | Boletines judiciales, DOF, motor de liquidaciones y contingencia | 8 semanas |
| **5** | **Despacho y cliente** | Tablero directivo, reportes a cliente, boletín, portal, cobranza | 8 semanas |

**Total estimado a producto completo: ~42 semanas.** La fase 1 sola ya es un producto usable y
vendible.

---

## Qué entra y qué NO entra en cada fase

### Fase 1 — MVP · Expediente inteligente `12 semanas`

**Entra:**

- Autenticación, despachos, usuarios y roles.
- Alta de asunto y expediente con el protocolo obligatorio: **régimen, autoridad, plaza, lado,
  propio o maquilado**.
- **Carga multiformato** desde la UI a S3: `.md`, `.pdf` (con texto o escaneado), `.docx`, `.doc`,
  imágenes. Un adaptador por formato con salida común. OCR **solo cuando hace falta**.
- Extracción de datos duros con confianza y validación humana.
- **Indexación vectorial de dos corpus separados**: el expediente y la normativa.
- Consulta en lenguaje natural sobre el expediente, con citación obligatoria a foja y documento.
- Consulta normativa filtrada por **fecha de los hechos**.
- **Tabla de contradicciones**: lo que alega la contraparte contra lo que consta en documentos.
- **Generación de escritos con instrucción del abogado**: tú escribes el prompt, el sistema arma
  el contexto del caso más el de las leyes y genera por secciones, con verificación de citas.
- Exportación a Word con el formato de la casa.
- **Rastreo de estado y semáforo de rezago**: días sin movimiento por expediente, umbral por
  etapa, alerta de riesgo de caducidad de la instancia.
- **Plazos capturados a mano** con semáforo **y empuje a Google Calendar** con alertas.
- Bitácora de auditoría.

**No entra:** motor automático de cómputo de plazos · sincronización bidireccional con Calendar ·
jurisprudencia · boletines judiciales · cálculo de liquidaciones · portal de cliente · facturación.

### Fase 2 — Jurisprudencia `6 semanas`

**Entra:** ingesta e indexación de criterios del SJF con registro digital · búsqueda híbrida ·
**servicio de verificación de citas contra la fuente** · inserción de criterios verificados en el
generador de escritos · biblioteca de criterios del despacho.

**No entra:** vigilancia automática de criterios nuevos (eso es fase 4).

### Fase 3 — El reloj `8 semanas`

**Entra:** tabla versionada de reglas de cómputo · calendarios de inhábiles por autoridad · motor
determinista de plazos con traza · recálculo en cascada · audiencias · **sincronización
bidireccional con Google Calendar** · alertas escalonadas · detección de choques de agenda.

> El **recordatorio** a Calendar ya existe desde la fase 1, sobre plazos capturados a mano. Lo que
> agrega esta fase es que el sistema **calcule solo** el vencimiento y que el calendario deje de
> depender de que alguien teclee la fecha correcta.

**Compuerta de salida obligatoria:** el motor no pasa a producción hasta reproducir al **100%**
los vencimientos de 100 expedientes históricos reales.

### Fase 4 — Vigilancia y cálculo `8 semanas`

Conectores de boletines y estrados por autoridad · vigilancia del DOF · motor de cálculo de
liquidaciones y contingencia · alertas de salud del ingestor.

### Fase 5 — Despacho y cliente `8 semanas`

Tablero directivo · exposición económica agregada · reportes a cliente · boletín · portal de
cliente de solo lectura · cobranza ligada al asunto.

---

## Criterio de avance entre fases

Ninguna fase abre hasta que la anterior pase su compuerta:

| Fase | Compuerta |
|---|---|
| 1 → 2 | Un abogado del despacho trabaja **un asunto real completo** en la plataforma, de la carga del expediente al escrito exportado, sin salirse a Word ni a Drive |
| 2 → 3 | 100 citas verificadas contra el SJF, **cero falsos positivos**. Una cita inexistente aceptada por el sistema reprueba la fase |
| 3 → 4 | Backtesting de plazos al 100% sobre 100 expedientes cerrados |
| 4 → 5 | 30 días corridos de vigilancia sin un solo hueco no alertado |

---

## Riesgos y cómo se manejan

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| **Alucinación de citas normativas** | Alta si no se controla | Generación restringida a chunks recuperados + validador post-generación que compara literal contra la base + bloqueo de exportación |
| **OCR malo sobre escaneos reales** | Alta | El corpus del despacho son PDF sin capa de texto, con sellos encimados. Probar Textract contra 50 documentos reales feos **en la semana 1**, antes de comprometer el diseño |
| **Corpus normativo incompleto o desactualizado** | Media | Carga desde fuente oficial, con `vigente_desde` / `vigente_hasta` por artículo y bitácora de importación |
| **Costo de LLM fuera de control** | Media | Presupuesto por despacho, caché de prompts, modelo chico para clasificación y modelo grande solo para redacción |
| **Adopción: el abogado vuelve a Word** | Alta | Exportación a `.docx` con el formato exacto de la casa desde el día uno, y reimportación de las correcciones sin perderlas |
| **Fuga entre firmas en asuntos maquilados** | Baja, impacto altísimo | Row-level security en Postgres, pruebas automatizadas de aislamiento en CI |

---

## Contenido de este documento

1. Plan maestro y mapa de fases
2. **Fase 1 · MVP** — stack, infraestructura AWS, **rutas y secciones de la app**, sprints
3. **Fase 1 · Modelo de datos** — esquema SQL, indexación vectorial, pipeline de ingesta
4. **Fase 1 · Skills y pre-prompts** — listos para pegar, con sus esquemas de salida
5. **Fase 2 · Jurisprudencia**
6. **Fase 3 · El reloj** — motor de plazos y Google Calendar
7. **Fases 4 y 5** — vigilancia, cálculo, tablero y cliente
8. **Anexo** — reglas duras para pegar como `CLAUDE.md` en el repositorio

# FASE 1 · MVP — Expediente inteligente
## Arquitectura, rutas y secciones de la aplicación

**Duración:** 12 semanas · 6 sprints de 2 semanas
**Objetivo de la fase:** que un abogado cargue un expediente real, la plataforma lo entienda, lo
pueda consultar en lenguaje natural contra las leyes indexadas, y produzca el primer escrito
exportable a Word — sin salirse a otra herramienta.

---

## 1. Stack

### 1.1 Frontend

| Pieza | Elección | Por qué |
|---|---|---|
| Framework | **Astro 5, `output: 'server'`** | La app es privada y con estado. El modo estático no aplica |
| Adapter | `@astrojs/node` en contenedor, **o** adapter AWS Lambda | Ver §2.1 |
| UI | **shadcn/ui + Tailwind** | Ya está en la base existente |
| Islas | **React 19** | shadcn/ui es React. Astro renderiza el marco; React solo donde hay interacción real |
| Estado de servidor | **TanStack Query** dentro de las islas | Caché, revalidación e invalidación en las pantallas de expediente |
| Formularios | **react-hook-form + Zod** | Los mismos esquemas Zod se comparten con el backend |
| Tablas | **TanStack Table** sobre shadcn `DataTable` | Listados de expedientes, plazos y documentos |
| Editor de escritos | **TipTap** (ProseMirror) | Necesita marcas personalizadas por cita y por estado de verificación. Un textarea no sirve |
| Visor de PDF | **PDF.js** con capa de resaltado | Para el panel documento↔extracción |

**Regla de rendimiento:** todo lo que sea lectura se renderiza en el servidor. Solo se hidratan
islas donde hay interacción: editor, visor, formularios, filtros de tabla, chat de consulta.

### 1.2 Backend

| Pieza | Elección | Por qué |
|---|---|---|
| API | **Endpoints de Astro** (`src/pages/api/**`) para CRUD | Un solo despliegue, un solo lenguaje |
| Trabajos pesados | **Lambdas separadas** orquestadas por Step Functions | OCR y embeddings no caben en el ciclo de una petición HTTP |
| ORM | **Drizzle** | TypeScript de punta a punta y trato de primera con `pgvector` y SQL crudo |
| Validación | **Zod** | Esquema compartido entre formulario, endpoint y salida del LLM |
| Pruebas | **Vitest** (unidad) + **Playwright** (extremo a extremo) | |

### 1.3 Inteligencia

| Pieza | Elección | Nota |
|---|---|---|
| OCR | **Amazon Textract**, API asíncrona | `StartDocumentTextDetection` para texto; `StartDocumentAnalysis` con `TABLES` para recibos de nómina y controles de asistencia |
| LLM | **Amazon Bedrock**, familia Claude | `[POR VERIFICAR]` disponibilidad del modelo exacto en la región elegida antes de cerrar el diseño |
| Embeddings | **Cohere Embed Multilingual v3** o **Titan Text Embeddings v2**, ambos vía Bedrock | **Decidir por evaluación, no por preferencia** — ver §5 |
| Vector store | **PostgreSQL + `pgvector`** | Ver §1.4 |

### 1.4 Por qué Postgres con pgvector y no una base vectorial dedicada

Para el volumen de un despacho —decenas de miles de chunks, no cientos de millones— **una sola
base transaccional y vectorial es la decisión correcta**:

- El filtro por metadatos es obligatorio en cada consulta (`despacho_id`, `expediente_id`,
  `vigente_desde <= fecha_hechos`). En una base vectorial separada eso obliga a filtrado previo
  con dos viajes o a duplicar metadatos que se desincronizan.
- El aislamiento entre despachos y firmas se resuelve con **row-level security de Postgres**,
  que es la garantía más fuerte y barata disponible.
- Menos piezas que operar, menos superficie de fuga, y un `JOIN` entre el chunk y el expediente
  sin salir de la base.

Índice **HNSW** sobre `vector`, más índice **GIN** sobre `tsvector` en español para la mitad
léxica de la búsqueda híbrida.

---

## 2. Infraestructura AWS

### 2.1 Topología del MVP

```
Internet
   │
   ▼
CloudFront ── WAF
   │
   ├──► S3 (estáticos de Astro)
   │
   └──► ALB ──► ECS Fargate (Astro SSR, contenedor)
                    │
                    ├──► Aurora PostgreSQL Serverless v2 + pgvector   [subred privada]
                    ├──► S3 expedientes-raw     (versionado, Object Lock, KMS)
                    ├──► S3 expedientes-deriv   (texto, thumbnails, .docx)
                    ├──► SQS ──► Step Functions ──► Lambdas de ingesta
                    │                                  ├─ Textract
                    │                                  ├─ Clasificación (Bedrock)
                    │                                  ├─ Extracción (Bedrock)
                    │                                  └─ Embeddings (Bedrock)
                    ├──► Bedrock  (consulta y redacción)
                    ├──► Cognito  (autenticación)
                    └──► Secrets Manager / KMS
```

**Recomendación de cómputo:** **ECS Fargate** para el SSR de Astro, no Lambda. Razones: el editor
y el visor mantienen conexiones más largas, el arranque en frío de Lambda con Astro SSR se siente
en una app de trabajo diario, y el contenedor es idéntico a lo que corre en local. Si el equipo
prefiere serverless puro, la alternativa es SST v3 con adapter Lambda — es válida, pero
**decidir en el sprint 0, no a la mitad**.

**IaC obligatorio desde el sprint 0: AWS CDK en TypeScript.** Nada de consola.

### 2.2 Almacenamiento de documentos — reglas duras

- Bucket `expedientes-raw`: **versionado activado**, **Object Lock en modo governance**,
  cifrado con KMS con llave del cliente. El original **jamás** se sobrescribe ni se borra.
- Bucket `expedientes-deriv`: texto extraído, imágenes por página, escritos generados. Este sí
  es regenerable.
- Carga desde el navegador con **URL prefirmada**, nunca proxeada por el servidor.
- Clave del objeto: `despacho_id/asunto_id/expediente_id/documento_id/original.pdf`. La
  nomenclatura legible de la casa (`01.-`, `02.1.-`) es un **campo de la base**, no el nombre del
  objeto en S3.

### 2.3 Seguridad transversal

- **Row-level security en Postgres** por `despacho_id` y por `firma_id` (maquila). La sesión de
  base de datos establece el contexto; ninguna consulta de aplicación puede omitir el filtro.
- **Prueba de aislamiento automatizada en CI**: un usuario del despacho A intenta leer datos del
  despacho B por cada endpoint. Si alguna pasa, el build falla.
- Bitácora `append-only` de todo acceso a expediente y de todo acto con consecuencia.
- Secretos en Secrets Manager. Cero credenciales en el repositorio o en variables de entorno del
  contenedor.
- WAF con reglas gestionadas y límite de tasa.

---

## 3. Rutas y secciones de la aplicación

Esta es la definición que pediste. Convención: `/app/**` es privado y requiere sesión.

### 3.1 Árbol completo de rutas

```
/                                     Landing pública · acceso
/acceso                               Inicio de sesión (Cognito)
/acceso/recuperar                     Recuperación de contraseña

/app                                  TABLERO
/app/bandeja                          Documentos sin clasificar  ← se vacía todos los días

/app/expedientes                      Listado con filtros y búsqueda
/app/expedientes/nuevo                Alta guiada · asistente de 4 pasos
/app/expedientes/[id]                 → redirige a /resumen
/app/expedientes/[id]/resumen         Ficha del asunto
/app/expedientes/[id]/documentos      Índice del expediente digital
/app/expedientes/[id]/documentos/[docId]   Visor + panel de extracción
/app/expedientes/[id]/partes          Actor, demandado, terceros, representación
/app/expedientes/[id]/actos           Línea de tiempo procesal
/app/expedientes/[id]/plazos          Plazos del expediente (captura manual en fase 1)
/app/expedientes/[id]/pruebas         Inventario probatorio
/app/expedientes/[id]/contradicciones Alegado vs. documentado
/app/expedientes/[id]/consulta        Chat sobre el expediente y la ley
/app/expedientes/[id]/escritos        Escritos del expediente
/app/expedientes/[id]/escritos/nuevo  Asistente de generación
/app/expedientes/[id]/escritos/[eid]  Editor
/app/expedientes/[id]/bitacora        Auditoría del expediente

/app/plazos                           Semáforo global · todos los expedientes
/app/clientes                         Listado
/app/clientes/[id]                    Ficha del cliente y sus asuntos

/app/biblioteca                       Normativa indexada
/app/biblioteca/[ordenamiento]        Índice del ordenamiento
/app/biblioteca/[ordenamiento]/[art]  Artículo, con su historial de vigencias
/app/biblioteca/bloques               Bloques argumentativos del despacho

/app/plantillas                       Plantillas de escrito
/app/plantillas/[id]                  Editor de plantilla

/app/buscar                           Búsqueda global híbrida

/app/admin/despacho                   Datos, membrete, firmas
/app/admin/usuarios                   Usuarios y roles
/app/admin/autoridades                Catálogo de autoridades y plazas
/app/admin/salud                      ESTADO DEL SISTEMA
/app/admin/costos                     Consumo de LLM por despacho y por asunto

/api/**                               Endpoints (§3.4)
```

### 3.2 Las nueve pantallas que definen el producto

Si estas nueve quedan bien, la fase 1 está ganada.

---

#### `1` `/app` — **Tablero**

Se abre desde el teléfono, entre pendientes. **Conclusión arriba, desarrollo abajo.**

- Franja superior: **plazos a ≤ 7 días**, con semáforo 🔴 ≤ 48 h · 🟠 ≤ 7 d · 🟡 ≤ 15 d, cada
  renglón con responsable y **una columna que dice si el entregable existe o no**.
  *Un vencimiento en 48 horas sin borrador es la información más importante de la aplicación.*
- Bandeja de no clasificados, con antigüedad del más viejo.
- Asuntos con actividad reciente.
- Avisos del sistema: extracciones esperando validación, trabajos fallidos.

---

#### `2` `/app/expedientes/nuevo` — **Alta guiada**

Asistente de cuatro pasos. **Ninguno se puede saltar** — implementa el protocolo de apertura del
despacho, y una respuesta equivocada aquí invalida todo el análisis posterior.

| Paso | Campos | Regla |
|---|---|---|
| **1 · Autoridad** | Tipo (Junta / Tribunal Laboral / Tribunal administrativo / Juzgado de Distrito / TCC) · federal o local · plaza · número de expediente · fecha de presentación | El **régimen** se deriva del tipo de autoridad y se muestra en pantalla para que el abogado lo confirme. **Nunca se infiere en silencio** |
| **2 · Lado** | Patronal / trabajador | Obligatorio. **Sin valor por defecto.** Invierte carga probatoria y teoría del caso |
| **3 · Origen** | Propio / maquilado · si es maquilado, qué firma | Determina marca del entregable, facturación y **segmentación de acceso** |
| **4 · Partes y hechos** | Cliente, contraparte, **fecha de los hechos** | `fecha_hechos` fija qué versión de la ley aplica a todo el asunto |

Al guardar: verificación automática de **conflicto de interés** contra toda la base del despacho.

---

#### `3` `/app/expedientes/[id]/resumen` — **Ficha del asunto**

Encabezado persistente que **acompaña a todas las subpáginas del expediente**, siempre visible:

```
┌──────────────────────────────────────────────────────────────────────┐
│ FRUNATURAL vs MICHEL LARA VEGA          exp. 1146/2022               │
│ 🏛 Junta Especial 30 Federal · Morelia   ⚖ RÉGIMEN: JUNTA            │
│ 👤 Lado: PATRONAL    📁 Propio    📅 Hechos: 1-sep-2018              │
│ 🔴 Próximo: audiencia 28-ago 12:00 · resp. personal en Morelia       │
└──────────────────────────────────────────────────────────────────────┘
```

Ese encabezado no es decoración: **es el antídoto contra el error más caro del dominio**, que es
trabajar un expediente con el régimen o el lado equivocado en la cabeza.

Debajo: resumen generado del asunto, prestaciones reclamadas, estado procesal, últimos actos,
documentos pendientes de validar, alertas.

---

#### `4` `/app/expedientes/[id]/documentos` — **Índice del expediente**

Tabla con la nomenclatura de la casa. **Todo a la vista en la raíz; la única subcarpeta permitida
es `Pruebas`.**

| Col | Contenido |
|---|---|
| `#` | `01.-`, `02.-`, `02.1.-` · numeración arábiga cronológica con cero, generada por el sistema |
| Nombre | Descriptivo |
| Tipo | Clasificación automática, editable |
| Fecha | Del documento |
| Estado | 🟢 validado · 🟡 esperando validación · 🔴 OCR falló · ⚪ sin clasificar |
| Acuse | Emparejado / faltante — **por contenido, nunca por número de páginas** |

Carga por arrastre múltiple. Barra de progreso por documento a través del pipeline.

---

#### `5` `/app/expedientes/[id]/documentos/[docId]` — **Visor y extracción**

**La pantalla más importante de la fase 1.** Dos paneles:

- **Izquierda:** el PDF con la región de cada campo extraído **resaltada sobre la imagen**.
- **Derecha:** los campos extraídos, cada uno con su valor, su **score de confianza** y un botón
  de confirmación. Al pasar el cursor por un campo, se resalta en la imagen. Al hacer clic en la
  imagen, salta al campo.

Reglas:
- Campo con confianza bajo el umbral → **vacío y marcado**, jamás rellenado con una estimación.
- Los campos críticos —número de expediente, autoridad, fecha de notificación, montos, salario—
  **siempre** pasan por confirmación humana, aunque vengan al 99%.
- El documento no alimenta consultas ni escritos hasta estar validado.

---

#### `6` `/app/expedientes/[id]/contradicciones` — **Alegado vs. documentado**

Puramente mecánica y de altísimo valor. El sistema cruza lo que afirma la demanda contra lo que
consta en los documentos del cliente:

| Dato | Alega la contraparte | Consta en documento | Fuente | Δ |
|---|---|---|---|---|
| Salario diario | $400.00 | **$120.00** | CFDI de nómina, doc. 07, p. 2 | **3.33×** |
| Fecha de baja | 1-sep-2018 | **31-ago-2018** | Nómina, doc. 06 | 1 día |
| Causa | Despido | **Separación voluntaria** | Nómina, doc. 06 | — |

Cada renglón con liga directa a la foja. Exportable, y **es insumo directo del generador de
escritos**.

---

#### `7` `/app/expedientes/[id]/consulta` — **Chat sobre expediente y ley**

Consulta en lenguaje natural. Recupera de **dos corpus separados y los marca distinto**:

- 📄 **Expediente** → responde con cita a documento y foja.
- ⚖️ **Normativa** → responde con ordenamiento, artículo, fracción e inciso, **filtrado por la
  fecha de los hechos del asunto**.

Reglas de interfaz:
- Toda afirmación lleva su cita, clicable, que abre el documento en la foja o el artículo en la
  biblioteca.
- **Si no hay fuente recuperada, el sistema responde "no lo tengo en el expediente".** No completa
  con conocimiento general del modelo.
- Selector visible de fecha de vigencia normativa, precargado con la fecha de los hechos.

---

#### `8` `/app/expedientes/[id]/escritos/[eid]` — **Editor**

TipTap con marcas propias:

- Cada bloque muestra su **origen**: plantilla · biblioteca del despacho · generado · escrito a mano.
- Cada afirmación lleva estado: 🟢 `verificado` (consta en documento, con liga) · 🟡 `por verificar`
  · 🔴 `supuesto`.
- **Un `supuesto` bloquea la exportación.** El botón de exportar está deshabilitado y dice por qué.
- Cada cita normativa se valida contra la base; si no coincide con el texto indexado, se marca en
  rojo y **también bloquea**.
- Panel lateral con el contexto recuperado, para que el abogado vea de dónde salió cada cosa.
- Generación **por secciones**, no de un solo tirón: proemio → personalidad → hechos → excepciones
  → pruebas → petitorios. Cada sección se regenera sola.
- Historial de versiones con diff. **Regenerar nunca pisa una corrección del abogado**: muestra el
  diff y pregunta.

---

#### `9` `/app/admin/salud` — **Estado del sistema**

Tan importante como cualquier pantalla jurídica, porque mide si se puede confiar en el sistema:

- Última ejecución y resultado de cada trabajo de ingesta.
- Documentos atorados en el pipeline, con cuánto llevan.
- Extracciones esperando validación humana, por antigüedad.
- Errores de Textract y de Bedrock, con reintentos.
- Consumo de tokens y costo por despacho y por asunto.

**Nada falla en silencio: cada fallo genera alerta a un humano el mismo día.**

### 3.3 Componentes compartidos que hay que construir primero

| Componente | Uso |
|---|---|
| `<EncabezadoExpediente>` | El bloque de identidad del §3.3. En todas las subpáginas |
| `<BadgeRegimen>` | Junta / Tribunal, con color fijo. Vocabulario derivado: laudo vs sentencia |
| `<BadgeLado>` | Patronal / trabajador |
| `<SemaforoPlazo>` | Cálculo de color por días restantes |
| `<EstadoVerificacion>` | 🟢🟡🔴 con tooltip de fuente |
| `<CitaDocumento>` | Chip clicable → abre visor en la foja |
| `<CitaNormativa>` | Chip clicable → abre artículo en la vigencia correcta |
| `<VisorPDF>` | PDF.js con capa de resaltado por región |
| `<PanelExtraccion>` | Campos con confianza y confirmación |
| `<TablaDatos>` | Envoltura de TanStack Table sobre shadcn |

### 3.4 Endpoints de la fase 1

```
POST   /api/documentos/url-carga          → URL prefirmada de S3
POST   /api/documentos/:id/reprocesar
GET    /api/documentos/:id/extraccion
PATCH  /api/documentos/:id/extraccion     → confirmación humana campo por campo

POST   /api/expedientes
GET    /api/expedientes?filtros
GET    /api/expedientes/:id/contradicciones

POST   /api/consulta                      → RAG, respuesta en streaming
POST   /api/escritos                      → crear desde plantilla
POST   /api/escritos/:id/generar-seccion  → generación por sección
POST   /api/escritos/:id/validar-citas    → compuerta previa a exportar
POST   /api/escritos/:id/exportar         → .docx
GET    /api/normativa/buscar?q&fecha_vigencia
GET    /api/salud
```

---

## 4. Sprints de la fase 1

| Sprint | Semanas | Entrega | Se demuestra con |
|---|---|---|---|
| **0** | 1-2 | CDK, VPC, Aurora + pgvector, Cognito, S3, CI/CD, esqueleto de Astro con shadcn, layout y rutas vacías. **Prueba de Textract contra 50 PDF reales feos** | Desplegado en AWS, sesión iniciada, informe de calidad de OCR |
| **1** | 3-4 | Modelo de datos completo, RLS y **pruebas de aislamiento en CI**. Alta guiada de expediente. Listado y ficha | Se da de alta un expediente real con régimen, lado y origen |
| **2** | 5-6 | Pipeline multiformato: carga → adaptador por formato (`md`/`docx`/`pdf` con y sin texto) → clasificación → extracción → validación humana. Visor de dos paneles | Se cargan un `.md`, un `.docx` y un PDF escaneado y los tres quedan validados |
| **3** | 7-8 | Indexación vectorial de expediente **y** de normativa. Búsqueda híbrida. Biblioteca navegable con vigencias | Se pregunta "qué decía el 47 en septiembre de 2018" y contesta bien |
| **4** | 9-10 | Chat de consulta con citación obligatoria. Tabla de contradicciones | Se le pregunta al expediente y responde con foja |
| **5** | 11-12 | Generación por secciones **con instrucción del abogado**, validador de citas, editor, exportación a `.docx`. Plazos manuales con **empuje a Google Calendar**. Semáforo de rezago | **Un escrito real generado desde un prompt tuyo, exportado, y una prevención de 3 días con su recordatorio en Calendar** |

---

## 5. Decisiones que hay que tomar en el sprint 0

| # | Decisión | Recomendación | Cómo se decide |
|---|---|---|---|
| 1 | Fargate vs Lambda para el SSR | **Fargate** | Prueba de latencia percibida en el editor |
| 2 | Modelo de embeddings | Evaluar **Cohere multilingual v3** contra **Titan v2** | 50 preguntas jurídicas reales con respuesta conocida; se mide recuperación en top-5. Gana el número, no la opinión |
| 3 | Región de AWS | La más cercana con Bedrock y Textract en español | `[POR VERIFICAR]` disponibilidad de servicios por región |
| 4 | Umbral de confianza de OCR para auto-aprobar | Sale del informe del sprint 0 | Contra los 50 documentos reales |
| 5 | Modelo de LLM por tarea | Modelo chico para clasificar, grande para redactar | Costo por asunto medido en el sprint 4 |
## 6. Rastreo de estado y detección de rezago

Un expediente no se cae solo por un plazo vencido. Se cae por **quedarse quieto**: un señalamiento
que no se repuso, una prevención que nadie cumplió, un exhorto que nadie siguió. Esto se detecta
con SQL sobre la fecha del último acto — **no necesita el motor de plazos**, por eso entra al MVP.

> **Caso real que justifica la función.** Un expediente del despacho: demanda presentada en octubre
> de 2018 ante una Junta Local, que no la remitió a la Federal sino hasta septiembre de 2022 —casi
> cuatro años—, y después **cuatro señalamientos de audiencia caídos** por falta de emplazamiento
> entre 2023 y 2026. Ocho años para llegar a la audiencia de contestación. Cada uno de esos huecos
> era detectable el mismo mes en que empezó.

### Señales que el sistema vigila

| Señal | Cómo se calcula | Umbral |
|---|---|---|
| **Días sin movimiento** | Hoy menos la fecha del último `acto_procesal` | Por etapa. No es lo mismo esperar emplazamiento que esperar sentencia |
| **Días sin promoción propia** | Hoy menos la última promoción nuestra | Alimenta el riesgo de caducidad |
| **Señalamiento caído** | Audiencia con fecha pasada, sin acta ni nuevo señalamiento registrado | 15 días después de la fecha |
| **Prevención sin cumplir** | Acto tipo prevención sin promoción posterior emparejada | Inmediata |
| **Exhorto sin retorno** | Exhorto girado sin constancia de diligenciación | 60 días |
| **Riesgo de caducidad** | Inactividad de las partes, arts. 771 a 773 LFT | Configurable por régimen |
| **Desviación de la mediana** | Días en esta etapa contra la mediana histórica del despacho para esa etapa y esa autoridad | 1.5× la mediana |

### Modelo

```sql
CREATE TABLE etapa_umbral (           -- lo llena el área jurídica, no el código
  regimen  text NOT NULL,
  etapa    text NOT NULL,
  dias_alerta   int NOT NULL,         -- amarillo
  dias_critico  int NOT NULL,         -- rojo
  PRIMARY KEY (regimen, etapa)
);

CREATE VIEW expediente_rezago AS
SELECT e.id, e.numero, e.etapa, e.regimen,
       MAX(a.fecha_acuerdo)                        AS ultimo_movimiento,
       CURRENT_DATE - MAX(a.fecha_acuerdo)         AS dias_sin_movimiento,
       u.dias_alerta, u.dias_critico,
       CASE
         WHEN CURRENT_DATE - MAX(a.fecha_acuerdo) >= u.dias_critico THEN 'critico'
         WHEN CURRENT_DATE - MAX(a.fecha_acuerdo) >= u.dias_alerta  THEN 'alerta'
         ELSE 'normal'
       END AS estado_rezago
FROM expediente e
LEFT JOIN acto_procesal a ON a.expediente_id = e.id
LEFT JOIN etapa_umbral  u ON u.regimen = e.regimen AND u.etapa = e.etapa
GROUP BY e.id, e.numero, e.etapa, e.regimen, u.dias_alerta, u.dias_critico;
```

Trabajo diario en EventBridge que recorre la vista, genera alertas y **las escala si nadie las
atiende**. Ruta nueva `/app/rezago`, y columna de rezago en el listado de expedientes.

**Regla dura:** una alerta de rezago solo se cierra **con un acto registrado** o con una nota del
abogado explicando por qué es normal. No se descarta con un clic: si se descarta sin motivo,
reaparece a los 15 días.

---

## 7. Recordatorio a Google Calendar — versión simple del MVP

Alcance deliberadamente acotado:

- OAuth por usuario, escritura sobre un calendario del despacho.
- **Empuje de una sola vía**: el plazo capturado en la plataforma crea el evento. Si alguien lo
  mueve en Calendar, el sistema **no** lo persigue todavía — eso es fase 3.
- El evento lleva qué se hace, expediente, autoridad, plaza, responsable y liga al expediente.
- Recordatorios nativos de Calendar a `T-3`, `T-1` y el día del vencimiento.
- El plazo se cierra con el acuse cargado; al cerrarse, el evento se marca cumplido.

El caso que planteaste: se registra la prevención con término de tres días, se teclea la fecha de
vencimiento, y queda el evento con sus recordatorios y el vínculo al expediente. **En fase 3 esa
fecha deja de teclearse** — la calcula el motor.

---

# FASE 1 · Modelo de datos, indexación vectorial y pipeline

---

## 1. Principios del modelo

1. **Todo cuelga de `despacho_id`.** Row-level security en cada tabla. Sin excepción.
2. **`regimen` y `lado` no son nulos** en `expediente`. Gobiernan la lógica, no adornan la interfaz.
3. **`fecha_hechos` vive en el asunto** y filtra toda consulta normativa.
4. **La normativa es bitemporal**: cada artículo tiene vigencia propia. La pregunta que el sistema
   debe poder responder es *"qué decía este artículo en tal fecha"*.
5. **Nada se borra.** Bajas lógicas y bitácora `append-only`.

---

## 2. Esquema SQL — Fase 1

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────── TENANCY

CREATE TABLE despacho (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  membrete_config jsonb,                      -- formato de la casa
  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE firma_externa (                  -- para asuntos maquilados
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id uuid NOT NULL REFERENCES despacho(id),
  nombre      text NOT NULL
);

CREATE TABLE usuario (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id   uuid NOT NULL REFERENCES despacho(id),
  cognito_sub   text UNIQUE NOT NULL,
  nombre        text NOT NULL,
  email         text NOT NULL,
  rol           text NOT NULL,                -- director | litigante | pasante | admin
  cedula        text,
  activo        boolean NOT NULL DEFAULT true
);

-- ─────────────────────────────────────────── CATÁLOGOS

CREATE TABLE autoridad (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        text NOT NULL,   -- junta | tribunal_laboral | centro_conciliacion
                               -- | juzgado_distrito | tcc | tribunal_administrativo
  fuero       text NOT NULL,   -- federal | local
  nombre      text NOT NULL,
  entidad     text NOT NULL,   -- Jalisco, Baja California Sur, Michoacán, Nuevo León...
  plaza       text,
  zona_horaria text NOT NULL,  -- IANA. BCS NO comparte huso con Jalisco
  regimen     text NOT NULL    -- junta | tribunal — derivado del tipo, confirmado por humano
);

-- ─────────────────────────────────────────── NEGOCIO

CREATE TABLE cliente (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id uuid NOT NULL REFERENCES despacho(id),
  tipo_persona text NOT NULL,                 -- fisica | moral
  nombre      text NOT NULL,
  rfc         text,
  contacto    jsonb
);

CREATE TABLE asunto (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id     uuid NOT NULL REFERENCES despacho(id),
  cliente_id      uuid NOT NULL REFERENCES cliente(id),
  titulo          text NOT NULL,
  origen          text NOT NULL,              -- propio | maquilado
  firma_externa_id uuid REFERENCES firma_externa(id),
  lado            text NOT NULL,              -- patronal | trabajador   SIN DEFAULT
  fecha_hechos    date NOT NULL,              -- fija la versión de la ley aplicable
  estado          text NOT NULL DEFAULT 'activo',
  responsable_id  uuid REFERENCES usuario(id),
  CONSTRAINT maquila_exige_firma
    CHECK (origen <> 'maquilado' OR firma_externa_id IS NOT NULL)
);

CREATE TABLE expediente (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id    uuid NOT NULL REFERENCES despacho(id),
  asunto_id      uuid NOT NULL REFERENCES asunto(id),
  autoridad_id   uuid NOT NULL REFERENCES autoridad(id),
  regimen        text NOT NULL,               -- junta | tribunal | amparo | administrativo
  numero         text NOT NULL,
  toca           text,
  fecha_presentacion date,
  etapa          text NOT NULL,
  UNIQUE (despacho_id, autoridad_id, numero)
);

-- Grafo entre expedientes: amparos, expedientes hermanos del mismo frente
CREATE TABLE expediente_relacion (
  origen_id  uuid NOT NULL REFERENCES expediente(id),
  destino_id uuid NOT NULL REFERENCES expediente(id),
  tipo       text NOT NULL,   -- amparo_de | hermano_frente | acumulado | exhorto
  nota       text,
  PRIMARY KEY (origen_id, destino_id, tipo)
);

CREATE TABLE parte (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id  uuid NOT NULL REFERENCES despacho(id),
  expediente_id uuid NOT NULL REFERENCES expediente(id),
  caracter     text NOT NULL,                 -- actor | demandado | tercero | codemandado
  tipo_persona text NOT NULL,
  nombre       text NOT NULL,
  rfc text, curp text, nss text, registro_patronal text,
  domicilio jsonb
);

-- ─────────────────────────────────────────── DOCUMENTOS

CREATE TABLE documento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id    uuid NOT NULL REFERENCES despacho(id),
  expediente_id  uuid NOT NULL REFERENCES expediente(id),
  consecutivo    text NOT NULL,               -- '01.-', '02.1.-'  nomenclatura de la casa
  nombre         text NOT NULL,
  en_pruebas     boolean NOT NULL DEFAULT false,   -- única subcarpeta permitida
  tipo           text,                        -- clasificación automática
  tipo_confianza real,
  tipo_confirmado_por uuid REFERENCES usuario(id),
  s3_key_original text NOT NULL,              -- INMUTABLE
  s3_key_texto    text,
  sha256          text NOT NULL,
  paginas         int,
  fecha_documento date,
  formato_origen  text NOT NULL,        -- md | pdf_texto | pdf_escaneado | docx | doc | imagen
  requiere_ocr    boolean NOT NULL,     -- se decide ANTES de gastar en Textract
  estado_ocr      text NOT NULL DEFAULT 'pendiente',
  acuse_de_id     uuid REFERENCES documento(id),   -- emparejado POR CONTENIDO
  subido_por      uuid NOT NULL REFERENCES usuario(id),
  subido_en       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (despacho_id, sha256, expediente_id)      -- deduplicación
);

CREATE TABLE documento_pagina (
  documento_id uuid NOT NULL REFERENCES documento(id),
  pagina       int  NOT NULL,
  texto        text,
  confianza    real,
  PRIMARY KEY (documento_id, pagina)
);

CREATE TABLE extraccion (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES documento(id),
  campo        text NOT NULL,       -- numero_expediente | fecha_notificacion | salario_diario...
  valor        text,                -- NULL si no se leyó con confianza. NUNCA estimado
  valor_norm   jsonb,               -- tipado: fecha ISO, monto decimal
  confianza    real,
  pagina       int,
  bbox         jsonb,               -- para resaltar sobre la imagen
  critico      boolean NOT NULL DEFAULT false,   -- exige confirmación humana siempre
  confirmado_por uuid REFERENCES usuario(id),
  confirmado_en  timestamptz
);

-- ─────────────────────────────────────────── PROCESO

CREATE TABLE acto_procesal (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id    uuid NOT NULL REFERENCES despacho(id),
  expediente_id  uuid NOT NULL REFERENCES expediente(id),
  documento_id   uuid REFERENCES documento(id),
  tipo           text NOT NULL,
  -- LAS CINCO FECHAS. Nunca colapsarlas en una.
  fecha_acuerdo       date,
  fecha_publicacion   date,
  fecha_notificacion  date,
  fecha_surtimiento   date,
  primer_dia_computo  date,
  modalidad_notificacion text,   -- personal | boletin | estrados | buzon_electronico
  calificado_por uuid REFERENCES usuario(id),
  calificado_en  timestamptz
);

CREATE TABLE plazo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id    uuid NOT NULL REFERENCES despacho(id),
  expediente_id  uuid NOT NULL REFERENCES expediente(id),
  acto_id        uuid REFERENCES acto_procesal(id),
  tipo           text NOT NULL,
  fecha_fatal    date NOT NULL,        -- vencimiento legal
  fecha_meta     date,                 -- cuándo lo queremos hecho. Se trabaja contra ésta
  provisional    boolean NOT NULL DEFAULT true,   -- true mientras falte el acuse
  responsable_id uuid REFERENCES usuario(id),
  estado         text NOT NULL DEFAULT 'abierto', -- abierto | cumplido | no_aplicable
  cerrado_con_documento_id uuid REFERENCES documento(id),  -- el acuse
  cerrado_motivo text,
  cerrado_por    uuid REFERENCES usuario(id),
  -- Fase 3 rellena estos. En fase 1 la captura es manual.
  traza_computo  jsonb,
  version_reglas text,
  CONSTRAINT cierre_exige_evidencia CHECK (
    estado <> 'cumplido' OR cerrado_con_documento_id IS NOT NULL
  )
);
-- NO existe DELETE sobre plazo. Ni para el administrador.

-- ─────────────────────────────────────────── NORMATIVA (BITEMPORAL)

CREATE TABLE ordenamiento (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave  text UNIQUE NOT NULL,   -- LFT | LA | LSS | CPEUM | RGITAS
  nombre text NOT NULL
);

CREATE TABLE norma_articulo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordenamiento_id uuid NOT NULL REFERENCES ordenamiento(id),
  numero          text NOT NULL,        -- '47', '685 Ter', '872'
  fraccion        text,
  inciso          text,
  texto           text NOT NULL,        -- literal
  vigente_desde   date NOT NULL,
  vigente_hasta   date,                 -- NULL = vigente hoy
  dof_publicacion date,
  fuente_url      text NOT NULL,
  importado_en    timestamptz NOT NULL DEFAULT now(),
  EXCLUDE USING gist (
    ordenamiento_id WITH =, numero WITH =,
    coalesce(fraccion,'') WITH =, coalesce(inciso,'') WITH =,
    daterange(vigente_desde, vigente_hasta) WITH &&
  )   -- impide vigencias traslapadas del mismo precepto
);

-- ─────────────────────────────────────────── VECTORES

CREATE TABLE chunk_documento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id   uuid NOT NULL REFERENCES despacho(id),
  expediente_id uuid NOT NULL REFERENCES expediente(id),
  documento_id  uuid NOT NULL REFERENCES documento(id),
  pagina_inicio int NOT NULL,
  pagina_fin    int NOT NULL,
  texto         text NOT NULL,
  embedding     vector(1024) NOT NULL,
  tsv           tsvector GENERATED ALWAYS AS
                  (to_tsvector('spanish', texto)) STORED
);

CREATE TABLE chunk_norma (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  articulo_id   uuid NOT NULL REFERENCES norma_articulo(id),
  cita_corta    text NOT NULL,   -- 'LFT art. 47, fr. II' — se inserta literal en el escrito
  texto         text NOT NULL,
  vigente_desde date NOT NULL,
  vigente_hasta date,
  embedding     vector(1024) NOT NULL,
  tsv           tsvector GENERATED ALWAYS AS
                  (to_tsvector('spanish', texto)) STORED
);

CREATE INDEX ON chunk_documento USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON chunk_documento USING gin (tsv);
CREATE INDEX ON chunk_documento (despacho_id, expediente_id);
CREATE INDEX ON chunk_norma      USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON chunk_norma      USING gin (tsv);
CREATE INDEX ON chunk_norma      (vigente_desde, vigente_hasta);

-- ─────────────────────────────────────────── ESCRITOS Y AUDITORÍA

CREATE TABLE escrito (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id   uuid NOT NULL REFERENCES despacho(id),
  expediente_id uuid NOT NULL REFERENCES expediente(id),
  tipo          text NOT NULL,
  plantilla_id  uuid,
  estado        text NOT NULL DEFAULT 'borrador'  -- borrador | revisado | elaborado | presentado
);

CREATE TABLE escrito_version (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrito_id  uuid NOT NULL REFERENCES escrito(id),
  version     int  NOT NULL,
  contenido   jsonb NOT NULL,             -- documento TipTap
  autor_id    uuid NOT NULL REFERENCES usuario(id),
  generado_por_ia boolean NOT NULL,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escrito_id, version)
);

CREATE TABLE cita (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrito_ver_id  uuid NOT NULL REFERENCES escrito_version(id),
  clase           text NOT NULL,   -- norma | documento | criterio
  referencia      text NOT NULL,   -- 'LFT art. 47 fr. II'
  chunk_id        uuid,            -- el chunk del que salió. NULL = no verificable
  verificada      boolean NOT NULL DEFAULT false,
  verificada_en   timestamptz
);
-- Compuerta de exportación: no exporta si existe alguna cita con verificada = false.

CREATE TABLE bitacora (
  id          bigserial PRIMARY KEY,
  despacho_id uuid NOT NULL,
  usuario_id  uuid,
  entidad     text NOT NULL,
  entidad_id  uuid,
  accion      text NOT NULL,
  antes       jsonb,
  despues     jsonb,
  ocurrio_en  timestamptz NOT NULL DEFAULT now()
);
-- APPEND ONLY. Sin UPDATE ni DELETE, revocado a nivel de rol de base de datos.
```

### Row-level security

```sql
ALTER TABLE expediente ENABLE ROW LEVEL SECURITY;

CREATE POLICY aislamiento_despacho ON expediente
  USING (despacho_id = current_setting('app.despacho_id')::uuid);

-- Segmentación de maquila: un usuario solo ve asuntos de las firmas a las que pertenece
CREATE POLICY aislamiento_maquila ON expediente
  USING (
    EXISTS (
      SELECT 1 FROM asunto a
      WHERE a.id = expediente.asunto_id
        AND (a.origen = 'propio' OR a.firma_externa_id = ANY (
              string_to_array(current_setting('app.firmas'), ',')::uuid[]))
    )
  );
```

Repetir en **todas** las tablas con `despacho_id`. La prueba automatizada de aislamiento en CI es
obligatoria.

---

## 3. Estrategia de indexación

### 3.1 Normativa — un chunk por precepto, nunca por tokens

**Esta es la decisión más importante del RAG jurídico.** Partir la ley cada 800 tokens produce
chunks que empiezan a la mitad de una fracción y terminan a la mitad de otra: el modelo cita mal
y la cita no se puede verificar.

Regla:

- **1 artículo = 1 chunk.**
- Si el artículo excede ~1500 tokens, **1 fracción = 1 chunk**, repitiendo el encabezado del
  artículo al inicio de cada uno para que el chunk sea autosuficiente.
- Cada chunk lleva su `cita_corta` prearmada (`LFT art. 47, fr. II`), que es **exactamente el
  texto que se inserta en el escrito**. Así la cita nunca la redacta el modelo.
- Cada chunk lleva `vigente_desde` / `vigente_hasta`.

**Toda consulta normativa filtra por la fecha de los hechos del asunto:**

```sql
WHERE vigente_desde <= :fecha_hechos
  AND (vigente_hasta IS NULL OR vigente_hasta > :fecha_hechos)
```

Sin ese filtro, el sistema le va a citar al abogado la reforma de vacaciones de 2023 en un despido
de 2018. Es el bug jurídico más probable del proyecto.

### 3.2 Expediente — chunks que respetan la página

- Ventana de ~1000 tokens con 150 de solape, **cortando siempre en frontera de página**.
- Cada chunk guarda `pagina_inicio` y `pagina_fin`, para poder decir *"consta a foja 7"*.
- Encabezado sintético al inicio de cada chunk: `[Doc 07 · CFDI de nómina · 12-ago-2018 · p. 2]`.
  Mejora mucho la recuperación y le da al modelo con qué citar.
- **Solo se indexa lo validado.** Un documento con extracción sin confirmar no entra al índice.

### 3.3 Búsqueda híbrida

Léxica y vectorial en paralelo, fusionadas con **Reciprocal Rank Fusion**. En derecho la búsqueda
léxica es imprescindible: "artículo 923" o "prima de antigüedad" son cadenas exactas que un
embedding difumina.

```sql
WITH lexica AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank(tsv, q) DESC) AS r
  FROM chunk_norma, plainto_tsquery('spanish', :consulta) q
  WHERE tsv @@ q AND vigente_desde <= :fecha AND (vigente_hasta IS NULL OR vigente_hasta > :fecha)
  LIMIT 50
),
vectorial AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> :emb) AS r
  FROM chunk_norma
  WHERE vigente_desde <= :fecha AND (vigente_hasta IS NULL OR vigente_hasta > :fecha)
  LIMIT 50
)
SELECT id, SUM(1.0 / (60 + r)) AS score
FROM (SELECT * FROM lexica UNION ALL SELECT * FROM vectorial) u
GROUP BY id ORDER BY score DESC LIMIT 12;
```

Después, **reordenamiento** de los 12 candidatos con un modelo de reranking antes de armar el
contexto. Sube mucho la precisión y baja el costo de generación.

---

## 4. Pipeline de ingesta — Step Functions

```
Carga (URL prefirmada a S3)
   │
   ├─ 1. Validar tipo y tamaño · calcular sha256 · deduplicar
   ├─ 2. Textract asíncrono ──────────► ¿falló? → estado 'ocr_fallido' + ALERTA A HUMANO
   ├─ 3. Normalizar texto por página · guardar en documento_pagina
   ├─ 4. Clasificar tipo de documento        (LLM · schema estricto)
   ├─ 5. Extraer campos según el tipo        (LLM · schema estricto · confianza)
   ├─ 6. Emparejar con acuse POR CONTENIDO
   ├─ 7. ¿Confianza < umbral o campo crítico? → cola de validación humana
   │                                          └── no indexa hasta validarse
   ├─ 8. Chunking + embeddings → chunk_documento
   └─ 9. Notificar al responsable del expediente
```

**Reglas del pipeline:**

- Idempotente por `sha256`: reprocesar no duplica.
- Reintento con retroceso exponencial; después de 3 fallos, **alerta a persona**, no cola muerta
  silenciosa.
- Cada paso escribe en `bitacora`.
- El original en S3 no se toca en ningún paso.

---

## 5. Presupuesto de contexto para la generación

Contexto máximo por sección de escrito, para controlar costo y calidad:

| Fuente | Presupuesto | Nota |
|---|---|---|
| Datos estructurados del expediente | ~1500 tokens | Partes, fechas, salario, etapa. Del esquema, no del RAG |
| Tabla de contradicciones | ~800 tokens | Alegado vs documentado |
| Chunks del expediente | 6 chunks | Top tras reranking |
| Chunks normativos | 8 chunks | Filtrados por fecha de hechos |
| Bloques de la biblioteca del despacho | 2-3 bloques | Texto ya probado en tribunal |
| Plantilla de la sección | fijo | |

**Regla dura:** el modelo **solo** puede citar lo que está en ese contexto. Lo que no esté
recuperado, no existe.
# FASE 1 · Skills y pre-prompts

Cada skill es un archivo versionado en el repositorio, no una cadena de texto dentro del código.

```
src/prompts/
  _base.md                    Preámbulo común. Se antepone a TODOS
  clasificar-documento.md
  extraer-campos.md
  consulta-expediente.md
  tabla-contradicciones.md
  analisis-demanda.md
  redactar-seccion.md
  schemas/*.ts                Esquemas Zod de salida
```

**Reglas de implementación:**

- Todo skill devuelve **JSON validado con Zod**. Si no valida, se reintenta una vez y luego falla
  con alerta. Nunca se parsea texto libre.
- Todo skill se versiona (`v1`, `v2`) y la versión usada se guarda junto al resultado. Cuando se
  cambia un prompt, hay que saber qué salidas se produjeron con cuál.
- Cada skill tiene su **conjunto de evaluación**: 20 casos reales con salida esperada. Se corren
  en CI. Un cambio de prompt que baje la métrica no se mergea.
- Temperatura 0 para clasificación y extracción. Baja para redacción.

---

## `_base.md` — Preámbulo común

> Se antepone a todos los skills. Es el que contiene las reglas que no se negocian.

```markdown
Eres un asistente jurídico especializado en derecho laboral mexicano, integrado a una plataforma
de control de juicios de un despacho. Tu salida la revisa un abogado que firma bajo su
responsabilidad profesional.

# Reglas absolutas

1. NUNCA inventes datos. Si un dato no está en el material proporcionado, devuelve null o di
   explícitamente que no lo tienes. Un hueco visible es manejable; un dato inventado destruye el
   asunto.

2. NUNCA inventes ni aproximes registros: número de tesis, registro digital del Semanario Judicial
   de la Federación, época, instancia, número de expediente, toca o amparo. Ni "algo así", ni de
   ejemplo.

3. SOLO puedes citar preceptos que aparezcan literalmente en el CONTEXTO NORMATIVO que se te
   entrega. Si necesitas un artículo que no está ahí, dilo: "requiero el texto del artículo X".
   No lo cites de memoria.

4. NUNCA calcules fechas, plazos, vencimientos ni montos. Eso lo hace otro componente del sistema.
   Si un cálculo es necesario, señálalo como requerido y sigue.

5. Distingue siempre tres cosas y no las mezcles:
   - lo que CONSTA en el expediente,
   - lo que CONVIENE argumentar,
   - lo que HAY QUE PROBAR.

6. Etiqueta la certeza cuando haya riesgo de confusión:
   - `verificado` — consta en un documento del expediente, con su referencia.
   - `por_verificar` — hay que corroborarlo antes de usarlo en un escrito.
   - `supuesto` — hipótesis de trabajo. Un supuesto NUNCA pasa a un escrito.

7. Cada afirmación relevante debe traer su fuente: id del chunk, documento y página.

# Contexto del asunto

- Régimen procesal: {{regimen}}
  - `junta`: Junta de Conciliación y Arbitraje. Aplica la LFT anterior a la reforma del
    1 de mayo de 2019. Audiencia trifásica. La resolución se llama LAUDO.
  - `tribunal`: Tribunal Laboral del Poder Judicial. Aplica la LFT reformada. Conciliación
    prejudicial obligatoria, audiencia preliminar y audiencia de juicio. La resolución se llama
    SENTENCIA.
  Usa el vocabulario que corresponda. Nunca "laudo" en régimen de tribunal ni al revés.

- Lado: {{lado}} (`patronal` o `trabajador`). Determina la teoría del caso, la carga probatoria
  y las excepciones. No lo inviertas ni lo supongas.

- Fecha de los hechos: {{fecha_hechos}}. La ley aplicable es la vigente a esa fecha, no la de hoy.

- Autoridad: {{autoridad}} · {{entidad}}

# Formato

Responde ÚNICAMENTE con el JSON que pide el esquema. Sin texto antes ni después, sin markdown
alrededor del JSON.
```

---

## `clasificar-documento`

**Propósito.** Determinar qué es el documento recién digitalizado.
**Entrada.** Primeras 3 páginas de texto OCR + número total de páginas.
**Modelo.** El más económico disponible. Temperatura 0.

```markdown
Clasifica el documento según su naturaleza procesal.

TIPOS PERMITIDOS
demanda · contestacion · acuerdo_tramite · notificacion · emplazamiento · laudo · sentencia ·
promocion · acuse_presentacion · exhorto · oficio · dictamen_pericial · contrato_individual ·
recibo_nomina_cfdi · control_asistencia · reglamento_interior · acta_administrativa · convenio ·
poder_carta_poder · constancia_conciliacion · acta_inspeccion · resolucion_sancionatoria ·
identificacion · comprobante_domicilio · otro

CRITERIOS
- `acuse_presentacion`: trae sello de recibido, folio, fecha y hora de una autoridad. Suele ser
  de 1 a 2 páginas y reproduce la primera hoja del escrito presentado.
- `acuerdo_tramite`: resolución de trámite firmada por el tribunal o la junta. No resuelve el fondo.
- Distingue `laudo` (Junta) de `sentencia` (Tribunal Laboral) por el órgano que la emite.

REGLAS
- Si dudas entre dos tipos, elige el más probable y baja la confianza. No inventes un tipo nuevo.
- Si el OCR es ilegible, devuelve tipo `otro` con confianza 0 y explica por qué.
```

**Esquema de salida**

```ts
z.object({
  tipo: z.enum([...TIPOS]),
  confianza: z.number().min(0).max(1),
  numero_expediente: z.string().nullable(),
  autoridad_mencionada: z.string().nullable(),
  fecha_documento: z.string().date().nullable(),
  razonamiento: z.string().max(300),
})
```

---

## `extraer-campos`

**Propósito.** Sacar los datos duros. **Es el skill donde más daño puede hacer una alucinación.**
**Entrada.** Texto OCR completo + tipo de documento + catálogo de campos esperados para ese tipo.

```markdown
Extrae ÚNICAMENTE los campos solicitados del documento.

REGLA CENTRAL, POR ENCIMA DE TODO
Si un campo no aparece explícitamente en el texto, devuelve null. NO lo infieras, NO lo estimes,
NO lo completes con lo que sería razonable. Un salario mal extraído se convierte en una
liquidación mal calculada que se convierte en un convenio firmado por una cifra equivocada.

PARA CADA CAMPO DEVUELVE
- valor: tal como aparece en el documento, sin normalizar
- valor_normalizado: fechas en ISO 8601, montos como número decimal sin símbolo ni separadores
- confianza: 0 a 1
- pagina: dónde lo encontraste
- cita_textual: el fragmento exacto del que lo tomaste, máximo 200 caracteres

CUIDADOS ESPECÍFICOS
- Fechas: distingue fecha del documento, fecha de notificación, fecha de los hechos y fecha de
  presentación. Son distintas y confundirlas produce un plazo mal calculado. Si el documento no
  precisa cuál es, marca confianza baja y dilo en `nota`.
- Montos: distingue salario diario, salario diario integrado, salario mensual y salario quincenal.
  NO conviertas entre ellos. Devuelve lo que dice el documento.
- Nombres: transcribe literal, con los dos apellidos. No corrijas ortografía ni completes.
- Números de expediente: literal, con su año y sufijos ("109/2025-P.O.", "1146/2022").
```

**Esquema de salida**

```ts
z.object({
  campos: z.array(z.object({
    campo: z.string(),
    valor: z.string().nullable(),
    valor_normalizado: z.union([z.string(), z.number()]).nullable(),
    confianza: z.number().min(0).max(1),
    pagina: z.number().int().nullable(),
    cita_textual: z.string().max(200).nullable(),
    nota: z.string().nullable(),
  })),
  campos_no_encontrados: z.array(z.string()),
})
```

**Post-proceso obligatorio en código, no en el prompt:**

- Campo con `confianza < umbral` → `valor = null` y a cola de validación humana.
- Campo marcado `critico` en la tabla `extraccion` → siempre a validación humana, sin importar la
  confianza.
- `cita_textual` debe existir realmente en el texto OCR. **Si no aparece, se descarta el campo y
  se registra el incidente**: es una alucinación detectada, y hay que medirla.

---

## `consulta-expediente`

**Propósito.** El chat de `/app/expedientes/[id]/consulta`.
**Entrada.** Pregunta + chunks del expediente + chunks normativos filtrados por fecha de hechos.

```markdown
Responde la pregunta del abogado usando EXCLUSIVAMENTE el contexto proporcionado.

ESTRUCTURA DE LA RESPUESTA
1. Respuesta directa, primero. Sin preámbulos.
2. Fundamento, después.
3. Si falta un dato para responder bien, dilo explícitamente y pídelo.

CITACIÓN OBLIGATORIA
- Todo dato del expediente se cita como [doc:{documento_id}:{pagina}]
- Todo precepto se cita como [norma:{chunk_id}] y se escribe con la `cita_corta` del chunk,
  tal cual, sin reformularla.
- Prohibido citar cualquier cosa que no esté en el contexto.

SI NO HAY FUNDAMENTO EN EL CONTEXTO
Responde exactamente: "No lo tengo en el expediente." y di qué documento haría falta.
NO completes con conocimiento general. NO digas "generalmente en estos casos".

TONO
Directo y técnico. Le hablas a un abogado laboralista con veinte años de práctica. No expliques
qué es un finiquito ni qué dice el artículo 47 salvo que te lo pregunten.
```

**Salida:** texto en streaming con marcadores de cita, más un arreglo de `citas` para renderizar
los chips clicables. **Validador:** todo marcador debe corresponder a un chunk realmente
recuperado; si no, se elimina la oración y se registra el incidente.

---

## `tabla-contradicciones`

**Propósito.** La pantalla que más valor entrega por unidad de esfuerzo.
**Entrada.** Hechos y prestaciones de la demanda + campos extraídos de los documentos del cliente.

```markdown
Cruza lo que AFIRMA la contraparte contra lo que CONSTA en los documentos del cliente.

Para cada dato comparable devuelve un renglón. Compara al menos:
fecha de ingreso · fecha de terminación · causa de la baja · salario diario · puesto y categoría ·
jornada y horario · identidad del patrón · centro de trabajo · prestaciones pagadas

REGLAS
- Solo comparas datos que EXISTEN en ambos lados. Si falta uno, el renglón va con
  `estado: "falta_documento"` y dices qué documento se necesita.
- La columna "consta" SIEMPRE lleva su fuente: documento y página.
- Calcula la magnitud de la discrepancia solo cuando sea una división directa (por ejemplo,
  $400 contra $120 = 3.33×). No hagas ninguna otra aritmética.
- NO opines sobre quién tiene razón. Solo expones la discrepancia.
- Ordena los renglones por relevancia: primero salario, después fecha y causa de terminación,
  después el resto. Son las que más valen en un juicio.
```

**Esquema de salida**

```ts
z.object({
  renglones: z.array(z.object({
    dato: z.string(),
    alega_contraparte: z.string().nullable(),
    consta_documento: z.string().nullable(),
    fuente_documento_id: z.string().uuid().nullable(),
    fuente_pagina: z.number().int().nullable(),
    magnitud: z.string().nullable(),
    estado: z.enum(['contradiccion','coincide','falta_documento']),
    documento_requerido: z.string().nullable(),
  })),
})
```

---

## `analisis-demanda`

**Propósito.** El mapa del asunto que el abogado lee antes de decidir la estrategia.

```markdown
Analiza la demanda y produce el mapa del asunto desde el lado {{lado}}.

DEVUELVE
1. Prestaciones reclamadas, una por una, con el monto reclamado si lo hay.
2. Hechos que sostienen cada prestación, con la foja donde constan.
3. Para cada hecho: sobre quién recae la carga de la prueba conforme al régimen {{regimen}}, y con
   qué se probaría o se desvirtuaría.
4. Defensas y excepciones disponibles, con el precepto que las sustenta —solo si el precepto está
   en el CONTEXTO NORMATIVO—.
5. Documentos que hay que pedirle al cliente, en orden de importancia.
6. Puntos débiles de NUESTRA posición. Sé franco: un análisis que solo dice lo bueno no sirve.

NO HAGAS
- No calcules montos ni plazos.
- No cites jurisprudencia. Ese módulo es de otra fase.
- No propongas estrategia procesal definitiva: eso lo decide el abogado. Tú expones el terreno.

FORMATO
Conclusión y decisión requerida arriba. Desarrollo abajo. El director lee desde el teléfono.
```

---

## `redactar-seccion`

**Propósito.** El generador de escritos. **Se invoca UNA VEZ POR SECCIÓN, nunca por el escrito
completo.** Un escrito generado de un tirón es imposible de controlar y de regenerar por partes.

**Secciones, en orden:** `proemio` · `personalidad` · `hechos` · `excepciones` · `pruebas` ·
`petitorios`

```markdown
Redacta ÚNICAMENTE la sección «{{seccion}}» del escrito de tipo «{{tipo_escrito}}».

MATERIAL DISPONIBLE
- ESTRUCTURA DE LA SECCIÓN: {{plantilla_seccion}}
- DATOS DEL EXPEDIENTE: {{datos_estructurados}}
- TABLA DE CONTRADICCIONES: {{contradicciones}}
- CONTEXTO DOCUMENTAL: {{chunks_expediente}}
- CONTEXTO NORMATIVO (vigente al {{fecha_hechos}}): {{chunks_norma}}
- BLOQUES DE LA BIBLIOTECA DEL DESPACHO: {{bloques}}

REGLAS DE REDACCIÓN
1. Respeta la estructura de la plantilla. No inventes apartados nuevos.
2. Prefiere los bloques de la biblioteca del despacho cuando apliquen: son texto ya probado en
   tribunal y llevan la voz de la casa. Adáptalos al caso, no los reescribas de cero.
3. Cita preceptos SOLO del contexto normativo, y escríbelos con la `cita_corta` del chunk, literal.
4. Cada hecho afirmado debe apoyarse en un documento del contexto. Marca su estado:
   `verificado` con su fuente, o `por_verificar`.
5. Si necesitas afirmar algo que no consta en ningún documento, NO lo redactes: devuélvelo en
   `datos_faltantes` y sigue con el resto de la sección.
6. Vocabulario según el régimen {{regimen}}. Laudo o sentencia, según corresponda.
7. Español jurídico mexicano, tercera persona, tiempo presente para las afirmaciones procesales.
8. Sin adjetivos innecesarios y sin retórica. Un escrito se lee para encontrar el argumento.

PROHIBIDO
- Citar jurisprudencia, tesis o registros digitales. En esta fase el sistema no los tiene.
- Calcular montos, fechas o plazos. Si la sección los requiere, déjalos como marcador
  {{CALCULO_PENDIENTE:concepto}} y anótalo en `calculos_requeridos`.
- Afirmar cualquier cosa que no esté en el material.
```

**Esquema de salida**

```ts
z.object({
  seccion: z.string(),
  bloques: z.array(z.object({
    texto: z.string(),
    origen: z.enum(['plantilla','biblioteca','generado']),
    origen_id: z.string().nullable(),
    estado_verificacion: z.enum(['verificado','por_verificar','supuesto']),
    fuentes: z.array(z.object({
      clase: z.enum(['documento','norma']),
      id: z.string(),
      pagina: z.number().int().nullable(),
      cita_corta: z.string().nullable(),
    })),
  })),
  datos_faltantes: z.array(z.string()),
  calculos_requeridos: z.array(z.string()),
})
```

---

## `instruccion-del-abogado` — cómo entra tu prompt

El abogado escribe una instrucción antes de generar: *"contesta negando el despido y alega
separación voluntaria, apóyate en los CFDI"*. Así se maneja:

```
mensajes = [
  { rol: "system",  contenido: _base.md + redactar-seccion.md },   ← reglas duras
  { rol: "user",    contenido: CONTEXTO (expediente + leyes + bloques) },
  { rol: "user",    contenido: "INSTRUCCIÓN DEL ABOGADO:\n" + instruccion }
]
```

**Reglas de implementación:**

1. La instrucción viaja como **mensaje de usuario**, nunca concatenada al prompt de sistema.
2. **Las reglas duras ganan siempre.** Si la instrucción pide citar una tesis que no está
   verificada, o calcular un monto, o afirmar un hecho que no consta, el sistema **no obedece**:
   lo devuelve en `instrucciones_no_atendidas` con el motivo. Nunca falla en silencio ni
   obedece a medias.
3. La instrucción se **guarda junto a la versión del escrito** (`escrito_version.instruccion`),
   con la versión del prompt usada. Sin eso no se puede reproducir ni depurar una salida mala.
4. **Instrucciones guardadas**: las que funcionan se archivan como plantillas reutilizables por
   tipo de escrito. Con el tiempo esa biblioteca vale más que el modelo.

Se agrega al esquema de salida de `redactar-seccion`:

```ts
instrucciones_no_atendidas: z.array(z.object({
  pedido: z.string(),
  motivo: z.enum(['cita_no_verificada','calculo_prohibido','dato_no_consta','fuera_de_alcance']),
}))
```

---

## Validador de citas — **código, no prompt**

Corre después de cada generación y antes de cualquier exportación. Es la compuerta que hace
cumplir la regla 3 del dominio.

```
para cada cita del escrito:
  1. ¿el chunk_id existe y fue realmente recuperado en esta generación?   si no → INVÁLIDA
  2. ¿la cita_corta coincide con la del chunk?                            si no → INVÁLIDA
  3. ¿el chunk estaba vigente a la fecha_hechos del asunto?               si no → INVÁLIDA
  4. si es cita documental: ¿existe el documento y la página?             si no → INVÁLIDA

si hay alguna INVÁLIDA:
  - se marca en rojo en el editor con el motivo
  - SE BLOQUEA LA EXPORTACIÓN
  - se registra en bitácora como incidente de alucinación

si hay algún bloque con estado 'supuesto':
  - SE BLOQUEA LA EXPORTACIÓN hasta que se resuelva o se elimine
```

**No existe un botón para saltarse esta compuerta.** Ni para el administrador. Una tesis o un
artículo inventado alegado en audiencia cuesta el asunto y la credibilidad de la firma; ese riesgo
no se delega a la disciplina del usuario.

---

## Evaluación continua

| Skill | Métrica | Umbral para mergear |
|---|---|---|
| `clasificar-documento` | Exactitud sobre 50 documentos reales etiquetados | ≥ 90% |
| `extraer-campos` | Precisión en campos críticos · **y tasa de alucinación** | ≥ 95% precisión · **0% alucinación** |
| `consulta-expediente` | Respuestas con cita válida · abstención correcta cuando no hay fuente | ≥ 95% · ≥ 90% |
| `tabla-contradicciones` | Contradicciones reales detectadas sobre 20 expedientes | ≥ 90% |
| `redactar-seccion` | Minutos de edición hasta presentable · citas inválidas | ≤ 30 min · **0** |

La tasa de alucinación es la métrica que manda. **Una sola alucinación aceptada por el sistema en
el conjunto de evaluación reprueba el cambio**, aunque todo lo demás mejore.
# FASE 2 · Jurisprudencia
### 6 semanas · abre cuando la fase 1 pase su compuerta

**Objetivo:** que el sistema pueda buscar criterios del Semanario Judicial de la Federación,
**verificarlos contra la fuente** e insertarlos en los escritos — sin que jamás pueda entrar uno
inexistente.

> **Por qué es fase aparte y no parte del MVP.** Una tesis inventada, alegada en audiencia, cuesta
> el asunto y la credibilidad de la firma. Esta fase no se abre hasta que el pipeline documental y
> el validador de citas de la fase 1 estén probados.

---

## 1. Modelo de datos

```sql
CREATE TABLE criterio (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_digital  text UNIQUE NOT NULL,   -- la llave real. Ej. '2028142'
  numero_tesis      text,                   -- Ej. '2a./J. 4/2024'
  rubro             text NOT NULL,
  texto             text NOT NULL,
  tipo              text NOT NULL,          -- jurisprudencia | aislada
  instancia         text NOT NULL,          -- Pleno | Primera Sala | Segunda Sala | Plenos Regionales | TCC
  epoca             text NOT NULL,
  materia           text[],                 -- laboral, constitucional, administrativa...
  fuente            text,                   -- Semanario / Gaceta, libro, tomo, página
  fecha_publicacion date,
  precedentes       text,
  vigente           boolean NOT NULL DEFAULT true,
  sustituida_por    text,                   -- registro digital que la superó
  url_fuente        text NOT NULL,
  verificado_en     timestamptz NOT NULL,
  verificado_metodo text NOT NULL           -- ingesta_oficial | consulta_directa
);

CREATE TABLE chunk_criterio (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterio_id  uuid NOT NULL REFERENCES criterio(id),
  texto        text NOT NULL,
  embedding    vector(1024) NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('spanish', texto)) STORED
);

-- Biblioteca del despacho: criterios ya usados, con su resultado
CREATE TABLE criterio_uso (
  criterio_id  uuid NOT NULL REFERENCES criterio(id),
  despacho_id  uuid NOT NULL,
  expediente_id uuid,
  resultado    text,      -- acogido | desestimado | sin_pronunciamiento
  nota         text,
  PRIMARY KEY (criterio_id, despacho_id, expediente_id)
);
```

**Regla de modelado:** el `registro_digital` es la llave primaria natural. **Un criterio sin
registro digital no entra a la base.** Punto.

---

## 2. Ingesta

`[POR VERIFICAR]` **La vía de ingesta hay que confirmarla antes de diseñar.** El despacho consulta
hoy el SJF por navegador. Antes de codificar, verificar si existe una vía oficial de descarga
masiva o si hay que consultar por criterio. **No asumir la existencia de una API pública ni
raspar sin revisar términos de uso.**

Diseñar el ingestor con un **puerto abstracto** (`FuenteCriterios`) para que la implementación
concreta se pueda cambiar sin tocar el resto:

```
FuenteCriterios.buscar(consulta, filtros)  → lista de registros digitales
FuenteCriterios.obtener(registro_digital)  → criterio completo + url_fuente
```

Alcance de la carga inicial: criterios en **materia laboral** de la Décima y Undécima Época, más
los administrativos relevantes para inspección del trabajo y los de seguridad social.

---

## 3. El servicio de verificación — el corazón de esta fase

```
verificarCriterio(registro_digital, rubro_citado) →
  { existe, rubro_coincide, vigente, sustituida_por, url_fuente, consultado_en }
```

**Reglas:**

1. Ningún criterio se inserta en un escrito sin pasar por aquí.
2. La verificación **caduca**: un criterio verificado hace más de 90 días se vuelve a verificar
   antes de usarse. Los criterios se superan y se sustituyen.
3. Si el servicio de verificación no está disponible, **no se inserta la cita**. El sistema no
   degrada a "confío en lo que tengo en base". Se le dice al abogado que no se pudo verificar.
4. Si el criterio fue sustituido, se avisa **y se ofrece el que lo sustituyó**.
5. Se registra en bitácora cada verificación, con fecha y resultado. Eso es lo que permite
   defender después que la cita se corroboró.

**Alerta retroactiva:** cuando un criterio usado en un escrito ya presentado resulta sustituido o
superado, el sistema avisa al responsable del expediente. Ese aviso vale por sí solo lo que cuesta
la fase.

---

## 4. Integración con la redacción

Se amplía `redactar-seccion` (fase 1) con contexto de criterios:

```markdown
CONTEXTO JURISPRUDENCIAL (ya verificado, {{fecha_verificacion}}): {{chunks_criterio}}

REGLAS ADICIONALES
- Solo puedes invocar criterios de este contexto.
- Escribe la cita con el formato exacto que trae el criterio: rubro, número de tesis y
  registro digital. NO la reformules ni la abrevies.
- Si un criterio te parece aplicable pero no está en el contexto, NO lo cites: devuélvelo en
  `criterios_sugeridos` describiendo qué tesis buscarías. El abogado decide si se busca.
- Un criterio de instancia inferior o de otra materia no sirve como si fuera obligatorio.
  Señala la instancia al usarlo.
```

El validador de citas de la fase 1 se amplía con un cuarto control: **el registro digital debe
existir en `criterio` y estar verificado dentro de los últimos 90 días.** Si no, bloquea la
exportación, igual que con la normativa.

---

## 5. Rutas nuevas

```
/app/jurisprudencia                    Búsqueda híbrida de criterios
/app/jurisprudencia/[registro]         Ficha del criterio, con estado de vigencia
/app/biblioteca/criterios              Los que el despacho ya usó, con su resultado
/app/expedientes/[id]/criterios        Criterios aplicables al asunto, sugeridos y guardados
```

---

## 6. Compuerta de salida

100 citas verificadas contra la fuente, **cero falsos positivos**.

**Una sola cita inexistente aceptada por el sistema reprueba la fase completa**, aunque las otras
99 estén bien. La prueba se hace con un conjunto que incluye registros digitales falsos
deliberadamente inyectados: el sistema tiene que rechazarlos todos.

---

# FASE 3 · El reloj — plazos y Google Calendar
### 8 semanas

**Objetivo:** que el sistema calcule los vencimientos solo y los ponga en la agenda del equipo.

## Modelo

```sql
CREATE TABLE regla_computo (          -- MANTENIDA POR EL ÁREA JURÍDICA, NO POR EL CÓDIGO
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version         text NOT NULL,
  regimen         text NOT NULL,      -- junta | tribunal | amparo | administrativo
  tipo_plazo      text NOT NULL,      -- contestar | ofrecer_pruebas | recurrir | cumplir_prevencion
  modalidad_notif text,               -- personal | boletin | estrados | buzon_electronico
  dias            int  NOT NULL,
  tipo_dias       text NOT NULL,      -- habiles | naturales
  desplazamiento_surtimiento int NOT NULL DEFAULT 0,
  fundamento      text NOT NULL,      -- ordenamiento, artículo, fracción
  vigente_desde   date NOT NULL,
  vigente_hasta   date
);

CREATE TABLE calendario_inhabil (     -- POR AUTORIDAD. NO HAY CALENDARIO NACIONAL ÚNICO
  autoridad_id uuid NOT NULL REFERENCES autoridad(id),
  fecha        date NOT NULL,
  motivo       text NOT NULL,         -- descanso_obligatorio | vacaciones | acuerdo_suspension
  fuente       text NOT NULL,         -- acuerdo, número y fecha de publicación
  verificado_por uuid, verificado_el timestamptz,
  PRIMARY KEY (autoridad_id, fecha)
);
```

## El motor

```
calcularVencimiento(regimen, autoridad_id, tipo_plazo, modalidad_notif,
                    fecha_notificacion, version_reglas)
  → { fecha_surtimiento, primer_dia_computo,
      dias_habiles_contados: [cada día contado, uno por uno],
      fecha_vencimiento, hora_limite, traza: [cada regla aplicada con su fundamento] }
```

**Reglas duras:**

- **Código determinista con pruebas unitarias. Cero LLM.** El modelo extrae la fecha; la
  aritmética la hace el motor.
- **`traza` no es opcional.** El abogado tiene que poder abrir el vencimiento y leer cada día
  contado. Sin traza, el número no es confiable y el sistema no sirve.
- Marco de referencia: días hábiles y descansos obligatorios (arts. 733 y 74 LFT), inicio del
  cómputo al día hábil siguiente al surtimiento (art. 735 LFT), notificaciones (arts. 742 a 752
  LFT). En amparo, arts. 17, 18 y 19 de la Ley de Amparo. **La tabla artículo por artículo la
  entrega el despacho. No la deduzcan.**
- **Husos horarios reales:** BCS no comparte huso con Jalisco. Todo en UTC, mostrado en la zona
  de la autoridad.
- **Recálculo en cascada** al corregir una fecha o al aparecer un acuerdo de suspensión, con
  aviso del antes y el después. Nunca en silencio.
- Ante ambigüedad, **siempre la interpretación más conservadora**: la fecha más temprana. Y avisa.
- **Ningún plazo se borra.** Se cierra con acuse o se marca no aplicable con motivo y autor.

## Google Calendar

- OAuth por usuario. Sincronización **bidireccional**: si mueven el evento en Calendar, el sistema
  se entera y pregunta.
- Cada evento lleva asunto, expediente, autoridad, plaza, qué se hace, responsable **titular y
  suplente**, y liga al expediente.
- Alertas escalonadas `T-15 · T-7 · T-3 · T-1 · día · vencido sin acuse`, por el canal que la gente
  sí lee. Sin avance a `T-3`, escala al director.
- **Detección de choques entre plazas** considerando traslado, y carga por abogado.
- **Vigilancia de la cadena previa:** la alerta útil no es "vence el martes", es *"vence el martes
  y no existe ni un borrador"*.

## Rutas nuevas

```
/app/agenda                      Calendario del despacho
/app/agenda/carga                Carga por abogado y por plaza, con choques
/app/admin/reglas-computo        Tabla de reglas, versionada
/app/admin/calendarios           Días inhábiles por autoridad
/app/plazos/[id]                 Detalle con la TRAZA del cómputo, día por día
```

## Compuerta de salida

**Backtesting: 100 expedientes históricos reales, 100% de los vencimientos reproducidos.** No 95%.
Cada discrepancia se analiza hasta encontrar la regla faltante. Mientras no pase, el motor no
calcula plazos en producción.

---

# FASES 4 y 5
### 8 semanas cada una

## Fase 4 · Vigilancia y cálculo

**Vigilancia externa.** Un conector por autoridad para boletines y estrados electrónicos, con
contrato común. Revisión diaria de toda autoridad donde haya expediente. Expediente electrónico
donde exista, con credenciales en bóveda de secretos.

> **La regla que define esta fase:** *"cero resultados"* y *"no se ejecutó"* son estados distintos.
> Un conector que falla en silencio una semana es un plazo perdido. Idempotencia, reintento con
> retroceso exponencial, escalamiento a persona tras N fallos, y evidencia cruda guardada de cada
> lectura para poder acreditar que sí se revisó ese día.

**Vigilancia normativa.** DOF por su API oficial —el sitio es inestable, no raspar la página— y
criterios nuevos del SJF. Alimenta el boletín a clientes.

**Riesgo cruzado entre expedientes hermanos.** Cuando aparece un acuerdo en un frente con juicios
paralelos, revisar si afecta a los hermanos y alertar. Lo que se resuelve en un expediente puede
invocarse como hecho notorio en otro, incluso en contra.

**Motor de cálculo — determinista, nunca LLM.** Salario diario integrado (arts. 84 y 89 LFT) ·
indemnización y salarios caídos con su tope e intereses (arts. 48 y 50 LFT) · prima de antigüedad
con su tope (art. 162 LFT) · aguinaldo (art. 87 LFT) · vacaciones y prima vacacional (arts. 76 y
80 LFT) · PTU. Con desglose línea por línea, fundamento por concepto, **supuestos declarados arriba
del cálculo**, tablas históricas de salario mínimo y UMA con fuente, y versionado por fecha de los
hechos. Tres escenarios: mínimo defendible, probable y peor caso.

## Fase 5 · Despacho y cliente

Tablero directivo con exposición económica agregada por cliente y total · reportes de estado en
lenguaje de negocio · boletín a clientes desde la vigilancia normativa · portal de cliente de solo
lectura y segmentado · cobranza ligada al asunto · productividad y carga por abogado.

**Regla que gobierna toda la fase:** ningún mensaje sale a un cliente o a un tercero sin aprobación
humana explícita, registrada, con nombre y hora. **No hay envío automático.** Y la contingencia
económica estimada es información interna: no se publica en el portal del cliente.

---

# Anexo · Reglas duras para el repositorio

Pegar como `CLAUDE.md` en la raíz del proyecto de la aplicación.

```markdown
# Plataforma de juicios laborales — reglas del dominio

Antes de escribir código en este repositorio:

1. NADA FALLA EN SILENCIO. "Cero resultados" y "no se ejecutó" son estados distintos.
2. CERO ARITMÉTICA JURÍDICA CON LLM. Fechas, plazos y montos: código determinista con pruebas
   y con traza abrible.
3. CERO CITA SIN VERIFICAR. Ningún artículo ni criterio entra a un escrito sin coincidir con el
   texto recuperado. Si no verifica, no se inserta y el documento no exporta. No hay override.
4. EL ORIGINAL NUNCA SE MODIFICA. El archivo tal como entró se conserva íntegro. S3 con
   versionado y Object Lock.
5. EL ABOGADO FIRMA, NO LA MÁQUINA. El sistema no presenta, no firma y no envía a terceros.

## Invariantes de datos

- `expediente.regimen` y `asunto.lado` son NOT NULL y sin valor por defecto.
- `asunto.fecha_hechos` filtra TODA consulta normativa. Sin ese filtro se cita ley que no aplicaba.
- Un chunk normativo = un artículo (o una fracción). Nunca partido por conteo de tokens.
- Row-level security por `despacho_id` y por `firma_id` en todas las tablas. Hay prueba de
  aislamiento en CI: si pasa una fuga, el build falla.
- `bitacora` es append-only. UPDATE y DELETE revocados a nivel de rol de base de datos.
- Sobre `plazo` no existe DELETE. Se cierra con acuse o se marca no aplicable con motivo y autor.
- Cinco fechas por acto procesal, nunca una: acuerdo, publicación, notificación, surtimiento,
  primer día de cómputo.

## Al tocar prompts

Viven en `src/prompts/*.md`, versionados. Cada cambio corre su conjunto de evaluación en CI.
La tasa de alucinación es la métrica que manda: una sola alucinación aceptada reprueba el cambio,
aunque todo lo demás mejore.
```

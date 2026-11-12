/**
 * Seed idempotente de las publicaciones editoriales.
 *
 * Uso: `npm run seed:publications`
 *
 * Inserta seis articulos reales (tres rutas de saga, una guia de compra, un
 * analisis y una noticia) y los vinculos con los juegos del catalogo.
 *
 * Es idempotente: las publicaciones se localizan por `slug` y se hace
 * `ON CONFLICT (slug) DO UPDATE`, de modo que reejecutarlo actualiza el
 * contenido sin duplicar filas.
 *
 * La saga se enlaza por slug (`like-a-dragon`). Si la saga no existe, el
 * seed la crea con `ON CONFLICT DO NOTHING`; si el catalogo esta vacio, la
 * publicacion se guarda con `franchise_id = NULL` y los vinculos con juegos
 * se omiten, sin fallar.
 */
import { config } from 'dotenv';
import { Pool, type PoolClient } from 'pg';

config();

type PublicationCategory = 'guia' | 'ruta' | 'analisis' | 'noticia';

interface SeedPublication {
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  body: string;
  category: PublicationCategory;
  coverUrl: string | null;
  authorName: string;
  readingMinutes: number;
  /** Slug de la saga a la que pertenece (opcional). */
  franchiseSlug: string | null;
  /** Slugs de los juegos del catalogo relacionados. */
  relatedGameSlugs: string[];
  /** Fecha de publicacion (ISO). */
  publishedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

const FRANCHISE = {
  name: 'Like a Dragon',
  slug: 'like-a-dragon',
  description:
    'Saga de drama criminal en Japon. El hilo conductor es Kazuma Kiryu ' +
    'y la familia Majima, desde las calles de Kamurocho hasta los ' +
    'archipielagos del mar de Palpa.',
};

const PUBLICATIONS: SeedPublication[] = [
  {
    slug: 'como-empezar-la-saga-like-a-dragon',
    title: 'Como empezar la saga Like a Dragon sin perderte',
    subtitle: 'La ruta corta para entrar por la puerta correcta',
    excerpt:
      'Hay una forma facil de arruinar la saga Like a Dragon: empezar por el ' +
      'numero uno. Te explicamos por que Yakuza 0 va primero y como seguir ' +
      'la linea cronologica sin perder el hilo.',
    body: `## El error clasico

Casi todo el mundo llega a Like a Dragon por el titulo mas reciente, ve el
nombre "Like a Dragon: Infinite Wealth" en una oferta y lo compra. Es un
error, y no porque el juego sea malo: es porque la saga no esta escrita para
empezar ahi.

La serie cuenta una historia muy larga con muchos personajes. Si entras por
el final, no reconoces a nadie, no entiendes por que Kiryu tiene tanto
carisma y te pierdes la mitad de las referencias. Si entras por el principio,
la historia te atrapa.

## Por que Yakuza 0 va primero

Yakuza 0 es la prehistoria de la saga. Ocurre un ano antes que el primer
Yakuza y presenta a dos personajes que despues son centrales:

- **Kazuma Kiryu**, aun sin ser leyenda de Kamurocho.
- **Goro Majima**, antes de convertirse en el personaje carismatico que
  todos recuerdan.

El juego tiene su propia identidad (es el unico de la saga centrado en la gestion de
negocios: destinos turisticos, zonas de juego y empleados con
historia propia en Kamurocho) y ademas
sienta las bases del combate callejero, el sistema de Heat y la relacion
entre Kiryu y la familia Majima. Todo lo que viene despues assumes que ya
conoces esa dinamica.

## La ruta recomendada

1. **Yakuza 0** - el origen de todo.
2. **Yakuza 1** - Kiryu vuelve a Kamurocho y empieza su viaje.
3. **Yakuza 2** - Ryuji Goda y el comienzo del Goro Majima.
4. **Yakuza 3** - el regreso de Kiryu y el Majima dual.
5. **Yakuza 4** - cuatro protagonistas en Tokio.
6. **Yakuza 5** - Kiryu desaparece cinco anos y vuelve.
7. **Yakuza 6** - el capitulo mas emocional, en un Japon reconstruido.
8. **Like a Dragon: Ishin** - espinela en la era Meiji; explica el origen
   de Kiryu. Se puede jugar en cualquier momento.
9. **Like a Dragon (2017)** - Kiryu entra en el mundo criminal moderno.
10. **Like a Dragon: Infinite Wealth** - la saga cambia de protagonista.

## Si tienes poco tiempo

Si solo vas a jugar uno, juega **Yakuza 0**. Si tienes cuatro o cinco horas
y dudas, **Yakuza 1** con su hd remasterizado sigue siendo una entrada
perfecta: la historia engancha, los combates son razonables y el mapa es
pequeno. A partir de ahi, ya tienes el contexto para todo lo demas.

## Sobre el remate

Infinite Wealth cambia el protagonista y es el juego mas largo de la saga.
Llega a el cuando ya tengas la relacion con Kiryu y Majima bien
asentada; es la recompensa, no el punto de partida.`,
    category: 'ruta',
    coverUrl:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2988580/aaceda0f5c16fce191e63f7342d07323e86a1156/header.jpg',
    authorName: 'Equipo GoRoDeals',
    readingMinutes: 7,
    franchiseSlug: 'like-a-dragon',
    relatedGameSlugs: [
      'yakuza-0',
      'yakuza-1',
      'yakuza-2',
      'like-a-dragon-ishin',
      'like-a-dragon-infinite-wealth',
    ],
    publishedAt: '2026-02-10T09:00:00.000Z',
    seoTitle: 'Como empezar la saga Like a Dragon: la ruta en orden',
    seoDescription:
      'Yakuza 0 va primero. Esta es la ruta completa de la saga Like a Dragon ' +
      'en orden recomendado, con el porque de cada salto.',
  },
  {
    slug: 'por-que-empezar-resident-evil',
    title: 'Por donde empezar la saga de Resident Evil',
    subtitle: 'El punto de entrada ideal y las rutas alternativas',
    excerpt:
      'La serie original en PlayStation, el remake de RE2 y el reboot de RE4 ' +
      'son tres puertas de entrada distintas. Explicamos cual conviene ' +
      'elegir y en que orden continuar.',
    body: `## Tres Resident Evil, tres experiencias

A diferencia de otras sagas de terror, Resident Evil tiene varias entradas
razonables y ninguna es "la correcta". Depende de que busques:

- **Terror clasico y supervivencia**: el Resident Evil original de 1996.
- **Terror puro y gestion de inventario**: el remake de Resident Evil 2.
- **Accion y cooperativo**: el remake de Resident Evil 4.

## La opcion mas equilibrada: Resident Evil 2 (2019)

Si buscas una sola recomendacion, es el remake de **Resident Evil 2**. Es el
mejor punto de entrada por motivos muy concretos:

- Es **accesible**: el mapa es pequeno y esta muy bien guiado.
- La **gestion de inventario** se conserva, pero es mucho mas clara que en el
  original, con inventario por ranuras y rotacion de objetos.
- La **municion es el recurso tension**, no la vida: los enemigos hacen
  mucho dano pero no te matan de un balazo, asi que un error se castiga sin
  ser instantaneo.
- Es el juego con **mejor relacion calidad/duracion** de la saga: unas 10
  horas para la historia, unas 15 con los TLS ("The Last Stand") y el
  contenido extra.

Y si te apetece, el remake de **Resident Evil 3 (2020)** va justo despues y
reutiliza el mismo motor, asi que la transicion es inmediata.

## La ruta clasica

Si lo que quieres es la experiencia original, el orden canonico es:

1. **Resident Evil (1996)** - la birth of the genre. Dificil a proposito.
2. **Resident Evil 2 (1998)** - el que hizo grande la saga.
3. **Resident Evil 3: Nemesis (1999)** - mas corto, mucho ritmo.
4. **Resident Evil Code: Veronica** - el giro de la trama original.
5. **Resident Evil 4 (2005)** - el que cambio el genero entero.

## La ruta de los remakes

Si prefieres el motor moderno con el nucleo clasico:

1. **Resident Evil 2 (2019)**
2. **Resident Evil 3 (2020)**
3. **Resident Evil 4 (2023)** - el remake del que todo el mundo habla.
4. **Resident Evil Village** - vuelve al terror puro y a lasConvenciones
del genero.

## La ruta de accion (RE4 en adelante)

Si lo que buscas es accion, la linea de **Resident Evil 4 (2005)** en
adelante es casi otra serie. El 4 original es brutal, el remake de 2023 es
mucho mas accesible, y a partir de ahi todo va hacia la accion con el
sistema de lectura y las cooperaciones online.

Empieza por el **remake de Resident Evil 2** y decide sobre la marcha.`,
    category: 'ruta',
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/883710/header.jpg',
    authorName: 'Equipo GoRoDeals',
    readingMinutes: 6,
    franchiseSlug: null,
    relatedGameSlugs: ['resident-evil-2', 'resident-evil-4'],
    publishedAt: '2026-02-17T09:00:00.000Z',
    seoTitle: 'Por donde empezar la saga de Resident Evil',
    seoDescription:
      'RE2 original o remake, classic line o reboot: las tres rutas para ' +
      'empezar la saga de Resident Evil sin equivocarse.',
  },
  {
    slug: 'empezar-fallout-sin-quedarte-atrapado',
    title: 'Empezar Fallout sin quedarte atrapado en la primera partida',
    subtitle: 'La peninsula, el vault y las decisiones que importan',
    excerpt:
      'Fallout 4 empieza con una decision de dos horas que define el resto ' +
      'de la partida. Te explicamos como evitarla y por que el vault es la ' +
      'peor entrada posible.',
    body: `## El problema: el primer dia

Fallout 4 tiene un problema de ritmo en su primer dia. Despiertas en una
capsula criogenica, sales a una superficie que parece muerta y en las
primeras dos horas te ofrecen entrar en el Vault 111. Casi todo el mundo lo
hace, y casi todo el mundo se arrepiente: el vault es un tutorial de dos
horas, un refugio sin nada que contar y una puerta que se cierra para siempre.

## Que hacer en su lugar

1. **Sal del vault sin completar el tutorial.** Puedes hacerlo: la puerta de
   la capsula se abre y el terminal del vault tiene una salida alternative.
2. **Ignora el beacon de la paleta Overseer** al principio. No hay prisa.
3. **Haz el radio de Colonoscopio y despeja la plaza de la ciudad.** Estos
   dos objetivos iniciales te dan la companion basica y una base operativa
   que te va a servir todo el juego.
4. **Investiga el Sanctuary.** La escena del teletransporte es el mejor
   tutorial que tiene la saga y te lleva directo a la zona mas-dense del
   juego.

## Por que el vault no es el principio real

El Vault 111 funciona como introduccion, pero te quita la agencia durante
media hora y te presenta a un antagonista que no es el verdadero. El
contraste entre esa introduccion y lo que viene despues es casi el que
define al juego: de una boveda de laboratorio a un mundo roto y radiactivo.

## Las decisiones que de verdad importan

Lo que define tu partida no son las misiones secundarias, sino:

- **Que faccion eliges al final** (los Hermanos, la Colonia o el Instituto).
  Cambia el epilogo, el companions y el contenido del final.
- **Si rescatas a la Colonia o al Instituto.** Es una decision irreversible
  a mitad del juego.
- **Con quien te casas.** Se elige pronto y se nota mucho.

## Un consejo sobre elCompanion

Coge a **Sole Survivor** en vez de a un$,
si no tienes prisa. Yestate con ella durante las primeras horas: los
companions dieuten cuando no te necesitan y la Quito te vuelve a casa.
Estos detalles parecen pequenos pero el sistema de afinidad hace que la
relacion con tu companion cambie el final.

## El orden de la saga

Fallout 4 no es el primero. Si vienes de cero:

1. **Fallout 3** - el que define el genero de mundo abierto con narracion.
2. **Fallout: New Vegas** - el mejor del genero, mas sistema y mas riesgo.
3. **Fallout 4** - el mas accesible, con el engine mas pulido.
4. **Fallout 76** - solo si te gustan las bases y el multiplayer.

Empieza por el 4 si lo que quieres es el juego moderno, y por el 3 si lo
que quieres es la mejor EXPERIENCIA.`,
    category: 'ruta',
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/377160/header.jpg',
    authorName: 'Equipo GoRoDeals',
    readingMinutes: 6,
    franchiseSlug: null,
    relatedGameSlugs: ['fallout-4'],
    publishedAt: '2026-02-24T09:00:00.000Z',
    seoTitle: 'Empezar Fallout 4 sin el Vault 111',
    seoDescription:
      'Como evitar el tutorial del Vault 111, las decisiones que definen ' +
      'el final y el orden recomendado de la saga Fallout.',
  },
  {
    slug: 'que-mirar-antes-de-comprar-en-oferta',
    title: 'Que mirar antes de comprar un juego en oferta',
    subtitle: 'Cinco comprobaciones que evitan comprar el juego equivocado',
    excerpt:
      'Un descuento del 80% no dice nada sobre si el juego te va a gustar. ' +
      'Antes de comprar, revisa la duracion del descuento, el historial de ' +
      'precio y la calidad de la oferta.',
    body: `## Un descuento no es una recomendacion

El precio baja cuando la oferta es real, pero la oferta no dice nada sobre
la calidad del juego. Antes de comprar, hay cinco cosas que conviene mirar.

## 1. Cuanto dura el descuento

Steam no tiene "el precio de lista" en un sentido estricto: el precio baja
cada pocas semanas, se queda asi un tiempo y vuelve a subir en las rebajas
semanales. Por eso un "-80%" puede significar dos cosas:

- El juego esta en su **minimo historico** y no bajara mas pronto.
- El juego esta en su **precio habitual rebajado** y volvera a subir la
  semana que viene.

Nuestro historial de precios guarda la serie de 30 dias para que puedas
ver cual de los dos es. Si el precio actual es el mas bajo del mes, la
oferta es buena. Si es el precio de siempre rebajado un poco, espera.

## 2. El descuento es real o es relativo

Un "-70%" sobre un precio que hace un mes era el doble es un 30% de
descuento real. La cifra grande del porcentaje esconde el precio de
referencia. Mira siempre el **precio actual**, no el porcentaje.

## 3. La duracion total del juego

Un -85% de un juego de 60 horas puede ser peor negocio que un -60% de uno de
8 horas. Las saga largas suelen tener muchas horas de relleno, sobre todo
si no te interesan las misiones secundarias.

## 4. La calidad tecnica de la oferta

El mismo juego en Steam, en GOG y en la eShop puede estar en estados muy
distintos:

- En Steam, la version puede ser la de **32 bits** (nunca compres en Linux
  o Mac sin revisar) o la de 64 bits.
- Las **traducciones** no siempre estan disponibles en todas las tiendas.
- Las **ediciones** no son iguales: una "Complete Edition" en una tienda
  puede ser la "Deluxe" en otra. Compara el contenido, no el nombre.

Nuestro catalogo te dice la tienda y el identificador exacto del producto,
para que puedas comparar la misma edicion y no una version recortada.

## 5. El momento de la compra

Los descuentos de las rebajas son acumulativos con los de la tienda, pero
tambien hay **ofertas de launcher** (GOG, Epic, Humble) que unilizan el
precio en Keys. Y ojo: una oferta de un solo dia no avisa por correo.

## Resumen rapido

Antes de comprar, comprueba el historial de 30 dias, mira el precio actual
en euros y no solo el porcentaje, verifica que la edicion es la que quieres
y no la que se ha "rebajado" de un juego de 40 horas. Con eso, casi siempre
tomas la decision correcta.`,
    category: 'guia',
    coverUrl: null,
    authorName: 'Equipo GoRoDeals',
    readingMinutes: 5,
    franchiseSlug: null,
    relatedGameSlugs: [
      'yakuza-0',
      'resident-evil-2',
      'fallout-4',
      'like-a-dragon-infinite-wealth',
    ],
    publishedAt: '2026-03-03T09:00:00.000Z',
    seoTitle: 'Que mirar antes de comprar un juego en oferta',
    seoDescription:
      'Historial de precio, descuento real frente a porcentaje, duracion, ' +
      'ediciones y momento de compra: la guia para comprar bien.',
  },
  {
    slug: 'yakuza-0-y-el-giro-que-cambio-la-saga',
    title: 'Yakuza 0 y el giro que cambio la saga',
    subtitle: 'Analisis de la prehistoria que redibujo una saga entera',
    excerpt:
      'Yakuza 0 no es solo un prequel: es una decision de diseño sobre como ' +
      'se juega. Analizamos por que la gestion de destinos turisticos de ' +
      'Kamurocho funciona y que dice del futuro de la saga.',
    body: `## Un prequel que no se siente como un prequel

La mayoria de los spin-off y precuelas existen para Filling huecos de una
historia que ya se ha contado. Yakuza 0 hace justo lo contrario: ocupa un
hueco que la serie habia dejado abierto ("como aparecio Majima") y lo
convierte en el mejor capitulo de la saga.

## El giro de diseño

La idea central es que **la gestion de negocios no es un minijuego
secundario**: es la columna vertebral del juego. El Hostess Club, la
Escuela de Pop, el ranch de ganado, la pezateria, la tintoreria, el cine
Battleship: cada negocio es una actividad con sus propias reglas, sus
mejoras y, sobre todo, sus empleados. Cada uno tiene una **historia
propia**, y varias de las mejores del juego son precisamente las de esos
empleados.

Esto hace dos cosas a la vez:

1. Da a Kamurocho una **textura social** que el resto de la saga no tiene.
   No es un decorado, es un barrio con gente.
2. Convierte a Majima en un personaje **activo** desde el primer minuto.

## Majima antes de Majima

El Goro Majima de Yakuza 0 es un tipo sin pose, al que le gusta el chaos y
cobra por el caos. Yakuza 0 le da un contexto: un heredero de un clan de
Kamurocho que quiere construir su propia identidad. Cuando en Yakuza 1 lo ves como el nuevos
lider de los yakuza de Kamurocho, ya entiendes lo que hay debajo.

Es la misma mecanica que usa la serie con Kiryu: presentar al personaje
como alguien con una **debilidad concreta** (Kiryu: su impulso de proteger a
los demas; Majima: su necesidad de reconocimiento) y luego dejar que la
saga lo destroce poco a poco.

## El combate

Yakuza 0 mantiene el sistema de golpes de estilo y el cambio de personaje en
calor, pero con la diferencia de que cada personaje tiene su propio
**estilo de pelea** identificable. Es la base sobre la que se construiran
todos los Yakuza posteriores, y ya se nota que Kiryu y Majima se leen
claramente en el ring.

## Lo que la saga aprendio

Yakuza 0 demuestra que la saga puede hablar de la **comunidad** y no solo de
la Mafia. Sotenbori, Kamurocho, el Isle, Isezaki Ichi: cada distrito tiene
su propia identidad y sus problemas. Cuando la saga llega a Infinite
Wealth, con un protagonista ex gang, esa mirada ya estaba puesta desde 2015.

Y por eso, si empieza por aqui, no empiezas por "el juego de Majima".
Empiezas por el capitulo que **invento el sistema** de la serie.`,
    category: 'analisis',
    coverUrl:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2988580/aaceda0f5c16fce191e63f7342d07323e86a1156/header.jpg',
    authorName: 'Equipo GoRoDeals',
    readingMinutes: 6,
    franchiseSlug: 'like-a-dragon',
    relatedGameSlugs: ['yakuza-0', 'yakuza-1', 'like-a-dragon'],
    publishedAt: '2026-03-10T09:00:00.000Z',
    seoTitle: 'Yakuza 0: analisis del giro que cambio la saga',
    seoDescription:
      'Por que la gestion de negocios de Kamurocho es el nucleo del juego y ' +
      'que dice del futuro de la saga Like a Dragon.',
  },
  {
    slug: 'como-seguimos-los-precios-historial-30-dias',
    title: 'Como seguimos los precios: el historial de 30 dias',
    subtitle: 'Que hay detras de cada oferta que ves en el sitio',
    excerpt:
      'Cada oferta que aparece en GoRoDeals viene con un historial de 30 ' +
      'dias. Explicamos como se recoge ese dato, por que importa y como ' +
      'leerlo para comprar mejor.',
    body: `## Que es el historial de precios

En cada ficha de juego tienes una grafica con el precio de la oferta
durante los ultimos 30 dias. Cada punto es una observacion del precio real
en la tienda, con la fecha en la que se tomo.

Sirve para responder a una pregunta muy simple: **¿esto es una oferta de
verdad o el precio de siempre?**

## Como se recoge

El proceso es automatico:

1. Un tarea programada recorre el catalogo por lotes, pagina a pagina, para
   no castigar las APIs de las tiendas.
2. Para cada juego consulta el precio actual, el precio de referencia, si
   la oferta esta disponible y la moneda.
3. Cada resultado se guarda en la tabla de historico con su fecha, y se
   actualiza la oferta vigente.
4. La serie se dibuja desde ahi. Si un dia la tienda no responde, ese punto
   no se inventa: falta.

## Por que 30 dias

Un mes es el ciclo natural de las rebajas en las tiendas: una semana con
descuentos, tres semanas a precio medio y una vuelta al precio alto. Con
30 dias ves el patron completo y puedes comparar el precio actual con el
minimo y con la media del periodo.

## Como leerlo

- **El precio actual es el mas bajo del mes**: compra ya, probablemente no
  bajara mas y puede volver a subir.
- **El precio actual es el mas alto del mes**: espera, hay recorrido.
- **El precio es plano**: es el precio habitual rebajado, no un chollo.

## La de los que seniegan

No todas las rebajas son comparables entre tiendas, y por eso cada oferta
identifica su tienda y su identificador de producto exacto. Comparar "el
mismo juego" en dos tiendas puede no ser comparar la misma edicion: una
puede tener la traduccion y la otra no, o una puede ser la version de 32
bits.

## Y el "Deal Score"

El Deal Score resume en un numero de 0 a 10 lo mucho que conviene una oferta,
combinando el descuento, el precio frente al minimo historico y la calidad
del juego. Es una orientacion, no una verdad: el score alto no sustituye a
tocar la ficha y decidir por ti mismo.`,
    category: 'noticia',
    coverUrl: null,
    authorName: 'Equipo GoRoDeals',
    readingMinutes: 4,
    franchiseSlug: null,
    relatedGameSlugs: ['yakuza-0', 'resident-evil-2', 'fallout-4'],
    publishedAt: '2026-03-17T09:00:00.000Z',
    seoTitle: 'Como seguimos los precios: el historial de 30 dias',
    seoDescription:
      'Como se recoge el historial de precios de 30 dias, que significa cada ' +
      'punto de la grafica y como usarlo para comprar mejor.',
  },
];

async function upsertFranchise(client: PoolClient): Promise<string | null> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM franchises WHERE slug = $1 LIMIT 1`,
    [FRANCHISE.slug],
  );
  if (existing.rowCount && existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  /**
   * La saga no existe todavia: se crea para que la publicacion pueda
   * enlazarse. Si el catalogo esta vacio no es un error, solo significa que
   * no habra ruta que mostrar.
   */
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO franchises (name, slug, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [FRANCHISE.name, FRANCHISE.slug, FRANCHISE.description],
  );
  return inserted.rows[0].id;
}

async function upsertPublication(
  client: PoolClient,
  publication: SeedPublication,
  franchiseId: string | null,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO publications (
        slug, title, subtitle, excerpt, body, category, cover_url,
        author_name, reading_minutes, franchise_id, is_published,
        published_at, seo_title, seo_description
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, true,
        $11, $12, $13
      )
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        excerpt = EXCLUDED.excerpt,
        body = EXCLUDED.body,
        category = EXCLUDED.category,
        cover_url = EXCLUDED.cover_url,
        author_name = EXCLUDED.author_name,
        reading_minutes = EXCLUDED.reading_minutes,
        franchise_id = EXCLUDED.franchise_id,
        is_published = true,
        published_at = EXCLUDED.published_at,
        seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description,
        updated_at = now()
      RETURNING id`,
    [
      publication.slug,
      publication.title,
      publication.subtitle,
      publication.excerpt,
      publication.body,
      publication.category,
      publication.coverUrl,
      publication.authorName,
      publication.readingMinutes,
      franchiseId,
      publication.publishedAt,
      publication.seoTitle,
      publication.seoDescription,
    ],
  );
  return result.rows[0].id;
}

async function linkGames(
  client: PoolClient,
  publicationId: string,
  gameSlugs: string[],
): Promise<number> {
  /**
   * Los juegos se localizan por slug en el catalogo. Los que no existen se
   * ignoran: el seed nunca debe fallar por un catalogo incompleto.
   */
  const games = await client.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM games WHERE slug = ANY($1::text[])`,
    [gameSlugs],
  );

  let linked = 0;
  for (const game of games.rows) {
    const result = await client.query(
      `INSERT INTO publication_games (publication_id, game_id)
       VALUES ($1, $2)
       ON CONFLICT (publication_id, game_id) DO NOTHING`,
      [publicationId, game.id],
    );
    linked += result.rowCount ?? 0;
  }
  return linked;
}

/**
 * Si la publicacion no tiene imagen propia, hereda la caratula del primer
 * juego enlazado que tenga una. Asi el listado editorial no muestra huecos
 * vacios. No pisa una imagen ya asignada.
 */
async function inheritCoverFromLinkedGame(
  client: PoolClient,
  publicationId: string,
  ownCoverUrl: string | null,
): Promise<void> {
  if (ownCoverUrl) return;

  const result = await client.query<{ cover_url: string | null }>(
    `SELECT g.cover_url
       FROM publication_games pg
       INNER JOIN games g ON g.id = pg.game_id
      WHERE pg.publication_id = $1 AND g.cover_url IS NOT NULL
      ORDER BY pg.publication_id, g.release_date NULLS LAST
      LIMIT 1`,
    [publicationId],
  );

  const cover = result.rows[0]?.cover_url;
  if (!cover) return;

  await client.query(
    `UPDATE publications SET cover_url = $1 WHERE id = $2 AND cover_url IS NULL`,
    [cover, publicationId],
  );
}

async function countRows(client: PoolClient, table: string): Promise<number> {
  const result = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM ${table}`,
  );
  return result.rows[0].count;
}

async function main(): Promise<void> {
  const pool = new Pool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER ?? 'gorodeals',
    password: process.env.DB_PASSWORD ?? 'gorodeals',
    database: process.env.DB_NAME ?? 'gorodeals',
    max: 5,
  });

  const client = await pool.connect();
  const tables = ['publications', 'publication_games'];

  console.log('Estado inicial:');
  for (const table of tables) {
    console.log(`  ${table}: ${await countRows(client, table)}`);
  }

  try {
    await client.query('BEGIN');

    const franchiseId = await upsertFranchise(client);

    let linkedGames = 0;
    for (const publication of PUBLICATIONS) {
      const publicationId = await upsertPublication(
        client,
        publication,
        publication.franchiseSlug && franchiseId ? franchiseId : null,
      );
      linkedGames += await linkGames(
        client,
        publicationId,
        publication.relatedGameSlugs,
      );
      await inheritCoverFromLinkedGame(
        client,
        publicationId,
        publication.coverUrl,
      );
    }

    await client.query('COMMIT');

    console.log('\nSeed completado.');
    console.log(`  Publicaciones procesadas: ${PUBLICATIONS.length}`);
    console.log(`  Vinculos con juegos creados: ${linkedGames}`);
    console.log('Estado final:');
    for (const table of tables) {
      console.log(`  ${table}: ${await countRows(client, table)}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed de publicaciones fallido:', error);
  process.exitCode = 1;
});

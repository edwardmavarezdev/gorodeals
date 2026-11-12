/**
 * Utilidades de render en el cliente.
 *
 * El HTML se genera a partir de plantillas <template> presentes en el DOM
 * (componentes Astro) que se clonan y rellenan con los datos de la API.
 */

import type {
  CatalogItem,
  CatalogResponse,
  Offer,
  PublicationCategoryItem,
  PublicationSummary,
} from './api';

export function formatPrice(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date);
}

/**
 * Pone una caratula en un elemento. Si la URL falla o no existe, se muestra
 * un marcador de posicion en lugar de una imagen rota.
 */
export function setCover(
  element: HTMLElement | null,
  url: string | null | undefined,
  alt: string,
  placeholderText = 'Sin caratula',
): void {
  if (!element) return;
  if (!url) {
    element.classList.add('game-card__cover--placeholder');
    element.textContent = placeholderText;
    return;
  }
  element.setAttribute('aria-label', alt);
  const preload = new Image();
  preload.onload = () => {
    // La URL se expone como variable CSS para que el estilo pueda componer
    // la caratula y, cuando es apaisada, un fondo desenfocado con la misma
    // imagen bajo la version contenida.
    element.style.setProperty('--cover-url', `url("${encodeURI(url)}")`);
    // El catalogo mezcla caratulas verticales (Steam, IGDB), cuadradas
    // (Nintendo) y apaisadas (cabeceras de Steam, arte de Nintendo). Una
    // caratula apaisada recortada en una caja vertical muestra solo una
    // franja, asi que se muestra completa sobre un fondo difuminado.
    const isWide =
      preload.naturalWidth > 0 &&
      preload.naturalHeight > 0 &&
      preload.naturalWidth / preload.naturalHeight > 1.3;
    element.classList.toggle('cover--wide', isWide);
  };
  preload.onerror = () => {
    element.classList.add('game-card__cover--placeholder');
    element.textContent = placeholderText;
  };
  preload.src = url;
}


/**
 * Clona una plantilla <template> y devuelve su primer elemento raiz.
 * La plantilla debe tener un unico elemento de primer nivel.
 */
export function cloneTemplateElement(name: string): HTMLElement | null {
  const template = document.querySelector<HTMLTemplateElement>(`[data-template="${name}"]`);
  if (!template) return null;
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  const element = fragment.firstElementChild;
  return element instanceof HTMLElement ? element : null;
}

function setText(root: ParentNode, selector: string, text: string): void {
  const node = root.querySelector(selector);
  if (node) node.textContent = text;
}

/** Rellena un bloque de precio (plantilla price-tag) y devuelve su elemento. */
export function buildPriceTag(offer: Offer | null): HTMLElement | null {
  const root = cloneTemplateElement('price-tag');
  if (!root) return null;

  if (!offer) {
    setText(root, '[data-price-current]', 'Sin oferta');
    setText(root, '[data-price-regular]', '');
    const discount = root.querySelector('[data-price-discount]');
    if (discount) {
      discount.textContent = '--';
      discount.classList.add('discount--none');
    }
    return root;
  }

  setText(root, '[data-price-current]', formatPrice(offer.currentPrice, offer.currency));
  const regular = root.querySelector('[data-price-regular]');
  if (regular) {
    if (offer.discountPercent > 0) {
      regular.textContent = formatPrice(offer.regularPrice, offer.currency);
    } else {
      regular.textContent = '';
    }
  }
  const discount = root.querySelector('[data-price-discount]');
  if (discount) {
    if (offer.discountPercent > 0) {
      discount.textContent = `-${offer.discountPercent}%`;
    } else {
      discount.textContent = 'Sin dto.';
      discount.classList.add('discount--none');
    }
  }
  return root;
}

/** Construye una tarjeta de catalogo a partir de un item de la API. */
export function buildGameCard(item: CatalogItem): HTMLElement | null {
  const root = cloneTemplateElement('game-card');
  if (!root) return null;

  const link = root.querySelector<HTMLAnchorElement>('[data-card-link]');
  if (link) link.href = `/juego?slug=${encodeURIComponent(item.slug)}`;

  const cover = root.querySelector<HTMLElement>('[data-card-cover]');
  setCover(cover, item.coverUrl, item.title);

  setText(root, '[data-card-title]', item.title);
  setText(root, '[data-card-platforms]', (item.platforms ?? []).join(' / ') || 'Plataforma desconocida');

  const meta = root.querySelector('[data-card-metacritic]');
  if (meta) {
    const hasScore =
      item.metacriticScore !== null && item.metacriticScore !== undefined;
    meta.textContent = hasScore ? `Metacritic ${item.metacriticScore}` : 'Metacritic --';
    // Sin puntuacion el chip vuelve a su estilo neutro: el verde de la
    // insignia se reserva para el dato real.
    meta.classList.toggle('badge--meta', hasScore);
  }

  const quality = root.querySelector('[data-card-quality]');
  if (quality) {
    quality.textContent =
      item.qualityScore !== null && item.qualityScore !== undefined
        ? `Calidad ${item.qualityScore}`
        : 'Calidad --';
  }

  const deal = root.querySelector('[data-card-deal]');
  if (deal) {
    const score = item.bestOffer?.dealScore;
    deal.textContent = score !== null && score !== undefined ? `Deal ${score}` : 'Deal --';
  }

  const priceSlot = root.querySelector('[data-card-price]');
  if (priceSlot) {
    const tag = buildPriceTag(item.bestOffer);
    if (tag) priceSlot.appendChild(tag);
  }

  setText(root, '[data-card-store]', item.bestOffer?.storeName ?? '');

  return root;
}

/** Vuelca una lista de items en la rejilla indicada. */
export function renderCardGrid(grid: HTMLElement, items: CatalogItem[]): void {
  grid.innerHTML = '';
  for (const item of items) {
    const card = buildGameCard(item);
    if (card) grid.appendChild(card);
  }
}

/**
 * Construye una fila de oferta (formato listado denso: caratula pequena,
 * metadatos a la izquierda y precio a la derecha).
 */
export function buildDealRow(item: CatalogItem): HTMLElement | null {
  const root = cloneTemplateElement('deal-row');
  if (!root) return null;

  const link = root.querySelector<HTMLAnchorElement>('[data-row-link]');
  if (link) link.href = `/juego?slug=${encodeURIComponent(item.slug)}`;

  const cover = root.querySelector<HTMLElement>('[data-row-cover]');
  setCover(cover, item.coverUrl, item.title);

  setText(root, '[data-row-title]', item.title);
  setText(root, '[data-row-store]', item.bestOffer?.storeName ?? 'sin tienda');
  setText(
    root,
    '[data-row-platforms]',
    (item.platforms ?? []).join(' / ') || 'Plataforma desconocida',
  );

  const metacritic = root.querySelector('[data-row-metacritic]');
  if (metacritic) {
    metacritic.textContent =
      item.metacriticScore !== null && item.metacriticScore !== undefined
        ? `Metacritic ${item.metacriticScore}`
        : 'Metacritic --';
  }

  const note = root.querySelector('[data-row-note]');
  if (note) {
    const low = item.bestOffer?.historicalLowPrice;
    const parts: string[] = [];
    if (item.summary) parts.push(item.summary);
    if (low !== null && low !== undefined) {
      parts.push(`Minimo historico ${formatPrice(low, item.bestOffer?.currency ?? 'USD')}`);
    }
    note.textContent = parts.join(' - ');
  }

  const score = root.querySelector('[data-row-score]');
  if (score) {
    const value = item.bestOffer?.dealScore;
    if (value !== null && value !== undefined) {
      score.textContent = value.toFixed(1);
      if (value >= 7) score.classList.add('deal-score--high');
    } else {
      score.textContent = '--';
    }
  }

  const priceSlot = root.querySelector('[data-row-price]');
  if (priceSlot) {
    const tag = buildPriceTag(item.bestOffer);
    if (tag) priceSlot.appendChild(tag);
  }

  return root;
}

/** Vuelca una lista de ofertas en el listado de filas. */
export function renderDealList(list: HTMLElement, items: CatalogItem[]): void {
  list.innerHTML = '';
  for (const item of items) {
    const row = buildDealRow(item);
    if (row) list.appendChild(row);
  }
}

/* ------------------------------------------------------------------ */
/* Publicaciones                                                       */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  guia: 'Guia',
  ruta: 'Ruta de saga',
  analisis: 'Analisis',
  noticia: 'Noticia',
};

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return 'Publicacion';
  return CATEGORY_LABELS[category] ?? category;
}

/** Construye una tarjeta editorial a partir de una publicacion. */
export function buildPublicationCard(item: PublicationSummary): HTMLElement | null {
  const root = cloneTemplateElement('publication-card');
  if (!root) return null;

  const href = `/publicacion?slug=${encodeURIComponent(item.slug)}`;

  const link = root.querySelector<HTMLAnchorElement>('[data-pub-link]');
  if (link) link.href = href;
  const titleLink = root.querySelector<HTMLAnchorElement>('[data-pub-title-link]');
  if (titleLink) titleLink.href = href;

  const cover = root.querySelector<HTMLElement>('[data-pub-cover]');
  setCover(cover, item.coverUrl, item.title, 'Sin imagen');

  const tag = root.querySelector('[data-pub-tag]');
  if (tag) {
    tag.textContent = categoryLabel(item.category);
    tag.classList.add(`pub-tag--${item.category}`);
  }

  setText(root, '[data-pub-title]', item.title);
  setText(root, '[data-pub-excerpt]', item.excerpt);
  setText(root, '[data-pub-author]', item.authorName);
  setText(root, '[data-pub-date]', formatDate(item.publishedAt));
  setText(root, '[data-pub-reading]', `${item.readingMinutes} min de lectura`);

  const franchise = root.querySelector('[data-pub-franchise]');
  if (franchise) {
    if (item.franchise) {
      franchise.textContent = item.franchise.name;
      franchise.classList.remove('hidden');
    } else {
      franchise.classList.add('hidden');
    }
  }

  return root;
}

/** Vuelca una lista de publicaciones en el contenedor indicado. */
export function renderPublicationList(
  container: HTMLElement,
  items: PublicationSummary[],
): void {
  container.innerHTML = '';
  for (const item of items) {
    const card = buildPublicationCard(item);
    if (card) container.appendChild(card);
  }
}

/** Pinta el menu lateral de categorias con su contador. */
export function renderCategoryNav(
  container: HTMLElement,
  categories: PublicationCategoryItem[],
  active: string,
  franchise: string,
): void {
  container.innerHTML = '';

  const links: Array<{ href: string; label: string; count: number | null; current: boolean }> = [
    {
      href: buildQuery('/publicaciones', { category: '', franchise }),
      label: 'Todas las publicaciones',
      count: null,
      current: !active,
    },
  ];

  for (const category of categories) {
    links.push({
      href: buildQuery('/publicaciones', { category: category.slug, franchise }),
      label: category.name,
      count: category.count,
      current: active === category.slug,
    });
  }

  const list = document.createElement('ul');
  for (const link of links) {
    const item = document.createElement('li');
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.textContent = link.label;
    if (link.current) anchor.setAttribute('aria-current', 'true');
    const count = document.createElement('span');
    count.className = 'pub-sidebar__count';
    count.textContent = link.count === null ? '' : String(link.count);
    anchor.appendChild(count);
    item.appendChild(anchor);
    list.appendChild(item);
  }

  container.appendChild(list);
}

/** Construye una URL de la web con los parametros indicados. */
export function buildQuery(
  path: string,
  params: Record<string, string | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/** Renderiza la paginacion a partir de la respuesta del catalogo. */
export function renderPagination(
  container: HTMLElement,
  data: { page: number; limit: number; total: number },
  params: URLSearchParams,
  basePath = '/',
  label = 'juegos',
): void {
  const root = cloneTemplateElement('pagination');
  if (!root) return;

  const totalPages = Math.max(1, Math.ceil(data.total / Math.max(1, data.limit)));
  const current = data.page;
  const buildHref = (page: number): string => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    next.set('limit', String(data.limit));
    return `${basePath}?${next.toString()}`;
  };

  setText(root, '[data-page-info]', `Pagina ${current} de ${totalPages} - ${data.total} ${label}`);

  const prev = root.querySelector<HTMLAnchorElement>('[data-page-prev]');
  const nextLink = root.querySelector<HTMLAnchorElement>('[data-page-next]');
  if (prev) {
    if (current > 1) {
      prev.href = buildHref(current - 1);
      prev.classList.remove('disabled');
    } else {
      prev.removeAttribute('href');
      prev.classList.add('disabled');
    }
  }
  if (nextLink) {
    if (current < totalPages) {
      nextLink.href = buildHref(current + 1);
      nextLink.classList.remove('disabled');
    } else {
      nextLink.removeAttribute('href');
      nextLink.classList.add('disabled');
    }
  }

  const pages = root.querySelector('[data-page-pages]');
  if (pages) {
    pages.innerHTML = '';
    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, start + 4);
    for (let page = start; page <= end; page += 1) {
      if (page === current) {
        const span = document.createElement('span');
        span.className = 'current';
        span.textContent = String(page);
        pages.appendChild(span);
      } else {
        const anchor = document.createElement('a');
        anchor.href = buildHref(page);
        anchor.textContent = String(page);
        pages.appendChild(anchor);
      }
    }
  }

  container.innerHTML = '';
  container.appendChild(root);
}

/** Muestra el estado de error legible en el contenedor indicado. */
export function renderError(container: HTMLElement, message: string): void {
  container.innerHTML = '';
  const root = cloneTemplateElement('error-state');
  if (!root) {
    const wrapper = document.createElement('div');
    wrapper.className = 'state state--error';
    wrapper.setAttribute('role', 'alert');
    const heading = document.createElement('h3');
    heading.textContent = 'No se pudieron cargar los datos';
    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    wrapper.append(heading, paragraph);
    container.appendChild(wrapper);
    return;
  }
  const text = root.querySelector('[data-error-message]');
  if (text) text.textContent = message;
  container.appendChild(root);
}

export function showLoading(container: HTMLElement, message: string): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'state state--loading';
  wrapper.textContent = message;
  container.innerHTML = '';
  container.appendChild(wrapper);
}

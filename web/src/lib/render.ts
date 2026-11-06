/**
 * Utilidades de render en el cliente.
 *
 * El HTML se genera a partir de plantillas <template> presentes en el DOM
 * (componentes Astro) que se clonan y rellenan con los datos de la API.
 */

import type { CatalogItem, CatalogResponse, Offer } from './api';

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
    element.style.backgroundImage = `url("${encodeURI(url)}")`;
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
    meta.textContent =
      item.metacriticScore !== null && item.metacriticScore !== undefined
        ? `Metacritic ${item.metacriticScore}`
        : 'Metacritic --';
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

/** Renderiza la paginacion a partir de la respuesta del catalogo. */
export function renderPagination(
  container: HTMLElement,
  data: CatalogResponse,
  params: URLSearchParams,
): void {
  const root = cloneTemplateElement('pagination');
  if (!root) return;

  const totalPages = Math.max(1, Math.ceil(data.total / Math.max(1, data.limit)));
  const current = data.page;
  const buildHref = (page: number): string => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    next.set('limit', String(data.limit));
    return `/?${next.toString()}`;
  };

  setText(root, '[data-page-info]', `Pagina ${current} de ${totalPages} - ${data.total} juegos`);

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

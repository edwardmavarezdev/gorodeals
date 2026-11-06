import { Injectable } from '@nestjs/common';

/**
 * Entrada que evalua el Deal Score. Todos los campos son opcionales porque
 * el score se calcula tanto desde filas persistidas como desde datos que aun
 * no estan guardados en `store_products`.
 */
export interface DealScoreInput {
  /** Valoracion de calidad del juego (0-10). */
  qualityScore: number | null | undefined;
  /** Descuento vigente en porcentaje (0-100). */
  discountPercent: number | null | undefined;
  /** Precio actual de la oferta. */
  currentPrice: number | null | undefined;
  /** Minimo historico observado para la oferta. */
  historicalLowPrice: number | null | undefined;
}

/**
 * Pesos de cada componente del Deal Score. Suman 10 puntos, que es el rango
 * de la columna `store_products.deal_score`.
 */
export const DEAL_SCORE_WEIGHTS = {
  quality: 5,
  discount: 3.5,
  historical: 1.5,
} as const;

/** Descuento (en %) a partir del cual la oferta consigue todo el peso. */
export const MAX_DISCOUNT_FOR_FULL_WEIGHT = 60;

/**
 * Rango del precio actual respecto al minimo historico que se considera
 * "cerca del minimo". 0.8 significa un 20% de margen sobre el minimo.
 */
export const HISTORICAL_LOW_TOLERANCE = 0.8;

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * Componente de descuento: lineal hasta `MAX_DISCOUNT_FOR_FULL_WEIGHT` %.
 */
function discountComponent(discountPercent: number | null | undefined): number {
  if (discountPercent === null || discountPercent === undefined) {
    return 0;
  }
  const ratio = clamp(discountPercent, 0, 100) / MAX_DISCOUNT_FOR_FULL_WEIGHT;
  return clamp(ratio, 0, 1) * DEAL_SCORE_WEIGHTS.discount;
}

/**
 * Componente historico: mide cuanto se acerca el precio actual al minimo
 * historico conocido. Sin minimo historico se concede la mitad del peso
 * (neutral) para no penalizar ofertas aun no observadas.
 */
function historicalComponent(
  currentPrice: number | null | undefined,
  historicalLowPrice: number | null | undefined,
): number {
  if (
    currentPrice === null ||
    currentPrice === undefined ||
    currentPrice <= 0 ||
    historicalLowPrice === null ||
    historicalLowPrice === undefined ||
    historicalLowPrice <= 0
  ) {
    return DEAL_SCORE_WEIGHTS.historical / 2;
  }
  const ratio = historicalLowPrice / currentPrice;
  if (ratio >= 1) {
    return DEAL_SCORE_WEIGHTS.historical;
  }
  const normalized =
    (ratio - HISTORICAL_LOW_TOLERANCE) / (1 - HISTORICAL_LOW_TOLERANCE);
  return clamp(normalized, 0, 1) * DEAL_SCORE_WEIGHTS.historical;
}

/**
 * Funcion pura que calcula el Deal Score (0-10) de una oferta.
 *
 * Combina tres componentes ponderados:
 * - calidad del juego (0-10) -> 5 puntos,
 * - descuento vigente -> 3.5 puntos (saturado al 60%),
 * - cercania al minimo historico -> 1.5 puntos.
 *
 * Es pura y determinista: no toca base de datos ni configuracion, de modo que
 * se puede testear de forma aislada.
 */
export function computeDealScore(input: DealScoreInput): number {
  const quality =
    input.qualityScore === null || input.qualityScore === undefined
      ? 0
      : clamp(input.qualityScore, 0, 10);

  const score =
    (quality / 10) * DEAL_SCORE_WEIGHTS.quality +
    discountComponent(input.discountPercent) +
    historicalComponent(input.currentPrice, input.historicalLowPrice);

  return Math.round(clamp(score, 0, 10) * 10) / 10;
}

/**
 * Fachada inyectable de `computeDealScore`. Los modulos la usan para
 * completar en memoria los `deal_score` que aun no estan persistidos.
 */
@Injectable()
export class DealScoreService {
  compute(input: DealScoreInput): number {
    return computeDealScore(input);
  }
}

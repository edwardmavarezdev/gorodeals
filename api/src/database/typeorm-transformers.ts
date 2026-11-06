import type { ValueTransformer } from 'typeorm';

/**
 * PostgreSQL devuelve `numeric` como string para no perder precision.
 * Se convierte a number en la capa de aplicacion: los valores de negocio
 * (precios, porcentajes, scores) estan dentro del rango seguro de JS.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null =>
    value === null || value === undefined ? null : Number(value),
};

/** `bigint` de PG llega como string; IGDB usa enteros de 32 bits pero se conserva el tipo exacto. */
export const bigintTransformer: ValueTransformer = {
  to: (value: string | number | null | undefined): string | null | undefined =>
    value === null || value === undefined ? null : String(value),
  from: (value: string | null): string | null =>
    value === null || value === undefined ? null : String(value),
};

/**
 * jsonb de arrays: el driver de `pg` ya serializa el array como JSON, por lo que
 * `to` debe devolver el array y no una cadena (una cadena produciria un
 * `jsonb` escalar y el CHECK `jsonb_typeof(...) = 'array'` fallaria).
 */
export const jsonbArrayTransformer: ValueTransformer = {
  to: (value: unknown[] | null | undefined): unknown[] => value ?? [],
  from: (value: string | string[] | null): string[] => {
    if (value === null || value === undefined) {
      return [];
    }
    return typeof value === 'string' ? (JSON.parse(value) as string[]) : value;
  },
};

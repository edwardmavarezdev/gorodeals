/**
 * Utilidades para comparar la forma de una respuesta con la de un fixture.
 *
 * El fixture guarda la *forma* y no los valores: el tipo de cada campo y, en
 * los objetos, la lista de claves con la forma de su valor. Asi el fixture
 * no depende de los datos del momento (precios, marcas de tiempo, ids) y el
 * test puede compararlo contra cualquier base de datos.
 */

/** Forma de un valor: su tipo y, si es un objeto, la forma de sus campos. */
export interface Forma {
  type: string;
  items?: Forma | null;
  keys?: Record<string, Forma>;
}

/** Describe la forma de un valor. */
export function forma(valor: unknown): Forma {
  if (valor === null) {
    return { type: 'null' };
  }
  if (Array.isArray(valor)) {
    return {
      type: 'array',
      items: valor.length > 0 ? forma(valor[0]) : null,
    };
  }
  switch (typeof valor) {
    case 'object':
      return {
        type: 'object',
        keys: Object.keys(valor)
          .sort()
          .reduce<Record<string, Forma>>((acc, key) => {
            acc[key] = forma((valor as Record<string, unknown>)[key]);
            return acc;
          }, {}),
      };
    case 'number':
      return { type: 'number' };
    case 'string':
      return { type: 'string' };
    case 'boolean':
      return { type: 'boolean' };
    default:
      return { type: typeof valor };
  }
}

/**
 * Primera diferencia entre dos formas, con la ruta donde aparece.
 *
 * Devuelve `null` cuando las dos formas son iguales.
 */
export function diferencia(a: Forma, b: Forma, camino = ''): string | null {
  if (a.type !== b.type) {
    return `${camino || '/'}: tipo ${a.type} vs ${b.type}`;
  }
  if (a.type === 'object') {
    const clavesA = a.keys ?? {};
    const clavesB = b.keys ?? {};
    const claves = new Set([...Object.keys(clavesA), ...Object.keys(clavesB)]);
    for (const clave of claves) {
      if (!(clave in clavesA)) {
        return `${camino}.${clave}: sobra en la respuesta`;
      }
      if (!(clave in clavesB)) {
        return `${camino}.${clave}: falta en la respuesta`;
      }
      const d = diferencia(
        clavesA[clave],
        clavesB[clave],
        `${camino}.${clave}`,
      );
      if (d) {
        return d;
      }
    }
  }
  if (a.type === 'array') {
    if ((a.items === null) !== (b.items === null)) {
      return `${camino}: una lista tiene elementos y la otra no`;
    }
    if (a.items && b.items) {
      return diferencia(a.items, b.items, `${camino}[]`);
    }
  }
  return null;
}

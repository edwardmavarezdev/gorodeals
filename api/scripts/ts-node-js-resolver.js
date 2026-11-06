/**
 * Gancho de resolucion para ejecutar TypeScript con ts-node sin compilar.
 *
 * El codigo del proyecto importa los modulos con la extension `.js` (convencion
 * de ESM) pero los ficheros reales son `.ts`. Node no resuelve `./x.js` a
 * `./x.ts` por su cuenta, asi que este gancho (precargado con `-r`) reintenta
 * la resolucion sin la extension `.js` cuando la peticion falla.
 *
 * Solo se usa en el script de CLI: `npm run sync:random`.
 */
const Module = require('module');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, ...args) {
  if (
    (request.startsWith('./') || request.startsWith('../')) &&
    request.endsWith('.js')
  ) {
    try {
      return originalResolveFilename.call(this, request.slice(0, -3), ...args);
    } catch (error) {
      // Si tampoco existe el `.ts`, se propaga el error original.
    }
  }
  return originalResolveFilename.call(this, request, ...args);
};

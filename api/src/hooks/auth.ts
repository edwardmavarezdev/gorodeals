import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TokenService } from '../auth/token.service.js';

/**
 * Usuario autenticado, equivalente al `request.user` de NestJS.
 */
export interface AuthenticatedUser {
  /** UUID del usuario, tomado del `sub` del access token. */
  id: string;
  email: string;
  /** Identificador unico del token (`jti`), para revocar por token. */
  jti: string;
}

/**
 * Peticion con el usuario ya resuelto.
 *
 * `FastifyRequest` es generica y no admite ampliar sus propiedades por
 * augmentation sin repetir toda la lista de parametros, asi que el usuario
 * se expone con este tipo y el helper `currentUser`.
 */
export type AuthenticatedRequest = FastifyRequest & {
  user: AuthenticatedUser | null;
};

/**
 * Usuario autenticado de la peticion, o `null` si la ruta es publica o el
 * token no es valido.
 */
export function currentUser(request: FastifyRequest): AuthenticatedUser | null {
  return (request as AuthenticatedRequest).user ?? null;
}

/**
 * Politica de autenticacion de una ruta.
 *
 * - `required` (por defecto): sin token valido, la peticion se rechaza.
 * - `optional`: si hay token, se valida; si no, se sigue como peticion
 *   anonima. Se usa en rutas que personalizan la respuesta segun haya
 *   sesion (por ejemplo, marcar si un juego esta en la wishlist).
 * - `disabled`: la ruta es publica y no se toca el token.
 */
export type AuthMode = 'required' | 'optional' | 'disabled';

/**
 * Configuracion de ruta que decide si la ruta exige token.
 *
 * En la definicion de la ruta: `{ config: { auth: 'optional' } }`.
 */
export interface AuthRouteConfig {
  auth?: AuthMode;
}

/**
 * Extrae el token del header `Authorization: Bearer <token>`.
 *
 * Tolera que el header llegue en minusculas: HTTP no distingue entre mayus
 * y minusculas en los nombres de cabecera.
 */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, value] = header.split(' ');
  if (!value || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  return value.trim() || null;
}

/**
 * Hook global de autenticacion: **deny by default**.
 *
 * Toda ruta exige access token salvo las que declaran
 * `config: { auth: 'disabled' }` (publicas) o `config: { auth: 'optional' }`.
 * Asi cualquier ruta nueva nace protegida, sin depender de acordarse de
 * marcar nada.
 *
 * Nunca se distingue entre token expirado, mal formado o firmado con otro
 * algoritmo: el mensaje es siempre el mismo.
 */
export function registerAuthHook(
  fastify: FastifyInstance,
  tokenService: TokenService,
  publicPrefixes: string[] = ['/docs'],
): void {
  fastify.decorateRequest('user', null);

  // El hook va en `preValidation` y no en `preHandler`: en NestJS los guards
  // se ejecutan **antes** del `ValidationPipe`, de modo que una peticion sin
  // token se rechaza con 401 aunque el cuerpo sea invalido. En Fastify la
  // validacion del esquema ocurre justo despues de `preValidation`, asi que
  // es la fase equivalente.
  fastify.addHook(
    'preValidation',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const mode =
        (request.routeOptions.config as { auth?: AuthMode }).auth ?? 'required';

      // Si la ruta no existe, no hay nada que autenticar: responde el
      // manejador de 404. De lo contrario, una ruta inexistente devolveria
      // 401 en lugar de 404 y el error seria falso.
      if (!request.routeOptions.url) {
        return;
      }

      if (mode === 'disabled') {
        return;
      }

      // La documentacion es publica: es la referencia del API y no contiene
      // datos de usuario.
      if (publicPrefixes.some((prefix) => request.url.startsWith(prefix))) {
        return;
      }

      const token = extractBearerToken(request.headers.authorization);

      if (!token) {
        if (mode === 'optional') {
          return;
        }
        return reply.status(401).send({
          statusCode: 401,
          message: 'Credenciales invalidas',
          error: 'Unauthorized',
        });
      }

      try {
        const payload = await tokenService.verifyAccessToken(token);
        (request as AuthenticatedRequest).user = {
          id: payload.sub,
          email: payload.email,
          jti: payload.jti,
        };
      } catch {
        if (mode === 'optional') {
          // Token invalido en una ruta opcional: se ignora y se sigue como
          // peticion anonima.
          return;
        }
        return reply.status(401).send({
          statusCode: 401,
          message: 'Credenciales invalidas',
          error: 'Unauthorized',
        });
      }
    },
  );
}

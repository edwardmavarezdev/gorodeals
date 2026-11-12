import { BadRequestException } from '../errors.js';
import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { appConfig } from '../config.js';
import { currentUser } from '../hooks/auth.js';
import { SocialLinkRequiredError } from '../auth/social-login.service.js';
import { generatePkcePair } from '../auth/google-oauth.service.js';
import {
  AuthResponse,
  AuthUser,
  ConfirmLinkBody,
  LoginBody,
  LogoutResponse,
  RefreshBody,
  RegisterBody,
  SocialExchangeBody,
  UpdateProfileBody,
} from '../schemas/auth.js';
import { errorResponse } from '../schemas/error.js';

/**
 * Metadatos del cliente que se guardan con la sesion.
 *
 * El `ip` sale de `request.ip`, que ya tiene en cuenta `trustProxy` y la
 * cabecera `x-forwarded-for` (la peticion llega a traves de Nginx).
 */
function sessionContext(request: FastifyRequest): {
  userAgent: string | null;
  ip: string | null;
} {
  const userAgent = request.headers['user-agent'];
  const forwarded = request.headers['x-forwarded-for'];

  const firstValue = (
    value: string | string[] | undefined,
  ): string | undefined => (Array.isArray(value) ? value[0] : value)?.trim();

  const forwardedIp = firstValue(forwarded)?.split(',')[0]?.trim();

  return {
    userAgent: firstValue(userAgent)?.slice(0, 512) ?? null,
    ip: forwardedIp || request.ip || null,
  };
}

/**
 * Autenticacion: cuentas locales, login social y sesiones.
 *
 * Sustituye a `AuthController` de NestJS.
 */
export const authController: FastifyPluginAsync = (fastify) => {
  /**
   * Redirige al frontend con el codigo de traspaso de un solo uso.
   *
   * Los tokens no viajan en la URL: el frontend los pide despues con
   * `POST /auth/social/exchange`.
   */
  const redirectToFrontend = (
    reply: FastifyReply,
    code: string,
    extra: Record<string, string> = {},
  ): FastifyReply => {
    const frontendUrl = appConfig.auth.frontendUrl || 'http://localhost:4321';
    const target = new URL('/cuenta', frontendUrl);
    target.searchParams.set('social', code);
    for (const [key, value] of Object.entries(extra)) {
      target.searchParams.set(key, value);
    }
    return reply.redirect(target.toString());
  };

  fastify.post<{ Body: Static<typeof RegisterBody> }>(
    '/auth/register',
    {
      schema: {
        tags: ['auth'],
        summary: 'Registro con email y contrasena',
        description:
          'Crea una cuenta local. El email se normaliza a minusculas. Si ya ' +
          'existe, devuelve 409.',
        body: RegisterBody,
        response: {
          201: AuthResponse,
          409: errorResponse('El email ya esta registrado'),
        },
      },
      config: {
        auth: 'disabled',
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const { email, password, displayName } = request.body;
      const response = await fastify.services.auth.register(
        email,
        password,
        displayName,
        sessionContext(request),
      );
      return reply.status(201).send(response);
    },
  );

  fastify.post<{ Body: Static<typeof LoginBody> }>(
    '/auth/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Login con email y contrasena',
        description:
          'Devuelve un access token JWT de corta duracion y un refresh token ' +
          'opaco. El error es siempre 401 con el mismo mensaje, exista o no la ' +
          'cuenta.',
        body: LoginBody,
        response: {
          200: AuthResponse,
          401: errorResponse('Credenciales invalidas'),
        },
      },
      config: {
        auth: 'disabled',
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
    },
    async (request) => {
      const { email, password } = request.body;
      return fastify.services.auth.login(
        email,
        password,
        sessionContext(request),
      );
    },
  );

  fastify.post<{ Body: Static<typeof RefreshBody> }>(
    '/auth/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Renueva la sesion',
        description:
          'Rota el refresh token: revoca el token presentado y devuelve un ' +
          'access token y un refresh token nuevos. Si el token ya se habia ' +
          'usado, se revocan todas las sesiones del usuario.',
        body: RefreshBody,
        response: {
          200: AuthResponse,
          401: errorResponse('El refresh token no es valido'),
        },
      },
      config: {
        auth: 'disabled',
        rateLimit: { max: 20, timeWindow: '1 minute' },
      },
    },
    async (request) => {
      return fastify.services.auth.refresh(
        request.body.refreshToken,
        sessionContext(request),
      );
    },
  );

  fastify.post<{ Body: Static<typeof RefreshBody> }>(
    '/auth/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Cierra la sesion actual',
        description:
          'Revoca la sesion del refresh token presentado. Si no se envia ' +
          'token, no revoca nada.',
        body: RefreshBody,
        response: { 200: LogoutResponse },
      },
    },
    async (request) => {
      const user = currentUser(request);
      return fastify.services.auth.logout(
        user!.id,
        request.body?.refreshToken ?? null,
        false,
      );
    },
  );

  fastify.post(
    '/auth/logout-all',
    {
      schema: {
        tags: ['auth'],
        summary: 'Cierra todas las sesiones del usuario',
        description:
          'Revoca todos los refresh tokens vivos del usuario. Se usa tras un ' +
          'cambio de contrasena o cuando se sospecha de un robo de token.',
        response: { 200: LogoutResponse },
      },
    },
    async (request) => {
      const user = currentUser(request);
      return fastify.services.auth.logout(user!.id, null, true);
    },
  );

  fastify.get(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'Perfil del usuario autenticado',
        response: {
          200: AuthUser,
          401: errorResponse('Credenciales invalidas'),
        },
      },
    },
    async (request) => {
      const user = currentUser(request);
      return fastify.services.auth.getProfile(user!.id);
    },
  );

  fastify.patch<{ Body: Static<typeof UpdateProfileBody> }>(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'Actualiza el perfil del usuario autenticado',
        description: 'Por ahora solo se puede cambiar el nombre visible.',
        body: UpdateProfileBody,
        response: { 200: AuthUser },
      },
    },
    async (request) => {
      const user = currentUser(request);
      return fastify.services.auth.updateDisplayName(
        user!.id,
        request.body.displayName,
      );
    },
  );

  fastify.get(
    '/auth/google',
    {
      schema: {
        tags: ['auth'],
        summary: 'Inicia el login con Google',
        description:
          'Redirige al usuario al endpoint de autorizacion de Google con ' +
          '`state` y PKCE (S256). Si Google no esta configurado devuelve 503.',
        response: {
          200: errorResponse('Redireccion al proveedor'),
          503: errorResponse('Google no esta configurado en este entorno'),
        },
      },
      config: { auth: 'disabled' },
    },
    async (request, reply) => {
      fastify.services.googleOAuth.assertConfigured();
      const { codeVerifier, codeChallenge } = generatePkcePair();
      const state = fastify.services.oauthState.create(codeVerifier);
      return reply.redirect(
        fastify.services.googleOAuth.buildAuthorizeUrl(state, codeChallenge),
      );
    },
  );

  fastify.get<{
    Querystring: { code?: string; state?: string };
  }>(
    '/auth/google/callback',
    {
      schema: {
        tags: ['auth'],
        summary: 'Callback de Google',
        description:
          'Valida el `state`, intercambia el authorization code y crea o ' +
          'resuelve la cuenta del usuario.',
        querystring: Type.Object(
          {
            code: Type.Optional(Type.String()),
            state: Type.Optional(Type.String()),
          },
          { additionalProperties: true },
        ),
        response: {
          200: AuthResponse,
          400: errorResponse('El state no es valido'),
        },
      },
      config: { auth: 'disabled' },
    },
    async (request, reply) => {
      const entry = fastify.services.oauthState.consume(
        request.query.state ?? '',
      );
      if (!entry || !entry.codeVerifier) {
        return reply.status(400).send({
          message: 'El state de Google no es valido',
        });
      }

      const tokens = await fastify.services.googleOAuth.exchangeCode(
        request.query.code ?? '',
        entry.codeVerifier,
      );
      const profile = await fastify.services.googleOAuth.fetchProfile(
        tokens.access_token,
      );

      let result: Static<typeof AuthResponse>;
      try {
        result = await fastify.services.socialLogin.loginWithGoogle(
          profile,
          sessionContext(request),
        );
      } catch (error) {
        if (error instanceof SocialLinkRequiredError) {
          return redirectToFrontend(reply, 'link', {
            linkToken: error.linkToken,
            email: error.email,
          });
        }
        throw error;
      }

      const handoff = fastify.services.socialHandoff.create(result);
      return redirectToFrontend(reply, handoff);
    },
  );

  fastify.get(
    '/auth/steam',
    {
      schema: {
        tags: ['auth'],
        summary: 'Inicia el login con Steam',
        description:
          'Redirige al endpoint OpenID 2.0 de Steam con ' +
          '`openid.mode=checkid_setup`.',
        response: {
          200: errorResponse('Redireccion al proveedor'),
          503: errorResponse('Steam no esta configurado en este entorno'),
        },
      },
      config: { auth: 'disabled' },
    },
    async (request, reply) => {
      fastify.services.steamOpenId.assertConfigured();
      const state = fastify.services.oauthState.create();
      return reply.redirect(
        fastify.services.steamOpenId.buildAuthorizeUrl(state),
      );
    },
  );

  fastify.get<{ Querystring: Record<string, string | undefined> }>(
    '/auth/steam/callback',
    {
      schema: {
        tags: ['auth'],
        summary: 'Callback de Steam',
        description:
          'Valida la firma RSA de la respuesta OpenID 2.0, extrae el ' +
          'SteamID64 y crea o resuelve la cuenta del usuario.',
        // La respuesta de Steam trae muchos parametros (`openid.*`), asi
        // que aqui no se restringen las claves admitidas.
        querystring: Type.Object(
          { state: Type.Optional(Type.String()) },
          { additionalProperties: true },
        ),
        response: {
          200: AuthResponse,
          400: errorResponse('El state no es valido'),
        },
      },
      config: { auth: 'disabled' },
    },
    async (request, reply) => {
      const entry = fastify.services.oauthState.consume(
        request.query['state'] ?? '',
      );
      if (!entry) {
        return reply.status(400).send({
          message: 'El state de Steam no es valido',
        });
      }

      const identity = await fastify.services.steamOpenId.validate(
        request.query,
      );

      let result: Static<typeof AuthResponse>;
      try {
        result = await fastify.services.socialLogin.loginWithSteam(
          identity,
          sessionContext(request),
        );
      } catch (error) {
        if (error instanceof SocialLinkRequiredError) {
          return redirectToFrontend(reply, 'link', {
            linkToken: error.linkToken,
            email: error.email,
          });
        }
        throw error;
      }

      const handoff = fastify.services.socialHandoff.create(result);
      return redirectToFrontend(reply, handoff);
    },
  );

  fastify.post<{ Body: Static<typeof SocialExchangeBody> }>(
    '/auth/social/exchange',
    {
      schema: {
        tags: ['auth'],
        summary: 'Canjea el codigo de traspaso de un login social',
        description:
          'El callback de Google o de Steam redirige al frontend con un ' +
          'codigo de un solo uso. Este endpoint devuelve la sesion asociada. ' +
          'El codigo caduca a los dos minutos y no se puede reutilizar.',
        body: SocialExchangeBody,
        response: {
          200: AuthResponse,
          400: errorResponse('El codigo no es valido o ha caducado'),
        },
      },
      config: {
        auth: 'disabled',
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    (request) => {
      const response = fastify.services.socialHandoff.consume(
        request.body.code,
      );
      if (!response) {
        throw new BadRequestException(
          'El codigo de traspaso no es valido o ha caducado',
        );
      }
      return response;
    },
  );

  fastify.post<{ Body: Static<typeof ConfirmLinkBody> }>(
    '/auth/link/confirm',
    {
      schema: {
        tags: ['auth'],
        summary: 'Confirma la vinculacion de una identidad social',
        description:
          'Cuando un login social trae el email de una cuenta local ' +
          'existente, no se vincula automaticamente. Este endpoint confirma ' +
          'la vinculacion con la contrasena de esa cuenta local.',
        body: ConfirmLinkBody,
        response: {
          200: AuthResponse,
          401: errorResponse(
            'El token de vinculacion o la contrasena no son validos',
          ),
        },
      },
      config: {
        auth: 'disabled',
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
    },
    async (request) => {
      const userId = await fastify.services.socialLogin.confirmLink(
        request.body.linkToken,
        request.body.password,
      );
      return fastify.services.socialLogin.buildResponseForUser(
        userId,
        sessionContext(request),
      );
    },
  );
  return Promise.resolve();
};

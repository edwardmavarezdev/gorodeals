import { Type } from '@sinclair/typebox';

/**
 * Esquemas de autenticacion.
 *
 * Traducen los DTO con `class-validator` a JSON Schema: mismas reglas,
 * mismos limites y mismos codigos de error.
 */

/** Datos publicos del usuario. */
export const AuthUser = Type.Object({
  id: Type.String({ description: 'UUID del usuario' }),
  email: Type.String({ description: 'Email de la cuenta' }),
  displayName: Type.String({ description: 'Nombre visible' }),
  avatarUrl: Type.Union([Type.String(), Type.Null()], {
    description: 'URL del avatar, si el proveedor lo publica',
  }),
  providers: Type.Array(Type.String(), {
    description: 'Proveedores de login social vinculados a la cuenta',
    example: ['google'],
  }),
});

/** Sesion emitida por la API. */
export const AuthResponse = Type.Object({
  accessToken: Type.String({
    description: 'Access token JWT de corta duracion',
  }),
  refreshToken: Type.String({
    description:
      'Refresh token opaco. Guardalo en el cliente: solo se almacena su ' +
      'hash en el servidor.',
  }),
  expiresIn: Type.Number({
    description: 'Segundos de validez del access token',
    example: 900,
  }),
  user: AuthUser,
});

/** Registro con email y contrasena. */
export const RegisterBody = Type.Object(
  {
    email: Type.String({
      format: 'email',
      maxLength: 254,
      description: 'Email de la cuenta. Se normaliza a minusculas.',
      example: 'jugador@example.com',
    }),
    password: Type.String({
      minLength: 8,
      maxLength: 128,
      description:
        'Contrasena. Minimo 8 caracteres, combinando letras con numeros o ' +
        'simbolos. No se admiten contrasenas comunes.',
    }),
    displayName: Type.String({
      minLength: 1,
      maxLength: 80,
      description: 'Nombre visible en el perfil',
      example: 'Jugador',
    }),
  },
  { additionalProperties: false },
);

/** Login con email y contrasena. */
export const LoginBody = Type.Object(
  {
    email: Type.String({
      format: 'email',
      maxLength: 254,
      description: 'Email de la cuenta',
      example: 'jugador@example.com',
    }),
    password: Type.String({
      minLength: 8,
      maxLength: 128,
      description: 'Contrasena de la cuenta',
    }),
  },
  { additionalProperties: false },
);

/** Renovacion de la sesion. */
export const RefreshBody = Type.Object(
  {
    refreshToken: Type.String({
      minLength: 20,
      description:
        'Refresh token opaco entregado en el login. Se rota: cada uso ' +
        'devuelve un token nuevo y revoca el anterior.',
    }),
  },
  { additionalProperties: false },
);

/** Canje del codigo de traspaso de un login social. */
export const SocialExchangeBody = Type.Object(
  {
    code: Type.String({
      minLength: 20,
      maxLength: 128,
      description:
        'Codigo de un solo uso que devuelve la redireccion del login social ' +
        '(Google o Steam) al frontend.',
    }),
  },
  { additionalProperties: false },
);

/** Confirmacion de la vinculacion de una identidad social. */
export const ConfirmLinkBody = Type.Object(
  {
    linkToken: Type.String({
      minLength: 20,
      description:
        'Token de vinculacion de un solo uso devuelto por el callback ' +
        'social cuando el email ya existe en una cuenta local.',
    }),
    password: Type.String({
      minLength: 8,
      maxLength: 128,
      description:
        'Contrasena de la cuenta local. Se usa para demostrar la ' +
        'titularidad antes de vincular la identidad social.',
    }),
  },
  { additionalProperties: false },
);

/** Actualizacion del perfil. */
export const UpdateProfileBody = Type.Object(
  {
    displayName: Type.String({
      minLength: 1,
      maxLength: 80,
      description: 'Nuevo nombre visible',
      example: 'Jugador',
    }),
  },
  { additionalProperties: false },
);

/** Resultado de cerrar sesion. */
export const LogoutResponse = Type.Object({
  revoked: Type.Number({
    description: 'Numero de sesiones revocadas',
    example: 1,
  }),
});

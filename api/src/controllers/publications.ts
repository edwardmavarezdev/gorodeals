import type { Static } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import {
  PublicationCategoriesResponse,
  PublicationDetail,
  PublicationListResponse,
  PublicationQuery,
} from '../schemas/publications.js';
import { errorResponse } from '../schemas/error.js';

/**
 * Contenido editorial.
 *
 * Sustituye a `PublicationsController` de NestJS.
 */
export const publicationsController: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Querystring: Static<typeof PublicationQuery> }>(
    '/publications',
    {
      schema: {
        tags: ['publications'],
        summary: 'Listado paginado de publicaciones',
        description:
          'Publicaciones editoriales ordenadas por fecha de publicacion ' +
          'descendente. Se puede filtrar por categoria, por saga y buscar ' +
          'por titulo o resumen.',
        querystring: PublicationQuery,
        response: { 200: PublicationListResponse },
      },
      config: { auth: 'disabled' },
    },
    async (request) => {
      return fastify.services.publications.list(request.query);
    },
  );

  fastify.get(
    '/publications/categories',
    {
      schema: {
        tags: ['publications'],
        summary: 'Categorias editoriales con su recuento',
        description:
          'Categorias con al menos una publicacion publicada, con el nombre ' +
          'legible en espanol y el numero de publicaciones de cada una.',
        response: { 200: PublicationCategoriesResponse },
      },
      config: { auth: 'disabled' },
    },
    async () => {
      return fastify.services.publications.categories();
    },
  );

  fastify.get<{ Params: { slug: string } }>(
    '/publications/:slug',
    {
      schema: {
        tags: ['publications'],
        summary: 'Detalle de una publicacion',
        description:
          'Articulo completo con su saga, la ruta de esa saga y los juegos ' +
          'relacionados con su mejor oferta actual.',
        params: {
          type: 'object',
          properties: { slug: { type: 'string' } },
          required: ['slug'],
        },
        response: {
          200: PublicationDetail,
          404: errorResponse('La publicacion no existe o no esta publicada'),
        },
      },
      config: { auth: 'disabled' },
    },
    async (request) => {
      return fastify.services.publications.findBySlug(request.params.slug);
    },
  );
  return Promise.resolve();
};

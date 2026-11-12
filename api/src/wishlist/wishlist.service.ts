import type { Static } from '@sinclair/typebox';
import { Repository } from 'typeorm';
import { WishlistItem } from './entities/wishlist-item.entity.js';
import { Game } from '../games/entities/game.entity.js';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '../errors.js';
import {
  AddWishlistItemBody,
  WishlistItem as WishlistItemSchema,
  WishlistResponse as WishlistResponseSchema,
} from '../schemas/wishlist.js';

/** Datos para anadir un juego a la lista de deseos. */
export type AddWishlistItem = Static<typeof AddWishlistItemBody>;

/** Entrada de la lista de deseos en su forma publica. */
export type WishlistItemDto = Static<typeof WishlistItemSchema>;

/** Pagina de la lista de deseos. */
export type WishlistResponseDto = Static<typeof WishlistResponseSchema>;

/**
 * Lista de deseos del usuario.
 *
 * Toda operacion se filtra por `userId`, que viene siempre del access
 * token (`req.user.sub`): un usuario no puede leer ni modificar la lista de
 * otro.
 */
export class WishlistService {
  constructor(
    private readonly wishlistRepo: Repository<WishlistItem>,
    private readonly gameRepo: Repository<Game>,
  ) {}

  /** Lista paginada del usuario. */
  async list(
    userId: string,
    page: number,
    limit: number,
  ): Promise<WishlistResponseDto> {
    const offset = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.wishlistRepo.find({
        where: { userId },
        relations: { game: true },
        order: { createdAt: 'DESC' },
        skip: offset,
        take: limit,
      }),
      this.wishlistRepo.count({ where: { userId } }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((item) => toDto(item)),
    };
  }

  /**
   * Anade un juego a la lista. El juego se puede indicar por `gameId` o
   * por `slug`; si no existe en el catalogo, 404.
   */
  async add(userId: string, dto: AddWishlistItem): Promise<WishlistItemDto> {
    if (!dto.gameId && !dto.slug) {
      throw new BadRequestException('Indica el juego por gameId o por slug');
    }

    const game = await this.resolveGame(dto);
    if (!game) {
      throw new NotFoundException('El juego no existe');
    }

    const existing = await this.wishlistRepo.findOne({
      where: { userId, gameId: game.id },
    });
    if (existing) {
      throw new ConflictException('El juego ya esta en la lista de deseos');
    }

    const item = await this.wishlistRepo.save(
      this.wishlistRepo.create({
        userId,
        gameId: game.id,
        store: dto.store ?? null,
        storeItemId: dto.storeItemId ?? null,
        note: dto.note ?? null,
      }),
    );

    return toDto({ ...item, game });
  }

  /**
   * Quita un juego de la lista. Se puede indicar por `gameId` o por `slug`.
   * Devuelve `false` si el juego no estaba en la lista.
   */
  async remove(
    userId: string,
    gameId?: string,
    slug?: string,
  ): Promise<boolean> {
    let targetGameId = gameId;
    if (!targetGameId && slug) {
      const game = await this.gameRepo.findOne({ where: { slug } });
      if (!game) {
        throw new NotFoundException('El juego no existe');
      }
      targetGameId = game.id;
    }
    if (!targetGameId) {
      throw new BadRequestException('Indica el juego por gameId o por slug');
    }

    const result = await this.wishlistRepo.delete({
      userId,
      gameId: targetGameId,
    });
    return (result.affected ?? 0) > 0;
  }

  /** Entradas del usuario, para la sincronizacion con tiendas externas. */
  async listRaw(userId: string): Promise<WishlistItem[]> {
    return this.wishlistRepo.find({ where: { userId } });
  }

  /** Resuelve el juego por id o por slug. */
  private async resolveGame(dto: AddWishlistItem): Promise<Game | null> {
    if (dto.gameId) {
      return this.gameRepo.findOne({ where: { id: dto.gameId } });
    }
    return this.gameRepo.findOne({ where: { slug: dto.slug } });
  }
}

/** Proyecta la entidad a la forma publica de la API. */
export function toDto(item: WishlistItem): WishlistItemDto {
  return {
    id: item.id,
    gameId: item.gameId,
    slug: item.game?.slug ?? '',
    title: item.game?.title ?? '',
    coverUrl: item.game?.coverUrl ?? null,
    store: item.store,
    storeItemId: item.storeItemId,
    note: item.note,
    createdAt: item.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

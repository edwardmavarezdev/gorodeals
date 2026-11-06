import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../database/typeorm-transformers.js';
import { Game } from '../../games/entities/game.entity.js';

export enum StoreName {
  STEAM = 'steam',
  GOG = 'gog',
  NINTENDO = 'nintendo',
}

/**
 * Oferta de un juego en una tienda concreta. La identidad del producto es
 * (store_name, store_product_id) a nivel global: un mismo producto pertenece
 * a un unico juego, lo que hace idempotente el upsert del sync.
 */
@Entity({ name: 'store_products' })
/**
 * Clave natural de la oferta: un (tienda, id de producto) pertenece a un
 * unico juego del catalogo. Es la clave de conflicto del upsert.
 */
@Unique('uq_store_products_store_product', ['storeName', 'storeProductId'])
@Index('idx_store_products_deal_score', ['dealScore'])
@Index('idx_store_products_game_id', ['gameId'])
/**
 * Soporta la paginacion por cursor del sync de precios:
 * `WHERE store_name = $1 AND id > $2::uuid ORDER BY id LIMIT $3`.
 */
@Index('idx_store_products_store_name_id', ['storeName', 'id'])
@Check(
  'chk_store_products_store_name',
  "\"store_name\" IN ('steam', 'gog', 'nintendo')",
)
@Check('chk_store_products_current_price', '"current_price" >= 0')
@Check('chk_store_products_regular_price', '"regular_price" >= 0')
@Check(
  'chk_store_products_discount_percent',
  '"discount_percent" >= 0 AND "discount_percent" <= 100',
)
@Check(
  'chk_store_products_historical_low_price',
  '"historical_low_price" IS NULL OR "historical_low_price" >= 0',
)
@Check(
  'chk_store_products_deal_score',
  '"deal_score" IS NULL OR ("deal_score" >= 0 AND "deal_score" <= 10)',
)
@Check('chk_store_products_currency', '"currency" ~ \'^[A-Z]{3}$\'')
export class StoreProduct {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'game_id', type: 'uuid' })
  gameId!: string;

  @ManyToOne(() => Game, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'game_id',
    foreignKeyConstraintName: 'fk_store_products_game',
  })
  game!: Game;

  @Column({ name: 'store_name', type: 'text' })
  storeName!: StoreName;

  @Column({ name: 'store_product_id', type: 'text' })
  storeProductId!: string;

  @Column({
    name: 'current_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  currentPrice!: number;

  @Column({
    name: 'regular_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  regularPrice!: number;

  @Column({
    name: 'discount_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  discountPercent!: number;

  /** Moneda ISO 4217 del precio. Steam y GOG publican en EUR/USD segun region. */
  @Column({ name: 'currency', type: 'text', default: 'USD' })
  currency!: string;

  @Column({ name: 'url', type: 'text', nullable: true })
  url!: string | null;

  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable!: boolean;

  @Column({
    name: 'last_checked_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  lastCheckedAt!: Date;

  /** Minimo historico observado; alimenta el Deal Score de Fase 5. */
  @Column({
    name: 'historical_low_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  historicalLowPrice!: number | null;

  /** Deal Score 0-10 persistido por el servicio de Fase 5; NULL = no puntuado. */
  @Column({
    name: 'deal_score',
    type: 'numeric',
    precision: 3,
    scale: 1,
    nullable: true,
    transformer: numericTransformer,
  })
  dealScore!: number | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  updatedAt!: Date;
}

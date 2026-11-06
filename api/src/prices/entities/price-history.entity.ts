import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../database/typeorm-transformers.js';
import { StoreProduct } from '../../store-products/entities/store-product.entity.js';

export enum PriceHistorySource {
  SYNC = 'sync',
  MANUAL = 'manual',
  SEED = 'seed',
  IMPORT = 'import',
}

/**
 * Historico append-only de precios. Una fila por producto de tienda y dia:
 * la clave natural es (store_product_id, recorded_at) y el sync de Fase 3
 * escribe `recorded_at` truncado al dia (UTC) para ser idempotente.
 *
 * No hay indices adicionales: el UNIQUE (store_product_id, recorded_at) sirve
 * tanto la busqueda por producto como el barrido inverso por
 * `recorded_at DESC` (verificado con EXPLAIN), de modo que los indices
 * `idx_price_history_store_product_id` y
 * `idx_price_history_store_product_recorded_at_desc` eran redundantes.
 */
@Entity({ name: 'price_history' })
@Unique('uq_price_history_store_product_recorded_at', [
  'storeProductId',
  'recordedAt',
])
@Check('chk_price_history_price', '"price" >= 0')
@Check(
  'chk_price_history_regular_price',
  '"regular_price" IS NULL OR "regular_price" >= 0',
)
@Check(
  'chk_price_history_discount_percent',
  '"discount_percent" IS NULL OR ("discount_percent" >= 0 AND "discount_percent" <= 100)',
)
@Check(
  'chk_price_history_source',
  "\"source\" IN ('sync', 'manual', 'seed', 'import')",
)
export class PriceHistory {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'store_product_id', type: 'uuid' })
  storeProductId!: string;

  @ManyToOne(() => StoreProduct, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'store_product_id',
    foreignKeyConstraintName: 'fk_price_history_store_product',
  })
  storeProduct!: StoreProduct;

  @Column({
    name: 'price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  price!: number;

  /** Precio de lista en el momento del registro; desnormalizado a proposito. */
  @Column({
    name: 'regular_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  regularPrice!: number | null;

  @Column({
    name: 'discount_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  discountPercent!: number | null;

  @Column({ name: 'source', type: 'text', default: PriceHistorySource.SYNC })
  source!: PriceHistorySource;

  @Column({
    name: 'recorded_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  recordedAt!: Date;

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

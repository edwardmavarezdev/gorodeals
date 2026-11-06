import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'franchises' })
@Unique('uq_franchises_slug', ['slug'])
@Check('chk_franchises_slug', '"slug" ~ \'^[a-z0-9]+(-[a-z0-9]+)*$\'')
export class Franchise {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'name', type: 'text' })
  name!: string;

  @Column({ name: 'slug', type: 'text' })
  slug!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

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

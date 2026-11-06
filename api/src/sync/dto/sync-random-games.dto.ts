import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Parametros de `POST /admin/sync/random`.
 *
 * Se validan con el `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted`),
 * de modo que cualquier parametro no declarado se rechaza.
 */
export class SyncRandomGamesDto {
  @ApiPropertyOptional({
    description: 'Numero de juegos a traer por tienda (1-100).',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  count?: number;

  @ApiPropertyOptional({
    description: 'Tiendas a sincronizar, separadas por coma (steam,nintendo).',
    example: 'steam,nintendo',
  })
  @IsOptional()
  @IsString()
  platforms?: string;

  @ApiPropertyOptional({
    description:
      'Semilla de la seleccion aleatoria. Por defecto se usa una semilla ' +
      'fija para que la sincronizacion sea idempotente.',
    example: 42,
  })
  @IsOptional()
  @IsInt()
  seed?: number;

  @ApiPropertyOptional({
    description:
      'Si es true, anade juegos aleatorios nuevos en lugar de refrescar ' +
      'los ya sincronizados.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  onlyNew?: boolean;
}

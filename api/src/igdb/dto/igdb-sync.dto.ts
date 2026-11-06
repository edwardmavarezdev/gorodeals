import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class IgdbSyncDto {
  @ApiPropertyOptional({
    description:
      'Consulta Apicalypse completa a ejecutar. Si se omite se sincroniza por lotes sobre `name`.',
    example: 'fields id, name, slug, cover.image_id; search "zelda"; limit 50;',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  query?: string;

  @ApiPropertyOptional({
    description:
      'Numero de juegos a sincronizar cuando no se indica `query` (pagina sobre el catalogo de IGDB)',
    minimum: 1,
    maximum: 50,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Desplazamiento (offset) para la paginacion del catalogo',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Filtros de la ficha de un juego.
 */
export class GameDetailQueryDto {
  @ApiPropertyOptional({
    description:
      'Meses de historico de precios a incluir (por defecto 3, es decir 90 dias)',
    minimum: 1,
    maximum: 60,
    default: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  months?: number;
}

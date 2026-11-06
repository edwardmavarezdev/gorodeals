import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Parametros de la consulta del historico de precios.
 *
 * Antes se validaba a mano en el controlador: un valor invalido se
 * normalizaba en silencio a 12 en lugar de devolver un 400. Con el DTO, la
 * validacion la hace el `ValidationPipe` global.
 */
export class PriceHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Ventana temporal del historico en meses (1-60)',
    minimum: 1,
    maximum: 60,
    default: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  windowMonths?: number;
}

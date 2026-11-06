import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class IgdbSearchQueryDto {
  @ApiProperty({
    description:
      'Texto de busqueda por nombre de juego en IGDB (maximo 100 caracteres)',
    example: 'resident evil',
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({
    description: 'Numero maximo de resultados (IGDB admite un maximo de 50)',
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FranchiseRouteDto } from '../../franchises/dto/franchise-route.dto.js';
import { GameDetailDto } from './game-detail.dto.js';
import { OfferDto } from './offer.dto.js';
import { PriceHistoryPointDto } from './price-history-point.dto.js';

/**
 * Respuesta completa de la ficha de un juego: metadatos, ofertas, historico
 * de precios y la saga a la que pertenece (si la hay).
 */
export class GameDetailResponseDto {
  @ApiProperty({ type: GameDetailDto })
  game!: GameDetailDto;

  @ApiProperty({ type: [OfferDto] })
  offers!: OfferDto[];

  @ApiProperty({ type: [PriceHistoryPointDto] })
  priceHistory!: PriceHistoryPointDto[];

  @ApiPropertyOptional({
    description: 'Saga a la que pertenece el juego, con su ruta',
    type: FranchiseRouteDto,
    nullable: true,
  })
  franchise!: FranchiseRouteDto | null;
}

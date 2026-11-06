import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PricesService, DEFAULT_SERIES_MONTHS } from './prices.service.js';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto.js';
import { PriceHistoryResponseDto } from './dto/price-history-response.dto.js';

@ApiTags('prices')
@Controller('games/:id/price-history')
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get()
  @ApiOperation({
    summary: 'Serie temporal de precios de un juego',
    description:
      'Devuelve la serie de precios de la mejor oferta del juego (o de la ' +
      'oferta indicada en `storeProductId`) con el granularity de un dia. ' +
      'El historico se limita a los ultimos `months` meses (1-60).',
  })
  @ApiOkResponse({ type: PriceHistoryResponseDto })
  @ApiNotFoundResponse({
    description: 'El juego no existe o no tiene ofertas registradas',
  })
  async getPriceHistory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: PriceHistoryQueryDto,
  ): Promise<PriceHistoryResponseDto> {
    const months = query.months ?? DEFAULT_SERIES_MONTHS;
    return this.pricesService.findSeriesForGame(
      id,
      months,
      query.storeProductId,
    );
  }
}

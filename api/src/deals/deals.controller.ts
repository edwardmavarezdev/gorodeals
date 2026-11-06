import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DealsService } from './deals.service.js';
import { HottestDealsQueryDto } from './dto/hottest-deals-query.dto.js';
import { HottestDealsResponseDto } from './dto/hottest-deals-response.dto.js';

@ApiTags('deals')
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get('hottest')
  @ApiOperation({
    summary: 'Top de ofertas por Deal Score',
    description:
      'Ofertas disponibles con descuento, ordenadas por Deal Score. Cuando la ' +
      'oferta aun no tiene `deal_score` persistido, el score se calcula en ' +
      'memoria con el servicio de Deal Score.',
  })
  @ApiOkResponse({ type: HottestDealsResponseDto })
  async hottest(
    @Query() query: HottestDealsQueryDto,
  ): Promise<HottestDealsResponseDto> {
    return this.dealsService.hottest(query.limit ?? 20);
  }
}

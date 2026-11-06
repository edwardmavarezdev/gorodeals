import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FranchisesService } from './franchises.service.js';
import { FranchiseRouteDto } from './dto/franchise-route.dto.js';

@ApiTags('franchises')
@Controller('franchises')
export class FranchisesController {
  constructor(private readonly franchisesService: FranchisesService) {}

  @Get(':slug/route')
  @ApiOperation({
    summary: 'Ruta de juego recomendada de una saga',
    description:
      'Devuelve los juegos de la saga ordenados por posicion, con una nota ' +
      'del editor en cada entrada y los metadatos minimos de cada juego.',
  })
  @ApiOkResponse({ type: FranchiseRouteDto })
  @ApiNotFoundResponse({ description: 'La saga no existe' })
  async getRoute(@Param('slug') slug: string): Promise<FranchiseRouteDto> {
    return this.franchisesService.findRouteBySlug(slug);
  }
}

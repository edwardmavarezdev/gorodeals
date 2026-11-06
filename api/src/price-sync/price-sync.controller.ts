import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PriceHistoryService } from './history/price-history.service.js';
import { PriceSyncAdminGuard } from './price-sync-admin.guard.js';
import { PriceSyncService } from './price-sync.service.js';
import { PriceHistoryEntryDto } from './dto/price-history.dto.js';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto.js';
import { PriceSyncRunDto } from './dto/price-sync-run.dto.js';
import {
  PriceSyncRunResultDto,
  PriceSyncStatusDto,
} from './dto/price-sync-run-result.dto.js';

@ApiTags('price-sync')
@Controller('price-sync')
export class PriceSyncController {
  constructor(
    private readonly priceSyncService: PriceSyncService,
    private readonly historyService: PriceHistoryService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Estado del modulo de sincronizacion de precios',
    description:
      'Devuelve la configuracion efectiva (cron, zona horaria, tiendas, tamano de lote) ' +
      'y el resultado de la ultima ejecucion del sync.',
  })
  @ApiOkResponse({ type: PriceSyncStatusDto })
  status(): PriceSyncStatusDto {
    return this.priceSyncService.getStatus();
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PriceSyncAdminGuard)
  @ApiOperation({
    summary: 'Lanza manualmente un ciclo de sincronizacion de precios',
    description:
      'Recorre el catalogo de ofertas de forma paginada, consulta el precio actual en la ' +
      'tienda, actualiza `store_products` y registra las variaciones en `price_history`. ' +
      'Requiere el secreto de administrador en la cabecera `x-admin-secret`. ' +
      'La operacion es idempotente: repetirla el mismo dia no duplica el historico.',
  })
  @ApiOkResponse({ type: PriceSyncRunResultDto })
  @ApiForbiddenResponse({ description: 'Secreto de administrador invalido' })
  @ApiBadRequestResponse({ description: 'Parametros invalidos' })
  async run(@Body() dto: PriceSyncRunDto): Promise<PriceSyncRunResultDto> {
    const result = await this.priceSyncService.runSync({
      storeNames: dto.storeNames,
      batchSize: dto.batchSize,
      catalogPages: dto.catalogPages,
      maxProducts: dto.maxProducts,
    });

    return {
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      durationMs: result.durationMs,
      skipped: result.skipped,
      skipReason: result.skipReason,
      stores: result.stores,
      totals: result.totals,
      catalog: result.catalog,
    };
  }

  @Get('history/:storeProductId')
  @ApiOperation({
    summary: 'Historico de precios de una oferta',
    description:
      'Devuelve la serie de precios registrada para una oferta dentro de la ventana ' +
      'temporal configurada (12 meses por defecto).',
  })
  @ApiParam({ name: 'storeProductId', description: 'uuid de store_products' })
  @ApiQuery({
    name: 'windowMonths',
    required: false,
    description: 'Ventana temporal del historico en meses (1-60)',
  })
  @ApiOkResponse({ type: [PriceHistoryEntryDto] })
  @ApiBadRequestResponse({ description: 'Parametros invalidos' })
  async history(
    @Param('storeProductId', ParseUUIDPipe) storeProductId: string,
    @Query() query: PriceHistoryQueryDto,
  ): Promise<PriceHistoryEntryDto[]> {
    const months = query.windowMonths ?? 12;
    const rows = await this.historyService.findHistory(storeProductId, months);
    return rows.map((row) => ({
      id: row.id,
      storeProductId: row.storeProductId,
      price: row.price,
      regularPrice: row.regularPrice,
      discountPercent: row.discountPercent,
      source: row.source,
      recordedAt: row.recordedAt.toISOString(),
    }));
  }
}

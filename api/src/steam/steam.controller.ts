import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { SteamService } from './steam.service.js';
import { SteamAdminGuard } from './steam-admin.guard.js';
import { SyncSteamAppDto } from './dto/sync-steam-app.dto.js';
import { SteamBatchDto } from './dto/steam-batch.dto.js';
import { SteamPriceSnapshotDto } from './dto/steam-price-snapshot.dto.js';
import { SteamSyncSummaryDto } from './dto/steam-sync-summary.dto.js';
import {
  STEAM_BATCH_RESPONSE_SCHEMA,
  SteamBatchResponseDto,
} from './dto/steam-batch-response.dto.js';

@ApiTags('steam')
@Controller('steam')
export class SteamController {
  constructor(private readonly steamService: SteamService) {}

  @Get('app/:appId')
  @ApiOperation({
    summary: 'Precio y metadatos actuales de un appid de Steam',
    description:
      'Consulta la API publica de la tienda de Steam y devuelve el precio actual, ' +
      'el precio regular, el descuento, la moneda y la valoracion de usuarios. ' +
      'No persiste nada.',
  })
  @ApiOkResponse({ type: SteamPriceSnapshotDto })
  @ApiNotFoundResponse({ description: 'Steam no publica datos para el appid' })
  @ApiUnprocessableEntityResponse({
    description: 'El juego no tiene precio en la region configurada',
  })
  @ApiBadGatewayResponse({ description: 'La API de Steam no esta disponible' })
  async getApp(
    @Param('appId', ParseIntPipe) appId: number,
  ): Promise<SteamPriceSnapshotDto> {
    return this.steamService.getPricedSnapshot(appId);
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SteamAdminGuard)
  @ApiOperation({
    summary: 'Precios de un lote de appids de Steam',
    description:
      'Consulta hasta 100 appids en un solo lote. Los appids sin datos publicados ' +
      'por Steam se omiten del resultado. ' +
      'Requiere el secreto de administrador en la cabecera `x-admin-secret`: ' +
      'sin el, el endpoint podria usarse como proxy amplificador contra la ' +
      'API de la tienda (100 peticiones salientes por llamada).',
  })
  @ApiOkResponse({ schema: STEAM_BATCH_RESPONSE_SCHEMA })
  @ApiForbiddenResponse({ description: 'Secreto de administrador invalido' })
  @ApiBadGatewayResponse({ description: 'La API de Steam no esta disponible' })
  async getBatch(@Body() dto: SteamBatchDto): Promise<SteamBatchResponseDto> {
    const snapshots = await this.steamService.getPriceSnapshots(dto.appIds);
    const result: SteamBatchResponseDto = {};
    for (const [appId, snapshot] of snapshots) {
      result[String(appId)] = snapshot;
    }
    return result;
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SteamAdminGuard)
  @ApiOperation({
    summary: 'Sincroniza precios de Steam contra un juego del catalogo',
    description:
      'Descarga el precio actual de cada appid y hace upsert idempotente en ' +
      'store_products sobre (store_name, store_product_id). Repetir la llamada ' +
      'nunca duplica filas. ' +
      'Requiere el secreto de administrador en la cabecera `x-admin-secret` ' +
      '(STEAM_ADMIN_SECRET, con fallback a IGDB_ADMIN_SECRET).',
  })
  @ApiOkResponse({ type: SteamSyncSummaryDto })
  @ApiForbiddenResponse({ description: 'Secreto de administrador invalido' })
  @ApiNotFoundResponse({ description: 'El juego indicado no existe' })
  @ApiBadGatewayResponse({ description: 'La API de Steam no esta disponible' })
  async sync(@Body() dto: SyncSteamAppDto): Promise<SteamSyncSummaryDto> {
    return this.steamService.syncGame(dto.gameId, dto.appIds);
  }

  @Get('product/:appId')
  @ApiOperation({
    summary: 'Oferta de Steam persistida en el catalogo',
    description:
      'Devuelve la fila de store_products asociada al appid, con el precio ' +
      'vigente en la ultima comprobacion.',
  })
  @ApiOkResponse({ description: 'Oferta persistida' })
  @ApiNotFoundResponse({ description: 'No existe oferta para el appid' })
  async getProduct(@Param('appId', ParseIntPipe) appId: number) {
    const product = await this.steamService.getStoreProductOrFail(appId);
    return {
      id: product.id,
      gameId: product.gameId,
      storeName: product.storeName,
      storeProductId: product.storeProductId,
      currentPrice: product.currentPrice,
      regularPrice: product.regularPrice,
      discountPercent: product.discountPercent,
      currency: product.currency,
      url: product.url,
      isAvailable: product.isAvailable,
      lastCheckedAt: product.lastCheckedAt,
      historicalLowPrice: product.historicalLowPrice,
    };
  }
}

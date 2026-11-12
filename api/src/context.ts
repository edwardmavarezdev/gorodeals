import { DataSource } from 'typeorm';
import { appConfig, resolveJwtSecret } from './config.js';

import { Game } from './games/entities/game.entity.js';
import { StoreProduct } from './store-products/entities/store-product.entity.js';
import { PriceHistory } from './prices/entities/price-history.entity.js';
import { Franchise } from './franchises/entities/franchise.entity.js';
import { FranchisePlayOrder } from './franchises/entities/franchise-play-order.entity.js';
import { Publication } from './publications/entities/publication.entity.js';
import { User } from './users/entities/user.entity.js';
import { SocialAccount } from './users/entities/social-account.entity.js';
import { RefreshToken } from './auth/entities/refresh-token.entity.js';
import { WishlistItem } from './wishlist/entities/wishlist-item.entity.js';

import { UsersService } from './users/users.service.js';
import { PasswordService } from './auth/password.service.js';
import { TokenService } from './auth/token.service.js';
import { SessionService } from './auth/session.service.js';
import { AccountLinkingService } from './auth/account-linking.service.js';
import { AuthService } from './auth/auth.service.js';
import { SocialLoginService } from './auth/social-login.service.js';
import { GoogleOAuthService } from './auth/google-oauth.service.js';
import { SteamOpenIdService } from './auth/steam-openid.service.js';
import { OAuthStateService } from './auth/oauth-state.service.js';
import { PendingLinkService } from './auth/pending-link.service.js';
import { SocialHandoffService } from './auth/social-handoff.service.js';

import { SteamClient } from './steam/steam.client.js';
import { SteamService } from './steam/steam.service.js';
import { IgdbClient } from './igdb/igdb.client.js';
import { IgdbService } from './igdb/igdb.service.js';

import { DealScoreService } from './deals/deal-score.service.js';
import { DealsService } from './deals/deals.service.js';
import { PricesService } from './prices/prices.service.js';
import { FranchisesService } from './franchises/franchises.service.js';
import { GamesService } from './games/games.service.js';
import { PublicationsService } from './publications/publications.service.js';
import { WishlistService } from './wishlist/wishlist.service.js';
import { StoreSyncService } from './wishlist/store-sync.service.js';
import { PriceHistoryService } from './price-sync/history/price-history.service.js';
import { SteamPriceProvider } from './price-sync/providers/steam-price.provider.js';
import { PriceSyncService } from './price-sync/price-sync.service.js';
import { SyncRandomGamesService } from './sync/sync-random-games.service.js';

/**
 * Grafo de servicios de la aplicacion.
 *
 * En NestJS esto lo resolvia el contenedor de inyeccion de dependencias.
 * Aqui se construye **a mano**: cada servicio recibe por constructor
 * exactamente lo que usa. Es mas explicito (se ve de un vistazo quien
 * depende de quien) y no obliga a un contenedor para resolver un grafo de
 * este tamano.
 */
export interface Services {
  // Autenticacion
  users: UsersService;
  password: PasswordService;
  token: TokenService;
  session: SessionService;
  accountLinking: AccountLinkingService;
  auth: AuthService;
  socialLogin: SocialLoginService;
  googleOAuth: GoogleOAuthService;
  steamOpenId: SteamOpenIdService;
  oauthState: OAuthStateService;
  pendingLink: PendingLinkService;
  socialHandoff: SocialHandoffService;

  // Lectura del catalogo
  dealScore: DealScoreService;
  deals: DealsService;
  prices: PricesService;
  franchises: FranchisesService;
  games: GamesService;
  publications: PublicationsService;

  // Wishlist
  wishlist: WishlistService;
  storeSync: StoreSyncService;

  // Ingesta y precios
  steamClient: SteamClient;
  steam: SteamService;
  igdbClient: IgdbClient;
  igdb: IgdbService;
  priceHistory: PriceHistoryService;
  steamPriceProvider: SteamPriceProvider;
  priceSync: PriceSyncService;
  syncRandomGames: SyncRandomGamesService;
}

/**
 * Construye el grafo de servicios a partir de la conexion de TypeORM.
 *
 * El orden de construccion es el orden de dependencia: primero las hojas
 * (repositorios, clientes, hashing) y despues las que las usan.
 */
export function buildServices(dataSource: DataSource): Services {
  const secret = resolveJwtSecret();

  // ---Repositorios ---------------------------------------------------
  const gameRepo = dataSource.getRepository(Game);
  const storeProductRepo = dataSource.getRepository(StoreProduct);
  const priceHistoryRepo = dataSource.getRepository(PriceHistory);
  const franchiseRepo = dataSource.getRepository(Franchise);
  const playOrderRepo = dataSource.getRepository(FranchisePlayOrder);
  const publicationRepo = dataSource.getRepository(Publication);
  const userRepo = dataSource.getRepository(User);
  const socialAccountRepo = dataSource.getRepository(SocialAccount);
  const refreshTokenRepo = dataSource.getRepository(RefreshToken);
  const wishlistRepo = dataSource.getRepository(WishlistItem);

  // ---Autenticacion -------------------------------------------------
  const usersService = new UsersService(userRepo, socialAccountRepo);
  const passwordService = new PasswordService();
  const tokenService = new TokenService(secret);
  const sessionService = new SessionService(
    refreshTokenRepo,
    tokenService,
    dataSource,
  );
  const pendingLinkService = new PendingLinkService();
  const accountLinkingService = new AccountLinkingService(
    usersService,
    passwordService,
    pendingLinkService,
  );
  const authService = new AuthService(
    usersService,
    passwordService,
    sessionService,
    tokenService,
    accountLinkingService,
  );
  const socialLoginService = new SocialLoginService(
    accountLinkingService,
    authService,
    usersService,
  );
  const googleOAuthService = new GoogleOAuthService(appConfig);
  const steamOpenIdService = new SteamOpenIdService(appConfig);
  const oauthStateService = new OAuthStateService();
  const socialHandoffService = new SocialHandoffService();

  // ---Lectura del catalogo -------------------------------------------
  const dealScoreService = new DealScoreService();
  const pricesService = new PricesService(priceHistoryRepo, storeProductRepo);
  const franchisesService = new FranchisesService(franchiseRepo, playOrderRepo);
  const gamesService = new GamesService(
    gameRepo,
    storeProductRepo,
    pricesService,
    franchisesService,
    dealScoreService,
    dataSource,
  );
  const dealsService = new DealsService(dataSource, dealScoreService);
  const publicationsService = new PublicationsService(
    publicationRepo,
    franchisesService,
    dataSource,
  );

  // ---Wishlist -------------------------------------------------------
  const wishlistService = new WishlistService(wishlistRepo, gameRepo);
  const storeSyncService = new StoreSyncService(appConfig);

  // ---Ingesta y precios ----------------------------------------------
  const steamClient = new SteamClient(appConfig);
  const steamService = new SteamService(
    steamClient,
    storeProductRepo,
    gameRepo,
    appConfig,
  );
  const igdbClient = new IgdbClient(appConfig);
  const igdbService = new IgdbService(igdbClient, gameRepo);
  const priceHistoryService = new PriceHistoryService(dataSource);
  const steamPriceProvider = new SteamPriceProvider(
    dataSource,
    steamService,
    appConfig,
  );
  const priceSyncService = new PriceSyncService(
    dataSource,
    appConfig,
    priceHistoryService,
    steamPriceProvider,
    igdbService,
  );
  const syncRandomGamesService = new SyncRandomGamesService(
    gameRepo,
    storeProductRepo,
    priceHistoryRepo,
    appConfig,
  );

  return {
    users: usersService,
    password: passwordService,
    token: tokenService,
    session: sessionService,
    accountLinking: accountLinkingService,
    auth: authService,
    socialLogin: socialLoginService,
    googleOAuth: googleOAuthService,
    steamOpenId: steamOpenIdService,
    oauthState: oauthStateService,
    pendingLink: pendingLinkService,
    socialHandoff: socialHandoffService,
    dealScore: dealScoreService,
    deals: dealsService,
    prices: pricesService,
    franchises: franchisesService,
    games: gamesService,
    publications: publicationsService,
    wishlist: wishlistService,
    storeSync: storeSyncService,
    steamClient,
    steam: steamService,
    igdbClient,
    igdb: igdbService,
    priceHistory: priceHistoryService,
    steamPriceProvider,
    priceSync: priceSyncService,
    syncRandomGames: syncRandomGamesService,
  };
}

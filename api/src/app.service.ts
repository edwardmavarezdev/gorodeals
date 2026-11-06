import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface HealthStatus {
  status: string;
  database: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Estado del servicio y de la base de datos. El endpoint de salud consulta
   * la base de datos con un `SELECT 1`: si la conexion falla, `database`
   * pasa a `down` y `status` a `degraded`, sin propagar el error.
   */
  async getHealth(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'up', timestamp };
    } catch (error) {
      this.logger.error(
        `Fallo al comprobar la base de datos: ${(error as Error).message}`,
      );
      return { status: 'degraded', database: 'down', timestamp };
    }
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DataSource, useValue: { query } }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('GET /health', () => {
    it('devuelve el estado del servicio y de la base de datos', async () => {
      const health = await appController.getHealth();

      expect(health.status).toBe('ok');
      expect(health.database).toBe('up');
      expect(Number.isNaN(Date.parse(health.timestamp))).toBe(false);
      expect(query).toHaveBeenCalledWith('SELECT 1');
    });

    it('informa de la base de datos caida sin propagar el error', async () => {
      query.mockRejectedValue(new Error('connection refused'));

      const health = await appController.getHealth();

      expect(health.status).toBe('degraded');
      expect(health.database).toBe('down');
    });
  });
});

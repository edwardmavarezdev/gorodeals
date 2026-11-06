import { computeDealScore, DealScoreService } from './deal-score.service.js';

describe('computeDealScore', () => {
  it('devuelve solo el componente historico neutral cuando no hay datos', () => {
    expect(
      computeDealScore({
        qualityScore: null,
        discountPercent: null,
        currentPrice: null,
        historicalLowPrice: null,
      }),
    ).toBe(0.8);
  });

  it('puntua 10 con calidad maxima, descuento maximo y precio en minimo historico', () => {
    expect(
      computeDealScore({
        qualityScore: 10,
        discountPercent: 80,
        currentPrice: 19.99,
        historicalLowPrice: 19.99,
      }),
    ).toBe(10);
  });

  it('nunca baja de 0 ni sube de 10', () => {
    expect(
      computeDealScore({
        qualityScore: -5,
        discountPercent: -10,
        currentPrice: 0,
        historicalLowPrice: null,
      }),
    ).toBeGreaterThanOrEqual(0);

    expect(
      computeDealScore({
        qualityScore: 50,
        discountPercent: 500,
        currentPrice: 1,
        historicalLowPrice: 1,
      }),
    ).toBeLessThanOrEqual(10);
  });

  it('satura el peso del descuento al 60%', () => {
    const base = {
      qualityScore: 5,
      currentPrice: 50,
      historicalLowPrice: 50,
    };
    expect(computeDealScore({ ...base, discountPercent: 60 })).toBe(
      computeDealScore({ ...base, discountPercent: 90 }),
    );
  });

  it('premia un precio cercano al minimo historico frente a uno distante', () => {
    const cerca = computeDealScore({
      qualityScore: 7,
      discountPercent: 20,
      currentPrice: 50,
      historicalLowPrice: 45,
    });
    const lejos = computeDealScore({
      qualityScore: 7,
      discountPercent: 20,
      currentPrice: 100,
      historicalLowPrice: 40,
    });
    expect(cerca).toBeGreaterThan(lejos);
  });

  it('es monotono en el descuento', () => {
    const previo = computeDealScore({
      qualityScore: 8,
      discountPercent: 10,
      currentPrice: 40,
      historicalLowPrice: 40,
    });
    const posterior = computeDealScore({
      qualityScore: 8,
      discountPercent: 30,
      currentPrice: 40,
      historicalLowPrice: 40,
    });
    expect(posterior).toBeGreaterThan(previo);
  });

  it('redondea a un decimal', () => {
    const score = computeDealScore({
      qualityScore: 7.3,
      discountPercent: 17,
      currentPrice: 33.33,
      historicalLowPrice: 30,
    });
    expect(score).toBe(Math.round(score * 10) / 10);
  });
});

describe('DealScoreService', () => {
  it('delega en la función pura', () => {
    const service = new DealScoreService();
    const input = {
      qualityScore: 8,
      discountPercent: 50,
      currentPrice: 20,
      historicalLowPrice: 18,
    };
    expect(service.compute(input)).toBe(computeDealScore(input));
  });
});

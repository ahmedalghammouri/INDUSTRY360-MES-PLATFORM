import { OEEService } from './oee.service';

describe('OEEService', () => {
  let service: OEEService;

  beforeEach(() => {
    service = new OEEService();
  });

  describe('calculate', () => {
    it('should calculate OEE correctly for world-class performance', () => {
      const result = service.calculate({
        plannedProductionTime: 480,
        downtime: 30,
        idealCycleTime: 1,
        totalCount: 400,
        goodCount: 392,
      });

      expect(result.availability).toBeCloseTo(93.75, 0);
      expect(result.quality).toBeCloseTo(98.0, 0);
      expect(result.oee).toBeGreaterThan(0);
      expect(result.oee).toBeLessThanOrEqual(100);
    });

    it('should return 0 OEE when no good parts produced', () => {
      const result = service.calculate({
        plannedProductionTime: 480,
        downtime: 80,
        idealCycleTime: 1,
        totalCount: 100,
        goodCount: 0,
      });

      expect(result.quality).toBe(0);
      expect(result.oee).toBe(0);
    });

    it('should return 100 OEE for perfect conditions', () => {
      const result = service.calculate({
        plannedProductionTime: 480,
        downtime: 0,
        idealCycleTime: 1,
        totalCount: 480,
        goodCount: 480,
      });

      expect(result.availability).toBeCloseTo(100);
      expect(result.performance).toBeCloseTo(100);
      expect(result.quality).toBeCloseTo(100);
      expect(result.oee).toBeCloseTo(100);
    });

    it('should cap values at 100 when performance exceeds theoretical', () => {
      const result = service.calculate({
        plannedProductionTime: 480,
        downtime: 0,
        idealCycleTime: 1,
        totalCount: 600,
        goodCount: 600,
      });

      expect(result.availability).toBeLessThanOrEqual(100);
    });
  });

  describe('getClassification', () => {
    it('should classify world-class OEE correctly', () => {
      expect(service.getClassification(85)).toBe('world-class');
      expect(service.getClassification(95)).toBe('world-class');
    });

    it('should classify good OEE correctly', () => {
      expect(service.getClassification(65)).toBe('good');
      expect(service.getClassification(84)).toBe('good');
    });

    it('should classify poor OEE correctly', () => {
      expect(service.getClassification(30)).toBe('poor');
    });
  });
});

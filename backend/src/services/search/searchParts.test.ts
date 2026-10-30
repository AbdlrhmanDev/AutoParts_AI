import { describe, expect, it } from 'vitest';
import { matchesVehicleYear, mentionsPart } from './searchParts.js';

describe('mentionsPart', () => {
  it('requires the requested part in the result title', () => {
    expect(mentionsPart({ url: 'https://shop.sa/plugs', title: 'Mazda CX-9 spark plugs' }, 'spark_plugs')).toBe(true);
    expect(mentionsPart({ url: 'https://shop.sa/car', title: 'MAZDA', content: 'Spark plugs also available' }, 'spark_plugs')).toBe(false);
    expect(mentionsPart({ url: 'https://shop.sa/coils', title: 'Ignition coils for Mazda CX-9', content: 'spark plug service' }, 'spark_plugs')).toBe(false);
  });
});

describe('matchesVehicleYear', () => {
  const listing = (fit: any) => ({ fit } as any);

  it('requires explicit matching make, model and year evidence', () => {
    const vehicle = { make: 'Mercedes-Benz', model: 'C63 AMG', year: 2021 };
    expect(matchesVehicleYear(listing([{ make: 'Mercedes-Benz', model: 'C63 AMG', from: 2018, to: 2022 }]), vehicle)).toBe(true);
    expect(matchesVehicleYear(listing([{ make: 'BMW', model: 'M5', from: 2018, to: 2022 }]), vehicle)).toBe(false);
    expect(matchesVehicleYear(listing(null), vehicle)).toBe(false);
  });
});

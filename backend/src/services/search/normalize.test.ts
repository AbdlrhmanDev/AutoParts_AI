import { describe, expect, it } from 'vitest';
import { firstImage, parseFitment, parsePartNo, parsePrice, toListing } from './normalize.js';

const camry2018 = { make: 'Toyota', model: 'Camry', year: 2018 };

describe('parsePrice', () => {
  it('reads Arabic and Latin prices in SAR', () => {
    expect(parsePrice('فحمات كامري السعر 385 ر.س')).toBe(385);
    expect(parsePrice('Price: SAR 1,240.50 incl VAT')).toBe(1240.5);
    expect(parsePrice('٢٤٠ ريال')).toBe(240);
  });
  it('turns "N installments of X" into the full price and never shows an installment as the price', () => {
    expect(parsePrice('كامري 2018-2021 اصلي وكاله. 380. 490 ... 4 دفعات بقيمة SAR 95.00 /شهر ، متوافقة مع')).toBe(380);
    expect(parsePrice('Pay in 4 payments of SAR 25.41 with Tabby')).toBe(101.64);
    expect(parsePrice('قسّطها مع تمارا 22.48 ر.س شهرياً')).toBeNull();
  });
  it('returns null when no price is stated or it is implausibly small', () => {
    expect(parsePrice('Brake pads 2018-2021 fits Camry')).toBeNull();
    expect(parsePrice('shipping 6.58 SAR')).toBeNull();
  });
});

describe('parsePartNo', () => {
  it('reads OEM and brand part numbers', () => {
    expect(parsePartNo('PAD KIT 04466-33220 Toyota')).toBe('04466-33220');
    expect(parsePartNo('TRW Pro TRC1293 Disc Brake Pad Set')).toBe('TRC1293');
  });
  it('never treats a year range as a part number', () => {
    expect(parsePartNo('Generic Toyota Camry 2018-2024 Brake Pad Set')).toBeNull();
  });
});

describe('parseFitment', () => {
  it('reads a year range only when the title names the model', () => {
    expect(parseFitment('Front Brake Pads Toyota Camry 2018–2024', camry2018)).toEqual([{ make: 'Toyota', model: 'Camry', from: 2018, to: 2024 }]);
    expect(parseFitment('فحمات تويوتا كامري 2012 - 2017', camry2018)).toEqual([{ make: 'Toyota', model: 'Camry', from: 2012, to: 2017 }]);
    expect(parseFitment('Brake pads Corolla 2018-2022', camry2018)).toBeNull();
    expect(parseFitment('Toyota Camry brake pads', camry2018)).toBeNull();
  });

  it('binds years to the requested model clause instead of another model in the title', () => {
    const x5 = { make: 'BMW', model: 'X5', year: 2021 };
    const title = 'Brake Pads For BMW M5 2018-2022, BMW M8 2020, BMW X5 2020-2022, BMW X6 2020-2022';
    expect(parseFitment(title, x5)).toEqual([{ make: 'BMW', model: 'X5', from: 2020, to: 2022 }]);
  });

  it('rejects a different make/model and accepts an exact single year', () => {
    const mercedes = { make: 'Mercedes-Benz', model: 'C63 AMG', year: 2021 };
    expect(parseFitment('Power Stop Brake Pads For BMW M5 2018-2022, BMW X5 2020-2022', mercedes)).toBeNull();
    expect(parseFitment('Front Brake Pads Mercedes C 63 AMG 2021', mercedes)).toEqual([
      { make: 'Mercedes-Benz', model: 'C63 AMG', from: 2021, to: 2021 },
    ]);
  });
});

describe('toListing', () => {
  it('keeps unknown fields null and marks OEM from the text', () => {
    const l = toListing({ url: 'https://www.example.sa/p/1', title: 'Genuine Toyota Camry 2018-2021 pads', content: 'in stock' }, 'brake_pads_front', camry2018, '2026-01-01T00:00:00Z');
    expect(l.seller.en).toBe('example.sa');
    expect(l.brand.en).toBe('OEM');
    expect(l.price).toBeNull();
    expect(l.fit).toEqual([{ make: 'Toyota', model: 'Camry', from: 2018, to: 2021 }]);
    expect(l.id).toHaveLength(12);
  });

  it('keeps the first valid source-linked image', () => {
    const l = toListing({
      url: 'https://www.example.sa/p/1',
      title: 'Toyota Camry 2018-2021 brake pads',
      images: [{ url: 'https://cdn.example.sa/pads.jpg', description: 'Brake pads' }],
    }, 'brake_pads_front', camry2018, '2026-01-01T00:00:00Z');
    expect(l.image).toBe('https://cdn.example.sa/pads.jpg');
  });
});

describe('firstImage', () => {
  it('accepts string and object images and rejects unsafe or malformed URLs', () => {
    expect(firstImage(['https://cdn.example.sa/a.jpg'])).toBe('https://cdn.example.sa/a.jpg');
    expect(firstImage([{ url: 'javascript:alert(1)' }, { url: 'https://cdn.example.sa/b.jpg' }])).toBe('https://cdn.example.sa/b.jpg');
    expect(firstImage([{ url: 'not a url' }])).toBeNull();
    expect(firstImage(undefined)).toBeNull();
  });

  it('prefers a relevant product image and rejects trackers, sprites and unrelated descriptions', () => {
    expect(firstImage([
      { url: 'https://shop.example.sa/batch/track:0', score: 10 },
      { url: 'https://shop.example.sa/nav-sprite.png', score: 9 },
      { url: 'https://shop.example.sa/car.jpg', description: 'White Mazda CX-9 SUV', score: 8 },
      { url: 'https://shop.example.sa/plugs.jpg', description: 'NGK spark plugs for Mazda CX-9', score: 2 },
    ], 'spark_plugs')).toBe('https://shop.example.sa/plugs.jpg');

    expect(firstImage([
      { url: 'https://shop.example.sa/coil.jpg', description: 'Ignition coil for Mazda CX-9', score: 10 },
    ], 'spark_plugs')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { extractProductPageData, isUnavailablePage, privateIp } from './validateProductPage.js';

describe('isUnavailablePage', () => {
  it('rejects HTTP errors and empty responses', () => {
    expect(isUnavailablePage(404, '<h1>Not found</h1>')).toBe(true);
    expect(isUnavailablePage(410, '')).toBe(true);
    expect(isUnavailablePage(204, '')).toBe(true);
    expect(isUnavailablePage(503, '')).toBe(true);
    expect(isUnavailablePage(403, '')).toBe(false);
  });

  it('detects English and Arabic soft-404 product pages that return HTTP 200', () => {
    expect(isUnavailablePage(200, "Couldn't find the page you're looking for")).toBe(true);
    expect(isUnavailablePage(200, 'This product is no longer available')).toBe(true);
    expect(isUnavailablePage(200, '<h1>المنتج غير موجود</h1>')).toBe(true);
    expect(isUnavailablePage(200, '<p>الصفحة التي تبحث عنها غير موجودة</p>')).toBe(true);
  });

  it('accepts a normal product page', () => {
    expect(isUnavailablePage(200, '<title>NGK Spark Plugs</title><button>Add to cart</button>')).toBe(false);
  });
});

describe('extractProductPageData', () => {
  it('extracts product fields from JSON-LD', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Product', image: '/coolant.jpg',
      offers: { '@type': 'Offer', price: '129.95', availability: 'https://schema.org/InStock' },
    })}</script>`;
    expect(extractProductPageData(html, 'https://shop.sa/p/1')).toEqual({
      live: true, price: 129.95, image: 'https://shop.sa/coolant.jpg', availability: 'https://schema.org/InStock',
    });
  });

  it('extracts Open Graph fields and rejects unavailable products', () => {
    const html = '<meta property="og:image" content="https://cdn.shop.sa/item.jpg"><meta property="product:price:amount" content="85.00"><p>Sorry! This product is not available.</p>';
    expect(extractProductPageData(html, 'https://shop.sa/p/1')).toEqual({
      live: false, price: 85, image: 'https://cdn.shop.sa/item.jpg', availability: null,
    });
  });
});

describe('privateIp', () => {
  it('blocks loopback, private, link-local, CGNAT and IPv4-mapped IPv6 addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fd00::1', 'fe80::1']) {
      expect(privateIp(ip), ip).toBe(true);
    }
  });

  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '104.16.0.1', '2606:4700::1111', '::ffff:8.8.8.8']) expect(privateIp(ip), ip).toBe(false);
  });
});

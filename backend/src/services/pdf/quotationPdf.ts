import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { env } from '../../config/env.js';
import type { QuotationRecord } from '../../types.js';
import { HttpError } from '../../lib/errors.js';

const escapeHtml = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const money = (value: unknown) => typeof value === 'number' ? `${value.toLocaleString('ar-SA-u-nu-latn', { minimumFractionDigits: 2 })} ر.س` : 'السعر غير متوفر';

function chromePath() {
  const candidates = [
    env.CHROME_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ];
  return candidates.find(path => path && existsSync(path));
}

function html(q: QuotationRecord) {
  const items = Array.isArray(q.items) ? q.items as any[] : [];
  const customer = (q.customer ?? {}) as any; const vehicle = (q.vehicle ?? {}) as any; const company = (q.company ?? {}) as any;
  const rows = items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.title)}</td><td dir="ltr">${escapeHtml(item.partNo)}</td><td>${escapeHtml(item.qty)}</td><td>${money(item.unitPrice)}</td><td>${money(typeof item.unitPrice === 'number' ? item.unitPrice * Number(item.qty || 1) : null)}</td></tr>`).join('');
  const sourceRows = items.map(item => {
    let host = 'رابط المصدر';
    try { host = new URL(String(item.url)).hostname.replace(/^www\./, ''); } catch { /* keep safe label */ }
    const link = /^https?:\/\//i.test(String(item.url ?? '')) ? `<a href="${escapeHtml(item.url)}" dir="ltr">${escapeHtml(host)}</a>` : 'بدون رابط';
    return `<div class="source"><strong>${escapeHtml(item.seller || 'المصدر')}</strong><span>${link} · وقت الاسترجاع: ${escapeHtml(item.retrievedAt)}</span></div>`;
  }).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
  @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:"Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif;color:#171717;font-size:12px;direction:rtl;overflow-wrap:anywhere}header{display:flex;justify-content:space-between;border-bottom:3px solid #e85d04;padding-bottom:16px;margin-bottom:22px}h1{margin:0;font-size:28px}.muted{color:#666}.cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}.card{background:#f6f3ee;border-radius:8px;padding:12px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#202020;color:white;text-align:right}th,td{padding:9px;border-bottom:1px solid #ddd}.totals{width:310px;margin:20px 0 20px auto}.line{display:flex;justify-content:space-between;padding:4px}.total{font-size:17px;font-weight:700;border-top:2px solid #222;margin-top:5px;padding-top:8px}.sources{margin:18px 0;display:flex;flex-direction:column;gap:6px}.source{display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;min-width:0}.source span,.source a{min-width:0;overflow-wrap:anywhere;word-break:break-word}.source a{color:#704020}footer{border-top:1px solid #ddd;padding-top:12px;color:#666;line-height:1.8}
  </style></head><body><header><div><strong>${escapeHtml(company.name || 'AutoParts AI')}</strong><div class="muted">${escapeHtml(company.address)}</div><div class="muted">الرقم الضريبي: ${escapeHtml(company.vatNo)}</div></div><div><h1>عرض سعر</h1><div dir="ltr">${escapeHtml(q.no)}</div><div>${escapeHtml(q.date)}</div><div>صالح حتى: ${escapeHtml(q.expiresAt)}</div></div></header>
  <div class="cards"><div class="card"><b>العميل</b><br>${escapeHtml(customer.name)}<br>${escapeHtml(customer.phone)} · ${escapeHtml(customer.city)}</div><div class="card"><b>المركبة</b><br>${escapeHtml([vehicle.make,vehicle.model,vehicle.year,vehicle.trim,vehicle.engine].filter(Boolean).join(' '))}<br><span dir="ltr">VIN ${escapeHtml(vehicle.vin)}</span></div></div>
  <table><thead><tr><th>#</th><th>الصنف</th><th>رقم القطعة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals"><div class="line total"><span>الإجمالي</span><span>${money(q.totalN)}</span></div></div>
  <section class="sources"><strong>مصادر الأسعار</strong>${sourceRows || '<span>—</span>'}</section>
  <footer>هذا عرض سعر وليس فاتورة ضريبية ولا يمثل عملية شراء. الأسعار والتوفر وفق صفحات البائعين وقت الاسترجاع وقد تتغير. التوافق غير المؤكد يجب التحقق منه قبل الشراء.</footer></body></html>`;
}

const MAX_CONCURRENT_RENDERS = 2;
let activeRenders = 0;

export async function renderQuotationPdf(quotation: QuotationRecord) {
  const executablePath = chromePath();
  if (!executablePath) throw new Error('Chrome/Chromium executable not found; set CHROME_EXECUTABLE_PATH');
  if (activeRenders >= MAX_CONCURRENT_RENDERS) throw new HttpError(503, 'PDF renderer is busy, try again shortly');
  activeRenders++;
  try {
    const args = ['--disable-dev-shm-usage', ...(env.CHROME_NO_SANDBOX ? ['--no-sandbox'] : [])];
    const browser = await puppeteer.launch({ executablePath, headless: true, args });
    try {
      const page = await browser.newPage();
      // The document is self-contained: no scripts, and no request may leave the renderer.
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', request => void (request.url().startsWith('data:') || request.url() === 'about:blank' ? request.continue() : request.abort()));
      await page.setContent(html(quotation), { waitUntil: 'domcontentloaded', timeout: 15_000 });
      return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, timeout: 20_000 });
    } finally { await browser.close(); }
  } finally { activeRenders--; }
}

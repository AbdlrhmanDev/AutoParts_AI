import { Router } from 'express';
import { agentRateLimit, asyncHandler, pdfRateLimit, requireDatabase } from '../middleware/index.js';
import {
  conversationsRepo,
  conversationMemoryRepo,
  deleteAllData,
  productsRepo,
  quotationsRepo,
  settingsRepo,
  vehiclesRepo,
} from '../repositories/index.js';
import { ConversationSchema, QuotationSchema, SettingsSchema, VehicleListSchema, VinSchema } from './schemas.js';
import { renderQuotationPdf } from '../services/pdf/quotationPdf.js';
import { verifyVin } from '../services/catalog/authorizedCatalog.js';
import { deleteGraphThread } from '../services/agent/graphV2.js';

// Browser-session scoped persistence: no route can read or mutate another owner's rows.
export const dataRouter = Router();
dataRouter.use(requireDatabase);

dataRouter.get(
  '/state',
  asyncHandler(async (req, res) => {
    const [settings, convs, vehicles, quotes, products] = await Promise.all([
      settingsRepo.get(req.ownerId),
      conversationsRepo.listRecent(req.ownerId),
      vehiclesRepo.list(req.ownerId),
      quotationsRepo.listRecent(req.ownerId),
      productsRepo.listRecent(req.ownerId),
    ]);
    res.json({ settings, convs, vehicles, quotes, products });
  }),
);

dataRouter.put(
  '/settings',
  asyncHandler(async (req, res) => {
    await settingsRepo.save(req.ownerId, SettingsSchema.parse(req.body));
    res.json({ ok: true });
  }),
);

dataRouter.get(
  '/conversations/:id/memory',
  asyncHandler(async (req, res) => {
    const memory = await conversationMemoryRepo.get(req.ownerId, req.params.id);
    res.json({ memory: memory ? { summary: memory.summary, facts: memory.facts, summarizedMessageCount: memory.summarizedMessageCount, updated: true } : null });
  }),
);

dataRouter.delete(
  '/conversations/:id/memory',
  asyncHandler(async (req, res) => {
    await Promise.all([conversationMemoryRepo.delete(req.ownerId, req.params.id), deleteGraphThread(req.ownerId, req.params.id)]);
    res.json({ ok: true });
  }),
);

dataRouter.put(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const conv = ConversationSchema.parse({ ...req.body, id: req.params.id });
    await conversationsRepo.upsert(req.ownerId, conv.id, conv.title, conv.createdAt, conv);
    res.json({ ok: true });
  }),
);

dataRouter.put(
  '/vehicles',
  asyncHandler(async (req, res) => {
    await vehiclesRepo.replaceAll(req.ownerId, VehicleListSchema.parse(req.body));
    res.json({ ok: true });
  }),
);

dataRouter.post(
  '/vehicles/verify-vin',
  agentRateLimit,
  asyncHandler(async (req, res) => {
    const { vin } = VinSchema.parse(req.body);
    res.json(await verifyVin(vin));
  }),
);

dataRouter.post(
  '/quotations',
  asyncHandler(async (req, res) => {
    const parsed = QuotationSchema.parse(req.body);
    const date = parsed.date ?? new Date().toISOString();
    const expiresAt = parsed.expiresAt ?? new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000).toISOString();
    await quotationsRepo.insert(req.ownerId, { ...parsed, date, expiresAt });
    res.status(201).json({ ok: true });
  }),
);

dataRouter.get(
  '/quotations/:no/pdf',
  pdfRateLimit,
  asyncHandler(async (req, res) => {
    const quotation = await quotationsRepo.get(req.ownerId, req.params.no);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    const pdf = await renderQuotationPdf(quotation);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.no.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf"`);
    res.send(Buffer.from(pdf));
  }),
);

dataRouter.post(
  '/reset',
  asyncHandler(async (req, res) => {
    const conversationIds = await conversationsRepo.listIds(req.ownerId);
    await Promise.all(conversationIds.map(id => deleteGraphThread(req.ownerId, id)));
    await deleteAllData(req.ownerId);
    res.json({ ok: true });
  }),
);

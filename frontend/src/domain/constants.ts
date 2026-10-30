// @ts-nocheck — ported prototype data/logic; typed loosely on purpose.
export const NODES = [
  { id: 'context_compaction', ar: 'ضغط سياق المحادثة', en: 'Context compaction', tool: 'isolated rolling memory' },
  { id: 'intent_detection', ar: 'كشف النية', en: 'Intent detection', tool: 'OpenAI structured output' },
  { id: 'vehicle_extraction', ar: 'استخراج المركبة', en: 'Vehicle extraction', tool: 'deterministic merge' },
  { id: 'missing_information', ar: 'كشف البيانات الناقصة', en: 'Missing information', tool: 'requiredFields' },
  { id: 'automotive_diagnosis', ar: 'التشخيص', en: 'Automotive diagnosis', tool: 'diagnostic reasoning' },
  { id: 'followup_questions', ar: 'سؤال المتابعة', en: 'Follow-up question', tool: 'conditional response' },
  { id: 'search_query_generation', ar: 'إنشاء استعلام البحث', en: 'Search query generation', tool: 'query builder' },
  { id: 'saudi_merchant_catalog_search', ar: 'كتالوجات الموردين', en: 'Saudi catalog search', tool: 'authorized adapters' },
  { id: 'google_shopping_search', ar: 'Google Shopping', en: 'Google Shopping', tool: 'SerpApi' },
  { id: 'tavily_fallback_search', ar: 'بحث احتياطي', en: 'Fallback search', tool: 'Tavily' },
  { id: 'product_normalization', ar: 'توحيد المنتجات', en: 'Product normalization', tool: 'normalizer' },
  { id: 'duplicate_detection', ar: 'إزالة التكرار', en: 'Duplicate detection', tool: 'URL identity' },
  { id: 'compatibility_verification', ar: 'التحقق من التوافق', en: 'Compatibility verification', tool: 'fitment evidence' },
  { id: 'product_ranking', ar: 'ترتيب المنتجات', en: 'Product ranking', tool: 'quality + price' },
  { id: 'product_recommendations', ar: 'التوصيات', en: 'Recommendations', tool: 'verified results' },
  { id: 'quotation_management', ar: 'إدارة عرض السعر', en: 'Quotation management', tool: 'quotation service' },
  { id: 'confirm', ar: 'تأكيد العميل', en: 'Customer confirmation', tool: 'explicit UI approval' },
  { id: 'pdf', ar: 'توليد PDF', en: 'PDF generation', tool: 'Puppeteer · A4 RTL' },
  { id: 'respond', ar: 'رد مباشر', en: 'Direct response', tool: 'no external tool' },
];
export const MAKE_AR = { Toyota: 'تويوتا', Hyundai: 'هيونداي', Nissan: 'نيسان', Kia: 'كيا', Honda: 'هوندا', Ford: 'فورد', Chevrolet: 'شفروليه', Lexus: 'لكزس', GMC: 'جمس' };
export const MODEL_AR = { Camry: 'كامري', Corolla: 'كورولا', Yaris: 'يارس', Accent: 'أكسنت', Elantra: 'النترا', Sonata: 'سوناتا', Altima: 'ألتيما', Sunny: 'صني', 'Land Cruiser': 'لاندكروزر', Hilux: 'هايلكس' };
export const PART_TYPES = {
  brake_pads_front: { ar: 'فحمات أمامية', en: 'Front brake pads' },
  brake_rotor_front: { ar: 'هوب فرامل أمامي', en: 'Front brake rotor' },
  cabin_filter: { ar: 'فلتر مكيف', en: 'Cabin air filter' },
  thermostat: { ar: 'ثرموستات', en: 'Thermostat' },
  radiator_cap: { ar: 'غطاء رديتر', en: 'Radiator cap' },
  coolant: { ar: 'سائل تبريد', en: 'Coolant' },
  engine_mount: { ar: 'كرسي مكينة', en: 'Engine mount' },
  spark_plugs: { ar: 'بواجي', en: 'Spark plugs' },
};
export const S = (ar, en) => ({ ar, en });
export const ICONS = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  products: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  quote: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  graph: 'M5 3h5v5H5zM14 3h5v5h-5zM9.5 16h5v5h-5zM7.5 8v3.5h9V8M12 11.5V16',
  settings: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
};

export const WF_ICON = {
  intent: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  extract: 'M5 17h14M6 17v2M18 17v2M3 13l2-6h14l2 6v4H3zM7 13h.01M17 13h.01',
  diagnose: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  followup: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  normalize: 'M4 6h16M7 12h10M10 18h4',
  compat: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  recommend: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  quote: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  confirm: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 11l2 2 4-4',
  pdf: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 12v6M9 15l3 3 3-3',
};
WF_ICON.intent_detection = WF_ICON.intent;
WF_ICON.context_compaction = WF_ICON.normalize;
WF_ICON.vehicle_extraction = WF_ICON.extract;
WF_ICON.missing_information = WF_ICON.followup;
WF_ICON.automotive_diagnosis = WF_ICON.diagnose;
WF_ICON.followup_questions = WF_ICON.followup;
WF_ICON.search_query_generation = WF_ICON.search;
WF_ICON.saudi_merchant_catalog_search = WF_ICON.search;
WF_ICON.google_shopping_search = WF_ICON.search;
WF_ICON.tavily_fallback_search = WF_ICON.search;
WF_ICON.product_normalization = WF_ICON.normalize;
WF_ICON.duplicate_detection = WF_ICON.normalize;
WF_ICON.compatibility_verification = WF_ICON.compat;
WF_ICON.product_ranking = WF_ICON.recommend;
WF_ICON.product_recommendations = WF_ICON.recommend;
WF_ICON.quotation_management = WF_ICON.quote;
WF_ICON.respond = WF_ICON.intent;
export const INTENT_L = { diagnosis: S('تشخيص عطل', 'Diagnosis'), parts_request: S('طلب قطعة', 'Parts request'), preference: S('تفضيل أصلي أو بديل', 'Preference'), quote: S('عرض سعر', 'Quotation'), vehicle_info: S('بيانات مركبة', 'Vehicle info'), general: S('سؤال عام', 'General') };

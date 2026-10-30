/** Part types the agent may search for, with English search phrases. */
export const PART_TYPE_QUERY: Record<string, string> = {
  brake_pads_front: 'front brake pads',
  brake_rotor_front: 'front brake rotor',
  cabin_filter: 'cabin air filter',
  thermostat: 'thermostat',
  radiator_cap: 'radiator cap',
  coolant: 'coolant',
  engine_mount: 'engine mount',
  spark_plugs: 'spark plugs',
};

/** Arabic model names, so fitment can be read from Arabic listing titles too. */
export const MODEL_AR: Record<string, string> = {
  Camry: 'كامري', Corolla: 'كورولا', Yaris: 'يارس', Accent: 'أكسنت', Elantra: 'النترا',
  Sonata: 'سوناتا', Altima: 'ألتيما', Sunny: 'صني', 'Land Cruiser': 'لاندكروزر', Hilux: 'هايلكس',
};

export const MAKE_AR: Record<string, string> = {
  Toyota: 'تويوتا', Hyundai: 'هيونداي', Nissan: 'نيسان', Kia: 'كيا', Honda: 'هوندا',
  Ford: 'فورد', Chevrolet: 'شفروليه', Lexus: 'لكزس', GMC: 'جمس',
};

/** Words a listing must contain to count as the requested part (filters out whole-car ads, guides, etc.). */
export const PART_KEYWORDS: Record<string, RegExp> = {
  brake_pads_front: /brake\s*pads?\b|\bpad\s*(?:kit|set)\b|فحمات|فحمة/i,
  brake_rotor_front: /rotor|brake\s*disc|هوب|ديسك/i,
  cabin_filter: /cabin|a\/?c\s*filter|فلتر\s*(?:ال)?مكيف/i,
  thermostat: /thermostat|ثرموستات|ثيرموستات/i,
  radiator_cap: /radiator\s*cap|غطاء\s*(?:ال)?رديتر/i,
  coolant: /coolant|antifreeze|سائل\s*تبريد|ماء\s*رديتر/i,
  engine_mount: /engine\s*mount|كرسي\s*(?:ال)?مكينة|قاعدة\s*محرك/i,
  spark_plugs: /spark\s*plug|بواجي|بوجي/i,
};

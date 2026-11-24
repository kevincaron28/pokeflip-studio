// Product matching for the server shop checker: the same rules as the app's restock matcher (canada-retailers.js,
// PR #45), as a module the Supabase functions can import. tests/drops-shop-checker.test.cjs checks both agree.
// A shop title becomes {setKey, kind, lang} only when it names exactly one known set, one product size and no other
// language; anything unsure is skipped (never a drop event).

const STOP = new Set(['pokemon','tcg','the','a','an','of','de','la','le','les','du','des','et','and','cards','card','carte','cartes','edition','set']);
export const tokens = (t) => String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((x) => x && !STOP.has(x));
export const phrase = (t) => ' ' + tokens(String(t || '').replace(/\betb\b/ig, 'elite trainer box')).join(' ') + ' ';
const ERAS = ['mega evolution', 'scarlet violet', 'sword shield'];

/** Set phrases from set names (longest first). */
export function setPhrases(names) {
  return names.map((name) => ({ name, p: phrase(name).trim() })).filter((s) => s.p).sort((a, b) => b.p.length - a.p.length);
}
/** Set names found in a title; a name inside a longer one is not counted, and an era name is dropped when a set is named. */
export function setsIn(t, SETP) {
  const p = phrase(t);
  let found = [...new Set(SETP.filter((s) => p.includes(' ' + s.p + ' ')).map((s) => s.p))];
  found = found.filter((a) => !found.some((b) => b !== a && (' ' + b + ' ').includes(' ' + a + ' ')));
  if (found.length > 1) found = found.filter((a) => !ERAS.includes(a));
  return found;
}
export function kindOf(t) {
  const p = phrase(t);
  if (/ (case|cases) | \d+ (ct|count) /.test(p)) return 'case';
  if (/ elite trainer box /.test(p) && / (center|centre|pc|exclusive) /.test(p)) return 'etb-pc';
  if (/ elite trainer box | coffret dresseur /.test(p)) return 'etb';
  if (/ tin | tins | minitin /.test(p)) return 'tin';
  if (/ blister /.test(p)) return 'blister';
  if (/ build battle /.test(p)) return 'bnb';
  if (/ booster box | display | boite boosters /.test(p)) return 'box';
  if (/ bundle /.test(p)) return 'bundle';
  if (/ booster pack | sleeved | pack | packs /.test(p)) return 'pack';
  if (/ collection | box /.test(p)) return 'collection';
  return null;
}
export function langOf(t) {
  const p = phrase(t);
  if (/ (french|francais|francaise|fr|vf|coffret|dresseur|boite) /.test(p)) return 'fr';
  if (/ (japanese|japan|jp|jpn) /.test(p)) return 'ja';
  if (/ (korean|kor) /.test(p)) return 'ko';
  if (/ (chinese|chn|simplified|traditional) /.test(p)) return 'zh';
  return null;
}
/** "Case" -> case, "Pack" -> pack, "Box"/"Single"/"Display" -> unit (the product itself), else null. */
export function variantKind(v) {
  const t = String(v && v.title || '').toLowerCase();
  if (!t || t === 'default title') return null;
  if (/case/.test(t)) return 'case';
  if (/pack/.test(t)) return 'pack';
  if (/box|display|single|unit|each/.test(t)) return 'unit';
  return null;
}
/** A UPC/EAN in a variant's barcode or SKU, without leading zeros, or null. */
export function upcOf(v) {
  const raw = String(v && (v.barcode || v.sku) || '').replace(/[\s-]/g, '');
  return /^\d{11,14}$/.test(raw) ? raw.replace(/^0+/, '') : null;
}
// Cardstead kinds -> drop_events.product_kind (cases are never inserted).
export const KIND = { box: 'booster_box', etb: 'etb', 'etb-pc': 'etb_pc', pack: 'pack', bundle: 'bundle', blister: 'blister', bnb: 'build_battle', collection: 'collection', tin: 'tin' };
export const LANG = { null: 'EN', fr: 'FR', ja: 'JP' };
// Several units or an accessory sold under a set's name: never one product.
// A single card (a promo with its number) sold under a product name is not a sealed product either.
const SINGLE = / promo | black star | psa | bgs | cgc | graded /;
const MULTI = / bundle of \d+ | lot of | set of \d+ | \d+ ?x | x ?\d+ | \d+ pack bundle /;
const ACCESSORY = / (playmat|sleeves|sleeve|deck box|binder only|portfolio|poster only|pin|coin only|dice|figure|plush|code card|empty) /;
const ERA_ONLY = ['scarlet violet', 'sword shield'];
const GENERIC = new Set(['pre','order','preorder','limit','pick','up','only','random','artwork','sleeved','english','new','sealed','box','collection','tin','tins','blister','pack','packs','booster','premium','ex','mega','evolution','evolutions','jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec','per','customer','in','store']);
/** {setPhrase, kind, lang, variant} for a shop title, or null when unsure.
 *  variant names the product inside a set when a set has many of that kind (collections, tins, blisters). */
export function parseTitle(title, SETP) {
  const p = phrase(title);
  const plain = ' ' + String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' '; // keeps "of"
  if (MULTI.test(plain) || ACCESSORY.test(p) || SINGLE.test(p) || /#\d/.test(String(title))) return null;
  const sets = setsIn(title, SETP), kind = kindOf(title), lang = langOf(title);
  if (sets.length !== 1 || ERA_ONLY.includes(sets[0]) || !kind || kind === 'case' || !(String(lang) in LANG)) return null;
  if (kind === 'tin' && / display /.test(p)) return null;
  let variant = null;
  if (kind === 'collection' || kind === 'tin' || kind === 'blister') {
    const setWords = new Set(sets[0].split(' '));
    const words = tokens(title).filter((w) => !setWords.has(w) && !GENERIC.has(w) && !/^\d+$/.test(w) && w.length > 1
      && !/^(me|sv|swsh|sm|xy)\d/.test(w) && !/^\d+(st|nd|rd|th|pk)$/.test(w) && !/^(january|february|march|april|june|july|august|september|october|november|december)$/.test(w) && !/^(releases?|wave|th|nd|rd|st|pk|sword|shield|scarlet|violet|sun|moon|base|checklane|cheklane|single|three)$/.test(w));
    if (kind === 'blister') variant = (/ 3 ?(pack|pk) | three pack /.test(plain) ? '3-pack' : 'checklane') + (words.length ? '-' + words.slice(0, 2).join('-') : '');
    else variant = words.slice(0, 4).join('-') || null;
  }
  return { setPhrase: sets[0], kind, lang: LANG[String(lang)], variant };
}
// canada-shops.js regions -> drop_events.region
export const REGION = { montreal: 'qc-montreal', 'laval-north-shore': 'qc-montreal', 'south-shore': 'qc-montreal', 'vaudreuil-soulanges': 'qc-montreal',
  'quebec-city': 'qc-quebec-regions', outaouais: 'qc-quebec-regions', laurentides: 'qc-quebec-regions', 'qc-all': 'qc-quebec-regions',
  gta: 'on-gta', ottawa: 'on-ottawa-other', 'on-other': 'on-ottawa-other', vancouver: 'bc', 'bc-other': 'bc',
  calgary: 'prairies', edmonton: 'prairies', 'ab-other': 'prairies', prairies: 'prairies', atlantic: 'atlantic', national: 'online-canada' };

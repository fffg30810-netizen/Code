const sleep = ms => new Promise(r => setTimeout(r, ms));
// Shared Booking.com helpers (parsing of the embedded Apollo JSON in searchresults pages)
const TYPES = { 204: 'hotel', 208: 'B&B', 216: 'guesthouse', 203: 'hostel', 201: 'apartment', 220: 'holiday home', 222: 'room in private home', 206: 'resort', 213: 'villa', 226: 'aparthotel', 231: 'condo', 235: 'lodge' };
function addDays(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function buildUrl(checkin, checkout, adults, nflt) {
  return `https://www.booking.com/searchresults.it.html?ss=Stazione+Roma+Tiburtina&dest_type=landmark&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&no_rooms=1&group_children=0&order=price&selected_currency=EUR&nflt=${encodeURIComponent(nflt)}`;
}
function parseKm(s) { if (!s) return null; const m = s.match(/([\d.,]+)\s*(km|m)\b/); if (!m) return null; let v = parseFloat(m[1].replace('.', '').replace(',', '.')); if (m[2] === 'm') v = v / 1000; return Math.round(v * 100) / 100; }
function parseApollo(html) {
  const j = html.indexOf('data-capla-store-data="apollo"'); if (j < 0) return null;
  const a = html.indexOf('>', j) + 1, b = html.indexOf('</script>', a);
  const d = JSON.parse(html.slice(a, b));
  const sq = d.ROOT_QUERY && d.ROOT_QUERY.searchQueries; if (!sq) return null;
  const key = Object.keys(sq).find(k => k.startsWith('search(')); if (!key) return null;
  const s = sq[key]; if (!s || !s.results) return null;
  const input = JSON.parse(key.slice(7, -1)).input;
  const res = (s.results || []).map(r => {
    const bp = r.basicPropertyData || {}, p = r.priceDisplayInfoIrene || {}, ex = (p.excludedCharges || {}), list = ex.excludeChargesList || [];
    const unit = ((r.matchingUnitConfigurations || {}).unitConfigurations || [])[0] || {};
    const unitTypes = (unit.unitTypeNames || []).map(t => t.translation).filter(Boolean);
    const cityTax = list.find(c => c.chargeType === 22);
    const roomName = unit.name || ((r.matchingUnitConfigurations || {}).commonConfiguration || {}).name || '';
    const isDorm = /dormitor|posto letto|letto in dormitorio|bunk bed in/i.test(roomName + ' ' + unitTypes.join(' '));
    const sr = bp.starRating;
    return {
      property_id: bp.id, name: (r.displayName || {}).text, pageName: bp.pageName, typeId: bp.accommodationTypeId, type: TYPES[bp.accommodationTypeId] || String(bp.accommodationTypeId),
      stars: sr ? (sr.symbol === 'STARS' ? String(sr.value) : sr.value + 'T') : '', star_symbol: sr ? sr.symbol : '',
      score: (bp.reviews || {}).totalScore, reviews: (bp.reviews || {}).reviewsCount,
      distance_text: (r.location || {}).mainDistance, distance_km: parseKm((r.location || {}).mainDistance), area: (r.location || {}).displayLocation,
      address: (bp.location || {}).address, lat: (bp.location || {}).latitude, lon: (bp.location || {}).longitude,
      room: roomName, unit_types: unitTypes, is_dorm: isDorm,
      total_eur: p.displayPrice && p.displayPrice.amountPerStay ? Math.round(p.displayPrice.amountPerStay.amountUnformatted * 100) / 100 : null,
      per_night_eur: p.averagePricePerNight ? Math.round(p.averagePricePerNight.amountUnformatted * 100) / 100 : null,
      before_discount_eur: p.priceBeforeDiscount && p.priceBeforeDiscount.amountPerStay ? Math.round(p.priceBeforeDiscount.amountPerStay.amountUnformatted * 100) / 100 : null,
      city_tax_inclusion: cityTax ? cityTax.chargeInclusion : 'n/a', city_tax_amount: cityTax && cityTax.amountPerStay ? cityTax.amountPerStay.amount : '', city_tax_mode: cityTax ? cityTax.chargeMode : '',
      charges: list.map(c => ({ type: c.chargeType, inclusion: c.chargeInclusion, mode: c.chargeMode, amount: c.amountPerStay && c.amountPerStay.amount })),
      free_cancellation: !!(r.policies || {}).showFreeCancellation, free_cancellation_until: ((r.blocks || [])[0] || {}).freeCancellationUntil || null,
      breakfast: !!(r.mealPlanIncluded && /colazione|breakfast/i.test(r.mealPlanIncluded.text || '')), meal_text: r.mealPlanIncluded ? r.mealPlanIncluded.text : '',
      only_x_left: (((r.blocks || [])[0] || {}).onlyXLeftMessage || {}).translation || '', sold_out: !!((r.soldOutInfo || {}).isSoldOut),
    };
  });
  return { input, nbResultsTotal: (s.pagination || {}).nbResultsTotal, results: res };
}

module.exports = { TYPES, addDays, buildUrlBase: buildUrl, parseKm, parseApollo, sleep };

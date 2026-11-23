// Non-SoCal locations are illustrative metro markers. These are not represented as
// active ScapeGoat facilities and services must be verified before quoting.
const directoryCapabilities = [
    { title: 'Freight Lane Assessment', description: 'Request carrier, routing, and transit feasibility verification for this metro.' },
    { title: 'Warehousing Sourcing', description: 'Request a qualified local 3PL match. Site availability is not confirmed.' },
    { title: 'Regional Distribution Review', description: 'Submit volume and destination details for a tailored network assessment.' },
];
function market(name, state, lat, lon, positioning, arteries) {
    const slug = `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${state.toLowerCase()}`;
    return { name: `${name}, ${state}`, slug, state, lat, lon, positioning, arteries, status: 'market-directory', capabilities: directoryCapabilities };
}
function corridor(name, slug, descriptor, states, arteryLabels, hubs) {
    return { name, slug, descriptor, states, arteryLabels, hubs };
}
export const socalHubs = [
    {
        name: 'Gardena, CA', slug: 'gardena-ca', state: 'CA', lat: 33.8883, lon: -118.3090,
        positioning: 'South Bay Port Drayage & Transload Hub',
        arteries: ['I-110', 'I-405', 'I-105', 'SR-91'], status: 'active-hub',
        note: 'Approximately 8 miles north of the Ports of Los Angeles / Long Beach; hub coordinates supplied in the brief, not a street-level facility address.',
        capabilities: [
            { title: 'Port Drayage & Pier Pass', description: 'Rapid container pull from POLA/POLB terminals.' },
            { title: 'Container Transloading', description: "Ocean-to-53' domestic dry van conversion." },
            { title: 'Overweight & Heavy Haul', description: 'Dedicated heavy-corridor permit access.' },
        ],
    },
    {
        name: 'Commerce, CA', slug: 'commerce-ca', state: 'CA', lat: 34.0006, lon: -118.1598,
        positioning: 'Central LA Intermodal & Urban Cross-Dock Hub',
        arteries: ['I-5', 'I-710', 'SR-60'], status: 'active-hub',
        note: 'Adjacent to BNSF Hobart & UP East LA rail yards; hub coordinates supplied in the brief, not a street-level facility address.',
        capabilities: [
            { title: 'Intermodal Rail Ramp Access', description: 'Direct proximity to BNSF & Union Pacific mainlines.' },
            { title: 'High-Velocity Cross-Docking', description: 'Same-day LTL/FTL consolidation for Greater LA.' },
            { title: 'Retail & Store-Door Delivery', description: 'Time-definite urban distribution.' },
        ],
    },
    {
        name: 'Riverside, CA', slug: 'riverside-ca', state: 'CA', lat: 33.9806, lon: -117.3755,
        positioning: 'Inland Empire Bulk Warehousing & Western Distribution Hub',
        arteries: ['I-215', 'SR-60', 'SR-91', 'I-10'], status: 'active-hub',
        note: 'Gateway to Phoenix, Las Vegas, and Salt Lake City; hub coordinates supplied in the brief, not a street-level facility address.',
        capabilities: [
            { title: 'High-Bay Warehousing & Fulfillment', description: 'Scalable pallet storage & pick-and-pack.' },
            { title: '1-Day Regional Linehaul', description: 'Overnight FTL reach to AZ, NV, and Northern CA.' },
            { title: 'E-Commerce & B2B Consolidation', description: 'Regional pool distribution hub.' },
        ],
    },
];
export const regions = [
    {
        name: 'Northeast', slug: 'northeast', code: 'NE', color: '#60A5FA', description: 'Atlantic gateway ports, dense consumption centers, and New England distribution.',
        states: 'NY NJ PA MA CT MD VA DE NH ME VT RI'.split(' '),
        corridors: [
            corridor('I-95 Port Corridor', 'i-95-port-corridor', 'Atlantic port gateways and the I-95 population belt', 'NY NJ PA MD DE VA'.split(' '), ['I-95', 'I-78', 'Northeast Corridor'], [
                market('Newark', 'NJ', 40.7357, -74.1724, 'Atlantic port and intermodal gateway', ['I-95', 'I-78']),
                market('Philadelphia', 'PA', 39.9526, -75.1636, 'Mid-Atlantic distribution metro', ['I-95', 'I-76']),
                market('Baltimore', 'MD', 39.2904, -76.6122, 'Chesapeake Bay cargo gateway', ['I-95', 'I-70']),
            ]),
            corridor('Lehigh Valley & Central PA', 'lehigh-valley-central-pa', 'Pennsylvania inland fulfillment and regional distribution', 'PA NJ NY'.split(' '), ['I-78', 'I-81', 'I-80'], [
                market('Allentown', 'PA', 40.6023, -75.4714, 'Lehigh Valley logistics concentration', ['I-78', 'I-476']),
                market('Harrisburg', 'PA', 40.2732, -76.8867, 'Central Pennsylvania cross-dock market', ['I-81', 'I-83']),
                market('Scranton', 'PA', 41.4089, -75.6624, 'Northeast Pennsylvania freight market', ['I-81', 'I-84']),
            ]),
            corridor('New England Distribution', 'new-england-distribution', 'New England last-mile and regional freight markets', 'MA CT RI NH ME VT'.split(' '), ['I-90', 'I-95', 'I-91'], [
                market('Boston', 'MA', 42.3601, -71.0589, 'New England port and distribution hub', ['I-90', 'I-93']),
                market('Hartford', 'CT', 41.7658, -72.6734, 'Connecticut regional distribution', ['I-84', 'I-91']),
                market('Providence', 'RI', 41.8240, -71.4128, 'Southern New England freight gateway', ['I-95', 'I-195']),
            ]),
        ],
    },
    {
        name: 'Southeast', slug: 'southeast', code: 'SE', color: '#34D399', description: 'Southeast manufacturing, coastal ports, and high-growth consumer markets.',
        states: 'GA FL NC SC TN AL MS KY'.split(' '),
        corridors: [
            corridor('Atlanta & Piedmont I-85', 'atlanta-piedmont-i-85', 'Piedmont industrial belt and Atlanta interchange', 'GA NC SC'.split(' '), ['I-85', 'I-75', 'I-20'], [
                market('Atlanta', 'GA', 33.7490, -84.3880, 'Southeast intermodal gateway', ['I-75', 'I-85']),
                market('Charlotte', 'NC', 35.2271, -80.8431, 'Carolinas distribution network', ['I-85', 'I-77']),
                market('Greenville', 'SC', 34.8526, -82.3940, 'Upstate manufacturing corridor', ['I-85', 'I-385']),
            ]),
            corridor('Savannah & Florida Coastal', 'savannah-florida-coastal', 'Atlantic container gateways and Florida consumption', 'GA FL SC'.split(' '), ['I-95', 'I-16', 'I-75'], [
                market('Savannah', 'GA', 32.0809, -81.0912, 'Georgia container-port gateway', ['I-16', 'I-95']),
                market('Jacksonville', 'FL', 30.3322, -81.6557, 'Northeast Florida multimodal logistics', ['I-95', 'I-10']),
                market('Miami', 'FL', 25.7617, -80.1918, 'South Florida international freight', ['I-95', 'SR-826']),
            ]),
            corridor('Mid-South & Memphis Hub', 'mid-south-memphis-hub', 'Mid-South rail, air, and interstate convergence', 'TN AL MS KY'.split(' '), ['I-40', 'I-55', 'I-65'], [
                market('Memphis', 'TN', 35.1495, -90.0490, 'Mid-South air and rail gateway', ['I-40', 'I-55']),
                market('Nashville', 'TN', 36.1627, -86.7816, 'Tennessee distribution network', ['I-40', 'I-65']),
                market('Birmingham', 'AL', 33.5186, -86.8104, 'Alabama industrial freight hub', ['I-20', 'I-65']),
            ]),
        ],
    },
    {
        name: 'Midwest', slug: 'midwest', code: 'MW', color: '#FBBF24', description: 'Great Lakes manufacturing, national rail links, and inland distribution.',
        states: 'IL OH IN MI WI MN MO IA KS NE'.split(' '),
        corridors: [
            corridor('Great Lakes / I-90', 'great-lakes-i-90', 'Great Lakes manufacturing and intermodal trade', 'IL MI WI IN'.split(' '), ['I-90', 'I-94', 'Class I Rail'], [
                market('Chicago', 'IL', 41.8781, -87.6298, 'National rail and distribution junction', ['I-90', 'I-94']),
                market('Detroit', 'MI', 42.3314, -83.0458, 'Border manufacturing and automotive hub', ['I-75', 'I-94']),
                market('Milwaukee', 'WI', 43.0389, -87.9065, 'Lake Michigan distribution market', ['I-94', 'I-43']),
            ]),
            corridor('Ohio Valley / I-70', 'ohio-valley-i-70', 'Interstate crossings and Midwestern fulfillment', 'OH IN IL'.split(' '), ['I-70', 'I-71', 'I-75'], [
                market('Columbus', 'OH', 39.9612, -82.9988, 'Ohio fulfillment and retail logistics', ['I-70', 'I-71']),
                market('Indianapolis', 'IN', 39.7684, -86.1581, 'Crossroads central distribution', ['I-65', 'I-70']),
                market('Cincinnati', 'OH', 39.1031, -84.5120, 'Ohio Valley tri-state distribution', ['I-71', 'I-75']),
            ]),
            corridor('Heartland / I-35', 'heartland-i-35', 'Heartland freight and grain-to-consumer networks', 'MO IA KS NE MN'.split(' '), ['I-35', 'I-80', 'I-29'], [
                market('Kansas City', 'MO', 39.0997, -94.5786, 'Central rail and highway convergence', ['I-35', 'I-70']),
                market('Omaha', 'NE', 41.2565, -95.9345, 'Great Plains logistics center', ['I-80', 'I-29']),
                market('Des Moines', 'IA', 41.5868, -93.6250, 'Iowa interstate distribution', ['I-35', 'I-80']),
            ]),
        ],
    },
    {
        name: 'Southwest', slug: 'southwest', code: 'SW', color: '#FB7185', description: 'Texas triangle, southern border gateways, and desert logistics.',
        states: 'TX AZ OK AR LA NM'.split(' '),
        corridors: [
            corridor('Texas Triangle (DFW-Houston-San Antonio)', 'texas-triangle', 'Texas intercity freight and distribution network', 'TX OK LA'.split(' '), ['I-35', 'I-45', 'I-10'], [
                market('Dallas', 'TX', 32.7767, -96.7970, 'North Texas distribution and rail gateway', ['I-35', 'I-45']),
                market('Houston', 'TX', 29.7604, -95.3698, 'Gulf Coast container and energy hub', ['I-10', 'I-45']),
                market('San Antonio', 'TX', 29.4241, -98.4936, 'South-Central Texas freight node', ['I-10', 'I-35']),
            ]),
            corridor('Mexico Border / Laredo', 'mexico-border-laredo', 'U.S.–Mexico trade and land-border logistics', 'TX NM AZ'.split(' '), ['I-35', 'I-10', 'US-83'], [
                market('Laredo', 'TX', 27.5306, -99.4803, 'Cross-border truck freight gateway', ['I-35', 'US-83']),
                market('El Paso', 'TX', 31.7619, -106.4850, 'Border manufacturing and transload', ['I-10', 'US-54']),
                market('McAllen', 'TX', 26.2034, -98.2300, 'Lower Rio Grande border commerce', ['I-2', 'US-281']),
            ]),
            corridor('Desert Southwest / Phoenix', 'desert-southwest-phoenix', 'Arizona and New Mexico westbound links', 'AZ NM'.split(' '), ['I-10', 'I-17', 'I-40'], [
                market('Phoenix', 'AZ', 33.4484, -112.0740, 'Desert Southwest distribution hub', ['I-10', 'I-17']),
                market('Tucson', 'AZ', 32.2226, -110.9747, 'Arizona border corridor market', ['I-10', 'I-19']),
                market('Albuquerque', 'NM', 35.0844, -106.6504, 'I-40 and I-25 freight junction', ['I-40', 'I-25']),
            ]),
        ],
    },
    {
        name: 'West Coast', slug: 'west-coast', code: 'WC', color: '#FF7A45', description: 'Pacific ports, inland transload, and western-region distribution.',
        states: 'CA WA OR NV UT CO ID'.split(' '),
        corridors: [
            corridor('Southern California', 'southern-california', 'Only three active Southern California hubs', 'CA'.split(' '), ['I-5', 'I-10', 'I-110', 'I-710', 'BNSF / UP'], [...socalHubs]),
            corridor('Northern California', 'northern-california', 'Bay Area freight gateways and Central Valley distribution', 'CA NV'.split(' '), ['I-80', 'I-580', 'I-5'], [
                market('Oakland', 'CA', 37.8044, -122.2711, 'Bay Area port and intermodal market', ['I-880', 'I-580']),
                market('Stockton', 'CA', 37.9577, -121.2908, 'San Joaquin Valley inland freight', ['I-5', 'SR-99']),
                market('Sacramento', 'CA', 38.5816, -121.4944, 'Northern California regional distribution', ['I-5', 'I-80']),
            ]),
            corridor('Pacific Northwest', 'pacific-northwest', 'Puget Sound and Oregon freight gateways', 'WA OR ID'.split(' '), ['I-5', 'I-84', 'I-90'], [
                market('Seattle', 'WA', 47.6062, -122.3321, 'Puget Sound trade and logistics', ['I-5', 'I-90']),
                market('Tacoma', 'WA', 47.2529, -122.4443, 'South Sound container gateway', ['I-5', 'SR-16']),
                market('Portland', 'OR', 45.5152, -122.6784, 'Columbia River distribution and trade', ['I-5', 'I-84']),
            ]),
        ],
    },
];
export const quoteUrl = 'https://form.jotform.com/262726330251147';
export const unassignedStates = ['WV', 'MT', 'WY', 'ND', 'SD'];
export const stateToRegion = Object.fromEntries(regions.flatMap(r => r.states.map(s => [s, r.slug])));
export function pathFor(region, corridor, hub) {
    return '/coverage' + (region ? '/' + region.slug : '') + (corridor ? '/' + corridor.slug : '') + (hub ? '/' + hub.slug : '');
}
export function resolveRoute(pathname) {
    const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts[0] !== 'coverage' || parts.length > 4)
        return null;
    if (parts.length === 1)
        return { tier: 1, path: '/coverage' };
    const region = regions.find(r => r.slug === parts[1]);
    if (!region)
        return null;
    if (parts.length === 2)
        return { tier: 2, region, path: pathFor(region) };
    const corridor = region.corridors.find(c => c.slug === parts[2]);
    if (!corridor)
        return null;
    if (parts.length === 3)
        return { tier: 3, region, corridor, path: pathFor(region, corridor) };
    const hub = corridor.hubs.find(h => h.slug === parts[3]);
    if (!hub)
        return null;
    return { tier: 4, region, corridor, hub, path: pathFor(region, corridor, hub) };
}
export function pageMetadata(route) {
    if (route.hub)
        return { title: `${route.hub.name} Freight & Logistics Hub | ScapeGoat`, description: `Explore ${route.hub.name} freight connectivity, logistics capabilities, 25-mile and 250-mile service-zone references. Request a lane quote.`, heading: `${route.hub.name} Freight Hub` };
    if (route.corridor)
        return { title: `${route.corridor.name} Freight Corridor | ScapeGoat`, description: `Explore ${route.corridor.name} logistics markets, interstate corridors, and metropolitan hubs.`, heading: `${route.corridor.name} Coverage` };
    if (route.region)
        return { title: `${route.region.name} Freight & Logistics Coverage | ScapeGoat`, description: `Discover ${route.region.name} logistics corridors, port gateways, and key freight markets.`, heading: `${route.region.name} Freight Coverage` };
    return { title: 'U.S. Freight & Logistics Coverage Map | ScapeGoat', description: 'Interactive U.S. freight coverage map. Drill from five logistics regions into corridors, metros, and hub capabilities.', heading: 'U.S. Freight Coverage Network' };
}
export function parentPath(route) {
    if (route.tier === 4)
        return pathFor(route.region, route.corridor);
    if (route.tier === 3)
        return pathFor(route.region);
    return '/coverage';
}
export function childEntries(route) {
    if (route.tier === 1)
        return regions.map(r => ({ name: r.name, description: r.description, path: pathFor(r), slug: r.slug }));
    if (route.tier === 2 && route.region)
        return route.region.corridors.map(c => ({ name: c.name, description: c.descriptor, path: pathFor(route.region, c), slug: c.slug }));
    if (route.tier === 3 && route.region && route.corridor)
        return route.corridor.hubs.map(h => ({ name: h.name, description: h.positioning, path: pathFor(route.region, route.corridor, h), slug: h.slug, status: h.status }));
    if (route.tier === 4 && route.hub)
        return route.hub.capabilities.map((c, i) => ({ name: c.title, description: c.description, path: quoteUrl, slug: `capability-${i + 1}` }));
    return [];
}

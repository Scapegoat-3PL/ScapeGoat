import { regions, quoteUrl, stateToRegion, resolveRoute, pathFor, pageMetadata, parentPath, childEntries } from './coverageData.js';
const NS = 'http://www.w3.org/2000/svg';
const $ = (s) => document.querySelector(s);
const element = (tag, cls) => { const e = document.createElementNS(NS, tag); if (cls)
    e.setAttribute('class', cls); return e; };
const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
let route = resolveRoute(location.pathname) || { tier: 1, path: '/coverage' };
let geometry = null;
let stateLayer = null;
let markerLayer = null;
let linesLayer = null;
let zoneLayer = null;
let mapCamera = null;
let hovered = null;
let searchedState = null;
let activeRequest = 0;
// EPSG:5070 NAD83/CONUS Albers equal-area, matching pre-rendered state geometry.
const RAD = Math.PI / 180;
const A = 6378137.0;
const E = Math.sqrt(0.00669438002290);
const phi1 = 29.5 * RAD, phi2 = 45.5 * RAD, phi0 = 23 * RAD, lambda0 = -96 * RAD;
const m = (p) => Math.cos(p) / Math.sqrt(1 - E * E * Math.sin(p) ** 2);
const q = (p) => { const sin = Math.sin(p), es = E * sin; return (1 - E * E) * (sin / (1 - es * es) - Math.log((1 - es) / (1 + es)) / (2 * E)); };
const n = (m(phi1) ** 2 - m(phi2) ** 2) / (q(phi2) - q(phi1));
const C = m(phi1) ** 2 + n * q(phi1);
const rho = (p) => A * Math.sqrt(C - n * q(p)) / n;
const rho0 = rho(phi0);
function pixel(lat, lon) {
    if (!geometry)
        return [0, 0];
    const p = lat * RAD, l = lon * RAD, rr = rho(p), theta = n * (l - lambda0);
    const x = rr * Math.sin(theta), y = rho0 - rr * Math.cos(theta);
    const g = geometry.projection;
    return [g.xOffset + (x - g.minx) * g.scale, geometry.height - (g.yOffset + (y - g.miny) * g.scale)];
}
function svgPath(points) { return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z'; }
function radiusRing(hub, miles) {
    const p1 = hub.lat * RAD, l1 = hub.lon * RAD, d = miles * 1609.344 / 6371008.8;
    const pts = [];
    for (let deg = 0; deg <= 360; deg += 4) {
        const b = deg * RAD;
        const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
        const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
        pts.push(pixel(p2 / RAD, l2 / RAD));
    }
    return svgPath(pts);
}
function getRegionBounds(slug) {
    const r = regions.find(x => x.slug === slug);
    const boxes = r.states.map(s => geometry?.states[s]?.bounds).filter((x) => !!x);
    return [Math.min(...boxes.map(x => x[0])), Math.min(...boxes.map(x => x[1])), Math.max(...boxes.map(x => x[2])), Math.max(...boxes.map(x => x[3]))];
}
function cameraFor(bounds, pad = 95, maxScale = 18) {
    if (!geometry)
        return 'translate(0px, 0px) scale(1)';
    const [x1, y1, x2, y2] = bounds;
    const scale = Math.min(maxScale, (geometry.width - 2 * pad) / Math.max(1, x2 - x1), (geometry.height - 2 * pad) / Math.max(1, y2 - y1));
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    return `translate(${(geometry.width / 2 - scale * cx).toFixed(2)}px, ${(geometry.height / 2 - scale * cy).toFixed(2)}px) scale(${scale.toFixed(4)})`;
}
function zoom() {
    if (!geometry || !mapCamera)
        return;
    if (route.tier === 1) {
        mapCamera.style.transform = 'translate(0px, 0px) scale(1)';
        return;
    }
    if (route.tier === 2 && route.region) {
        mapCamera.style.transform = cameraFor(getRegionBounds(route.region.slug), 85, 3.2);
        return;
    }
    if (route.tier === 3 && route.corridor) {
        const pts = route.corridor.hubs.map(h => pixel(h.lat, h.lon)), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        const pad = route.corridor.slug === 'southern-california' ? 62 : 70;
        const x1 = Math.min(...xs) - pad, y1 = Math.min(...ys) - pad, x2 = Math.max(...xs) + pad, y2 = Math.max(...ys) + pad;
        mapCamera.style.transform = cameraFor([x1, y1, x2, y2], 115, 8);
        return;
    }
    if (route.hub) {
        const c = pixel(route.hub.lat, route.hub.lon);
        const points = radiusRing(route.hub, 250).match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
        const xs = points.filter((_, i) => i % 2 === 0), ys = points.filter((_, i) => i % 2 === 1);
        const ext = xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : [c[0] - 70, c[1] - 70, c[0] + 70, c[1] + 70];
        mapCamera.style.transform = cameraFor(ext, 130, 9);
    }
}
function activeStates() { return new Set(route.region?.states || []); }
function setHover(slug) {
    hovered = slug;
    document.querySelectorAll('[data-hover-slug]').forEach(e => e.classList.toggle('hovered', !!slug && e.dataset.hoverSlug === slug));
    document.querySelectorAll('.map-state').forEach(e => {
        const target = e.dataset.region;
        e.classList.toggle('hovered', !!slug && target === slug && route.tier === 1);
        e.classList.toggle('hover-muted', !!slug && route.tier === 1 && target !== slug);
    });
}
function setupStateLayers() {
    if (!geometry || !stateLayer)
        return;
    stateLayer.innerHTML = '';
    for (const [abbr, data] of Object.entries(geometry.states)) {
        const path = element('path', 'map-state');
        path.setAttribute('d', data.path);
        path.setAttribute('fill-rule', 'evenodd');
        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'link');
        path.setAttribute('aria-label', `${abbr} — ${data.region ? regions.find(r => r.slug === data.region)?.name : 'unassigned'}`);
        path.dataset.abbr = abbr;
        path.dataset.region = data.region || '';
        path.addEventListener('mouseenter', () => { if (route.tier === 1 && data.region)
            setHover(data.region); });
        path.addEventListener('mouseleave', () => { if (route.tier === 1)
            setHover(null); });
        path.addEventListener('focus', () => { if (route.tier === 1 && data.region)
            setHover(data.region); });
        path.addEventListener('blur', () => setHover(null));
        path.addEventListener('click', () => {
            if (route.tier === 1 && data.region)
                navigate(`/coverage/${data.region}`);
            else if (data.region && route.tier > 1 && data.region !== route.region?.slug)
                navigate(`/coverage/${data.region}`);
        });
        path.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && data.region) {
            e.preventDefault();
            navigate(`/coverage/${data.region}`);
        } });
        stateLayer.appendChild(path);
    }
}
function marker(x, y, label, slug, href, kind, color) {
    if (!markerLayer)
        return;
    const g = element('g', `map-marker map-marker--${kind}`);
    g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'link');
    g.setAttribute('aria-label', `${label}, open coverage details`);
    g.dataset.hoverSlug = slug;
    const ring = element('circle', 'marker-pulse');
    ring.setAttribute('r', kind === 'hub' ? '16' : '21');
    const rim = element('circle', 'marker-rim');
    rim.setAttribute('r', kind === 'hub' ? '8' : '10');
    rim.setAttribute('fill', color);
    const core = element('circle', 'marker-core');
    core.setAttribute('r', '3');
    const txt = element('text', 'marker-label');
    txt.textContent = label;
    txt.setAttribute('x', '14');
    txt.setAttribute('y', '4');
    g.append(ring, rim, core, txt);
    g.addEventListener('click', () => navigate(href));
    g.addEventListener('mouseenter', () => setHover(slug));
    g.addEventListener('mouseleave', () => setHover(null));
    g.addEventListener('focus', () => setHover(slug));
    g.addEventListener('blur', () => setHover(null));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate(href);
    } });
    markerLayer.appendChild(g);
}
function corridorLine(c, slug, url, color) {
    if (!linesLayer || !markerLayer)
        return;
    const pts = c.hubs.map(h => pixel(h.lat, h.lon));
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    for (const cls of ['route-glow', 'route-core', 'route-hit']) {
        const line = element('path', cls);
        line.setAttribute('d', d);
        if (cls === 'route-core')
            line.setAttribute('stroke', color);
        if (cls === 'route-hit') {
            line.dataset.hoverSlug = slug;
            line.setAttribute('role', 'link');
            line.setAttribute('tabindex', '0');
            line.setAttribute('aria-label', c.name);
            line.addEventListener('click', () => navigate(url));
            line.addEventListener('mouseenter', () => setHover(slug));
            line.addEventListener('mouseleave', () => setHover(null));
            line.addEventListener('focus', () => setHover(slug));
            line.addEventListener('blur', () => setHover(null));
            line.addEventListener('keydown', (e) => { if (e.key === 'Enter') {
                navigate(url);
            } });
        }
        linesLayer.appendChild(line);
    }
    const mx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const my = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    marker(mx, my, c.name, slug, url, 'corridor', color);
}
function renderZones() {
    if (!zoneLayer || !route.hub || !geometry)
        return;
    const h = route.hub;
    for (const [mi, label, cls] of [[250, '250 MI · REGIONAL', 'zone-250'], [25, '25 MI · LOCAL', 'zone-25']]) {
        const p = element('path', `service-zone ${cls}`);
        p.setAttribute('d', radiusRing(h, mi));
        zoneLayer.appendChild(p);
        const a = radiusRing(h, mi).match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
        if (a.length >= 2) {
            const txt = element('text', 'zone-label');
            txt.textContent = label;
            txt.setAttribute('x', String(a[0] + 9));
            txt.setAttribute('y', String(a[1] - 5));
            zoneLayer.appendChild(txt);
        }
    }
}
function renderMap() {
    if (!geometry || !stateLayer || !markerLayer || !linesLayer || !zoneLayer)
        return;
    const selected = activeStates();
    document.querySelectorAll('.map-state').forEach(p => {
        const abbr = p.dataset.abbr || '', region = p.dataset.region || '';
        p.classList.toggle('selected-state', !!route.region && selected.has(abbr));
        p.classList.toggle('dimmed-state', !!route.region && !selected.has(abbr));
        p.classList.toggle('unassigned-state', !region);
        p.classList.toggle('search-state', searchedState === abbr);
        p.style.setProperty('--region-color', regions.find(r => r.slug === region)?.color || '#566579');
    });
    markerLayer.innerHTML = '';
    linesLayer.innerHTML = '';
    zoneLayer.innerHTML = '';
    const color = route.region?.color || '#9FD4FF';
    if (route.tier === 2 && route.region) {
        for (const c of route.region.corridors)
            corridorLine(c, c.slug, pathFor(route.region, c), color);
    }
    if (route.tier === 3 && route.region && route.corridor) {
        corridorLine(route.corridor, route.corridor.slug, pathFor(route.region, route.corridor), color);
        for (const h of route.corridor.hubs)
            marker(...pixel(h.lat, h.lon), h.name, h.slug, pathFor(route.region, route.corridor, h), 'hub', color);
    }
    if (route.tier === 4 && route.hub) {
        renderZones();
        marker(...pixel(route.hub.lat, route.hub.lon), route.hub.name, route.hub.slug, route.path, 'hub', color);
    }
    zoom();
    const badge = $('#map-tier');
    if (badge)
        badge.textContent = `L0${route.tier} / ${['NATIONAL', 'REGION', 'CORRIDOR', 'HUB'][route.tier - 1]}`;
    const legend = $('#map-legend');
    if (legend)
        legend.textContent = route.tier === 4 ? 'RADIAL ZONES ARE INDICATIVE • TRANSIT NOT GUARANTEED' : route.tier === 1 ? 'SELECT A REGION OR SEARCH FOR A STATE / ZIP' : 'SELECT A SUPPLY LINE OR HUB PIN TO DRILL DOWN';
}
function renderBreadcrumb() {
    const links = [{ label: 'USA', path: '/coverage' }];
    if (route.region)
        links.push({ label: route.region.name, path: pathFor(route.region) });
    if (route.corridor)
        links.push({ label: route.corridor.name, path: pathFor(route.region, route.corridor) });
    if (route.hub)
        links.push({ label: route.hub.name, path: route.path });
    return links.map((x, i) => i === links.length - 1 ? `<span class="crumb-current" aria-current="page">${escapeHtml(x.label)}</span>` : `<a href="${x.path}" data-route="${x.path}">${escapeHtml(x.label)}</a><span aria-hidden="true" class="crumb-divider">/</span>`).join('');
}
function renderKey() {
    const target = $('#key-dynamic');
    if (!target)
        return;
    const meta = pageMetadata(route), items = childEntries(route);
    const caption = ['NATIONAL COVERAGE', 'FREIGHT CORRIDORS', 'METRO FREIGHT HUBS', 'SERVICE CAPABILITIES'][route.tier - 1];
    const intro = route.hub?.positioning || route.corridor?.descriptor || route.region?.description || 'Select a region to inspect its freight corridors, metro markets, and available capabilities.';
    const color = route.region?.color || '#FF7A45';
    const keyCards = items.map((item, i) => {
        const isHub = route.tier === 3;
        const isQuote = route.tier === 4;
        const url = isQuote ? quoteUrl : item.path;
        const attrs = isQuote ? 'target="_blank" rel="noopener noreferrer"' : `data-route="${item.path}"`;
        const status = isHub ? `<span class="small-status ${item.status === 'active-hub' ? 'active' : 'market'}">${item.status === 'active-hub' ? 'ACTIVE SOCAL HUB' : 'METRO DIRECTORY'}</span>` : '';
        return `<a class="key-card" href="${escapeHtml(url)}" ${attrs} data-hover-slug="${escapeHtml(item.slug)}" style="--card-accent:${color}">
      <span class="key-card-index">${String(i + 1).padStart(2, '0')}</span>
      <span class="key-card-body"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.description)}</span>${status}</span>
      <span class="key-card-arrow" aria-hidden="true">${isQuote ? '↗' : '→'}</span>
    </a>`;
    }).join('');
    const detail = route.hub ? `<div class="hub-detail"><div class="hub-spec">${route.hub.status === 'active-hub' ? 'ACTIVE SOUTHERN CALIFORNIA HUB' : 'ILLUSTRATIVE MARKET — AVAILABILITY UNCONFIRMED'}</div><div class="arteries">${route.hub.arteries.map(a => `<span>${escapeHtml(a)}</span>`).join('')}</div><div class="hub-coordinates">${route.hub.lat.toFixed(4)}° N / ${Math.abs(route.hub.lon).toFixed(4)}° W</div></div>` : '';
    const caveat = route.hub?.status === 'market-directory' ? `<p class="capability-notice">This metro is a directory location, not a confirmed operated facility. Services are subject to verification and quotation.</p>` : '';
    const quote = route.tier === 4 ? `<a class="quote-button" href="${quoteUrl}" target="_blank" rel="noopener noreferrer">REQUEST LANE QUOTE <span aria-hidden="true">↗</span></a>` : '';
    const back = route.tier > 1 ? `<a href="${parentPath(route)}" data-route="${parentPath(route)}" class="zoom-out">← ZOOM OUT</a>` : `<span class="zoom-out disabled">← NATIONAL VIEW</span>`;
    target.innerHTML = `<div class="key-top"><div class="key-overline">TACTICAL KEY <span class="key-level">0${route.tier} / 04</span></div><nav aria-label="Coverage breadcrumb" class="breadcrumbs">${renderBreadcrumb()}</nav><div class="key-back">${back}</div></div><div class="key-scroll"><div class="key-stage"><span class="eyebrow">${caption}</span><h1>${escapeHtml(meta.heading)}</h1><p class="key-intro">${escapeHtml(intro)}</p>${detail}<div class="key-items">${keyCards}</div>${caveat}${quote}</div><div class="key-footer"><span>NETWORK INTELLIGENCE / US-48</span><span>SCAPEGOAT</span></div></div>`;
    const title = $('#screen-heading');
    if (title)
        title.textContent = meta.heading;
    const metadata = $('meta[name="description"]');
    if (metadata)
        metadata.content = meta.description;
    document.title = meta.title;
    const canonical = $('link[rel="canonical"]');
    if (canonical)
        canonical.href = `https://scapegoat3plwarehouserates.com${route.path}/`;
    installLinks();
}
function navigate(path, replace = false) {
    const next = resolveRoute(path);
    if (!next)
        return;
    if (!replace && next.path !== route.path)
        history.pushState({ path: next.path }, '', next.path);
    route = next;
    hovered = null;
    renderKey();
    renderMap();
    const pane = $('.tactical-key');
    if (pane)
        pane.scrollTop = 0;
    const anno = $('#route-announcer');
    if (anno)
        anno.textContent = `Showing ${pageMetadata(route).heading}`;
}
function installLinks() {
    document.querySelectorAll('a[data-route]').forEach(a => {
        a.onclick = (event) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
                return;
            const path = a.dataset.route;
            if (path) {
                event.preventDefault();
                navigate(path);
            }
        };
        a.onmouseenter = () => { if (a.dataset.hoverSlug)
            setHover(a.dataset.hoverSlug); };
        a.onmouseleave = () => setHover(null);
        a.onfocus = () => { if (a.dataset.hoverSlug)
            setHover(a.dataset.hoverSlug); };
        a.onblur = () => setHover(null);
    });
}
function searchMessage(msg, error = false) {
    const e = $('#search-status');
    if (e) {
        e.textContent = msg;
        e.classList.toggle('error', error);
    }
}
const stateNames = { AL: 'alabama', AZ: 'arizona', AR: 'arkansas', CA: 'california', CO: 'colorado', CT: 'connecticut', DE: 'delaware', FL: 'florida', GA: 'georgia', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa', KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland', MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi', MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new hampshire', NJ: 'new jersey', NM: 'new mexico', NY: 'new york', NC: 'north carolina', ND: 'north dakota', OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode island', SC: 'south carolina', SD: 'south dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont', VA: 'virginia', WA: 'washington', WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming' };
async function runSearch(raw) {
    const request = ++activeRequest, val = raw.trim().toLowerCase();
    if (!val) {
        searchMessage('Enter a state, abbreviation, or five-digit ZIP.', true);
        return;
    }
    let state = Object.keys(stateNames).find(s => s.toLowerCase() === val || stateNames[s] === val) || null;
    if (!state && /^\d{5}$/.test(val)) {
        searchMessage(`Checking ZIP ${val}…`);
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${val}`);
            if (!response.ok)
                throw new Error('ZIP not found');
            const data = await response.json();
            if (request !== activeRequest)
                return;
            state = data.places?.[0]?.['state abbreviation'] || null;
        }
        catch {
            if (request === activeRequest)
                searchMessage('ZIP lookup unavailable. Please enter a state abbreviation instead.', true);
            return;
        }
    }
    if (!state || !(state in stateNames)) {
        searchMessage('Enter a valid state name, abbreviation, or five-digit U.S. ZIP.', true);
        return;
    }
    searchedState = state;
    const slug = stateToRegion[state];
    if (slug) {
        searchMessage(`${stateNames[state].replace(/\b\w/g, c => c.toUpperCase())} → ${regions.find(r => r.slug === slug)?.name}`);
        navigate(`/coverage/${slug}`);
    }
    else {
        searchMessage(`${state} is not currently assigned to a coverage region.`, true);
        navigate('/coverage');
    }
    renderMap();
}
function installEvents() {
    addEventListener('popstate', () => navigate(location.pathname, true));
    addEventListener('keydown', e => {
        if (e.key === 'Escape' && route.tier > 1) {
            const target = e.target;
            if (target?.tagName === 'INPUT')
                return;
            navigate(parentPath(route));
        }
    });
    $('#coverage-map')?.addEventListener('contextmenu', e => { e.preventDefault(); if (route.tier > 1)
        navigate(parentPath(route)); });
    const input = $('#state-zip-input');
    $('#state-search')?.addEventListener('submit', e => { e.preventDefault(); if (input)
        void runSearch(input.value); });
    $('#reset-view')?.addEventListener('click', () => navigate('/coverage'));
}
async function boot() {
    // Browser fetches a bundled local static JSON file; no external map service involved.
    try {
        const res = await fetch('/coverage/assets/states.json');
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        geometry = await res.json();
    }
    catch {
        const message = $('#map-loading');
        if (message)
            message.textContent = 'Map geometry unavailable. The navigation directory remains usable.';
        renderKey();
        installEvents();
        return;
    }
    const loading = $('#map-loading');
    if (loading)
        loading.remove();
    mapCamera = $('#map-camera');
    stateLayer = $('#state-layer');
    linesLayer = $('#lines-layer');
    zoneLayer = $('#zone-layer');
    markerLayer = $('#marker-layer');
    setupStateLayers();
    renderKey();
    renderMap();
    installEvents();
}
void boot();

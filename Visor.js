/**
 * VISOR.JS · Lógica del Geovisor Santa Elena (vereda Piedras Blancas)
 *
 * Secciones, en orden:
 *   1. Clases de cobertura y categorías del POT 2014
 *   2. Geometrías de demostración (coberturas históricas)
 *   3. Mapa Leaflet y mapas base
 *   4. Capas (POT, catastro) y leyendas
 *   5. Coberturas y cortinilla multitemporal
 *   6. Ficha normativa POT (clic en el mapa)
 *   7. Estadísticas (Chart.js)
 *   8. Análisis espacial (medición, polígonos, buffer)
 *   9. Búsqueda, vistas, geolocalización y exportación
 *  10. Panel lateral y pestañas
 *
 * Librerías (CDN): Leaflet, Leaflet.draw, MiniMap, Turf.js, Chart.js, html2canvas.
 * El POT y los límites se cargan desde GeoJSON locales; las coberturas históricas son demostrativas.
 */

/* Diagnóstico: avisa si faltan librerías (sin internet, CDN bloqueado) o si ocurre un error */
(function () {
  const aviso = (m) => {
    const d = document.createElement("div");
    d.style.cssText =
      "position:fixed;z-index:9999;top:60px;left:50%;transform:translateX(-50%);max-width:90%;background:#fde8e8;border:1px solid #ce1126;border-radius:4px;padding:10px 16px;font:14px system-ui";
    d.textContent = m;
    document.body.appendChild(d);
  };
  window.addEventListener("error", (e) => aviso("Error en el geovisor: " + e.message));
  const falta = [
    ["L", "Leaflet"],
    ["turf", "Turf.js"],
    ["Chart", "Chart.js"],
    ["html2canvas", "html2canvas"],
  ]
    .filter(([v]) => typeof window[v] === "undefined")
    .map((x) => x[1]);
  if (falta.length) {
    aviso(
      "No se cargaron estas librerías: " +
        falta.join(", ") +
        ". Revisa tu conexión a internet o si algo bloquea cdnjs.cloudflare.com.",
    );
  }
})();
const $= (s) => document.querySelector(s),$$ = (s) => [...document.querySelectorAll(s)];
const fmt = (n, d = 1) => n.toLocaleString("es-CO", { maximumFractionDigits: d });
const toast = (m) => {
  const t = $("#toast");
  t.textContent = m;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 2800);
};

/* ---------- Clases y normativa ---------- */
const CL = {
  denso: ["Bosque denso", "#1e6b3a"],
  frag: ["Bosque fragmentado", "#8fbf6a"],
  pasto: ["Pastos / agrícola", "#e2c15d"],
  cons: ["Construido / residencial rural", "#c8553d"],
  agua: ["Cuerpos de agua (embalse)", "#3f8fd2"],
};
// Las categorías se leen de la capa oficial POT 2014 al cargar el GeoJSON recortado.
const POT = {};
const ZN = {};
let potFeatures = [];
const POT_COLORS = ["#2563eb", "#0f766e", "#9333ea", "#d97706", "#db2777", "#475569"];
const safeText = (value) => String(value ?? "Sin dato").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[c]);

/* ---------- Geometrías de demostración (lon, lat). Reemplazar por GeoJSON reales ---------- */
const Vp = turf.polygon([
  [
    [-75.512, 6.272],
    [-75.498, 6.266],
    [-75.482, 6.27],
    [-75.474, 6.284],
    [-75.478, 6.3],
    [-75.492, 6.306],
    [-75.508, 6.299],
    [-75.516, 6.285],
    [-75.512, 6.272],
  ],
]);
const rect = (a, b, c, d) => turf.bboxPolygon([a, b, c, d]);
const sq = (x, y, r) => rect(x - r / 111, y - r / 111, x + r / 111, y + r / 111);
const cl = (g) => g && turf.intersect(g, Vp);
const df = (a, ...bs) => {
  for (const b of bs) if (a && b) a = turf.difference(a, b);
  return a;
};
const un = (a, b) => (a ? turf.union(a, b) : b);
const BLT = [
  [-75.503, 6.277, 2015],
  [-75.498, 6.274, 2015],
  [-75.491, 6.296, 2015],
  [-75.506, 6.281, 2020],
  [-75.486, 6.293, 2020],
  [-75.481, 6.281, 2020],
  [-75.501, 6.272, 2020],
  [-75.495, 6.289, 2024],
  [-75.505, 6.287, 2024],
  [-75.488, 6.3, 2024],
  [-75.48, 6.288, 2024],
];
const PAS = [
  [-75.51, 6.292, 0.5],
  [-75.482, 6.275, 0.45],
];
const DATA = {};
function cover(y) {
  const t = (y - 2015) / 9;
  let b = null,
    p = null;
  BLT.forEach(([x, yy, f]) => {
    if (f <= y) b = un(b, sq(x, yy, 0.12 + 0.01 * (y - f)));
  });
  PAS.forEach(
    ([x, yy, r]) =>
      (p = un(
        p,
        turf.buffer(turf.point([x, yy]), r * (1 + 0.2 * t), { units: "kilometers", steps: 8 }),
      )),
  );
  if (y >= 2020) p = un(p, turf.buffer(turf.point([-75.5, 6.298]), 0.35, { units: "kilometers" }));
  if (y >= 2024) p = un(p, turf.buffer(turf.point([-75.486, 6.27]), 0.3, { units: "kilometers" }));
  const w = cl(turf.buffer(turf.point([-75.489, 6.2845]), 0.35, { units: "kilometers", steps: 8 }));
  b = df(cl(b), w);
  p = df(cl(p), w, b);
  const fr = df(cl(turf.buffer(b, 0.25, { units: "kilometers" })), b, w, p);
  return { denso: df(Vp, b, w, p, fr), frag: fr, pasto: p, cons: b, agua: w };
}
[2015, 2020, 2024].forEach((y) => {
  DATA[y] = cover(y);
});
const COR = turf.polygon([
  [
    [-75.55, 6.22],
    [-75.43, 6.225],
    [-75.425, 6.33],
    [-75.55, 6.325],
    [-75.55, 6.22],
  ],
]);
// Coordenada de referencia del Parque Arví; el valor anterior apuntaba fuera del parque.
const PL = { "Parque Arví": [6.26556, -75.49694], "Embalse Piedras Blancas": [6.2845, -75.489] };
$("#dl").innerHTML = Object.keys(PL)
  .map((n) => `<option value="${n}">`)
  .join("");

/* ---------- Mapa ---------- */
const map = L.map("map", { zoomControl: false }).fitBounds(L.geoJSON(Vp).getBounds());
L.control.zoom({ position: "topleft", zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(map);
// La comparación histórica se dibuja sobre el mapa base y debajo de las capas temáticas.
["izq", "der"].forEach((n) => (map.createPane(n).style.zIndex = 225));
map.createPane("potp").style.zIndex = 390;
const cc = "&copy; OpenStreetMap &copy; CARTO",
  es = "Esri";
const BM = {
  "Carto Positron (claro)": L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { attribution: cc, maxZoom: 19 },
  ),
  "Satélite Esri + nombres": L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: es, maxZoom: 19 },
  ),
  "Relieve sombreado Esri": L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
    { attribution: es, maxZoom: 23 },
  ),
  "Topográfico Esri": L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    { attribution: es, maxZoom: 19 },
  ),
  "OpenTopoMap (relieve)": L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenTopoMap",
    maxZoom: 17,
  }),
  "Carto Dark Matter (oscuro)": L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    { attribution: cc, maxZoom: 19 },
  ),
};
map.createPane("baseLabels").style.zIndex = 650;
const satelliteLabels = L.tileLayer(
  "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  { attribution: es, maxZoom: 19, pane: "baseLabels" },
);
const defaultBaseName = Object.keys(BM).find((name) => name.includes("Satélite Esri"));
let base = BM[defaultBaseName].addTo(map);
satelliteLabels.addTo(map);
/* Si el servidor de teselas falla, cambia a un proveedor independiente. */
let tileErrs = 0;
Object.values(BM).forEach((l) =>
  l.on("tileerror", () => {
    if (base !== l || ++tileErrs < 4) return;
    if (l === BM["Carto Positron (claro)"]) {
      toast("No se pudieron cargar las teselas del mapa. Revisa tu conexión a internet.");
      return;
    }
    toast("El mapa satelital no respondió; se cambió al mapa de calles.");
    map.removeLayer(base);
    map.removeLayer(satelliteLabels);
    base = BM["Carto Positron (claro)"].addTo(map);
    tileErrs = 0;
    $('[name=bm][value="Carto Positron (claro)"]').checked = true;
  }),
);
L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
const importedLayers = new Map();
let importedLayerCounter = 0;
let miniReferenceLayers = {};
const miniBaseLayer = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
  { minZoom: 0, maxZoom: 13, attribution: es },
);
const miniLayers = L.layerGroup([miniBaseLayer]);
$("#geojsonFile").addEventListener("change", async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;
  const status = $("#userLayerStatus");
  try {
    const queue = [];
    const sidecars = new Set([".dbf", ".shx", ".prj", ".cpg"]);
    for (const file of files) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (ext === ".json" || ext === ".geojson") {
        queue.push({ name: file.name, data: JSON.parse(await file.text()) });
      } else if (ext === ".zip") {
        if (typeof window.shp !== "function") throw new Error("No se cargó el lector SHP. Revisa la conexión e inténtalo de nuevo.");
        const parsed = await window.shp(await file.arrayBuffer());
        (Array.isArray(parsed) ? parsed : [parsed]).forEach((data) => queue.push({ name: data.fileName || file.name.replace(/\.zip$/i, ""), data }));
      } else if (ext === ".shp") {
        if (typeof window.shp !== "function") throw new Error("No se cargó el lector SHP. Revisa la conexión e inténtalo de nuevo.");
        const stem = file.name.replace(/\.shp$/i, "");
        const parts = Object.fromEntries(files
          .filter((part) => part.name.replace(/\.[^.]+$/, "").toLowerCase() === stem.toLowerCase())
          .map((part) => [part.name.slice(part.name.lastIndexOf(".")).toLowerCase(), part]));
        if (!parts[".prj"]) throw new Error(`${file.name}: falta el archivo .prj; se necesita para transformar las coordenadas a WGS84.`);
        const source = { shp: await file.arrayBuffer(), prj: await parts[".prj"].arrayBuffer() };
        for (const extPart of [".dbf", ".cpg"]) if (parts[extPart]) source[extPart.slice(1)] = await parts[extPart].arrayBuffer();
        queue.push({ name: stem, data: await window.shp(source) });
      } else if (!sidecars.has(ext)) {
        throw new Error(`Formato no compatible: ${file.name}. Usa GeoJSON (.geojson/.json), un ZIP o archivos SHP.`);
      }
    }
    let added = 0;
    let featureCount = 0;
    for (const item of queue) {
      const data = item.data;
      if (!["FeatureCollection", "Feature", "GeometryCollection", "Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"].includes(data?.type)) {
        throw new Error(`${item.name}: el archivo no contiene una capa geográfica válida.`);
      }
      const layer = L.geoJSON(data, {
        style: { color: "#e34a33", weight: 2, fillColor: "#fdbb84", fillOpacity: 0.35 },
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 6, color: "#9e2f20", fillColor: "#fdbb84", fillOpacity: 0.85 }),
        onEachFeature: (feature, featureLayer) => featureLayer.on("click", (clickEvent) => {
          L.DomEvent.stopPropagation(clickEvent.originalEvent);
          showFeatureAttributes(feature, item.name, clickEvent.latlng);
        }),
      });
      if (!layer.getLayers().length) throw new Error(`${item.name}: no contiene elementos geográficos.`);
      const id = String(++importedLayerCounter);
      const miniLayer = L.geoJSON(data, {
        style: { color: "#e34a33", weight: 2, fillColor: "#fdbb84", fillOpacity: 0.55 },
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 5, color: "#9e2f20", fillColor: "#fdbb84", fillOpacity: 0.9 }),
      });
      layer.addTo(map);
      miniLayers.addLayer(miniLayer);
      importedLayers.set(id, { name: item.name, layer, miniLayer, data, color: "#e34a33", mode: "fill", opacity: 0.35 });
      featureCount += layer.getLayers().length;
      added++;
    }
    renderImportedLayers();
    const lastLayer = [...importedLayers.values()].at(-1)?.layer;
    const bounds = lastLayer?.getBounds();
    if (bounds?.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
    status.textContent = added ? `Se añadieron ${added} capa(s), con ${featureCount.toLocaleString("es-CO")} elementos. Haz clic en una entidad del mapa para ver sus atributos o abre «Atributos» para consultar la tabla. Las coordenadas SHP se muestran en WGS84.` : "No se encontraron archivos de capa en la selección.";
    renderProjectLegend();
  } catch (error) {
    status.textContent = error instanceof SyntaxError ? "No se pudo leer el GeoJSON. Verifica que esté en formato UTF-8." : error.message;
  } finally {
    event.target.value = "";
  }
});
new L.Control.MiniMap(
  miniLayers,
  {
    toggleDisplay: true,
    zoomLevelOffset: -4,
    zoomAnimation: true,
    aimingRectOptions: { color: "#1d4e89", weight: 1.5, opacity: 0.95, fill: false },
    shadowRectOptions: {
      color: "#1d4e89",
      weight: 1,
      opacity: 0.2,
      fillColor: "#1d4e89",
      fillOpacity: 0.14,
    },
    position: "bottomright",
    width: 180,
    height: 135,
  },
).addTo(map);
map.on(
  "mousemove",
  (e) =>
    ($("#coords").textContent = `Lat ${e.latlng.lat.toFixed(5)} · Lon ${e.latlng.lng.toFixed(5)}`),
);

/* ---------- Capas ---------- */
const at = (ll) => {
  const p = turf.point([ll.lng, ll.lat]);
  const feature = potFeatures.find((f) => turf.booleanPointInPolygon(p, f));
  const z = feature?.properties?._potKey ?? null;
  const cv = (y) => {
    const k = Object.keys(DATA[y]).find(
      (k) => DATA[y][k] && turf.booleanPointInPolygon(p, DATA[y][k]),
    );
    return k ? CL[k][0] : "—";
  };
  return { z, feature, c15: cv(2015), c24: cv(2024) };
};
let selectedPotBounds = null;
let potZoomButton = null;
const G = {
  ver: L.geoJSON(Vp, { style: { color: "#e2a400", weight: 2.4, fill: false }, interactive: false }),
  barrios: L.geoJSON(null, { style: { color: "#467a9d", weight: 1, fill: false }, interactive: false }),
  comunas: L.geoJSON(null, { style: { color: "#8a66a8", weight: 1.2, dashArray: "5 4", fill: false }, interactive: false }),
  cor: L.geoJSON(COR, {
    style: { color: "#6b3fa0", weight: 2, dashArray: "8 5", fill: false },
    interactive: false,
  }),
  cons: L.geoJSON(null, {
    renderer: L.canvas({ padding: 0.5 }),
    style: { color: "#7f1d1d", weight: 0.35, fillColor: "#ef573f", fillOpacity: 0.58 },
    onEachFeature: (f, layer) => {
      const p = f.properties || {};
      const safe = (value) =>
        String(value ?? "Sin dato").replace(/[&<>"]/g, (c) =>
          c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
        );
      const area = Number(p.area_const);
      layer.bindPopup(
        `<b>Construcción</b><br>CBML: ${safe(p.cbml)}<br>Tipo: ${safe(p.tipo_const)}<br>Área: ${Number.isFinite(area) ? fmt(area, 1) + " m²" : "Sin dato"}<br>Pisos: ${safe(p.numero_pis)}`,
      );
    },
  }),
  pot: L.geoJSON(
    null,
    {
      pane: "potp",
      onEachFeature: (f, layer) => {
        const p = f.properties || {};
        const detail = `<b>${safeText(p.areagralus)}</b><br>${safeText(p.subcategor)}<br>Código de uso: ${safeText(p.cod_cat_us)} · subcategoría: ${safeText(p.cod_subcat)}<br>Fuente: POT Medellín 2014`;
        const content = document.createElement("div");
        const description = document.createElement("div");
        description.innerHTML = detail;
        const zoomButton = document.createElement("button");
        zoomButton.type = "button";
        zoomButton.className = "btn pri pot-zoom-button";
        zoomButton.textContent = "Acercar a este polígono";
        zoomButton.addEventListener("click", () => {
          const bounds = layer.getBounds();
          if (bounds.isValid()) map.fitBounds(bounds.pad(0.12), { maxZoom: 17, padding: [24, 24] });
          map.closePopup();
        });
        content.append(description, zoomButton);
        layer.bindPopup(content, { maxWidth: 320 });
        layer.on("click", () => {
          selectedPotBounds = layer.getBounds();
          if (potZoomButton) {
            potZoomButton.disabled = false;
            potZoomButton.title = "Acercar al polígono POT seleccionado";
            potZoomButton.setAttribute("aria-label", "Acercar al polígono POT seleccionado");
          }
        });
      },
      style: (f) => ({
        color: POT[f.properties?._potKey]?.c || "#475569",
        fillColor: POT[f.properties?._potKey]?.c || "#475569",
        fillOpacity: 0.2,
        weight: 1.1,
      }),
    },
  ),
};
const potZoomControl = L.control({ position: "topleft" });
potZoomControl.onAdd = () => {
  const button = L.DomUtil.create("button", "leaflet-bar pot-zoom-control");
  button.type = "button";
  button.textContent = "⌖";
  button.title = "Primero selecciona un polígono POT";
  button.setAttribute("aria-label", "Primero selecciona un polígono POT");
  button.disabled = true;
  potZoomButton = button;
  L.DomEvent.disableClickPropagation(button);
  L.DomEvent.on(button, "click", (event) => {
    L.DomEvent.preventDefault(event);
    if (selectedPotBounds?.isValid()) {
      map.fitBounds(selectedPotBounds.pad(0.12), { maxZoom: 17, padding: [24, 24] });
      map.closePopup();
    }
  });
  return button;
};
potZoomControl.addTo(map);
const projectLegend = L.control({ position: "topleft" });
projectLegend.onAdd = () => {
  const container = L.DomUtil.create("section", "project-legend leaflet-control");
  container.setAttribute("aria-label", "Leyenda del mapa");
  container.innerHTML = '<b class="project-legend-title">Leyenda del mapa</b><div class="project-legend-items"></div>';
  L.DomEvent.disableClickPropagation(container);
  L.DomEvent.disableScrollPropagation(container);
  return container;
};
projectLegend.addTo(map);
const layerOpacity = (key, fallback = 1) => {
  const value = document.querySelector(`[data-opacity-k="${key}"]`)?.value;
  return value == null ? fallback : Number(value) / 100;
};
const renderProjectLegend = () => {
  const items = [];
  const addItem = (label, swatch, color, opacity) => {
    const vars = [color ? `--legend-color:${color}` : "", opacity != null ? `--legend-opacity:${opacity}` : ""].filter(Boolean).join(";");
    items.push(`<div class="project-legend-item"><i class="project-legend-swatch ${swatch}"${vars ? ` style="${vars}"` : ""}></i><span>${safeText(label)}</span></div>`);
  };
  const visible = (key) => map.hasLayer(G[key]) && G[key].getLayers().length > 0;
  const layerColor = (key, fallback) => document.querySelector(`[data-color-k="${key}"]`)?.value || fallback;
  const layerMode = (key, fallback = "line") => document.querySelector(`[data-mode-k="${key}"]`)?.value || fallback;
  if (visible("pot")) Object.values(POT).forEach((zone) => addItem(zone.s, "is-pot", zone.c));
  if (visible("ver")) addItem("Límite veredal Piedras Blancas", layerMode("ver") === "fill" ? "is-filled-boundary" : "is-vereda", layerColor("ver", "#e2a400"), layerOpacity("ver"));
  if (visible("cor")) addItem("Corregimiento Santa Elena", layerMode("cor") === "fill" ? "is-filled-boundary" : "is-corregimiento", layerColor("cor", "#6b3fa0"), layerOpacity("cor"));
  if (visible("barrios")) addItem("Barrios y veredas · DATA", layerMode("barrios") === "fill" ? "is-imported" : "is-line-layer", layerColor("barrios", "#467a9d"), layerOpacity("barrios"));
  if (visible("comunas")) addItem("Comunas y corregimientos · DATA", layerMode("comunas") === "fill" ? "is-imported" : "is-line-layer", layerColor("comunas", "#8a66a8"), layerOpacity("comunas"));
  if (visible("cons")) addItem("Construcciones registradas", layerMode("cons", "fill") === "fill" ? "is-construccion" : "is-line-layer", layerColor("cons", "#ef573f"), layerOpacity("cons", 0.58));
  if (selectedAttributeIndices?.size) addItem(`Selección por atributos · ${selectedAttributeIndices.size.toLocaleString("es-CO")}`, "is-selection");
  importedLayers.forEach((entry) => { if (map.hasLayer(entry.layer) && entry.layer.getLayers().length) addItem(entry.name, entry.mode === "line" ? "is-line-layer" : "is-imported", entry.color, entry.opacity); });
  const content = projectLegend.getContainer()?.querySelector(".project-legend-items");
  const control = projectLegend.getContainer();
  if (control) control.style.display = items.length ? "" : "none";
  if (content) content.innerHTML = items.join("");
  const potLegend = $("#lgP");
  if (potLegend) potLegend.hidden = !visible("pot");
  const mapKey = $(".map-key");
  if (mapKey) {
    let hasMapKeyEntries = false;
    mapKey.querySelectorAll("[data-layer-legend]").forEach((entry) => {
      const active = visible(entry.dataset.layerLegend);
      entry.hidden = !active;
      hasMapKeyEntries ||= active;
    });
    mapKey.hidden = !hasMapKeyEntries;
  }
};
const attributeTableDialog = $("#attributeTableDialog");
let activeAttributeLayerId = null;
let activeAttributeFeatures = [];
let activeAttributeRows = [];
let activeAttributeFields = [];
let activeAttributeLayerName = "";
let activeAttributeFilter = null;
let attributeTablePage = 0;
let selectedAttributeIndices = new Set();
let attributeSelectionLayer = null;
let attributeSelectionHalo = null;
let localShapesLoaded = false;
const ATTRIBUTE_PAGE_SIZE = 50;
const attributeValue = (value) => value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
const normalizedAttributeValue = (value) => attributeValue(value).trim().toLocaleLowerCase("es");
const applyLayerStyle = (layer, color, mode = "fill", opacity = 0.35) => {
  const alpha = Math.max(0, Math.min(1, Number(opacity)));
  if (typeof layer?.setStyle === "function") layer.setStyle({
    color,
    fillColor: color,
    fill: mode === "fill",
    opacity: mode === "fill" ? 1 : alpha,
    fillOpacity: mode === "fill" ? alpha : 0,
  });
};
function updateAttributeSelection() {
  if (attributeSelectionLayer) map.removeLayer(attributeSelectionLayer);
  if (attributeSelectionHalo) map.removeLayer(attributeSelectionHalo);
  attributeSelectionLayer = null;
  attributeSelectionHalo = null;
  const selectedFeatures = [...selectedAttributeIndices]
    .map((index) => activeAttributeFeatures[index])
    .filter((feature) => feature?.geometry);
  $("#attributeSelectionCount").textContent = `${selectedAttributeIndices.size.toLocaleString("es-CO")} seleccionados`;
  $("#clearAttributeSelection").disabled = selectedAttributeIndices.size === 0;
  $("#zoomAttributeSelection").disabled = selectedFeatures.length === 0;
  $("#attributeQueryStatus").textContent = selectedAttributeIndices.size
    ? `Clic izquierdo en una entidad resaltada para ver sus atributos.`
    : "";
  if (!selectedFeatures.length) {
    renderProjectLegend();
    return;
  }
  const selectionData = { type: "FeatureCollection", features: selectedFeatures };
  attributeSelectionHalo = L.geoJSON(selectionData, {
    renderer: L.canvas({ padding: 0.5 }),
    style: { color: "#ffffff", weight: 8, fillColor: "#ffffff", fillOpacity: 0.12 },
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 11, color: "#ffffff", weight: 5, fillColor: "#ffffff", fillOpacity: 0.65 }),
  }).addTo(map);
  attributeSelectionLayer = L.geoJSON(selectionData, {
    renderer: L.canvas({ padding: 0.5 }),
    style: { color: "#e6007e", weight: 4, fillColor: "#ff4fa3", fillOpacity: 0.42 },
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 8, color: "#ffffff", weight: 2, fillColor: "#e6007e", fillOpacity: 1 }),
    onEachFeature: (feature, layer) => layer.on("click", (event) => {
      L.DomEvent.stopPropagation(event.originalEvent);
      showFeatureAttributes(feature, activeAttributeLayerName, event.latlng);
    }),
  }).addTo(map);
  attributeSelectionLayer.eachLayer((layer) => layer.bringToFront?.());
  attributeSelectionHalo.eachLayer((layer) => layer.bringToFront?.());
  attributeSelectionLayer.eachLayer((layer) => layer.bringToFront?.());
  renderProjectLegend();
}
function featureContainsLatLng(feature, latlng) {
  const geometry = feature?.geometry;
  if (!geometry) return false;
  const point = turf.point([latlng.lng, latlng.lat]);
  const pixel = map.latLngToContainerPoint(latlng);
  const tolerancePoint = map.containerPointToLatLng(pixel.add([12, 0]));
  const toleranceMeters = map.distance(latlng, tolerancePoint);
  try {
    if (geometry.type === "GeometryCollection") {
      return geometry.geometries.some((part) => featureContainsLatLng({ ...feature, geometry: part }, latlng));
    }
      if ((geometry.type === "Polygon" || geometry.type === "MultiPolygon") && turf.booleanPointInPolygon(point, feature)) return true;
      if (geometry.type === "Point") {
        const [lng, lat] = geometry.coordinates;
        return map.distance(latlng, L.latLng(lat, lng)) <= toleranceMeters;
      }
      if (geometry.type === "MultiPoint") return geometry.coordinates.some(([lng, lat]) => map.distance(latlng, L.latLng(lat, lng)) <= toleranceMeters);
      const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.type === "MultiLineString" ? geometry.coordinates : [];
      return lines.some((coordinates) => turf.pointToLineDistance(point, turf.lineString(coordinates), { units: "meters" }) <= toleranceMeters);
  } catch (error) {
    console.warn("No se pudo comprobar la geometría de la entidad:", error);
    return false;
  }
}
function selectedAttributeFeatureAt(latlng) {
  for (const index of selectedAttributeIndices) {
    const feature = activeAttributeFeatures[index];
    if (featureContainsLatLng(feature, latlng)) return feature;
  }
  return null;
}
function importedFeatureAt(latlng) {
  const layers = [...importedLayers.values()].reverse();
  for (const entry of layers) {
    if (!map.hasLayer(entry.layer)) continue;
    const features = entry.data?.type === "FeatureCollection" ? entry.data.features : entry.data?.type === "Feature" ? [entry.data] : [];
    for (const feature of [...features].reverse()) {
      if (featureContainsLatLng(feature, latlng)) return { feature, name: entry.name };
    }
  }
  return null;
}
function thematicFeatureAt(latlng) {
  const labels = { ver: "Límite veredal Piedras Blancas · DATA", cor: "Corregimiento Santa Elena · DATA", barrios: "Barrios y veredas · SHP DATA", comunas: "Comunas y corregimientos · SHP DATA", cons: "Construcciones registradas · DATA" };
  for (const key of ["cons", "barrios", "comunas", "ver", "cor"]) {
    const layer = G[key];
    if (!layer || !map.hasLayer(layer)) continue;
    const features = layer.toGeoJSON()?.features || [];
    for (const feature of [...features].reverse()) {
      if (featureContainsLatLng(feature, latlng)) return { feature, name: labels[key] };
    }
  }
  return null;
}
function showFeatureAttributes(feature, layerName, latlng) {
  const properties = feature?.properties || {};
  const entries = Object.entries(properties);
  const rows = entries.length
    ? entries.map(([field, value]) => {
        const formatted = attributeValue(value);
        return row(safeText(field), safeText(formatted === "" ? "Sin dato" : formatted));
      }).join("")
    : row("Atributos", "La entidad seleccionada no tiene campos asociados.");
  const title = layerName || "Entidad seleccionada";
  const table = `<table class="ft">${rows}</table>`;
  $("#ficha").innerHTML = `<h3>Selección · ${safeText(title)}</h3><p class="nt">Atributos de la entidad seleccionada en el mapa.</p>${table}`;
  $$("nav button")[2].textContent = "Atributos";
  tab(2);
  L.popup({ maxWidth: 380, maxHeight: 300 })
    .setLatLng(latlng)
    .setContent(`<div class="attribute-feature-popup"><b>${safeText(title)}</b>${table}</div>`)
    .openOn(map);
}
function renderAttributeTable() {
  const query = $("#attributeTableSearch").value.trim().toLocaleLowerCase("es");
  const matchingRows = activeAttributeRows.map((properties, index) => ({ properties, index })).filter(({ properties }) =>
    (!query || activeAttributeFields.some((field) => attributeValue(properties[field]).toLocaleLowerCase("es").includes(query))) &&
    (!activeAttributeFilter || normalizedAttributeValue(properties[activeAttributeFilter.field]) === activeAttributeFilter.value),
  );
  const pageCount = Math.max(1, Math.ceil(matchingRows.length / ATTRIBUTE_PAGE_SIZE));
  attributeTablePage = Math.min(attributeTablePage, pageCount - 1);
  const start = attributeTablePage * ATTRIBUTE_PAGE_SIZE;
  const pageRows = matchingRows.slice(start, start + ATTRIBUTE_PAGE_SIZE);
  const table = $("#attributeTable");
  const head = table.querySelector("thead");
  const body = table.querySelector("tbody");
  head.replaceChildren();
  body.replaceChildren();
  const headerRow = document.createElement("tr");
  ["Sel.", "#", ...activeAttributeFields].forEach((field) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = field;
    headerRow.append(cell);
  });
  head.append(headerRow);
  pageRows.forEach(({ properties, index: featureIndex }, index) => {
    const row = document.createElement("tr");
    if (selectedAttributeIndices.has(featureIndex)) row.classList.add("attribute-row-selected");
    const selectCell = document.createElement("td");
    const select = document.createElement("input");
    select.type = "checkbox";
    select.checked = selectedAttributeIndices.has(featureIndex);
    select.setAttribute("aria-label", `Seleccionar registro ${start + index + 1}`);
    select.addEventListener("change", () => {
      if (select.checked) selectedAttributeIndices.add(featureIndex);
      else selectedAttributeIndices.delete(featureIndex);
      row.classList.toggle("attribute-row-selected", select.checked);
      updateAttributeSelection();
    });
    selectCell.append(select);
    row.append(selectCell);
    const number = document.createElement("td");
    number.textContent = String(start + index + 1);
    row.append(number);
    activeAttributeFields.forEach((field) => {
      const cell = document.createElement("td");
      cell.textContent = attributeValue(properties[field]);
      row.append(cell);
    });
    body.append(row);
  });
  if (!pageRows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = activeAttributeFields.length + 2;
    cell.className = "attribute-table-empty";
    cell.textContent = activeAttributeRows.length ? "No hay registros que coincidan con la búsqueda." : "Esta capa no contiene atributos.";
    row.append(cell);
    body.append(row);
  }
  $("#attributeTableCount").textContent = `${matchingRows.length.toLocaleString("es-CO")} de ${activeAttributeRows.length.toLocaleString("es-CO")} registros`;
  $("#attributeTablePage").textContent = `Página ${attributeTablePage + 1} de ${pageCount}`;
  $("#attributeTablePrev").disabled = attributeTablePage === 0;
  $("#attributeTableNext").disabled = attributeTablePage >= pageCount - 1;
}
function openAttributeTable(id, entry) {
  const features = entry.data?.type === "FeatureCollection" ? entry.data.features : entry.data?.type === "Feature" ? [entry.data] : [];
  if (attributeSelectionLayer) map.removeLayer(attributeSelectionLayer);
  if (attributeSelectionHalo) map.removeLayer(attributeSelectionHalo);
  attributeSelectionLayer = null;
  attributeSelectionHalo = null;
  selectedAttributeIndices.clear();
  activeAttributeLayerId = id;
  activeAttributeLayerName = entry.name;
  activeAttributeFeatures = features;
  activeAttributeRows = features.map((feature) => feature.properties || {});
  activeAttributeFields = [...new Set(activeAttributeRows.flatMap((properties) => Object.keys(properties)))];
  activeAttributeFilter = null;
  attributeTablePage = 0;
  $("#attributeTableHeading").textContent = `Atributos · ${entry.name}`;
  $("#attributeTableSummary").textContent = `${activeAttributeRows.length.toLocaleString("es-CO")} registros · ${activeAttributeFields.length} campos`;
  $("#attributeTableSearch").value = "";
  const fieldSelect = $("#attributeFieldSelect");
  fieldSelect.replaceChildren();
  activeAttributeFields.forEach((field) => {
    const option = document.createElement("option");
    option.value = field;
    option.textContent = field;
    fieldSelect.append(option);
  });
  fieldSelect.disabled = activeAttributeFields.length === 0;
  $("#attributeValueInput").value = "";
  $("#attributeValueInput").disabled = activeAttributeFields.length === 0;
  $("#selectByAttribute").disabled = activeAttributeFields.length === 0;
  $("#attributeQueryStatus").textContent = "";
  updateAttributeValueSuggestions();
  updateAttributeSelection();
  renderAttributeTable();
  if (!attributeTableDialog.open) attributeTableDialog.showModal();
}
function updateAttributeValueSuggestions() {
  const field = $("#attributeFieldSelect").value;
  const input = $("#attributeValueInput").value.trim().toLocaleLowerCase("es");
  const values = [...new Set(activeAttributeRows.map((properties) => attributeValue(properties[field])).filter((value) => value !== ""))];
  const suggestions = input ? values.filter((value) => value.toLocaleLowerCase("es").includes(input)).slice(0, 100) : values.slice(0, 100);
  const list = $("#attributeValueSuggestions");
  list.replaceChildren();
  suggestions.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    list.append(option);
  });
  $("#attributeValueCount").textContent = `${values.length.toLocaleString("es-CO")} valores${values.length > suggestions.length ? " · escribe para filtrar sugerencias" : ""}`;
}
$("#attributeFieldSelect").addEventListener("change", () => {
  $("#attributeValueInput").value = "";
  $("#attributeQueryStatus").textContent = "";
  updateAttributeValueSuggestions();
});
$("#attributeValueInput").addEventListener("input", updateAttributeValueSuggestions);
$("#selectByAttribute").onclick = () => {
  const field = $("#attributeFieldSelect").value;
  const rawValue = $("#attributeValueInput").value.trim();
  if (!field || !rawValue) {
    $("#attributeQueryStatus").textContent = "Elige un campo y escribe o selecciona uno de sus valores.";
    return;
  }
  const value = normalizedAttributeValue(rawValue);
  activeAttributeFilter = { field, value };
  selectedAttributeIndices.clear();
  activeAttributeRows.forEach((properties, index) => {
    if (normalizedAttributeValue(properties[field]) === value) selectedAttributeIndices.add(index);
  });
  attributeTablePage = 0;
  updateAttributeSelection();
  renderAttributeTable();
  $("#attributeQueryStatus").textContent = `${selectedAttributeIndices.size.toLocaleString("es-CO")} registro(s) donde ${field} = ${rawValue}. Haz clic izquierdo en uno resaltado para ver sus atributos.`;
};
$("#selectAttributeMatches").onclick = () => {
  const query = $("#attributeTableSearch").value.trim().toLocaleLowerCase("es");
  activeAttributeRows.forEach((properties, index) => {
    const matches = (!query || activeAttributeFields.some((field) => attributeValue(properties[field]).toLocaleLowerCase("es").includes(query))) &&
      (!activeAttributeFilter || normalizedAttributeValue(properties[activeAttributeFilter.field]) === activeAttributeFilter.value);
    if (matches) selectedAttributeIndices.add(index);
  });
  updateAttributeSelection();
  renderAttributeTable();
};
$("#clearAttributeSelection").onclick = () => {
  selectedAttributeIndices.clear();
  updateAttributeSelection();
  renderAttributeTable();
};
$("#zoomAttributeSelection").onclick = () => {
  const bounds = attributeSelectionLayer?.getBounds();
  if (bounds?.isValid()) map.fitBounds(bounds.pad(0.12), { maxZoom: 17, padding: [24, 24] });
};
$("#closeAttributeTable").onclick = () => attributeTableDialog.close();
const attributeTableHeader = attributeTableDialog.querySelector(".attribute-table-header");
let attributeTableDrag = null;
attributeTableHeader.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button, input, a") || (event.pointerType === "mouse" && event.button !== 0)) return;
  const rect = attributeTableDialog.getBoundingClientRect();
  attributeTableDialog.style.left = rect.left + "px";
  attributeTableDialog.style.top = rect.top + "px";
  attributeTableDialog.style.transform = "none";
  attributeTableDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
  attributeTableHeader.setPointerCapture(event.pointerId);
  event.preventDefault();
});
attributeTableHeader.addEventListener("pointermove", (event) => {
  if (!attributeTableDrag || attributeTableDrag.pointerId !== event.pointerId) return;
  const maxLeft = Math.max(0, window.innerWidth - attributeTableDialog.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - attributeTableDialog.offsetHeight);
  attributeTableDialog.style.left = Math.min(maxLeft, Math.max(0, attributeTableDrag.left + event.clientX - attributeTableDrag.x)) + "px";
  attributeTableDialog.style.top = Math.min(maxTop, Math.max(0, attributeTableDrag.top + event.clientY - attributeTableDrag.y)) + "px";
});
const stopAttributeTableDrag = (event) => {
  if (attributeTableDrag?.pointerId !== event.pointerId) return;
  attributeTableDrag = null;
  if (attributeTableHeader.hasPointerCapture(event.pointerId)) attributeTableHeader.releasePointerCapture(event.pointerId);
};
attributeTableHeader.addEventListener("pointerup", stopAttributeTableDrag);
attributeTableHeader.addEventListener("pointercancel", stopAttributeTableDrag);
window.addEventListener("resize", () => {
  if (!attributeTableDialog.open || !attributeTableDialog.style.left) return;
  const left = Math.min(Math.max(0, window.innerWidth - attributeTableDialog.offsetWidth), parseFloat(attributeTableDialog.style.left) || 0);
  const top = Math.min(Math.max(0, window.innerHeight - attributeTableDialog.offsetHeight), parseFloat(attributeTableDialog.style.top) || 0);
  attributeTableDialog.style.left = left + "px";
  attributeTableDialog.style.top = top + "px";
});
$("#attributeTableSearch").addEventListener("input", () => { attributeTablePage = 0; renderAttributeTable(); });
$("#attributeTablePrev").onclick = () => { attributeTablePage--; renderAttributeTable(); };
$("#attributeTableNext").onclick = () => { attributeTablePage++; renderAttributeTable(); };
function renderImportedLayers() {
  const container = $("#userLayersList");
  if (!container) return;
  container.replaceChildren();
  importedLayers.forEach((entry, id) => {
    const row = document.createElement("div");
    row.className = "user-layer-row";
    const label = document.createElement("label");
    label.className = "user-layer-name";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = map.hasLayer(entry.layer);
    toggle.setAttribute("aria-label", `Mostrar ${entry.name}`);
    toggle.addEventListener("change", () => {
      if (toggle.checked) entry.layer.addTo(map);
      else map.removeLayer(entry.layer);
      if (toggle.checked) miniLayers.addLayer(entry.miniLayer);
      else miniLayers.removeLayer(entry.miniLayer);
      renderProjectLegend();
    });
    const name = document.createElement("span");
    name.textContent = entry.name;
    label.append(toggle, name);
    const attributes = document.createElement("button");
    attributes.type = "button";
    attributes.className = "user-layer-remove user-layer-table";
    attributes.textContent = "Atributos";
    attributes.title = `Ver tabla de atributos de ${entry.name}`;
    attributes.addEventListener("click", () => openAttributeTable(id, entry));
    const color = document.createElement("input");
    color.type = "color";
    color.className = "user-layer-color";
    color.value = entry.color || "#e34a33";
    color.setAttribute("aria-label", `Cambiar el color de ${entry.name}`);
    color.title = `Cambiar el color de ${entry.name}`;
    color.addEventListener("input", () => {
      entry.color = color.value;
      applyLayerStyle(entry.layer, color.value, mode.value, entry.opacity);
      applyLayerStyle(entry.miniLayer, color.value, mode.value, entry.opacity);
      renderProjectLegend();
    });
    const mode = document.createElement("select");
    mode.className = "user-layer-mode";
    mode.title = `Estilo de polígono de ${entry.name}`;
    mode.setAttribute("aria-label", `Mostrar ${entry.name} como línea o relleno`);
    [["line", "Línea"], ["fill", "Relleno"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      mode.append(option);
    });
    mode.value = entry.mode || "fill";
    mode.addEventListener("change", () => {
      entry.mode = mode.value;
      applyLayerStyle(entry.layer, color.value, mode.value, entry.opacity);
      applyLayerStyle(entry.miniLayer, color.value, mode.value, entry.opacity);
      renderProjectLegend();
    });
    const colorField = document.createElement("label");
    colorField.className = "symbology-field";
    const colorCaption = document.createElement("span");
    colorCaption.textContent = "Color";
    colorField.append(colorCaption, color);
    const modeField = document.createElement("label");
    modeField.className = "symbology-field";
    const modeCaption = document.createElement("span");
    modeCaption.textContent = "Representación";
    modeField.append(modeCaption, mode);
    const symbology = document.createElement("details");
    symbology.className = "layer-symbology";
    const symbologyTitle = document.createElement("summary");
    symbologyTitle.textContent = "Simbología";
    symbology.append(symbologyTitle);
    const symbologyControls = document.createElement("div");
    symbologyControls.className = "layer-symbology-controls";
    const opacityWrap = document.createElement("label");
    opacityWrap.className = "user-layer-opacity-control";
    opacityWrap.title = `Opacidad de ${entry.name}`;
    const opacity = document.createElement("input");
    opacity.type = "range";
    opacity.min = "0";
    opacity.max = "100";
    opacity.value = String(Math.round((entry.opacity ?? 0.35) * 100));
    opacity.className = "user-layer-opacity";
    opacity.setAttribute("aria-label", `Opacidad de ${entry.name}`);
    const opacityValue = document.createElement("span");
    opacityValue.className = "user-layer-opacity-value";
    opacityValue.textContent = `${opacity.value}%`;
    opacity.addEventListener("input", () => {
      entry.opacity = Number(opacity.value) / 100;
      opacityValue.textContent = `${opacity.value}%`;
      applyLayerStyle(entry.layer, color.value, mode.value, entry.opacity);
      applyLayerStyle(entry.miniLayer, color.value, mode.value, entry.opacity);
      renderProjectLegend();
    });
    opacityWrap.append(document.createTextNode("Opacidad"), opacity, opacityValue);
    symbologyControls.append(colorField, modeField, opacityWrap);
    symbology.append(symbologyControls);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "user-layer-remove";
    remove.textContent = "Quitar";
    remove.title = `Quitar la capa ${entry.name}`;
    remove.addEventListener("click", () => {
      map.removeLayer(entry.layer);
      miniLayers.removeLayer(entry.miniLayer);
      importedLayers.delete(id);
      if (activeAttributeLayerId === id) {
        selectedAttributeIndices.clear();
        updateAttributeSelection();
        attributeTableDialog.close();
      }
      renderImportedLayers();
      renderProjectLegend();
      $("#userLayerStatus").textContent = importedLayers.size ? `${importedLayers.size} capa(s) añadida(s).` : "Se quitaron todas las capas añadidas.";
    });
    const tools = document.createElement("div");
    tools.className = "user-layer-tools";
    tools.append(attributes, symbology, remove);
    row.append(label, tools);
    container.append(row);
  });
}
const thematicLayerOptions = new Map();
const chk = (el, arr) => {
  $(el).innerHTML = arr
    .map(([k, t, on, options = {}]) => {
      thematicLayerOptions.set(k, options);
      const modeControl = options.mode ? `<label class="symbology-field"><span>Representación</span><select class="user-layer-mode" data-mode-k="${k}" aria-label="Mostrar ${t} como línea o relleno" title="Estilo de ${t}"><option value="line" ${options.mode === "line" ? "selected" : ""}>Línea</option><option value="fill" ${options.mode === "fill" ? "selected" : ""}>Relleno</option></select></label>` : "";
      const opacityControl = options.opacity != null ? `<label class="user-layer-opacity-control" title="Opacidad de ${t}"><span>Opacidad</span><input class="user-layer-opacity" type="range" min="0" max="100" value="${Math.round(options.opacity * 100)}" data-opacity-k="${k}" aria-label="Opacidad de ${t}"><span class="user-layer-opacity-value" data-opacity-output="${k}">${Math.round(options.opacity * 100)}%</span></label>` : "";
      const colorControl = options.color ? `<label class="symbology-field"><span>Color</span><input class="user-layer-color" type="color" data-color-k="${k}" value="${options.color}" aria-label="Cambiar color de ${t}" title="Cambiar color de ${t}"></label>` : "";
      const symbology = options.color || options.mode ? `<details class="layer-symbology"><summary>Simbología</summary><div class="layer-symbology-controls">${colorControl}${modeControl}${opacityControl}</div></details>` : "";
      return `<div class="thematic-layer-row"><label class="thematic-layer-name"><input type="checkbox" data-k="${k}" ${on ? "checked" : ""}> <span>${t}</span></label><div class="thematic-layer-tools">${options.table ? `<button class="user-layer-remove user-layer-table" type="button" data-attribute-k="${k}" title="Abrir tabla de atributos" ${localShapesLoaded ? "" : "disabled"}>Atributos</button>` : ""}</div>${symbology}</div>`;
    })
    .join("");
  $$(el + ' input[type="checkbox"]').forEach((i) => {
    const f = () => {
      const key = i.dataset.k;
      if (i.checked) G[key].addTo(map);
      else map.removeLayer(G[key]);
      renderProjectLegend();
      const miniLayer = miniReferenceLayers[key];
      if (miniLayer) {
        if (i.checked) miniLayers.addLayer(miniLayer);
        else miniLayers.removeLayer(miniLayer);
      }
    };
    i.onchange = f;
    f();
  });
  $$(el + " [data-attribute-k]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.attributeK;
      const label = arr.find(([layerKey]) => layerKey === key)?.[1] || key;
      openAttributeTable(`builtin:${key}`, { name: label, data: G[key].toGeoJSON() });
    });
  });
  $$(el + " [data-color-k]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.colorK;
      const options = thematicLayerOptions.get(key) || {};
      const mode = document.querySelector(`[data-mode-k="${key}"]`)?.value || options.mode || "line";
      applyLayerStyle(G[key], input.value, mode, options.opacity ?? 0.25);
      applyLayerStyle(miniReferenceLayers[key], input.value, mode, layerOpacity(key, options.opacity ?? 0.35));
      renderProjectLegend();
    });
  });
  $$(el + " [data-mode-k]").forEach((select) => {
    select.addEventListener("change", () => {
      const key = select.dataset.modeK;
      const options = thematicLayerOptions.get(key) || {};
      const color = document.querySelector(`[data-color-k="${key}"]`)?.value || "#467a9d";
      applyLayerStyle(G[key], color, select.value, options.opacity ?? 0.25);
      applyLayerStyle(miniReferenceLayers[key], color, select.value, layerOpacity(key, options.opacity ?? 0.35));
      renderProjectLegend();
    });
  });
  $$(el + " [data-opacity-k]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.opacityK;
      const options = thematicLayerOptions.get(key) || {};
      options.opacity = Number(input.value) / 100;
      const output = document.querySelector(`[data-opacity-output="${key}"]`);
      if (output) output.textContent = `${input.value}%`;
      const color = document.querySelector(`[data-color-k="${key}"]`)?.value || "#467a9d";
      const mode = document.querySelector(`[data-mode-k="${key}"]`)?.value || options.mode || "line";
      applyLayerStyle(G[key], color, mode, options.opacity);
      applyLayerStyle(miniReferenceLayers[key], color, mode, options.opacity);
      renderProjectLegend();
    });
  });
};
chk("#k1", [["pot", "Zonificación POT 2014 · Piedras Blancas", 1]]);
chk("#k2-limits", [
  ["ver", "Límite veredal Piedras Blancas · DATA", 0, { table: true, color: "#e2a400", mode: "line", opacity: 0.24, miniOpacity: 0.3 }],
  ["cor", "Corregimiento Santa Elena · DATA", 0, { table: true, color: "#6b3fa0", mode: "line", opacity: 0.24, miniOpacity: 0.3 }],
  ["barrios", "Barrios y veredas · SHP DATA", 0, { table: true, color: "#467a9d", mode: "line", opacity: 0.2, miniOpacity: 0.3 }],
  ["comunas", "Comunas y corregimientos · SHP DATA", 0, { table: true, color: "#8a66a8", mode: "line", opacity: 0.2, miniOpacity: 0.3 }],
]);
chk("#k2-buildings", [
  ["cons", "Construcciones registradas · 5.266", 1, { table: true, color: "#ef573f", mode: "fill", opacity: 0.58, miniOpacity: 0.7 }],
]);
const loadLocalGeoJSON = async (filename) => {
  const response = await fetch(`./DATA/${filename}`);
  if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
  const data = await response.json();
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features))
    throw new Error(`${filename}: formato GeoJSON no válido`);
  return data;
};
const loadLocalShapefile = async (filename) => {
  if (typeof window.shp !== "function") throw new Error("No se cargó el lector de shapefiles (SHPJS).");
  return window.shp(`./DATA/${filename}`);
};
const loadOptionalShapefile = async (shapeFilename, geoJsonFilename) => {
  try {
    const data = await loadLocalShapefile(shapeFilename);
    const collections = Array.isArray(data) ? data : [data];
    if (collections.some((collection) => collection?.type === "FeatureCollection" && collection.features?.length)) return data;
    throw new Error("El lector SHP no devolvió entidades.");
  } catch (error) {
    console.warn(`No se pudo leer ${shapeFilename}; se usará ${geoJsonFilename}:`, error);
    try { return await loadLocalGeoJSON(geoJsonFilename); }
    catch (fallbackError) {
      console.warn(`No se pudo cargar el respaldo GeoJSON ${geoJsonFilename}:`, fallbackError);
      return { type: "FeatureCollection", features: [] };
    }
  }
};
const loadShapefileOrGeoJSON = async (shapeFilename, geojsonFilename) => {
  try {
    const data = await loadLocalShapefile(shapeFilename);
    const collections = Array.isArray(data) ? data : [data];
    if (collections.some((collection) => collection?.type === "FeatureCollection" && collection.features?.length)) return data;
    throw new Error("El lector SHP no devolvió entidades.");
  }
  catch (error) {
    console.warn(`No se pudo reproyectar ${shapeFilename}; se usará su GeoJSON WGS84:`, error);
    return loadLocalGeoJSON(geojsonFilename);
  }
};
Promise.all([
  loadLocalGeoJSON("corregimiento_santa_elena.geojson"),
  loadLocalGeoJSON("piedras_blancas.geojson"),
  loadLocalGeoJSON("construcciones_piedras_blancas.geojson"),
  loadLocalGeoJSON("pot_piedras_blancas.geojson"),
])
  .then(([corregimiento, vereda, construcciones, pot]) => {
    G.cor.clearLayers().addData(corregimiento);
    G.ver.clearLayers().addData(vereda);
    G.cons.addData(construcciones);
    constructionFeatures = construcciones.features || [];
    renderConstructionSummary(constructionFeatures);
    if ($$(".tab")[3]?.classList.contains("on")) charts();
    potFeatures = pot.features || [];
    potFeatures.forEach((feature) => {
      const p = feature.properties || {};
      const key = String(p.cod_cat_us ?? p.areagralus ?? "sin-clasificar");
      p._potKey = key;
      if (!POT[key]) {
        const label = p.areagralus || "Uso general sin nombre";
        POT[key] = { s: label, c: POT_COLORS[Object.keys(POT).length % POT_COLORS.length] };
        ZN[key] = [];
      }
      ZN[key].push(feature);
    });
    G.pot.addData(pot);
    $("#lgP").innerHTML = Object.values(POT)
      .map((zone) => `<div><i style="background:${zone.c}"></i>${safeText(zone.s)}</div>`)
      .join("");
    renderProjectLegend();
    miniReferenceLayers = {
      cor: L.geoJSON(corregimiento, { style: { color: "#6b3fa0", weight: 1, fill: false } }),
      ver: L.geoJSON(vereda, { style: { color: "#e6a700", weight: 1.5, fill: false } }),
      cons: L.geoJSON(construcciones, {
        renderer: L.canvas(),
        style: { color: "#7f1d1d", weight: 0.25, fillColor: "#ef573f", fillOpacity: 0.7 },
      }),
      pot: L.geoJSON(G.pot.toGeoJSON(), {
        style: (feature) => ({
          color: POT[feature.properties?._potKey]?.c || "#475569",
          fillColor: POT[feature.properties?._potKey]?.c || "#475569",
          fillOpacity: 0.28,
          weight: 0.8,
        }),
      }),
    };
    localShapesLoaded = true;
    $$("[data-attribute-k]").forEach((button) => {
      button.disabled = ["barrios", "comunas"].includes(button.dataset.attributeK);
    });
    $$("[data-color-k]").forEach((input) => {
      const key = input.dataset.colorK;
      const options = thematicLayerOptions.get(key) || {};
      const mode = document.querySelector(`[data-mode-k="${key}"]`)?.value || options.mode || "line";
      applyLayerStyle(G[key], input.value, mode, options.opacity ?? 0.25);
      applyLayerStyle(miniReferenceLayers[key], input.value, mode, layerOpacity(key, options.opacity ?? 0.35));
    });
    Object.entries(miniReferenceLayers).forEach(([key, layer]) => {
      if (map.hasLayer(G[key])) miniLayers.addLayer(layer);
    });
    const area = construcciones.features.reduce(
      (total, feature) => total + (Number(feature.properties?.area_const) || 0),
      0,
    );
    const potAreaHa = potFeatures.reduce((total, feature) => total + turf.area(feature) / 10000, 0);
    const veredaAreaHa = vereda.features.reduce((total, feature) => total + turf.area(feature) / 10000, 0);
    $("#realDataStatus").textContent = `${construcciones.features.length.toLocaleString("es-CO")} construcciones registradas · ${fmt(area / 10000, 2)} ha construidas. POT 2014: ${potFeatures.length} polígonos en ${fmt(potAreaHa, 2)} ha de ${fmt(veredaAreaHa, 0)} ha de la vereda.`;
    $("#demo").textContent = "Límites y construcciones · DATA";
    const center = turf.centroid(vereda.features[0]).geometry.coordinates;
    PL["Piedras Blancas"] = [center[1], center[0]];
    $("#dl").innerHTML = Object.keys(PL).map((name) => `<option value="${name}">`).join("");
    map.fitBounds(G.ver.getBounds().pad(0.08));
    Promise.all([
      loadLocalGeoJSON("shp_barrios_y_veredas_mr/barrios_y_veredas_mr.geojson"),
      loadLocalGeoJSON("shp_comunas_y_corregimientos_/comunas_y_corregimientos_.geojson"),
    ]).then(([barrios, comunas]) => {
      G.barrios.clearLayers().addData(barrios);
      G.comunas.clearLayers().addData(comunas);
      miniReferenceLayers.barrios = L.geoJSON(barrios, { style: { color: "#467a9d", weight: 1, fill: false } });
      miniReferenceLayers.comunas = L.geoJSON(comunas, { style: { color: "#8a66a8", weight: 1.2, dashArray: "5 4", fill: false } });
      ["barrios", "comunas"].forEach((key) => {
        const color = document.querySelector('[data-color-k="' + key + '"]')?.value || "#467a9d";
        const mode = document.querySelector('[data-mode-k="' + key + '"]')?.value || "line";
        const options = thematicLayerOptions.get(key) || {};
        applyLayerStyle(G[key], color, mode, options.opacity ?? 0.2);
        applyLayerStyle(miniReferenceLayers[key], color, mode, layerOpacity(key, options.opacity ?? 0.3));
        if (map.hasLayer(G[key])) miniLayers.addLayer(miniReferenceLayers[key]);
        const button = document.querySelector('[data-attribute-k="' + key + '"]');
        if (button) button.disabled = false;
      });
      renderProjectLegend();
    }).catch((error) => {
      console.warn("No se pudieron cargar barrios y comunas:", error);
      $("#userLayerStatus").textContent = "Las capas principales están listas; no se pudieron cargar barrios y comunas desde DATA.";
    });
  })
  .catch((error) => {
    $("#realDataStatus").textContent = "No se pudieron cargar los datos espaciales. Abre el geovisor con Live Server y revisa que DATA contenga los SHP y archivos .prj asociados.";
    $("#constructionAnalysisStatus").textContent = "No se pudo cargar el análisis de construcciones desde DATA/construcciones_piedras_blancas.shp.";
    console.error("Error al cargar capas de DATA:", error);
  });
$("#bm").innerHTML = Object.keys(BM)
  .map(
    (k, i) =>
      `<label><input type="radio" name="bm" value="${k}" ${k === defaultBaseName ? "checked" : ""}> ${k}</label>`,
  )
  .join("");
$$("[name=bm]").forEach(
  (r) =>
    (r.onchange = () => {
      map.removeLayer(base);
      base = BM[r.value];
      tileErrs = 0;
      if (!sw.on) base.addTo(map).bringToBack();
      if (r.value === defaultBaseName) satelliteLabels.addTo(map);
      else map.removeLayer(satelliteLabels);
    }),
);
$("#lgP").innerHTML = "<p class=\"nt\">Cargando categorías POT…</p>";

/* ---------- Coberturas y cortinilla ---------- */
let lay = [];
const sw = { on: false, o: "v", f: 0.5, l: null, r: null };
let waybackItems = [];
const waybackFallback = {
  l: { requested: null, attempts: new Map() },
  r: { requested: null, attempts: new Map() },
};
const waybackTileUrl = (item, coords) => item.itemURL
  .replace("{level}", String(coords.z))
  .replace("{row}", String(coords.y))
  .replace("{col}", String(coords.x));
const canLoadWaybackTile = (item, coords) => new Promise((resolve) => {
  const image = new Image();
  let finished = false;
  const done = (loaded) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    resolve(loaded);
  };
  const timeout = setTimeout(() => done(false), 2500);
  image.onload = () => done(true);
  image.onerror = () => done(false);
  image.src = waybackTileUrl(item, coords);
});
const nearbyWaybackItems = (releaseNum) => {
  const selected = waybackItems.find((item) => item.releaseNum === Number(releaseNum));
  if (!selected) return [];
  const selectedTime = Date.parse(selected.releaseDateLabel);
  const nearby = waybackItems
    .filter((item) => item.releaseNum !== selected.releaseNum)
    .sort((a, b) => Math.abs(Date.parse(a.releaseDateLabel) - selectedTime) - Math.abs(Date.parse(b.releaseDateLabel) - selectedTime))
    .slice(0, 4);
  const yearly = [];
  for (let year = 2014; year <= new Date().getFullYear(); year += 2) {
    const target = Date.parse(String(year) + "-07-01");
    const closest = waybackItems.reduce((best, item) =>
      Math.abs(Date.parse(item.releaseDateLabel) - target) < Math.abs(Date.parse(best.releaseDateLabel) - target) ? item : best,
    waybackItems[0]);
    yearly.push(closest);
  }
  return [...new Map([...nearby, ...yearly, waybackItems[waybackItems.length - 1]]
    .filter((item) => item.releaseNum !== selected.releaseNum)
    .map((item) => [item.releaseNum, item])).values()]
    .sort((a, b) => Math.abs(Date.parse(a.releaseDateLabel) - selectedTime) - Math.abs(Date.parse(b.releaseDateLabel) - selectedTime));
};
const findWaybackFallback = async (releaseNum, coords, side, layer) => {
  const state = waybackFallback[side];
  const tileKey = String(coords.z) + "/" + coords.x + "/" + coords.y;
  let tried = state.attempts.get(tileKey);
  if (!tried) {
    tried = new Set();
    state.attempts.set(tileKey, tried);
  }
  if (tried.has(Number(releaseNum))) return;
  tried.add(Number(releaseNum));
  const original = waybackItems.find((item) => item.releaseNum === Number(releaseNum));
  if (!original || !(await canLoadWaybackTile(original, coords)) || !map.hasLayer(layer)) {
    if (!original || !map.hasLayer(layer)) return;
    const candidates = nearbyWaybackItems(state.requested ?? releaseNum)
      .filter((candidate) => !tried.has(candidate.releaseNum));
    candidates.forEach((candidate) => tried.add(candidate.releaseNum));
    const available = await Promise.all(candidates.map(async (candidate) =>
      (await canLoadWaybackTile(candidate, coords)) ? candidate : null));
    const fallback = available.find(Boolean);
    if (fallback && map.hasLayer(layer)) {
      sw[side] = fallback.releaseNum;
      state.requested = fallback.releaseNum;
      $(side === "l" ? "#yl" : "#yr").value = String(fallback.releaseNum);
      $("#waybackStatus").textContent = "La versión " + original.releaseDateLabel + " no tiene imagen disponible en esta zona y nivel de zoom. Se muestra la versión cercana " + fallback.releaseDateLabel + ".";
      paint();
      return;
    }
    $("#waybackStatus").textContent = "No hay mosaicos disponibles para " + original.releaseDateLabel + " ni para versiones cercanas en esta zona y nivel de zoom.";
  } else if (map.hasLayer(layer)) {
    layer.redraw();
  }
};
const waybackTile = (releaseNum, pane) => {
  const item = waybackItems.find((entry) => entry.releaseNum === Number(releaseNum));
  if (!item?.itemURL) return null;
  const url = item.itemURL
    .replace("{level}", "{z}")
    .replace("{row}", "{y}")
    .replace("{col}", "{x}");
  const layer = L.tileLayer(url, {
    pane,
    attribution: "Esri, World Imagery Wayback",
    maxZoom: 19,
    crossOrigin: true,
  });
  const side = pane === "izq" ? "l" : "r";
  layer.on("tileerror", (event) => {
    layer._waybackTileErrors = (layer._waybackTileErrors || 0) + 1;
    if (layer._waybackTileErrors < 2 || layer._waybackFallbackBusy || !event.coords) return;
    layer._waybackFallbackBusy = true;
    findWaybackFallback(releaseNum, event.coords, side, layer)
      .finally(() => { layer._waybackFallbackBusy = false; });
  });
  return layer;
};
function paint() {
  lay.forEach((l) => map.removeLayer(l));
  lay = [];
  if (sw.on && waybackItems.length) {
    // Oculta el mosaico base actual para que nunca se mezcle con el histórico.
    if (map.hasLayer(base)) map.removeLayer(base);
    lay = [waybackTile(sw.l, "izq"), waybackTile(sw.r, "der")].filter(Boolean);
  } else {
    if (!map.hasLayer(base)) base.addTo(map).bringToBack();
  }
  lay.forEach((l) => l.addTo(map));
  clip();
}
function clip() {
  const c = $("#cort"),
    b = $("#ban");
  c.style.display = b.style.display = sw.on ? "block" : "none";
  if (!sw.on) return;
  const s = map.getSize(),
    nw = map.containerPointToLayerPoint([0, 0]),
    se = map.containerPointToLayerPoint(s);
  let a, z;
  if (sw.o === "v") {
    const x = nw.x + s.x * sw.f;
    a = `rect(${nw.y}px,${x}px,${se.y}px,${nw.x}px)`;
    z = `rect(${nw.y}px,${se.x}px,${se.y}px,${x}px)`;
    c.style.left = sw.f * 100 + "%";
    c.style.top = "";
  } else {
    const y = nw.y + s.y * sw.f;
    a = `rect(${nw.y}px,${se.x}px,${y}px,${nw.x}px)`;
    z = `rect(${y}px,${se.x}px,${se.y}px,${nw.x}px)`;
    c.style.top = sw.f * 100 + "%";
    c.style.left = "";
  }
  map.getPane("izq").style.clip = a;
  map.getPane("der").style.clip = z;
  c.className = sw.o;
  const label = (release) =>
    waybackItems.find((item) => item.releaseNum === Number(release))?.releaseDateLabel || "—";
  b.textContent = `${label(sw.l)} (${sw.o === "v" ? "izquierda" : "arriba"}) · ${label(sw.r)} (${sw.o === "v" ? "derecha" : "abajo"})`;
  c.setAttribute("aria-orientation", sw.o === "v" ? "horizontal" : "vertical");
  c.setAttribute("aria-valuenow", String(Math.round(sw.f * 100)));
  c.setAttribute(
    "aria-valuetext",
    `${Math.round(sw.f * 100)} por ciento; ${label(sw.l)} a la izquierda o arriba y ${label(sw.r)} a la derecha o abajo`,
  );
}
map.on("move zoom resize", clip);
const refreshWaybackLink = () => {
  const bounds = map.getBounds();
  const extent = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
    .map((value) => value.toFixed(5))
    .join(",");
  const center = map.getCenter();
  const view = [center.lng.toFixed(5), center.lat.toFixed(5), map.getZoom()].join(",");
  $("#waybackLink").href = `https://livingatlas.arcgis.com/wayback/?ext=${encodeURIComponent(extent)}&mapCenter=${encodeURIComponent(view)}&localChangesOnly=true`;
};
map.on("moveend zoomend", refreshWaybackLink);
refreshWaybackLink();
const loadWaybackCatalog = async () => {
  const response = await fetch("https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json");
  if (!response.ok) throw new Error("No se pudo consultar el catálogo histórico de Esri.");
  const catalog = await response.json();
  waybackItems = Object.entries(catalog)
    .filter(([key, item]) => /^\d+$/.test(key) && item?.itemURL && item?.itemTitle)
    .map(([key, item]) => {
      const date = item.itemTitle.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      return date ? { ...item, releaseNum: Number(key), releaseDateLabel: date } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.releaseDateLabel.localeCompare(b.releaseDateLabel));
  if (waybackItems.length < 2) throw new Error("Esri no devolvió suficientes fechas históricas.");
  const options = waybackItems
    .map((item) => `<option value="${item.releaseNum}">${item.releaseDateLabel}</option>`)
    .join("");
  ["yl", "yr"].forEach((id) => {
    $("#" + id).innerHTML = options;
    $("#" + id).onchange = (e) => {
      const side = id === "yl" ? "l" : "r";
      sw[side] = Number(e.target.value);
      waybackFallback[side].requested = sw[side];
      waybackFallback[side].attempts.clear();
      paint();
    };
  });
  const mid2020 = new Date("2020-07-01").getTime();
  const release2020 = waybackItems.reduce((closest, item) =>
    Math.abs(Date.parse(item.releaseDateLabel) - mid2020) <
    Math.abs(Date.parse(closest.releaseDateLabel) - mid2020)
      ? item
      : closest,
  );
  sw.l = release2020.releaseNum;
  sw.r = waybackItems[waybackItems.length - 1].releaseNum;
  waybackFallback.l.requested = sw.l;
  waybackFallback.r.requested = sw.r;
  $("#yl").value = String(sw.l);
  $("#yr").value = String(sw.r);
  $("#sw").disabled = false;
  $("#waybackStatus").textContent = `${waybackItems.length} versiones disponibles. Inicia comparando ${release2020.releaseDateLabel} con ${waybackItems[waybackItems.length - 1].releaseDateLabel}; puedes cambiar cualquiera de las dos fechas.`;
  paint();
};
loadWaybackCatalog().catch((error) => {
  $("#waybackStatus").textContent = "No se pudieron cargar las imágenes históricas de Esri. Revisa la conexión y vuelve a intentarlo.";
  $("#sw").disabled = true;
  console.error("Error al cargar el archivo Wayback de Esri:", error);
});
$("#sw").onchange = (e) => {
  sw.on = e.target.checked;
  paint();
};
$$("[name=o]").forEach(
  (r) =>
    (r.onchange = () => {
      sw.o = r.value;
      sw.f = 0.5;
      paint();
    }),
);
let drag = false;
let dragOffset = 0;
const cort = $("#cort");
L.DomEvent.disableClickPropagation(cort);
L.DomEvent.disableScrollPropagation(cort);
const moveDivider = (e) => {
  const r = $("#map").getBoundingClientRect();
  const origin = sw.o === "v" ? r.left : r.top;
  const size = sw.o === "v" ? r.width : r.height;
  const pointer = sw.o === "v" ? e.clientX : e.clientY;
  sw.f = Math.min(
    0.98,
    Math.max(0.02, (pointer - origin - dragOffset) / size),
  );
  clip();
};
cort.onpointerdown = (e) => {
  if (!sw.on) return;
  e.preventDefault();
  e.stopPropagation();
  const r = $("#map").getBoundingClientRect();
  const origin = sw.o === "v" ? r.left : r.top;
  const size = sw.o === "v" ? r.width : r.height;
  const pointer = sw.o === "v" ? e.clientX : e.clientY;
  const divider = origin + sw.f * size;
  // Al tomar el mando circular conserva el punto de agarre; al tocar la guía, salta a ese punto.
  dragOffset = Math.abs(pointer - divider) <= 26 ? pointer - divider : 0;
  drag = true;
  cort.setPointerCapture(e.pointerId);
  if (!dragOffset) moveDivider(e);
};
cort.onpointermove = (e) => {
  if (!drag) return;
  e.preventDefault();
  e.stopPropagation();
  moveDivider(e);
};
const stopDividerDrag = (e) => {
  e.stopPropagation();
  drag = false;
};
cort.onpointerup = stopDividerDrag;
cort.onpointercancel = stopDividerDrag;
cort.onkeydown = (e) => {
  const step = e.shiftKey ? 0.1 : 0.02;
  let next = sw.f;
  if (sw.o === "v" && e.key === "ArrowLeft") next -= step;
  else if (sw.o === "v" && e.key === "ArrowRight") next += step;
  else if (sw.o === "h" && e.key === "ArrowUp") next -= step;
  else if (sw.o === "h" && e.key === "ArrowDown") next += step;
  else return;
  e.preventDefault();
  e.stopPropagation();
  sw.f = Math.min(0.98, Math.max(0.02, next));
  clip();
};
paint();

/* ---------- Ficha POT ---------- */
const row = (a, b) => `<tr><th>${a}</th><td>${b}</td></tr>`;
function ficha(ll) {
  const r = at(ll);
  if (!r.z)
    return `<p>Este punto no tiene una categoría en la capa de usos generales POT 2014 recortada a Piedras Blancas. La fuente no cubre toda la vereda.</p>`;
  const z = POT[r.z];
  const p = r.feature.properties || {};
  return `<h3 style="color:${z.c}">${safeText(p.areagralus)}</h3><table class="ft">${row("Corregimiento", "Santa Elena")}${row("Vereda", "Piedras Blancas")}${row("Uso general POT", safeText(p.areagralus))}${row("Subcategoría", safeText(p.subcategor))}${row("Código de uso", safeText(p.cod_cat_us))}${row("Código de subcategoría", safeText(p.cod_subcat))}</table><p class="nt">Fuente: capa Usos Generales del POT de Medellín (2014), recortada al límite veredal de Piedras Blancas. Las categorías describen esta capa y no sustituyen la consulta normativa vigente.</p>`;
}
let drawing = false;
map.on("click", (e) => {
  if (drawing || pickingPlace) return;
  const selectedFeature = selectedAttributeFeatureAt(e.latlng);
  if (selectedFeature) {
    showFeatureAttributes(selectedFeature, activeAttributeLayerName, e.latlng);
    return;
  }
  const importedFeature = importedFeatureAt(e.latlng);
  if (importedFeature) {
    showFeatureAttributes(importedFeature.feature, importedFeature.name, e.latlng);
    return;
  }
  const thematicFeature = thematicFeatureAt(e.latlng);
  if (thematicFeature) {
    showFeatureAttributes(thematicFeature.feature, thematicFeature.name, e.latlng);
    return;
  }
  $$("nav button")[2].textContent = "Norma POT";
  const r = at(e.latlng);
  $("#ficha").innerHTML = ficha(e.latlng);
  L.popup({ maxWidth: 300 })
    .setLatLng(e.latlng)
    .setContent(
      `<b>${r.z ? safeText(POT[r.z].s) : "Sin categoría POT en esta fuente"}</b><br>Corregimiento Santa Elena · Vereda Piedras Blancas<br><a href="#" onclick="tab(2);return false">Ver ficha completa</a>`,
    )
    .openOn(map);
});

/* ---------- Análisis de las construcciones DATA ---------- */
let floorChart, typeChart, areaChart;
let constructionFeatures = [];
const renderConstructionSummary = (features) => {
  const areas = features
    .map((feature) => Number(feature.properties?.area_const))
    .filter((area) => Number.isFinite(area) && area > 0)
    .sort((a, b) => a - b);
  const totalArea = areas.reduce((total, area) => total + area, 0);
  const averageArea = areas.length ? totalArea / areas.length : 0;
  const middle = Math.floor(areas.length / 2);
  const medianArea = areas.length
    ? areas.length % 2 ? areas[middle] : (areas[middle - 1] + areas[middle]) / 2
    : 0;
  const card = (value, label, detail) =>
    '<div class="k"><b>' + value + '</b><span>' + label + '</span><em>' + detail + '</em></div>';
  $("#kp").innerHTML = [
    card(fmt(features.length, 0), "Construcciones registradas", "Elementos en la capa DATA"),
    card(fmt(totalArea / 10000, 2) + " ha", "Área construida total", fmt(areas.length, 0) + " construcciones con área válida"),
    card(fmt(averageArea, 1) + " m²", "Área promedio", "Por construcción registrada"),
    card(fmt(medianArea, 1) + " m²", "Área mediana", "La mitad tiene esta área o menos"),
  ].join("");
  $("#constructionAnalysisStatus").textContent =
    "Resumen de " + fmt(features.length, 0) + " construcciones del archivo DATA de Piedras Blancas. Es una fotografía del catastro disponible; no representa crecimiento por años.";
};
function charts() {
  if (!constructionFeatures.length || floorChart) return;
  const textColor = document.body.dataset.theme === "dark" ? "#e6edf7" : "#1b2a41";
  const gridColor = document.body.dataset.theme === "dark" ? "#334154" : "#d9dee5";
  const chartOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: textColor } } },
    scales: {
      x: { ticks: { color: textColor }, grid: { color: gridColor } },
      y: { ticks: { color: textColor }, grid: { color: gridColor } },
    },
  };
  const floors = { "1 piso": 0, "2 pisos": 0, "3 o más pisos": 0, "Sin dato o 0": 0 };
  const types = new Map();
  const areas = { "Menos de 50 m²": 0, "50–99 m²": 0, "100–199 m²": 0, "200 m² o más": 0, "Sin área": 0 };
  constructionFeatures.forEach((feature) => {
    const properties = feature.properties || {};
    const storeys = Number(properties.numero_pis);
    if (storeys === 1) floors["1 piso"]++;
    else if (storeys === 2) floors["2 pisos"]++;
    else if (storeys >= 3) floors["3 o más pisos"]++;
    else floors["Sin dato o 0"]++;
    const type = String(properties.tipo_const || "Sin código");
    types.set(type, (types.get(type) || 0) + 1);
    const area = Number(properties.area_const);
    if (!Number.isFinite(area) || area <= 0) areas["Sin área"]++;
    else if (area < 50) areas["Menos de 50 m²"]++;
    else if (area < 100) areas["50–99 m²"]++;
    else if (area < 200) areas["100–199 m²"]++;
    else areas["200 m² o más"]++;
  });
  floorChart = new Chart($("#cb"), {
    type: "bar",
    data: {
      labels: Object.keys(floors),
      datasets: [{ label: "Construcciones", data: Object.values(floors), backgroundColor: "#3979b9" }],
    },
    options: { ...chartOptions, indexAxis: "y", plugins: { legend: { display: false } } },
  });
  const typeRows = [...types.entries()].sort((a, b) => b[1] - a[1]);
  typeChart = new Chart($("#cd"), {
    type: "bar",
    data: {
      labels: typeRows.map(([code]) => "Código " + code),
      datasets: [{ label: "Construcciones", data: typeRows.map(([, count]) => count), backgroundColor: "#2d8b83" }],
    },
    options: { ...chartOptions, indexAxis: "y", plugins: { legend: { display: false } } },
  });
  areaChart = new Chart($("#ca"), {
    type: "bar",
    data: {
      labels: Object.keys(areas),
      datasets: [{ label: "Construcciones", data: Object.values(areas), backgroundColor: "#d49b35" }],
    },
    options: { ...chartOptions, plugins: { legend: { display: false } } },
  });
}

/* ---------- Análisis espacial ---------- */
const dr = L.featureGroup().addTo(map);
let tool = null,
  last = null;
const inter = (a, b) => {
  try {
    const i = turf.intersect(a, b);
    return i ? turf.area(i) / 1e4 : 0;
  } catch (e) {
    return 0;
  }
};
function repArea(g) {
  const a = turf.area(g);
  let h = `<b>Área:</b> ${fmt(a, 0)} m² · ${fmt(a / 1e4, 2)} ha<h3>Zonificación POT que impacta</h3><div class="lg">`;
  for (const k in ZN) {
    const v = ZN[k].reduce((total, feature) => total + inter(g, feature), 0);
    if (v > 0)
      h += `<div><i style="background:${POT[k].c}"></i>${POT[k].s}: ${fmt(v, 2)} ha (${fmt(((v * 1e4) / a) * 100, 0)} %)</div>`;
  }
  h += '</div><h3>Cobertura 2024 dentro de la zona</h3><div class="lg">';
  for (const k in CL) {
    const v = DATA[2024][k] ? inter(g, DATA[2024][k]) : 0;
    if (v > 0) h += `<div><i style="background:${CL[k][1]}"></i>${CL[k][0]}: ${fmt(v, 2)} ha</div>`;
  }
  return h + "</div>";
}
function start(t) {
  if (tool) tool.disable();
  tab(4);
  tool =
    t === "l"
      ? new L.Draw.Polyline(map, { shapeOptions: { color: "#ce1126" } })
      : new L.Draw.Polygon(map, { showArea: false, shapeOptions: { color: "#ce1126", weight: 2 } });
  tool.enable();
}
map.on("draw:drawstart", () => (drawing = true));
map.on("draw:drawstop", () => setTimeout(() => (drawing = false), 60));
map.on("draw:created", (e) => {
  dr.addLayer(e.layer);
  last = e.layer;
  const g = e.layer.toGeoJSON();
  if (g.geometry.type === "LineString") {
    const k = turf.length(g, { units: "kilometers" });
    $("#res").innerHTML = `<b>Distancia:</b> ${fmt(k * 1000, 0)} m (${fmt(k, 2)} km)`;
  } else $("#res").innerHTML = repArea(g);
});
$("#dl1").onclick = $("#bm1").onclick = () => start("l");
$("#dp").onclick = () => start("p");
$("#dc").onclick = () => {
  dr.clearLayers();
  last = null;
  $("#res").innerHTML = "";
};
$("#bb").onclick = () => {
  if (!last) return toast("Primero dibuja una línea o un polígono");
  const r = +$("#br").value,
    b = turf.buffer(last.toGeoJSON(), r / 1000, { units: "kilometers" });
  L.geoJSON(b, {
    style: { color: "#ce1126", dashArray: "6 4", weight: 1.5, fillOpacity: 0.1 },
    interactive: false,
  }).addTo(dr);
  $("#res").innerHTML = `<b>Buffer de ${r} m</b><br>` + repArea(b);
};

/* ---------- Búsqueda, vistas, ubicación, exportación ---------- */
const flat = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
$("#q").onkeydown = (e) => {
  if (e.key !== "Enter") return;
  const v = e.target.value.trim(),
    m = v.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  let p;
  if (m) {
    let a = +m[1],
      b = +m[2];
    if (Math.abs(a) > 90) [a, b] = [b, a];
    p = [a, b];
  } else {
    const n = Object.keys(PL).find((n) => flat(n).includes(flat(v)));
    if (n && v) p = PL[n];
  }
  if (!p)
    return toast("No se encontró «" + v + "». Prueba con un lugar o con «lat, lon».");
  map.flyTo(p, 16);
  L.marker(p).addTo(map).bindPopup(v).openPopup();
};
$("#vw").onchange = (e) => {
  const v = e.target.value;
  if (v === "v") map.fitBounds(G.ver.getBounds());
  else if (v === "a") map.flyTo(PL["Parque Arví"], 14);
  else map.fitBounds(G.cor.getBounds());
};
let selectedMapPoint = map.getCenter();
let pickingPlace = false;
let placeMarker = null;
const placeCoordinates = $("#placeCoordinates");
const placeStatus = $("#placeStatus");
const streetViewPanel = $("#streetViewPanel");
const streetViewFrame = $("#streetViewFrame");
const streetViewStatus = $("#streetViewStatus");
let streetViewOpen = false;
const streetViewDragHandle = $("#streetViewDragHandle");
let streetViewDrag = null;
streetViewDragHandle.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button") || (event.pointerType === "mouse" && event.button !== 0)) return;
  const rect = streetViewPanel.getBoundingClientRect();
  streetViewPanel.style.left = rect.left + "px";
  streetViewPanel.style.top = rect.top + "px";
  streetViewPanel.style.right = "auto";
  streetViewPanel.style.bottom = "auto";
  streetViewDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
  streetViewDragHandle.setPointerCapture(event.pointerId);
  event.preventDefault();
});
streetViewDragHandle.addEventListener("pointermove", (event) => {
  if (!streetViewDrag || streetViewDrag.id !== event.pointerId) return;
  const maxLeft = Math.max(0, window.innerWidth - streetViewPanel.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - streetViewPanel.offsetHeight);
  const left = Math.min(maxLeft, Math.max(0, streetViewDrag.left + event.clientX - streetViewDrag.x));
  const top = Math.min(maxTop, Math.max(0, streetViewDrag.top + event.clientY - streetViewDrag.y));
  streetViewPanel.style.left = left + "px";
  streetViewPanel.style.top = top + "px";
});
const stopStreetViewDrag = (event) => {
  if (streetViewDrag?.id !== event.pointerId) return;
  streetViewDrag = null;
  if (streetViewDragHandle.hasPointerCapture(event.pointerId)) streetViewDragHandle.releasePointerCapture(event.pointerId);
};
streetViewDragHandle.addEventListener("pointerup", stopStreetViewDrag);
streetViewDragHandle.addEventListener("pointercancel", stopStreetViewDrag);
window.addEventListener("resize", () => {
  if (streetViewPanel.hidden || !streetViewPanel.style.left) return;
  const left = Math.min(Math.max(0, window.innerWidth - streetViewPanel.offsetWidth), parseFloat(streetViewPanel.style.left) || 0);
  const top = Math.min(Math.max(0, window.innerHeight - streetViewPanel.offsetHeight), parseFloat(streetViewPanel.style.top) || 0);
  streetViewPanel.style.left = left + "px";
  streetViewPanel.style.top = top + "px";
});
function refreshStreetView() {
  $("#streetViewPointLabel").textContent = selectedMapPoint.lat.toFixed(5) + ", " + selectedMapPoint.lng.toFixed(5);
  if (!streetViewOpen) return;
  const params = new URLSearchParams({
    layer: "c",
    cbll: selectedMapPoint.lat + "," + selectedMapPoint.lng,
    cbp: [12, $("#streetViewHeading").value, 0, $("#streetViewPitch").value, $("#streetViewZoom").value].join(","),
    output: "svembed",
  });
  streetViewFrame.src = "https://maps.google.com/maps?" + params.toString();
  streetViewFrame.hidden = false;
  streetViewStatus.textContent = "Panorama actualizado. Este método clásico no está documentado y puede no funcionar en todos los navegadores o ubicaciones.";
}
function closeStreetView() {
  streetViewOpen = false;
  streetViewPanel.hidden = true;
  streetViewFrame.removeAttribute("src");
  $("#streetViewButton").setAttribute("aria-expanded", "false");
  $("#streetViewButton").textContent = "Street View";
}
const showPlace = (point, message, pan = false, showCoordinateMarker = false) => {
  selectedMapPoint = L.latLng(point.lat, point.lng);
  if (showCoordinateMarker) {
    if (!placeMarker) placeMarker = L.marker(selectedMapPoint, { keyboard: false, riseOnHover: true }).addTo(map);
    else placeMarker.setLatLng(selectedMapPoint).addTo(map);
  } else if (placeMarker) {
    map.removeLayer(placeMarker);
    placeMarker = null;
  }
  placeCoordinates.value = selectedMapPoint.lat.toFixed(6) + ", " + selectedMapPoint.lng.toFixed(6);
  placeStatus.textContent = message + " · " + selectedMapPoint.lat.toFixed(5) + ", " + selectedMapPoint.lng.toFixed(5);
  if (pan) map.flyTo(selectedMapPoint, Math.max(map.getZoom(), 16));
  refreshStreetView();
};
showPlace(selectedMapPoint, "Punto inicial");
$("#choosePlaceButton").onclick = () => {
  pickingPlace = true;
  $("#placeExplorer").classList.add("is-picking");
  placeStatus.textContent = "Haz clic sobre el lugar que quieres visualizar";
  map.getContainer().style.cursor = "crosshair";
};
$("#goToPlaceButton").onclick = () => {
  const values = placeCoordinates.value.split(/[;,\s]+/).filter(Boolean).map(Number);
  if (values.length !== 2 || values.some((value) => !Number.isFinite(value)) || Math.abs(values[0]) > 90 || Math.abs(values[1]) > 180) {
    placeStatus.textContent = "Escribe latitud, longitud; por ejemplo: 6.29, -75.49";
    return;
  }
  pickingPlace = false;
  $("#placeExplorer").classList.remove("is-picking");
  map.getContainer().style.cursor = "";
  showPlace({ lat: values[0], lng: values[1] }, "Ubicación indicada", true, true);
};
placeCoordinates.onkeydown = (event) => {
  if (event.key === "Enter") $("#goToPlaceButton").click();
};
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pickingPlace) {
    pickingPlace = false;
    $("#placeExplorer").classList.remove("is-picking");
    map.getContainer().style.cursor = "";
    placeStatus.textContent = "Selección cancelada";
  } else if (event.key === "Escape" && streetViewOpen) closeStreetView();
});
map.on("click", (event) => {
  if (pickingPlace) {
    pickingPlace = false;
    $("#placeExplorer").classList.remove("is-picking");
    map.getContainer().style.cursor = "";
    showPlace(event.latlng, "Lugar seleccionado");
  } else if (streetViewOpen) {
    showPlace(event.latlng, "Ubicación del panorama");
  }
});
$("#streetViewButton").onclick = () => {
  if (streetViewOpen) return closeStreetView();
  streetViewOpen = true;
  streetViewPanel.hidden = false;
  $("#streetViewButton").setAttribute("aria-expanded", "true");
  $("#streetViewButton").textContent = "Cerrar Street View";
  showPlace(map.getCenter(), "Centro del mapa");
};
$("#closeStreetView").onclick = closeStreetView;
$("#streetViewReloadCenter").onclick = () => showPlace(map.getCenter(), "Centro del mapa");
$("#updateStreetView").onclick = refreshStreetView;
[["streetViewHeading", "streetViewHeadingValue", "°"], ["streetViewPitch", "streetViewPitchValue", "°"], ["streetViewZoom", "streetViewZoomValue", ""]].forEach(([inputId, outputId, unit]) => {
  const input = $("#" + inputId);
  const output = $("#" + outputId);
  input.addEventListener("input", () => { output.textContent = input.value + unit; });
});
$("#googleEarthButton").onclick = () => {
  const point = selectedMapPoint || map.getCenter();
  const url = "https://earth.google.com/web/@" + point.lat + "," + point.lng + ",2500a,0d,0y,0h,0t,0r";
  window.open(url, "_blank", "noopener,noreferrer");
};
$("#bpng").onclick = () =>
  html2canvas($("#map"), { useCORS: true })
    .then((c) => {
      const a = document.createElement("a");
      a.download = "geovisor-piedras-blancas.png";
      a.href = c.toDataURL();
      a.click();
    })
    .catch(() => toast("No se pudo exportar el PNG"));
const layoutDialog = $("#layoutDialog");
const renderLayoutContent = () => {
  $("#layoutPreviewTitle").textContent = $("#layoutTitle").value.trim() || "Mapa sin título";
  $("#layoutPreviewSubtitle").textContent = $("#layoutSubtitle").value.trim();
  $("#layoutSourcePreview").textContent = $("#layoutSource").value.trim();
  const paper = $("#layoutPaper");
  paper.classList.toggle("landscape", $("#layoutOrientation").value === "landscape");
  paper.classList.toggle("portrait", $("#layoutOrientation").value === "portrait");
  paper.classList.toggle("hide-legend", !$("#layoutShowLegend").checked);
  paper.classList.toggle("hide-scale", !$("#layoutShowScale").checked);
  paper.classList.toggle("hide-north", !$("#layoutShowNorth").checked);
  $("#layoutLegend").innerHTML = $(".project-legend-items")?.innerHTML || '<span class="project-legend-empty">Sin capas temáticas activas</span>';
  renderLayoutScale();
};
const renderLayoutScale = () => {
  const frame = $(".layout-map-frame");
  if (!frame.clientWidth || !map.getSize().x) return;
  const latitude = map.getCenter().lat * Math.PI / 180;
  const groundResolution = 156543.03392 * Math.cos(latitude) / (2 ** map.getZoom());
  const imageScale = Math.max(frame.clientWidth / map.getSize().x, frame.clientHeight / map.getSize().y);
  const metersPerLayoutPixel = groundResolution / imageScale;
  const scaleDenominator = Math.round(metersPerLayoutPixel / (0.0254 / 96) / 100) * 100;
  const desiredWidth = Math.min(125, frame.clientWidth * 0.34);
  const candidates = [100, 250, 500, 1000, 2000, 5000, 10000, 25000, 50000];
  const distance = candidates.filter((meters) => meters / metersPerLayoutPixel <= desiredWidth).pop() || candidates[0];
  const barWidth = Math.max(16, distance / metersPerLayoutPixel);
  $("#layoutScaleBar").style.width = `${barWidth}px`;
  $("#layoutScaleNumber").textContent = `0 — ${distance >= 1000 ? `${fmt(distance / 1000, 1)} km` : `${fmt(distance, 0)} m`} · aprox. 1:${scaleDenominator.toLocaleString("es-CO")}`;
};
const refreshLayoutMap = async () => {
  const status = $("#layoutStatus");
  status.textContent = "Actualizando la vista del mapa…";
  try {
    const canvas = await html2canvas($("#map"), {
      useCORS: true,
      scale: 2,
      backgroundColor: "#eef2f6",
      onclone: (clonedDocument) => {
        const clonedMap = clonedDocument.querySelector("#map");
        clonedMap?.querySelectorAll(".leaflet-control-container,#gps,#coords,#demo,#cort,#ban,.leaflet-popup-pane").forEach((element) => element.remove());
      },
    });
    $("#layoutMapImage").src = canvas.toDataURL("image/png");
    renderLayoutContent();
    status.textContent = "Mapa actualizado con la vista y las capas activas.";
  } catch (error) {
    console.error("No se pudo actualizar el mapa del layout:", error);
    status.textContent = "No se pudo capturar el mapa. Verifica que el mapa base haya terminado de cargar e inténtalo de nuevo.";
  }
  return Boolean($("#layoutMapImage").getAttribute("src"));
};
$("#openLayout").onclick = () => {
  layoutDialog.showModal();
  renderLayoutContent();
  refreshLayoutMap();
};
$("#closeLayout").onclick = () => layoutDialog.close();
$("#refreshLayout").onclick = refreshLayoutMap;
["#layoutTitle", "#layoutSubtitle", "#layoutSource", "#layoutOrientation", "#layoutShowLegend", "#layoutShowScale", "#layoutShowNorth"].forEach((selector) => {
  $(selector).addEventListener("input", renderLayoutContent);
  $(selector).addEventListener("change", renderLayoutContent);
});
$("#downloadLayout").onclick = async () => {
  const status = $("#layoutStatus");
  if (!$("#layoutMapImage").getAttribute("src") && !(await refreshLayoutMap())) return;
  status.textContent = "Preparando archivo PNG…";
  try {
    const canvas = await html2canvas($("#layoutPaper"), { backgroundColor: "#ffffff", scale: 2, useCORS: true });
    const link = document.createElement("a");
    link.download = "layout-piedras-blancas.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    status.textContent = "Layout descargado como PNG.";
  } catch (error) {
    console.error("No se pudo exportar el layout:", error);
    status.textContent = "No se pudo crear el PNG. Actualiza el mapa e inténtalo de nuevo.";
  }
};
$("#bpdf").onclick = () => window.print();
$("#bhelp").onclick = () => $("#ay").showModal();

/* ---------- Panel ---------- */
function tab(i) {
  $("aside").classList.remove("c");
  setTimeout(() => map.invalidateSize(), 250);
  $$("nav button").forEach((b, j) => b.classList.toggle("on", i === j));
  $$(".tab").forEach((t, j) => t.classList.toggle("on", i === j));
  if (i !== 1 && sw.on) {
    sw.on = false;
    $("#sw").checked = false;
    paint();
  }
  if (i === 3 && !floorChart) charts();
}
$$("nav button").forEach((b, i) => (b.onclick = () => tab(i)));
$("#tg").onclick = () => {
  $("aside").classList.toggle("c");
  setTimeout(() => map.invalidateSize(), 250);
};
const themeToggle = $("#themeToggle");
const setTheme = (theme) => {
  document.body.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "Modo claro" : "Modo oscuro";
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggle.title = theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  if (floorChart) {
    floorChart.destroy();
    typeChart.destroy();
    areaChart.destroy();
    floorChart = typeChart = areaChart = null;
    if ($$(".tab")[3]?.classList.contains("on")) charts();
  }
};
try {
  setTheme(localStorage.getItem("geovisor-theme") === "dark" ? "dark" : "light");
} catch {
  setTheme("light");
}
themeToggle.onclick = () => {
  const theme = document.body.dataset.theme === "dark" ? "light" : "dark";
  setTheme(theme);
  try { localStorage.setItem("geovisor-theme", theme); } catch { /* El tema sigue activo durante esta sesión. */ }
};
if (innerWidth < 800) $("aside").classList.add("c");
window.addEventListener("resize", () => setTimeout(() => map.invalidateSize(), 120));

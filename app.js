// The whole site: three hash routes over one round of atlas JSON and one district SVG.
const [data, svgText] = await Promise.all([
  fetch("data/baseline.json").then((r) => r.json()),
  fetch("map.svg").then((r) => r.text()),
]);
const byId = new Map(data.districts.map((d) => [d.id, d]));
// A district may cover several 2011 polygons (`map`); by default its id is the polygon id.
const byPolygon = new Map(data.districts.flatMap((d) => (d.map ?? [d.id]).map((p) => [p, d])));
let model = data.models[0];

const HATCH = `<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <rect class="hatch-bg" width="4" height="4"/><line class="hatch-line" x1="0" y1="0" x2="0" y2="4"/></pattern></defs>`;

const pct = (x) => `${Math.round(x * 100)}%`;
const interval = (r) => `${pct(r.ci[0])}–${pct(r.ci[1])}`;
const loose = (r) => (r.wer_lenient == null ? "–" : pct(r.wer_lenient));
const bin = (r) => Math.min(6, Math.floor(r.wer_pooled * 20)); // 5-point bins, 30% and up in one

// Data strings always become text nodes, never HTML.
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids.flat(Infinity).filter((k) => k != null));
  return el;
}
const td = (text, cls) => h("td", cls ? { class: cls } : {}, String(text));

function route() {
  const [, page, id] = location.hash.split("/");
  const view =
    page === "district" ? districtView(byId.get(decodeURIComponent(id ?? "")))
    : page === "methodology" ? document.getElementById("methodology").content.cloneNode(true)
    : mapView();
  document.getElementById("view").replaceChildren(view);
  scrollTo(0, 0);
}

function mapView() {
  const select = h("select", { id: "model" }, data.models.map((m) => h("option", { value: m }, m)));
  select.value = model;
  const title = h("h1");
  const wrap = h("div", { class: "map" });
  wrap.innerHTML = svgText; // our own static file, not data
  const svg = wrap.querySelector("svg");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("aria-label", "Map of India's districts");
  svg.insertAdjacentHTML("afterbegin", HATCH);
  const tip = h("div", { class: "tip", role: "tooltip", hidden: "" });
  wrap.append(tip);
  const tbody = h("tbody");

  function paint() {
    title.textContent = `${model}: word error rate by district`;
    for (const p of svg.querySelectorAll("path")) {
      const d = byPolygon.get(p.id);
      const r = d?.results[model];
      for (const a of ["class", "tabindex", "role", "aria-label"]) p.removeAttribute(a);
      if (!r) continue;
      p.setAttribute("class", r.status ? "unsupported" : `b${bin(r)}`);
      p.setAttribute("tabindex", "0");
      p.setAttribute("role", "link");
      p.setAttribute("aria-label", `${d.name}, ${d.state}: ${r.status ? "not supported" : `${pct(r.wer)} word error rate`}`);
    }
    const ds = data.districts.filter((d) => d.results[model]);
    ds.sort((a, b) => (b.results[model].wer ?? -1) - (a.results[model].wer ?? -1));
    tbody.replaceChildren(...ds.map((d) => {
      const r = d.results[model];
      const name = h("td", {}, h("a", { href: `#/district/${d.id}` }, d.name));
      return r.status
        ? h("tr", {}, name, td(d.state), h("td", { class: "na", colspan: 5 }, "Not supported"))
        : h("tr", {}, name, td(d.state), td(pct(r.wer), "num"), td(interval(r), "num"), td(loose(r), "num"), td(r.clips, "num"), td(r.speakers, "num"));
    }));
  }

  function show(p, x, y) {
    const d = byPolygon.get(p.id);
    const r = d.results[model];
    tip.replaceChildren(
      h("strong", {}, r.status ? "Not supported" : `${pct(r.wer)} WER`),
      h("span", {}, `${d.name}, ${d.state}`),
      ...(r.status ? [] : [h("span", {}, `${interval(r)} · ${r.clips} clips`)]),
    );
    tip.hidden = false;
    const box = wrap.getBoundingClientRect();
    tip.style.left = `${Math.min(x - box.left + 12, box.width - tip.offsetWidth - 8)}px`;
    tip.style.top = `${Math.max(8, y - box.top - tip.offsetHeight - 12)}px`;
  }
  const hide = () => (tip.hidden = true);
  const open = (p) => (location.hash = `#/district/${byPolygon.get(p.id).id}`);

  svg.addEventListener("pointermove", (e) => {
    const p = e.target.closest("path[tabindex]");
    if (!p) return hide();
    if (p.nextElementSibling) p.parentNode.append(p); // raise so the hover stroke isn't hidden
    show(p, e.clientX, e.clientY);
  });
  svg.addEventListener("pointerleave", hide);
  svg.addEventListener("click", (e) => { const p = e.target.closest("path[tabindex]"); if (p) open(p); });
  svg.addEventListener("focusin", (e) => { const b = e.target.getBoundingClientRect(); show(e.target, b.right, b.top + b.height / 2); });
  svg.addEventListener("focusout", hide);
  svg.addEventListener("keydown", (e) => { if (e.key === "Enter") open(e.target); });
  select.addEventListener("change", () => { model = select.value; paint(); });
  paint();

  const legend = h("ul", { class: "legend", "aria-label": "Legend" },
    [0, 1, 2, 3, 4, 5, 6].map((i) => h("li", {}, h("span", { class: `sw b${i}` }), i < 6 ? `${i * 5}–${i * 5 + 5}%` : "30% or more")),
    h("li", {}, h("span", { class: "sw unsupported" }), "Not supported"),
    h("li", {}, h("span", { class: "sw nodata" }), "No data"),
  );
  return h("section", {},
    h("div", { class: "controls" }, h("label", {}, "Model ", select)),
    title,
    h("p", { class: "sub" }, "Share of words the model gets wrong. Map colours are pulled toward each language's average so small districts can't swing the map; the table shows raw numbers."),
    wrap,
    legend,
    h("div", { class: "table-wrap" }, h("table", {},
      h("thead", {}, h("tr", {}, ["District", "State", "WER", "95% interval", "Lenient WER", "Clips", "Speakers"].map((c) => h("th", { scope: "col" }, c)))),
      tbody)),
  );
}

function districtView(d) {
  if (!d) return h("p", {}, "No such district. ", h("a", { href: "#/" }, "Back to the map"));
  const rows = data.models.filter((m) => d.results[m]).map((m) => {
    const r = d.results[m];
    return r.status
      ? h("tr", {}, td(m), h("td", { class: "na", colspan: 6 }, "Not supported"))
      : h("tr", {}, td(m), td(pct(r.wer), "num"), td(interval(r), "num"), td(loose(r), "num"), td(pct(r.cer), "num"), td(r.clips, "num"), td(r.speakers, "num"));
  });
  return h("article", {},
    h("a", { href: "#/", class: "back" }, "← Map"),
    h("h1", {}, d.name),
    h("p", { class: "sub" }, d.state),
    h("p", {}, "Languages in the test set: ", Object.entries(d.languages).map(([l, s]) => `${l} ${pct(s)}`).join(" · ")),
    h("h2", {}, "Results"),
    h("div", { class: "table-wrap" }, h("table", {},
      h("thead", {}, h("tr", {}, ["Model", "WER", "95% interval", "Lenient WER", "CER", "Clips", "Speakers"].map((c) => h("th", { scope: "col" }, c)))),
      h("tbody", {}, rows))),
    h("h2", {}, "Example clips"),
    h("p", { class: "sub" }, "Struck-through words were missed or replaced. Underlined words were inserted, or replaced what was said."),
    d.examples.map((e) => h("figure", { class: "example" },
      e.audio ? h("audio", { controls: "", preload: "none", src: e.audio }) : null,
      h("p", {}, h("span", { class: "who" }, "What was said"), e.ref),
      Object.entries(e.align).map(([m, ops]) => h("p", {}, h("span", { class: "who" }, m), ops.map(word))),
    )),
  );
}

function word([op, ref, hyp]) {
  const w = op === "C" ? hyp
    : op === "D" ? h("del", {}, ref)
    : op === "I" ? h("ins", {}, hyp)
    : h("span", { class: "s" }, h("del", {}, ref), h("ins", {}, hyp));
  return [w, " "];
}

addEventListener("hashchange", route);
route();

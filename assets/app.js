/* Then vs Now: generational cost-of-living comparison. Data: data/data.json (scripts/build_data.py). */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const state = { pBirth: 1965, yBirth: 1996, age: 30, basis: "young", dp: 0.2, save: 0.1 };
  let D, Y, S, first, last, base, charts = {};

  // ---------- data helpers ----------
  const idx = (y) => Y.indexOf(y);
  const v = (k, y) => { const i = idx(y); return i < 0 ? null : S[k][i]; };
  const ok = (...xs) => xs.every((x) => x !== null && x !== undefined && !Number.isNaN(x));
  const income = (y) => v(state.basis === "young" ? "youngIncome" : "hhIncome", y);
  const toToday = (x, y) => (ok(x, v("cpi", y)) ? x * v("cpi", base) / v("cpi", y) : null);

  function pmt(principal, ratePct, n = 360) {
    const r = ratePct / 100 / 12;
    return principal * r / (1 - Math.pow(1 + r, -n));
  }

  const M = {
    price: (y) => toToday(v("homePrice", y), y),
    income: (y) => toToday(income(y), y),
    pti: (y) => (ok(v("homePrice", y), income(y)) ? v("homePrice", y) / income(y) : null),
    rate: (y) => v("mortgageRate", y),
    payment: (y) => (ok(v("homePrice", y), v("mortgageRate", y)) ? pmt(v("homePrice", y) * (1 - state.dp), v("mortgageRate", y)) : null),
    payShare: (y) => (ok(M.payment(y), income(y)) ? M.payment(y) * 12 / income(y) * 100 : null),
    saveYears: (y) => (ok(v("homePrice", y), income(y)) ? state.dp * v("homePrice", y) / (state.save * income(y)) : null),
    rentShare: (y) => (ok(v("rent", y), income(y)) ? v("rent", y) * 12 / income(y) * 100 : null),
    own35: (y) => v("ownershipUnder35", y),
    ownAll: (y) => v("ownershipAll", y),
    minRentHours: (y) => (ok(v("rent", y), v("minWage", y)) ? v("rent", y) / v("minWage", y) : null),
    minReal: (y) => toToday(v("minWage", y), y),
    saveRate: (y) => v("savingRate", y),
    lifetimeInterest: (y) => (ok(M.payment(y)) ? toToday(M.payment(y) * 360 - v("homePrice", y) * (1 - state.dp), y) : null),
  };

  // ---------- formatting ----------
  const fmtMoney = (x) => (x == null ? "n/a" : "$" + Math.round(x).toLocaleString("en-US"));
  const fmtK = (x) => (x == null ? "n/a" : x >= 1e6 ? "$" + (x / 1e6).toFixed(2) + "M" : "$" + Math.round(x / 1000).toLocaleString("en-US") + "k");
  const fmt1 = (x, suf = "") => (x == null ? "n/a" : x.toFixed(1) + suf);
  const fmtPct = (x) => (x == null ? "n/a" : x.toFixed(1) + "%");

  // ---------- theme tokens ----------
  function tokens() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    return { then: g("--then"), now: g("--now"), line: g("--line"), c3: g("--series-3"), c4: g("--series-4"), c7: g("--series-7"),
      text: g("--text-primary"), text2: g("--text-secondary"), muted: g("--text-muted"), grid: g("--grid"), surface: g("--surface") };
  }

  // ---------- years ----------
  function years() {
    const clamp = (y) => Math.max(first, Math.min(last, y));
    const tRaw = state.pBirth + state.age, nRaw = state.yBirth + state.age;
    return { then: clamp(tRaw), now: clamp(nRaw), tRaw, nRaw };
  }

  // ---------- scorecard ----------
  const CARDS = [
    { k: "price", label: "Median home price", sub: "today's dollars", f: fmtK },
    { k: "income", label: "Median household income", subFn: () => (state.basis === "young" ? "householders aged 25–34, today's dollars" : "all households, today's dollars"), f: fmtK },
    { k: "pti", label: "House price ÷ income", sub: "years of income per house", f: (x) => fmt1(x, "×") },
    { k: "rate", label: "30-year mortgage rate", sub: "average for the year", f: fmtPct },
    { k: "payShare", label: "Mortgage payment", sub: "share of monthly income", f: fmtPct },
    { k: "saveYears", label: "Time to save a down payment", subFn: () => `${state.dp * 100}% down, saving ${state.save * 100}% of income`, f: (x) => fmt1(x, " yrs") },
    { k: "rentShare", label: "Rent", sub: "share of income", f: fmtPct },
    { k: "own35", label: "Under-35s who own a home", sub: "homeownership rate", f: fmtPct, fallback: "ownAll", fallbackSub: "all ages (under-35 data starts in 1994)" },
    { k: "minRentHours", label: "Minimum-wage hours for a month's rent", sub: "federal minimum", f: (x) => fmt1(x, " hrs") },
    { k: "lifetimeInterest", label: "Interest paid over the loan", sub: "30 years, today's dollars", f: fmtK },
  ];

  function renderScore() {
    const { then, now, tRaw, nRaw } = years();
    const clampNote = [];
    if (tRaw !== then) clampNote.push(`the earlier year was set to ${then}, the first year with full data`);
    if (nRaw !== now) clampNote.push(`the later year was set to ${now}, the latest full year of income data`);
    $("#yearsLine").innerHTML = `Comparing <b class="t-then">${then}</b> (born ${state.pBirth}, age ${state.age}) with <b class="t-now">${now}</b> (born ${state.yBirth}, age ${state.age}).` +
      (clampNote.length ? ` <span class="muted">Note: ${clampNote.join("; ")}.</span>` : "");
    $("#scoreSub").textContent = `Each card shows what a typical ${state.age}-year-old faced in ${then} and ${now}. Dollar amounts are adjusted for inflation to ${base} dollars.`;

    const html = CARDS.map((c) => {
      let key = c.k, sub = c.subFn ? c.subFn() : c.sub;
      let a = M[key](then), b = M[key](now);
      if (!ok(a) && c.fallback) { key = c.fallback; sub = c.fallbackSub; a = M[key](then); b = M[key](now); }
      let tag = "";
      if (ok(a, b) && a !== 0) {
        const ch = (b - a) / Math.abs(a), mult = b / a;
        const change = Math.abs(ch) < 0.05 ? "About the same" : mult >= 1.5 || mult <= 0.67 ? (mult >= 1 ? `${mult.toFixed(1)}× higher` : `${(1 / mult).toFixed(1)}× lower`) : `${ch > 0 ? "+" : "−"}${Math.abs(ch * 100).toFixed(0)}%`;
        const ico = Math.abs(ch) < 0.05 ? "●" : ch > 0 ? "▲" : "▼";
        tag = `<span class="change"><span class="ico" aria-hidden="true">${ico}</span> ${change}</span>`;
      }
      return `<article class="card score">
        <h3>${c.label}</h3><p class="sub">${sub}</p>
        <div class="pair">
          <div><span class="yr t-then">${then}</span><span class="num">${c.f(a)}</span></div>
          <div><span class="yr t-now">${now}</span><span class="num">${c.f(b)}</span></div>
        </div>
        <div class="foot">${tag || '<span class="muted small">No data for one of these years</span>'}</div>
      </article>`;
    }).join("");
    $("#scoregrid").innerHTML = html;

    const pti = [M.pti(then), M.pti(now)], sy = [M.saveYears(then), M.saveYears(now)], ps = [M.payShare(then), M.payShare(now)];
    $("#verdict").innerHTML = `<div class="verdict-num"><span class="big"><span class="t-then">${fmt1(pti[0], "×")}</span> → <span class="t-now">${fmt1(pti[1], "×")}</span></span><span>median home price ÷ median income</span></div>
      <div class="verdict-text"><p class="headline">${then} vs ${now} at a glance</p>
      <p>In ${then} the median home cost <b>${fmt1(pti[0], "×")}</b> the median yearly income. In ${now} it cost <b>${fmt1(pti[1], "×")}</b>.
      Saving ${state.dp * 100}% down at ${state.save * 100}% of income took about <b>${fmt1(sy[0], " years")}</b> in ${then} and <b>${fmt1(sy[1], " years")}</b> in ${now}.
      ${ok(...ps) ? `The monthly mortgage payment took <b>${fmtPct(ps[0])}</b> of income in ${then} and <b>${fmtPct(ps[1])}</b> in ${now}.` : ""}</p></div>`;
  }

  // ---------- charts ----------
  const markerPlugin = {
    id: "genMarkers",
    afterDatasetsDraw(chart) {
      const opts = chart.options.plugins.genMarkers;
      if (!opts || !opts.show) return;
      const { ctx, chartArea: a, scales: { x } } = chart;
      const t = tokens(), { then, now } = years();
      [[then, t.then], [now, t.now]].forEach(([yr, col]) => {
        const px = x.getPixelForValue(yr);
        if (px < a.left || px > a.right) return;
        ctx.save();
        ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
        ctx.globalAlpha = 1;
        // dot on first dataset where data exists
        chart.data.datasets.forEach((ds, di) => {
          if (ds.noMarker) return;
          const pt = ds.data.find((p) => p.x === yr);
          if (!pt || pt.y == null || chart.getDatasetMeta(di).hidden) return;
          const py = chart.scales.y.getPixelForValue(pt.y);
          ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = t.surface; ctx.stroke();
        });
        ctx.fillStyle = col; ctx.font = "600 11px system-ui, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(String(yr), px, a.top - 4);
        ctx.restore();
      });
    },
  };

  function series(fn, from = 1963, to = last) {
    const out = [];
    for (let y = from; y <= to; y++) { const val = fn(y); if (ok(val)) out.push({ x: y, y: val }); }
    return out;
  }

  function lineChart(id, datasets, yFmt, extra = {}) {
    const t = tokens();
    const cfg = {
      type: "line",
      data: { datasets: datasets.map((d) => ({ borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 12, tension: 0.2, spanGaps: false, parsing: false, ...d })) },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        layout: { padding: { top: 16 } },
        interaction: { mode: "index", intersect: false, axis: "x" },
        scales: {
          x: { type: "linear", min: extra.xMin ?? 1965, max: extra.xMax ?? Y[Y.length - 1], ticks: { color: t.text2, callback: (val) => String(val), maxTicksLimit: 8, precision: 0 }, grid: { display: false }, border: { color: t.grid } },
          y: { beginAtZero: extra.zero ?? true, ticks: { color: t.text2, callback: yFmt, maxTicksLimit: 6 }, grid: { color: t.grid }, border: { display: false } },
        },
        plugins: {
          legend: { display: datasets.length > 1, position: "bottom", align: "start", labels: { color: t.text2, boxWidth: 12, boxHeight: 2, font: { size: 12 } } },
          tooltip: { backgroundColor: t.surface, titleColor: t.text, bodyColor: t.text2, borderColor: t.grid, borderWidth: 1, padding: 10,
            callbacks: { title: (items) => String(items[0].parsed.x), label: (c) => ` ${c.dataset.label}: ${(extra.tipFmt || yFmt)(c.parsed.y)}` } },
          genMarkers: { show: true },
        },
      },
      plugins: [markerPlugin],
    };
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), cfg);
  }

  function renderCharts() {
    if (typeof Chart === "undefined") { document.querySelectorAll(".chart").forEach((c) => (c.innerHTML = '<p class="muted small">Charts need the Chart.js library, which failed to load. The numbers above and the table below still work.</p>')); return; }
    const t = tokens(), { then } = years();
    const one = (label, data, color = t.line) => [{ label, data, borderColor: color, backgroundColor: color }];
    lineChart("cPti", one("Price ÷ income", series(M.pti, 1967)), (x) => x.toFixed(1) + "×");
    lineChart("cPay", one("Payment share", series(M.payShare, 1971)), (x) => Math.round(x) + "%", { tipFmt: (x) => x.toFixed(1) + "%" });
    lineChart("cSave", one("Years", series(M.saveYears, 1967)), (x) => x.toFixed(0) + " yrs", { tipFmt: (x) => x.toFixed(1) + " yrs" });
    lineChart("cRent", one("Rent share", series(M.rentShare, 1967)), (x) => Math.round(x) + "%", { tipFmt: (x) => x.toFixed(1) + "%" });
    lineChart("cRate", one("Rate", series(M.rate, 1971)), (x) => x.toFixed(0) + "%", { tipFmt: (x) => x.toFixed(2) + "%" });

    const ix = (fn) => { const b0 = fn(then); return (y) => (ok(fn(y), b0) ? fn(y) / b0 * 100 : null); };
    lineChart("cReal", [
      { label: "Home price (after inflation)", data: series(ix(M.price), 1967), borderColor: t.line, backgroundColor: t.line },
      { label: "Household income (after inflation)", data: series(ix(M.income), 1967), borderColor: t.c3, backgroundColor: t.c3 },
    ], (x) => Math.round(x), { zero: false });

    lineChart("cOwn", [
      { label: "All ages", data: series(M.ownAll, 1965), borderColor: t.line, backgroundColor: t.line },
      { label: "Under 35", data: series(M.own35, 1994), borderColor: t.c3, backgroundColor: t.c3 },
    ], (x) => Math.round(x) + "%", { zero: false, tipFmt: (x) => x.toFixed(1) + "%" });

    const px = (k) => (y) => v(k, y);
    lineChart("cProd", [
      { label: "Productivity (output per hour)", data: series(ix(px("productivity")), 1965), borderColor: t.line, backgroundColor: t.line },
      { label: "Real hourly compensation", data: series(ix(px("realComp")), 1965), borderColor: t.c3, backgroundColor: t.c3 },
    ], (x) => Math.round(x), { zero: false });

    lineChart("cMin", one("Real minimum wage", series(M.minReal, 1965)), (x) => "$" + x.toFixed(0), { tipFmt: (x) => "$" + x.toFixed(2) });
    lineChart("cMinRent", one("Hours of work", series(M.minRentHours, 1965)), (x) => Math.round(x) + " h", { tipFmt: (x) => x.toFixed(0) + " hours" });
    lineChart("cSaveRate", one("Saving rate", series(M.saveRate, 1965)), (x) => Math.round(x) + "%", { tipFmt: (x) => x.toFixed(1) + "%" });
    lineChart("cDebt", one("Student debt", series((y) => (ok(v("studentDebt", y)) ? toToday(v("studentDebt", y), y) / 1e6 : null), 2006)),
      (x) => "$" + x.toFixed(1) + "T", { xMin: 2005, tipFmt: (x) => "$" + x.toFixed(2) + " trillion" });

    renderGrowth();
  }

  // growth-by-category bar chart
  const GROWTH = [
    { k: "homePrice", label: "Median home price", kind: "cost" },
    { k: "rentIdx", label: "Rent", kind: "cost" },
    { k: "tuitionIdx", label: "College tuition & childcare", kind: "cost" },
    { k: "medicalIdx", label: "Medical care", kind: "cost" },
    { k: "foodIdx", label: "Food", kind: "cost" },
    { k: "gasIdx", label: "Gasoline", kind: "cost" },
    { k: "carIdx", label: "New cars", kind: "cost" },
    { k: "apparelIdx", label: "Clothing", kind: "cost" },
    { k: "cpi", label: "All prices (CPI)", kind: "ref" },
    { k: "youngIncome", label: "Income, households 25–34", kind: "pay" },
    { k: "hhIncome", label: "Income, all households", kind: "pay" },
    { k: "hourlyWage", label: "Avg hourly wage (non-managers)", kind: "pay" },
    { k: "minWage", label: "Federal minimum wage", kind: "pay" },
  ];

  function renderGrowth() {
    const t = tokens(), { then, now } = years();
    const rows = GROWTH.map((g) => ({ ...g, a: v(g.k, then), b: v(g.k, now) }))
      .filter((r) => ok(r.a, r.b)).map((r) => ({ ...r, g: (r.b / r.a - 1) * 100 }))
      .sort((p, q) => q.g - p.g);
    const color = (r) => (r.kind === "pay" ? t.c3 : r.kind === "ref" ? t.muted : t.c7);
    const cpiG = rows.find((r) => r.k === "cpi");
    const inc = rows.find((r) => r.k === (state.basis === "young" ? "youngIncome" : "hhIncome"));
    $("#costSub").innerHTML = `Nominal price change from <b class="t-then">${then}</b> to <b class="t-now">${now}</b>. Purple bars are costs, green bars are pay and the gray bar is overall inflation. Anything that grew faster than income takes a bigger share of a paycheck in the later year.` +
      (cpiG && inc ? ` Overall prices rose <b>${Math.round(cpiG.g)}%</b> and income rose <b>${Math.round(inc.g)}%</b>.` : "") +
      (then < 1978 ? " <span class=\"muted\">Tuition data starts in 1978.</span>" : "");
    const cfg = {
      type: "bar",
      data: { labels: rows.map((r) => r.label), datasets: [{ data: rows.map((r) => r.g), backgroundColor: rows.map(color), borderRadius: 4, borderSkipped: "start", barPercentage: 0.72, categoryPercentage: 0.9 }] },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          x: { ticks: { color: t.text2, callback: (x) => x + "%" }, grid: { color: t.grid }, border: { display: false } },
          y: { ticks: { color: t.text, font: { size: 12 } }, grid: { display: false }, border: { color: t.grid } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: t.surface, titleColor: t.text, bodyColor: t.text2, borderColor: t.grid, borderWidth: 1, padding: 10,
            callbacks: { label: (c) => { const r = rows[c.dataIndex]; return ` ${c.parsed.x >= 0 ? "+" : ""}${Math.round(c.parsed.x)}% (${(r.b / r.a).toFixed(1)}× the ${then} level)`; } } },
          genMarkers: { show: false },
        },
      },
      plugins: [{
        id: "barLabels",
        afterDatasetsDraw(chart) {
          const { ctx } = chart, meta = chart.getDatasetMeta(0);
          ctx.save(); ctx.font = "600 11px system-ui, sans-serif"; ctx.fillStyle = t.text2; ctx.textBaseline = "middle";
          meta.data.forEach((bar, i) => { const val = rows[i].g; ctx.textAlign = val >= 0 ? "left" : "right"; ctx.fillText(`${val >= 0 ? "+" : ""}${Math.round(val)}%`, bar.x + (val >= 0 ? 6 : -6), bar.y); });
          ctx.restore();
        },
      }],
    };
    cfg.options.layout = { padding: { right: 48 } };
    if (charts.cGrowth) charts.cGrowth.destroy();
    charts.cGrowth = new Chart(document.getElementById("cGrowth"), cfg);
  }

  // ---------- key changes ----------
  function renderPoints() {
    const { then, now } = years();
    const H = [], P = [];
    const pct = (a, b) => Math.round((b / a - 1) * 100);
    const moved = (a, b, up = "rose", down = "fell") => (b >= a ? up : down);
    const gi = pct(income(then), income(now));

    const pti = [M.pti(then), M.pti(now)];
    if (ok(...pti)) H.push(`The median home cost <b>${pti[0].toFixed(1)}</b> years of median income in ${then} and <b>${pti[1].toFixed(1)}</b> years in ${now}.`);
    const r = [M.rate(then), M.rate(now)];
    if (ok(...r)) H.push(`The average 30-year mortgage rate was <b>${r[0].toFixed(1)}%</b> in ${then} and <b>${r[1].toFixed(1)}%</b> in ${now}.`);
    const ps = [M.payShare(then), M.payShare(now)];
    if (ok(...ps)) H.push(`A monthly mortgage payment on the median home took <b>${ps[0].toFixed(0)}%</b> of income in ${then} and <b>${ps[1].toFixed(0)}%</b> in ${now}.`);
    const sy = [M.saveYears(then), M.saveYears(now)];
    if (ok(...sy)) H.push(`Saving a ${state.dp * 100}% down payment at ${state.save * 100}% of income took about <b>${sy[0].toFixed(1)} years</b> in ${then} and <b>${sy[1].toFixed(1)} years</b> in ${now}.`);
    const rs = [M.rentShare(then), M.rentShare(now)];
    if (ok(...rs)) H.push(`Median rent took <b>${rs[0].toFixed(0)}%</b> of income in ${then} and <b>${rs[1].toFixed(0)}%</b> in ${now}.`);
    const o = [M.own35(then), M.own35(now)];
    if (ok(...o)) H.push(`Among householders under 35, <b>${o[0].toFixed(1)}%</b> owned a home in ${then} and <b>${o[1].toFixed(1)}%</b> in ${now}.`);
    const peak = series(M.payShare, 1971).reduce((m, p) => (p.y > m.y ? p : m), { y: 0 });
    if (peak.x) H.push(`The highest mortgage payment burden in the data was in <b>${peak.x}</b>, when payments took ${peak.y.toFixed(0)}% of income and rates averaged about ${M.rate(peak.x).toFixed(0)}%.`);

    const inc = [M.income(then), M.income(now)];
    if (ok(...inc)) P.push(`After inflation, median income ${moved(...inc)} <b>${Math.abs(pct(...inc))}%</b>, from ${fmtK(inc[0])} to ${fmtK(inc[1])} in ${base} dollars.`);
    const names = { tuitionIdx: "Tuition and childcare", medicalIdx: "Medical care", rentIdx: "Rent", foodIdx: "Food", carIdx: "New car", apparelIdx: "Clothing" };
    const rows = Object.keys(names).map((k) => ({ k, g: pct(v(k, then), v(k, now)) })).filter((x) => ok(x.g));
    const faster = rows.filter((x) => x.g > gi), slower = rows.filter((x) => x.g <= gi);
    if (ok(gi)) {
      if (faster.length) P.push(`Prices that rose faster than income (${gi}%): ${faster.map((x) => `${names[x.k].toLowerCase()} <b>${x.g}%</b>`).join(", ")}.`);
      if (slower.length) P.push(`Prices that rose slower than income (${gi}%): ${slower.map((x) => `${names[x.k].toLowerCase()} <b>${x.g}%</b>`).join(", ")}.`);
    }
    const pr = [v("productivity", then), v("productivity", now)], rc = [v("realComp", then), v("realComp", now)];
    if (ok(...pr, ...rc)) P.push(`Output per hour of work ${moved(...pr)} ${Math.abs(pct(...pr))}%, and real hourly compensation ${moved(...rc)} ${Math.abs(pct(...rc))}%.`);
    const mw = [M.minReal(then), M.minReal(now)];
    if (ok(...mw)) P.push(`After inflation, the federal minimum wage was $${mw[0].toFixed(2)} in ${then} and $${mw[1].toFixed(2)} in ${now} (${base} dollars).`);
    const sr = [M.saveRate(then), M.saveRate(now)];
    if (ok(...sr)) P.push(`The personal saving rate was ${sr[0].toFixed(1)}% in ${then} and ${sr[1].toFixed(1)}% in ${now}.`);
    $("#housingPoints").innerHTML = H.map((x) => `<li>${x}</li>`).join("") || "<li>No data for this pair of years.</li>";
    $("#payPoints").innerHTML = P.map((x) => `<li>${x}</li>`).join("") || "<li>No data for this pair of years.</li>";
  }

  // ---------- table + sources ----------
  function renderTable() {
    const cols = [
      ["Year", (y) => y], ["Home price", (y) => fmtMoney(v("homePrice", y))], ["Income", (y) => fmtMoney(income(y))],
      ["Price ÷ income", (y) => fmt1(M.pti(y), "×")], ["Mortgage rate", (y) => (M.rate(y) == null ? "n/a" : M.rate(y).toFixed(2) + "%")],
      ["Payment % income", (y) => fmtPct(M.payShare(y))], ["Years to save", (y) => fmt1(M.saveYears(y))],
      ["Rent/mo (est.)", (y) => fmtMoney(v("rent", y))], ["Rent % income", (y) => fmtPct(M.rentShare(y))],
      ["Own <35", (y) => fmtPct(M.own35(y))], ["Min wage", (y) => (v("minWage", y) == null ? "n/a" : "$" + v("minWage", y).toFixed(2))],
    ];
    const { then, now } = years();
    let h = `<thead><tr>${cols.map((c) => `<th scope="col">${c[0]}</th>`).join("")}</tr></thead><tbody>`;
    for (let y = last; y >= 1967; y--) h += `<tr class="${y === then ? "hl-then" : y === now ? "hl-now" : ""}">${cols.map((c, i) => (i ? `<td>${c[1](y)}</td>` : `<th scope="row">${y}</th>`)).join("")}</tr>`;
    $("#dataTable").innerHTML = h + "</tbody>";
  }

  function renderSources() {
    const n = D.notes;
    $("#sourceList").innerHTML = Object.keys(n).map((k) => `<li><a href="${n[k].url}" rel="noopener">${n[k].source}</a>${n[k].id ? ` <span class="muted">(${n[k].id})</span>` : ""}</li>`).join("");
    $("#genDate").textContent = `Data downloaded ${D.generated}. Income figures run through ${last}.`;
    document.querySelectorAll(".baseYear").forEach((e) => (e.textContent = base));
  }

  // ---------- state & URL ----------
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    for (const k of Object.keys(state)) if (p.has(k)) state[k] = k === "basis" ? p.get(k) : Number(p.get(k));
  }
  function writeHash() {
    const p = new URLSearchParams(Object.entries(state).map(([k, val]) => [k, String(val)]));
    history.replaceState(null, "", "#" + p.toString());
  }
  function syncInputs() { for (const k of Object.keys(state)) { const el = $("#" + k); if (el) el.value = String(state[k]); } }

  function renderAll() { writeHash(); renderScore(); renderPoints(); renderTable(); renderCharts(); }

  async function init() {
    D = await (await fetch("data/data.json")).json();
    Y = D.years; S = D.series;
    const incYears = Y.filter((y) => ok(v("youngIncome", y), v("hhIncome", y), v("homePrice", y)));
    first = incYears[0]; last = incYears[incYears.length - 1];
    base = last; // "today's dollars" = latest full year of income data
    readHash(); syncInputs(); renderSources();
    for (const k of Object.keys(state)) {
      const el = $("#" + k);
      el.addEventListener("change", () => { state[k] = k === "basis" ? el.value : Number(el.value); renderAll(); });
    }
    document.querySelectorAll(".presets button").forEach((b) => b.addEventListener("click", () => {
      state.pBirth = Number(b.dataset.p); state.yBirth = Number(b.dataset.y); syncInputs(); renderAll();
    }));
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderCharts);
    renderAll();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();

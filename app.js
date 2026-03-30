const DATA_PATH = "hour.csv";

const LABELS = {
  season: { 1: "Spring", 2: "Summer", 3: "Fall", 4: "Winter" },
  weather: {
    1: "Clear",
    2: "Mist",
    3: "Light Rain",
    4: "Heavy Rain / Ice",
  },
  weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const WEATHER_TEMP_BINS = [[-8, 0], [0, 8], [8, 14], [14, 20], [20, 26], [26, 32], [32, 39]];
const WEATHER_HUMIDITY_BINS = [[0, 40], [40, 55], [55, 70], [70, 85], [85, 100]];

const COLORS = {
  cnt: "#12344d",
  total: "#12344d",
  registered: "#1f8a9e",
  casual: "#ef8b3d",
  weatherUnified: "#5b8fa8",
  spring: "#7FAE8B",
  summer: "#9B6D47",
  fall: "#855e4e",
  winter: "#316290",
};

const state = {
  overviewMetric: "cnt",
  demandMetric: "compare",
  demandDayType: "all",
  hourStart: 0,
  hourEnd: 23,
  weatherSeason: "all",
  weatherDayType: "all",
  weatherCondition: "1",
  seasonMetric: "cnt",
  seasonDayType: "all",
  selectedSeasons: new Set(["1", "2", "3", "4"]),
};

let dataset = [];
const page = document.body.dataset.page || "overview";
const tooltip = document.getElementById("tooltip");

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", debounce(renderCurrentPage, 120));

async function init() {
  renderLoadingState();
  try {
    const response = await fetch(DATA_PATH);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    dataset = preprocess(parseCSV(await response.text()));
    buildPageControls();
    renderCurrentPage();
  } catch (error) {
    renderLoadError(error);
    console.error(error);
  }
}

function renderLoadingState() {
  document.querySelectorAll(".chart-host, .preview-host").forEach((node) => {
    node.innerHTML = `<div class="loading-state">Loading dataset...</div>`;
  });
}

function renderLoadError(error) {
  document.querySelectorAll(".chart-host, .preview-host").forEach((node) => {
    node.innerHTML = `<div class="empty-state">Unable to load hour.csv. Run the site from a local server.</div>`;
  });
  const kpiGrid = document.getElementById("kpiGrid");
  if (kpiGrid) {
    kpiGrid.innerHTML = `<div class="empty-state">Dataset load failed: ${escapeHTML(error.message)}</div>`;
  }
}

function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = splitCSVRow(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCSVRow(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index];
      return row;
    }, {});
  });
}

function splitCSVRow(row) {
  const values = [];
  let current = "";
  let insideQuotes = false;
  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    if (char === '"') {
      if (insideQuotes && row[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function preprocess(rows) {
  return rows.map((row) => {
    const season = Number(row.season);
    const weathersit = Number(row.weathersit);
    const weekday = Number(row.weekday);
    const dteday = new Date(`${row.dteday}T00:00:00`);
    return {
      instant: Number(row.instant),
      dteday,
      season,
      seasonLabel: LABELS.season[season],
      hr: Number(row.hr),
      weekday,
      workingday: Number(row.workingday),
      weathersit,
      tempC: Number(row.temp) * 47 - 8,
      humidityPct: Number(row.hum) * 100,
      casual: Number(row.casual),
      registered: Number(row.registered),
      cnt: Number(row.cnt),
      monthKey: dteday.toISOString().slice(0, 7),
      monthLabel: dteday.toLocaleString("en-US", { month: "short", year: "numeric" }),
    };
  });
}

function buildPageControls() {
  if (document.getElementById("overviewMetricControl")) {
    buildSegmentedControl("overviewMetricControl", [["cnt", "Total"], ["registered", "Registered"], ["casual", "Casual"]], state.overviewMetric, (value) => {
      state.overviewMetric = value;
      renderOverviewPage();
    });
  }

  if (document.getElementById("demandMetricControl")) {
    buildSegmentedControl("demandMetricControl", [["compare", "All types"], ["cnt", "Total only"], ["registered", "Registered"], ["casual", "Casual"]], state.demandMetric, (value) => {
      state.demandMetric = value;
      renderDemandPage();
    });
    populateSelect("demandDayType", [["all", "All days"], ["working", "Working day"], ["nonworking", "Non-working day"]], state.demandDayType, (value) => {
      state.demandDayType = value;
      renderDemandPage();
    });

    const hourStartInput = document.getElementById("hourStart");
    const hourEndInput = document.getElementById("hourEnd");
    hourStartInput.addEventListener("input", (event) => {
      state.hourStart = Math.min(Number(event.target.value), state.hourEnd);
      hourStartInput.value = state.hourStart;
      renderDemandPage();
    });
    hourEndInput.addEventListener("input", (event) => {
      state.hourEnd = Math.max(Number(event.target.value), state.hourStart);
      hourEndInput.value = state.hourEnd;
      renderDemandPage();
    });
  }

  if (document.getElementById("weatherSeason")) {
    populateSelect("weatherSeason", [["all", "All seasons"], ["1", "Spring"], ["2", "Summer"], ["3", "Fall"], ["4", "Winter"]], state.weatherSeason, (value) => {
      state.weatherSeason = value;
      renderWeatherPage();
    });
    buildSegmentedControl("weatherDayTypeControl", [["all", "All days"], ["working", "Working day"], ["nonworking", "Non-working day"]], state.weatherDayType, (value) => {
      state.weatherDayType = value;
      renderWeatherPage();
    });
    buildSegmentedControl("weatherConditionControl", [["1", "Clear"], ["2", "Mist"], ["3", "Light Rain"], ["4", "Heavy Rain / Ice"]], state.weatherCondition, (value) => {
      state.weatherCondition = value;
      renderWeatherPage();
    });
  }

  if (document.getElementById("seasonMetricControl")) {
    buildSegmentedControl("seasonMetricControl", [["cnt", "Total"], ["registered", "Registered"], ["casual", "Casual"]], state.seasonMetric, (value) => {
      state.seasonMetric = value;
      renderSeasonPage();
    });
    populateSelect("seasonDayType", [["all", "All days"], ["working", "Working day"], ["nonworking", "Non-working day"]], state.seasonDayType, (value) => {
      state.seasonDayType = value;
      renderSeasonPage();
    });
    buildSeasonLegend();
  }
}

function renderCurrentPage() {
  if (!dataset.length) return;
  if (page === "overview") renderOverviewPage();
  if (page === "demand") renderDemandPage();
  if (page === "weather") renderWeatherPage();
  if (page === "season") renderSeasonPage();
}

function buildSegmentedControl(containerId, options, activeValue, onChange) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  options.forEach(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = value === activeValue ? "active" : "";
    button.setAttribute("aria-pressed", String(value === activeValue));
    button.addEventListener("click", () => {
      Array.from(container.children).forEach((child) => {
        child.classList.remove("active");
        child.setAttribute("aria-pressed", "false");
      });
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      onChange(value);
    });
    container.appendChild(button);
  });
}

function populateSelect(id, options, selectedValue, onChange) {
  const select = document.getElementById(id);
  select.innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  select.value = selectedValue;
  select.addEventListener("change", (event) => onChange(event.target.value));
}

function buildSeasonLegend() {
  const legend = document.getElementById("seasonLegend");
  if (!legend) return;
  legend.innerHTML = "";
  [["1", "Spring", COLORS.spring], ["2", "Summer", COLORS.summer], ["3", "Fall", COLORS.fall], ["4", "Winter", COLORS.winter]].forEach(([value, label, color]) => {
    const button = document.createElement("button");
    const isActive = state.selectedSeasons.has(value);
    button.type = "button";
    button.className = `legend-pill season-pill ${isActive ? "active" : "inactive"}`;
    button.style.setProperty("--season-color", color);
    button.style.setProperty("--season-tint", hexToRgba(color, 0.18));
    button.style.setProperty("--season-outline", hexToRgba(color, 0.34));
    button.innerHTML = `
      <span class="season-pill-top">
        <span class="season-swatch" aria-hidden="true"></span>
        <span class="season-pill-label">${label}</span>
      </span>
      <span class="season-pill-state"></span>
    `;
    updateSeasonLegendButtonState(button, isActive);
    button.addEventListener("click", () => {
      if (state.selectedSeasons.has(value) && state.selectedSeasons.size > 1) {
        state.selectedSeasons.delete(value);
      } else if (!state.selectedSeasons.has(value)) {
        state.selectedSeasons.add(value);
      }
      const isActive = state.selectedSeasons.has(value);
      button.classList.toggle("active", isActive);
      button.classList.toggle("inactive", !isActive);
      updateSeasonLegendButtonState(button, isActive);
      renderSeasonPage();
    });
    legend.appendChild(button);
  });
}

function updateSeasonLegendButtonState(button, isActive) {
  button.setAttribute("aria-pressed", String(isActive));
  if (isActive) {
    button.classList.add("active");
    button.classList.remove("inactive");
    button.querySelector(".season-pill-state").textContent = "On";
    return;
  }

  button.classList.remove("active");
  button.classList.add("inactive");
  button.querySelector(".season-pill-state").textContent = "Off";
}

function renderOverviewPage() {
  renderOverviewKpis();
  renderOverviewTrend();
  renderStoryPreviews();
}

function renderOverviewKpis() {
  const kpiGrid = document.getElementById("kpiGrid");
  if (!kpiGrid) return;

  const total = sum(dataset, "cnt");
  const registered = sum(dataset, "registered");
  const casual = sum(dataset, "casual");
  const peakHour = Object.entries(groupBy(dataset, (row) => row.hr, (group) => sum(group, "cnt"))).sort((a, b) => b[1] - a[1])[0];
  const topSeason = Object.entries(groupBy(dataset, (row) => row.seasonLabel, (group) => sum(group, "cnt"))).sort((a, b) => b[1] - a[1])[0];

  const cards = [
    {
      label: "Total rentals",
      value: formatNumber(total),
      detail: "All recorded hourly rentals across the dataset.",
      note: "Click to view chart",
      href: "demand.html#hourly-demand",
    },
    {
      label: "Registered rentals",
      value: formatNumber(registered),
      detail: `${formatPercent(registered / total)} of total demand comes from registered riders.`,
      note: "Click to view chart",
      href: "demand.html#weekday-demand",
    },
    {
      label: "Casual rentals",
      value: formatNumber(casual),
      detail: `${formatPercent(casual / total)} of demand comes from casual riders.`,
      note: "Click to view chart",
      href: "demand.html#weekday-demand",
    },
    {
      label: "Peak hour",
      value: formatHourTick(peakHour[0]),
      detail: `${formatNumber(peakHour[1])} rentals occur at the strongest hour.`,
      note: "Click to view chart",
      href: "demand.html#hourly-demand",
    },
    {
      label: "Highest-demand season",
      value: topSeason[0],
      detail: `${formatNumber(topSeason[1])} rentals make this the strongest season.`,
      note: "Click to view chart",
      href: "season.html#season-ranking",
    },
  ];

  kpiGrid.innerHTML = cards.map((item) => `
    <a class="kpi-card interactive-card" href="${item.href}">
      <p class="label">${item.label}</p>
      <p class="value">${item.value}</p>
      <p class="detail">${item.detail}</p>
      <p class="link-note">${item.note}</p>
    </a>
  `).join("");
}

function renderOverviewTrend() {
  if (!document.getElementById("overviewChart")) return;
  const monthlyMap = new Map();
  dataset.forEach((row) => {
    const current = monthlyMap.get(row.monthKey) || { label: row.monthLabel, value: 0 };
    current.value += row[state.overviewMetric];
    monthlyMap.set(row.monthKey, current);
  });
  const monthlySeries = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, item]) => item);

  renderLineChart({
    containerId: "overviewChart",
    series: [{ name: metricLabel(state.overviewMetric), values: monthlySeries, color: COLORS[state.overviewMetric] }],
    yFormat: formatTickValue,
    tooltipFormatter: (point) => `<strong>${point.label}</strong>${metricLabel(state.overviewMetric)}: ${formatNumber(point.value)}`,
    xTitle: "Month",
    yTitle: metricLabel(state.overviewMetric),
    area: true,
    tickCount: 5,
    xLabelStep: 4,
    xLabelFormatter: (label) => formatOverviewMonthLabel(label),
    legendAlign: "none",
  });
}

function renderStoryPreviews() {
  renderMiniMultiLinePreview("storyPreviewDemand", [
    { color: COLORS.total, values: averageByHour(dataset, "cnt") },
    { color: COLORS.registered, values: averageByHour(dataset, "registered") },
    { color: COLORS.casual, values: averageByHour(dataset, "casual") },
  ]);

  renderMiniBarPreview("storyPreviewWeather", [1, 2, 3, 4].map((condition) => {
    const rows = dataset.filter((row) => row.weathersit === condition);
    return { color: COLORS.weatherUnified, value: average(rows, "cnt") };
  }));

  renderMiniBarPreview("storyPreviewSeason", [1, 2, 3, 4].map((season) => {
    const rows = dataset.filter((row) => row.season === season);
    return { color: seasonColor(String(season)), value: sum(rows, "cnt") };
  }));
}

function buildHourlyRentalGroups(rows, hourStart, hourEnd) {
  const groups = new Map(Array.from({ length: hourEnd - hourStart + 1 }, (_, index) => {
    const hour = hourStart + index;
    return [hour, { label: `${hour}:00`, total: 0, registered: 0, casual: 0 }];
  }));

  rows.forEach((row) => {
    const group = groups.get(row.hr);
    if (!group) return;
    group.total += row.cnt;
    group.registered += row.registered;
    group.casual += row.casual;
  });

  return Array.from(groups.values());
}

function buildWeekdayRentalGroups(rows) {
  const groups = LABELS.weekday.map((day) => ({ label: day, total: 0, registered: 0, casual: 0 }));

  rows.forEach((row) => {
    const group = groups[row.weekday];
    group.total += row.cnt;
    group.registered += row.registered;
    group.casual += row.casual;
  });

  return groups;
}

function metricGroupKey(metric) {
  return metric === "cnt" || metric === "compare" ? "total" : metric;
}

function buildSharedSeriesTooltip(label, series, valueFormatter) {
  const lines = series.map((item) => {
    const point = item.values.find((entry) => entry.label === label);
    return `<br><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px;"></span>${item.name}: ${valueFormatter(point?.value ?? 0)}`;
  });
  return `<strong>${formatHourTick(label.replace(":00", ""))}</strong>${lines.join("")}`;
}

function demandYAxisTitle(metric) {
  return metric === "compare" ? "Rentals" : metricLabel(metric);
}

function demandInsightHeadline(peakGroup, metric) {
  const formattedHour = formatHourTick(peakGroup.label.replace(":00", ""));

  if (metric === "registered") {
    return `${formattedHour} has the highest registered rentals in the current view.`;
  }

  if (metric === "casual") {
    return `${formattedHour} has the highest casual rentals in the current view.`;
  }

  return `${formattedHour} is the peak demand hour in the current view.`;
}

function renderDemandPage() {
  if (!document.getElementById("demandHourlyChart")) return;
  const rows = filterRows(dataset, { dayType: state.demandDayType, hourStart: state.hourStart, hourEnd: state.hourEnd });
  document.getElementById("hourRangeLabel").textContent = `${formatHourTick(state.hourStart)} to ${formatHourTick(state.hourEnd)}`;

  const hourlyGroups = buildHourlyRentalGroups(rows, state.hourStart, state.hourEnd);
  const weekdayGroups = buildWeekdayRentalGroups(rows);

  const lineSeries = state.demandMetric === "compare"
    ? [
        { name: "Total", values: hourlyGroups.map((item) => ({ label: item.label, value: item.total })), color: COLORS.total },
        { name: "Registered", values: hourlyGroups.map((item) => ({ label: item.label, value: item.registered })), color: COLORS.registered },
        { name: "Casual", values: hourlyGroups.map((item) => ({ label: item.label, value: item.casual })), color: COLORS.casual },
      ]
    : [{ name: metricLabel(state.demandMetric), values: hourlyGroups.map((item) => ({ label: item.label, value: item[state.demandMetric === "cnt" ? "total" : state.demandMetric] })), color: COLORS[state.demandMetric] }];

  renderLineChart({
    containerId: "demandHourlyChart",
    series: lineSeries,
    yFormat: formatTickValue,
    tooltipFormatter: (point, seriesName) => `<strong>${formatHourTick(point.label.replace(':00', ''))}</strong>${seriesName}: ${formatNumber(point.value)} rentals`,
    sharedTooltipFormatter: state.demandMetric === "compare" ? (label) => buildSharedSeriesTooltip(label, lineSeries, (value) => `${formatNumber(value)} rentals`) : null,
    xTitle: "Hour of day",
    yTitle: demandYAxisTitle(state.demandMetric),
    xLabelStep: state.hourEnd - state.hourStart > 12 ? 2 : 1,
    xLabelFormatter: (_label, index) => formatHourTick(state.hourStart + index),
    xTickOffset: 24,
    xTitleOffset: 72,
    legendAlign: "center",
  });

  renderGroupedBarChart({
    containerId: "demandWeekdayChart",
    categories: weekdayGroups.map((item) => item.label),
    series: [
      { name: "Registered", color: COLORS.registered, values: weekdayGroups.map((item) => item.registered) },
      { name: "Casual", color: COLORS.casual, values: weekdayGroups.map((item) => item.casual) },
    ],
    yFormat: formatRoundedK,
    tooltipFormatter: ({ category, seriesName, value }) => `<strong>${category}</strong>${seriesName}: ${formatNumber(value)} rentals`,
    xTitle: "Day of week",
    yTitle: "Rentals",
    xTickOffset: 26,
    xTitleOffset: 76,
    xLabelFormatter: (label) => formatWeekdayTick(label),
    legendAlign: "center",
    maxYOverride: 450000,
    tickCount: 3,
  });

  const peak = hourlyGroups.reduce((best, current) => current[metricGroupKey(state.demandMetric)] > best[metricGroupKey(state.demandMetric)] ? current : best, hourlyGroups[0]);
  const totalRentals = Math.max(sum(rows, "cnt"), 1);
  const registeredShare = sum(rows, "registered") / totalRentals;
  const casualShare = sum(rows, "casual") / totalRentals;
  setInsight("demandInsight", demandInsightHeadline(peak, state.demandMetric), getDemandInsightCopy(registeredShare, casualShare));
  setDemandWeekdayContext();
}

function getDemandInsightCopy(registeredShare, casualShare) {
  if (state.demandMetric === "registered") {
    return `Registered riders contribute ${formatPercent(registeredShare)} of rentals in this filtered view, showing how strongly the registered segment drives demand here.`;
  }

  if (state.demandMetric === "casual") {
    return `Casual riders contribute ${formatPercent(casualShare)} of rentals in this filtered view, highlighting where casual demand is most visible in the mix.`;
  }

  if (state.demandMetric === "cnt") {
    const dominantLabel = registeredShare >= casualShare ? "Registered" : "Casual";
    const dominantShare = Math.max(registeredShare, casualShare);
    return `${dominantLabel} riders account for ${formatPercent(dominantShare)} of rentals here, which explains which rider group is doing most of the work behind total demand.`;
  }

  return `Registered riders contribute ${formatPercent(registeredShare)} of rentals here, while casual riders contribute ${formatPercent(casualShare)}. This keeps the rider-mix story anchored in total demand.`;
}

function setDemandWeekdayContext() {
  const note = document.getElementById("demandWeekdayContext");
  if (!note) return;

  if (state.demandDayType === "working") {
    note.textContent = "Notes: workingday = Monday to Friday, so weekend categories have no records in this filtered view.";
    return;
  }

  if (state.demandDayType === "nonworking") {
    note.textContent = "Notes: Non-working day includes weekends and holidays, so some weekday bars appear because holidays can fall on Monday to Friday.";
    return;
  }

  note.textContent = "Notes: All days combine standard workdays, weekends, and holidays unless you filter by day type.";
}

function renderWeatherPage() {
  if (!document.getElementById("weatherHeatmap")) return;
  const filteredRows = filterRows(dataset, { season: state.weatherSeason, dayType: state.weatherDayType });
  const heatmapRows = filteredRows.filter((row) => String(row.weathersit) === state.weatherCondition);
  const heatmapData = [];

  WEATHER_TEMP_BINS.forEach((tempBin, tempIndex) => {
    WEATHER_HUMIDITY_BINS.forEach((humidityBin, humidityIndex) => {
      const cellRows = heatmapRows.filter((row) => isValueInBin(row.tempC, tempBin, tempIndex === WEATHER_TEMP_BINS.length - 1)
        && isValueInBin(row.humidityPct, humidityBin, humidityIndex === WEATHER_HUMIDITY_BINS.length - 1));
      heatmapData.push({
        x: formatRangeLabel(tempBin, "°C"),
        y: formatRangeLabel(humidityBin, "%"),
        value: average(cellRows, "cnt"),
        count: cellRows.length,
      });
    });
  });

  renderHeatmap({
    containerId: "weatherHeatmap",
    columns: WEATHER_TEMP_BINS.map((bin) => formatRangeLabel(bin, "°C")),
    rows: WEATHER_HUMIDITY_BINS.map((bin) => formatRangeLabel(bin, "%")),
    cells: heatmapData,
    tooltipFormatter: (cell) => `<strong>${cell.x} / ${cell.y}</strong>Average rentals: ${cell.value ? cell.value.toFixed(1) : "No data"}<br>Hourly records: ${cell.count}`,
  });

  const weatherComparison = [1, 2, 3, 4].map((condition) => {
    const rows = filteredRows.filter((row) => row.weathersit === condition);
    return { label: LABELS.weather[condition], value: average(rows, "cnt"), color: COLORS.weatherUnified };
  });

  renderSingleBarChart({
    containerId: "weatherBarChart",
    data: weatherComparison,
    yFormat: formatRoundedWeatherTick,
    tooltipFormatter: (item) => `<strong>${item.label}</strong>${item.value.toFixed(1)} average rentals`,
    xTitle: "Weather condition",
    yTitle: "Average rentals per hour",
    xTickOffset: 26,
    xTitleOffset: 76,
    xLabelFormatter: (label) => formatWeatherTick(label),
    yTitleX: 22,
    maxYOverride: 250,
    tickCount: 5,
  });

  const selectedCondition = weatherComparison.find((item) => item.label === LABELS.weather[state.weatherCondition]);
  const strongestCondition = weatherComparison.reduce((best, current) => current.value > best.value ? current : best, weatherComparison[0]);
  const comparisonCopy = selectedCondition.label === strongestCondition.label
    ? `${selectedCondition.label} has the highest average rentals in the filtered comparison.`
    : `${selectedCondition.label} averages ${selectedCondition.value.toFixed(1)} rentals here, versus ${strongestCondition.value.toFixed(1)} for ${strongestCondition.label}.`;
  setInsight("weatherInsight", `${selectedCondition.label} conditions are in focus.`, `${comparisonCopy} The comfort chart shows which temperature-humidity combinations support demand under this selected weather condition.`);
}

function renderSeasonPage() {
  if (!document.getElementById("seasonBarChart")) return;
  const rows = filterRows(dataset, { dayType: state.seasonDayType });
  const seasonData = [1, 2, 3, 4].map((season) => {
    const seasonRows = rows.filter((row) => row.season === season);
    return { label: LABELS.season[season], value: sum(seasonRows, state.seasonMetric), color: seasonColor(String(season)) };
  });

  renderSingleBarChart({
    containerId: "seasonBarChart",
    data: seasonData,
    yFormat: formatCompact,
    tooltipFormatter: (item) => `<strong>${item.label}</strong>${metricLabel(state.seasonMetric)}: ${formatNumber(item.value)}`,
    xTitle: "Season",
    yTitle: metricLabel(state.seasonMetric),
  });

  const lineSeries = [1, 2, 3, 4].filter((season) => state.selectedSeasons.has(String(season))).map((season) => ({
    name: LABELS.season[season],
    color: seasonColor(String(season)),
    values: Array.from({ length: 24 }, (_, hour) => {
      const group = rows.filter((row) => row.season === season && row.hr === hour);
      return { label: `${hour}:00`, value: average(group, state.seasonMetric) };
    }),
  }));

  renderLineChart({
    containerId: "seasonHourlyChart",
    series: lineSeries,
    yFormat: (value) => value.toFixed(0),
    tooltipFormatter: (point, seriesName) => `<strong>${seriesName}</strong>${formatHourTick(point.label.replace(':00', ''))}: ${point.value.toFixed(1)} average rentals`,
    sharedTooltipFormatter: (label) => buildSharedSeriesTooltip(label, lineSeries, (value) => `${value.toFixed(1)} average rentals`),
    xTitle: "Hour of day",
    yTitle: "Average rentals per hour",
    xLabelStep: 2,
    xLabelFormatter: (_label, index) => formatHourTick(index),
    xTickOffset: 24,
    xTitleOffset: 72,
    marginLeft: 70,
    yTitleX: 22,
    legendAlign: "none",
  });

  const topSeason = seasonData.reduce((best, current) => current.value > best.value ? current : best, seasonData[0]);
  const runnerUp = seasonData.filter((item) => item.label !== topSeason.label).reduce((best, current) => current.value > best.value ? current : best, seasonData.find((item) => item.label !== topSeason.label));
  setInsight(
    "seasonInsight",
    `${topSeason.label} leads ${metricLabel(state.seasonMetric).toLowerCase()}.`,
    `${metricLabel(state.seasonMetric)} reaches ${formatNumber(topSeason.value)} in ${topSeason.label}, ahead of ${formatNumber(runnerUp.value)} in ${runnerUp.label}. The hourly profile shows where that seasonal advantage appears during the day.`,
  );
}

function setInsight(containerId, headline, copy) {
  const node = document.getElementById(containerId);
  if (!node) return;
  node.innerHTML = `<p class="headline">${headline}</p><p class="copy">${copy}</p>`;
}

function renderLineChart({ containerId, series, yFormat, tooltipFormatter, sharedTooltipFormatter = null, xTitle, yTitle, area = false, tickCount = 4, xLabelStep = 1, xLabelFormatter = (label) => label, xTickOffset = 22, xTitleOffset = 60, yTitleX = 22, marginLeft = 70, legendAlign = "left" }) {
  const container = document.getElementById(containerId);
  if (!container || !series.length) {
    if (container) container.innerHTML = `<div class="empty-state">No data available for this view.</div>`;
    return;
  }

  const { width, height } = getChartSize(container, 420, 320);
  const margin = { top: legendAlign === "center" ? 54 : 20, right: 18, bottom: 84, left: marginLeft };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const allPoints = series.flatMap((item) => item.values.map((point) => point.value));
  const maxY = getNiceMax(Math.max(...allPoints, 1), tickCount);
  const labels = series[0].values.map((point) => point.label);
  const stepX = labels.length > 1 ? chartWidth / (labels.length - 1) : chartWidth;

  let svg = svgStart(width, height);
  svg += drawGrid(chartWidth, chartHeight, margin, tickCount, yFormat, maxY);
  svg += drawAxes(margin, chartWidth, chartHeight, labels, xTitle, yTitle, xLabelStep, xLabelFormatter, xTickOffset, xTitleOffset, yTitleX);

  series.forEach((line) => {
    const coords = line.values.map((point, index) => ({ ...point, x: margin.left + index * stepX, y: margin.top + chartHeight - (point.value / maxY) * chartHeight }));
    if (area) {
      const areaPath = `${coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")} L ${margin.left + chartWidth} ${margin.top + chartHeight} L ${margin.left} ${margin.top + chartHeight} Z`;
      svg += `<path d="${areaPath}" fill="${hexToRgba(line.color, 0.16)}" stroke="none"></path>`;
    }
    svg += `<path d="${coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")}" fill="none" stroke="${line.color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"></path>`;
    coords.forEach((point) => {
      if (sharedTooltipFormatter) {
        svg += `<circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${line.color}" pointer-events="none"></circle>`;
        return;
      }

      svg += `<circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${line.color}" data-tooltip="${escapeHTML(tooltipFormatter(point, line.name))}"></circle>`;
    });
  });

  if (sharedTooltipFormatter) {
    labels.forEach((label, index) => {
      const bandStart = labels.length === 1
        ? margin.left
        : Math.max(margin.left, margin.left + index * stepX - stepX / 2);
      const bandEnd = labels.length === 1
        ? margin.left + chartWidth
        : Math.min(margin.left + chartWidth, margin.left + index * stepX + stepX / 2);
      svg += `<rect x="${bandStart}" y="${margin.top}" width="${bandEnd - bandStart}" height="${chartHeight}" fill="transparent" data-tooltip="${escapeHTML(sharedTooltipFormatter(label, index))}"></rect>`;
    });
  }

  if (legendAlign !== "none") {
    svg += drawLegend(series, width, margin, legendAlign);
  }
  svg += "</svg>";
  container.innerHTML = svg;
  bindTooltip(container);
}

function renderGroupedBarChart({ containerId, categories, series, yFormat, tooltipFormatter, xTitle, yTitle, xTickOffset = 22, xTitleOffset = 60, xLabelFormatter = (label) => label, yTitleX = 22, marginLeft = 70, legendAlign = "left", maxYOverride = null, tickCount = 4 }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const { width, height } = getChartSize(container, 420, 320);
  const margin = { top: legendAlign === "center" ? 54 : 20, right: 18, bottom: 84, left: marginLeft };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const computedMax = getNiceMax(Math.max(...series.flatMap((item) => item.values), 1), tickCount);
  const maxY = maxYOverride ?? computedMax;
  const groupWidth = chartWidth / categories.length;
  const barWidth = Math.min(28, (groupWidth - 18) / series.length);
  const categoryCenters = categories.map((_, index) => margin.left + index * groupWidth + groupWidth / 2);

  let svg = svgStart(width, height);
  svg += drawGrid(chartWidth, chartHeight, margin, tickCount, yFormat, maxY);
  svg += drawAxes(margin, chartWidth, chartHeight, categories, xTitle, yTitle, 1, xLabelFormatter, xTickOffset, xTitleOffset, yTitleX, categoryCenters);

  categories.forEach((category, categoryIndex) => {
    const groupStart = margin.left + categoryIndex * groupWidth + (groupWidth - series.length * barWidth) / 2;
    series.forEach((item, seriesIndex) => {
      const value = item.values[categoryIndex];
      const barHeight = (value / maxY) * chartHeight;
      const x = groupStart + seriesIndex * barWidth;
      const y = margin.top + chartHeight - barHeight;
      svg += `<rect x="${x}" y="${y}" width="${barWidth - 4}" height="${barHeight}" rx="10" fill="${item.color}" data-tooltip="${escapeHTML(tooltipFormatter({ category, seriesName: item.name, value }))}"></rect>`;
    });
  });

  svg += drawLegend(series, width, margin, legendAlign);
  svg += "</svg>";
  container.innerHTML = svg;
  bindTooltip(container);
}

function renderSingleBarChart({ containerId, data, yFormat, tooltipFormatter, xTitle, yTitle, xTickOffset = 22, xTitleOffset = 60, xLabelFormatter = (label) => label, yTitleX = 22, marginLeft = 76, maxYOverride = null, tickCount = 4 }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const { width, height } = getChartSize(container, 420, 320);
  const margin = { top: 20, right: 18, bottom: 84, left: marginLeft };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const computedMax = getNiceMax(Math.max(...data.map((item) => item.value), 1), tickCount);
  const maxY = maxYOverride ?? computedMax;
  const barWidth = Math.min(72, chartWidth / data.length - 22);
  const slotWidth = chartWidth / data.length;
  const categoryCenters = data.map((_, index) => margin.left + index * slotWidth + slotWidth / 2);

  let svg = svgStart(width, height);
  svg += drawGrid(chartWidth, chartHeight, margin, tickCount, yFormat, maxY);
  svg += drawAxes(margin, chartWidth, chartHeight, data.map((item) => item.label), xTitle, yTitle, 1, xLabelFormatter, xTickOffset, xTitleOffset, yTitleX, categoryCenters);
  data.forEach((item, index) => {
    const x = margin.left + index * slotWidth + (slotWidth - barWidth) / 2;
    const barHeight = (item.value / maxY) * chartHeight;
    const y = margin.top + chartHeight - barHeight;
    svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="14" fill="${item.color}" data-tooltip="${escapeHTML(tooltipFormatter(item))}"></rect>`;
  });
  svg += "</svg>";
  container.innerHTML = svg;
  bindTooltip(container);
}

function renderHeatmap({ containerId, columns, rows, cells, tooltipFormatter }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const { width, height } = getChartSize(container, 460, 380);
  const margin = { top: 30, right: 18, bottom: 84, left: 88 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const cellWidth = chartWidth / columns.length;
  const cellHeight = chartHeight / rows.length;
  const maxValue = Math.max(...cells.map((item) => item.value), 1);

  let svg = svgStart(width, height);
  rows.forEach((rowLabel, rowIndex) => {
    const y = margin.top + rowIndex * cellHeight;
    svg += `<text x="${margin.left - 12}" y="${y + cellHeight / 2 + 4}" text-anchor="end" class="tick-text">${rowLabel}</text>`;
  });
  columns.forEach((columnLabel, columnIndex) => {
    const x = margin.left + columnIndex * cellWidth + cellWidth / 2;
    svg += `<text x="${x}" y="${height - 42}" text-anchor="middle" class="tick-text">${columnLabel}</text>`;
  });
  cells.forEach((cell) => {
    const xIndex = columns.indexOf(cell.x);
    const yIndex = rows.indexOf(cell.y);
    const x = margin.left + xIndex * cellWidth;
    const y = margin.top + yIndex * cellHeight;
    const fill = cell.count === 0 ? "#f3f6f9" : interpolateColor("#d8f0f3", "#12344d", cell.value / maxValue);
    svg += `<rect x="${x}" y="${y}" width="${cellWidth - 6}" height="${cellHeight - 6}" rx="14" fill="${fill}" data-tooltip="${escapeHTML(tooltipFormatter(cell))}"></rect>`;
    svg += `<text x="${x + cellWidth / 2 - 3}" y="${y + cellHeight / 2 + 5}" text-anchor="middle" fill="${cell.value / maxValue > 0.55 ? "#fff" : "#12344d"}" font-size="12" font-weight="800">${cell.count ? cell.value.toFixed(0) : "-"}</text>`;
  });
  svg += `<text x="${margin.left + chartWidth / 2}" y="${height - 12}" text-anchor="middle" class="axis-title">Temperature</text>`;
  svg += `<text x="22" y="${margin.top + chartHeight / 2}" text-anchor="middle" class="axis-title" transform="rotate(-90 22 ${margin.top + chartHeight / 2})">Humidity</text>`;
  svg += "</svg>";
  container.innerHTML = svg;
  bindTooltip(container);
}

function renderMiniMultiLinePreview(containerId, series) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const { width, height } = getChartSize(container, 260, 110);
  const padding = 12;
  const maxY = Math.max(...series.flatMap((item) => item.values), 1);
  const stepX = (width - padding * 2) / Math.max(series[0].values.length - 1, 1);
  let svg = svgStart(width, height);
  svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>`;
  series.forEach((line) => {
    const points = line.values.map((value, index) => ({
      x: padding + index * stepX,
      y: height - padding - (value / maxY) * (height - padding * 2),
    }));
    svg += `<path d="${points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")}" fill="none" stroke="${line.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>`;
  });
  svg += "</svg>";
  container.innerHTML = svg;
}

function renderMiniBarPreview(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const { width, height } = getChartSize(container, 260, 110);
  const padding = 14;
  const maxY = Math.max(...data.map((item) => item.value), 1);
  const slotWidth = (width - padding * 2) / data.length;
  const barWidth = Math.min(34, slotWidth - 10);
  let svg = svgStart(width, height);
  data.forEach((item, index) => {
    const barHeight = (item.value / maxY) * (height - padding * 2);
    const x = padding + index * slotWidth + (slotWidth - barWidth) / 2;
    const y = height - padding - barHeight;
    svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="10" fill="${item.color}"></rect>`;
  });
  svg += "</svg>";
  container.innerHTML = svg;
}

function drawGrid(chartWidth, chartHeight, margin, ticks, formatter, maxY) {
  let svg = "";
  for (let i = 0; i <= ticks; i += 1) {
    const y = margin.top + (chartHeight / ticks) * i;
    const value = maxY - (maxY / ticks) * i;
    svg += `<line x1="${margin.left}" y1="${y}" x2="${margin.left + chartWidth}" y2="${y}" class="grid-line"></line>`;
    svg += `<text x="${margin.left - 12}" y="${y + 4}" text-anchor="end" class="tick-text">${formatter(value)}</text>`;
  }
  return svg;
}

function drawAxes(margin, chartWidth, chartHeight, labels, xTitle, yTitle, xLabelStep = 1, xLabelFormatter = (label) => label, xTickOffset = 22, xTitleOffset = 60, yTitleX = 22, xPositions = null) {
  const step = labels.length > 1 ? chartWidth / (labels.length - 1) : chartWidth;
  let svg = `<line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${margin.left + chartWidth}" y2="${margin.top + chartHeight}" class="domain-line"></line>`;
  svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" class="domain-line"></line>`;
  labels.forEach((label, index) => {
    const x = xPositions?.[index] ?? (labels.length === 1 ? margin.left + chartWidth / 2 : margin.left + index * step);
    const displayLabel = index % xLabelStep === 0 ? xLabelFormatter(label, index) : "";
    if (displayLabel) {
      svg += `<text x="${x}" y="${margin.top + chartHeight + xTickOffset}" text-anchor="middle" class="tick-text">${displayLabel}</text>`;
    }
  });
  svg += `<text x="${margin.left + chartWidth / 2}" y="${margin.top + chartHeight + xTitleOffset}" text-anchor="middle" class="axis-title">${xTitle}</text>`;
  svg += `<text x="${yTitleX}" y="${margin.top + chartHeight / 2}" text-anchor="middle" class="axis-title" transform="rotate(-90 ${yTitleX} ${margin.top + chartHeight / 2})">${yTitle}</text>`;
  return svg;
}

function drawLegend(series, width, margin, align = "left") {
  const spacing = 92;
  const blockWidth = Math.max(series.length * spacing, 120);
  const startX = align === "center"
    ? Math.max((width - blockWidth) / 2, margin.left)
    : margin.left + 8;

  return series.map((item, index) => `
    <g transform="translate(${startX + index * spacing}, ${margin.top - 32})">
      <line x1="0" y1="9" x2="18" y2="9" stroke="${item.color}" stroke-width="3.2" stroke-linecap="round"></line>
      <text x="24" y="13" class="tick-text">${item.name}</text>
    </g>
  `).join("");
}

function bindTooltip(container) {
  container.querySelectorAll("[data-tooltip]").forEach((node) => {
    node.addEventListener("mouseenter", showTooltip);
    node.addEventListener("mousemove", showTooltip);
    node.addEventListener("mouseleave", hideTooltip);
  });
}

function showTooltip(event) {
  tooltip.hidden = false;
  tooltip.innerHTML = event.currentTarget.getAttribute("data-tooltip");
  const offset = 16;
  const bounds = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = event.clientX + offset;
  let top = event.clientY + offset;

  if (left + bounds.width > viewportWidth - 12) {
    left = event.clientX - bounds.width - offset;
  }

  if (top + bounds.height > viewportHeight - 12) {
    top = event.clientY - bounds.height - offset;
  }

  left = Math.max(12, left);
  top = Math.max(12, top);

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function filterRows(rows, filters = {}) {
  return rows.filter((row) => {
    if (filters.dayType === "working" && row.workingday !== 1) return false;
    if (filters.dayType === "nonworking" && row.workingday !== 0) return false;
    if (filters.season !== undefined && filters.season !== "all" && String(row.season) !== String(filters.season)) return false;
    if (filters.hourStart !== undefined && row.hr < filters.hourStart) return false;
    if (filters.hourEnd !== undefined && row.hr > filters.hourEnd) return false;
    return true;
  });
}

function averageByHour(rows, metric) {
  return Array.from({ length: 24 }, (_, hour) => {
    const group = rows.filter((row) => row.hr === hour);
    return average(group, metric);
  });
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function average(rows, key) {
  return rows.length ? sum(rows, key) / rows.length : 0;
}

function groupBy(rows, keyFn, reducer) {
  const groups = {};
  rows.forEach((row) => {
    const key = keyFn(row);
    groups[key] ||= [];
    groups[key].push(row);
  });
  return Object.fromEntries(Object.entries(groups).map(([key, group]) => [key, reducer(group)]));
}

function metricLabel(metric) {
  return { cnt: "Total rentals", registered: "Registered rentals", casual: "Casual rentals", compare: "Demand mix" }[metric];
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatCompact(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatTickValue(value) {
  if (value >= 1000) {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatRoundedK(value) {
  if (value === 0) return "0";
  return `${Math.round(value / 1000)}K`;
}

function formatRoundedWeatherTick(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatOverviewMonthLabel(label) {
  const [month, year] = label.split(" ");
  return `${month} '${year.slice(-2)}`;
}

function formatPercent(value) {
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function formatRangeLabel(range, suffix) {
  return `${range[0]}-${range[1]}${suffix}`;
}

function isValueInBin(value, range, inclusiveEnd = false) {
  return value >= range[0] && (inclusiveEnd ? value <= range[1] : value < range[1]);
}

function seasonColor(season) {
  return { "1": COLORS.spring, "2": COLORS.summer, "3": COLORS.fall, "4": COLORS.winter }[season];
}

function formatHourTick(hour) {
  const numericHour = Number(hour);
  const normalized = numericHour % 24;
  const suffix = normalized < 12 ? "AM" : "PM";
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12} ${suffix}`;
}

function formatWeekdayTick(label) {
  const map = {
    Sun: "Sun",
    Mon: "Mon",
    Tue: "Tue",
    Wed: "Wed",
    Thu: "Thu",
    Fri: "Fri",
    Sat: "Sat",
  };
  return map[label] || label;
}

function formatWeatherTick(label) {
  const map = {
    Clear: "Clear",
    Mist: "Mist",
    "Light Rain": "Light Rain",
    "Heavy Rain / Ice": "Heavy Rain/Ice",
  };
  return map[label] || label;
}

function svgStart(width, height) {
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">`;
}

function getChartSize(container, minWidth, minHeight) {
  const bounds = container.getBoundingClientRect();
  const styles = window.getComputedStyle(container);
  const cssHeight = parseFloat(styles.height);
  const cssMinHeight = parseFloat(styles.minHeight);
  return {
    width: Math.max(Math.floor(bounds.width || container.clientWidth), minWidth),
    height: Math.max(Math.floor(cssHeight || cssMinHeight || bounds.height || container.clientHeight), minHeight),
  };
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  return `rgba(${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}, ${alpha})`;
}

function interpolateColor(startHex, endHex, factor) {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  const value = Math.max(0, Math.min(1, factor));
  const mix = (a, b) => Math.round(a + (b - a) * value);
  return `rgb(${mix(start.r, end.r)}, ${mix(start.g, end.g)}, ${mix(start.b, end.b)})`;
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function getNiceMax(maxValue, tickCount) {
  const step = getNiceStep(maxValue / tickCount);
  return step * tickCount;
}

function getNiceStep(rawStep) {
  const exponent = Math.floor(Math.log10(rawStep || 1));
  const fraction = rawStep / (10 ** exponent);
  const candidates = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];
  const niceFraction = candidates.find((candidate) => fraction <= candidate) || 10;
  return niceFraction * (10 ** exponent);
}

function debounce(fn, wait) {
  let timeout;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (dataset.length) fn();
    }, wait);
  };
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

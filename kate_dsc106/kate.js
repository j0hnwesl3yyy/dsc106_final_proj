let allData = [], labData = [];
let filteredData = [];

const svg = d3.select("#chart");
const width  = +svg.attr("width");
const height = +svg.attr("height");
const radius = Math.min(width, height) / 2 - 60;

const g = svg.append("g")
             .attr("transform", `translate(${width/2},${height/2})`);

// Controls & tooltips
const ageSlider    = d3.select("#ageSlider"),
      heightSlider = d3.select("#heightSlider"),
      weightSlider = d3.select("#weightSlider"),
      sexFilter    = d3.select("#sexFilter"),
      regionFilter = d3.select("#regionFilter"),
      ageTip       = d3.select("#ageSliderTooltip"),
      heightTip    = d3.select("#heightSliderTooltip"),
      weightTip    = d3.select("#weightSliderTooltip");

// Value display spans next to labels
const ageValue    = d3.select("#ageValue"),
      heightValue = d3.select("#heightValue"),
      weightValue = d3.select("#weightValue");

// Chart‐dot floating tooltip
const chartTip = d3.select("body")
  .append("div")
  .attr("class","tooltip");

// Slider bubble helper
function showTip(slider, tip, val) {
  const min = +slider.attr("min"),
        max = +slider.attr("max"),
        pct = (val - min) / (max - min),
        w   = slider.node().offsetWidth,
        x   = pct * w;
  tip.style("left", `${x}px`)
     .text(val)
     .style("opacity", 1);
}

// Clinical groups for radar chart
const clinical = {
  "Blood Cell & Inflammation Markers": ["wbc","hb","hct","plt","esr","crp"],
  "Liver & Protein Function":         ["tprot","alb","tbil","ast","alt","ammo"],
  "Kidney Function & Metabolic Waste": ["bun","cr","gfr","ccr","lac"],
  "Electrolytes & Metabolic Panel":   ["gluc","na","k","ica","cl","hco3"],
  "Coagulation & Blood Gases":        ["ptinr","aptt","fib","ph","pco2","po2","be","sao2"]
};

const labInfo = {
  wbc:  "White blood cell score",
  hb:   "Hemoglobin score",
  hct:  "Hematocrit score",
  plt:  "Platelet score",
  esr:  "Erythrocyte sedimentation score",
  crp:  "C-reactive protein score",
  tprot:"Total protein score",
  alb:  "Albumin score",
  tbil: "Total bilirubin score",
  ast:  "Aspartate transferase score",
  alt:  "Alanine transferase score",
  ammo: "Ammonia score",
  bun:  "Blood urea nitrogen score",
  cr:   "Creatinine score",
  gfr:  "Glomerular filtration score",
  ccr:  "Creatinine clearance score",
  lac:  "Lactate score",
  gluc: "Glucose score",
  na:   "Sodium score",
  k:    "Potassium score",
  ica:  "Ionized calcium score",
  cl:   "Chloride score",
  hco3: "Bicarbonate (HCO₃) score",
  ptinr:"Prothrombin time INR score",
  aptt: "Activated partial thromboplastin time score",
  fib:  "Fibrinogen score",
  ph:   "Blood pH score",
  pco2: "Partial pressure CO₂ score",
  po2:  "Partial pressure O₂ score",
  be:   "Base excess score",
  sao2: "Oxygen saturation score"
};

// Load both datasets then initialize
Promise.all([
  d3.json("kate_card.json"), // allData for case filtering and summary
  d3.json("kate_chart.json")            // labData for radar chart
]).then(([dashboardData, labTestData]) => {
  allData = dashboardData;
  labData = labTestData;

  // Attach event listeners to controls
  ageSlider.on("input", () => handleSlider("age"));
  heightSlider.on("input", () => handleSlider("height"));
  weightSlider.on("input", () => handleSlider("weight"));
  sexFilter.on("change", updateAll);
  regionFilter.on("change", updateAll);

  // Initial update
  handleSlider("age");
  handleSlider("height");
  handleSlider("weight");
  updateAll();
});

function handleSlider(id) {
  const slider = d3.select(`#${id}Slider`);
  const value = +slider.property("value");

  // Update display span next to slider
  d3.select(`#${id}Value`).text(value);

  updateAll();
}

function updateAll() {
  updateSummary();
  updateRadar();
}

function updateSummary() {
  const minRequired = 2;
  const summaryContainer = d3.select("#summary");
  
  // Clear previous content
  summaryContainer.html("");
  
  // let sex = sexFilter.property("value");
  // let region = regionFilter.property("value");

  let region = regionFilter.property("value").toLowerCase().trim();
  let sex    = sexFilter.property(  "value").toLowerCase().trim();


  if (sex === "all") sex = "";
  if (region === "all") region = "";
  
  const age = +ageSlider.property("value");
  const height = +heightSlider.property("value");
  const weight = +weightSlider.property("value");
  
  const filteredData = allData.filter(d =>
    (!sex || d.sex === sex) &&
    (!region || d.region.toLowerCase().trim() === region) &&
    d.age >= age - 5 && d.age <= age + 5 &&
    d.height >= height - 5 && d.height <= height + 5 &&
    d.weight >= weight - 5 && d.weight <= weight + 5
  );
  
  if (filteredData.length < minRequired) {
    summaryContainer
      .append("div")
      .attr("class", "warning-message")
      .text("⚠️ Not enough patients to summarize.");
    return;
  }
  
  // Compute summary values
  const typeCounts = d3.rollup(filteredData, v => v.length, d => d.optype);
  const sortedTypes = Array.from(typeCounts.entries()).sort((a,b) => b[1] - a[1]);
  const commonSurgery = sortedTypes.length > 0 ? sortedTypes[0][0] : "N/A";

  const aneTypes = [...new Set(filteredData.map(d => d.ane_type).filter(t => t !== 'N/A'))];
  const anesthesiaTypes = aneTypes.length > 0 ? aneTypes.join(", ") : "N/A";

  const ivFields = ["iv1", "iv2", "aline1", "aline2", "cline1", "cline2"];
  const ivLocationsSet = new Set();
  filteredData.forEach(d => {
    ivFields.forEach(field => {
      if (d[field] && d[field] !== 'N/A') ivLocationsSet.add(d[field]);
    });
  });
  const ivLocations = ivLocationsSet.size > 0 ? [...ivLocationsSet].join(", ") : "N/A";

  const stayDuration = getAverageDuration("stay_duration");
  const surgeryDuration = getAverageDuration("surgery_duration");
  const anesthesiaDuration = getAverageDuration("anesthesia_duration");

  // Create summary paragraphs dynamically
  const summaries = [
    { label: "Most Common Procedure:", value: commonSurgery },
    { label: "Estimated Hospital Stay:", value: stayDuration },
    { label: "Estimated Surgery Duration:", value: surgeryDuration },
    { label: "Anesthesia Type(s) Typically Used:", value: anesthesiaTypes },
    { label: "Average Anesthesia Time:", value: anesthesiaDuration },
    { label: "Common IV Placement Site(s):", value: ivLocations }
  ];

  summaries.forEach(item => {
    const p = summaryContainer.append("p");
    p.append("strong").text(item.label + " ");
    p.append("span").text(item.value);
  });
  
  // ADD IN TEXT ABOUT PATIENTS
  if (filteredData.length > 0) {
    const avgAge = d3.mean(filteredData, d => +d.age);
    const avgHeight = d3.mean(filteredData, d => +d.height);
    const avgWeight = d3.mean(filteredData, d => +d.weight);
  
    const sentence = `Based on ${filteredData.length} similar patient(s): average age is ${avgAge.toFixed(0)} years, height is ${avgHeight.toFixed(0)} cm, and weight is ${avgWeight.toFixed(0)} kg.`;
  
    summaryContainer
      .append("p")
      .attr("class", "summary-text")
      .text(sentence);
  }

  function getAverageDuration(key) {
    const durations = filteredData
      .map(d => d[key])
      .filter(v => typeof v === "number" && !isNaN(v) && v > 0);
  
    if (durations.length === 0) return "N/A";
  
    const avgSeconds = durations.reduce((sum,val) => sum + val, 0) / durations.length;
    return formatDurationFromSeconds(avgSeconds);
  }
  
  function formatDurationFromSeconds(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds === 0) return "N/A";
  
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
  
    let parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes || parts.length === 0) parts.push(`${minutes}m`);
  
    return parts.join(" ");
  }
}    

function updateRadar() {
  const radarContainer = d3.select(".chart-container");

  const age = +ageSlider.node().value;
  const height = +heightSlider.node().value;
  const weight = +weightSlider.node().value;
  const sex = sexFilter.node().value;
  const region = regionFilter.node().value;

  ageTip.text(age);
  heightTip.text(height);
  weightTip.text(weight);

  let filt = labData.filter(d =>
      d.age >= age - 5 && d.age <= age + 5 &&
      d.height >= height - 5 && d.height <= height + 5 &&
      d.weight >= weight - 5 && d.weight <= weight + 5
  );

  if (sex !== "all") {
      filt = filt.filter(d => d.sex === sex);
  }

  if (region !== "all") {
    filt = filt.filter(d => d.region === region);
  }

  if (filt.length < 0) {
      radarContainer
          .append("div")
          .attr("class", "warning-message")
          .text("⚠️ Not enough patients to generate a chart.");
      return;
  }

  const testMeans = {};
  Object.values(clinical).flat().forEach(test => {
      const values = filt.map(d => +d[test]).filter(v => isFinite(v));
      testMeans[test] = values.length ? d3.mean(values) : null;
  });

  const groups = Object.keys(clinical);
  const means = {};
  groups.forEach(gp => {
      const vals = clinical[gp]
          .flatMap(key => filt.map(d => +d[key]).filter(v => isFinite(v)));
      means[gp] = vals.length ? d3.mean(vals) : 0;
  });

  g.selectAll("*").remove();

  const angleSlice = 2 * Math.PI / groups.length,
          maxVal = d3.max(Object.values(means)) || 1;

  groups.forEach((gp, i) => {
      const ang = i * angleSlice - Math.PI / 2,
              x = Math.cos(ang) * radius,
              y = Math.sin(ang) * radius;

      g.append("line")
          .attr("x1", 0).attr("y1", 0)
          .attr("x2", x).attr("y2", y)
          .attr("stroke", "#ccc");

      const labelGroup = g.append("g")
          .attr("transform", `translate(${x * 1.3},${y * (i === 0 ? 1.1 : 1.3)})`);

      const text = labelGroup.append("text")
          .attr("text-anchor", "middle")
          .attr("class", "axisLabel")
          .style("font-weight", "bold")
          .text(gp);

      const bbox = text.node().getBBox();
      labelGroup.insert("rect", "text")
          .attr("x", bbox.x - 6)
          .attr("y", bbox.y - 4)
          .attr("width", bbox.width + 12)
          .attr("height", bbox.height + 8)
          .attr("rx", 4)
          .attr("fill", "white")
          .attr("stroke", "#999")
          .attr("stroke-width", 1);
  });

  const radarLine = d3.lineRadial()
      .radius((d, i) => radius * (means[d] / maxVal))
      .angle((d, i) => i * angleSlice);

  g.append("path")
      .datum(groups)
      .attr("d", radarLine)
      .attr("fill", "steelblue")
      .attr("fill-opacity", 0.3)
      .attr("stroke", "steelblue");

  groups.forEach((gp, i) => {
      const ang = i * angleSlice - Math.PI / 2,
              r0 = radius * (means[gp] / maxVal),
              x = Math.cos(ang) * r0,
              y = Math.sin(ang) * r0;

      g.append("circle")
          .attr("cx", x).attr("cy", y)
          .attr("r", 4)
          .attr("fill", "steelblue")
          .style("cursor", "pointer")
          .on("mouseover", function (event) {
              d3.select(this)
                  .transition().duration(100)
                  .attr("r", 6).attr("fill", "#3367d6");

              const labList = clinical[gp];
              const rows = labList.map(name => {
                  const desc = labInfo[name] || name;
                  const val = testMeans[name];
                  return `${desc}: ${val !== null ? val.toFixed(2) : "N/A"}`;
              });

              chartTip.html(
                  `<strong>${gp} Averaged</strong>: ${means[gp].toFixed(2)}<br/>
                  <em>Includes:</em><br/>
                  ${rows.join("<br/>")}<br/>
                  <small style="display:block; margin-top:6px; color:gray;">
                  All lab test values are normalized between 0 and 1 <br/>
                  Values close to <strong>1</strong> are on the <strong>higher end</strong> of their reference range,<br/>
                  while values close to <strong>0</strong> are on the <strong>lower end</strong>.
                  </small>`
              ).style("opacity", 1);
          })
          .on("mousemove", event => {
              chartTip
                  .style("top", `${event.pageY - 10}px`)
                  .style("left", `${event.pageX + 10}px`);
          })
          .on("mouseout", function () {
              d3.select(this)
                  .transition().duration(100)
                  .attr("r", 4).attr("fill", "steelblue");
              chartTip.style("opacity", 0);
          });
  });
}


// wire sliders
ageSlider
.on("input",    () => {
    const v = +ageSlider.node().value;
    ageValue.text(v);
    showTip(ageSlider, ageTip, v);
    updateRadar();
})
.on("change",   () => ageTip.style("opacity",0));
ageSlider.on("input", updateSummary);

heightSlider
.on("input", () => {
    const v = +heightSlider.node().value;
    heightValue.text(v);
    showTip(heightSlider, heightTip, v);
    updateRadar();
})
.on("change",() => heightTip.style("opacity",0));
heightSlider.on("input", updateSummary);

weightSlider
.on("input", () => {
    const v = +weightSlider.node().value;
    weightValue.text(v);
    showTip(weightSlider, weightTip, v);
    updateRadar();
})
.on("change",() => weightTip.style("opacity",0));
weightSlider.on("input", updateSummary);

sexFilter.on("change", updateRadar);
sexFilter.on("change", updateSummary);

regionFilter.on("change", updateRadar);
regionFilter.on("change", updateSummary);

function styleSexFilter() {
const v = sexFilter.node().value;
let bg, col;
if (v === "M") {
    bg  = "#cce5ff";
    col = "#003366";
} else if (v === "F") {
    bg  = "#ffccdd";
    col = "#800040";
} else {
    bg  = "white";
    col = "#333";
}
sexFilter
    .style("background-color", bg)
    .style("color", col);
}

sexFilter
.on("change.style", styleSexFilter)
.dispatch("change");
fetch("tracy.json")
  .then(res => res.json())
  .then(data => {
    const outcomes = ["Survived", "Died"];
    const riskLevels = ["low", "medium", "high"];
    const color = { Survived: "#4caf50", Died: "#f44336" };
    const metrics = [
      { id: "age", label: "Age" },
      { id: "asa", label: "ASA Score" },
      { id: "bmi", label: "BMI" },
      { id: "preop_hb", label: "Pre-op Hemoglobin" },
      { id: "intraop_ebl", label: "Intra-op Blood Loss (mL)" },
      { id: "preop_cr", label: "Pre-op Creatinine" },
      { id: "preop_alb", label: "Pre-op Albumin" },
      { id: "preop_na", label: "Pre-op Sodium" },
      { id: "preop_k", label: "Pre-op Potassium" },
      { id: "preop_gluc", label: "Pre-op Glucose" },
      { id: "intraop_uo", label: "Intra-op Urine Output (mL)" }
    ];

    let currentMetric = metrics[0].id;
    let selectedBox = null;
    let highlightedOutcome = null;
    let highlightedRisk = null;
    let selectedOptype = "";

    const resetButton = d3.select("#resetButton")
      .on("click", () => {
        highlightedOutcome = null;
        highlightedRisk = null;
        selectedBox = null;
        selectedOptype = "";
        d3.select("#optypeSelector").property("value", "");
        d3.select("#detailsBox").html(`<strong>Click a boxplot</strong> or filter to see details`);
        updateOpacity();
        updateDetailsBoxFromFilter();
      });

    const selector = d3.select("#metricSelector")
      .on("change", function () {
        currentMetric = this.value;
        drawBoxPlot(currentMetric);
        updateDetailsBoxFromFilter();
      });

    metrics.forEach(metric => {
      selector.append("option")
        .attr("value", metric.id)
        .text(metric.label);
    });

    const optypeSelector = d3.select("#optypeSelector")
      .on("change", function () {
        selectedOptype = this.value;
        drawBoxPlot(currentMetric);
        updateDetailsBoxFromFilter();
      });

    const optypes = Array.from(new Set(data.map(d => d.optype).filter(d => d)));
    optypes.sort();
    optypes.forEach(op => {
      optypeSelector.append("option")
        .attr("value", op)
        .text(op);
    });

    drawBoxPlot(currentMetric);

    function drawBoxPlot(variable) {
      selectedBox = null;
      d3.select("#detailsBox").html(`<strong>Click a boxplot</strong> or filter to see details`);

      const svg = d3.select("#plot");
      const width = 300;
      const height = 350;
      const margin = { top: 40, right: 10, bottom: 40, left: 40 };
      const boxWidth = 30;
      const title = metrics.find(m => m.id === variable).label;

      svg.selectAll("*").remove();

      const grouped = {};
      riskLevels.forEach(risk => {
        grouped[risk] = {};
        outcomes.forEach(outcome => {
          grouped[risk][outcome] = data
            .filter(d =>
              d.risk === risk &&
              d.death_inhosp === (outcome === "Died" ? 1 : 0) &&
              d[variable] != null &&
              (!selectedOptype || d.optype === selectedOptype)
            )
            .map(d => +d[variable]);
        });
      });

      const allValues = Object.values(grouped).flatMap(g => Object.values(g).flat());
      const yScale = d3.scaleLinear()
        .domain([d3.min(allValues), d3.max(allValues)]).nice()
        .range([height - margin.bottom, margin.top]);

      const xScale = d3.scaleBand()
        .domain(riskLevels)
        .range([margin.left, width - margin.right])
        .paddingInner(0.3)
        .paddingOuter(0.2);

      svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .style("cursor", "pointer")
        .style("font-weight", "bold")
        .on("click", function (event, d) {
          highlightedRisk = highlightedRisk === d ? null : d;
          updateOpacity();
          updateDetailsBoxFromFilter();
        })
        .on("mouseover", function () {
          d3.select(this).style("fill", "#666");
        })
        .on("mouseout", function () {
          d3.select(this).style("fill", "#000");
        });

      svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale));

      svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${margin.left - 30},${height / 2})rotate(-90)`)
        .text(title);

      svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(`${title} by Risk and Outcome`);

      riskLevels.forEach((risk, i) => {
        outcomes.forEach((outcome, j) => {
          const filtered = data.filter(d =>
            d.risk === risk &&
            d.death_inhosp === (outcome === "Died" ? 1 : 0) &&
            d[variable] != null &&
            (!selectedOptype || d.optype === selectedOptype)
          );
          const values = filtered.map(d => +d[variable]);
          if (!values.length) return;

          const stats = getBoxStats(values);
          const cx = xScale(risk) + j * boxWidth - boxWidth / 2 + xScale.bandwidth() / 2;
          const g = svg.append("g")
            .attr("class", `boxplot boxplot-${outcome}`)
            .attr("data-group", `${risk}-${outcome}`);

          g.append("line")
            .attr("x1", cx)
            .attr("x2", cx)
            .attr("y1", yScale(stats.min))
            .attr("y2", yScale(stats.max))
            .attr("stroke", "#333");

          g.append("rect")
            .attr("x", cx - boxWidth / 2)
            .attr("width", boxWidth)
            .attr("y", yScale(stats.q3))
            .attr("height", yScale(stats.q1) - yScale(stats.q3))
            .attr("fill", color[outcome])
            .attr("stroke", "#000")
            .on("click", () => {
              selectedBox = `${risk}-${outcome}-${variable}`;
              updateDetailsBoxFromFilter();
            });

          g.append("line")
            .attr("x1", cx - boxWidth / 2)
            .attr("x2", cx + boxWidth / 2)
            .attr("y1", yScale(stats.median))
            .attr("y2", yScale(stats.median))
            .attr("stroke", "#000");
        });
      });

      const legend = svg.append("g")
        .attr("transform", `translate(${width - margin.right - 100}, ${margin.top})`);

      outcomes.forEach((outcome, i) => {
        const legendRow = legend.append("g")
          .attr("transform", `translate(0, ${i * 20})`)
          .style("cursor", "pointer")
          .on("click", () => {
            highlightedOutcome = highlightedOutcome === outcome ? null : outcome;
            updateOpacity();
            updateDetailsBoxFromFilter();
          })
          .on("mouseover", function () {
            d3.select(this).select("rect").attr("fill", d3.color(color[outcome]).brighter(1));
          })
          .on("mouseout", function () {
            d3.select(this).select("rect").attr("fill", color[outcome]);
          });

        legendRow.append("rect")
          .attr("width", 12)
          .attr("height", 12)
          .attr("fill", color[outcome])
          .attr("stroke", "#000");

        legendRow.append("text")
          .attr("x", 18)
          .attr("y", 10)
          .text(outcome)
          .attr("font-size", "12px")
          .attr("alignment-baseline", "middle");
      });

      updateOpacity();
      updateDetailsBoxFromFilter();
    }

    function updateOpacity() {
      d3.selectAll(".boxplot")
        .transition().duration(200)
        .style("opacity", function () {
          const [boxRisk, boxOutcome] = d3.select(this).attr("data-group").split("-");
          const riskMatch = !highlightedRisk || highlightedRisk === boxRisk;
          const outcomeMatch = !highlightedOutcome || highlightedOutcome === boxOutcome;
          return riskMatch && outcomeMatch ? 1 : 0.2;
        });
    }

    function updateDetailsBoxFromFilter() {
      let filtered = data;

      if (highlightedRisk) {
        filtered = filtered.filter(d => d.risk === highlightedRisk);
      }
      if (highlightedOutcome) {
        filtered = filtered.filter(d => d.death_inhosp === (highlightedOutcome === "Died" ? 1 : 0));
      }
      if (selectedOptype) {
        filtered = filtered.filter(d => d.optype === selectedOptype);
      }

      if (!filtered.length) {
        d3.select("#detailsBox").html(`<em>No data matching current filters.</em>`);
        return;
      }

      const values = filtered.map(d => +d[currentMetric]).filter(v => !isNaN(v));
      if (!values.length) {
        d3.select("#detailsBox").html(`<em>No values for selected metric.</em>`);
        return;
      }

      const stats = getBoxStats(values);
      const opDurations = filtered.map(d => (+d.opend - +d.opstart) / 60).filter(v => !isNaN(v));
      const medianDuration = d3.median(opDurations)?.toFixed(1);

      const anestheticCounts = d3.rollup(
        filtered.filter(d => d.ane_type),
        v => v.length,
        d => d.ane_type
      );
      const commonAnes = Array.from(anestheticCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type]) => type)
        .join(", ");

      const bloodLoss = filtered.map(d => +d.intraop_ebl).filter(v => !isNaN(v));
      const medianEBL = d3.median(bloodLoss)?.toFixed(1);

      const icuCount = filtered.filter(d => +d.icu_days > 0).length;
      const icuPercent = ((icuCount / filtered.length) * 100).toFixed(1);

      d3.select("#detailsBox").html(`
        <strong>Filtered Stats:</strong><br>
        Risk: ${highlightedRisk || "All"}<br>
        Outcome: ${highlightedOutcome || "All"}<br>
        Operation Type: ${selectedOptype || "All"}<br><br>
        <table>
          <tr><td>Min:</td><td>${stats.min.toFixed(1)}</td></tr>
          <tr><td>Q1:</td><td>${stats.q1.toFixed(1)}</td></tr>
          <tr><td>Median:</td><td>${stats.median.toFixed(1)}</td></tr>
          <tr><td>Q3:</td><td>${stats.q3.toFixed(1)}</td></tr>
          <tr><td>Max:</td><td>${stats.max.toFixed(1)}</td></tr>
        </table><br>
        <strong>Additional Info:</strong><br>
        Median Surgery Duration: ${medianDuration} min<br>
        Common Anesthetics: ${commonAnes}<br>
        Median Blood Loss: ${medianEBL} mL<br>
        ICU Admission: ${icuPercent}% of patients
      `);
    }

    function getBoxStats(values) {
      const sorted = values.slice().sort(d3.ascending);
      const q1 = d3.quantile(sorted, 0.25);
      const median = d3.quantile(sorted, 0.5);
      const q3 = d3.quantile(sorted, 0.75);
      const iqr = q3 - q1;
      const min = d3.min(sorted.filter(v => v >= q1 - 1.5 * iqr));
      const max = d3.max(sorted.filter(v => v <= q3 + 1.5 * iqr));
      return { min, q1, median, q3, max };
    }
  });

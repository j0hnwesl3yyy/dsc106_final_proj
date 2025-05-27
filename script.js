// interactive_anxiety_heatmap.js
const margin = { top: 100, right: 30, bottom: 30, left: 200 };
const width = 1000 - margin.left - margin.right;
const height = 700 - margin.top - margin.bottom;

const svg = d3.select("#heatmap")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("body")
  .append("div")
  .style("position", "absolute")
  .style("background", "#fff")
  .style("padding", "6px")
  .style("border", "1px solid #ccc")
  .style("border-radius", "4px")
  .style("pointer-events", "none")
  .style("opacity", 0);

const detailBox = d3.select("#details");

const brushInfo = d3.select("#heatmap")
  .append("div")
  .attr("id", "brush-info")
  .style("margin-top", "20px")
  .style("font-size", "14px")
  .style("font-family", "sans-serif");

const dropdown = d3.select("#heatmap")
  .insert("select", ":first-child")
  .attr("id", "surgeryFilter")
  .style("margin-bottom", "10px");

dropdown.selectAll("option")
  .data(["Top 10", "Top 20", "Top 50", "All"])
  .enter()
  .append("option")
  .text(d => d);

let lastHovered = null;

Promise.all([
  d3.json("daniel.json")
]).then(([data]) => {
  const metrics = ["death_score", "asa_score", "commonality_score", "anxiety_score"];

  data.forEach(d => {
    d.anxiety_score = 0.6 * d.death_score + 0.2 * d.asa_score + 0.2 * d.commonality_score;
  });

  const scoreMin = d3.min(data, d => d.anxiety_score);
  const scoreMax = d3.max(data, d => d.anxiety_score);

  const render = (filtered) => {
    svg.selectAll("*").remove();
    detailBox.html("");

    const x = d3.scaleBand()
      .domain(metrics)
      .range([0, width])
      .padding(0.05);

    const y = d3.scaleBand()
      .domain(filtered.map(d => d.opname))
      .range([0, height])
      .padding(0.05);

    const color = d3.scaleSequential()
      .interpolator(d3.interpolateRdYlGn)
      .domain([scoreMax, scoreMin]);

    svg.append("g").call(d3.axisTop(x));
    svg.append("g").call(d3.axisLeft(y));

    const cellData = filtered.flatMap(d => metrics.map(m => ({
      opname: d.opname,
      metric: m,
      value: d[m],
      all: d
    })));

    svg.selectAll()
      .data(cellData)
      .join("rect")
      .attr("x", d => x(d.metric))
      .attr("y", d => y(d.opname))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .style("fill", d => color(d.value))
      .style("stroke", "#fff")
      .on("mouseover", function (event, d) {
        lastHovered = d;
        tooltip.transition().duration(200).style("opacity", 1);
        tooltip.html(`<b>${d.opname}</b><br>${d.metric}: ${d.value.toFixed(3)}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function () {
        tooltip.transition().duration(500).style("opacity", 0);
        lastHovered = null;
      });

    const brush = d3.brush()
      .extent([[0, 0], [width, height]])
      .on("end", ({ selection }) => {
        if (!selection) {
          brushInfo.text("");
          return;
        }
        const [[x0, y0], [x1, y1]] = selection;
        const selected = cellData.filter(d => {
          const cx = x(d.metric) + x.bandwidth() / 2;
          const cy = y(d.opname) + y.bandwidth() / 2;
          return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
        });

        svg.selectAll("rect")
          .classed("selected", d => {
            const cx = x(d.metric) + x.bandwidth() / 2;
            const cy = y(d.opname) + y.bandwidth() / 2;
            return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
          });

        if (selected.length > 0) {
          const avg = d3.mean(selected, d => d.value);
          brushInfo.html(`<b>${selected.length}</b> cells selected<br>Average value: <b>${avg.toFixed(3)}</b>`);
        } else {
          brushInfo.text("No cells selected.");
        }
      });

    svg.append("g").call(brush);
  };

  const updateFilter = () => {
    const choice = dropdown.node().value;
    let filtered;
    if (choice === "Top 10") filtered = data.sort((a, b) => b.anxiety_score - a.anxiety_score).slice(0, 10);
    else if (choice === "Top 20") filtered = data.sort((a, b) => b.anxiety_score - a.anxiety_score).slice(0, 20);
    else if (choice === "Top 50") filtered = data.sort((a, b) => b.anxiety_score - a.anxiety_score).slice(0, 50);
    else filtered = data;
    render(filtered);
  };

  dropdown.on("change", updateFilter);
  updateFilter();

  // Keyboard interaction
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && lastHovered) {
      const vals = lastHovered.all;
      detailBox.html(`
        <div style="text-align:left; padding: 10px; border: 1px solid #ccc; background: #f9f9f9; border-radius: 6px;">
          <b>${vals.opname}</b><br>
          Anxiety Score: ${vals.anxiety_score.toFixed(3)}<br>
          Death Score: ${vals.death_score.toFixed(3)}<br>
          ASA Score: ${vals.asa_score.toFixed(3)}<br>
          Commonality Score: ${vals.commonality_score.toFixed(3)}
        </div>
      `);
    }
  });
});
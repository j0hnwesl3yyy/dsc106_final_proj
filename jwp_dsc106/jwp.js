async function init(){
  /* ----------- LOAD DATA ----------- */
  const data = await d3.json("jwp.json");
  const regionStats = data.region_summary;
  const procStats   = data.proc_by_region;
  const statsMap = Object.fromEntries(regionStats.map(d=>[d.region,d]));

  /* ----------- COLOUR SCALE ----------- */
  const maxMort = d3.max(regionStats,d=>d.mort_rate);
  const color   = d3.scaleLinear()
                    .domain([maxMort,0])
                    .range(["#b30000","#fee5d9"]);

  /* ----------- PAINT MAP ----------- */
  d3.selectAll(".region").each(function(){
    const d = statsMap[this.id];
    d3.select(this).selectAll("path,circle")
      .attr("fill", d ? color(d.mort_rate) : "#ccc");
  });

  const tooltip  = d3.select("#tooltip");
  const barSVG   = d3.select("#bar-chart");
  const sideTtl  = d3.select("#viz-title");
  const sideHint = d3.select("#viz-hint");

  /* ----------- REGION INTERACTION ----------- */
  d3.selectAll(".region")
    .on("mouseenter", function(e){ showTip(e,this.id); })
    .on("mousemove",  e=> tooltip.style("left",`${e.pageX}px`)
                                 .style("top", `${e.pageY}px`))
    .on("mouseleave", ()=> tooltip.attr("hidden",true))
    .on("click",      function (){
       const id=this.id;
       drawBar(id);
       d3.selectAll(".region").classed("region--selected",false);
       d3.select(this).classed("region--selected",true);
    });

  function showTip(evt,id){
    const d=statsMap[id];
    tooltip.html(
      d ? `<strong>${nice(id)}</strong><br>
           Cases&nbsp;${d.case_count}<br>
           Mort&nbsp;${(100*d.mort_rate).toFixed(1)}%<br>
           EBL&nbsp;${d.mean_ebl} mL<br>
           LOS&nbsp;${d.mean_los} d`
        : `<strong>${nice(id)}</strong><br>No data`)
      .style("left",`${evt.pageX}px`)
      .style("top", `${evt.pageY}px`)
      .attr("hidden",null);
  }

  /* ----------- BAR CHART ----------- */
  function drawBar(region){
    const rows = procStats
                   .filter(d=>d.region===region && d.case_count>0)
                   .sort((a,b)=>b.case_count-a.case_count)
                   .slice(0,7);

    sideTtl.text(`${nice(region)} – top surgeries`)
           .attr("hidden", !rows.length);
    sideHint.attr("hidden", !rows.length);

    const m={top:20,right:12,bottom:26,left:150},
          w=340-m.left-m.right,
          h=260-m.top-m.bottom;

    const x=d3.scaleLinear()
              .domain([0, d3.max(rows,d=>d.case_count)||1])
              .range([0,w]);
    const y=d3.scaleBand()
              .domain(rows.map(d=>d.opname))
              .range([0,h]).padding(0.1);

    barSVG.attr("viewBox","0 0 340 260");
    const g=barSVG.selectAll("g.frame")
                  .data([null]).join("g").attr("class","frame")
                  .attr("transform",`translate(${m.left},${m.top})`);

    g.selectAll("rect").data(rows,d=>d.opname).join(
        enter=>enter.append("rect")
                    .attr("y",d=>y(d.opname))
                    .attr("height",y.bandwidth())
                    .attr("x",0).attr("width",0)
                    .attr("fill","#4682b4")
                    .call(r=>r.transition().attr("width",d=>x(d.case_count))),
        update=>update.call(u=>u.transition()
                    .attr("y",d=>y(d.opname))
                    .attr("width",d=>x(d.case_count)))
    );

    g.selectAll("text.label").data(rows,d=>d.opname).join(
        enter=>enter.append("text").attr("class","label")
                    .attr("x",-6)
                    .attr("y",d=>y(d.opname)+y.bandwidth()/2)
                    .attr("dy","0.35em")
                    .attr("text-anchor","end")
                    .attr("font-size",".75rem")
                    .text(d=>d.opname.length>23?d.opname.slice(0,20)+"…":d.opname),
        update=>update.attr("y",d=>y(d.opname)+y.bandwidth()/2)
    );

    g.selectAll("text.val").data(rows,d=>d.opname).join(
        enter=>enter.append("text").attr("class","val")
                    .attr("x",d=>x(d.case_count)+4)
                    .attr("y",d=>y(d.opname)+y.bandwidth()/2)
                    .attr("dy","0.35em")
                    .attr("font-size",".7rem")
                    .text(d=>d.case_count),
        update=>update.attr("x",d=>x(d.case_count)+4)
                      .attr("y",d=>y(d.opname)+y.bandwidth()/2)
                      .text(d=>d.case_count)
    );

    g.selectAll("g.xaxis").data([null]).join("g")
      .attr("class","xaxis")
      .attr("transform",`translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(4).tickSize(-h).tickPadding(6))
      .call(sel=>{
        sel.selectAll("line").attr("stroke","#bbb");
        sel.select(".domain").remove();
        sel.selectAll("text").attr("font-size",".7rem");
      });
  }

  function nice(str){return str.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
}

init();

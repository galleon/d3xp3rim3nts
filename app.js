var margin = {top: 50, right: 30, bottom: 30, left: 40},
    height = 500 - margin.top -  margin.bottom,
    width = 960- margin.right - margin.left,
    goal = 0.33, selected;


var svg = d3.select("#map").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.bottom + margin.top);
//    width = +svg.attr("width"),
//    height = +svg.attr("height"),
//    selected;

/*
var random = Math.random, data = d3.range(2500).map(function() { return [random() * width, random() * height]; });
*/
var data = d3.range(500).map(function(value){
  return[value, Math.abs(Math.round(250 + 220*Math.sin(Math.PI*value/125))), 1]
});

//var quadtree = d3.quadtree(null, function(d){return d[1]}, function(d){return d[0]})
var quadtree = d3.quadtree()
    .extent([[-1, -1], [width + 1, height + 1]])
    .addAll(data);

quadtree.visitAfter(update);

var brush = d3.brush().on("brush", brushed);

svg.selectAll(".node")
    .data(showNodes(quadtree, 1))
    .enter().append("rect")
    .attr("class", "node")
    .attr("x", function(d) { return d.x0; })
    .attr("y", function(d) { return d.y0; })
    .attr("width", function(d) { return d.y1 - d.y0; })
    .attr("height", function(d) { return d.x1 - d.x0; });

// var sum = times.reduce(function(a, b) {return a + b;});
// var avg = sum / times.length;

function update(node, x0, y0, x1, y1){
  var new_data;
  var count = 0;

  // loop on children
  for(var i = 0; i < 4; i++) {
    // Will be false for leaves as they are not array
    if(node[i]) {
      count ++;
      // lazy init of new_data
      if(!new_data)
        new_data = new Array(node[i].data.length).fill(0);

      // accumulate children data (x, y, value)
      for(var j = 0; j < new_data.length; j++) {
        new_data[j] += node[i].data[j];
      }
    }
  }
  if(count) {
    // assuming that data[0] and data[1] are the coordinates
    // of the points, so we compute the mean
    new_data[0] /= count;
    new_data[1] /= count;
    node.data = new_data;
  }
}

var point = svg.selectAll(".point")
  .data(data)
  .enter().append("circle")
    .attr("class", "point")
    .attr("cx", function(d) { return d[0]; })
    .attr("cy", function(d) { return d[1]; })
    .attr("r", 2);

svg.append("g")
    .attr("class", "brush")
    .call(brush)
    .call(brush.move, [[100, 100], [200, 200]]);

function brushed() {
  var extent = d3.event.selection;
  point.each(function(d) { d.scanned = d.selected = false; });
  search(quadtree, extent[0][0], extent[0][1], extent[1][0], extent[1][1]);
  point.classed("point--scanned", function(d) { return d.scanned; });
  point.classed("point--selected", function(d) { return d.selected; });
}

// Find the nodes within the specified rectangle.
function search(quadtree, x0, y0, x3, y3) {
  quadtree.visit(function(node, x1, y1, x2, y2) {
    if (!node.length) {
      do {
        var d = node.data;
        d.scanned = true;
        d.selected = (d[0] >= x0) && (d[0] < x3) && (d[1] >= y0) && (d[1] < y3);
      } while (node = node.next);
    }
    return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
  });
}

// Collapse the quadtree into an array of rectangles.
function showNodes(quadtree, level) {
  var nodes = [];
  quadtree.visit(function(node, x0, y0, x1, y1) {
    node.x0 = x0, node.y0 = y0;
    node.x1 = x1, node.y1 = y1;
    //if (node.level == level)
    nodes.push(node);
  });
  return nodes;
}


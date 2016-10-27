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
var NUMBER_OF_POINTS = 100000;
var data = d3.range(NUMBER_OF_POINTS).map(function(value){
  return[value * 960 / NUMBER_OF_POINTS, Math.abs(Math.round(250 + 220 *
    Math.sin(6 * Math.PI * value / NUMBER_OF_POINTS))), 1];
});

//var quadtree = d3.quadtree(null, function(d){return d[1]}, function(d){return d[0]})
var quadtree = d3.quadtree()
    .extent([[-1, -1], [width + 1, height + 1]])
    .addAll(data);

quadtree.visitAfter(update);

var brush = d3.brush().on("brush", brushed);

// var sum = times.reduce(function(a, b) {return a + b;});
// var avg = sum / times.length;

function update(node, x0, y0, x1, y1){
  var newData;
  var count = 0;
  node.x0 = x0;
  node.y0 = y0;
  node.x1 = x1;
  node.y1 = y1;
  // loop on children
  for(var i = 0; i < 4; i++) {
    // Will be false for leaves as they are not array
    if(node[i]) {
      count ++;
      // lazy init of new_data
      if(!newData)
        newData = new Array(node[i].data.length).fill(0);

      // accumulate children data (x, y, value)
      for(var j = 0; j < newData.length; j++) {
        newData[j] += node[i].data[j];
      }
    }
  }
  if(count) {
    // assuming that data[0] and data[1] are the coordinates
    // of the points, so we compute the mean
    newData[0] /= count;
    newData[1] /= count;
    node.data = newData;
  }
}

var nodeSVGGroup = svg.append("g").attr("id", "nodeGroup").attr("class", "node");

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
      } while ((node = node.next));
    }
    return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
  });
}

/** Given a front in the quadtree, return the child front */
function nextFront(front) {
  toReturn = [];
  for(var i = 0; i < front.length; i++) {
    for(var j = 0; j < front[i].length; j++) {
      if(front[i][j])
        toReturn.push(front[i][j]);
    }
  }
  return toReturn;
}

/** Compute the depth of quadtree */
function treeDepth(quadtree) {
  var front = [quadtree.root()];
  var currentLevel = 0;
  while(front.length > 0) {
    front = nextFront(front);
    currentLevel ++;
  }
  return currentLevel - 1;
}

/** Return an array with the nodes at a given level */
function nodesAtLevel(quadtree, level) {
  var front = [quadtree.root()];
  var currentLevel = 0;
  while(currentLevel <= level && front.length > 0) {
    front = nextFront(front);
    currentLevel ++;
  }
  return front;
}

/** Draw a set of nodes */
function showNodes(nodes) {
  // remove existing <rect>
  nodeSVGGroup.selectAll("rect").remove();
  // add rect matching the requested nodes
  nodeSVGGroup.selectAll("rect").data(nodes)
      .enter().append("rect")
      .attr("x", function(d) { return d.x0; })
      .attr("y", function(d) { return d.y0; })
      .attr("width", function(d) { return d.y1 - d.y0; })
      .attr("height", function(d) { return d.x1 - d.x0; })
      .attr("style", function(node) {
          var lightness  = 100 * Math.log(node.data[2]) / Math.log(data.length);
          return "fill:hsla(180, 100%, " + lightness + "%, 128)";
      });
}

var goalRangeInput = d3.select('#goal');
var goalValueSpan = d3.select('#goal-value');
goalRangeInput.attr("max", treeDepth(quadtree));
goalRangeInput.on('change', function() {
  var level = d3.select(this).property('value');
  showNodes(nodesAtLevel(quadtree, level));
  goalValueSpan.text(level);
});

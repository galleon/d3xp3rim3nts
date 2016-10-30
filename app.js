var padding = 10,
    height  = 500 - 2 * padding,
    width   = 960 - 2 * padding,
    selected;

var svg = d3.select("#map").append("svg")
      .attr("width" , width  + 2 * padding)
      .attr("height", height + 2 * padding);

var NUMBER_OF_POINTS = 10000;

var functionValue = d3.select('input[name="function-stack"]:checked').property("value");

console.log('>'+functionValue+'<');

//
// sinus function
if (functionValue === 'sinus') {
  data = d3.range(NUMBER_OF_POINTS).map(function(value){
    var x = 6.0 * Math.PI * value / NUMBER_OF_POINTS;
    return [x, Math.sin(x), 30.0, 30.0*Math.cos(x)];
  });
}
//
// lorenz function
if (functionValue == 'lorenz') {
  var x = 0.1;
  var y = 0.0;
  var z = 0.0;
  var dt = 0.01;
  var sigma = 10.0;
  var rho = 28.0;
  var beta = 8.0 / 3.0;

  data = d3.range(NUMBER_OF_POINTS).map(function(value){
    var dx = dt * sigma * (y - x);
    var dy = dt * (x * (rho - z) - y);
    var dz = dt * (x * y - beta * z);
    x = x + dx;
    y = y + dy;
    z = z + dz;
    return [x, y, dx, dy];
  });
}

var xmin = d3.min(data, function(d) { return d[0]; });
var xmax = d3.max(data, function(d) { return d[0]; });
var ymin = d3.min(data, function(d) { return d[1]; });
var ymax = d3.max(data, function(d) { return d[1]; });

var xScale = d3.scaleLinear()
               .domain([xmin, xmax])
               .range([padding, width - padding]);

var yScale = d3.scaleLinear()
               .domain([ymin, ymax])
               .range([height - padding, padding]);

var vScale = d3.scaleLinear()
               .domain([d3.min(data, function(d) { return Math.sqrt(d[2]*d[2] + d[3]*d[3]); }),
                        d3.max(data, function(d) { return Math.sqrt(d[2]*d[2] + d[3]*d[3]); })])
               .range([0, 55]);                     

console.log('xmin: ' + xmin + ' -> ' + xScale(xmin));
console.log('xmax: ' + xmax + ' -> ' + xScale(xmax));
console.log('ymin: ' + ymin + ' -> ' + yScale(ymin));
console.log('ymax: ' + ymax + ' -> ' + yScale(ymax));

// .extent([[xmin, ymin], [xmax, ymax]])

var quadtree = d3.quadtree().addAll(data);

console.log(quadtree.extent());

quadtree.visitAfter(update);

var brush = d3.brush().on("brush", brushed);

function update(node, x0, y0, x1, y1){
  var newData;
  var count = 0;
  node.x0 = x0;
  node.y0 = y0;
  node.x1 = x1;
  node.y1 = y1;
  // loop on children
  for (var i = 0; i < 4; i++) {
    // Will be false for leaves as they are not array
    if (node[i]) {
      count ++;
      // lazy init of new_data
      if (!newData)
        newData = new Array(node[i].data.length).fill(0);

      // accumulate children data (x, y, value)
      for (var j = 0; j < newData.length; j++) {
        newData[j] += node[i].data[j];
      }
    }
  }
  if (count) {
    // assuming that data[0] and data[1] are the coordinates
    // of the points, so we compute the mean
    for (var j = 0; j < newData.length; j++) {
        newData[j] = newData[j] / count;
    }
    node.data = newData;
  }
}

var nodeSVGGroup = svg.append("g").attr("id", "nodeGroup").attr("class", "node");
var barbSVGGroup = svg.append("g").attr("id", "barbGroup").attr("class", "wind-arrow");

var point = svg.selectAll(".point")
  .data(data)
  .enter().append("circle")
    .attr("class", "point")
    .attr("cx", function(d) { return xScale(d[0]); })
    .attr("cy", function(d) { return yScale(d[1]); })
    .attr("r", 2);

svg.append("g")
    .attr("class", "brush")
    .call(brush)
    .call(brush.move, [[100, 100], [200, 200]]);

function brushed() {
  var extent = d3.event.selection;
  point.each(function(d) { d.scanned = d.selected = false; });

  search(quadtree, xScale.invert(extent[0][0]), yScale.invert(extent[1][1]), xScale.invert(extent[1][0]), yScale.invert(extent[0][1]));

  point.classed("point--scanned" , function(d) { return d.scanned;  });
  point.classed("point--selected", function(d) { return d.selected; });
}

// Find the nodes within the specified rectangle.
function search(quadtree, x0, y0, x3, y3) {
  quadtree.visit(function(node, x1, y1, x2, y2) {
    if (!node.length) {
      do {
        var d = node.data;
        d.scanned = true;

        d.selected = (d[0] > x0) && (d[0] <= x3) && (d[1] > y0) && (d[1] <= y3);
      } while ((node = node.next));
    }
    return x2 <= x0 || y2 <= y0 || x1 > x3 || y1 > y3;
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
  var selection = nodeSVGGroup.selectAll("rect").data(nodes);

  selection.enter()
    .append("rect")
    .attr("x", function(node) { return xScale(node.x0); })
    .attr("y", function(node) { return yScale(node.y1); })
    .attr("width" , function(node) { return xScale(node.x1) - xScale(node.x0); })
    .attr("height", function(node) { return yScale(node.y0) - yScale(node.y1); })
    .attr("style", function(node) {
      var lightness  = 100 - 100 * Math.log(node.data[2]) / Math.log(data.length);
      return "fill:hsla(180, 100%, " + lightness + "%, 128)";
    });
}

function showBarbs(nodes) {
  barbSVGGroup.selectAll("path").remove();

  var selection = barbSVGGroup.selectAll("path").data(nodes);

  selection.enter()
    .each(function(node, i) {
      var vx = node.data[2];
      var vy = node.data[3];

      var v = Math.sqrt(vx*vx + vy*vy);
      //vx /= vScale(v);
      //vy /= vScale(v);
  
      var speed = Math.sqrt(vx*vx + vy*vy);
      var angle = Math.atan2(-vy, vx) * (180/Math.PI);

      var index = 0;

      var ten   = 0;
      var five  = 0;
      var fifty = 0;
  
      var path = "";
      if (speed > 0) {
        // Prepare the path
        if (speed <= 7) {
          path += "M0 2 L8 2 ";
          index = 1;
        } else {
          path += "M1 2 L8 2 ";
        }

        // Find the number of lines in function of the speed
        five = Math.floor(speed / 5);
        if (speed % 5 >= 3) {
          five += 1;
        }

        // Add triangles (5 * 10)
        fifty = Math.floor(five / 10);
        five -= fifty * 10;
        // Add tenLines (5 * 2)
        ten = Math.floor(five / 2);
        five -= ten * 2;
      }

      var j, k;

      // Draw first the triangles
      for (j = 0; j < fifty; j++) {
        k = index + 2 * j;
        path += "M" + k + " 0 L" + (k + 1) + " 2 L" + k + " 2 L" + k + " 0 ";
      }
      if (fifty > 0) {
        index += 2 * (fifty - 0.5);
      }

      // Draw the long segments
      for (j = 0; j < ten; j++) {
        k = index + j;
        path += "M" + k + " 0 L" + (k + 1) + " 2 ";
      }
      index += ten;

      // Draw the short segments
      for (j = 0; j < five; j++) {
        k = index + j;
        path += "M" + (k + 0.5) + " 1 L" + (k + 1) + " 2 ";
      }

      path += "Z";

      var tx = 0.5*(xScale(node.x0) + xScale(node.x1));
      var ty = 0.5*(yScale(node.y1) + yScale(node.y0));

      var scalex = xScale(node.x1) - xScale(node.x0);
      var scaley = yScale(node.y0) - yScale(node.y1);

      console.log('scalex ' + scalex);
      console.log('scaley ' + scaley);

      var scale = Math.min(scalex, scaley) / 16;

      d3.select(this).append('path')
        .attr('d', function(d){ return path; })
        .attr('transform', 'translate(' + tx + ', ' + ty + ') scale(' + scale + ') rotate(' + angle + ' ' + 0 + ' ' + 0 + ')  translate(-4, -1)')
        .attr('vector-effect', 'non-scaling-stroke');
  });
}

var goalRangeInput = d3.select('#goal');
var goalValueSpan = d3.select('#goal-value');
goalRangeInput.attr("max", treeDepth(quadtree));
goalRangeInput.on('change', function() {
  var level = d3.select(this).property('value');
  var front = nodesAtLevel(quadtree, level);
  showNodes(front);
  showBarbs(front);
  goalValueSpan.text(level);
});

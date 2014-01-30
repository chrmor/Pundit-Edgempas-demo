/*  CONFIG  */
var winx = $(window).width(), winy = $(window).height()-30; /*  window  */
var win = winy; if (winx<winy) win = winx; /*  min(winx, winy)  */
var pixel = winx*winy/1000000; /*  res-independent pseudo pixel  */
var dotstroke = 0.5+0.5*pixel; /*  whitboarder  */
var margin = Math.round(30*pixel); /*  distance to window border  */
var r_min = 30, r_max = 900; /*  radius range  */
var oneatatime = true;
var speed = 300;
var R = null;

/*  GLOBAL STATE  */
var det = {}; /*  detail object  */
var det_id = false;
var clicked = ""; /*  activated phils  */
var propagation = 1; /*  1st, 2nd (or 3rd) order propagation  */
var legend = {};
var ha = {}; /*  halos for picking  */
var phs = {}; /*  search > founds items  */
var position_res = 10;
var resizeTime = null;

/*  TIME LEGEND  */
var years = {};
var ticks = {};

/*  OPTION OBJECTS  */
var options = {};
$('#about').click(function(){location.href="http://mariandoerk.de/edgemaps/";});
$('#data').change(function(){
	clicked="";
	updateHash();
	init();
});
$('#view').change(changeView);
$('#search').change(search);

/*  HASH  */
var last_title = "EdgeMaps";
var last_hash = window.location.hash.substr(1);

if (last_hash!='')
{
	var par = encodeURI(last_hash).split(";");

	if (par[0]) $("#data").val(par[0]);
	if (par[1]) $("#view").val(par[1]);
	if (par[2]) $("#search").val(par[2]);
	if (par[3]) clicked = par[3];
}
	


	$.History.bind(trackHash);

	$(window).resize(
		function(e,d) {
			window.clearTimeout(resizeTime);
			resizeTime = window.setTimeout( function(){ location.reload(true); }, speed/2 );
		}
	);
	

function init ()
{
	years = {};
	ticks = {};

	var dataset = $("#data").val();
	
	if ($("div.svg").length==0 || $("#"+dataset).length==0)
	{
		$("div.svg").animate({opacity: 0}, 500, function(){$(this).remove()});
		$("body").append("<div id='"+dataset+"' class='svg'></div>")
		$("div.svg").animate({opacity: 1}, 500);

	}
	
	/*  RAPHAEL OBJECT  */
	R = Raphael(dataset, winx, winy);

	dd = R.rect(-20,-20,10,10).attr("fill", "#fff"); /*  delay dummy   */
	bg = R.rect(0, 0, winx, winy).attr({fill: '#fff', stroke: 'transparent'}).toBack();
	bg.click(function(){reset();});
	
	$(document).keyup(function(e){ if (e.keyCode == 27) reset(); });

	if ($("#view").val()=='map') map_view = true;
	
	$('#data').blur();
	
	switch (dataset) {
		case "phils": data = phils; break;
		case "paint": data = paint; break;
		case "music": data = music; break;
	}
	
	ph = data.ph;
	positions = {};
	yr_max = Number(data.yr_max);
	yr_min = Number(data.yr_min);	
	
	generateInterestLayout();
	generateTimeLayout();
	
	if ($("#view").val()=="time") drawTimeLayout();
	else drawInterestLayout();
	
	preloadImages();	
	showLegend();
		
	// search
	if ($("#search").val()!="") search(true);	
	
	// clicked
	if (clicked!="")
	{
		var c = clicked;
		clicked = '';
		click(c, true);
	}
	
	document.title = title();	
}


/*  OPTIONS   */

function trackHash(state)
{
	if (last_hash!=state)
	{
		var last = last_hash.split(";");
		var par = state.split(";");
		
		if (par[0]) $("#data").val(par[0]);
		if (par[1]) $("#view").val(par[1]);
		if (par[2]) $("#search").val(par[2]);
		
		if (clicked!="" && par[3]=="") reset(true);
		clicked = par[3];
		init();
	}

	// readable title
	
	var new_title = title();
	if (last_title!=new_title) document.title = new_title;
	
	last_title = title();
	last_hash = state;	
}

function title()
{
	var title = "EdgeMaps: ";
	
	switch ($("#data").val()) {
		case "paint": title+="Painters - "; break;
		case "music": title+="Musicians - "; break;
		case "phils": title+="Philosophers - "; break;
	}
	
	switch ($("#view").val()) {
		case "time": title+="Timeline "; break;
		case "map": title+="Similarity Map "; break;
	}

	if ($("#search").val()!="") title+=" - Search: " + $("#search").val();
	
	if (clicked!='') title+=" - " + ph[clicked].name;
	
	return title;	
}

function updateHash()
{
	/*
		[0] data
		[1] view
		[2]	search
		[3]	click		
	*/
	
	var hash = $('#data').val()+";"+$('#view').val()+";"+$('#search').val()+";"+clicked+";";
	
	last_hash = hash;
	
	$.History.go(hash);	
}

function changeView()
{
	reset(true);
	
	$('#view').attr({'disabled': false}).blur();
	
	if ($('#view').val()=="time")
	{
		for (i in ph) ph[i].dot.animate({cx: ph[i].tpos.x, cy: ph[i].tpos.y}, speed*3);
		for (y in years) years[y].animate({opacity: 1}, speed*3);	
		for (y in ticks) ticks[y].animate({opacity: .5}, speed*3);	
		map_view = false;
	}
	else 
	{
		for (i in ph) ph[i].dot.animate({cx: ph[i].pos.x, cy: ph[i].pos.y}, speed*3)
		for (y in years) years[y].animate({opacity: 0}, speed*2);
		for (y in ticks) ticks[y].animate({opacity: 0}, speed*2);
		map_view = true;
	}
	
	dd.animate({opacity: 0}, speed*2, function()
	{
		$('#view').attr({'disabled': false});
	});

	updateHash();
}

function search(noupdate)
{
	var q = $("#search").unbind('change').blur().val();
	reset();
	$("#search").val(q);
	
	if (q.length>2)
	{	
		
		// matched people and topics
		phs = {}; 
		var ins = {};
		
		// search through interests and match corresponding people
		for (i in data['in'])
		{
			if (data['in'][i].search(RegExp(q, 'i'))!=-1) ins[i] = true;
		}
		
		// search abstract and name of only those not matched by interests
		for (i in ph)
		{
			var interested = false;
			for (j in ph[i]['in'])
			{
				if (typeof(ins[ ph[i]['in'][j] ])!=="undefined") interested = true;
				phs[i] = true;
				break;
			}
			if (interested) continue;
			else
			{
				if (ph[i].abstract.search(RegExp(q, 'i'))!=-1 || ph[i].name.search(RegExp(q, 'i'))!=-1)
					phs[i] = true;
			}
		}
		
		// dim all but phs, show labels for those
		for (i in ph)
		{
			if (typeof(phs[i])!=="undefined") showLabel (i, false);
			else dimDot(i, true);
		}
	}	
	
	$('#search').change(search);
	
	updateHash();	
}


/*  LAYOUT  */


/*  positions, colours  */
function generateInterestLayout()
{
	var sum = {d1: 0, d2: 0}; /*  for calculating centre point  */
	var count = 0;
	var center = {};
	var angle = 0; /*  degrees for repositioning  */

	for (i in ph)
	{
		/*  POSITIONS for interest map  */
		var x = Math.round((winx-win)/2+margin+Number(ph[i].d1)*(win-2*margin));
		var y = Math.round((winy-win)/2+margin+Number(ph[i].d2)*(win-2*margin));
		var r = radius(i);

		/*  check proximity, consider sizes of dot!  */
		var offset = r;
		var moved = false;
		var p = {x: x, y: y};
		while (typeof(positions[x])!=="undefined" && typeof(positions[x][y])!=="undefined")
		{
			if (angle>=360) angle-=360;
			x = p.x + Math.round(Math.sin(angle) * offset);
			y = p.y + Math.round(Math.cos(angle) * offset);
			angle+=10;
			offset = offset+0.1;
			moved = true;
		}
		/*  positions[] */
		var extent = Math.round(r*1.25+3*pixel); /*  in each direction  */
		for (var a=x-extent ; a < x+extent; a++)
		{
			for (var b=y-extent; b < y+extent; b++)
			{
				if (typeof(positions[a])=="undefined") positions[a] = {};
				positions[a][b] = 1;
			}
		}

		/*  some counting for center point */
		sum.d1+=Number(ph[i].d1); sum.d2+=Number(ph[i].d2); count++;

		ph[i]["pos"] = {x:x, y:y, r:r};		
	}

	/*  center point  */
	center["pos"] = {d1: sum.d1/count, d2: sum.d2/count};

	/*  COLOUR  */
	for (i in ph)
	{
		var a = center.pos.d2-ph[i].d2;
		var b = center.pos.d1-ph[i].d1;
		var h = Math.sqrt(a*a + b*b);

		/* hue: 0..359  */
		var hue = Math.round(Math.asin( a / h) * 180 / Math.PI);

		/*  handle discontinuities  */
		if (b<=0 && a>0) hue = 180-hue;
		else if (b>0 && a<=0) hue = 360+hue;
		else if (b<=0 && a<=0) hue = 360-(180+hue);
		
		hue+=-10;

		if (hue>=360) hue-=360;
		if (hue<0) hue+=360;
		
		/*  make value partially dependent of saturation  */
		var sat = Math.round(h/center.pos.d2*125);
		if (sat>100) sat = 100;
		var val = 55+Math.round(sat/4);
		var col = hsvToRgb(hue, sat, val);
		ph[i]["hex"] = "#"+intToHex(col[0])+intToHex(col[1])+intToHex(col[2]);		
		col = hsvToRgb(hue, sat, 35);
		ph[i]["hexd"] = "#"+intToHex(col[0])+intToHex(col[1])+intToHex(col[2]);
	}
}

function drawInterestLayout()
{
	for (i in ph)
	{
		/*  draw dots  */
		ph[i]["dot"] = R.circle(ph[i].pos.x, ph[i].pos.y, ph[i].pos.r);
		ph[i].dot.attr({stroke: "#fff"}).attr("stroke-width", dotstroke);
		
		var colour = ph[i].hex;
		
		ph[i].dot.attr("fill", colour).toFront();
		
		/*  attach events  */
		(function (h,i) {
			h.node.style.cursor = "pointer";
			h.node.onmouseover = function () { mouseOver(i); };
			h.node.onmouseout = function () {  mouseOut(i); };
			h.node.onclick = function () { click(i); };
	  })(ph[i].dot,i);
	}
}

function generateTimeLayout()
{
	var isum = 0; /*  sum of influences  */
	var rsum = 0; /*  sum of radii  */
	var count = 0; /*  # of phils  */
	var cursor = margin; /*  cursor along x-axis  */
	var rmax = 0;
	
	for (i in ph)
	{
		var r = radius(i);

		if (r > rmax) rmax=r;
		
		/*  sort by year, do sums and count  */
		isum += ph.to_count;
		rsum += r*2;
		count++;
	}

	/*  sort phils by year  */
	var phils_arr = new Array();
	for (i in ph) phils_arr.push(i)

	phils_arr.sort(sortByYear);
	for (p in phils_arr)
	{
		var i = phils_arr[p];
		
		var r = radius(i);
		var x = cursor + r;
		var y = Math.round(winy/2 + rmax-r-dotstroke/2);
		
		ph[i]["tpos"] = {x:x, y:y, r:r};

		cursor += 2*r / rsum * (winx-2*margin);
	}
	
	// years
	var phil_years = {};
	for (i in phils_arr) 
	{
		var id = phils_arr[i];
		phil_years[Number(ph[id].birthyear)] = ph[id].tpos.x;
	}
	
	var all_years = {};
	var last_year = yr_min;
	var next_year = yr_min;
	
	for (var y=yr_min; y < yr_max+1; y++)
	{
		if (typeof(phil_years[y])!=="undefined")
		{
			all_years[y] = phil_years[y];
			last_year = y;
			next_year = y+1;
		}
		else
		{
			// set next_phil_year
			while (typeof(phil_years[next_year])=="undefined") next_year++;
					
			// interpolate
			var last_pos = phil_years[last_year]; 
			var next_pos = phil_years[next_year]; 
			
			var span_pos = next_pos - last_pos;
			var span_yrs = next_year - last_year;
			var span_this = y - last_year;
			
			all_years[y] = last_pos + span_pos*(span_this/span_yrs);
		}
	}
	
	// century and decade ticks
	
	// grid
	for (var i=Math.round(yr_min/10)*10; i < yr_max; i=i+10)
	{
		var i_ = i+"";

		var x = Math.floor(all_years[i])+.5;
		// var x = all_years[i];
		
		var y1 = 75*pixel+8*pixel;
		var y2 = Math.round(winy/2 + rmax-dotstroke/2);
		
		// decades
		if (i_.substr(i_.length-1, 1)=="0" && i_.substr(i_.length-2, 2)!="00")
		{
			if (!isNaN(all_years[i]))
			{
					ticks[i] = R.path("M"+(x)+","+(y1)+" L"+(x)+","+(y2))
					.attr({"stroke-width": 1, opacity: 0, stroke: "#aaa"});
			}
		}
		// centuries
		else if (i_.substr(i_.length-2, 2)=="00")
		{			
			if (!isNaN(all_years[i]))
			{
				ticks[i] = R.path("M"+x+","+y1+" L"+x+","+y2)
					.attr({"stroke-width": 1, opacity: 0, stroke: "#555"});
			}
		}
	}
	
	R.rect(0, y1-pixel, winx, 50*pixel).attr({
		fill: '270-#fff:0-#fff:100', 'stroke-width': 0,
    "fill-opacity": 0, "stroke-opacity": 0
	});
	
	R.rect(0, y2-50*pixel, winx, 50*pixel).attr({
		fill: '90-#fff:0-#fff:100', 'stroke-width': 0,
    "fill-opacity": 0, "stroke-opacity": 0
	});

	
	/*  centuries  */
	var lastpos = 0;
	for (var y=yr_min; y < yr_max+1; y++)
	{
		if (all_years[y]-lastpos > 10+10*pixel)
		{
			y = Math.ceil(y/100)*100;			
			if (y>yr_min && y<yr_max)
			{
				// if (y<0) y_ = Math.abs(y); else y_=y;
				years[y] = R.text(all_years[y]-9*pixel, 75*pixel, y);		
				years[y].attr("font-size", Math.round(9+3*pixel)).attr("fill", "#555").attr("opacity", 0);
				years[y].attr({'font-weight': "normal", 'text-anchor': 'start'});
				years[y].rotate(-50);				
				lastpos = all_years[y];
			}
		}
	}
		
	/*  decades  */
	lastpos = 0;
	for (var y=yr_min; y < yr_max+1; y++)
	{
		if (typeof(years[y])!=="undefined") lastpos = all_years[y];
		else if (all_years[y]-lastpos > 8+8*pixel && (typeof(all_years[Math.ceil(y/100)*100])=="undefined" ||
			all_years[Math.ceil(y/100)*100]-all_years[y]>15+15*pixel))
		{
			y = Math.ceil(y/10)*10;
			if (y>yr_min && y<yr_max)
			{
				if (typeof years[y] == "undefined" )
				{
					// if (y<0) y_ = Math.abs(y)+" BC"; else y_=y;
					years[y] = R.text(all_years[y]-7*pixel, 75*pixel+2*pixel, y);
					years[y].attr("font-size", Math.round(7+3*pixel)).attr("fill", "#aaa").attr("opacity", 0);
					years[y].attr({'font-weight': "normal", 'text-anchor': 'start'});
					years[y].rotate(-50);
					lastpos = all_years[y];					
				}				
			}
		}
	}
	
}

function drawTimeLayout()
{
	map_view = false;
	
	for (i in ph)
	{
		var p = ph[i].tpos;
		
		/*  draw dots  */
		ph[i]["dot"] = R.circle(p.x, p.y, p.r);
		
		ph[i].dot.attr({stroke: "#fff"}).attr("stroke-width", dotstroke);
		
		var colour = ph[i].hex;
		ph[i].dot.attr("fill", colour).toFront();
		
		/*  attach events  */
		(function (h,i) {
			h.node.style.cursor = "pointer";
			h.node.onmouseover = function () { mouseOver(i); };
			h.node.onmouseout = function () { mouseOut(i); };
			h.node.onclick = function () { click(i); };
	  })(ph[i].dot,i);
	
	}
	
	// display years
	for (y in years) years[y].animate({opacity: 1}, speed*2);
	for (y in ticks) ticks[y].animate({opacity: .5}, speed*2);
}

function showLegend()
{
	// return;
	
	var y = Math.round(winy-50-50*pixel);
	
	// significance

	legend["title"] = R.text(0, y-20-10*pixel, "LEGEND");
	legend.title.attr("font-size", 9+3*pixel).attr("fill", "#A8A8A8").attr("font-weight", "bold");
	var lb = legend.title.getBBox();
	legend.title.attr("x", 10+5*pixel+lb.width/2);
	
	legend["sig"] = {};
	legend.sig["label"] = R.text(0, y, "SIGNIFICANCE");
	legend.sig.label.attr("font-size", 9+3*pixel).attr("fill", "#A8A8A8");
	lb = legend.sig.label.getBBox();
	legend.sig.label.attr("x", 10+5*pixel+lb.width/2);
	lb = legend.sig.label.getBBox();
	
	legend.sig["label_small"] = R.text(0, y+10+10*pixel, "degree of influence");
	legend.sig.label_small.attr("font-size", 8+2*pixel).attr("fill", "#A8A8A8");
	var lbs = legend.sig.label_small.getBBox();
	legend.sig.label_small.attr("x", 10+5*pixel+lbs.width/2);
	lbs = legend.sig.label_small.getBBox();
	
	var r1 = Math.sqrt( (1 / data.to_max * r_max * pixel + r_min) / Math.PI );
	var r2 = Math.sqrt( (data.to_max / data.to_max * r_max * pixel + r_min) / Math.PI );
	
 	legend.sig["small"] = R.circle(lbs.x+lbs.width+10+10*pixel, lb.y+lb.height/2, r1);
 	legend.sig.small.attr("fill", "#D8D8D8").attr("stroke", "#fff");
 	legend.sig["small_txt"] = R.text(lbs.x+lbs.width+10+10*pixel, lb.y+lb.height+r1, 1);
	legend.sig.small_txt.attr("font-size", 8+2*pixel).attr("fill", "#A8A8A8");

 	legend.sig["large"] = R.circle(lbs.x+lbs.width+10+10*pixel+r2*2, lb.y+lb.height/2, r2);
 	legend.sig.large.attr("fill", "#D8D8D8").attr("stroke", "#fff");
 	legend.sig["large_txt"] = R.text(lbs.x+lbs.width+10+10*pixel+r2*2, lb.y+lb.height+r2, data.to_max);
	legend.sig.large_txt.attr("font-size", 8+2*pixel).attr("fill", "#A8A8A8");

	var mb = legend.sig.large.getBBox();
	
	y = y+30+30*pixel;
	
	// influence links
	
	legend["inf"] = {};
	legend.inf["label"] = R.text(0, y, "INFLUENCE");
	legend.inf.label.attr("font-size", 9+3*pixel).attr("fill", "#A8A8A8");
	
	lb = legend.inf.label.getBBox();
	legend.inf.label.attr("x", 10+5*pixel+lb.width/2);
	
	//legend.inf.label.attr("x", mb.x+mb.width+lb.width/2+15+15*pixel);
	lb = legend.inf.label.getBBox();
	
	var p1 = {x: lb.x+lb.width+10+10*pixel, y: y+3-2*pixel, r: 0};
	var t1 = {x: lb.x+lb.width+40+40*pixel, y: y+3-2*pixel, r: 0};
	var p2 = {x: lb.x+lb.width+45+45*pixel, y: y-5+2*pixel, r: 0};
	var t2 = {x: lb.x+lb.width+76+76*pixel, y: y-5+2*pixel, r: 0};
	var d = distance(p1,t1);
	
	var to = toEdge(p2, t2, d, "#A8A8A8", d/3, 1);
	var fr = frEdge(t1, p1, d, "#A8A8A8", d/3, 1);
	
	legend.inf["a"] = R.text(lb.x+lb.width+8+8*pixel, y-2, "A");
	legend.inf.a.attr("font-size", 8+2*pixel).attr("fill", "#A8A8A8");

	legend.inf["b"] = R.text(lb.x+lb.width+43+43*pixel-2, y-2, "B");
	legend.inf.b.attr("font-size", 9+3*pixel).attr("fill", "#A8A8A8");

	legend.inf["c"] = R.text(lb.x+lb.width+78+78*pixel, y-2, "C");
	legend.inf.c.attr("font-size", 8+2*pixel).attr("fill", "#A8A8A8");

	var ab = legend.inf.a.getBBox();
	var bb = legend.inf.b.getBBox();
	var cb = legend.inf.c.getBBox();
	
	//var to_label = R.text((bb.x+bb.width/2+cb.x+cb.width/2)/2, y+6+3*pixel, "outgoing");
	//to_label.attr("fill", "#7F7F7F").attr("font-size", 8+2*pixel)

	//var to_label = R.text((ab.x+ab.width/2+bb.x+bb.width/2)/2, y-6-3*pixel, "incoming");
	//to_label.attr("fill", "#7F7F7F").attr("font-size", 8+2*pixel)

	legend.inf["label_small"] = R.text(0, y+10+10*pixel, "A influenced B, and B influenced C");
	legend.inf.label_small.attr("font-size", 8+2*pixel).attr("fill", "#A8A8A8");
	var lbs = legend.inf.label_small.getBBox();
	legend.inf.label_small.attr("x", lb.x+lbs.width/2);
//	legend.inf.label_small.attr("x", bb.x+bb.width/2);

}

/*  hide labels, edges, show all dots  */
function reset (noupdate)
{
	if (typeof(ph)!=="undefined")
	{
		for (i in ph)
		{
			hideEdges(i);
			hideLabel(i);
			hideDetail();
			dimDot(i, false);
		}
	}
	
	$("#search").val("");
	phs = {};
	
	clicked = "";
	
	if (typeof(noupdate)=="undefined") updateHash();
}



/*  INTERACTIONS  */

function mouseOver (i)
{
	// hideDetail();
	// showDetail(i);
	
	/*  label  */
	if (clicked == i) {
		showLabel(i, true);
		hideDetail();
		showDetail(i);
	} else if (clicked !== "") {
		if (existsInfluenceRelation(clicked,i)) {
			this.showAnnotations(clicked, i);
		} else if (existsInfluenceRelation(i,clicked)){
			this.showAnnotations(i,clicked);
		}
		
	}
	else showLabel(i, false);
}

function mouseOut (i)
{
	/*  label  */
	var hide = true;
	
	if (clicked==i || typeof(phs[i])!=="undefined") hide = false;
	else
	{
		if (clicked!='')
		{
			if (typeof(ph[clicked].fr[i])!=="undefined" || typeof(ph[clicked].to[i])!=="undefined") hide = false;
		}
	}
	
	if (hide) hideLabel(i);
	
	// hideDetail(i);
	
}

function click (i, noupdate)
{
	/*  one selection per time  */
	if (oneatatime && clicked!=i) reset(true);
	
	/*  update clicked  */
	if (clicked==i) clicked = "";
	else clicked = i;

	/*  show/hide edges  */
	if (clicked == i)
	{
		showEdges(i, 1);
		showDetail(i);
		// if (propagation>1) 
		// {
		// 	for (to in ph[i].to) showEdges(to, 0.3);
		// 	for (fr in ph[i].fr) showEdges(fr, 0.3);
		// }
	}
	else
	{
		for (to in ph[i].to) {
            ph[to].dot.attr({r: ph[to].dot.attrs.r})
		}
		for (fr in ph[i].fr) {
            ph[fr].dot.attr({r: ph[fr].dot.attrs.r})
		}
        hideEdges(i);
		hideDetail();
		
		// if (propagation>1) 
		// {
		// 	for (to in ph[i].to) hideEdges(to);
		// 	for (fr in ph[i].fr) hideEdges(fr);
		// }	
	}
	
	/*  dim all dots, hide all labels  */
	for (id in ph)
	{
			hideLabel(id);
			if (clicked!='') dimDot(id, true);
			else dimDot(id, false);
	}
	
	/*  show fr/to phils that are in clicked  */
	if (clicked!="")
	{
		/*  show dots of linked phils  */
		for (to in ph[clicked].to) {
            ph[to].dot.attr({r: ph[to].dot.attrs.r})
		    ph[to].dot.attr({opacity: 1});
		}
		for (fr in ph[clicked].fr) {
            ph[fr].dot.attr({r: ph[fr].dot.attrs.r})
		    ph[fr].dot.attr({opacity: 1});
		}
        

		/*  show labels of linked phils */
		for (to in ph[clicked].to) showLabel(to, false); 
		for (fr in ph[clicked].fr) showLabel(fr, false);

		/*  clicked dots  */
		ph[clicked].dot.attr({opacity: 1});
		var s = dotstroke+ph[clicked].pos.r/10; /*  stroke width  */

		var colour = ph[clicked].hex;
        
        //XXX: the factor 2 is hardcoded to make dots bigger...
		ph[clicked].dot.attr({r: (ph[clicked].pos.r)-s/2, stroke: colour, fill: "#fff"});
		ph[clicked].dot.attr("stroke-width", s).toFront();
		ph[clicked].dot.node.style.cursor = "pointer";

		hideLabel(clicked);
		showLabel(clicked, true);
	}
		
	frontDetail();
	if (typeof(noupdate)=="undefined") updateHash();
}



/*  dim or undim dot  */
function dimDot (id, dim)
{
	if (dim) ph[id].dot.attr("opacity", 0.15).attr("stroke-width", dotstroke).toFront();
	else ph[id].dot.attr("opacity", 1).attr("stroke-width", dotstroke).toFront();
}



/*  EDGES  */

function toEdge(p, t, d, colour, c, o)
{
	var m = {x: (p.x+t.x)/2, y: (p.y+t.y)/2}; /*  middle point between p and t  */		
	var m2 = {x: (p.x+t.x)/2, y: (p.y+t.y)/2 - c}; /*  adjusted middle point between p and t  */		
	var d_tm = distance(t,m2);

	/*  arrows  */
	var l = 3+3*pixel; /*  length  */
	var k = 1.5+1.5*pixel; /*  distance to curve  */
	var q = {}, q2 = {}, v = {}, w = {};
	q.x = t.x + (m2.x-t.x) * (l+t.r+dotstroke) / d_tm;
	q.y = t.y + (m2.y-t.y) * (l+t.r+dotstroke) / d_tm;
	q2.x = t.x + (m2.x-t.x) * (t.r+dotstroke) / d_tm;
	q2.y = t.y + (m2.y-t.y) * (t.r+dotstroke) / d_tm;
	v = {x: q.x - (m2.y-t.y) * k / d_tm, y: q.y - (t.x-m2.x) * k / d_tm };
	w = {x: q.x + (m2.y-t.y) * k / d_tm, y: q.y + (t.x-m2.x) * k / d_tm };

	// var edge = R.path().moveTo(p.x, p.y).curveTo( m2.x, m2.y, q.x, q.y);
	var edge = R.path('M'+p.x+','+p.y+' Q'+m2.x+','+m2.y+' '+q.x+','+q.y);
	edge.attr({stroke: colour, opacity: 1*o}).attr("stroke-width", 0.4 + 0.4*pixel).toFront();

	// var arrow = R.path().moveTo(v.x, v.y).lineTo( q2.x, q2.y).lineTo(w.x, w.y).andClose();		
	var arrow = R.path('M'+v.x+','+v.y+' L'+q2.x+','+q2.y+' '+w.x+','+w.y+' Z');
	// var arrow = R.path('M'+v.x+','+v.y+' L'+w.x+','+w.y+' Z');
	
	arrow.attr({stroke: colour, opacity: 0}).attr("stroke-width", 0).toFront();
	arrow.attr({fill: colour, opacity: 1*o}).toFront();

	var both = new Object({edge: edge, arrow: arrow});

	return both;
}

function frEdge(p, t, d, colour, c, o)
{
	var m_ = {x: (p.x+t.x)/2, y: (p.y+t.y)/2 }; /*  adjusted middle point between p and t  */
	var m1 = {x: (p.x+t.x)/2, y: (p.y+t.y)/2 + c }; /*  adjusted middle point between p and t  */

	/*  second adjusted middle point  */
	var g = 3+3*pixel; /*  distance betw m1 and m2  */
	var angle = Math.atan( (p.y-t.y) / (p.x-t.x) );
	var a = Math.sin(angle) * g;
	var b = Math.cos(angle) * g;
	var m2 = {x: Math.round(m1.x-a), y: Math.round(m1.y+b)};

	var m = {x: (m1.x+m2.x)/2, y: (m1.y+m2.y)/2 }; /*  center point between m1 and m2  */
	var d_tm = distance(t, m);

	/*  from arrow  */
	var l = 3+3*pixel; /*  determines how sharp arrow is  */
	var q1 = {x:0, y: 0}, q2 = {x:0, y: 0};
	q1.x = (t.r+l)/d_tm * m.x + (1-(t.r+l)/d_tm) * t.x;
	q1.y = (t.r+l)/d_tm * m.y + (1-(t.r+l)/d_tm) * t.y;		
	q2.x = t.r/d_tm * m.x + (1-t.r/d_tm) * t.x;
	q2.y = t.r/d_tm * m.y + (1-t.r/d_tm) * t.y;		
	g = 4+4*pixel; /*  distance from main curve */
	angle = Math.atan( (m.y - t.y) / (m.x - t.x) );
	a = Math.sin(angle) * g; b = Math.cos(angle) * g;
	var o1 = {x: q2.x+a, y: q2.y-b};
	
	angle = Math.atan( -1 * (m.y - t.y) / (m.x - t.x) );
	a = Math.sin(angle) * g; b = Math.cos(angle) * g;
	
	var o2 = {x: q2.x+a, y: q2.y+b};
	
	/*  draw curve  */
	// var edge = R.path().moveTo(p.x, p.y);
	// edge.lineTo(p.x, p.y).curveTo( m1.x, m1.y, o1.x, o1.y);
	//  	edge.lineTo(q1.x, q1.y).lineTo(o2.x, o2.y);
	//  	edge.curveTo(m2.x, m2.y, p.x, p.y).andClose();
	
	var path = 'M'+p.x+','+p.y;
	path+=' L'+p.x+','+p.y+' Q'+m1.x+','+m1.y+' '+o1.x+','+o1.y;
	path+=' L'+q1.x+','+q1.y+' L'+o2.x+','+o2.y+' Q'+m2.x+','+m2.y+' '+p.x+','+p.y+' Z';
	
	var edge = R.path(path).attr({fill: colour, opacity: 0.3*o})
		.attr({"stroke-width": 0, "stroke-opacity": 0}).toFront();
	
	return edge;
}

function showEdges (i, o) /*  i: phil id, o: opacity  */
{
	/*  to_edges */
	ph[i].to_edges = {};
	ph[i].to_arrows = {};
	if (map_view) var p = ph[i].pos; else var p = ph[i].tpos;

	for (to in ph[i].to)
	{ 
		if (map_view) var t = ph[to].pos; else var t = ph[to].tpos;
		var d = distance(p,t);
		if (map_view) var c = d/4; else var c = d/2; /*  curvature  */
		
		var both = toEdge(p, t, d, ph[i].hex, c, o);

		ph[i].to_edges[to] = both.edge;
		ph[i].to_arrows[to] = both.arrow;
	}

	/*  fr_edges */
	ph[i].fr_edges = {};
	for (fr in ph[i].fr)
	{ 
		if (map_view) var t = ph[fr].pos; else var t = ph[fr].tpos;		
		var d = distance(p,t);
		if (map_view) var c = d/4; else var c = d/2; /*  curvature  */

		ph[i].fr_edges[fr] = frEdge(p, t, d, ph[fr].hex, c, o);
	}

}

function hideEdges (i)
{
	for (to in ph[i].to_edges)
	{ 
		ph[i].to_edges[to].remove(); delete ph[i].to_edges[to];
		ph[i].to_arrows[to].remove(); delete ph[i].to_arrows[to];
	}
	for (fr in ph[i].fr_edges)
	{
		ph[i].fr_edges[fr].remove();
		delete ph[i].fr_edges[fr];
	}

	var colour = ph[i].hex;

	ph[i].dot.attr({r: ph[i].pos.r, fill: colour}).attr("stroke-width", 2*pixel).attr("stroke", "#fff");
}



/*  LABELS  */

function showLabel (i, bold)
{
	hideLabel(i);
	
	var colour = ph[i].hex;
	var colourd = ph[i].hexd;
	
	if (map_view) var p = ph[i].pos; else var p = ph[i].tpos;
	
	if (map_view)
	{
		/*  text label */
		ph[i]["txt"] = R.text(p.x, p.y+p.r*1.25+7, ph[i].name_short);
		ph[i].txt.attr("font-size", Math.round(p.r/2)+7);
		ph[i].txt.attr("fill", colourd);

		/*  label box  */
		var bbox = ph[i].txt.getBBox();
		ph[i]["txtbox"] = R.rect(bbox.x-1-pixel, bbox.y, bbox.width+2+2*pixel, bbox.height);
		ph[i].txtbox.attr("stroke-width", 0).attr("stroke", "#fff");
		ph[i].txtbox.attr("fill", "#fff").toFront();
		ph[i].txt.toFront();		
	}
	else
	{
		/*  text label */
		var dbox = ph[i].dot.getBBox();
		
		ph[i]["txt"] = R.text(p.x, p.y+dbox.height/2, ph[i].name_short);
		ph[i].txt.attr("font-size", Math.round(p.r/2)+7);
//		ph[i].txt.attr("font-size", 12);
		ph[i].txt.attr("fill", colourd);
	
	 	var bbox = ph[i].txt.getBBox();
		
		//ph[i].txt.translate(-bbox.width/2, bbox.height/2);
		ph[i].txt.translate(bbox.width/2 + 1.5*p.r+2*dotstroke, bbox.height/2);
		
		bbox = ph[i].txt.getBBox();
		
		//ph[i].txt.rotate(-45, bbox.x+bbox.width, bbox.y);
		ph[i].txt.rotate(50, bbox.x, bbox.y);
		
		/*  label box  */
	 	ph[i]["txtbox"] = R.rect(bbox.x-1-pixel, bbox.y, bbox.width+2+2*pixel, bbox.height);
	 	ph[i].txtbox.attr("stroke-width", 0).attr("stroke", "#fff");
	 	ph[i].txtbox.attr("fill", "#fff").rotate(50, bbox.x, bbox.y).toFront();
	 	ph[i].txt.toFront();				
	}

	if (bold)
	{
		ph[i].txtbox.attr("fill", colour).attr("opacity", 1).toFront();
		ph[i].txt.attr("font-weight", "bold").attr("fill", "#fff").toFront();
	}
	else
	{
		ph[i].txt.attr("font-weight", "normal").attr("fill", colourd);
		ph[i].txtbox.attr("fill", "#fff").attr("opacity", 0.65);
	}

}

function hideLabel (i)
{
	if (typeof(ph[i].txtbox)!=="undefined")
	{
		if (ox(ph[i].txtbox)) ph[i].txtbox.remove();
		delete ph[i].txtbox;
	}
	
	if (typeof(ph[i].txt)!=="undefined")
	{
		if (ox(ph[i].txt)) ph[i].txt.remove();
		delete ph[i].txt;
	}
}


function shortenString(string) {
	var max = 250;
	if (string.length >= max) {
		return string.substring(0,max) + " ... '";
	} else {
		return string;
	}
	
	
}

function wrapString(string) {
	
	var words = string.split(" ");
	var cont = 0;
	var buffer= "";
	var result = "";
	for (var i=0; i < words.length; i++) {
		buffer += words[i] + " ";
		if ( (cont >= 75) || (i == words.length - 1 )) {
			result += buffer + "\n";
			buffer = "";
			cont = 0;
		} 
		cont += words[i].length + 1;	
		
	}
	return result;
	
}

function showMessage(id, message, colour, shift_height) {
	
	det[id] = R.text(winx, winy, message);
	bm = det[id].getBBox();
		
	det[id].attr({x: winx-448, y: winy-bm.height/2-2-8*pixel - shift_height, "text-align": 'left', "text-anchor": "start", "font-size": Math.round(8+4*pixel), "font-weight": "bold"});
	bm = det[id].getBBox();
	
	/*  box  */
	det[id + "box"] = R.rect(bm.x-4-2*pixel, bm.y-4-2*pixel, 400+4*pixel, bm.height+4+4*pixel, 2+pixel)
		.attr({fill: "#B8B8B8", "fill-opacity": 0.9, "stroke": colour, "stroke-width": 1+pixel, "opacity": 1});
	
	det["img"] = R.image("http://www.thepund.it/wp-content/uploads/2013/05/Pundit.png", bm.x + 320, bm.y + bm.height/4, 70, 15).attr({"href" : "http://thepund.it"});//.attr("opacity", 0);
	
	det[id].toFront();

	return shift_height += bm.height + 5;
	
}

function showSingleAnnotation(id, message1, sentence1, message2, sentence2, link, colour, shift_height) {
	

	det[id + "sent2"] = R.text(winx, winy, sentence2);
	bs2 = det[id + "sent2"].getBBox();
	
	det[id + "msg2"] = R.text(winx, winy, message2);
	bm2 = det[id + "msg2"].getBBox();
	
	det[id + "sent1"] = R.text(winx, winy, sentence1);
	bs1 = det[id + "sent1"].getBBox();
	
	det[id + "msg1"] = R.text(winx, winy, message1);
	bm1 = det[id + "msg1"].getBBox();
	
	det[id + "link"] = R.text(winx, winy, "Go to annotated web page");
	lt = det[id + "link"].getBBox();
	
	det[id + "link"].attr({x: winx-500, y: winy-lt.height/2-8-8*pixel - shift_height, "text-align": 'left', "text-anchor": "start", "font-size": Math.round(8+4*pixel), "stroke" : '#0000FF'});
	lt = det[id + "link"].getBBox();
	
	det[id + "sent2"].attr({x: winx-500, y: lt.y - bs2.height/2 -8  , "text-align": 'left', "text-anchor": "start", "font-size": Math.round(8+4*pixel), "font-style": "italic"});
	bs2 = det[id + "sent2"].getBBox();
	
	det[id + "msg2"].attr({x: winx-500, y: bs2.y - bm2.height/2 -8 , "text-align": 'left', "text-anchor": "start", "font-size": Math.round(8+4*pixel), "font-weight": "bold"});
	bm2 = det[id + "msg2"].getBBox();
	
	det[id + "sent1"].attr({x: winx-500, y: bm2.y - bs1.height/2 -8 , "text-align": 'left', "text-anchor": "start", "font-size": Math.round(8+4*pixel), "font-style": "italic"});
	bs1 = det[id + "sent1"].getBBox();
	
	det[id + "msg1"].attr({x: winx-500, y: bs1.y - bm1.height/2 -8 , "text-align": 'left', "text-anchor": "start", "font-size": Math.round(8+4*pixel), "font-weight": "bold"});
	bm1 = det[id + "msg1"].getBBox();
	
	/*  box  */
	det[id + "box"] = R.rect(bm1.x-4-2*pixel, bm1.y-4-2*pixel, 500+4*pixel, bs2.height+bs1.height+bm2.height+bm1.height+lt.height+37+4*pixel, 2+pixel)
		.attr({fill: "#F8F8F8 ", "fill-opacity": 0.8, "stroke": colour, "stroke-width": 1+pixel, "opacity": 1});
	
	det[id + "sent2"].toFront();
	det[id + "msg2"].toFront();
	det[id + "sent1"].toFront();
	det[id + "msg1"].toFront();
	det[id + "link"].toFront();
	det[id + "link"].attr({"href" : link});

	return shift_height += bs2.height + bm2.height + bs1.height + bm1.height + lt.height + 44;
	
}

function existsInfluenceRelation(from, to) {
	var rel = phils.ph[from].to[to];
	return rel !== undefined;

}

/*  ANNOTATIONS  */

function showAnnotations(citedPh, citingPh) {
	
		var annotations = phils.ph[citedPh].annotations;
		var colour = ph[i].hex;
		if (annotations !== undefined) {
			var citationAnnotations = annotations[citingPh];
			if (citationAnnotations !== undefined) {
				
				var j = 0;
				var n = 0;
				var buffLength = 1;
				var annotationsBuffer = [];
				annotationsBuffer[j] = {};
				for (ca in citationAnnotations) {
					annotationsBuffer[j][ca] = citationAnnotations[ca];
					n++;
					if (n % buffLength == 0) {
						j++;
						annotationsBuffer[j] = {};
					}
				}
				
				showAnnotationsBuffer(annotationsBuffer, citedPh, citingPh, n, 0);
				
			} else {
				hideDetail();
				showMessage("msg", "No annotations currently show evidence that\n" + phils.ph[citedPh].name + " influenced " + phils.ph[citingPh].name, colour, 0);
			}
		
 		} else {
			hideDetail();
			showMessage("msg", "No annotations currently show evidence that\n" + phils.ph[citedPh].name + " influneced " + phils.ph[citingPh].name, colour, 0);
		}
	
}

function getTitleFromWikiSourceLink(link) {
	var title = link.split("wiki/")[link.split("wiki/").length - 1];
	while (title.indexOf("_")!==-1) {
		title = title.replace("_", " ");
	}
	while (title.indexOf("/")!==-1) {
		title = title.replace("/", " - ");
	}
	return decodeURI(title);
}

function showAnnotationsBuffer(buffer, citedPh, citingPh, cont, pagination) {
	var colour = ph[i].hex;
	var shift_height = 0;
	var citationAnnotations = buffer[pagination];
	hideDetail();
	for (ca in citationAnnotations) {
		
		var message1 = "";
		var sentence1 = "";
		var message2 = "";
		var sentence2 = "";
		if (citationAnnotations[ca].annotated_target_sentence !== undefined) {
			message1 =  "According to " + citationAnnotations[ca].annotator + " the following text from " + phils.ph[citingPh].name;
			sentence1 =	wrapString(shortenString(citationAnnotations[ca].annotated_sentence)) + " [from: " + getTitleFromWikiSourceLink(citationAnnotations[ca].page) + "]";
			message2 =  citationAnnotations[ca].rel + " the following text from " + phils.ph[citedPh].name; 
			sentence2 =	wrapString(shortenString(citationAnnotations[ca].annotated_target_sentence)) + " [from: " + getTitleFromWikiSourceLink(citationAnnotations[ca].target_page) + "]";
		} else {
			message1 =  "According to " + citationAnnotations[ca].annotator  + " the following text from " + phils.ph[citingPh].name;
			sentence1 = wrapString(shortenString(citationAnnotations[ca].annotated_sentence)) + " [from: " + getTitleFromWikiSourceLink(citationAnnotations[ca].page) + "]"; 
			message2 = citationAnnotations[ca].rel;
			sentence2 = phils.ph[citedPh].name;
		}
		
		var link = citationAnnotations[ca].page; 
		shift_height = showSingleAnnotation(ca, message1, sentence1, message2, sentence2 ,link, colour, shift_height);
		
	}
	if (buffer[pagination+2] !== undefined) {
		showNextButton("next", colour, cont, pagination + 1, buffer, citedPh, citingPh, shift_height);
	}
	if (buffer[pagination-1] !== undefined) {
		showPrevButton("prev", colour, cont, pagination - 1, buffer, citedPh, citingPh, shift_height);
	}
	if (cont == 1) {
		showMessage("msg", "1 annotation shows evidence that\n" + phils.ph[citedPh].name + " influenced " + phils.ph[citingPh].name, colour, shift_height);
	} else {
		showMessage("msg", (pagination + 1) + " of " + cont + " annotations showing evidence that\n" + phils.ph[citedPh].name + " influenced " + phils.ph[citingPh].name, colour, shift_height);	
	}
	
	
}

function showNextButton(id, colour, cont, pag, annotationsBuffer, citedPh, citingPh, shift_height) {
	
	det[id] = R.text(winx, winy, "Next >>");
	bm = det[id].getBBox();
		
	det[id].attr({x: winx-40, y: winy-bm.height/2-2-8*pixel - shift_height, "text-align": 'left', "text-anchor": "start", "font-size": Math.round(6+4*pixel), "font-weight": "bold"});
	bm = det[id].getBBox();
	
	/*  box  */
	det[id + "box"] = R.rect(bm.x-4-2*pixel, bm.y-4-2*pixel, 40+4*pixel, bm.height+4+4*pixel, 2+pixel)
		.attr({fill: "#B8B8B8", "fill-opacity": 0.9, "stroke": colour, "stroke-width": 1+pixel, "opacity": 1});
	
	det[id].toFront();
	det[id].node.onclick = function() {showAnnotationsBuffer(annotationsBuffer, citedPh, citingPh, cont, pag)};
	det[id].node.mouseover = function() {};
	det[id].node.style.cursor = "pointer";

	return shift_height += bm.height + 5;
	
}
function showPrevButton(id, colour, cont, pag, annotationsBuffer, citedPh, citingPh, shift_height) {
	
	det[id] = R.text(winx, winy, "<< Prev");
	bm = det[id].getBBox();
		
	det[id].attr({x: winx-500, y: winy-bm.height/2-2-8*pixel - shift_height, "text-align": 'left', "text-anchor": "start", "font-size": Math.round(6+4*pixel), "font-weight": "bold"});
	bm = det[id].getBBox();
	
	/*  box  */
	det[id + "box"] = R.rect(bm.x-4-2*pixel, bm.y-4-2*pixel, 45+4*pixel, bm.height+4+4*pixel, 2+pixel)
		.attr({fill: "#B8B8B8", "fill-opacity": 0.9, "stroke": colour, "stroke-width": 1+pixel, "opacity": 1});
	
	det[id].toFront();
	det[id].node.onclick = function() {showAnnotationsBuffer(annotationsBuffer, citedPh, citingPh, cont, pag)};
	det[id].node.mouseover = function() {};
	det[id].node.style.cursor = "pointer";

	return shift_height += bm.height + 5;
	
}

/*  DETAIL  */

function showDetail(i)
{
	// return;
	
	var colour = ph[i].hex;
	
	var p = ph[i].pos; if (map_view==false) p = ph[i].tpos;
	
	/*  txt  */
	det["txt"] = R.text(winx, winy, ph[i].abstract);
	det.txt.attr({"font-size": Math.round(8+4*pixel), "text-anchor": "start"});

	var bt = det.txt.getBBox();
	det.txt.attr({x: winx-bt.width-8-8*pixel, y: winy-bt.height/2-8-8*pixel, "text-align": 'left'});
	bt = det.txt.getBBox();

	/*  box  */
	det["box"] = R.rect(bt.x-4-2*pixel, bt.y-4-2*pixel, bt.width+8+4*pixel, bt.height+8+4*pixel, 2+pixel)
		.attr({fill: "#fff", "fill-opacity": 0.9, "stroke": colour, "stroke-width": 1+pixel, "opacity": 1});
	// det.box.animate({opacity: 1}, speed);
	det.txt.toFront();
	
	/*  image  */
	bt = det.txt.getBBox();
	var imgw = Math.round(bt.height*0.8), imgh = Math.round(bt.height);
	
    if (ph[i].img_guid!=="" && ph[i].img_guid!==null)
	{
		det["img"] = R.image("https://usercontent.googleapis.com/freebase/v1/image/guid/"+ph[i].img_guid+
			"?mode=fillcrop&maxwidth=160&maxheight=200", bt.x-imgw-6-2*pixel, bt.y, imgw, imgh);//.attr("opacity", 0);
		
		var bb = det.box.getBBox();
		
		det.box.attr({width: bb.width+imgw+6+2*pixel, opacity: 1, x: bb.x-imgw-6-2*pixel});
		//.animate({opacity: 1}, speed);;
		det.img.attr({cursor: "pointer", opacity: 1}); //.animate({opacity: 1}, speed);
		
		(function (img,i) {
			img.node.onclick = function () { window.open('http://www.freebase.com/view'+i); };
	  })(det.img,i);			
	}
	
}

function hideDetail()
{
	det_id = false;

	// if (ox(det.box)) det.box.animate({opacity: 0}, speed, function(){this.remove();});
	// if (ox(det.txt)) det.txt.animate({opacity: 0}, speed, function(){this.remove();});
	// if (ox(det.img)) det.img.animate({opacity: 0}, speed, function(){this.remove();});
	
	for (el in det) {
		det[el].remove();
	}
	
//	if (ox(det.box)) det.box.remove();
//	if (ox(det.txt)) det.txt.remove();
//	if (ox(det.img)) det.img.remove();
	
}

function frontDetail()
{
	if (ox(det.box)) det.box.toFront();
	if (ox(det.txt)) det.txt.toFront();
	if (ox(det.img)) det.img.toFront();		
}

function preloadImages()
{
	for (i in ph)
	{
		if (ph[i].img_guid!=="" && ph[i].img_guid!==null)
		{
			var tmp = R.image("https://usercontent.googleapis.com/freebase/v1/image/guid/"+ph[i].img_guid+
				"?mode=fillcrop&maxwidth=160&maxheight=200", 0, 0, 160, 200);
			tmp.remove();
		}
	}
}


/*  COLOUR MODIFICATION  */

/*  from: http://matthaynes.net/blog/2008/08/07/javascript-colour-functions/  */
function hsvToRgb(h,s,v) {  
   var s = s / 100, v = v / 100;  
 
   var hi = Math.floor((h/60) % 6);  
   var f = (h / 60) - hi;  
   var p = v * (1 - s);  
   var q = v * (1 - f * s);  
   var t = v * (1 - (1 - f) * s);  
 
   var rgb = [];  
 
   switch (hi) {  
       case 0: rgb = [v,t,p];break;  
       case 1: rgb = [q,v,p];break;  
       case 2: rgb = [p,v,t];break;  
       case 3: rgb = [p,q,v];break;  
       case 4: rgb = [t,p,v];break;  
       case 5: rgb = [v,p,q];break;  
   }  
 
   var r = Math.min(255, Math.round(rgb[0]*256)),  
       g = Math.min(255, Math.round(rgb[1]*256)),  
       b = Math.min(255, Math.round(rgb[2]*256));  
 
   return [r,g,b];  
}

function intToHex(i) {  
    var hex = parseInt(i).toString(16);  
    return (hex.length < 2) ? "0" + hex : hex;  
}  



/*  HELPERS  */

function radius(i)
{
	var a =  0.7 * (ph[i].to_count / data.to_max + ph[i].fr_count / data.fr_max) * r_max * pixel + r_min;
	return Math.sqrt(a/Math.PI);
}

function distance (p1, p2)
{
	return Math.sqrt( (p2.x-p1.x)*(p2.x-p1.x) + (p2.y-p1.y)*(p2.y-p1.y) ) ;
}

function sortByYear(a,b)
{
	return ph[a].birthyear - ph[b].birthyear;
}

function sortNumber(a,b)
{
	return a - b;
}


/*  raph object exists  */
function ox(obj)
{
	return (typeof(obj)!=="undefined" && typeof(obj.node)!=="undefined" && obj.node.parentNode!==null);	
}

// LCD game JavaScript library
// Bas de Reuver (c)2018

// -------------------------------------
// game object
// -------------------------------------
LCDGame.Game = function (configfile, metadatafile) {

	this.gamedata = [];
	this.imageBackground = null;
	this.imageShapes = null;
	this.score = 0;
	this.gametype = 0;
	this.level = 0;
	this.soundmute = false;
	
	// site lock, enable for no hotlinking
/*
	var domain = document.domain;
	siteLock = false;
	var siteLock = (domain.indexOf("bdrgames.nl") == -1);
	if (siteLock) {
		document.write('To play LCD game simulations, please visit: <a href="http://www.bdrgames.nl/lcdgames/">http://www.bdrgames.nl/lcdgames/</a>');
		console.log('%c To play LCD game simulations, please visit: http://www.bdrgames.nl/lcdgames/', 'background: #000; color: #0f0'); // cool hax0r colors ;)
		return;
	};
*/

	// initialise object
	this.countimages = 0;
	this.scaleFactor = 1.0;

	this.imageBackground = new Image();
	this.imageShapes = new Image();

	// events after loading image
	if (this.imageBackground.addEventListener) {
		// chrome, firefox
		this.imageBackground.addEventListener("load", this.onImageLoaded.bind(this));
		this.imageBackground.addEventListener("error", this.onImageError.bind(this));
		this.imageShapes.addEventListener("load", this.onImageLoaded.bind(this));
		this.imageShapes.addEventListener("error", this.onImageError.bind(this));
	}
	else {
		// IE8
		this.imageBackground.attachEvent("load", this.onImageLoaded.bind(this));
		this.imageBackground.attachEvent("error", this.onImageError.bind(this));
		this.imageShapes.attachEvent("load", this.onImageLoaded.bind(this));
		this.imageShapes.attachEvent("error", this.onImageError.bind(this));
	};

// create canvas element and add to document
	var str =
		MENU_HTML + 
		SCORE_HTML;

	document.write(str);

	this.canvas = document.getElementById("mycanvas");
	this.infobox = document.getElementById("infobox");
	this.scorebox = document.getElementById("scorebox");
	this.infocontent = document.getElementById("infocontent");
	this.scorecontent = document.getElementById("scorecontent");
	
	// get context of canvas element
	this.context2d = this.canvas.getContext("2d");
		
	// state manager
	this.state = new LCDGame.StateManager(this);
	
	// request animation frame
	this.raf = new LCDGame.AnimationFrame(this);

	this.timers = [];

	// add gamedata and populate by loading json
	this.loadConfig(configfile);
	metadatafile = (metadatafile || "metadata/gameinfo.json");
	this.loadMetadata(metadatafile);
	
	// mouse or touch input
	this._touchdevice = false;
	//this._mousedevice = false

	return this;
}

LCDGame.Game.prototype = {
	// -------------------------------------
	// background ans shapes images loaded
	// -------------------------------------
	onImageLoaded: function() {
		// max two images
		this.countimages++;
		// check if both background and shapes images were loaded
		if (this.countimages >= 2) {
			this.initGame();
		};
	},

	onImageError: function() {
		// handle error
		console.log("** ERROR ** lcdgame.js - onImageError.");
	},

	// -------------------------------------
	// load a game configuration file
	// -------------------------------------
	loadConfig: function(path) {
		
		var xhrCallback = function()
		{
			if (xhr.readyState === XMLHttpRequest.DONE) {
				if ((xhr.status === 200) || (xhr.status === 0)) {
					this.onConfigLoad(JSON.parse(xhr.responseText));
				} else {
					this.onConfigError(xhr);
				}
			}
		};
	
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = xhrCallback.bind(this);

		xhr.open("GET", path, true);
		xhr.send();
	},

	// -------------------------------------
	// start game
	// -------------------------------------
	onConfigLoad: function(data) {
		// load all from JSON data
		this.gamedata = data;

		// set images locations will trigger event onImageLoaded
		this.imageBackground.src = data.imgback;
		this.imageShapes.src = data.imgshapes;
	
		// add custom lcdgame.js properties for use throughout the library
		for (var i = 0; i < this.gamedata.frames.length; i++) {

			// add current/previous values to all shape objects
			this.gamedata.frames[i].value = false;
			this.gamedata.frames[i].valprev = false;
			
			// add type
			this.gamedata.frames[i].type = "shape";
		};

		// prepare sequences
		for (var s = 0; s < this.gamedata.sequences.length; s++) {
			// shape indexes
			this.gamedata.sequences[s].ids = [];

			// find all frames indexes
			for (var f = 0; f < this.gamedata.sequences[s].frames.length; f++) {
				var filename = this.gamedata.sequences[s].frames[f];
				var idx = this.shapeIndexByName(filename);
				this.gamedata.sequences[s].ids.push(idx);
			};
		};

		// prepare digits
		for (var d = 0; d < this.gamedata.digits.length; d++) {
			// shape indexes
			this.gamedata.digits[d].ids = [];
			this.gamedata.digits[d].locids = [];

			// find all digit frames indexes
			for (var f = 0; f < this.gamedata.digits[d].frames.length; f++) {
				var filename = this.gamedata.digits[d].frames[f];
				var idx = this.shapeIndexByName(filename);
				this.gamedata.digits[d].ids.push(idx);
				// set shape types
				if (idx != -1) {
					this.gamedata.frames[idx].type = "digit";
				};
			};

			// find all digit locations
			for (var l = 0; l < this.gamedata.digits[d].locations.length; l++) {
				var filename = this.gamedata.digits[d].locations[l];
				var idx = this.shapeIndexByName(filename);
				this.gamedata.digits[d].locids.push(idx);
			};
			// set max
			var str = this.gamedata.digits[d].max || "";
			if (str == "") {
				for (var c = 0; c < this.gamedata.digits[d].locids.length; c++) { str += "8"}; // for example "8888"
				this.gamedata.digits[d].max = str;
			}
		};
		
		// prepare buttons keycodes
		for (var b=0; b < this.gamedata.buttons.length; b++) {
		
			// shape indexes
			this.gamedata.buttons[b].ids = [];
			
			// button area
			var xmin = 1e4;
			var ymin = 1e4;
			var xmax = 0;
			var ymax = 0;

			// find all button frames indexes
			for (var f = 0; f < this.gamedata.buttons[b].frames.length; f++) {
				var filename = this.gamedata.buttons[b].frames[f];
				var idx = this.shapeIndexByName(filename);
				this.gamedata.buttons[b].ids.push(idx);
				// keep track of position and width/height
				var spr = this.gamedata.frames[idx].spriteSourceSize;
				if (spr.x < xmin)         xmin = spr.x;
				if (spr.y < ymin)         ymin = spr.y;
				if (spr.x + spr.w > xmax) xmax = spr.x + spr.w;
				if (spr.y + spr.h > ymax) ymax = spr.y + spr.h;
			};

			// typically buttons are small, so make size of touch area 3x as big
			var wh = (xmax - xmin);
			var hh = (ymax - ymin);
			var xmin = xmin - wh;
			var ymin = ymin - hh;
			var xmax = xmax + wh;
			var ymax = ymax + hh;

			var xcenter = (xmin + xmax) / 2.0;
			var ycenter = (ymin + ymax) / 2.0;

			// button touch area
			this.gamedata.buttons[b].area = {"x1":xmin, "y1":ymin, "x2":xmax, "y2":ymax, "xc":xcenter, "yc":ycenter};

			// default keycodes
			var defkey = this.gamedata.buttons[b].name;
			if (typeof this.gamedata.buttons[b].defaultkeys !== "undefined") {
				defkey = this.gamedata.buttons[b].defaultkeys;
			};
			this.gamedata.buttons[b].keycodes = this.determineKeyCodes(defkey);
		};
		
		// fix overlaps in button touch areas
		for (var b1=0; b1 < this.gamedata.buttons.length-1; b1++) {
			for (var b2=b1+1; b2 < this.gamedata.buttons.length; b2++) {
				// check if overlap
				if (
					   (this.gamedata.buttons[b1].area.x1 < this.gamedata.buttons[b2].area.x2) // horizontal overlap
					&& (this.gamedata.buttons[b1].area.x2 > this.gamedata.buttons[b2].area.x1)
					&& (this.gamedata.buttons[b1].area.y1 < this.gamedata.buttons[b2].area.y2) // vertical overlap
					&& (this.gamedata.buttons[b1].area.y2 > this.gamedata.buttons[b2].area.y1)
				) {
					// get center points of each area
					var xc1 = this.gamedata.buttons[b1].area.xc;
					var yc1 = this.gamedata.buttons[b1].area.yc;
					var xc2 = this.gamedata.buttons[b2].area.xc;
					var yc2 = this.gamedata.buttons[b2].area.yc;
					
					// rectract to left, right, up, down
					if ( Math.abs(xc1 - xc2) > Math.abs(yc1 - yc2) ) {
						if (xc1 > xc2) { // b1 is to the right of b2
							var dif = (this.gamedata.buttons[b1].area.x1 - this.gamedata.buttons[b2].area.x2) / 2;
							this.gamedata.buttons[b1].area.x1 -= dif;
							this.gamedata.buttons[b2].area.x2 += dif;
						} else { // b1 is to the left of b2
							var dif = (this.gamedata.buttons[b1].area.x2 - this.gamedata.buttons[b2].area.x1) / 2;
							this.gamedata.buttons[b1].area.x2 -= dif;
							this.gamedata.buttons[b2].area.x1 += dif;
						}
					} else {
						if (yc1 > yc2) { // b1 is below b2
							var dif = (this.gamedata.buttons[b1].area.y1 - this.gamedata.buttons[b2].area.y2) / 2;
							this.gamedata.buttons[b1].area.y1 -= dif;
							this.gamedata.buttons[b2].area.y2 += dif;
						} else { // b1 is above b2
							var dif = (this.gamedata.buttons[b1].area.y2 - this.gamedata.buttons[b2].area.y1) / 2;
							this.gamedata.buttons[b1].area.y2 -= dif;
							this.gamedata.buttons[b2].area.y1 += dif;
						}
					}
				}
			};
		};
	},

	onConfigError: function(xhr) {
		console.log("** ERROR ** lcdgame.js - onConfigError: error loading json file");
		console.error(xhr);
	},

	// -------------------------------------
	// load a metadata file
	// -------------------------------------
	loadMetadata: function(path) {
		var xhrCallback = function()
		{
			if (xhr.readyState === XMLHttpRequest.DONE) {
				if ((xhr.status === 200) || (xhr.status === 0)) {
					this.onMetadataLoad(JSON.parse(xhr.responseText));
				} else {
					this.onMetadataError(xhr);
				}
			}
		};
	
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = xhrCallback.bind(this);

		xhr.open("GET", path, true);
		xhr.send();
	},

	tinyMarkDown: function(str) {
		// \n => <br/>
		str = str.replace(/\n/gi, "<br/>");

		// *bold* => <b>bold</b>
		str = str.replace(/\*.*?\*/g, function(foo){
			return "<b>"+foo.slice(1, -1)+"</b>";
		});
		
		// _italic_ => <i>italic</i>
		str = str.replace(/\_.*?\_/g, function(foo){
			return "<i>"+foo.slice(1, -1)+"</i>";
		});
		
		// [button] => <btn>button</btn>
		str = str.replace(/\[(?:(?!\[).)*?\](?!\()/g, function(foo){
			return "<btn>"+foo.slice(1, -1)+"</btn>";
		});
		
		// hyperlinks [url text](www.test.com) => <a href="http://www.test.com">url text</a>
		str = str.replace(/(\[(?:(?!\[).)*?\])(\((?:(?!\().)*?\))/g, function(all, fst, sec, pos){
			var url = sec.slice(1, -1);
			if (url.indexOf("http") != 0) url = "http://" + url;
			var txt = fst.slice(1, -1);
			return '<a href="' + url + '">' + txt + '</a>';
		});
		
		return str;
	},

	// -------------------------------------
	// metadata load JSON file
	// -------------------------------------
	onMetadataLoad: function(data) {
		// load all from JSON data
		this.metadata = data;
		
		// infobox content
		var instr = this.tinyMarkDown(data.gameinfo.instructions.en);
		this.infocontent.innerHTML = "<h1>How to play</h1><br/>" + instr;

		// get info from metadata
		var title = data.gameinfo.device.title
		var gametypes = data.gameinfo.gametypes;
		this.gametype = (typeof gametypes === "undefined" ? 0 : 1);

		// highscores
		this.highscores = new LCDGame.HighScores(this, title, gametypes);
		this.highscores.init(this.gametype);
	},

	onMetadataError: function(xhr) {
		console.log("** ERROR ** lcdgame.js - onMetadataError: error loading json file");
		console.error(xhr);
	},

	resizeCanvas: function() {

		// determine which is limiting factor for current window/frame size; width or height
		var scrratio = window.innerWidth / window.innerHeight;
		var imgratio = this.canvas.width / this.canvas.height;
		
		// determine screen/frame size
		var w = this.canvas.width;
		var h = this.canvas.height;

		if (imgratio > scrratio) {
			// width of image should take entire width of screen
			w = window.innerWidth;
			this.scaleFactor = w / this.canvas.width;
			h = this.canvas.height * this.scaleFactor;

			// set margins for full height
			var ymargin = (window.innerHeight - h) / 2;
			this.canvas.style["margin-top"] = ymargin+"px";
			this.canvas.style["margin-bottom"] = -ymargin+"px";
			this.canvas.style["margin-left"] = "0px";
		} else {
			// height of image should take entire height of screen
			h = window.innerHeight;
			this.scaleFactor = h / this.canvas.height;
			w = this.canvas.width * this.scaleFactor;

			// set margins for full height
			var xmargin = (window.innerWidth - w) / 2;
			this.canvas.style["margin-left"] = xmargin+"px";
			this.canvas.style["margin-right"] = -xmargin+"px";
			this.canvas.style["margin-top"] = "0px";
		}
		
		// set canvas size
		this.canvas.style.width = w+"px";
		this.canvas.style.height = h+"px";

		// set canvas properties
		this.canvas.style.display = "block";
		this.canvas.style["touch-action"] = "none"; // no text select on touch
		this.canvas.style["user-select"] = "none"; // no text select on touch
		this.canvas.style["-webkit-tap-highlight-color"] = "rgba(0, 0, 0, 0)"; // not sure what this does 
		
		// center infobox
		this.resizeInfobox(this.infobox);
		this.resizeInfobox(this.scorebox);
	},
	
	resizeInfobox: function(box) {

		// set visible, else width height doesn't work
		box.style.display = "inherit";

		// determine screen/frame size
		var w = box.offsetWidth;
		var h = box.offsetHeight;
		var rect = box.getBoundingClientRect();
		if (rect) {
			w = rect.width;
			h = rect.height;
		};

		var xmargin = (window.innerWidth - w) / 2;
		var ymargin = (window.innerHeight - h) / 2;

		// set margins for full height
		box.style["margin-left"] = xmargin+"px";
		box.style["margin-right"] = -xmargin+"px";
		box.style["margin-top"] = ymargin+"px";
		box.style["margin-bottom"] = -ymargin+"px";
		
		// reset visibility
		box.style.display = "none";
	},

	// -------------------------------------
	// start the specific game
	// -------------------------------------
	initGame: function() {
		// no scrollbars
		document.body.scrollTop = 0;
		document.body.style.overflow = 'hidden';
	
		// initialise canvas
		this.canvas.width = this.imageBackground.width;
		this.canvas.height = this.imageBackground.height;

		this.context2d.drawImage(this.imageBackground, 0, 0);
		
		// prepare sounds
		for (var i=0; i < this.gamedata.sounds.length; i++) {
			var strfile = this.gamedata.sounds[i].filename;
			this.gamedata.sounds[i].audio = new Audio(strfile);
			this.gamedata.sounds[i].audio.load();
		};
		
		// mouse or touch input
        //if (window.navigator.msPointerEnabled || window.navigator.pointerEnabled)
        //{
        //    this._mousedevice = true;
        //};
	
        if ('ontouchstart' in document.documentElement || (window.navigator.maxTouchPoints && window.navigator.maxTouchPoints >= 1))
        {
            this._touchdevice = true;
        };

		// bind input
		if (document.addEventListener) { // chrome, firefox
			// mouse/touch
			this.canvas.addEventListener("mousedown", this.onmousedown.bind(this), false);
			this.canvas.addEventListener("mouseup",   this.onmouseup.bind(this), false);
			// keyboard
			document.addEventListener("keydown", this.onkeydown.bind(this), false);
			document.addEventListener("keyup",   this.onkeyup.bind(this), false);
			
			if (this._touchdevice) {
				this.canvas.addEventListener("touchstart", this.ontouchstart.bind(this), false);
				this.canvas.addEventListener("touchend",   this.ontouchend.bind(this), false);
			};

		} else { // IE8
			// mouse/touch
			this.canvas.attachEvent("mousedown", this.onmousedown.bind(this));
			this.canvas.attachEvent("mouseup",   this.onmouseup.bind(this));
			// keyboard
			document.attachEvent("keydown", this.onkeydown.bind(this));
			document.attachEvent("keyup",   this.onkeyup.bind(this));
		};

		// real time resize
		window.addEventListener("resize", this.resizeCanvas.bind(this), false);

		// center position
		this.resizeCanvas();
		
		displayInfobox();

		this.raf.start();

		console.log("lcdgame.js v" +  LCDGAME_VERSION + " :: start");
	},

	// -------------------------------------
	// timers and game loop
	// -------------------------------------
	addtimer: function(context, callback, ms, waitfirst) {

		// after .start() do instantly start callbacks (true), or wait the first time (false), so:
		// true  => .start() [callback] ..wait ms.. [callback] ..wait ms.. etc.
		// false => .start() ..wait ms.. [callback] ..wait ms.. [callback] etc.
		if (typeof waitfirst === "undefined") waitfirst = true;

		// add new timer object
		var tim = new LCDGame.Timer(context, callback, ms, waitfirst);
		
		this.timers.push(tim);
		
		return tim;
	},

	cleartimers: function() {
		// clear all timers
		for (var t=0; t < this.timers.length; t++) {
			this.timers[t].pause();
			this.timers[t] = null;
		};
		this.timers = [];
	},
	
	updateloop: function(timestamp) {

		// check all timers
		for (var t=0; t < this.timers.length; t++) {
			if (this.timers[t].enabled) {
				this.timers[t].update(timestamp);
			};
		};
		
		// any shapes updates
		if (this._refresh) {
			this.shapesRefresh();
			this._refresh = false;
		};
	},

	gameReset: function(gametype) {
		// new game reset variables
		this.score = 0;
		this.level = 0;
		this.gametype = gametype;
	},

	// -------------------------------------
	// sound effects
	// -------------------------------------
	loadSoundEffects: function() {
		// handle error
		console.log("loadSoundEffects - TODO load sound effects");
	},

	setSoundMute: function (value) {
		this.soundmute = value;
	},

	soundIndexByName: function (name) {
		var idx = 0;
		for (var i = 0; i < this.gamedata.sounds.length; i++) {
			if (this.gamedata.sounds[i].name == name) {
				return i;
			};
		};
		return -1;
	},

	playSoundEffect: function (name) {
		
		// device sound is not muted
		if (!this.soundmute) {
			// get sound index from name
			var idx = this.soundIndexByName(name);
			
			// if sound exists
			if (idx >= 0) {
				// if sound is playing then stop it now
				if (this.gamedata.sounds[idx].audio.paused == false) {
					this.gamedata.sounds[idx].audio.pause();
					// fix for IE11
					if (!isNaN(this.gamedata.sounds[idx].audio.duration)) {
						this.gamedata.sounds[idx].audio.currentTime = 0;
					};
				};
				// start playing sound
				this.gamedata.sounds[idx].audio.play();
			};
		};
	},

	// -------------------------------------
	// random integer
	// -------------------------------------
	randomInteger: function(min, max) {
		max = max - min + 1;
		var r = Math.floor(Math.random() * max) + min;
		return r;
	},

	// -------------------------------------
	// function for shapes and sequences
	// -------------------------------------
	shapeIndexByName: function(name) {
		for (var i = 0; i < this.gamedata.frames.length; i++) {
			if (this.gamedata.frames[i].filename == name)
				return i;
		}
		console.log("** ERROR ** shapeIndexByName('"+name+"') - filename not found.");
		// if not found return -1
		throw "lcdgames.js - "+arguments.callee.caller.toString()+", no frame with filename '" + name + "'";
		return -1;
	},

	setShapeByName: function(filename, value) {
		// if called too soon
		if (this.gamedata.frames) {
			// find shape 
			for (var i = 0; i < this.gamedata.frames.length; i++) {
				if (this.gamedata.frames[i].filename == filename) {
					this.gamedata.frames[i].value = value;
					this._refresh = true;
					return true;
				};
			};
		};
		return false;
	},
	
	setShapeByIdx: function(idx, value) {
		this.gamedata.frames[idx].value = value;
		this._refresh = true;
		return true;
	},
	
	sequenceIndexByName: function(name) {
		if (this.gamedata.sequences) {
			for (var i = 0; i < this.gamedata.sequences.length; i++) {
				if (this.gamedata.sequences[i].name == name)
					return i;
			}
			console.log("** ERROR ** sequenceIndexByName('"+name+"') - sequence name not found.");
			// if not found return -1
			throw "lcdgames.js - "+arguments.callee.caller.toString()+", no sequence with name '" + name + "'";
		};
		return -1;
	},

	sequenceResetAll: function(name, value) {
		// value position is optional, default false
		if (typeof value === "undefined") value = false;

		// get sequence index of name
		var seqidx = this.sequenceIndexByName(name);

		// shift shape values one place DOWN
		for (var i = 0; i < this.gamedata.sequences[seqidx].ids.length; i++) {
			// get shape index in this sequence
			var shape = this.gamedata.sequences[seqidx].ids[i];
			// clear all shapes in sequence
			this.gamedata.frames[shape].value = value;
		};
		// refresh display
		this._refresh = true;
	},

	sequenceClear: function(name) {
		// reset sequence to false
		this.sequenceResetAll(name);
	},

	sequenceShift: function(name, max) {
		// example start [0] [1] [.] [3] [.] (.=off)
		//        result [.] [1] [2] [.] [4]
		
		// get sequence index of name
		var seqidx = this.sequenceIndexByName(name);

		// max position is optional
		if (typeof max === "undefined") max = this.gamedata.sequences[seqidx].ids.length;

		// shift shape values one place DOWN
		var i;
		var ret = false;
		for (i = max-1; i > 0; i--) {
			// get shape indexes of adjacent shapes in this sequence
			var shape1 = this.gamedata.sequences[seqidx].ids[i-1];
			var shape2 = this.gamedata.sequences[seqidx].ids[i];
			
			// return value
			if (i == (max-1)) ret = this.gamedata.frames[shape2].value;

			// shift shape values DOWN one place in sequence
			this.gamedata.frames[shape2].value = this.gamedata.frames[shape1].value;
		};
		// set first value to blank; default value false
		var shape1 = this.gamedata.sequences[seqidx].ids[0];
		this.gamedata.frames[shape1].value = false;

		// refresh display
		this._refresh = true;
		
		// return value, was the last value that was "shifted-out" true or false
		return ret;
	},

	sequenceShiftReverse: function(name, min) {
		// example start [.] [1] [.] [3] [4] (.=off)
		//        result [0] [.] [2] [3] [.]

		// get sequence index of name
		var seqidx = this.sequenceIndexByName(name);
		
		// min position is optional
		if (typeof min === "undefined") min = 0;

		// shift shape values one place UP
		var i;
		for (i = min; i < this.gamedata.sequences[seqidx].ids.length-1; i++) {
			// get shape indexes of adjacent shapes in this sequence
			var shape1 = this.gamedata.sequences[seqidx].ids[i];
			var shape2 = this.gamedata.sequences[seqidx].ids[i+1];
			// shift shape values UP one place in sequence
			this.gamedata.frames[shape1].value = this.gamedata.frames[shape2].value;
		};
		// set last value to blank; default value false
		var shape1 = this.gamedata.sequences[seqidx].ids[i];
		this.gamedata.frames[shape1].value = false;
		// refresh display
		this._refresh = true;
	},

	sequenceSetFirst: function(name, value) {
		// get sequence
		var seqidx = this.sequenceIndexByName(name);

		// set value for first shape in sequence
		var shape1 = this.gamedata.sequences[seqidx].ids[0];
		this.gamedata.frames[shape1].value = value;
		// refresh display
		this._refresh = true;
	},

	sequenceSetPos: function(name, pos, value) {
		if (this.gamedata.sequences) {
			// get sequence
			var seqidx = this.sequenceIndexByName(name);

			// if pos is -1, then last last position
			if (pos == -1) {pos = this.gamedata.sequences[seqidx].ids.length-1};

			// if pos out of bound of sequence array
			if (pos < this.gamedata.sequences[seqidx].ids.length) {
				// set value for position shape in sequence
				var shape1 = this.gamedata.sequences[seqidx].ids[pos];
				this.gamedata.frames[shape1].value = value;

				// refresh display
				this._refresh = true;
			};
		}
	},

	shapeVisible: function(name) {
		// find shape 
		for (var i = 0; i < this.gamedata.frames.length; i++) {
			if (this.gamedata.frames[i].filename == name) {
				if (this.gamedata.frames[i].value == true) {
					return true;
				};
			};
		};
		return false;
	},
	
	sequenceShapeVisible: function(name, pos) {
		// get sequence
		var seqidx = this.sequenceIndexByName(name);

		// single pos or any pos
		if (typeof pos === "undefined") {
			// no pos given, check if any shape visible
			for (var i = 0; i < this.gamedata.sequences[seqidx].ids.length; i++) {
				// check if any shape is visible (value==true)
				var shape1 = this.gamedata.sequences[seqidx].ids[i];
				if (this.gamedata.frames[shape1].value == true) {
					return true;
				};
			};
		} else {
			// if pos is -1, then last last position
			if (pos == -1) {pos = this.gamedata.sequences[seqidx].ids.length-1};
			
			// if pos out of bound of sequence array
			if (pos < this.gamedata.sequences[seqidx].ids.length) {
				// check if shape is visible (value==true)
				var shape1 = this.gamedata.sequences[seqidx].ids[pos];
				if (this.gamedata.frames[shape1].value == true) {
					return true;
				};
			};
		};
		return false;
	},

	shapesDisplayAll: function(value) {

		if (this.gamedata.frames) {
			// all shapes
			for (var i = 0; i < this.gamedata.frames.length; i++) {
				// print out current values of sequence
				if ( (this.gamedata.frames[i].type == "shape") || (this.gamedata.frames[i].type == "digitpos") ) {
					this.gamedata.frames[i].value = value;
				};
			};
			// all digits
			if (value == true) {
				for (var i = 0; i < this.gamedata.digits.length; i++) {
					this.digitsDisplay(this.gamedata.digits[i].name, this.gamedata.digits[i].max);
				};
			};
			// refresh display
			this._refresh = true;
		};
	},

	// -------------------------------------
	// function for digits
	// -------------------------------------
	digitsDisplay: function(name, str, rightalign) {
		// not loaded yet
		if (!this.gamedata.digits) return;

		// get sequence
		var digidx = -1;
		for (var i = 0; i < this.gamedata.digits.length; i++) {
			if (this.gamedata.digits[i].name == name) {
				digidx = i;
				break;
			};
		};
		
		if (digidx == -1) {
			console.log("** ERROR ** digitsDisplay('"+name+"') - digits not found.");
			// if not found return -1
			throw "lcdgames.js - digitsDisplay, no digits with name '" + name + "'";
		} else {

			// align right parameter is optional, set default value
			//if (rightalign === "undefined") {rightalign = false};

			// set value for first shape in sequence
			var chridx = 0; // index of character in str
			var firstid = 0; // index of id in shape ids
			
			// exception for right-align
			if (rightalign == true) {
				firstid = this.gamedata.digits[digidx].locids.length - str.length;
				// if too many digits
				if (firstid < 0) {
					chridx = Math.abs(firstid); // skip left-most digit(s) of str
					firstid = 0;
				};
			};

			// example
			// placeholders [ ] [ ] [ ] [ ] [ ]
			// str " 456"   [ ] [4] [5] [6]
			// outcome should be
			// placeholders [.] [4] [5] [6] [.]  (.=empty/invisible)
			// firstid = index 1-^
			
			// adjust all shapes of digitplaceholders to display correct digits, and force them to refresh
			for (var i=0; i < this.gamedata.digits[digidx].locids.length; i++) {
				// shape of digitplaceholder
				var locidx = this.gamedata.digits[digidx].locids[i];
				
				// make non-used digit placeholders invisible
				if ( (i < firstid) || (chridx >= str.length) ) {
					// make non-used digit placeholders invisible
					this.gamedata.frames[locidx].value = false;
				} else {
					// 48 = ascii code for "0"
					var digit = str.charCodeAt(chridx) - 48;

					// check if valid digit				
					if ( (digit >= 0) && (digit < this.gamedata.digits[digidx].ids.length) ) {
						var digitshape = this.gamedata.digits[digidx].ids[digit]; // shape of digit
						
						// change the "from" part of the placeholder so it will draw the desired digit shape
						this.gamedata.frames[locidx].frame.x = this.gamedata.frames[digitshape].frame.x;
						this.gamedata.frames[locidx].frame.y = this.gamedata.frames[digitshape].frame.y;

						// make sure the placeholder (with new digit) gets re-drawn
						this.gamedata.frames[locidx].value = true;
					} else {
						// non-digit, example space (' ')
						this.gamedata.frames[locidx].value = false;
					};
					// next character in str
					chridx = chridx + 1;
				};
			};

			// refresh display
			this._refresh = true;
		};
	},
	
	// -------------------------------------
	// function for drawing and redrawing shapes 
	// -------------------------------------
	shapesRefresh: function() {

		// TODO: implement dirty rectangles?
		// FOR NOW: simply redraw everything
	
		if (this.gamedata.frames) {
			// redraw entire background (=inefficient)
			this.context2d.drawImage(this.imageBackground, 0, 0);
			
			// add current/previous values to all shape objects
			for (var i = 0; i < this.gamedata.frames.length; i++) {
				if (this.gamedata.frames[i].value == true) {
					this.shapeDraw(i);
				};
			};
			
			this.drawDebugText();

			// debugging show button areas
			//for (var i=0; i < this.gamedata.buttons.length; i++) {
			//	var x1 = this.gamedata.buttons[i].area.x1;
			//	var y1 = this.gamedata.buttons[i].area.y1;
			//	var x2 = this.gamedata.buttons[i].area.x2;
			//	var y2 = this.gamedata.buttons[i].area.y2;
			//	this.debugRectangle(x1, y1, (x2-x1), (y2-y1));
			//};
		};
		// display was refreshed
		this._refresh = false;
		
	},

	shapeDraw: function(index) {
		// draw shape
		this.context2d.drawImage(
			this.imageShapes,
			this.gamedata.frames[index].frame.x, // from
			this.gamedata.frames[index].frame.y,
			this.gamedata.frames[index].frame.w,
			this.gamedata.frames[index].frame.h,
			this.gamedata.frames[index].spriteSourceSize.x, // to
			this.gamedata.frames[index].spriteSourceSize.y,
			this.gamedata.frames[index].spriteSourceSize.w,
			this.gamedata.frames[index].spriteSourceSize.h
		);

		// show shape index
		//this.context2d.font = "bold 16px sans-serif";
		//this.context2d.fillStyle = "#fff";
		//this.context2d.fillText(index, this.gamedata.frames[index].xpos, this.gamedata.frames[index].ypos);
	},

	debugText: function(str) {
		// set text
		this.debugtxt = str;
	},

	drawDebugText: function() {
		if (this.debugtxt) {
			// set font and position
			this.context2d.font = "bold 24px sans-serif";
			var x = 50;
			var y = 50;

			var lineheight = 15;		
			var lines = this.debugtxt.split('\n');

			for (var i = 0; i<lines.length; i++) {
				// shadow text
				this.context2d.fillStyle = "#000";
				this.context2d.fillText(lines[i], x+2, y+2);
				// white text
				this.context2d.fillStyle = "#fff";
				this.context2d.fillText(lines[i], x, y);
				y = y + lineheight;
			};
		};
	},

	// -------------------------------------
	// buttons input through keyboard
	// -------------------------------------
	buttonAdd: function(name, framenames, defaultkeys) {
		// if no buttons yet
		if (typeof this.buttons === 'undefined') {
			this.buttons = [];
		}
		var maxidx = this.gamedata.buttons.length;

		// add button keycodes
		this.gamedata.buttons[maxidx] = {};
		
		// set values for button
		this.gamedata.buttons[maxidx].name = name;
		this.gamedata.buttons[maxidx].frames = framenames;
		this.gamedata.buttons[maxidx].defaultkeys = defaultkeys;
		
		this.gamedata.buttons[maxidx].keycodes = this.determineKeyCodes(defaultkeys);
	},
		
	determineKeyCodes: function(keyname) {
		// variables
		var result = [];
		
		// possibly more than 1 keyvariables
		for (var i = 0; i < keyname.length; i++) {
			var c = 0;
			var k = keyname[i];
			
			// key code
			k = k.toUpperCase();
			if (k.indexOf("UP") > -1) {
				c = 38;
			} else if (k.indexOf("DOWN") > -1) {
				c = 40;
			} else if (k.indexOf("LEFT") > -1) {
				c = 37;
			} else if (k.indexOf("RIGHT") > -1) {
				c = 39;
			} else {
				c = k.charCodeAt(0);
			};
			// add
			result.push(c);
		};

		// return array of keycode(s)
		return result;
	},

	ontouchstart: function(evt) {

		evt.preventDefault();

		//  evt.changedTouches is changed touches in this event, not all touches at this moment
		for (var i = 0; i < event.changedTouches.length; i++)
		{
			this.onmousedown(event.changedTouches[i]);
		}
	},
	
	ontouchend: function(evt) {
		evt.preventDefault();

		//  evt.changedTouches is changed touches in this event, not all touches at this moment
		for (var i = 0; i < evt.changedTouches.length; i++)
		{
			this.onmouseup(evt.changedTouches[i]);
		}
	},

	onmousedown: function(evt) {

		var x = (evt.offsetX || evt.clientX - evt.target.offsetLeft);
		var y = (evt.offsetY || evt.clientY - evt.target.offsetTop);

		//var x = evt.layerX;
		//var y = evt.layerY;
		x = x / this.scaleFactor;
		y = y / this.scaleFactor;

		// check if pressed in defined buttons
		for (var i=0; i < this.gamedata.buttons.length; i++) {
			// inside button touch area
			if (   (x > this.gamedata.buttons[i].area.x1)
				&& (x < this.gamedata.buttons[i].area.x2)
				&& (y > this.gamedata.buttons[i].area.y1)
				&& (y < this.gamedata.buttons[i].area.y2)
			) {
				var btnidx = 0;
				// which type of device button
				switch(this.gamedata.buttons[i].type) {
					case "updown":
						// two direction button up/down
						var yhalf = ((this.gamedata.buttons[i].area.y2 - this.gamedata.buttons[i].area.y1) / 2);
						// up or down
						btnidx = (y < this.gamedata.buttons[i].area.y1 + yhalf ? 0 : 1);
						break;
					case "leftright":
						// two direction button left/right
						var xhalf = ((this.gamedata.buttons[i].area.x2 - this.gamedata.buttons[i].area.x1) / 2);
						// left or right
						btnidx = (x < this.gamedata.buttons[i].area.x1 + xhalf ? 0 : 1);
						break;
					case "dpad":
						// four direction button up/down/left/right
						var xhalf = ((this.gamedata.buttons[i].area.x2 - this.gamedata.buttons[i].area.x1) / 2);
						var yhalf = ((this.gamedata.buttons[i].area.y2 - this.gamedata.buttons[i].area.y1) / 2);
						// distance to center
						var xdist = x - this.gamedata.buttons[i].area.x1 - xhalf;
						var ydist = y - this.gamedata.buttons[i].area.y1 - yhalf;
						if (Math.abs(xdist) < Math.abs(ydist)) {
							// up or down
							btnidx = (ydist < 0 ? 0 : 1); // 0=up, 1=down
						} else {
							// left or right
							btnidx = (xdist < 0 ? 2 : 3); // 2=left, 3=right
						};
						break;
					//default: // case "button":
					//	// simple button
					//	btnidx = 0;
					//	break;
				};
				// button press down
				this.onButtonDown(i, btnidx);
			};
		};
	},
	
	onmouseup: function(evt) {

		var x = (evt.offsetX || evt.clientX - evt.target.offsetLeft);
		var y = (evt.offsetY || evt.clientY - evt.target.offsetTop);
		
		//var x = evt.layerX;
		//var y = evt.layerY;
		var x = x / this.scaleFactor;
		var y = y / this.scaleFactor;

		// check if pressed in defined buttons
		for (var i=0; i < this.gamedata.buttons.length; i++) {
			// inside button touch area
			if (   (x > this.gamedata.buttons[i].area.x1)
				&& (x < this.gamedata.buttons[i].area.x2)
				&& (y > this.gamedata.buttons[i].area.y1)
				&& (y < this.gamedata.buttons[i].area.y2)
			) {
				var btnidx = 0;
				// which type of device button
				switch(this.gamedata.buttons[i].type) {
					case "updown":
						// two direction button up/down
						var half = ((this.gamedata.buttons[i].area.y2 - this.gamedata.buttons[i].area.y1) / 2);
						// up or down
						btnidx = (y < this.gamedata.buttons[i].area.y1 + half ? 0 : 1);
						break;
					case "leftright":
						// two direction button left/right
						var half = ((this.gamedata.buttons[i].area.x2 - this.gamedata.buttons[i].area.x1) / 2);
						// left or right
						btnidx = (x < this.gamedata.buttons[i].area.x1 + half ? 0 : 1);
						break;
					case "dpad":
						// four direction button up/down/left/right
						var xhalf = ((this.gamedata.buttons[i].area.x2 - this.gamedata.buttons[i].area.x1) / 2);
						var yhalf = ((this.gamedata.buttons[i].area.y2 - this.gamedata.buttons[i].area.y1) / 2);
						// distance to center
						var xdist = x - this.gamedata.buttons[i].area.x1 - xhalf;
						var ydist = y - this.gamedata.buttons[i].area.y1 - yhalf;
						if (Math.abs(xdist) < Math.abs(ydist)) {
							// up or down
							btnidx = (ydist < 0 ? 0 : 1); // 0=up, 1=down
						} else {
							// left or right
							btnidx = (xdist < 0 ? 2 : 3); // 2=left, 3=right
						};
						break;
					//default: // case "button":
					//	// simple button
					//	btnidx = 0;
					//	break;
				};
				// button release
				this.onButtonUp(i, btnidx);
			};
		};
	},

	onkeydown: function(e) {
		// get keycode
		var keyCode = e.keyCode;

		// check if keycode in defined buttons
		for (var i=0; i < this.gamedata.buttons.length; i++) {
			for (var j=0; j < this.gamedata.buttons[i].keycodes.length; j++) {
				if (this.gamedata.buttons[i].keycodes[j] == keyCode) {
					this.onButtonDown(i, j);
				};
			};
		};
	},
	
	onkeyup: function(e) {
		// get keycode
		var keyCode = e.keyCode;

		// check if keycode in defined buttons
		for (var i=0; i < this.gamedata.buttons.length; i++) {
			for (var j=0; j < this.gamedata.buttons[i].keycodes.length; j++) {
				if (this.gamedata.buttons[i].keycodes[j] == keyCode) {
					this.onButtonUp(i);
				};
			};
		};
	},
	
	onButtonDown: function(btnidx, diridx) {
		// pass input to game
		var name = this.gamedata.buttons[btnidx].name;
		this.state.currentState().press(name, diridx);

		// show button down on screen
		var idx = this.gamedata.buttons[btnidx].ids[diridx];
		this.setShapeByIdx(idx, true);
	},
	
	onButtonUp: function(btnidx, diridx) {
		// TODO: visually update frame so key is in neutral position
		for (var s=0; s < this.gamedata.buttons[btnidx].ids.length; s++) {
			var idx = this.gamedata.buttons[btnidx].ids[s];
			this.setShapeByIdx(idx, false);
		};

		// pass input to game
		if (typeof this.state.currentState().release !== "undefined") {
			var name = this.gamedata.buttons[btnidx].name;
			this.state.currentState().release(name, diridx);
		}
	},

	debugRectangle: function(xpos, ypos, w, h) {
		var color = "#f0f";
		// highlight a shape
		this.context2d.beginPath();
		this.context2d.lineWidth = "1";
		this.context2d.strokeStyle = color;
		this.context2d.fillStyle = color;
		this.context2d.rect(xpos, ypos, w, h);
		this.context2d.stroke();
	},

	// -------------------------------------
	// check if touch device
	// -------------------------------------
	is_touch_device: function() {
		var el = document.createElement("div");
		el.setAttribute("lcdgame.js - ongesturestart", "return;");
		if(typeof el.ongesturestart === "function"){
			return true;
		}else {
			return false
		}
	}
};

// -------------------------------------
// beats per minute to milliseconds, static helper function
// -------------------------------------
LCDGame.BPMToMillSec = function (bpm) {
	return (60000 / bpm);
}

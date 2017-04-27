// Highway LCD game simulation
// Bas de Reuver (c)2015

var searanger = {};

// constants
var STATE_DEMO = 1;
var STATE_MODESELECT = 2;
var STATE_GAMEPLAY = 10;
var STATE_GAMEHIT = 11;
var STATE_GAMEBONUS = 12;


searanger.MainGame = function(lcdgame) {
	// save reference to lcdgame object
	this.lcdgame = lcdgame;

	// game specific variables
	this.gamestate = 0;
	this.score = 0;
	this.lives = 0;
	this.guypos = 0; // 0=onisland..4=at bird, 5=on ship
	this.pushguy = 0;
	this.lifebuoy = -1; // position of lifesaver
	this.waveoffset = 0; // waves goes out of sync when life lost or extra life
	this.avoid = 0; // every hazard that reaches bottom of screen counts as one avoid, 3 avoids = 1 point
	this.randevt = 0; // bitwise event, represents columns for; coconut, ship, shark, bird. Example 13(dec) = b1101 = coconut+ship+bird, example 7(dec) = b0111 = ship+shark+bird

	this.gamepro = 1; // 1 or 2 difficulty

	// timers/pulse generators
	this.demotimer = null;
	this.gametimer = null;
	this.buoytimer = null;
	this.hittimer = null;
}

searanger.MainGame.prototype = {
	initialise: function(){

		// startup show all
		this.lcdgame.shapesDisplayAll(true);
		this.lcdgame.shapesRefresh();
		this.lcdgame.shapesDisplayAll(false);

		// initialise all timers
		this.demotimer = new LCDGame.Timer(this, this.onTimerDemo, 500);
		this.gametimer = new LCDGame.Timer(this, this.onTimerGame, 250);
		this.buoytimer = new LCDGame.Timer(this, this.onTimerBuoy, 500);
		this.hittimer  = new LCDGame.Timer(this, this.onTimerHit,  250);

		// start demo mode
		this.initDemo();
	},

	// -------------------------------------
	// timer events
	// -------------------------------------
	initDemo: function() {
		this.gamestate = STATE_DEMO;
		this.lcdgame.sequenceSetPos("mainguy", 0, true);
		this.demotimer.Start();
	},

	onTimerDemo: function() {
		// update clock
		if (this.demotimer.Counter % 2 != 0) {
			// demo timer event fired every half second
			this.lcdgame.setShapeByName("time_colon", false);
		} else {
			// only update road every whole second
			this.lcdgame.setShapeByName("time_colon", true);
			this.updateClock();
		};
		
		// timer is on halve seconds, update shapes only on every whole second
		if ( (this.demotimer.Counter % 2) == 0) {
			// shift all sequences
			this.lcdgame.sequenceShift("coconut");
			this.lcdgame.sequenceShift("shark");
			this.lcdgame.sequenceShift("ship");
			this.lcdgame.sequenceShift("bird");
			
			this.lcdgame.sequenceShift("mainguy");
			this.lcdgame.sequenceShift("lifesaver");
			
			// add random new shapes
			var r1 = Math.floor(Math.random() * 100) + 1; //1..100
			var r2 = Math.floor(Math.random() * 100) + 1; //1..100
			var r3 = Math.floor(Math.random() * 100) + 1; //1..100
			var r4 = Math.floor(Math.random() * 100) + 1; //1..100
			if (r1 < 25) {this.lcdgame.sequenceSetPos("coconut", 0, true)}; this.lcdgame.setShapeByName("monkey", (r1 < 25));
			if (r2 < 25) {this.lcdgame.sequenceSetPos("shark", 0, true) };
			if (r3 < 25) {this.lcdgame.sequenceSetPos("ship", 0, true) };
			if (r4 < 25) {this.lcdgame.sequenceSetPos("bird", 0, true) };

			if ( ( this.demotimer.Counter    % 14) == 0) {this.lcdgame.sequenceSetPos("mainguy", 0, true) };
			if ( ((this.demotimer.Counter+10) % 14) == 0) {this.lcdgame.sequenceSetPos("lifesaver", 0, true) };
		};

		// refresh shapes
		this.lcdgame.shapesRefresh();
	},
	
	toggleMode: function(toggle) {
		
		this.gamestate = STATE_MODESELECT;

		if (toggle) {
			this.gamepro = 3 - this.gamepro; // 1..2
		};

		// refresh shapes
		this.lcdgame.setShapeByName("pro1", (this.gamepro==1));
		this.lcdgame.setShapeByName("pro2", (this.gamepro==2));
		this.lcdgame.shapesRefresh();
	},

	// -------------------------------------
	// player input
	// -------------------------------------
	startGame: function() {
		this.lcdgame.shapesDisplayAll(false);
		this.lcdgame.setShapeByName("lifeguard", true);
		this.lcdgame.setShapeByName("rock", true);
		
		this.lcdgame.setShapeByName("pro1", (this.gamepro==1));
		this.lcdgame.setShapeByName("pro2", (this.gamepro==2));

		// game specific variables
		this.lifebuoy = false;
		this.waveoffset = 1;

		// refresh display
		this.score = 0;
		this.lives = 4;
		this.scorePoints(0);
		this.updateLives(0);
		this.resetGuy();

		this.gamestate = STATE_GAMEPLAY;
		
		// timers/pulse generators
		
		// start hazards moving
		this.gametimer.Interval = (this.gamepro==1 ? 250 : 125);
		this.gametimer.Start();
		this.buoytimer.Start();
	},

	onTimerGame: function() {

		// random shapes

		if (this.guypos == 0) {
			// when guy on island, push off island after 5 seconds
			this.pushguy++;
			if (this.pushguy > (this.gamepro*16)) {
				this.moveGuy(+1);
			}
		} else if (this.guypos == 5) {
			// when guy move onto ship, use gametimer to reset it back to island
			// score points
			this.scorePoints(10);
			// randomly play long or short beep
			var r = Math.floor(Math.random() * 3);
			var str = (r == 1 ? "scorelong" : "scoremedium");
			console.log("scoer points!! str = "+str);
			this.lcdgame.playSoundEffect(str);
			// reset guy
			this.resetGuy();
		};

		// waves animation
		var waves = (this.gametimer.Counter + this.waveoffset) % 8;
		if (waves == 0) this.lcdgame.setShapeByName("waves", true);
		if (waves == 1) this.lcdgame.setShapeByName("sharkaway1", true);
		if (waves == 2) this.lcdgame.setShapeByName("sharkaway2", true);
		if (waves == 2) this.lcdgame.setShapeByName("monkey", true);
		if (waves == 3) this.lcdgame.setShapeByName("waves", false);
		if (waves == 4) this.lcdgame.setShapeByName("sharkaway1", false);
		if (waves == 5) this.lcdgame.setShapeByName("sharkaway2", false);
		if (waves == 5) this.lcdgame.setShapeByName("monkey", false);
		

		// each timer update a different hazard
		var frame = this.gametimer.Counter % 4;

		// which sequences
		var seq = "coconut";
		//if (frame == 0) seq = "coconut";
		if (frame == 1) seq = "ship";
		if (frame == 2) seq = "shark";
		if (frame == 3) seq = "bird";
		
		// check if hit or avoid
		var pulse = 0;
		
		// check if hit or avoid
		var hit = false;
		var last = this.lcdgame.sequenceShapeVisible(seq, -1);
		if (last) {
			// check if hit
			if (frame == this.guypos-1) {
				this.avoid = 0;
				hit = true;
			} else {
				// 1 point for every 3 avoids
				this.avoid = (this.avoid + 1) % 3;
				if (this.avoid == 0) {
					pulse = 2;
				};
			};
		};

		// sound effect
		if (pulse == 2) {
			// score points
			this.scorePoints(1);
			this.lcdgame.playSoundEffect("scoreshort");
		} else {
			// tick sound effect, only if any shape is visible in moving sequence
			if (this.lcdgame.sequenceShapeVisible(seq)) {
				pulse = 1;
			};
		};
		
		// shift sequences
		this.lcdgame.sequenceShift(seq);

		// new random event, based on description of Plane & Tank -> http://handheldempire.com/game.jsp?game=2158
		if (frame == 0) this.randevt = Math.floor(Math.random() * 15); //0..14
		if (this.score < 100) {
			if (this.randevt <= 4) this.randevt = 0;
		};
		if (this.score < 600) {
			if ( (this.randevt == 7) || (this.randevt >= 12) ) this.randevt = 0;
		};

		// add shape if corresponding bit is set to 1
		if ((this.randevt & (8 >> frame)) > 0) {
			this.lcdgame.sequenceSetPos(seq, 0, true);
			if (pulse == 0) pulse = 1;
		};

		// check if player hit
		if (hit) {
			// lose a life
			this.updateLives(-1);
			// main guy in water
			this.lcdgame.sequenceClear("mainguy");
			this.lcdgame.setShapeByName("mainguy7", true);
			// switch to wait 3 seconds
			this.gamestate = STATE_GAMEHIT;
			this.gametimer.Stop();
			this.hittimer.Start(12);
		} else {
			// pulse tick sound effect when any hazard in play or added to play
			if (pulse == 1) this.lcdgame.playSoundEffect("pulse");
		};

		// refresh shapes
		this.lcdgame.shapesRefresh();
	},
	
	onTimerBuoy: function() {
		// lifesaver appears exactly every 8 seconds
		// 0.0s = lifesaver first throw position
		// 0.5s = lifesaver second throw position
		// 1.0s = lifesaver lowest position
		// 4.5s = lifesaver disappears
		// 8.0s = lifesaver first throw position 
		// etc.
		var frame = this.buoytimer.Counter % 16;
		
		switch (frame) {
			case 1:
				this.lcdgame.sequenceClear("lifesaver");
				this.lcdgame.sequenceSetPos("lifesaver", 0, true);
				this.lifebuoy = false;
				break;
			case 2:
				this.lcdgame.sequenceShift("lifesaver");
				break;
			case 3:
				this.lcdgame.sequenceShift("lifesaver");
				this.lcdgame.setShapeByName("rock", false);
				this.lifebuoy = true;
				break;
			case 10:
				this.lcdgame.sequenceClear("lifesaver");
				this.lcdgame.setShapeByName("rock", true);
				this.lifebuoy = false;
				break;
		};

		// refresh shapes
		this.lcdgame.shapesRefresh();
	},

	onTimerHit: function() {
		// pause for player lose animation
		// play sound at 0.250s and 1.750s
		var frame = this.hittimer.Counter % 16;

		switch (frame) {
			case 1:
			case 5:
				var snd = (this.gamestate == STATE_GAMEHIT ? "lose" : "beepbeep");
				this.lcdgame.playSoundEffect(snd);
				break;
			case 12:
				// continue game
				if (this.lives > 0) {
					if (this.gamestate == STATE_GAMEHIT) this.resetGuy();
					this.gamestate = STATE_GAMEPLAY;
					// refresh shapes
					this.lcdgame.shapesRefresh();
					this.gametimer.Start();
				} else {
					// game over
					this.buoytimer.Stop();
					this.gamestate = STATE_MODESELECT;
				};
				break;
		};
	},

	moveGuy: function(step) {
		// assume move is valid
		var valid = true;
		
		if (step < 0) {
			// move left, cannot move back onto island, or from ship back in to water
			if ( (this.guypos < 2) || (this.guypos > 4) ) {
				valid = false;
			};
		} else {
			// move right
			if (this.guypos > 4) {
				valid = false;
			} else if (this.guypos == 4) {
				// onto ship, only when lifesaver
				valid = this.lifebuoy;
			};
		};
		
		if (valid) {
			// update position
			this.guypos = this.guypos + step;
			this.lcdgame.sequenceClear("mainguy");
			this.lcdgame.sequenceSetPos("mainguy",  this.guypos, true);
			// refresh
			this.lcdgame.shapesRefresh();
		};
	},
	
	resetGuy: function() {
		// reset guy
		this.guypos = 0;
		this.pushguy = 0;
		this.lcdgame.sequenceClear("mainguy");
		this.lcdgame.sequenceSetPos("mainguy",  this.guypos, true);
	},

	scorePoints: function(pts) {
		// keep old and new score
		var sc1 = (this.score % 1000);
		var sc2 = ((this.score + pts) % 1000);
		var wait = false;
		// pass 200 points, bonus life
		if ( (sc1 < 200) && (sc2 >= 200) ) {
			this.updateLives(+1);
			wait = true;
		};
		// pass 500 points, bonus life and speed up
		if ( (sc1 < 500) && (sc2 >= 500) ) {
			this.updateLives(+1);
			this.gametimer.Interval = 125;
			wait = true;
		};
		// pass 1000 points, slow down again
		if (sc1 > sc2) {
			this.gametimer.Interval = (this.gamepro==1 ? 250 : 125);
		};
		this.score = this.score + pts;
		// display score
		var str = ("000"+this.score).slice(-3);
		this.lcdgame.digitsDisplay("digits", str, true);
		// wait bonus sounds
		if (wait) {
			// switch to wait 3 seconds
			this.gamestate = STATE_GAMEBONUS;
			this.gametimer.Stop();
			this.hittimer.Start(12);
		};
	},
	
	updateLives: function(a) {
		this.lives = this.lives + a;
		if (this.lives > 9) this.lives = 9; // limit to max 9 lives
		this.lcdgame.digitsDisplay("digitsmall", ""+this.lives, true);
	},

	// -------------------------------------
	// player input
	// -------------------------------------
	handleInput: function(buttonname) {
		// determine state of gameplay
		switch (this.gamestate) {
			case STATE_DEMO:
				if (buttonname == "mode") {
					this.demotimer.Stop();
				
					// refresh display
					this.lcdgame.shapesDisplayAll(false);
					this.lcdgame.setShapeByName("mainguy1", true);
					this.lcdgame.setShapeByName("waves", true);
					this.lcdgame.setShapeByName("lifeguard", true);
					this.lcdgame.setShapeByName("rock", true);
					
					// refresh display
					this.lcdgame.digitsDisplay("digits", "000", true);
					this.lcdgame.digitsDisplay("digitsmall", "4", true);
					
					this.toggleMode(false);
				};
				break;
			case STATE_MODESELECT:
				if (buttonname == "mode") {
					this.initDemo();
				};
				if (buttonname == "game") {
					this.toggleMode(true);
				};
				if (buttonname == "start") {
					this.startGame();
				};
				break;
			case STATE_GAMEPLAY:
				if (buttonname == "left") {
					this.moveGuy(-1);
				};
				if (buttonname == "right") {
					this.moveGuy(+1);
				};
				break;
			case STATE_GAMEHIT:
				break;
		};
	},

	updateClock: function() {
		// get time as 12h clock with PM
		var datenow = new Date();
		//var str = datenow.toLocaleTimeString();
		//var strtime = "" + str.substring(0, 2) + str.substring(3, 5); // example "2359"
		var ihours = datenow.getHours();
		var imin = datenow.getMinutes();
		var isec = datenow.getSeconds();

		// format hours and minutes and seconds
		var strtime = ("  "+ihours).substr(-2) + ("00"+imin).substr(-2);
		var strsec  = ("00"+isec).substr(-2);

		// display time
		this.lcdgame.digitsDisplay("digits",     strtime, false);
		this.lcdgame.digitsDisplay("digitsmall", strsec,  false);
	}
}

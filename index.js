var Service, Characteristic;
var request = require("request");
var pollingtoevent = require('polling-to-event');

	module.exports = function(homebridge){
		Service = homebridge.hap.Service;
		Characteristic = homebridge.hap.Characteristic;
		homebridge.registerAccessory("homebridge-bluesound", "Bluesound", BluesoundAccessory);
	}


	function BluesoundAccessory(log, config) {
		this.log = log;

	    // url info
		this.ip = config["ip"];
		this.port = config["port"];
		this.play_url = config["play_url"];//this.ip + ":" + this.port + "/play";        
        this.play_body                = config["play_body"];

        this.stop_url = config["stop_url"]; //this.ip + ":" + this.port + "/pause";        
		this.stop_body               = config["stop_body"];

		this.status_url = config["status_url"];
		this.volume_url         = config["volume_url"];
		this.volumelvl_url      = config["volumelvl_url"];
		this.http_method            = config["http_method"] 	  	 	|| "GET";;
		this.http_volume_method = config["http_volume_method"]  || this.http_method;
		this.username               = config["username"] 	  	 	 	|| "";
		this.password               = config["password"] 	  	 	 	|| "";
		this.sendimmediately        = config["sendimmediately"] 	 	|| "";
		this.service                = config["service"] 	  	 	 	|| "Switch";
		this.name                   = config["name"];
		this.volumeHandling     = config["volumeHandling"] 	 	|| "no";
		this.switchHandling 		= config["switchHandling"] 		 	|| "no";
		
		//realtime polling info
		this.state = false;
		this.currentlevel = 0;
		var that = this;
		
		// Status Polling, if you want to add additional services that don't use switch handling you can add something like this || (this.service=="Smoke" || this.service=="Motion"))
		if (this.status_url && this.switchHandling =="realtime") {
			var powerurl = this.status_url;
			var statusemitter = pollingtoevent(function(done) {
	        	that.httpRequest(powerurl, "", "GET", that.username, that.password, that.sendimmediately, function(error, response, body) {
            		if (error) {
                		that.log('HTTP get power function failed: %s', error.message);
		                callback(error);
            		} else {               				    
						done(null, body);
            		}
        		})
			}, {longpolling:true,interval:300,longpollEventName:"statuspoll"});

		statusemitter.on("statuspoll", function(data) {       
        	var binaryState = parseInt(data);
	    	that.state = binaryState > 0;
			that.log(that.service, "received power",that.status_url, "state is currently", binaryState); 
			// switch used to easily add additonal services
			switch (that.service) {
				case "Switch":
					if (that.switchService ) {
						that.switchService .getCharacteristic(Characteristic.On)
						.setValue(that.state);
					}
					break;
				case "Light":
					if (that.lightbulbService) {
						that.lightbulbService.getCharacteristic(Characteristic.On)
						.setValue(that.state);
					}		
					break;			
				}        
		});

	}
	// Volume Polling
	if (this.volumelvl_url && this.volumeHandling =="realtime") {
		var volumeurl = this.volumelvl_url;
		var levelemitter = pollingtoevent(function(done) {
	        	that.httpRequest(volumeurl, "", "GET", that.username, that.password, that.sendimmediately, function(error, response, responseBody) {
            		if (error) {
                			that.log('HTTP get power function failed: %s', error.message);
							return;
            		} else {               				    
						done(null, responseBody);
            		}
        		}) // set longer polling as slider takes longer to set value
    	}, {longpolling:true,interval:2000,longpollEventName:"levelpoll"});

		levelemitter.on("levelpoll", function(data) {  
			that.currentlevel = parseInt(data);

			if (that.lightbulbService) {				
				that.log(that.service, "received volume",that.volumelvl_url, "level is currently", that.currentlevel); 		        
				that.lightbulbService.getCharacteristic(Characteristic.volume)
				.setValue(that.currentlevel);
			}        
    	});
	}
	}

	BluesoundAccessory.prototype = {

	httpRequest: function(url, body, method, username, password, sendimmediately, callback) {
		request({
			url: url,
			body: body,
			method: method,
			rejectUnauthorized: false,
			auth: {
				user: username,
				pass: password,
				sendImmediately: sendimmediately
			}
		},
		function(error, response, body) {
			callback(error, response, body)
		})
	},

	setPowerState: function(powerOn, callback) {
		var url;
		var body;
		
		if (!this.play_url || !this.stop_url) {
				this.log.warn("Ignoring request; No power url defined.");
				callback(new Error("No power url defined."));
				return;
		}
		
		if (powerOn) {
			url = this.play_url;
			body = this.play_body;
			this.log("Setting power state to on");
		} else {
			url = this.stop_url;
			body = this.stop_body;
			this.log("Setting power state to off");
		}
		
		this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
			this.log('HTTP set power function failed: %s', error.message);
			callback(error);
			} else {
			this.log('HTTP set power function succeeded!');
			callback();
			}
		}.bind(this));
	},
  
  getPowerState: function(callback) {
	if (!this.status_url) {
		this.log.warn("Ignoring request; No status url defined.");
		callback(new Error("No status url defined."));
		return;
	}
	
	var url = this.status_url;
	this.log("Getting power state");
	
	this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
	if (error) {
		this.log('HTTP get power function failed: %s', error.message);
		callback(error);
	} else {
		var binaryState = parseInt(responseBody);
		var powerOn = binaryState > 0;
		this.log("Power state is currently %s", binaryState);
		callback(null, powerOn);
	}
	}.bind(this));
  },

	getVolume: function(callback) {
		if (!this.volumelvl_url) {
			this.log.warn("Ignoring request; No volume level url defined.");
			callback(new Error("No volume level url defined."));
			return;
		}		
			var url = this.volumelvl_url;
			this.log("Getting volume level");
	
			this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
				this.log('HTTP get volume function failed: %s', error.message);
				callback(error);
			} else {			
				var binaryState = parseInt(responseBody);
				var level = binaryState;
				this.log("volume state is currently %s", binaryState);
				callback(null, level);
			}
			}.bind(this));
	  },

	setVolume: function(level, callback) {
		
		if (!this.volume_url) {
			this.log.warn("Ignoring request; No volume url defined.");
			callback(new Error("No volume url defined."));
			return;
		}    
	
		var url = this.volume_url.replace("%b", level)
	
		this.log("Setting volume to %s", level);
	
		this.httpRequest(url, "", this.http_volume_method, this.username, this.password, this.sendimmediately, function(error, response, body) {
		if (error) {
			this.log('HTTP volume function failed: %s', error);
			callback(error);
		} else {
			this.log('HTTP volume function succeeded!');
			callback();
		}
		}.bind(this));
	},

	identify: function(callback) {
		this.log("Identify requested!");
		callback(); // success
	},

	getServices: function() {
		
		var that = this;
		
		// you can OPTIONALLY create an information service if you wish to override
		// the default values for things like serial number, model, etc.
		var informationService = new Service.AccessoryInformation();
	
		informationService
		.setCharacteristic(Characteristic.Manufacturer, "HTTP Manufacturer")
		.setCharacteristic(Characteristic.Model, "HTTP Model")
		.setCharacteristic(Characteristic.SerialNumber, "HTTP Serial Number");
	
		switch (this.service) {
		case "Switch": 
			this.switchService = new Service.Switch(this.name);
			switch (this.switchHandling) {	
				//Power Polling			
				case "yes":					
					this.switchService
					.getCharacteristic(Characteristic.On)
					.on('get', this.getPowerState.bind(this))
					.on('set', this.setPowerState.bind(this));						
					break;
				case "realtime":				
					this.switchService
					.getCharacteristic(Characteristic.On)
					.on('get', function(callback) {callback(null, that.state)})
					.on('set', this.setPowerState.bind(this));
					break;
				default	:	
					this.switchService
					.getCharacteristic(Characteristic.On)	
					.on('set', this.setPowerState.bind(this));					
					break;}
					return [this.switchService];
		case "Light":	
			this.lightbulbService = new Service.Lightbulb(this.name);			
			switch (this.switchHandling) {
			//Power Polling
			case "yes" :
				this.lightbulbService
				.getCharacteristic(Characteristic.On)
				.on('get', this.getPowerState.bind(this))
				.on('set', this.setPowerState.bind(this));
				break;
			case "realtime":
				this.lightbulbService
				.getCharacteristic(Characteristic.On)
				.on('get', function(callback) {callback(null, that.state)})
				.on('set', this.setPowerState.bind(this));
				break;
			default:		
				this.lightbulbService
				.getCharacteristic(Characteristic.On)	
				.on('set', this.setPowerState.bind(this));
				break;
			}
			// volume Polling 
			if (this.volumeHandling == "realtime") {
				this.lightbulbService 
				.addCharacteristic(new Characteristic.volume())
				.on('get', function(callback) {callback(null, that.currentlevel)})
				.on('set', this.setvolume.bind(this));
			} else if (this.volumeHandling == "yes") {
				this.lightbulbService
				.addCharacteristic(new Characteristic.volume())
				.on('get', this.getvolume.bind(this))
				.on('set', this.setvolume.bind(this));							
			}
	
			return [informationService, this.lightbulbService];
			break;		
		}
	}
};

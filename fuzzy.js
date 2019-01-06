module.exports = function(RED) {
    function SensorData(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.on('input', function(msg) {
            msg.payload = DecodeGatewayMessage(msg.payload);
            node.send(msg);
        });
    }
    RED.nodes.registerType("iqhomedata",SensorData);
}

/*

Example:
Selective FRC tmeperature data from nodes: 8,9,10

{
	"id": "temperature",
	"datetime": "2018-02-18 18:30:00",
	"nodes": [
		null,
		null,
		null,
		null,
		null,
		null,
		null,
		null,
		{
			"status": "ok",
			"temperature": "0.9375"
		},
		{
			"status": "ok",
			"temperature": "3.8125"
		},
		{
			"status": "ok",
			"temperature": "2.4375"
		}
	]
}


*/


var ValuePrecision = 4;

// input json message payload

function DecodeGatewayMessage(message){


	console.log("message",message)

	var obj = {
		id: message.id || null,
		dpa_request: DecodeDpaRequest(message.dpa_request) || [],
		dpa_response: DecodeDpaResponse(message.dpa_response) || [],
		datetime: TimestampToDateTime(message.timestamp_rfnet_receive)

	}

	console.log("obj",obj)

	// check errors
	//if(obj.dpa_response.errno){}

	var sensors = {
		id: obj.id,
		datetime: obj.datetime,
		nodes: []
	};

	// define converter callbackss

	
	switch(obj.dpa_response.pnum){
		case 0x30:  	// IQ Home Ambient sensor data

			sensors.nodes[naddr] = {
				battery: obj.dpa_response.pdata[0] & 0x80 ? "low" : "ok",
				status: "ok"
			}

			for (var i = 0; i < obj.dpa_response.pdata.length; i+=3) {

				var naddr = obj.dpa_response.naddr;
				var value = obj.dpa_response.pdata[i+1] + (obj.dpa_response.pdata[i+2] << 8);

			    // sensor error
				if(value == 0x8000){
					// override converter callback
					getTempereature = function () {
						return null;
					}
					getHumidityValue = getTempereature;
					getCO2 = getTempereature;
					sensors.nodes[naddr].status = "sensor_error";
				}

				switch(obj.dpa_response.pdata[i]){
					case 0x01: // Temperature						
						sensors.nodes[naddr].temperature = getTempereature(value);	
					break;

					case 0x02: // Relative humidity
						sensors.nodes[naddr].humidity = getHumidityValue(value);
					break;

					case 0x03: // CO2						
						sensors.nodes[naddr].co2 = getCO2(value);
					break;
				}
			}
		break;

		case 0x38:  	// IQ Home Modbus data 

			switch(obj.dpa_response.pdata[0]){ // type -> Power meter ?

				case 0x03:
					if(obj.dpa_response.pdata[1] != 4){ // its an invalid float length
						sensors.nodes[obj.dpa_response.naddr].status = "invalid_data_length";0
						break;
					}
					sensors.nodes[obj.dpa_response.naddr].status = "ok";

					var value = getFloatFromArrayValues(obj.dpa_request.pdata.slice(2,6));

					if(obj.dpa_request.pdata[2] == 0x10 && obj.dpa_request.pdata[3] == 0x00){
						// serial
						sensors.nodes[obj.dpa_response.naddr].pm_serial = value;
					}
					else if(obj.dpa_request.pdata[2] == 0x30 && obj.dpa_request.pdata[3] == 0x00){
						// total active energy
						sensors.nodes[obj.dpa_response.naddr].pm_energy = value;
					}
					else if(obj.dpa_request.pdata[2] == 0x20 && obj.dpa_request.pdata[3] == 0x80){
						// active power
						sensors.nodes[obj.dpa_response.naddr].pm_power = value;
					}
					else if(obj.dpa_request.pdata[2] == 0x20 && obj.dpa_request.pdata[3] == 0x00){
						// voltage
						sensors.nodes[obj.dpa_response.naddr].pm_voltage = value;
					}
					else if(obj.dpa_request.pdata[2] == 0x20 && obj.dpa_request.pdata[3] == 0x20){
						// frequency
						sensors.nodes[obj.dpa_response.naddr].pm_frequency = value;
					}
					else if(obj.dpa_request.pdata[2] == 0x20 && obj.dpa_request.pdata[3] == 0x60){
						// current
						sensors.nodes[obj.dpa_response.naddr].pm_current = value;
					}
				break;

			}
		break; // end of Modbus
	
	 	case 0x0D: // FRC

			// determine FRC node data size, 1 or 2 byte
			var nsize = 2;		
			if(obj.dpa_request.pdata[0] != 0xFF){
				nsize = 1;
			}

			

			var getTempereature = null;
			var getHumidityValue = null;
			var getCO2 = null;

			// 
			var naddr = 0;
			// i = nsize 1 byte -> 1-63, 2byte 2-63
			for (var nidx = 1; nidx < obj.dpa_response.pdata.length;  nidx++) {

				// 1 or 2 bytes decode values and converter functions
				var value = null;
				if(nsize == 1){
					value = obj.dpa_response.pdata[nidx];
					// converters
					getTempereature = getTempValue050;
					getHumidityValue = getHumidityValue050;
					getCO2 = getCO2Value;
				}
				else{
					var idx = 1+(nidx*2);
					value = obj.dpa_response.pdata[idx] + (obj.dpa_response.pdata[idx+1] << 8);
					// converters
					getTempereature = getTempValue0625;
					getHumidityValue = getHumidityValue0625;
					getCO2 = getCO2Value_1ppm;
				}

				console.log("data", nsize, value)

				// FRC data type
				var frctype = obj.dpa_request.pdata[1];
				var dtype = obj.dpa_request.pdata[2];

				// selective FRC -> node index relocate: nidx
				if(obj.dpa_response.pcmd == 0x02){

					frctype = obj.dpa_request.pdata[31]; // selective FRC user data from byte 31 -
					dtype = obj.dpa_request.pdata[32]; // selective FRC user data from byte 32 -> data type

					// selective address
					naddr = 0;
					var naidx = nidx;
					// seletive FRC  1. byte cmd, node map frim byte 1-30
					for (var n = 1; n < 31 && n < obj.dpa_request.pdata.length; n++) {

						for (var b = 0; b < 8; b++) {

							if(obj.dpa_request.pdata[n] & (1<<b)){

								var addr = (n-1)*8+b;
								if(--naidx == 0){
									naddr = addr;
									break; // node found
								}
							}
						}
						if(!naidx) break; // node found
					}

					if(naidx) continue; // go to next FRC response value
				}
				else{
					naddr = nidx;
				}

				// init sensor object
				if(!sensors.nodes[naddr]){
					sensors.nodes[naddr] = {
						status: 'ok' // default status
					};
				}

				// exceptions
				if(value < 4){

					// override converter callback
					getTempereature = function () {
						return null;
					}
					getHumidityValue = getTempereature;
					getCO2 = getTempereature;

					switch(value){
						case 0:
							sensors.nodes[naddr].status = 'not_respond';
						break;
						case 1:
							sensors.nodes[naddr].status = 'not_implemented';
						break;
						case 2:
							sensors.nodes[naddr].status = 'sensor_error';
						break;
						case 3:
							
						break;
					}
				}

				// decode restricted FRC values
				if ((0xFFFC & value) == 0x8000) {
			        value = value - 0x8000;

			    } 
				
				if(frctype == 0x30){ //  Ambient sensor
					
					switch(dtype){ // Data type indentifier

						case 0x01: // Temperature						
							sensors.nodes[naddr].temperature = getTempereature(value);						
						break;

						case 0x02: // Relative humidity
							sensors.nodes[naddr].humidity = getHumidityValue(value);
						break;

						case 0x03: // CO2						
							sensors.nodes[naddr].co2 = getCO2(value);
						break;
					}
				}
			}
		break;
	}// end of switch pnum

	console.log(sensors)
	return sensors;
}


function DecodeDpaRequest(dpa_hexstring) {

	if(!dpa_hexstring) return null;

	dpa_hexstring = dpa_hexstring.replace(/\./g,'');

	var dpa_request = [];
	var hexarray = dpa_hexstring.match(/.{1,2}/g);

	for (var i = 0; i < hexarray.length; i++) {
	    dpa_request.push(parseInt(hexarray[i],16));
	}

	var dpa = {
		naddr: 	dpa_request[0] | dpa_request[1] << 8,
		pnum: 	dpa_request[2],
		pcmd: 	dpa_request[3],
		hwpid: 	dpa_request[4] | dpa_request[5] << 8,
		pdata: 	dpa_request.slice(6, dpa_request.length)
	}

	return dpa;
}

function DecodeDpaResponse(dpa_hexstring) {

	if(!dpa_hexstring) return null;
	// response hex2dec
	var dpa_response = [];
	var hexarray = dpa_hexstring.match(/.{1,2}/g);

	for (var i = 0; i < hexarray.length; i++) {
	    dpa_response.push(parseInt(hexarray[i],16));
	}


	var dpa = {
		naddr: 	dpa_response[0] | dpa_response[1] << 8,
		pnum: 	dpa_response[2],
		pcmd: 	dpa_response[3] & 0x7F,
		hwpid: 	dpa_response[4] | dpa_response[5] << 8,
		errno: 	dpa_response[6],
		dpaValue: 	dpa_response[7],
		pdata: 	dpa_response.slice(8, dpa_response.length)
	}

	return dpa;
}

function TimestampToDateTime(unix_ts) {
	
	// get timezone DST
	var offset = +1.00; //time zone value from database

	var doffset = 3600000*offset;
	var tsms = new Date(unix_ts*1000);

	var jan = new Date(tsms.getFullYear(),0,1);
	var jul = new Date(tsms.getFullYear(),6,1);

	if(Math.min(jan.getTimezoneOffset(),jul.getTimezoneOffset()) == doffset){
	    offset = +2.00;
	}

	var a = new Date(unix_ts*1000 + (3600000*offset));

	var year = a.getUTCFullYear();
	var month = a.getUTCMonth() + 1;
	var date = a.getUTCDate();
	var hour = a.getUTCHours();
	var min = a.getUTCMinutes();
	var sec = a.getUTCSeconds();
	var time = year + '-' + zeroFill(month, 2) + '-' + zeroFill(date, 2) + ' ' + zeroFill(hour, 2) + ':' + zeroFill(min, 2) + ':' + zeroFill(sec, 2) ;

	return time;
}

function zeroFill( number, width )
{
	width -= number.toString().length;
	if ( width > 0 ){
		return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
	}
	return number + ""; // always return a string
}


function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

/*
* Decode IQ Home Sensor Protocol
*/

/*
* Temperature
*/

function getTempValue050(value){

    if(!isNumber(value)) return null;
    return ((value-64)/2).toFixed(ValuePrecision);
}

function getTempValue0625(value){

    if(!isNumber(value)) return null;
    
    // negative temperatures
    if (value > 0x7FFF) {
        value = 0x10000 - value;
        value *= -1;
    } 
    
    var convertedValue = value / 16;
    
    return convertedValue.toFixed(ValuePrecision);
}

/*
* Humidity
*/

function getHumidityValue050(value){

    if(!isNumber(value)) return null;
    return ((value-2)/2).toFixed(ValuePrecision);
}

function getHumidityValue0625(value){

    if(!isNumber(value)) return null;
    
    var convertedValue = value / 16;
    
    return convertedValue.toFixed(ValuePrecision);
}


/*
* CO2
*/


function getCO2Value(value) {

    if(!isNumber(value)) return null;
    return (value*10 + 350);
}

function getCO2Value_1ppm(value) {

    if(!isNumber(value)) return null;
        
    return value;
}


// convert hex to float e.g.: HextoFloat(0x43663333) = 230.1999969482422
function HextoFloat(str) {
	var float = 0, sign, order, mantiss,exp,
	 	int = 0, multi = 1;
	if (/^0x/.exec(str)) {
		int = parseInt(str,16);
	}
	else{
		for (var i = str.length -1; i >=0; i -= 1) {
			if (str.charCodeAt(i)>255) {
				console.log('Wrong string parametr'); 
				return false;
			}
			int += str.charCodeAt(i) * multi;
			multi *= 256;
		}
	}
	sign = (int>>>31)?-1:1;
	exp = (int >>> 23 & 0xff) - 127;
	mantissa = ((int & 0x7fffff) + 0x800000).toString(2);
	for (i=0; i<mantissa.length; i+=1){
		float += parseInt(mantissa[i])? Math.pow(2,exp):0;
		exp--;
	}
	return float*sign;
}


function  mergeArrayValuesHex(array){

	var val = "0x";
	for (var i = 0; i < array.length; i++) {
		val+=array[i].toString(16);
	}
	return val;
}

function getFloatFromArrayValues(array){
	return HextoFloat(mergeArrayValuesHex(array));
}
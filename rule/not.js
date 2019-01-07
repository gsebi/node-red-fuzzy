/*

payload:{
	'previous': x,
	'actual': y
}
*/

module.exports = function(RED) {
    function And(config) {
        RED.nodes.createNode(this,config);
        var node = this;


        node.on('input', function(msg) {

        	// value
        	var value = msg.payload;
                    	
    		if(value.actual == null){                    
                msg.payload = null;			                
    		}
    		else{
                msg.payload = 1.0 -value;
    		}

        	// select output value
            node.send(msg);
        });

    }
    RED.nodes.registerType("and",And);
}

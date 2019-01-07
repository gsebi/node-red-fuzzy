/*

payload:{
	'previous': x,
	'actual': y
}
*/

module.exports = function(RED) {
    function Or(config) {
        RED.nodes.createNode(this,config);
        this.minin = config.minin;

        var node = this;

        node.on('input', function(msg) {

        	// value
        	var value = msg.payload;
        	// load stored elements
        	var es = node.context().get('elements') || [];
        	// find first same previous value and update if its exists
        	var idx = es.indexOf(value.previous);
        	if(idx >= 0){
        		// remove/unsubscribe node/membership function
        		if(value.actual == null){
        			es.splice(idx, 1);
        		}
        		else{
                    es[idx] = value.actual;
        		}
        	}
        	// else add to elements object
        	else{
        		es.push(value.actual);
        	}

            node.context().set('elements', es);

            if(es.length >= node.minin){
                // select output value
                msg.payload = Math.max(...es);
                node.send(msg);
            }
            return null;
        });

    }
    RED.nodes.registerType("or",Or);
}

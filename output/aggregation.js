module.exports = function(RED) {
    function Aggregation(config) {
        RED.nodes.createNode(this,config);
        this.minin = config.minin;

        var node = this;

        node.on('input', function(msg) {

        	// value
        	var value = msg.payload;
        	// load stored elements
        	var es = node.context().get('elements') || [];
        	// find first same previous value and update if its exists
        	var idx = findObjectInArray(es, value.previous);
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
                console.log(es)
                msg.payload = calculateOutput(es);
                node.send(msg);
            }
            return null;
        });

    }
    RED.nodes.registerType("aggregation",Aggregation);
}

// weightad output
function calculateOutput(es){

    var sum_w = 0;
    for (var i = 0; i < es.length; i++) {
        sum_w += es[i].weight;
    }
    var sum_out = 0;
    for (var i = 0; i < es.length; i++) {
        sum_out += es[i].output;
    }

    if(!sum_w) return 0;// ???
    return sum_out / sum_w;
}


function findObjectInArray(array, element){
    if(!array || !element) return -1;

    for(var i=0; i < array.length; i++){
        if( JSON.stringify(array[i]) === JSON.stringify(element)) return i;
    }
    return -1;
}
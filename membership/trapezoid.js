module.exports = function(RED) {
    function Trapezoid(config) {
        RED.nodes.createNode(this,config);
        this.x0 = config.x0;
        this.x1 = config.x1;
        this.x2 = config.x2;
        this.x3 = config.x3;

        var node = this;
        node.on('input', function(msg) {

            var actual_value = 0;
            var x = msg.payload;

            var prev_value = node.context().get('value');

             if (x <= node.x0) {
                actual_value = 0;
            } else if (x >= node.x3) {
                actual_value = 0;
            } else if ((x >= node.x1) && (x <= node.x2)) {
                actual_value = 1;
            } else if ((x > node.x0) && (x < node.x1)) {
                actual_value = (x / (node.x1 - node.x0)) - (node.x0 / (node.x1 - node.x0));
            } else {
                actual_value = (-x / (node.x3 - node.x2)) + (node.x3 / (node.x3 - node.x2));
            }
            node.context().set('value', actual_value);

            msg.payload = {
                previous: prev_value,
                actual: actual_value
            };

            node.send(msg);
        });
    }
    RED.nodes.registerType("trapezoid",Trapezoid);
}

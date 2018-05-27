var redis = require("redis"),
    client = redis.createClient({
		retry_strategy: function (options) {
			/*if (options.error && options.error.code === 'ECONNREFUSED') {
				// End reconnecting on a specific error and flush all commands with
				// a individual error
				return new Error('The server refused the connection');
			}*/
			if (options.total_retry_time > 1000 * 60 * 60) {
				// End reconnecting after a specific timeout and flush all commands
				// with a individual error
				return new Error('Retry time exhausted');
			}
			if (options.attempt > 50) {
				// End reconnecting with built in error
				return undefined;
			}
			let tt = Math.max(options.attempt * 1000, 3000);
			// reconnect after
			console.log("["+options.error.code+"] Retrying to connect redis in "+(tt/1000.0)+" sec");
			return tt;
		}
	});
module.exports = client;

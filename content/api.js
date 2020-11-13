module.exports.request = function ({ res }) {
	res.writeHead(200, { 'Content-Type': 'text/json' });

	return JSON.stringify({
		a: true,
		b: false,
		c: {
			wtf: 'poot',
		},
	});
};

module.exports.connect = function ({ ws }) {
	ws.on('message', data => {
		console.log(data);
	});

	return true; // Accept the connection.
};

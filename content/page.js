module.exports.title = function () {
	return 'Title';
};

module.exports.body = async function ({ req, session }) {
	if (req.method === 'POST') {
		let body = '';

		await new Promise((resolve) => {
			req.on('data', chunk => {
				body += chunk.toString(); // convert Buffer to string
			});
			req.on('end', () => {
				resolve();
			});
		});

		let data;

		switch (req.headers['content-type']) {
		case 'application/x-www-form-urlencoded':
			break;
		case 'application/json':
			data = JSON.parse(body);
			break;
		default:
			break;
		}

		if (data.username === 'test' && data.password === 'test') {
			session.loggedIn = true;
		}

		console.log(req);
	}

	return renderTemplate(session.loggedIn ? 'content/loggedin.fragment.html' : 'content/loggedout.fragment.html');
};

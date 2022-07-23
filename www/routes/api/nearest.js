'use strict';

var mod = 900;

module.exports = get;

var rate_limit = {}; // Max 1 per second, or 2 if clear_rate_limit and a poll happen in the same second, which is ok
function clear_rate_limit() {
	rate_limit = {};
	setTimeout(clear_rate_limit, 5000);
}

async function get(req, res) {
	const app = req.app.app;

	var city = req.query.city;
	var epoch = parseInt(req.query.epoch);
	var lat = (parseFloat(req.query.lat)).toFixed(2);
	var lon = (parseFloat(req.query.lon)).toFixed(2);

	var now = app.now();
	var dt = now - (now % mod);

	var valid = {
		lat: lat,
		lon: lon,
		city: city,
		epoch: dt,
		required: ['city', 'lat', 'lon', 'epoch'],
	}
	req.alternativeUrl = '/api/nearest.json';
	var valid = req.verify_query_params(req, valid);
	if (valid !== true) {
		return valid;
	}

	var rows = [], result = [];
	var state_query = '', state = null;
	var query_parameters;

	if (city.indexOf(',') !== -1) {
		var split = city.split(',');
		city = split[0].trim();
		state = split[1].trim();
		state_query = 'and (state_abbr = ? or state_name like ?)';
		query_parameters = [lat, lon, city + '%', state, state + '%'];
	} else {
		query_parameters = [lat, lon, city + '%'];
	}
	var query = 'select *, abs(abs(? - lat) + abs(? - lon)) distance from cities where city like ? ' + state_query + ' order by 8 limit 10';
	console.log(query);

	rows = await app.mysql.query(query, query_parameters);
	for (var i = 0; i < rows.length; i++) {
		var row = rows[i];
		console.log(row);
		result.push({
			value: row.city + ', ' + row.state_name,
			data: {lat: row.lat, lon: row.lon}
			});
	}

	console.log(result);

	return {
	    json: result,
	    ttl: mod
	};
}

// select *, abs(abs(34.16 - lat) + abs(-80.95 - lon)) distance from cities where city like 'midland%' order by 8 limit 10;
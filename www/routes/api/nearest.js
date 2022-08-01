'use strict';

let mod = 86400;

module.exports = get;

let rate_limit = {}; // Max 1 per second, or 2 if clear_rate_limit and a poll happen in the same second, which is ok
function clear_rate_limit() {
	rate_limit = {};
	setTimeout(clear_rate_limit, 5000);
}

async function get(req, res) {
	const app = req.app.app;

	let city = req.query.city;
	let epoch = parseInt(req.query.epoch);
	let lat = (parseFloat(req.query.lat)).toFixed(2);
	let lon = (parseFloat(req.query.lon)).toFixed(2);

	let now = app.now();
	let dt = now - (now % mod);

	let valid = {
		lat: lat,
		lon: lon,
		city: city,
		epoch: dt,
		required: ['city', 'lat', 'lon', 'epoch'],
	}
	req.alternativeUrl = '/api/nearest.json';
	valid = req.verify_query_params(req, valid);
	if (valid !== true) {
		return valid;
	}

	let rows = [], result = [];
	let state_query = '', state = null;
	let query_parameters;

	if (city.indexOf(',') !== -1) {
		let split = city.split(',');
		city = split[0].trim();
		state = split[1].trim();
		state_query = 'and (state_abbr = ? or state_name like ?)';
		query_parameters = [lon, lat, city + '%', state, state + '%'];
	} else {
		query_parameters = [lon, lat, city + '%'];
	}
	let query = 'select *, ST_Distance_Sphere(point(?, ?), point(lon, lat)) distance from cities where city like ? ' + state_query + ' group by city, state_name  order by 8   limit 10';

	rows = await app.mysql.query(query, query_parameters);
	for (let i = 0; i < rows.length; i++) {
		let row = rows[i];
		result.push({
			value: row.city + ', ' + row.state_name,
			data: {lat: row.lat, lon: row.lon}
			});
	}

	return {
	    json: result,
	    ttl: mod
	};
}

// select *, abs(abs(34.16 - lat) + abs(-80.95 - lon)) distance from cities where city like 'midland%' order by 8 limit 10;

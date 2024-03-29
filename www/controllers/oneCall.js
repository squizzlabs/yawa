'use strict';

let mod = 900;

const path = '/oneCall.html';

module.exports = {
	paths: path,

	get: async function(req, res) {
		const app = req.app.app;

		let lat = (parseFloat(req.query.lat)).toFixed(2);
		let lon = (parseFloat(req.query.lon)).toFixed(2);
		let epoch = parseInt(req.query.epoch);

		let now = app.now();
		let dt = now - (now % mod);

		let valid = {
			lat: lat,
			lon: lon,
			epoch: dt,
			required: ['lat', 'lon', 'epoch'],
		}
		req.alternativeUrl = path;
		valid = req.verify_query_params(req, valid);
		if (valid !== true) return {redirect: valid}; // redirect

		let result = {};
		let isUSA = false;

		// Do we already have the lat/lon location in our database?
		let city = await app.mysql.queryRow('select city, state_name, state_abbr from cities where lat = ? and lon = ?', [lat, lon]);

		// If not, we need to look it up
		if (city == null || city.city == undefined || city.state_name == undefined) {
			await rate_limit(app, location_rate_limiter, 1);

			// Uses locationiq
			let locationiq = 'https://us1.locationiq.com/v1/reverse.php?key=' + process.env.locationiq + '&lat=' + lat + '&lon=' + lon + '&zoom=18&format=json';

			console.log('Fetching unknown location:', lat, lon);
			let location = JSON.parse((await app.phin(locationiq)).body);
			console.log('Unknown location lookup', lat, lon, location);
			if (location && location.address) result.location = (location.address.city || 'Unknown city') + ', ' + (location.address.state || 'Unknown state');
			else result.location = 'Unknown location';

			// Double check that we're in the USA
			if (location && location.address) {
				isUSA = (location.address.country_code == 'us');
			}

			// get the state's abbreviation
			let state_abbr = await app.mysql.queryRow('select state_abbr from cities where state_name = ? limit 1', [location.address.state]);
			if (isUSA && location.address.county && location.address.city && state_abbr) {
				state_abbr = state_abbr.state_abbr;
				await app.mysql.query('insert ignore into cities (state_abbr, state_name, city, county, lat, lon) values (?, ?, ?, ?, ?, ?)', [state_abbr, location.address.state, location.address.city, location.address.county.replace(' County', ''), lat, lon]);
			}
		} else {
			isUSA = true;
			result.location = city.city + ', ' + city.state_name;
		}


		if (isUSA) {
			await rate_limit(app, weather_rate_limiter, 1);

			let openweather = 'https://api.openweathermap.org/data/2.5/onecall?lat=' + lat + '&lon=' + lon + '&appid=' + process.env.openweather;
			let weather = await app.redis.get(epoch + ':' + openweather);
			if (weather != null) result.weather = JSON.parse(weather); // use the cached result
			else {
				result.weather = JSON.parse((await app.phin(openweather)).body); // fetch the weather
				await app.redis.setex(epoch + ':' + openweather, 900, JSON.stringify(result.weather)); // and store the result in cache
			}
		} else {
			result.weather = {hourly: [], daily: []};
			result.location = 'Unsupported location';
		}
		result.conversion = conversion;

		return {
		    package: result,
		    ttl: mod,
		    view: 'oneCall.pug'
		};
	}
}

async function rate_limit(app, object, limit_per_second) {
	let now = Date.now();
	let epoch = Math.floor(now / 1000).toString();

	if (object[epoch] == undefined) object[epoch] = 0;
	while (object[epoch] >= limit_per_second) await app.sleep(10);
	object[epoch]++;
}

let weather_rate_limiter = {};
let location_rate_limiter = {};
function clear_rate_limits() {
	try {
		let epoch = Math.floor(Date.now() / 1000).toString();
		clearObject(weather_rate_limiter, epoch);
		clearObject(location_rate_limiter, epoch);
	} finally {
		setTimeout(clear_rate_limits, 5000);
	}
}
function clearObject(object, epoch) {
	for (let key of Object.keys(object)) {
		if (key != epoch) {
			delete object[key];
		}
	}
}
setTimeout(clear_rate_limits, 5000);

const conversion = {
	"200": {"label": "thunderstorm with light rain","icon": "storm-showers"},
	"201": {"label": "thunderstorm with rain","icon": "storm-showers"},
	"202": {"label": "thunderstorm with heavy rain","icon": "storm-showers"},
	"210": {"label": "light thunderstorm","icon": "storm-showers"},
	"211": {"label": "thunderstorm","icon": "thunderstorm"},
	"212": {"label": "heavy thunderstorm","icon": "thunderstorm"},
	"221": {"label": "ragged thunderstorm","icon": "thunderstorm"},
	"230": {"label": "thunderstorm with light drizzle","icon": "storm-showers"},
	"231": {"label": "thunderstorm with drizzle","icon": "storm-showers"},
	"232": {"label": "thunderstorm with heavy drizzle","icon": "storm-showers"},
	"300": {"label": "light intensity drizzle","icon": "sprinkle"},
	"301": {"label": "drizzle","icon": "sprinkle"},
	"302": {"label": "heavy intensity drizzle","icon": "sprinkle"},
	"310": {"label": "light intensity drizzle rain","icon": "sprinkle"},
	"311": {"label": "drizzle rain","icon": "sprinkle"},
	"312": {"label": "heavy intensity drizzle rain","icon": "sprinkle"},
	"313": {"label": "shower rain and drizzle","icon": "sprinkle"},
	"314": {"label": "heavy shower rain and drizzle","icon": "sprinkle"},
	"321": {"label": "shower drizzle","icon": "sprinkle"},
	"500": {"label": "light rain","icon": "rain"},
	"501": {"label": "moderate rain","icon": "rain"},
	"502": {"label": "heavy intensity rain","icon": "rain"},
	"503": {"label": "very heavy rain","icon": "rain"},
	"504": {"label": "extreme rain","icon": "rain"},
	"511": {"label": "freezing rain","icon": "sleet"},
	"520": {"label": "light intensity shower rain","icon": "showers"},
	"521": {"label": "shower rain","icon": "showers"},
	"522": {"label": "heavy intensity shower rain","icon": "showers"},
	"531": {"label": "ragged shower rain","icon": "showers"},
	"600": {"label": "light snow","icon": "snow"},
	"601": {"label": "snow","icon": "snow"},
	"602": {"label": "heavy snow","icon": "snow"},
	"611": {"label": "sleet","icon": "sleet"},
	"612": {"label": "shower sleet","icon": "sleet"},
	"615": {"label": "light rain and snow","icon": "sleet"},
	"616": {"label": "rain and snow","icon": "sleet"},
	"620": {"label": "light shower snow","icon": "sleet"},
	"621": {"label": "shower snow","icon": "sleet"},
	"622": {"label": "heavy shower snow","icon": "sleet"},
	"701": {"label": "mist","icon": "sprinkle"},
	"711": {"label": "smoke","icon": "smoke"},
	"721": {"label": "haze","icon": "day-haze"},
	"731": {"label": "sand, dust whirls","icon": "cloudy-gusts"},
	"741": {"label": "fog","icon": "fog"},
	"751": {"label": "sand","icon": "cloudy-gusts"},
	"761": {"label": "dust","icon": "dust"},
	"762": {"label": "volcanic ash","icon": "smog"},
	"771": {"label": "squalls","icon": "day-windy"},
	"781": {"label": "tornado","icon": "tornado"},
	"800": {"label": "clear sky","icon": "day_clear"},
	"801": {"label": "few clouds","icon": "cloudy"},
	"802": {"label": "scattered clouds","icon": "cloudy"},
	"803": {"label": "broken clouds","icon": "cloudy"},
	"804": {"label": "overcast clouds","icon": "cloudy"},
	"900": {"label": "tornado","icon": "tornado"},
	"901": {"label": "tropical storm","icon": "hurricane"},
	"902": {"label": "hurricane","icon": "hurricane"},
	"903": {"label": "cold","icon": "snowflake-cold"},
	"904": {"label": "hot","icon": "hot"},
	"905": {"label": "windy","icon": "windy"},
	"906": {"label": "hail","icon": "hail"},
	"951": {"label": "calm","icon": "day_clear"},
	"952": {"label": "light breeze","icon": "cloudy-gusts"},
	"953": {"label": "gentle breeze","icon": "cloudy-gusts"},
	"954": {"label": "moderate breeze","icon": "cloudy-gusts"},
	"955": {"label": "fresh breeze","icon": "cloudy-gusts"},
	"956": {"label": "strong breeze","icon": "cloudy-gusts"},
	"957": {"label": "high wind, near gale","icon": "cloudy-gusts"},
	"958": {"label": "gale","icon": "cloudy-gusts"},
	"959": {"label": "severe gale","icon": "cloudy-gusts"},
	"960": {"label": "storm","icon": "thunderstorm"},
	"961": {"label": "violent storm","icon": "thunderstorm"},
	"962": {"label": "hurricane","icon": "cloudy-gusts"}
};

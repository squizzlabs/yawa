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

	var lat = (parseFloat(req.query.lat)).toFixed(2);
	var lon = (parseFloat(req.query.lon)).toFixed(2);
	var epoch = parseInt(req.query.epoch);

	var now = app.now();
	var dt = now - (now % mod);

	var valid = {
		lat: lat,
		lon: lon,
		epoch: dt,
		required: ['lat', 'lon', 'epoch'],
	}
	req.alternativeUrl = '/oneCall.html';
	var valid = req.verify_query_params(req, valid);
	if (valid !== true) {
		return valid;
	}

	var result = {};

	// Do we already have the lat/lon location in our database?
	var city = await app.mysql.queryRow('select city, state_name from cities where lat = ? and lon = ?', [lat, lon]);

	if (city == null || city.city == undefined || city.state_name == undefined) {
		while ((rate_limit[now] || 0) >= 1) {
			await app.sleep(100);
			now = app.now();
			console.log('rate limiting at:', now);
		}
		rate_limit[now] = (rate_limit[now] || 0) + 1;

		var isUSA = false;

		// Uses locationiq
		var locationiq = 'https://us1.locationiq.com/v1/reverse.php?key=' + process.env.locationiq + '&lat=' + lat + '&lon=' + lon + '&zoom=18&format=json';

		console.log('Fetching unknown location:', lat, lon);
		location = JSON.parse((await app.phin(locationiq)).body);
		console.log('Unknown location lookup', lat, lon, location);
		if (location && location.address) result.location = (location.address.city || 'Unknown city') + ', ' + (location.address.state || 'Unknown state');
		else result.location = 'Unknown location';

		// Double check that we're in the USA
		if (location && location.address) {
			isUSA = (location.address.country_code == 'us');
			await app.redis.setex(locationiq, 864000, (isUSA ? result.location : 'Unsupported location')); // cache for 10 days
		}

		// get the state's abbreviation
		var state_abbr = await app.mysql.queryRow('select state_abbr from cities where state_name = ? limit 1', [location.address.state]);
		if (isUSA && location.address.county && location.address.city && state_abbr) {
			state_abbr = state_abbr.state_abbr;
			await app.mysql.query('insert ignore into cities (state_abbr, state_name, city, county, lat, lon) values (?, ?, ?, ?, ?, ?)', [state_abbr, location.address.state, location.address.city, location.address.county.replace(' County', ''), lat, lon]);
		}
	} else {
		isUSA = true;
		console.log('pre-cached city', city);
		result.location = city.city + ', ' + city.state_name;
	}


	if (isUSA) {
		var openweather = 'https://api.openweathermap.org/data/2.5/onecall?lat=' + lat + '&lon=' + lon + '&appid=' + process.env.openweather;
		var weather = await app.redis.get(epoch + ':' + openweather);
		if (weather != null) {
			result.weather = JSON.parse(weather);
		} else {
			result.weather = JSON.parse((await app.phin(openweather)).body);
			await app.redis.setex(epoch + ':' + openweather, 900, JSON.stringify(result.weather));
		}
	} else {
		result.weather = {hourly: [], daily: []};
		result.location = 'Unsupported location';
	}
	
	result.conversion = conversion;

   return {
        json: result,
        ttl: mod
    };
}

var conversion = {
"200": {
"label": "thunderstorm with light rain",
"icon": "storm-showers"
},
"201": {
"label": "thunderstorm with rain",
"icon": "storm-showers"
},
"202": {
"label": "thunderstorm with heavy rain",
"icon": "storm-showers"
},
"210": {
"label": "light thunderstorm",
"icon": "storm-showers"
},
"211": {
"label": "thunderstorm",
"icon": "thunderstorm"
},
"212": {
"label": "heavy thunderstorm",
"icon": "thunderstorm"
},
"221": {
"label": "ragged thunderstorm",
"icon": "thunderstorm"
},
"230": {
"label": "thunderstorm with light drizzle",
"icon": "storm-showers"
},
"231": {
"label": "thunderstorm with drizzle",
"icon": "storm-showers"
},
"232": {
"label": "thunderstorm with heavy drizzle",
"icon": "storm-showers"
},
"300": {
"label": "light intensity drizzle",
"icon": "sprinkle"
},
"301": {
"label": "drizzle",
"icon": "sprinkle"
},
"302": {
"label": "heavy intensity drizzle",
"icon": "sprinkle"
},
"310": {
"label": "light intensity drizzle rain",
"icon": "sprinkle"
},
"311": {
"label": "drizzle rain",
"icon": "sprinkle"
},
"312": {
"label": "heavy intensity drizzle rain",
"icon": "sprinkle"
},
"313": {
"label": "shower rain and drizzle",
"icon": "sprinkle"
},
"314": {
"label": "heavy shower rain and drizzle",
"icon": "sprinkle"
},
"321": {
"label": "shower drizzle",
"icon": "sprinkle"
},
"500": {
"label": "light rain",
"icon": "rain"
},
"501": {
"label": "moderate rain",
"icon": "rain"
},
"502": {
"label": "heavy intensity rain",
"icon": "rain"
},
"503": {
"label": "very heavy rain",
"icon": "rain"
},
"504": {
"label": "extreme rain",
"icon": "rain"
},
"511": {
"label": "freezing rain",
"icon": "sleet"
},
"520": {
"label": "light intensity shower rain",
"icon": "showers"
},
"521": {
"label": "shower rain",
"icon": "showers"
},
"522": {
"label": "heavy intensity shower rain",
"icon": "showers"
},
"531": {
"label": "ragged shower rain",
"icon": "showers"
},
"600": {
"label": "light snow",
"icon": "snow"
},
"601": {
"label": "snow",
"icon": "snow"
},
"602": {
"label": "heavy snow",
"icon": "snow"
},
"611": {
"label": "sleet",
"icon": "sleet"
},
"612": {
"label": "shower sleet",
"icon": "sleet"
},
"615": {
"label": "light rain and snow",
"icon": "sleet"
},
"616": {
"label": "rain and snow",
"icon": "sleet"
},
"620": {
"label": "light shower snow",
"icon": "sleet"
},
"621": {
"label": "shower snow",
"icon": "sleet"
},
"622": {
"label": "heavy shower snow",
"icon": "sleet"
},
"701": {
"label": "mist",
"icon": "sprinkle"
},
"711": {
"label": "smoke",
"icon": "smoke"
},
"721": {
"label": "haze",
"icon": "day-haze"
},
"731": {
"label": "sand, dust whirls",
"icon": "cloudy-gusts"
},
"741": {
"label": "fog",
"icon": "fog"
},
"751": {
"label": "sand",
"icon": "cloudy-gusts"
},
"761": {
"label": "dust",
"icon": "dust"
},
"762": {
"label": "volcanic ash",
"icon": "smog"
},
"771": {
"label": "squalls",
"icon": "day-windy"
},
"781": {
"label": "tornado",
"icon": "tornado"
},
"800": {
"label": "clear sky",
"icon": "day_clear"
},
"801": {
"label": "few clouds",
"icon": "cloudy"
},
"802": {
"label": "scattered clouds",
"icon": "cloudy"
},
"803": {
"label": "broken clouds",
"icon": "cloudy"
},
"804": {
"label": "overcast clouds",
"icon": "cloudy"
},
"900": {
"label": "tornado",
"icon": "tornado"
},
"901": {
"label": "tropical storm",
"icon": "hurricane"
},
"902": {
"label": "hurricane",
"icon": "hurricane"
},
"903": {
"label": "cold",
"icon": "snowflake-cold"
},
"904": {
"label": "hot",
"icon": "hot"
},
"905": {
"label": "windy",
"icon": "windy"
},
"906": {
"label": "hail",
"icon": "hail"
},
"951": {
"label": "calm",
"icon": "day_clear"
},
"952": {
"label": "light breeze",
"icon": "cloudy-gusts"
},
"953": {
"label": "gentle breeze",
"icon": "cloudy-gusts"
},
"954": {
"label": "moderate breeze",
"icon": "cloudy-gusts"
},
"955": {
"label": "fresh breeze",
"icon": "cloudy-gusts"
},
"956": {
"label": "strong breeze",
"icon": "cloudy-gusts"
},
"957": {
"label": "high wind, near gale",
"icon": "cloudy-gusts"
},
"958": {
"label": "gale",
"icon": "cloudy-gusts"
},
"959": {
"label": "severe gale",
"icon": "cloudy-gusts"
},
"960": {
"label": "storm",
"icon": "thunderstorm"
},
"961": {
"label": "violent storm",
"icon": "thunderstorm"
},
"962": {
"label": "hurricane",
"icon": "cloudy-gusts"
}
};

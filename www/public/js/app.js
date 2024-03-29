let weatherLoaded = false;
let timezone = null;
let queried_position = { lat: 0, lon: 0 };
let location_has_focus = false;

let lastEpoch = 0; // to determine last time weather was loaded
let next_weather_call = null;
const epoch_mod = 900;

function getCurrentEpoch() {
	let epoch = Math.floor(Date.now() / 1000);
	epoch = epoch - (epoch % epoch_mod);
	return epoch;
}
 
function documentReady() {
	loadWeather();
	setInterval(updateTime, 1000);

	$("#location-clicker").on("click", loadWeatherFromGeo);
    $("#yawaheader").on('click', loadWeatherFromGeo);

	$("#location").on('focus', clearSearch);
	$('#location').autocomplete({
        autoSelectFirst: true,
        lookup: doNearest,
        onSelect: autocompleteselect,
        error: function (xhr) {
            console.log(xhr);
        }
    });
    $('#location').autocomplete('disable');
    $("#location").on('focus', () => {location_has_focus = true;})
    $("#location").on('blur', handleLocationBlur);
}

function handleLocationBlur() {
	location_has_focus = false;
	if ($("#location").val().trim() == '') $('#location-clicker').click();
	else updateStatus('Please complete your search...');
}

function autocompleteselect(suggestion) {
	$("#location").blur();
    console.log('selected: ', suggestion);
    geoLoaded({
    	coords: {
    		latitude: parseFloat(suggestion.data.lat),
    		longitude: parseFloat(suggestion.data.lon)
    	}
    });
}

function clearSearch() {
	$("#geolocation").removeClass('btn-primary');
	$("#location").val('').autocomplete('enable');
	$("#weather").html("");
}


function doNearest(text, done) {
	if (text == '') return;
	let url = '/api/nearest.json?city=' + text + '&epoch=0&lat=' + queried_position.lat + '&lon=' + queried_position.lon;
	$.get(url, 
		function(result) {
			if (result == null) return;
			done({suggestions: result});
		}
	);
	gtag('event', 'nearest', {lat: queried_position.lat, lon: queried_position.lon});
}

const time_format_options = {
	weekday: "long", year: "numeric", month: "short",  day: "numeric", hour: "2-digit", minute: "2-digit"
};
function updateTime() {
	if (weatherLoaded == false) return;

	if (getCurrentEpoch() != lastEpoch) {
		weatherLoaded = false;
		$("#currentTime").html("");
		clearTimeout(next_weather_call);
		loadWeather();
	}

	let date = new Date();  
	$("#currentTime").html(date.toLocaleTimeString("en-us", time_format_options));
	setTimeout(updateTime, (1000 * (60 - date.getSeconds())));
}

function loadWeatherFromGeo() {
	$("#geolocation").removeClass('btn-primary'); // remove the class just in case it already exists
	$("#geolocation").addClass('btn-primary');
	$("#location").autocomplete('disable');
	loadWeather();

	return false;
}

function loadWeather() {
	try {
		if ($("#geolocation").hasClass('btn-primary') == false) {
			if (location_has_focus == true) return; // Don't load anything while the user is entering data
			geoLoaded(null);
		} else if (navigator.geolocation && $("#geolocation").hasClass('btn-primary')) {
			console.log('requesting location from browser');
			updateStatus('Requesting location from your browser ...');
			navigator.geolocation.getCurrentPosition(geoLoaded, geoError, {timeout: 15000});
		} else if (navigator.geoLocation == null) {
			updateStatus('Unable to load geo position! Not supported by your browser.')
			$("#location-clicker").remove();
		}
	} catch (e) {
		// something went very wrong, reload the page and pretend like it didn't happen
		console.error('An error occursed within loadWeather()');
		console.error(e);
		window.location = '/';
	}
}

function geoLoaded(position) {
	console.log('position', position);
	if (position != null) {
		let coords = position.coords;
		queried_position = { lat: coords.latitude.toFixed(2), lon: coords.longitude.toFixed(2) };
	}
	let epoch = getCurrentEpoch();
    updateStatus('Fetching your weather forecast...');

    console.log("Lat: " + queried_position.lat + " Lon: " + queried_position.lon);

	let uri = '/oneCall.html?epoch=' + epoch + '&lat=' + queried_position.lat + '&lon=' + queried_position.lon;
	$("#weather").load(uri, loadWeatherComplete);
}

function geoError(reason) {
	reason = reason | {};
	if (reason.message == null) reason.message = "no error reason given!";
    updateStatus('<h4>ERROR:</h4><p>' + reason.message.toString() + '</p>');
	console.log(reason);
}

function loadWeatherComplete(response, status, xhr) {
	update_values();
	
	let location_hidden = $("#locationhidden").text();
	if (location_hidden.indexOf('Unknown city') != -1 && $("#location").val() != '') {
		location_hidden = $("#location").val(); // Default to what we already have
	}

	$("#location").val(location_hidden);
    updateStatus('');
	console.log('Weather loaded');
	
	let now = Date.now();
	let next = (epoch_mod * 1000) - (now % (epoch_mod * 1000));
	
	next_weather_call = setTimeout(loadWeather, next);
	lastEpoch = getCurrentEpoch();
	weatherLoaded = true;

	gtag('event', 'weather_lookup', {lat: queried_position.lat, lon: queried_position.lon, location: location_hidden});
}

function update_values() {
	$(".temp").each(function() {
		let elem = $(this);
		let value = parseFloat(elem.text());
		let f = Math.round((( value - 273.15) * 1.8) + 32);
		elem.text(f + '℉');
	});

	$(".wind").each(function() {
		let elem = $(this);
		let value = parseFloat(elem.text());
		let f = Math.round(value / 1.609);
		elem.text(f + 'mph');
	});

	let now = new Date();
	let today = left_zero(now.getMonth()) + '-' + left_zero(now.getDate());
	let days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
	timezone = $("#timezone").text();
	$(".dt").each(function(index) {
		let elem = $(this);
		let isDaily = elem.hasClass('daily');
		let value = parseInt(elem.text());
		let date = new Date(value * 1000);
		let day = left_zero(date.getMonth()) + '-' + left_zero(date.getDate());
		let time = "";
		if (day != today) time += days[date.getDay()] + ' ';
		else time += 'Today ';

		if (isDaily && time == 'Today ') {
			time += '<br/>' + date.toLocaleDateString("en-US", { month: 'long', day: 'numeric' , timeZone: timezone });
		} else if (isDaily && time != 'Today ') {
			time = days[date.getDay()] + '<br/>' + date.toLocaleDateString("en-US", { month: 'long', day: 'numeric' , timeZone: timezone });
		} else if (!isDaily) {
			let hours = date.toLocaleDateString("en-US", { hour12: true , hour: '2-digit' , timeZone: timezone});
			let split = hours.split(',');
			let actual_hour = split.length >= 2 ? split[1] : split[0];
			time += actual_hour.trim().toLowerCase().replace(/^0/, '').replace(' ', '');
		}
		elem.html(time);
	});

	$(".weather-card").first().each(function() {
		let elem = $(this);
		let id = '#' + elem.attr('id');
		let low = $(id + ' .lowtemp').first().text();
		let condition = $(id + ' .condition').first().text();
		$(document).prop('title', low + ' ' + condition + ' | Yet Another Weather App');
	});
	$(".weather-card img").first().one('load', applyCurrentHourtoHeaderAndFavicon);

	if (!window.speechSynthesis) return; // Don't execute following code if speech synthensizing isn't available

	$(".weather-card").each(function() {
		let elem = $(this);
		let id = '#' + elem.attr('id');
		let dt = $(id + ' .dt').first().html().replace('<br>', ', ');
		let condition = $(id + ' .condition').first().text();
		let low = $(id + ' .lowtemp').first().text();
		let feelslike = $(id + ' .feelslike').first().text();
		let high = $(id + ' .hightemp').first().text();
		let humidity = $(id + ' .humidity').first().text();
		let rain = $(id + ' .rain').first().text();
		let wind = $(id + ' .wind').first().text();

		let speech = numberAppend(dt) + ', ' + condition + ', ';
		if (feelslike != '') speech += 'Temperature ' + low + ' and feels like ' + feelslike + ', ';
		else if (high != '') speech += 'Low ' + low + ', High ' + high + ', ';
		else speech += 'Temperature ' + low + ', ';
		speech += 'Humidity ' + humidity + ', ';

		let type = 'Precipitation ';
		let hasSnow = condition.indexOf('snow') > -1;
		let hasRain = condition.indexOf('rain') > -1;
		if (hasSnow && hasRain) type = 'rain and snow ';
		else if (hasSnow) type = 'snow ';
		else if (hasRain) type = 'rain ';

		speech += type + rain;
		speech += ', wind at ' + wind;
		$(id + ' .speech').attr('speech', speech.trim());
	});
	$(".speech").on('click', utter);
}

function applyCurrentHourtoHeaderAndFavicon() {
	let  img = $(this);
	let canvas = document.createElement('CANVAS');
	let ctx = canvas.getContext("2d");
	let srcImg = img[0];

	canvas.width = 50;
	canvas.height = 50;
	ctx.drawImage(srcImg, 0, 0, ctx.canvas.width, ctx.canvas.height);
	let imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
	if (img.hasClass('night')) {
		console.log('Applying night greyscale');
		let pixels = imgData.data;
		for (var i = 0; i < pixels.length; i += 4) {
			let lightness = parseInt((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
			pixels[i] = lightness;
			pixels[i + 1] = lightness;
			pixels[i + 2] = lightness;
		}
	}
	ctx.putImageData(imgData, 0, 0);
	let base64 = canvas.toDataURL();
	$("#headericon").attr('src', base64);
	$("#favicon").attr('href', base64);
}

function numberAppend(dt) {
    switch(dt.at(-1)) {
        case '0':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
            return dt + 'th';
        case '1':
            return dt + 'st';
        case '2':
            return dt + 'nd';
        case '3':
            return dt + 'rd';
    }
    return dt;
}

function utter() {
	let elem = $(this);
	let speech = elem.attr('speech');
	let utterance = new SpeechSynthesisUtterance(speech);
	let synth = window.speechSynthesis;
    synth.cancel();
    utterance.volume = 1;
	synth.speak(utterance);
	updateStatus('Speaking: ' + speech, 10000);
}

function left_zero(text) {
	return ('0' + text).substr(-2);
}

let status_timeout = undefined;
function updateStatus(message = '', auto_clear = undefined) {
	if (message == undefined) message = '';
	if (status_timeout != undefined) clearTimeout(status_timeout);
	$('#status').html('<i>' + message + '</i>');
	if (auto_clear) status_timeout = setTimeout(updateStatus, auto_clear);
}

$(document).ready(documentReady);

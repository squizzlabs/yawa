var weatherLoaded = false;
var timezone = null;
var queried_position = { lat: 0, lon: 0 };

function documentReady() {
	if (window.location.protocol == 'http:') {
		window.location = 'https://' + window.location.host;
		return;
	}

	loadWeather();
	setInterval(updateTime, 1000);

	$("#location-clicker").on("click", loadWeatherFromGeo);

	$("#location").on('focus', clearSearch);
	$('#location').autocomplete({
        autoSelectFirst: true,
        lookup: doNearest,
        onSelect: function (suggestion) {
        	$("#location").blur();
            console.log('selected: ', suggestion);
            geoLoaded({
            	coords: {
            		latitude: parseFloat(suggestion.data.lat),
            		longitude: parseFloat(suggestion.data.lon)
            	}
            });
        },
        error: function (xhr) {
            console.log(xhr);
        }
    });
    $('#location').autocomplete('disable');
}

function clearSearch() {
	$("#geolocation").removeClass('btn-primary');
	$("#location").val('').autocomplete('enable');
	$("#weather").html("");
}

function loadWeatherFromGeo() {
	$("#geolocation").removeClass('btn-primary'); // remove the class just in case it already exists
	$("#geolocation").addClass('btn-primary');
	$("#location").autocomplete('disable');
	loadWeather();
}

function doNearest(text, done) {
	if (text == '') return;
	var url = '/api/nearest.json?city=' + text + '&epoch=0&lat=' + queried_position.lat + '&lon=' + queried_position.lon;
	$.get(url, 
		function(result) {
			if (result == null) return;
			done({suggestions: result});
		}
	);
}

function updateTime() {
	if (weatherLoaded == false) return;
	let date = new Date();  
	let options = {  
    	weekday: "long", year: "numeric", month: "short",  day: "numeric", hour: "2-digit", minute: "2-digit"
    };
	$("#currentTime").html(date.toLocaleTimeString("en-us", options));
	setTimeout(updateTime, (1000 * (60 - date.getSeconds())));
}

function loadWeather() {
	if ($("#geolocation").hasClass('btn-primary') == false) {
		if ($("#location").hasFocus()) return;
		geoLoaded(null);
	} else if (navigator.geolocation && $("#geolocation").hasClass('btn-primary')) {
		$("#status").html("<i>fetching your location ...</i>");
		navigator.geolocation.getCurrentPosition(geoLoaded, geoError);
	} else if (navigator.geoLocation == null) {
		$("#status").html("Cannot load geo position");
		$("#location-clicker").remove();
	}
}

function geoLoaded(position) {
	console.trace();
	if (position != null) {
		var coords = position.coords;
		queried_position = { lat: coords.latitude.toFixed(2), lon: coords.longitude.toFixed(2) };
	}
	var epoch = Math.floor(Date.now() / 1000);
	epoch = epoch - (epoch % 900);
    $("#status").html('<i>fetching your weather forecast ...</i>');

    console.log("Lat: " + queried_position.lat + " Lon: " + queried_position.lon);

	var uri = 'oneCall.html?epoch=' + epoch + '&lat=' + queried_position.lat + '&lon=' + queried_position.lon;
	$("#weather").load(uri, loadWeatherComplete);
}

function geoError(reason) {
	if (reason == null) reason = "no error reason given!";
    $("#status").html('<h4>ERROR:</h4><p>' + reason.toString() + '</p>');
	console.log(reason);
}

function loadWeatherComplete() {
	update_values();
	
	var location_hidden = $("#locationhidden").text();
	if (location_hidden.indexOf('Unknown city') != -1 && $("#location").val() != '') {
		location_hidden = $("#location").val(); // Default to what we already have
	}

	$("#location").val(location_hidden);
    $("#status").html('');
	console.log('Weather loaded');
	
	var now = Date.now();
	var next = 900000 - (now % 900000);
	
	setTimeout(loadWeather, next);
	weatherLoaded = true;
}

function update_values() {
	$(".temp").each(function() {
		var elem = $(this);
		var value = parseFloat(elem.text());
		var f = Math.round((( value - 273.15) * 1.8) + 32);
		elem.text(f + '℉');
	});

	$(".wind").each(function() {
		var elem = $(this);
		var value = parseFloat(elem.text());
		var f = Math.round(value / 1.609);
		elem.text(f + 'mph');
	});

	var now = new Date();
	var today = left_zero(now.getMonth()) + '-' + left_zero(now.getDate());
	var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
	timezone = $("#timezone").text();
	$(".dt").each(function(index) {
		var elem = $(this);
		var isDaily = elem.hasClass('daily');
		var value = parseInt(elem.text());
		var date = new Date(value * 1000);
		var day = left_zero(date.getMonth()) + '-' + left_zero(date.getDate());
		var time = "";
		if (day != today) time += 'Tomorrow ';
		else time += 'Today ';

		if (isDaily && time == 'Today ') {
			time += '<br/>' + date.toLocaleDateString("en-US", { month: 'long', day: 'numeric' , timeZone: timezone });
		} else if (isDaily && time != 'Today ') {
			time = days[date.getDay()] + '<br/>' + date.toLocaleDateString("en-US", { month: 'long', day: 'numeric' , timeZone: timezone });
		} else if (!isDaily) {
			var hours = date.toLocaleDateString("en-US", { hour12: true , hour: '2-digit' , timeZone: timezone});
			var split = hours.split(',');
			var actual_hour = split.length >= 2 ? split[1] : split[0];
			time += actual_hour.trim().toLowerCase().replace(/^0/, '').replace(' ', '');
		}
		elem.html(time);
	});

	$(".weather-card").first().each(function() {
		var elem = $(this);
		var id = '#' + elem.attr('id');
		var low = $(id + ' .lowtemp').first().text();
		var condition = $(id + ' .condition').first().text();
		$(document).prop('title', low + ' ' + condition + ' | Yet Another Weather App');

		var icon = $(id + ' .card-img-top').attr("src");
		$("#favicon").attr("href", icon);
		$("#headericon").attr("src", icon);
	});

	if (!window.speechSynthesis) return; // Don't execute following code if speech synthensizing isn't available

	$(".weather-card").each(function() {
		var elem = $(this);
		var id = '#' + elem.attr('id');
		var dt = $(id + ' .dt').first().text();
		var condition = $(id + ' .condition').first().text();
		var low = $(id + ' .lowtemp').first().text();
		var feelslike = $(id + ' .feelslike').first().text();
		var high = $(id + ' .hightemp').first().text();
		var rain = $(id + ' .rain').first().text();
		var wind = $(id + ' .wind').first().text();

		var speech = numberAppend(dt) + ', ' + condition + ', ';
		if (feelslike != '') speech += 'Temperature ' + low + ' and feels like ' + feelslike + ', ';
		else if (high != '') speech += 'Low ' + low + ', High ' + high + ', ';
		else speech += 'Temperature ' + low + ', ';

		var type = 'Precipitation ';
		var hasSnow = condition.indexOf('snow') > -1;
		var hasRain = condition.indexOf('rain') > -1;
		if (hasSnow && hasRain) type = 'rain and snow ';
		else if (hasSnow) type = 'snow ';
		else if (hasRain) type = 'rain ';

		speech += type + rain;
		speech += '. Wind at ' + wind;
		$(id + ' .speech').attr('speech', speech.trim());
	});
	$(".speech").on('click', utter);
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
	var elem = $(this);
	var speech = elem.attr('speech');
	var utterance = new SpeechSynthesisUtterance(speech);
	var synth = window.speechSynthesis;
    utterance.voice = synth.getVoices()[2];
    console.log(synth.getVoices());
	synth.cancel();
	synth.speak(utterance);
}

function left_zero(text) {
	return ('0' + text).substr(-2);
}

$(document).ready(documentReady);

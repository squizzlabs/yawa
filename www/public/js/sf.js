var weatherLoaded = false;
var timezone = null;

function documentReady() {
	if (window.location.protocol == 'http:') {
		window.location = 'https://' + window.location.host;
		return;
	}

	loadWeather();
	setInterval(updateTime, 1000);
}

function updateTime() {
	if (weatherLoaded == false) return;
	let date = new Date();  
	let options = {  
    	weekday: "long", year: "numeric", month: "short",  day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: timezone
    };
	$("#currentTime").html(date.toLocaleTimeString("en-us", options));
	setTimeout(updateTime, (1000 * (60 - date.getSeconds())));
}

function loadWeather() {
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(geoLoaded, geoError);
	} else {
		$("#weather").html("Cannot load geo position");
	}
}

function geoLoaded(position) {
	var coords = position.coords;
	var lat = coords.latitude.toFixed(2);
	var lon = coords.longitude.toFixed(2);
	var epoch = Math.floor(Date.now() / 1000);
	epoch = epoch - (epoch % 900);
	var uri = 'oneCall.html?epoch=' + epoch + '&lat=' + lat + '&lon=' + lon;
	$("#weather").load(uri, loadWeatherComplete);
}

function geoError(reason) {
	console.log(reason);
}

function loadWeatherComplete() {
	update_values();
	$("#location").text($("#locationhidden").text());
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

		if (isDaily && time != 'Today ') {
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
		$(document).prop('title', low + ' ' + condition);
		$("#favicon").attr("href", $(id + ' .card-img-top').attr("src"));
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

		var speech = dt + '. ' + condition + '. ';
		if (feelslike != '') speech += 'Temperature ' + low + ' degrees and feels like ' + feelslike + ' degrees. ';
		else if (high != '') speech += 'Low ' + low + ' degrees. High ' + high + ' degrees. ';
		else speech += 'Temperature ' + low + ' degrees. ';

		speech += 'Rain ' + rain + '. Wind at ' + wind;
		$(id + ' .speech').attr('speech', speech);
	});
	$(".speech").on('click', utter);
}

function utter() {
	var elem = $(this);
	var speech = elem.attr('speech');
	var utterance = new SpeechSynthesisUtterance(speech);
	var synth = window.speechSynthesis;
	synth.cancel();
	synth.speak(utterance);
}

function left_zero(text) {
	return ('0' + text).substr(-2);
}

$(document).ready(documentReady);
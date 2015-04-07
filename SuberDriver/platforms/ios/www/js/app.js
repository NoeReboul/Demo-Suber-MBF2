var API_URL = 'https://api.mpsa.com/bgd/connectedcar';
var API_KEY = '14d71583-0747-4ba2-ad80-38250432c784';
var CAB_TOPIC = 'com.suber.driver';
var CLIENT_TOPIC = 'com.suber.client';

var connection = new autobahn.Connection({
	url: 'ws://127.0.0.1:8080/ws',
	realm: 'realm1'
});
var app = angular.module('SuberDriver', ['onsen', 'ngResource', 'emguo.poller', 'uiGmapgoogle-maps']);

// L'objet Car est créé avec une factory.
// On regroupera dans cet objet toutes les méthodes relatives au véhicule.
app.factory('Car', function() {

	// Le constrcteur de l'objet
	var Car = this;
			this.vin = '';
			this.contrat = '';

			// pour l'instant on ne sait pas ou se trouve le véhicule
			this.position = null;

	return this;
});

app.factory('ClientList', function() {
	var ClientList = this;
	this.items = [];
	return this;
});


// Factory pour gérer le stockage sur l'appareil mobile.
// Permet d'enregistrer des objets ou des valeurs de clés.
// On l'utilisera pour stocker les préférences de l'utilisateur.
app.factory('$localstorage', ['$window', function($window) {
	return {
		set: function(key, value) {
			// enregistrer un couple clé / valeur
			$window.localStorage[key] = value;
		},
		get: function(key, defaultValue) {
			// récupérer la valeur d'uen clé
			return $window.localStorage[key] || defaultValue;
		},
		setObject: function(key, value) {
			// enregistrer un objet pour la clé
			$window.localStorage[key] = JSON.stringify(value);
		},
		getObject: function(key) {
			// récupérer l'object stocké dans la clé
			return JSON.parse($window.localStorage[key] || '{}');
		}
	};
}]);

app.controller("PublishingCtrl", function($scope) {
	$scope.clickMe = function(outgoingMsg) {
		if (connection.session) {
			connection.session.publish(CAB_TOPIC, [outgoingMsg]);
			console.log("event published!");
		} else {
			console.log("cannot publish: no session");
		}
	};
});

app.controller('DetailCtrl', function($scope, Car, ClientList) {
	$scope.item = ClientList.selectedItem;

	$scope.map = {
		center: {
			latitude:  Car.position.latitude,
			longitude: Car.position.longitude
		},
		zoom: 8
	};
	
	$scope.car_marker = {
		id: 0,
		coords: {
			latitude:  Car.position.latitude,
			longitude: Car.position.longitude
		},
		icon: 'img/ds3icon.png',
		options: {
			draggable: false
		}
	};
	
	$scope.client_marker = {
		id: 1,
		coords: {
			latitude:  ClientList.selectedItem.lat,
			longitude: ClientList.selectedItem.long
		},
		options: {
			draggable: false
		}
	};
});

app.controller("MainCtrl", function($scope, $resource, ClientList, poller, Car) {

	Car.vin = $scope.pref.vin;
	Car.contrat = $scope.pref.contrat;

	//$scope.car = new Car($scope.pref.vin, $scope.pref.contrat);

	// Define your resource object.
	var myResource = $resource(API_URL + '/1.0/place/lastposition/' + Car.vin + '?contract=' + Car.contrat + '&listsecond=6,12,18,24,30,36,42,48,54,60&client_id=' + API_KEY);

	// Get poller. This also starts/restarts poller.
	var myPoller = poller.get(myResource, {
		delay: 60000,
		catchError: true
	});

	// Update view. Since a promise can only be resolved or rejected once but we want
	// to keep track of all requests, poller service uses the notifyCallback. By default
	// poller only gets notified of success responses.
	myPoller.promise.then(null, null, function(response) {
		if (response.$resolved) {
			// on va rechercher la derniere position utilisable de la minute.
			// une table de hash n'est pas forcément triée par clée.
			var lats = response.latitude;

			keys = [];

			for (k in lats) {
				if (lats.hasOwnProperty(k)) {
					keys.push(k);
				}
			}

			keys.sort();

			len = keys.length;
			i = 0;
			for (i = len - 1; i > 0; i--) {
				if (lats[k] != null) {
					// on a trouvé une latitude correcte.
					break;
				}
			}
			
			Car.position = {
				'latitude': response.latitude[keys[i]],
				'longitude': response.longitude[keys[i]]
			};
		} else {
			// une gestion simpliste des erreurs :)
			ons.notification.alert({
				message: "Une erreur s'est produite. Merci de réessayer plus tard.",
				title: 'Erreur',
				buttonLabel: 'OK',
				animation: 'default',
				// or 'none'
				callback: function() {
					// Alert button is closed!
				}
			})
		}
	});

	// Stop poller.
	myPoller.stop();

	// Restart poller.
	myPoller.restart();

	$scope.items = ClientList.items;

	$scope.showDetail = function(index) {
		var selectedItem = ClientList.items[index];
		ClientList.selectedItem = selectedItem;

		$scope.$parent.app.navi.pushPage('detail.html');
	};


	var add_client = function(name, lat, long, date) {
			ClientList.items.push({
				name: name,
				lat: lat,
				long: long,
				date: date
			});
		};

	$scope.add_client_request = function(client_request) {

		req = JSON.parse(client_request);

		if (get_distance(Car.position.latitude, Car.position.longitude, req.position.latitude, req.position.longitude) <= $scope.pref.perim) {
			add_client(req.name, req.position.latitude, req.position.longitude, Date.now());
		}
	};

	var deg2rad = function(degrees) {
			return degrees * Math.PI / 180;
		};

	var get_distance = function($lat1, $lng1, $lat2, $lng2) {
			$earth_radius = 6378137; // Terre = sphère de 6378km de rayon
			$rlo1 = deg2rad($lng1);
			$rla1 = deg2rad($lat1);
			$rlo2 = deg2rad($lng2);
			$rla2 = deg2rad($lat2);
			$dlo = ($rlo2 - $rlo1) / 2;
			$dla = ($rla2 - $rla1) / 2;
			$a = (Math.sin($dla) * Math.sin($dla)) + Math.cos($rla1) * Math.cos($rla2) * (Math.sin($dlo) * Math.sin($dlo));
			$d = 2 * Math.atan2(Math.sqrt($a), Math.sqrt(1 - $a));
			return ($earth_radius * $d / 100);
		};
	connection.open();
});

/**
 * Login Controller : gère la connection de l'utilisateur
 *
 */
app.controller('LoginCtrl', function($scope, $localstorage) {
	ons.ready(function() {

		$scope.pref = {};
		// On intialise le VIN pour le créer
		$scope.pref.vin = '';

		// le contrat ...
		$scope.pref.contrat = '';

		// le code secure ...
		$scope.pref.code_secure = '';

		$scope.pref.perim = 0;
		
		// et le switch.
		$scope.pref.save_vin_switch = false;

		// si on a déjà des préférences enregistrées dans le mobile
		if ($localstorage.get('vin') !== undefined) {
			// on les charge
			$scope.pref.vin = $localstorage.get('vin');
		}

		if ($localstorage.get('contrat') !== undefined) {
			$scope.pref.contrat = $localstorage.get('contrat');
		}
	});

	$scope.save = function() {

		if ($scope.pref.save_vin_switch) {
			$localstorage.set('vin', $scope.pref.vin);
			$localstorage.set('contrat', $scope.pref.contrat);

			/* le code_secure NE DOIT JAMAIS être enregistré. */

		} else {
			// l'utilisateur choisi de ne pas sauvegarder son VIN et son contrat.
			$localstorage.set('vin', '');
			$localstorage.set('contrat', '');
		}

		return true;
	}
});

// "onopen" handler will fire when WAMP session has been established ..
connection.onopen = function(session) {

	console.log("session established!");

	// our event handler we will subscribe on our topic
	//

	function on_client_request(args, kwargs) {
		console.log("got event:", args, kwargs);

		var scope = angular.element(document.getElementById('Receiver')).scope();
		scope.$apply(function() {
			scope.add_client_request(args[0]);
		});
	}

	// subscribe to receive events on a topic ..
	//
	session.subscribe(CLIENT_TOPIC, on_client_request).then(

	function(subscription) {
		console.log("ok, subscribed with ID " + subscription.id);
	}, function(error) {
		console.log(error);
	});
};


// "onclose" handler will fire when connection was lost ..
connection.onclose = function(reason, details) {
	console.log("connection lost", reason);
}

var CAB_TOPIC = 'com.suber.driver';
var CLIENT_TOPIC = 'com.suber.client';

var position = {
	latitude: 48.9194648,
	longitude: 2.0219685
};

var connection = new autobahn.Connection({
	url: 'ws://127.0.0.1:8080/ws',
	realm: 'realm1'
});

var app = angular.module("SuberCab", ['onsen']);

app.factory('UUID', function() {
	var UUID = this; 
	this.guid = function() {
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
		}
		return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	}
	
	return this;
})

app.factory('User', function() {
	var User = this;
	this.name = '';
	this.id = '';

	return this;
});


/**
 * Login Controller : gère la connection de l'utilisateur
 *
 */
app.controller('LoginCtrl', function($scope) {
	ons.ready(function() {
		$scope.pref = {};
	});
});


app.controller("MainCtrl", function($scope, $interval, User, UUID) {
	User.name = $scope.pref.name;

	$scope.demande_en_cours = false;

	$scope.clickMe = function() {
		if (connection.session) {
			mesg = {
				name: User.name,
				client_id: User.id,
				position: position
			};
			connection.session.publish(CLIENT_TOPIC, [JSON.stringify(mesg)]);
			console.log("event published!");
			$scope.demande_en_cours = true;

			$scope.rech_pb = 0;
			$scope.interval = $interval(function() {
				$scope.rech_pb++;
				if ($scope.rech_pb == 100) {
					//on est arrivé à la fin du temps d'attente.
					ons.notification.alert({
						message: "Aucun véhicule n'est disponible.",
						title: 'Désolé',
						buttonLabel: 'OK',
						animation: 'default',
						callback: function() {
							$scope.demande_en_cours = false;
							$scope.$apply()
						}
					})
				}
			}, 500, 100);

		} else {
			console.log("cannot publish: no session");
		}
	};
	// "onopen" handler will fire when WAMP session has been established ..
	connection.onopen = function(session) {

		console.log("session established!");

		// our event handler we will subscribe on our topic
		//

		function on_cab_response(args, kwargs) {
			console.log("got event:", args, kwargs);
			var scope = angular.element(document.getElementById('Receiver')).scope();
			scope.$apply(function() {
				scope.process_cab_response(args[0]);
			});
		}

		// subscribe to receive events on a topic ..
		//
		session.subscribe(CAB_TOPIC, on_cab_response).then(

		function(subscription) {
			console.log("ok, subscribed with ID " + subscription.id);
			User.id = UUID.guid();
		}, function(error) {
			console.log(error);
		});
	};


	// "onclose" handler will fire when connection was lost ..
	connection.onclose = function(reason, details) {
		console.log("connection lost", reason);
	}


	// initiate opening of WAMP connection ..
	connection.open();

	$scope.process_cab_response = function(incomingMsg) {
		response = JSON.parse(incomingMsg);
		if (response.client_id == User.id) {
			$interval.cancel($scope.interval);
			$scope.$parent.app.navi.pushPage('success.html');
		}
	};
});

/**
 * Copyright 2015 PSA Peugeot Citroen 
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author Noé Reboul <noe.reboul@mpsa.com>
 */
 
 
// Topic des clients 
// On envoie sur ce topic toutes les demandes de courses
var CLIENT_TOPIC = 'com.suber.client';

// Topic des chauffeurs
// On envoie sur ce topic toutes les accepttions de courses
var CAB_TOPIC = 'com.suber.driver';

// Comme on fait la démo sur un émulateur on a pas accès au GPS
var position = {
    latitude: 48.9194648,
    longitude: 2.0219685
};

// Connection au serveur crossbar
var connection = new autobahn.Connection({
    url: 'ws://127.0.0.1:8080/ws',
    realm: 'realm1'
});

var app = angular.module("SuberCab", ['onsen']);

// Un générateur d'UUID. 
// Les uuids seront utilisés pour identifier de façon unique les clients
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

// l'objet client.
app.factory('User', function() {
    var User = this;
    this.name = '';
    this.id = '';

    return this;
});


/**
 * Login Controller : gère la connection de l'utilisateur
 * Dans notre démo il se résume a instancer un objet de préférences.
 */
app.controller('LoginCtrl', function($scope) {
    ons.ready(function() {
        $scope.pref = {};
    });
});

/**
 * Main Controller : le controleur principal de notre application
 */
app.controller("MainCtrl", function($scope, $interval, User, UUID) {

    User.name = $scope.pref.name;

    // ce booléen indique si une demande est en cours et permet d'occulter et de montrer la barre de progression
    $scope.demande_en_cours = false;

    // L'utilisateur fait uen demande de taxi
    $scope.clickMe = function() {

        // On vérifie que l'on a toujours accès à crossbar
        if (connection.session) {

            // Construction du message que l'on va envoyer sur le réseau
            mesg = {
                name: User.name,
                client_id: User.id,
                position: position
            };

            // Publication du message. Il sera consommé par tous les chauffeurs.
            connection.session.publish(CLIENT_TOPIC, [JSON.stringify(mesg)]);
            console.log("event published!");

            // On masque le bouton et on affiche la barre de progression
            $scope.demande_en_cours = true;

            // La barre de progression simule une recherche. C'est une illustration.
            // Dans un cas réel il faudrait traiter cela différemment.
            $scope.rech_pb = 0;

            // on récupère l'interval pour pouvoir le canceler si un chauffeur répond 
            // favorablement à la demande.
            $scope.interval = $interval(function() {
                $scope.rech_pb++;
                if ($scope.rech_pb == 100) {
                    // on est arrivé à la fin du temps d'attente.
                    // malheureusement pour notre utilisateur il n'y a pas de taxi disponible
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

    connection.onopen = function(session) {

        console.log("session established!");

        // cette fonction est lancée à la réception d'un message sur le topic
        function on_cab_response(args, kwargs) {
            console.log("got event:", args, kwargs);
            var scope = angular.element(document.getElementById('Receiver')).scope();
            scope.$apply(function() {
                // On traite la réponse.
                scope.process_cab_response(args[0]);
            });
        }

        // souscription au topic chauffeur pour voir les réponses aux demandes de l'utilisteur.
        session.subscribe(CAB_TOPIC, on_cab_response).then(

            function(subscription) {
                console.log("ok, subscribed with ID " + subscription.id);
                User.id = UUID.guid();
            },
            function(error) {
                console.log(error);
            });
    };

    // traitement de la réponse
    $scope.process_cab_response = function(incomingMsg) {
        // On recit un message sur le topic
        // On commence par le dé-sérialiser.
        response = JSON.parse(incomingMsg);

        // Le message m'est adressé ?
        if (response.client_id == User.id) {
            // On a reçun une réponse à notre demande de course.
            // On fait dans cette démo un traitement simpliste.
            // Dans un cas réel cette partie devrait être bcp plus ettofée 

            // On stoppe la barre de progression
            $interval.cancel($scope.interval);

            // On affiche un message de succès.
            $scope.$parent.app.navi.pushPage('success.html');
        }
    };
    // Lorque l'on perd la connection
    connection.onclose = function(reason, details) {
        console.log("connection lost", reason);
    }

    // ouverture de la conenction a crossbar
    connection.open();
});
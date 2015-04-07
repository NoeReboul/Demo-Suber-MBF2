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
 
// URL de base des APIs PSA Peugeot Citroën.
var API_URL = 'https://api.mpsa.com/bgd/connectedcar';

// Indiquer ici la clé de votre application
var API_KEY = 'ma_clée_api';

// Le topic client ou on recoit les demandes de courses
var CLIENT_TOPIC = 'com.suber.client';

// Le topic chauffeur ou on affiche les acceptations de courses
var CAB_TOPIC = 'com.suber.driver';

/**
 * Connection à crossbar
 * Pour la démo le serveur crossbar est installée sur la machine qui sert à réaliser la démo
 */
var connection = new autobahn.Connection({
    url: 'ws://127.0.0.1:8080/ws',
    realm: 'realm1'
});

var app = angular.module('SuberDriver', ['onsen', 'ngResource', 'emguo.poller', 'uiGmapgoogle-maps']);

// L'objet Car est créé avec une factory.
app.factory('Car', function() {

    // Le constrcteur de l'objet
    var Car = this;
    this.vin = '';
    this.contrat = '';

    // pour l'instant on ne sait pas ou se trouve le véhicule
    this.position = null;

    return this;
});

// La liste des demandes client en cours.
app.factory('ClientList', function() {
    var ClientList = this;
    this.items = [];
    return this;
});

/**
 * Factory pour gérer le stockage sur l'appareil mobile.
 * Permet d'enregistrer des objets ou des valeurs de clés.
 * On l'utilisera pour stocker les préférences de l'utilisateur.
 * 
 * Pour plus d'info vous pouvez voir le premier webinar PSA Peugeot Citroën pour MBF2
 */
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

/**
 * Controleur qui gère ce qu'il se passe une fois que la course est acceptée.
 * Ici il est traité de façon ultra simple.
 * Dans u ncas réel il faudrait le compléter en ajoutant par exemple la distance qui sépare le client du taxi en temsp réel
 * ou le cout de la course en temps réel ...
 */
app.controller('RunningCtrl', function($scope, $resource, Car, poller) {

    var api_resource = $resource(API_URL + '/1.0/maintenance/' + Car.vin + '?contract=' + Car.contrat + '&locale=fr_FR&brand=C&client_id=' + API_KEY);

    // avec un poller on va intéerroger régulièrement l'API 
    // attention à la surconsommation ...
    var api_poller = poller.get(api_resource, {
        // Ici on fait une interrogation toutes les minutes.
        delay: 60000,
        catchError: true
    });

    api_poller.promise.then(null, null, function(response) {
        if (response.$resolved) {
            // Voici le genre d'info que l'on pourrait calculer 
            // (et encore on pourrait mieux faire si le client renvoyait sa position régulièrement ...)
            $scope.distance_course = response.maintenance.totMileage - Car.init_mileage;
        } else {
            // une gestion simpliste des erreurs :)
            ons.notification.alert({
                message: "Une erreur s'est produite. Merci de réessayer plus tard.",
                title: 'Erreur',
                buttonLabel: 'OK',
                animation: 'default',
                callback: function() {
                    // Alert button is closed!
                }
            })
        }
    });
});

/**
 * Controlleur utilisé pour afficher les détails d'une course.
 *
 */
app.controller('DetailCtrl', function($scope, $resource, Car, ClientList) {
    $scope.item = ClientList.selectedItem;

    $scope.map = {
        center: {
            latitude: Car.position.latitude,
            longitude: Car.position.longitude
        },
        zoom: 8
    };

	// le marqueur du chauffeur
    $scope.car_marker = {
        id: 0,
        coords: {
            latitude: Car.position.latitude,
            longitude: Car.position.longitude
        },
        icon: 'img/ds3icon.png',
        options: {
            draggable: false
        }
    };

	// le marqueur du client
    $scope.client_marker = {
        id: 1,
        coords: {
            latitude: ClientList.selectedItem.lat,
            longitude: ClientList.selectedItem.long
        },
        options: {
            draggable: false
        }
    };

    // Le taxi accepte cette course
    $scope.accept_client = function() {
        // On va envoyer un message à destination du client pour l'informer
        // le mieux aurait été d'utiliser les fonction de RPC de crossbar ...
        if (connection.session) {
            // on récupére le km initial pour calculer la distance de la course
            $resource(API_URL + '/1.0/maintenance/' + Car.vin + '?contract=' + Car.contrat + '&locale=fr_FR&brand=C&client_id=' + API_KEY).get().$promise.then(function(response) {
                Car.init_mileage = response.maintenance.totMileage;
            });

            // On construit le message de réponse.
            mesg = {
                name: $scope.pref.name,
                client_id: ClientList.selectedItem.id,
            };

            // On le sérialize et on l'envoi
            connection.session.publish(CAB_TOPIC, [JSON.stringify(mesg)]);

            // On masque le message et on fait apparaitre l'écran de gestion d'une course
            $scope.$parent.app.navi.pushPage('running_to.html');
            console.log("event published!");
        } else {
            console.log("cannot publish: no session");
        }
    };
});


/**
 * Controlleur principal
 *
 */
app.controller("MainCtrl", function($scope, $resource, ClientList, poller, Car) {

    Car.vin = $scope.pref.vin;
    Car.contrat = $scope.pref.contrat;

    var api_resource = $resource(API_URL + '/1.0/place/lastposition/' + Car.vin + '?contract=' + Car.contrat + '&listsecond=6,12,18,24,30,36,42,48,54,60&client_id=' + API_KEY);

    var api_poller = poller.get(api_resource, {
        delay: 60000,
        catchError: true
    });

    api_poller.promise.then(null, null, function(response) {
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

    $scope.items = ClientList.items;

    $scope.showDetail = function(index) {
        var selectedItem = ClientList.items[index];
        ClientList.selectedItem = selectedItem;

        $scope.$parent.app.navi.pushPage('detail.html');
    };


    var add_client = function(name, client_id, lat, long, date) {
        ClientList.items.push({
            name: name,
            id: client_id,
            lat: lat,
            long: long,
            date: date
        });
    };

    // on traite la requete d'un client
    $scope.add_client_request = function(client_request) {
        req = JSON.parse(client_request);

        // on vériie que le client est dans le périmètre que le chauffeur veut traiter.
        if (get_distance(Car.position.latitude, Car.position.longitude, req.position.latitude, req.position.longitude) <= $scope.pref.perim * 3) {
            add_client(req.name, req.client_id, req.position.latitude, req.position.longitude, Date.now());
        }
    };

    var deg2rad = function(degrees) {
        return degrees * Math.PI / 180;
    };

    // Calcule la distance en km entre 2 coordonnées GPS
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


connection.onopen = function(session) {

    console.log("session established!");

    function on_client_request(args, kwargs) {
        console.log("got event:", args, kwargs);

        var scope = angular.element(document.getElementById('Receiver')).scope();
        scope.$apply(function() {
            scope.add_client_request(args[0]);
        });
    }

    session.subscribe(CLIENT_TOPIC, on_client_request).then(

        function(subscription) {
            console.log("ok, subscribed with ID " + subscription.id);
        },
        function(error) {
            console.log(error);
        });
};


connection.onclose = function(reason, details) {
    console.log("connection lost", reason);
}
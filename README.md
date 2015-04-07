# Démo #2 PSA Peugeot Citroën pour le MBF²

Le but de ce mini projet est d'illustrer une utilisation plus complexe des APIs Connected Car de PSA Peugeot Citroën dans le cadre du hackathon Mobile Banking Factory 2

Ce code est sous licence Apache 2.0.

Bon code et bon Hackathon !

## Fichier de configuration crossbar.io
Bour les besoin de la démo vous aurez besoi nde configurer un serveur crossbar. Voici un exemple très simple (et donc pas du tout sécurisé) de config : 

```
{
    "controller": {},
    "workers": [{
        "type": "router",
        "realms": [{
            "name": "realm1",
            "roles": [{
                "name": "anonymous",
                "permissions": [{
                    "uri": "*",
                    "publish": true,
                    "subscribe": true,
                    "call": true,
                    "register": true
                }]
            }]
        }],
        "transports": [{
            "type": "web",
            "endpoint": {
                "type": "tcp",
                "port": 8080
            },
            "paths": {
                "/": {
                    "type": "static",
                    "directory": "../web"
                },
                "ws": {
                    "type": "websocket"
                }
            }
        }]
    }]
}
```

## Pour lancer l'appli
Vous aurez besoin d'installer Cordova et Chrome puis tapez : 

```sh
$ cordova run browser
```

## Outils utilisés pour cette démo :

 * [crossbar.io](http://crossbar.io/) le bus de communication
 * [Cordova](https://cordova.apache.org/) pour la plateforme de dev mobile
 * [Onsen.io](http://onsen.io/) pour le framework graphique (basé sur [Angular](https://angularjs.org/))
 * [Angular Google Maps](http://angular-ui.github.io/angular-google-maps/#!/) pour l'utilisation de l'API Google Maps.

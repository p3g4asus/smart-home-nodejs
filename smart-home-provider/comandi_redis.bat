hmset client:0 username fulminedipegasus stringid ZxjqWpsYj3 secret hIMH3uWlMVrqa7FAbKLBoNUMCyLCtv apikey AIzaSyBNZ0MwFCCjPOiB-Zt0NBancTpE5slwQqs
hmset client:1 username p3g4asus stringid RKkWfsi0Z9 secret eToBzeBT7OwrPQO8mZHsZtLp1qhQbe apikey AIzaSyCLfX3-gk7iKpXibMPka4ruCQbmqyLALUk
set client:maxid 2
sadd client:validclients 0
sadd client:validclients 1
set client:stringid:ZxjqWpsYj3 0
set client:username:fulminedipegasus 0
set client:stringid:RKkWfsi0Z9 1
set client:username:p3g4asus 1
sadd translations it
sadd translations en
hmset translation:it "right" "destra" "subtitle" "sottotitolo" "power" "accendi" "mute" "muto" "ffw" "avanti veloce" "rec" "registra" "v+" "alza volume" "ttx" "televideo" "back" "indietro" "yellow" "tasto giallo" "v-" "abbassa volume" "down" "basso" "exit" "esci" "sky" "murdock" "p+" "canale successivo" "return" "ritorno" "tools" "strumenti" "blue" "tasto blu" "pause" "pausa" "manual" "manuale" "up" "su" "chlist" "lista canali" "green" "tasto verde" "revw" "indietro veloce" "esc" "esci" "p-" "canale precedente" "guide" "guida" "red" "tasto rosso" "s201" "spina" "magiccube" "cubo" "blackbeam1" "fagiolo" "av" "sorgente" "orvibo1" "cupola" "2sky" "satellite" "2tv" "televisione" "remote" "telecomando" "chan" "orso"
hmset translation:en  "ffw" "fast forward" "rec" "record" "v+" "raise volume" "v-" "lower volume" "p+" "next channel" "chlist" "channel list" "revw" "rewind" "esc" "exit" "ttx" "text" "p-" "previous channel" "s201" "soso" "sky" "murdock" "magiccube" "cube" "blackbeam1" "beam" "av" "source" "orvibo1" "coco" "2sky" "satellite" "2tv" "tv" "guidatv" "tv guide" "interattivi" "interactive" "remote" "remote" "chan" "bear"

// control_routes.scd — omt07l
// Escucha OSC de control entrante (desde el hydra-bridge o desde Claude):
//   /omt/control/scene <name>        → ejecuta ~scenes[name].()
//   /omt/control/param <key> <value> [<rampMs>]
//                                     → asigna ~params[key] con lag opcional
//
// Los diccionarios ~scenes y ~params los define el compositor en sesiones
// posteriores. Este archivo sólo registra los listeners y expone valores
// globales vía Ndef('ctl_<key>') para que los SynthDefs los lean sin
// acoplarse al protocolo OSC.

(
~params = ~params ? ();
~scenes = ~scenes ? ();

// Ndef genérico para exponer un control como bus (consumible con .kr)
~omtCtlBus = { |key|
    var name = ("ctl_" ++ key.asString).asSymbol;
    if (Ndef(name).source.isNil) {
        Ndef(name, { |val = 0, lag = 0.25| Lag.kr(val, lag) });
    };
    Ndef(name);
};

[\omtSceneRoute, \omtParamRoute].do { |k| OSCdef(k).free };

OSCdef(\omtSceneRoute, { |msg|
    // msg = [ '/omt/control/scene', sceneName ]
    var name = msg[1].asSymbol;
    var fn = ~scenes[name];
    if (fn.notNil) {
        "omt07l · scene → %".format(name).postln;
        fn.value;
    } {
        "omt07l · scene desconocida: % (conocidas: %)".format(name, ~scenes.keys).warn;
    };
}, '/omt/control/scene');

OSCdef(\omtParamRoute, { |msg|
    // msg = [ '/omt/control/param', key, value, rampMs? ]
    var key    = msg[1].asSymbol;
    var value  = msg[2].asFloat;
    var rampMs = (msg[3] ? 0).asFloat;
    var bus    = ~omtCtlBus.value(key);
    ~params[key] = value;
    bus.set(\val, value, \lag, rampMs / 1000);
}, '/omt/control/param');

"omt07l · control_routes.scd activo → /omt/control/{scene,param}".postln;
)

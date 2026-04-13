// osc_routes.scd — omt07l
// Recibe los /omt/_reply/* de analyzer.scd y los re-emite con las
// direcciones canónicas (/omt/audio/*) hacia los destinos del bus.
//
// Destinos (ver config/osc_map.yaml):
//   hydra_bridge: 127.0.0.1:57200
//   touchdesigner: 127.0.0.1:7000

(
~omtDestinations = [
    NetAddr("127.0.0.1", 57200),  // hydra_bridge
    NetAddr("127.0.0.1", 7000),   // touchdesigner
];

~omtSend = { |addr, args|
    ~omtDestinations.do { |dest| dest.sendMsg(addr, *args) };
};

// Limpieza previa
[\omtPitchRoute, \omtRmsRoute, \omtBandsRoute, \omtOnsetRoute].do { |k|
    OSCdef(k).free;
};

OSCdef(\omtPitchRoute, { |msg|
    // msg = [ '/omt/_reply/pitch', nodeId, replyId, freq, clarity ]
    ~omtSend.('/omt/audio/pitch', msg[3..]);
}, '/omt/_reply/pitch');

OSCdef(\omtRmsRoute, { |msg|
    ~omtSend.('/omt/audio/rms/bass', [msg[3]]);
    ~omtSend.('/omt/audio/rms/mid',  [msg[4]]);
    ~omtSend.('/omt/audio/rms/high', [msg[5]]);
}, '/omt/_reply/rms');

OSCdef(\omtBandsRoute, { |msg|
    // msg[3..10] = 8 bandas
    ~omtSend.('/omt/audio/fft/bands', msg[3..10]);
}, '/omt/_reply/bands');

OSCdef(\omtOnsetRoute, { |msg|
    ~omtSend.('/omt/audio/onset', [msg[3]]);
}, '/omt/_reply/onset');

"omt07l · osc_routes.scd activo → hydra_bridge:57200, td:7000".postln;
)

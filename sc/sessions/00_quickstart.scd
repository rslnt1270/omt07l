// 00_quickstart.scd — omt07l
// Arranque rápido: boot del server, carga del analyzer y las rutas OSC,
// instancia del Synth.

(
s.waitForBoot {
    "../synthdefs/analyzer.scd".loadRelative;
    s.sync;
    "../bus/osc_routes.scd".loadRelative;
    s.sync;
    "../bus/control_routes.scd".loadRelative;
    s.sync;

    if (~omtAnalyzer.notNil) { ~omtAnalyzer.free };
    ~omtAnalyzer = Synth(\omtAnalyzer, [\in, 0, \amp, 1.0]);

    "omt07l · listo. Toca algo en la entrada 0.".postln;
};
)

// Para detener:
// ~omtAnalyzer.free;

// analyzer.scd — omt07l
// Captura SoundIn.ar(0), extrae features y las envía por SendReply.kr.
// osc_routes.scd escucha esos reply-ids y los re-emite con las direcciones
// canónicas del protocolo (/omt/audio/*) a Hydra y TouchDesigner.
//
// Dependencias opcionales: `Tartini` del paquete sc3-plugins. Si no está
// disponible, se usa Pitch.kr como fallback.
//
// Uso:
//   s.waitForBoot {
//     "sc/synthdefs/analyzer.scd".loadRelative;
//     "sc/bus/osc_routes.scd".loadRelative;
//     ~omtAnalyzer = Synth(\omtAnalyzer);
//   };

(
SynthDef(\omtAnalyzer, { |in = 0, amp = 1.0|
    var sig, bass, mid, high, bassAmp, midAmp, highAmp;
    var freq, hasPitch, clarity;
    var chain, onsets, bands;
    var replyRate = 30;   // 30 Hz para todos los envíos periódicos
    var trig = Impulse.kr(replyRate);

    sig = SoundIn.ar(in) * amp;

    // ── Bandas por filtrado + Amplitude ─────────────────────────
    bass = LPF.ar(sig, 200);
    mid  = BPF.ar(sig, 1000, 1.0);
    high = HPF.ar(sig, 4000);

    bassAmp = Amplitude.kr(bass, 0.01, 0.2);
    midAmp  = Amplitude.kr(mid,  0.01, 0.2);
    highAmp = Amplitude.kr(high, 0.01, 0.2);

    // ── Pitch ───────────────────────────────────────────────────
    // Tartini es más preciso para instrumento monofónico; si no está
    // instalado, Pitch.kr sirve igual.
    # freq, hasPitch = Pitch.kr(sig, ampThreshold: 0.02, median: 7);
    clarity = hasPitch;  // Pitch.kr devuelve 0/1 — si hay Tartini, sustituir.

    // ── Onsets ──────────────────────────────────────────────────
    chain = FFT(LocalBuf(1024), sig);
    onsets = Onsets.kr(chain, 0.3, \rcomplex);

    // ── 8 bandas logarítmicas del FFT ───────────────────────────
    // Usamos BPF.ar sobre `sig` como aproximación portable.
    bands = [60, 120, 240, 480, 960, 1920, 3840, 7680].collect { |f|
        Amplitude.kr(BPF.ar(sig, f, 0.5), 0.01, 0.2)
    };

    // ── SendReply.kr (30 Hz) ────────────────────────────────────
    SendReply.kr(trig, '/omt/_reply/pitch',  [freq, clarity]);
    SendReply.kr(trig, '/omt/_reply/rms',    [bassAmp, midAmp, highAmp]);
    SendReply.kr(trig, '/omt/_reply/bands',  bands);

    // Onset: dispara solo al detectar ataque
    SendReply.kr(onsets, '/omt/_reply/onset', [onsets]);
}).add;
)

"omt07l · analyzer.scd cargado — Synth(\\omtAnalyzer) para arrancar".postln;

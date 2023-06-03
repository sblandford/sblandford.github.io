let gAudioCtx = null;
let gGain = null;
let gOscillator = null;
let gFreq = 741;
let gFade = 0.003;

window.onload = function() {
}

function keyOn() {
    if (!gAudioCtx) {
        gAudioCtx = new AudioContext();
        // create Oscillator node
        gOscillator = gAudioCtx.createOscillator();
        const gainNode = gAudioCtx.createGain();
        
        gOscillator.type = "sine";
        gOscillator.frequency.value = gFreq;
    
        gainNode.gain.value = 0;
                
        gOscillator.connect(gainNode);
        gainNode.connect(gAudioCtx.destination);
        gGain = gainNode.gain;
        
        gOscillator.start();
    }
    gGain.setTargetAtTime(1, gAudioCtx.currentTime, gFade);
}

function keyOff() {
    gGain.setTargetAtTime(0, gAudioCtx.currentTime, gFade);
}



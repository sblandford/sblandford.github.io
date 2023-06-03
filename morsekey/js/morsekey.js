let gFreq = 741;
let gFade = 0.003;
let gVolume = 50;

let gAudioCtx = null;
let gGain = null;
let gOscillator = null;
let gButton = null;

window.onload = function() {
    gButton = document.getElementById("key");

    document.addEventListener("keydown", function(e) {
        if (e.key === " ") {
            keyOn();
        }
      });
      document.addEventListener("keyup", function(e) {
        keyOff();
      });
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
    gGain.setTargetAtTime(gVolume / 100, gAudioCtx.currentTime, gFade);
    gButton.classList.add("keyDown");

}

function keyOff() {
    gGain.setTargetAtTime(0, gAudioCtx.currentTime, gFade);
    gButton.classList.remove("keyDown");
}



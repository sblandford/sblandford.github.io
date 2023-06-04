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

function startOsc () {
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

function tone(sound) {
    gGain.setTargetAtTime((sound?gVolume:0) / 100, gAudioCtx.currentTime, gFade);
}

function getGoing(sound) {
    if (gAudioCtx) {
        if (gAudioCtx.state === "suspended") {
            gAudioCtx.resume().then(() => {
                tone(sound);
            });
        } else {
            tone(sound);
        }
    } else {
        startOsc();
        tone(sound);
    }
}

function keyOn(isMouse) {
    if (isMouse) {
        getGoing(true);
    }
    gButton.classList.add("keyDown");
}

function keyOff() {
    getGoing(false);
    gButton.classList.remove("keyDown");
}

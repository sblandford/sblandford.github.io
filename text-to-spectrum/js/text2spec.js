
const gStartFreqHz = 300;
const gStopFreqHz = 2300;
const gstopDispFreqHz = 2700;
const gResolution = 100;
const gTextPixSize = gResolution;
const gScrollMs = 50;
const gMaxGain = 0.02;
const gSpecScaleLevel = 1.4;
const gGammaCorrection = 4;
const gStartDelayMaxMs = 250;

const gBoxWidthScale = 0.94;
let gBoxWidth = window.innerWidth * gBoxWidthScale;
let gTxRunning = false;
let gRxRunning = false;
let gSignLevels = [];
const gFreqStep =  Math.floor((gStopFreqHz - gStartFreqHz) / gResolution);
let gFftStop = 100;
let gPasted = false;

let gInputTextCanvasElem = null;
let gTextCanvasCtx = null;
let gTextElem = null;
let gTextMaxChars = 0;

let gTxAudioCtx = null;
let gRxAudioCtx = null;
let gResizeBusy = false;
let gResizeHoldoffMs = 200;

function sines(audioDestination) {
    
    // Allocate the oscillators
    let phaseDelay = 0;
    gSignLevels = [];
    for (let freq = gStartFreqHz; freq < gStopFreqHz; freq += gFreqStep) {
        // create Oscillator node
        const oscillator = gTxAudioCtx.createOscillator();
        const gainNode = gTxAudioCtx.createGain();
      
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;

        gainNode.gain.value = 0;
                
        oscillator.connect(gainNode);
        gainNode.connect(audioDestination);

        // Start with random delays to mangle phase and avoid nasty clipping waveform
        setTimeout(function() {
                oscillator.start();
        }, Math.floor(Math.random() * gStartDelayMaxMs) + 1);

        gSignLevels.push(gainNode.gain);
    }
}

function txSpectrum() {

    const requiredFFtResolution = gTxAudioCtx.sampleRate / gFreqStep;
    const fftResolution = 1 << 31 - Math.clz32(requiredFFtResolution);
    gFftStop = gstopDispFreqHz / (gTxAudioCtx.sampleRate / fftResolution);
    
    const analyser = gTxAudioCtx.createAnalyser();
    analyser.fftSize = fftResolution;
    analyser.connect(gTxAudioCtx.destination);
    const bufferLength = analyser.frequencyBinCount;
    
    sines(analyser);
    const dataArray = new Uint8Array(bufferLength);
    
    const canvasElem = document.getElementById("specplotout");
    canvasElem.height = gFftStop;
    const specCanvasCtx = canvasElem.getContext("2d", {willReadFrequently: true});
    const specImageObj = specCanvasCtx.createImageData(1, gFftStop);
    const specImageData = specImageObj.data;
    
    let drawVisual = null;
    let nudge = true;
    function drawSpectrum() {
        if (!gTxRunning) {return;};
            
        analyser.getByteFrequencyData(dataArray);
        
        if (nudge) {
            // Scroll spectrum across screen
            const scrollImageObj = specCanvasCtx.getImageData(1, 0, canvasElem.width, canvasElem.height);
            specCanvasCtx.putImageData(scrollImageObj, 0, 0);
            
            // Plot new spectrum line
            for (let y = 0; y < gFftStop; y++) {
                const j = y * 4;
                const level = dataArray[y] * gSpecScaleLevel;
                specImageData[j + 0] = level;
                specImageData[j + 1] = level;
                specImageData[j + 2] = level;
                specImageData[j + 3] = 255;
            }
            specCanvasCtx.putImageData(specImageObj, canvasElem.width - 1, 0);
            nudge = false;
            if (gTxRunning) {
                setTimeout(function() {
                    nudge = true;
                }, gScrollMs);
            }
        }
        
        if (gTxRunning) {drawVisual = requestAnimationFrame(drawSpectrum);}
    }
    drawVisual = requestAnimationFrame(drawSpectrum);    

}

function rxSpectrum (stream) {
    
    const mic = gRxAudioCtx.createMediaStreamSource(stream);
    
    const requiredFFtResolution = gRxAudioCtx.sampleRate / gFreqStep;
    const fftResolution = 1 << 31 - Math.clz32(requiredFFtResolution);
    gFftStop = gstopDispFreqHz / (gRxAudioCtx.sampleRate / fftResolution);
    
    const analyser = gRxAudioCtx.createAnalyser();
    mic.connect(analyser);
    analyser.fftSize = fftResolution;
    const bufferLength = analyser.frequencyBinCount;
    
    const dataArray = new Uint8Array(bufferLength);
    
    const canvasElem = document.getElementById("specplotin");
    canvasElem.height = gFftStop;
    const specCanvasCtx = canvasElem.getContext("2d", {willReadFrequently: true});
    const specImageObj = specCanvasCtx.createImageData(1, gFftStop);
    const specImageData = specImageObj.data;
    
    let drawVisual = null;
    let nudge = true;
    function drawSpectrum() {
        if (!gRxRunning) {return;};
        
        analyser.getByteFrequencyData(dataArray);
        
        if (nudge) {
            // Scroll spectrum across screen
            const scrollImageObj = specCanvasCtx.getImageData(1, 0, canvasElem.width, canvasElem.height);
            specCanvasCtx.putImageData(scrollImageObj, 0, 0);
            
            // Plot new spectrum line
            for (let y = 0; y < gFftStop; y++) {
                const j = y * 4;
                const level = dataArray[y] * gSpecScaleLevel;
                specImageData[j + 0] = level;
                specImageData[j + 1] = level;
                specImageData[j + 2] = level;
                specImageData[j + 3] = 255;
            }
            specCanvasCtx.putImageData(specImageObj, canvasElem.width - 1, 0);
            nudge = false;
            if (gRxRunning) {
                setTimeout(function() {
                    nudge = true;
                }, gScrollMs);
            }
        }
        if (gRxRunning) {drawVisual = requestAnimationFrame(drawSpectrum);}
    }
    drawVisual = requestAnimationFrame(drawSpectrum);     
}

function grabMic () {
    navigator.getUserMedia({video:false,audio:true},rxSpectrum,console.log);
}

function encode() {
    const endMarginPix = 10;
    
    console.assert(gResolution == gSignLevels.length, "Resolution must match sign table length");
    console.assert(gResolution == gInputTextCanvasElem.height, "Resolution must match text canvas height");
    let x = 0;
    let prevscan = false;
    
    // Find end of text
    let textEnd = 0;
    let pixActive = false;
    for (textEnd = gInputTextCanvasElem.width; ! pixActive && textEnd >= 0; --textEnd) {
        let scanLine = gTextCanvasCtx.getImageData(textEnd, 0, 1, gResolution);
        for (let y = 0; ! pixActive && y < gResolution; y++) {
            const j = y *4;
            pixActive = ((scanLine.data[j] + scanLine.data[j + 1] + scanLine.data[j + 2] + scanLine.data[j + 3]) > 0);
        }
    }

    // Add a bit of space at end of scan
    textEnd += endMarginPix;
    if (textEnd > gInputTextCanvasElem.width) {textEnd = gInputTextCanvasElem.width;}

    // Scroll and scan text
    let drawVisual = null;
    let nudge = true;
    function scanText () {
        // Scroll spectrum across screen
        if (nudge) {
            const scrollImageObj = gTextCanvasCtx.getImageData(1, 0, gInputTextCanvasElem.width, gResolution);
            gTextCanvasCtx.putImageData(scrollImageObj, 0, 0);       
            // Get line to scan
            let scanLine = gTextCanvasCtx.getImageData(0, 0, 1, gResolution);
            for (let y = 0; y < gResolution; y++) {
                const j = y *4;
                // Create to grey using classic 0.3R, 0.59G, 0.11B luminority weighting
                const greyLevel = ((scanLine.data[j] * 0.3) + (scanLine.data[j + 1] * 0.59 ) + (scanLine.data[j + 2]) * 0.11) / 255;
                const gainVal = Math.pow(greyLevel, gGammaCorrection);
                // const logGain = 1- Math.pow(10, (0 - (gainVal * 0.2)));
                gSignLevels[y].linearRampToValueAtTime(gainVal * gMaxGain, gTxAudioCtx.currentTime + (gScrollMs / 1000));
            }
            nudge = false;
            if (gTxRunning) {
                setTimeout(function() {
                    nudge = true;
                }, gScrollMs);
            }
            if (--textEnd <= 0) {
                gTxRunning = false;
            }
        }
        if (gTxRunning) {
            drawVisual = requestAnimationFrame(scanText);
        } else {
            endEncode();
        }
    }
    // Wait for sines to start before rendering
    setTimeout(function() {
        drawVisual = requestAnimationFrame(scanText);
    }, gStartDelayMaxMs);
}

function textRender(event) {
    if (gPasted) {return;}
    
    let text = gTextElem.value;
    gTextCanvasCtx.clearRect(0, 0, gInputTextCanvasElem.width, gInputTextCanvasElem.height);
    gTextCanvasCtx.fillStyle = "white";
    const pixSize = gTextPixSize;
    gTextCanvasCtx.font = "bolder " + pixSize.toString() + "px Arial";
    gTextCanvasCtx.textBaseline = "top";
    gTextCanvasCtx.fillText(text, 0, 0);
}

function endEncode () {
    gTxAudioCtx.close();
    gTxAudioCtx = null;
    textRender(null);
    gPasted = false;
}

function endDecode () {
    gRxAudioCtx.close();
    gRxAudioCtx = null;   
}

function pasteImage(e) {
    if (e.clipboardData == false) {return false;}
    let imgs = e.clipboardData.items;
    if (imgs == undefined) {return false;}
    for (let i = 0; i < imgs.length; i++) {
        if (imgs[i].type.indexOf("image") == -1) {continue;}
        gPasted = true;
        gTextElem.value = "";
        let imgObj = imgs[i].getAsFile();
        let url = window.URL || window.webkitURL;
        let src = url.createObjectURL(imgObj);
        gTextCanvasCtx.clearRect(0, 0, gInputTextCanvasElem.width, gInputTextCanvasElem.height);
        let img = new Image();
        img.src = src;
        img.onload = function(e) {
            // Scale image to fit within canvas perserving aspect ratio
            const hRatio = gInputTextCanvasElem.width / img.width    ;
            const vRatio = gInputTextCanvasElem.height / img.height  ;
            const ratio  = Math.min ( hRatio, vRatio );
            gTextCanvasCtx.drawImage(img, 0, 0, img.width * ratio, img.height * ratio);
        }
    }
}

function sizeElements () {
    gBoxWidth = window.innerWidth * gBoxWidthScale;
    
    document.getElementById("specplotin").width = gBoxWidth;
    document.getElementById("specplotin").style.backgroundColor = "black";
    document.getElementById("specplotout").width = gBoxWidth;
    document.getElementById("specplotout").style.backgroundColor = "black";
    
    gInputTextCanvasElem = document.getElementById("inputcanvas");
    gInputTextCanvasElem.height = gResolution;
    gInputTextCanvasElem.width = gBoxWidth;
    gInputTextCanvasElem.style.backgroundColor = "black";
    
    gTextElem = document.getElementById("inputtext");
    gTextMaxChars = Math.floor((gBoxWidth / gTextPixSize) * 1.5);
    gTextElem.setAttribute('size', gTextMaxChars.toString());
  
}

function reSizeElements () {
    if (gResizeBusy) {return;}
    gResizeBusy = true;
    
    // Prevent too much activity by limiting to once every gResizeHoldoffMs
    setTimeout(function() {
        sizeElements ();
        gResizeBusy = false;
    }, gResizeHoldoffMs);
}

function buttonVisibilityService () {
    // Check correct buttons are visible every 100ms and set
    setInterval(function () {
        if (gTxRunning) {
            document.getElementById("txButton").style.visibility = "hidden";
            document.getElementById("txAbortButton").style.visibility = "visible";            
        } else {
            document.getElementById("txButton").style.visibility = "visible";
            document.getElementById("txAbortButton").style.visibility = "hidden";
        }
        if (gRxRunning) {
            document.getElementById("rxButton").style.visibility = "hidden";
            document.getElementById("rxStopButton").style.visibility = "visible";            
        } else {
            document.getElementById("rxButton").style.visibility = "visible";
            document.getElementById("rxStopButton").style.visibility = "hidden";            
        }
    }, 100);
}

window.onload = function () {
    
    sizeElements();
    buttonVisibilityService ();

    window.addEventListener("keyup", textRender, true);
    window.addEventListener('paste', pasteImage);
    window.addEventListener("orientationchange", reSizeElements);
    window.addEventListener("resize", reSizeElements);
    
    gTextCanvasCtx = gInputTextCanvasElem.getContext("2d", {willReadFrequently: true});
    
    document.getElementById("txAbortButton").style.visibility = "hidden";
    document.getElementById("rxStopButton").style.visibility = "hidden";
}

function send() {
    if (gTxRunning) {return;}
    gTxRunning = true;
    
    gTxAudioCtx = new AudioContext();
    txSpectrum();
    encode();
}
function sendAbort() {
    if (!gTxRunning) {return;}
    gTxRunning = false;
}


function receive() {
    if (gRxRunning) {return;}
    gRxRunning = true;
    gRxAudioCtx = new AudioContext();
    grabMic();
}
function receiveStop() {
    if (!gRxRunning) {return;}
    gRxRunning = false;
    endDecode();
}

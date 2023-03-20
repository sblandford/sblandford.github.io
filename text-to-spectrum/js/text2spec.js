
let gParams = {
    startFreqHz : {min : 200, max : 1000, step : 100, default : 300, value : null},
    stopFreqHz : {min : 1100, max : 4500, step : 100, default : 2300, value : null},
    resolution : {min : 10, max : 1000, step : 10, default : 100, value : null},
    scrollMs : {min : 10, max : 500, step : 10, default : 50, value : null},
    gamma : {min : 0.2, max : 8, step : 1, default : 4, value : null},
    freqInvert : {min : false, max : true, step : 1, default : false, value : null},
    scanReverse : {min : false, max : true, step : 1, default : false, value : null}
};


let gstopDispFreqHz = null;
let gstartDispFreqHz = null;
let gMaxGain = null;
const gSpecScaleLevel = 1.4;
const gStartDelayMaxMs = 250;
const gResizeHoldoffMs = 200;
const fftOversizePercent = 10;


const gBoxWidthScale = 0.94;
let gRunning = {tx: false, rx: false}
let gSignLevels = [];
let gFreqStep =  null;
let gPasted = false;

let gInputTextCanvasElem = null;
let gTextCanvasCtx = null;
let gTextElem = null;
let gTextMaxChars = 0;
let gTextPixSize = null;
let gTxAudioCtx = null;
let gRxAudioCtx = null;
let gResizeBusy = false;
let gParamUpdate = false;

function paramsReCalc () {
    // Add % of frequncy to display
    const freqRange = gParams.stopFreqHz.value - gParams.startFreqHz.value;
    gstopDispFreqHz = gParams.stopFreqHz.value + Math.floor((freqRange * fftOversizePercent) / 100);
    gstartDispFreqHz = gParams.startFreqHz.value - Math.floor((freqRange * fftOversizePercent) / 100);
    if (gstartDispFreqHz < 0) {gstartDispFreqHz = 0;}
    gMaxGain = 0.02;
    gFreqStep =  Math.floor((gParams.stopFreqHz.value - gParams.startFreqHz.value) / gParams.resolution.value);
    gTextPixSize = gParams.resolution.value;
}

function showParamsValues () {
    document.getElementById("startFreqHzValue").textContent = gParams.startFreqHz.value;
    document.getElementById("stopFreqHzValue").textContent = gParams.stopFreqHz.value;
    document.getElementById("resolutionValue").textContent = gParams.resolution.value;
    document.getElementById("scrollMsValue").textContent = gParams.scrollMs.value;
    document.getElementById("gammaValue").textContent = gParams.gamma.value;
    document.getElementById("freqInvertValue").textContent = (gParams.freqInvert.value)?"On":"Off";
    document.getElementById("scanReverseValue").textContent = (gParams.scanReverse.value)?1:0;

}


function resetParams () {
    // Iterate through the parameters and set values to default values
    for (const key in gParams) {
        if (gParams.hasOwnProperty(key)) {
            gParams[key].value = gParams[key].default;
        }
    }
    setParams();
}

function setParams () {
    let paramVals = {};
    for (const key in gParams) {
        if (gParams.hasOwnProperty(key)) {
            paramVals[key] = {};
            paramVals[key].value = gParams[key].value;
        }
    }
    localStorage.setItem("text2specParms", JSON.stringify(paramVals));
}

function getParams () {
    let paramsString = localStorage.getItem("text2specParms");
    let paramVals = {};
    if (paramsString) {
        try {
            paramVals = JSON.parse(paramsString);
        } catch(err) {
            console.log(err);
            resetParams();
        }
    } else {
        resetParams();
    }

    // Fetch and validate keys
    for (const key in gParams) {
        if (gParams.hasOwnProperty(key)) {
            let value = gParams[key].default;
            if (!paramVals.hasOwnProperty(key) && (typeOf(paramVals[key].value) == typeOf(value))) {value = paramVals[key].value;}
            if (value > gParams[key].max) {value = gParams[key].max;}
            if (value < gParams[key].min) {value = gParams[key].min;}
            gParams[key].value = Math.ceil(value / gParams[key].step) * gParams[key].step;
        }
    }

    // Apply to control panel
    const startFreqHzElem = document.getElementById("startFreqHzSlide");
    startFreqHzElem.min = gParams.startFreqHz.min;
    startFreqHzElem.max = gParams.startFreqHz.max;
    startFreqHzElem.step = gParams.startFreqHz.step;
    startFreqHzElem.value = gParams.startFreqHz.value;
    const stopFreqHzElem = document.getElementById("stopFreqHzSlide");
    stopFreqHzElem.min = gParams.stopFreqHz.min;
    stopFreqHzElem.max = gParams.stopFreqHz.max;
    stopFreqHzElem.step = gParams.stopFreqHz.step;
    stopFreqHzElem.value = gParams.stopFreqHz.value;
    const resolutionElem = document.getElementById("resolutionSlide");
    resolutionElem.min = gParams.resolution.min;
    resolutionElem.max = gParams.resolution.max;
    resolutionElem.step = gParams.resolution.step;
    resolutionElem.value = gParams.resolution.value;
    const scrollMsElem = document.getElementById("scrollMsSlide");
    scrollMsElem.min = gParams.scrollMs.min;
    scrollMsElem.max = gParams.scrollMs.max;
    scrollMsElem.step = gParams.scrollMs.step;
    scrollMsElem.value = gParams.scrollMs.value;
    const gammaElem = document.getElementById("gammaSlide");
    gammaElem.min = gParams.gamma.min;
    gammaElem.max = gParams.gamma.max;
    gammaElem.step = gParams.gamma.step;
    gammaElem.value = gParams.gamma.value;
    const freqInvertELem = document.getElementById("freqInvertSlide");
    freqInvertELem.min = (gParams.freqInvert.min)?1:0;
    freqInvertELem.max = (gParams.freqInvert.max)?1:0;
    freqInvertELem.value = (gParams.freqInvert.value)?1:0;
    const scanReverseELem = document.getElementById("scanReverseSlide");
    scanReverseELem.min = (gParams.scanReverse.min)?1:0;
    scanReverseELem.max = (gParams.scanReverse.max)?1:0;
    scanReverseELem.value = (gParams.scanReverse.value)?1:0;
}

function changeParams () {
    const previous = JSON.stringify(gParams);

    gParams.startFreqHz.value = parseInt(document.getElementById("startFreqHzSlide").value);
    gParams.stopFreqHz.value = parseInt(document.getElementById("stopFreqHzSlide").value);
    gParams.resolution.value = parseInt(document.getElementById("resolutionSlide").value);
    gParams.scrollMs.value = parseInt(document.getElementById("scrollMsSlide").value);
    gParams.gamma.value = parseInt(document.getElementById("gammaSlide").value);
    gParams.freqInvert.value = (parseInt(document.getElementById("freqInvertSlide").value) == 1);
    gParams.scanReverse.value = (parseInt(document.getElementById("scanReverseSlide").value) == 1);

    gParamUpdate = (previous !== JSON.stringify(gParams));
}

function sines(audioDestination) {
    
    // Allocate the oscillators
    gSignLevels = [];
    for (let freq = gParams.startFreqHz.value, phaseCounter = 0;
            freq < gParams.stopFreqHz.value && phaseCounter++ < gParams.resolution.value;
            freq += gFreqStep) {
        // create Oscillator node
        const oscillator = gTxAudioCtx.createOscillator();
        const gainNode = gTxAudioCtx.createGain();
      
        oscillator.type = "sine";
        oscillator.frequency.value = freq;

        gainNode.gain.value = 0;
                
        oscillator.connect(gainNode);
        gainNode.connect(audioDestination);

        // Start with random delays to mangle phase and avoid nasty clipping waveform
        setTimeout(function() {
                oscillator.start();
        }, phaseCounter % gStartDelayMaxMs);

        gSignLevels.push(gainNode.gain);
    }
}

function spectrogram(ctx, canvasName, mode) {
    const requiredFFtResolution = ctx.sampleRate / gFreqStep;
    const fftResolution = 1 << 31 - Math.clz32(requiredFFtResolution);
    const fftStart = Math.floor(gstartDispFreqHz / (ctx.sampleRate / fftResolution));
    const fftStop = Math.floor(gstopDispFreqHz / (ctx.sampleRate / fftResolution));
    const fftRange = fftStop - fftStart;
    
    const analyser = ctx.createAnalyser();
    analyser.fftSize = fftResolution;
    analyser.connect(ctx.destination);
    const bufferLength = analyser.frequencyBinCount;

    const dataArray = new Uint8Array(bufferLength);
    
    const canvasElem = document.getElementById(canvasName);
    canvasElem.height = fftRange;
    const specCanvasCtx = canvasElem.getContext("2d", {willReadFrequently: true});
    const specImageObj = specCanvasCtx.createImageData(1, fftRange);
    const specImageData = specImageObj.data;
    
    let drawVisual = null;
    let nudge = true;
    function drawSpectrum() {
        if (!gRunning[mode]) {return;};
            
        analyser.getByteFrequencyData(dataArray);
        
        if (nudge) {
            // Scroll spectrum across screen
            const scrollImageObj = specCanvasCtx.getImageData(1, 0, canvasElem.width, canvasElem.height);
            specCanvasCtx.putImageData(scrollImageObj, 0, 0);
            
            // Plot new spectrum line
            for (let y = 0; y < fftRange; y++) {
                const index = ((gParams.freqInvert.value)?(y):(fftRange - y - 1 )) + fftStart;
                const j = y * 4;
                const level = dataArray[index] * gSpecScaleLevel;
                specImageData[j + 0] = level;
                specImageData[j + 1] = level;
                specImageData[j + 2] = level;
                specImageData[j + 3] = 255;
            }
            specCanvasCtx.putImageData(specImageObj, canvasElem.width - 1, 0);
            nudge = false;
            if (gRunning[mode]) {
                setTimeout(function() {
                    nudge = true;
                }, gParams.scrollMs.value);
            }
        }
        
        if (gRunning[mode]) {drawVisual = requestAnimationFrame(drawSpectrum);}
    }
    drawVisual = requestAnimationFrame(drawSpectrum);
    
    return analyser;
}

function txSpectrum() {
    
    const analyserNode = spectrogram(gTxAudioCtx, "specplotout", "tx");
    sines(analyserNode);
    analyserNode.connect(gTxAudioCtx.destination);
}

function rxSpectrum (stream) {
    
    const mic = gRxAudioCtx.createMediaStreamSource(stream);
    
    const analyserNode = spectrogram(gRxAudioCtx, "specplotin", "rx");
    mic.connect(analyserNode);
}

function grabMic () {
    navigator.getUserMedia = ( navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia );
    navigator.getUserMedia({video:false,audio:true},rxSpectrum,console.log);
}

function encode() {
    const endMarginPix = 10;
    
    if (gTextElem.value !== "") {
        textRender(false);
    }

    console.assert(gParams.resolution.value == gSignLevels.length, "Resolution must match sign table length");
    console.assert(gParams.resolution.value == gInputTextCanvasElem.height, "Resolution must match text canvas height");
    let x = 0;
    let prevscan = false;
    
    // Find end of text
    let textEnd = 0;
    let pixActive = false;
    for (textEnd = gInputTextCanvasElem.width; ! pixActive && textEnd >= 0; --textEnd) {
        let scanLine = gTextCanvasCtx.getImageData(textEnd, 0, 1, gParams.resolution.value);
        for (let y = 0; ! pixActive && y < gParams.resolution.value; y++) {
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
            const scrollImageObj = gTextCanvasCtx.getImageData(1, 0, gInputTextCanvasElem.width, gParams.resolution.value);
            gTextCanvasCtx.putImageData(scrollImageObj, 0, 0);       
            // Get line to scan
            let scanLine = gTextCanvasCtx.getImageData(0, 0, 1, gParams.resolution.value);
            for (let y = 0; y < gParams.resolution.value; y++) {
                const j = y *4;
                // Create to grey using classic 0.3R, 0.59G, 0.11B luminority weighting
                const greyLevel = ((scanLine.data[j] * 0.3) + (scanLine.data[j + 1] * 0.59 ) + (scanLine.data[j + 2]) * 0.11) / 255;
                const gainVal = Math.pow(greyLevel, gParams.gamma.value);
                const index = (gParams.freqInvert.value)?y:(gParams.resolution.value - y - 1);
                gSignLevels[index].setTargetAtTime(gainVal * gMaxGain, gTxAudioCtx.currentTime + (gParams.scrollMs.value / 1000), gParams.scrollMs.value / 4000);
            }
            nudge = false;
            if (gRunning.tx) {
                setTimeout(function() {
                    nudge = true;
                }, gParams.scrollMs.value);
            }
            if (--textEnd <= 0) {
                gRunning.tx = false;
            }
        }
        if (gRunning.tx) {
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
    const boxWidth = window.innerWidth * gBoxWidthScale;
    
    /* const windowScale =  window.innerWidth / 800;
    
    document.body.style.transform = 'scale(' + windowScale + ')';
    document.body.style['-o-transform'] = 'scale(' + windowScale + ')';
    document.body.style['-webkit-transform'] = 'scale(' + windowScale + ')';
    document.body.style['-moz-transform'] = 'scale(' + windowScale + ')'; */
 
    
    document.getElementById("specplotin").width = boxWidth;
    document.getElementById("specplotin").style.backgroundColor = "black";
    document.getElementById("specplotout").width = boxWidth;
    document.getElementById("specplotout").style.backgroundColor = "black";
    
    gInputTextCanvasElem = document.getElementById("inputcanvas");
    gInputTextCanvasElem.height = gParams.resolution.value;
    gInputTextCanvasElem.width = boxWidth;
    gInputTextCanvasElem.style.backgroundColor = "black";
    
    gTextElem = document.getElementById("inputtext");
    gTextMaxChars = Math.floor((boxWidth / gTextPixSize) * 1.5);
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

function stateUpdateService () {
    // Check display and engine state is up to date
    setInterval(function () {
        if (gParamUpdate) {
            setParams();
            paramsReCalc();
            showParamsValues();
            gParamUpdate = false;
        }
        //if (gTXRunning || gRunning.rx) {


        //}
        if (gRunning.tx) {
            document.getElementById("txButton").style.visibility = "hidden";
            document.getElementById("txAbortButton").style.visibility = "visible";            
        } else {
            document.getElementById("txButton").style.visibility = "visible";
            document.getElementById("txAbortButton").style.visibility = "hidden";
        }
        if (gRunning.rx) {
            document.getElementById("rxButton").style.visibility = "hidden";
            document.getElementById("rxStopButton").style.visibility = "visible";            
        } else {
            document.getElementById("rxButton").style.visibility = "visible";
            document.getElementById("rxStopButton").style.visibility = "hidden";            
        }
    }, 100);
}

window.onload = function () {

    
    
    getParams();
    paramsReCalc();

    sizeElements();
    stateUpdateService ();
    showParamsValues();

    window.addEventListener("keyup", textRender, true);
    window.addEventListener('paste', pasteImage);
    window.addEventListener("orientationchange", reSizeElements);
    window.addEventListener("resize", reSizeElements);
    
    gTextCanvasCtx = gInputTextCanvasElem.getContext("2d", {willReadFrequently: true});
    
    document.getElementById("txAbortButton").style.visibility = "hidden";
    document.getElementById("rxStopButton").style.visibility = "hidden";

    /* document.getElementById("gammaSlide").addEventListener("input", () => {
        console.log("boo");
    }); */
}

function send() {
    if (gRunning.tx) {return;}
    gRunning.tx = true;
    
    gTxAudioCtx = new AudioContext();
    txSpectrum();
    encode();
}
function sendAbort() {
    if (!gRunning.tx) {return;}
    gRunning.tx = false;
}


function receive() {
    if (gRunning.rx) {return;}
    gRunning.rx = true;
    gRxAudioCtx = new AudioContext();
    grabMic();
}
function receiveStop() {
    if (!gRunning.rx) {return;}
    gRunning.rx = false;
    endDecode();
}



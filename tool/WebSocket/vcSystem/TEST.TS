const base64AudioDebug = '<先程コピーしたbase64文字列>';
const audioContext = new (window.AudioContext || window.AudioContext)();
try {
    const audioDataDebug = atob(base64AudioDebug);
    const audioDataBufferDebug = new Uint8Array(audioDataDebug.length);
    for (let i = 0; i < audioDataDebug.length; i++) {
        audioDataBufferDebug[i] = audioDataDebug.charCodeAt(i);
    }
    const audioBufferDebug = await audioContext.decodeAudioData(audioDataBufferDebug.buffer);
    if (audioBufferDebug) {
        console.log("Debug: decode success");
    } else {
        console.error('Debug: Audio decode failed: audioBuffer is null or undefined');
    }
} catch (e) {
    console.error('Debug: Audio decode failed', e);
}

export { };

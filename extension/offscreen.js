/* Plays the drop alarm (MV3 workers cannot play audio themselves). */
chrome.runtime.onMessage.addListener(m=>{
 if(m?.type!=='play-alarm')return;
 const c=new AudioContext();let t=c.currentTime;
 for(let r=0;r<3;r++)for(let i=0;i<4;i++){const o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=i%2?700:1050;g.gain.value=0.3;o.connect(g).connect(c.destination);o.start(t);o.stop(t+0.2);t+=0.26}
});

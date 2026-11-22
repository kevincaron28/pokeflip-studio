/* Android app only: point Tesseract.js at the bundled worker, core and language data so scanning works offline. */
(function(root){'use strict';
if(!root.Tesseract?.createWorker)return;
const abs=p=>new URL(p,root.location.href).href,original=root.Tesseract.createWorker.bind(root.Tesseract);
root.Tesseract.createWorker=(langs,oem,options={},config)=>original(langs,oem,{...options,workerPath:abs('./vendor/tesseract/worker.min.js'),corePath:abs('./vendor/tesseract/core/'),langPath:abs('./vendor/tesseract/lang'),gzip:true},config);
})(window);

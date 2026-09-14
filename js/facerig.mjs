/* Fish Friends — MediaPipe Face Landmarker, wrapped so the classic scripts can use it.

   Loads as a module, publishes `window.FaceRig`, and never blocks the camera:
   `status` walks 'loading' → 'ready' | 'failed', and create.js just checks it
   every frame. About 6.7MB lands on first run (2.9MB wasm + 3.8MB model), so the
   viewfinder shows the plain crop until this is up. */

import { FaceLandmarker, FilesetResolver }
  from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';

const WASM  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const rig = {
  status: 'loading',
  error: null,
  mode: 'VIDEO',
  landmarker: null
};
window.FaceRig = rig;

async function build(delegate) {
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false
  });
}

(async () => {
  try {
    rig.landmarker = await build('GPU');
  } catch (e) {
    // some phones and locked-down browsers refuse the GPU delegate
    try {
      rig.landmarker = await build('CPU');
    } catch (e2) {
      rig.status = 'failed';
      rig.error = String(e2);
      console.warn('face landmarker unavailable', e2);
      return;
    }
  }
  rig.status = 'ready';
})();

/* setOptions is async. Switching mode mid-flight and detecting before it settles
   silently yields zero faces, so mode changes go through this and callers wait. */
let switching = null;
function ensureMode(mode) {
  if (rig.mode === mode) return null;
  if (switching) return switching;
  switching = Promise.resolve(rig.landmarker.setOptions({ runningMode: mode }))
    .then(() => { rig.mode = mode; })
    .catch(e => { console.warn('mode switch failed', e); })
    .finally(() => { switching = null; });
  return switching;
}
rig.ensureMode = ensureMode;

/* Landmarks for one video frame, or null. Timestamps must increase.
   Returns null (rather than waiting) while a mode switch is in flight — the
   live loop just tries again on the next frame. */
let lastTs = -1;
rig.detectVideo = (video, tsMs) => {
  if (rig.status !== 'ready' || !video || !video.videoWidth) return null;
  if (rig.mode !== 'VIDEO') { ensureMode('VIDEO'); return null; }
  if (tsMs <= lastTs) tsMs = lastTs + 1;
  lastTs = tsMs;
  try {
    const res = rig.landmarker.detectForVideo(video, tsMs);
    return (res && res.faceLandmarks && res.faceLandmarks[0]) || null;
  } catch (e) {
    return null;
  }
};

/* Same, for a still — used when someone uploads a photo instead of using the camera.
   Async, because the mode switch has to land first. Don't call it while the live
   loop is running; stop the loop, await this, then restart if needed. */
rig.detectImage = async (el) => {
  if (rig.status !== 'ready' || !el) return null;
  await ensureMode('IMAGE');
  try {
    const res = rig.landmarker.detect(el);
    return (res && res.faceLandmarks && res.faceLandmarks[0]) || null;
  } catch (e) {
    return null;
  }
};

// Bundled statically: a lazy chunk can fail to load on flaky mobile connections / after redeploys.
import { Mp3Encoder } from '@breezystack/lamejs';

const TARGET_RATE = 24000;
const KBPS = 48;

function pickMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) ?? '';
}

/** Decode any browser recording and re-encode to mono MP3 (plays on every WhatsApp client). */
async function toMp3(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx({ sampleRate: TARGET_RATE });
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer);
  } finally {
    ctx.close().catch(() => {});
  }

  const channels = decoded.numberOfChannels;
  const length = decoded.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c += 1) {
    const data = decoded.getChannelData(c);
    for (let i = 0; i < length; i += 1) mono[i] += data[i] / channels;
  }
  const pcm = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const encoder = new Mp3Encoder(1, decoded.sampleRate, KBPS);
  const chunks = [];
  const BLOCK = 1152;
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const out = encoder.encodeBuffer(pcm.subarray(i, i + BLOCK));
    if (out.length) chunks.push(new Uint8Array(out));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));
  return new Blob(chunks, { type: 'audio/mpeg' });
}

/**
 * Start recording from the microphone.
 * @returns {Promise<{ stop: () => Promise<Blob>, cancel: () => void }>} stop() resolves to an MP3 blob
 */
export async function startVoiceRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    throw new Error('المتصفح لا يدعم تسجيل الصوت');
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new Error('لم يتم السماح باستعمال الميكروفون — فعّله من إعدادات المتصفح');
  }

  const mimeType = pickMime();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const parts = [];
  recorder.ondataavailable = (e) => {
    if (e.data?.size) parts.push(e.data);
  };
  recorder.start(250);

  const release = () => stream.getTracks().forEach((t) => t.stop());

  return {
    stop() {
      return new Promise((resolve, reject) => {
        recorder.onstop = async () => {
          release();
          try {
            const raw = new Blob(parts, { type: recorder.mimeType || mimeType || 'audio/webm' });
            if (!raw.size) throw new Error('التسجيل فارغ');
            resolve(await toMp3(raw));
          } catch (err) {
            reject(err);
          }
        };
        if (recorder.state !== 'inactive') recorder.stop();
        else recorder.onstop();
      });
    },
    cancel() {
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      release();
    },
  };
}

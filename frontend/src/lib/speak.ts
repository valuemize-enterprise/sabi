// lib/speak.ts
export function speakWelcome(name: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const utterance = new SpeechSynthesisUtterance(`Welcome, ${name}`);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.cancel(); // stop anything already queued
  window.speechSynthesis.speak(utterance);
}



// lib/speak.ts

// function getFemaleVoice(): SpeechSynthesisVoice | undefined {
//   const voices = window.speechSynthesis.getVoices();

//   return (
//     voices.find((voice) =>
//       /female|samantha|karen|victoria|zira|susan|google uk english female|google us english female/i.test(
//         voice.name
//       )
//     ) ||
//     voices.find(
//       (voice) =>
//         voice.lang.startsWith("en") &&
//         !/male|david|daniel|alex/i.test(voice.name)
//     )
//   );
// }

// export function speakWelcome(name: string) {
//   if (typeof window === "undefined" || !("speechSynthesis" in window)) {
//     return;
//   }

//   const synth = window.speechSynthesis;

//   const speak = () => {
//     const utterance = new SpeechSynthesisUtterance(`Welcome, ${name}`);

//     const voice = getFemaleVoice();

//     if (voice) {
//       utterance.voice = voice;
//       utterance.lang = voice.lang;
//     }

//     utterance.rate = 0.95;
//     utterance.pitch = 1.1;
//     utterance.volume = 1;

//     synth.cancel();
//     synth.speak(utterance);
//   };

//   // Voices may not be loaded yet
//   if (synth.getVoices().length > 0) {
//     speak();
//   } else {
//     synth.addEventListener("voiceschanged", speak, { once: true });
//   }
// }
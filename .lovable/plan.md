

# Plan : Ajouter la fonctionnalite Parlor (conversation vocale + vision en temps reel)

## Qu'est-ce que Parlor ?

Parlor est un systeme de conversation IA multimodal en temps reel : l'utilisateur parle et montre sa camera, l'IA comprend la parole et la vision, puis repond vocalement. Le tout fonctionne avec detection automatique de la voix (VAD), interruption possible (barge-in) et streaming audio.

## Ce qui existe deja dans l'app

- `useSpeechInput` : reconnaissance vocale (speech-to-text) via l'API Web Speech
- `LiveBrowserView` : flux WebSocket pour le streaming video
- Pages Chat, Cowork, Code avec TopNavBar

## Plan d'implementation

### 1. Creer la page Parlor (`src/pages/ParlorPage.tsx`)

Interface immersive plein ecran avec :
- **Flux camera** en arriere-plan (WebRTC `getUserMedia` video)
- **Visualiseur audio** (canvas waveform) montrant l'activite vocale
- **Transcript** en temps reel (messages utilisateur + reponses IA)
- **Indicateur d'etat** : Loading, Listening, Thinking, Speaking
- **Bouton camera on/off** et indicateur "On-device"
- Design sombre avec effets de glow autour du viewport camera

### 2. Ajouter la route et la navigation

- `App.tsx` : ajouter `Route path="/parlor"`
- `TopNavBar.tsx` : ajouter un 4eme bouton "Parlor" avec icone `Video`

### 3. Logique vocale complete (`src/hooks/useParlorSession.ts`)

- Capture audio via `getUserMedia` avec `MediaRecorder`
- Detection d'activite vocale (VAD) pour mode mains-libres
- Envoi de l'audio capture + frame camera (JPEG) a l'IA
- Reception et lecture de la reponse audio via `Web Speech API` (TTS)
- Gestion du barge-in (interruption quand l'utilisateur parle)
- Machine a etats : `idle → listening → processing → speaking → idle`

### 4. Composant de visualisation audio (`src/components/parlor/AudioWaveform.tsx`)

- Canvas anime montrant les niveaux audio en temps reel
- Utilise `AnalyserNode` de l'API Web Audio
- Animations fluides avec `requestAnimationFrame`

### 5. Composant viewport camera (`src/components/parlor/CameraViewport.tsx`)

- Element `<video>` avec flux camera
- Effet de glow pulse quand l'IA "regarde"
- Toggle on/off avec transition

### 6. Integration avec le systeme IA existant

- Les transcripts vocaux sont envoyes au meme backend IA (`chatDirect`)
- Les reponses textuelles sont converties en parole via `SpeechSynthesis`
- Les frames camera sont capturees periodiquement et envoyees comme contexte visuel

## Fichiers a creer/modifier

| Fichier | Action |
|---------|--------|
| `src/pages/ParlorPage.tsx` | Creer - page principale immersive |
| `src/hooks/useParlorSession.ts` | Creer - logique voix + vision + etats |
| `src/components/parlor/AudioWaveform.tsx` | Creer - visualiseur audio canvas |
| `src/components/parlor/CameraViewport.tsx` | Creer - composant camera avec glow |
| `src/App.tsx` | Modifier - ajouter route /parlor |
| `src/components/TopNavBar.tsx` | Modifier - ajouter bouton Parlor |

## Details techniques

- **Camera** : `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`
- **VAD** : detection de volume via `AnalyserNode.getByteFrequencyData()` avec seuil configurable
- **TTS** : `window.speechSynthesis.speak()` pour les reponses vocales
- **Capture frames** : `canvas.drawImage(video)` → `canvas.toDataURL('image/jpeg')` envoye comme contexte
- **Barge-in** : `speechSynthesis.cancel()` quand le VAD detecte une voix pendant la lecture


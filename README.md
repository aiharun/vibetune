# TasteMirror 🎵

TasteMirror is an AI-powered music taste analyzer that reveals your sophisticated music persona. It analyzes your Spotify playlists to provide deep insights into your musical vibe, mood analysis, and personalized recommendations.

## Features

- 🎧 **Vibe Analysis**: AI-generated detailed analysis of your music taste.
- 📊 **Taste Profile**: Visual metrics for Energy, Melancholy, Instrumentation, and Danceability.
- 🎵 **Smart Recommendations**: Custom song suggestions based on your unique vibe.
- 💾 **Playlist Builder**: Create and manage custom playlists directly in the app.
- 🟢 **Spotify Integration**: 
  - Connect your Spotify account.
  - Export your TasteMirror discoveries directly to your Spotify library.
  - Two-way sync for "My List" feature.
- 📱 **Responsive Design**: Premium, dark-themed UI that works on all devices.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion
- **Backend**: Firebase (Auth, Firestore, Functions)
- **AI**: Google Gemini API
- **Music Data**: Spotify Web API

## Getting Started

1.  **Clone the repo**
2.  **Install dependencies**: `npm install`
3.  **Environment Variables**: Create a `.env` file with the following:
    ```env
    VITE_FIREBASE_API_KEY=your_key
    VITE_FIREBASE_AUTH_DOMAIN=your_domain
    VITE_GEMINI_API_KEY=your_key
    VITE_SPOTIFY_CLIENT_ID=your_id
    VITE_SPOTIFY_CLIENT_SECRET=your_secret
    ```
4.  **Run Development Server**: `npm run dev`

## License

This project is licensed under the MIT License.

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Voice<span className="text-blue-600">Flow</span> Pro
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Professional audio transcription platform with AI-powered insights and real-time collaboration
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-4">🎙️</div>
              <h3 className="text-lg font-semibold mb-2">Multi-Format Support</h3>
              <p className="text-gray-600">
                Support for MP3, WAV, M4A, OGG, OPUS, MOV, and MP4 files
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-4">🌍</div>
              <h3 className="text-lg font-semibold mb-2">Multi-Language</h3>
              <p className="text-gray-600">
                Transcription support for 50+ languages with high accuracy
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-4">🤝</div>
              <h3 className="text-lg font-semibold mb-2">Real-time Collaboration</h3>
              <p className="text-gray-600">
                Edit and comment on transcripts with your team in real-time
              </p>
            </div>
          </div>
          
          <div className="mt-12 space-x-4">
            <Link
              href="/auth/register"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors inline-block"
            >
              Sign In
            </Link>
            <Link
              href="/whisper-demo"
              className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors inline-block"
            >
              Try Whisper Demo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">Dashboard</h1>
          <p className="text-xl text-gray-600 mb-8">
            Authentication and dashboard features are currently under development.
          </p>
          
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">What's Available Now</h2>
            <ul className="text-left space-y-3 text-gray-600">
              <li>✅ <strong>Whisper Demo:</strong> Full transcription testing with multiple methods</li>
              <li>✅ <strong>Real-time Transcription:</strong> Live audio processing</li>
              <li>✅ <strong>Browser Whisper:</strong> Privacy-first local processing</li>
              <li>✅ <strong>OpenAI Integration:</strong> Cloud-based high-accuracy transcription</li>
              <li>🚧 <strong>User Authentication:</strong> Coming soon</li>
              <li>🚧 <strong>User Dashboard:</strong> Coming soon</li>
              <li>🚧 <strong>Transcript Storage:</strong> Coming soon</li>
            </ul>
            
            <div className="mt-6">
              <a
                href="/whisper-demo"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
              >
                Try Whisper Demo
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
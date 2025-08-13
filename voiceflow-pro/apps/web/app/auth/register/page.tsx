// import { RegisterForm } from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Register</h1>
        <p className="text-gray-600 mb-4">
          Authentication system is currently under development.
        </p>
        <p className="text-sm text-gray-500">
          For now, you can try the <a href="/whisper-demo" className="text-blue-600 underline">Whisper Demo</a> to test transcription features.
        </p>
      </div>
    </div>
  );
}
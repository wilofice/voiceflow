export default function ConfirmEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <div className="text-5xl mb-4">📧</div>
        <h1 className="text-2xl font-bold mb-4">Check Your Email</h1>
        <p className="text-gray-600 mb-6">
          We've sent you a confirmation email. Please check your inbox and click the link to verify your account.
        </p>
        <p className="text-sm text-gray-500">
          Didn't receive the email? Check your spam folder or request a new one.
        </p>
      </div>
    </div>
  );
}
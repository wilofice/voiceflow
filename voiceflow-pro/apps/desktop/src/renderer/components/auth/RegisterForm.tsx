import { Loader2, Eye, EyeOff, Check, X, Mail, ArrowLeft } from 'lucide-react';
import React, { useState } from 'react';

import { useAuthStore } from '../../stores/authStore';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface RegisterFormProps {
  onToggleMode: () => void;
}

interface PasswordRequirement {
  text: string;
  valid: boolean;
}

export function RegisterForm({ onToggleMode }: RegisterFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register, isLoading, error, clearError, pendingConfirmation, confirmationEmail, clearConfirmation } = useAuthStore();

  const getPasswordRequirements = (password: string): PasswordRequirement[] => {
    return [
      { text: 'At least 8 characters', valid: password.length >= 8 },
      { text: 'Contains uppercase letter', valid: /[A-Z]/.test(password) },
      { text: 'Contains lowercase letter', valid: /[a-z]/.test(password) },
      { text: 'Contains number', valid: /\d/.test(password) },
      { text: 'Contains special character', valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ];
  };

  const passwordRequirements = getPasswordRequirements(password);
  const isPasswordValid = passwordRequirements.every(req => req.valid);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    if (!name || !email || !password || !confirmPassword) {
      return;
    }

    if (!isPasswordValid) {
      return;
    }

    if (password !== confirmPassword) {
      return;
    }

    try {
      const result = await register(email, password, name);
      // If confirmation is required, the UI will automatically show the confirmation message
      // due to the pendingConfirmation state being set in the store
    } catch (error) {
      // Error is handled by the store
    }
  };

  const handleInputChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    if (error) clearError();
  };

  const isFormValid = name && email && isPasswordValid && passwordsMatch;

  // Show email confirmation UI if pending confirmation
  if (pendingConfirmation && confirmationEmail) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center flex items-center justify-center">
            <Mail className="mr-2 h-6 w-6 text-blue-600" />
            Check Your Email
          </CardTitle>
          <CardDescription className="text-center">
            We've sent a confirmation link to your email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 mb-2">
                We've sent a confirmation email to:
              </p>
              <p className="font-semibold text-blue-900 break-all">
                {confirmationEmail}
              </p>
            </div>
            
            <div className="text-sm text-gray-600 space-y-2">
              <p>Please check your email and click the confirmation link to complete your registration.</p>
              <p>Can't find the email? Check your spam folder.</p>
            </div>
          </div>
          
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              clearConfirmation();
              setName('');
              setEmail('');
              setPassword('');
              setConfirmPassword('');
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already confirmed?{' '}
              <Button
                variant="link"
                className="p-0 h-auto text-sm"
                onClick={onToggleMode}
              >
                Sign in
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Create account</CardTitle>
        <CardDescription className="text-center">
          Join VoiceFlow Pro to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={handleInputChange(setName)}
              disabled={isLoading}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={handleInputChange(setEmail)}
              disabled={isLoading}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={password}
                onChange={handleInputChange(setPassword)}
                disabled={isLoading}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {password && (
              <div className="space-y-1 text-sm">
                {passwordRequirements.map((req, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    {req.valid ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-red-500" />
                    )}
                    <span className={req.valid ? 'text-green-700' : 'text-red-700'}>
                      {req.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={handleInputChange(setConfirmPassword)}
                disabled={isLoading}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {confirmPassword && (
              <div className="flex items-center space-x-2 text-sm">
                {passwordsMatch ? (
                  <>
                    <Check className="h-3 w-3 text-green-500" />
                    <span className="text-green-700">Passwords match</span>
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3 text-red-500" />
                    <span className="text-red-700">Passwords don't match</span>
                  </>
                )}
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !isFormValid}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={onToggleMode}
              disabled={isLoading}
            >
              Sign in
            </Button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
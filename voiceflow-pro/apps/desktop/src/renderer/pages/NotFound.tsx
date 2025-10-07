import React from 'react';

import { Button } from '../components/ui/button';

const NotFound: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold text-text-primary mb-4">
          404 - Page Not Found
        </h1>
        <p className="text-text-secondary mb-6">
          The page you're looking for doesn't exist.
        </p>
        <Button onClick={() => window.location.href = '/'}>
          Go Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
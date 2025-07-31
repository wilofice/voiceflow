import { Navigation } from './Navigation';

interface LayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
  } | null;
}

export function Layout({ children, user }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />
      <main>{children}</main>
    </div>
  );
}
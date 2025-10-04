import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      email?: string;
      name?: string;
      type: 'access' | 'refresh';
    };
    user: {
      id: string;
      email: string;
      name?: string;
    };
  }
}

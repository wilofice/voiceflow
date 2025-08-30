# VoiceFlow Pro

A cross-platform audio transcription platform with real-time collaboration, AI-powered insights, and enterprise-grade features.

## Features

- 🎙️ **Multi-format Audio Support**: MP3, WAV, M4A, OGG, OPUS, MOV, MP4
- 🌍 **Multi-language Transcription**: Support for 50+ languages
- 🤝 **Real-time Collaboration**: Edit and comment on transcripts with your team
- 🤖 **AI-Powered Intelligence**: Automatic summaries, action items, and sentiment analysis
- 🔒 **Enterprise Security**: End-to-end encryption and SOC 2 compliance
- 📱 **Cross-Platform**: Web, Mac, Windows, Linux, iOS, and Android

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Node.js, Fastify, TypeScript, Prisma
- **Database**: PostgreSQL
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **AI/ML**: OpenAI Whisper API
- **Real-time**: WebSockets with Socket.io
- **Desktop**: Tauri (Rust + Web technologies)

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 14
- Supabase account
- OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/voiceflow-pro.git
   cd voiceflow-pro
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Set up the database:
   ```bash
   npm run db:push
   npm run db:seed
   ```

5. Start development servers:
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Project Structure

```
voiceflow-pro/
├── apps/
│   ├── web/                 # Next.js frontend application
│   └── api/                 # Node.js backend API
├── packages/
│   ├── ui/                  # Shared React components
│   ├── shared/              # Shared utilities and types
│   └── database/            # Prisma schema and migrations
├── docs/                    # Documentation
└── scripts/                 # Automation scripts
```

## Development

### Available Scripts

- `npm run dev` - Start all services in development mode
- `npm run build` - Build all packages for production
- `npm run test` - Run tests across all packages
- `npm run lint` - Lint all code
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking

### Code Quality

This project uses:
- TypeScript strict mode for type safety
- ESLint for code linting
- Prettier for code formatting
- Husky for git hooks
- Jest for testing

### Contributing

1. Create a feature branch from `main`
2. Make your changes following our code style
3. Write tests for new functionality
4. Ensure all tests pass and linting is clean
5. Submit a pull request

## API Documentation

API documentation is available at `/api/docs` when running the development server.

## Security

- All user data is encrypted at rest
- Audio files are stored securely with access controls
- JWT tokens expire after 24 hours
- Rate limiting is implemented on all endpoints

## License

Copyright (c) 2024 VoiceFlow Pro. All rights reserved.

## Support

For support, email support@voiceflowpro.com or join our Discord community.
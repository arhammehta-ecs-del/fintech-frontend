# Fintech Frontend

A React + TypeScript frontend built with Vite for the fintech application.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS

## Prerequisites

Make sure these are installed before running the project:

- Node.js
- npm
- Git

## Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/arhammehta-ecs-del/fintech-frontend.git
cd fintech-frontend
npm install
```

## Environment Variables

Create a `.env` file in the project root and add:

```env
VITE_API_BASE_URL=http://localhost:8000
```

This variable is used by the frontend to connect to the backend API.

## Running the App

Start the development server:

```bash
npm run dev
```

The app runs on:

```bash
http://localhost:8080
```

## Available Scripts

```bash
npm run dev
```

Starts the development server.

```bash
npm run build
```

Builds the app for production.

```bash
npm run test
```

Runs the test suite.

```bash
npm run lint
```

Runs ESLint checks.

## Project Structure

- `src/` - application source code
- `src/components/` - reusable UI components
- `src/pages/` - page-level screens
- `src/contexts/` - shared app state
- `src/lib/` - API and utility helpers

## Notes

- Make sure the backend is running on the same URL configured in `VITE_API_BASE_URL`
- Do not commit `.env` if it contains environment-specific values
- Use a `.env.example` file for shared setup instructions when needed

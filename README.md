# HyperBrain

> AI-powered academic workspace for smarter learning and examinations.

---

## Overview

**HyperBrain** is a comprehensive, production-grade academic platform designed to optimize study habits, roadmap curricula, and automate examination preparation. Powered by the Google Gemini AI models and backed by Firebase security infrastructure, HyperBrain offers students a distraction-free, highly personalized environment for compiling topic notes, testing knowledge through adaptive mock examinations, and reviewing concepts with smart learning card packs.

For administrators, the workspace provides real-time telemetry dashboards, subscription trackers, user session logs, and system load monitoring parameters to maintain operations smoothly at scale.

---

## Features

### 🎓 Student Features
*   **AI Tutor**: Interactive 24/7 learning assistant optimized to answer academic queries with direct, concise responses under 60 words.
*   **Smart Notes**: Dynamic markdown note compiling for any uploaded syllabus PDF or specific course module.
*   **Flashcards**: Auto-generated 3D interactive flashcards with spatial card flipping for active memory recall.
*   **Study Roadmaps**: Adaptive calendar-based study plans tracking study hourly goals and custom milestones.
*   **Mock Exams**: Parallel-compiled mock exam papers consisting of both Multiple Choice Questions (MCQs) and theoretical short-answer questions.
*   **Progress Tracking**: Dynamic curriculum coverage tracker highlighting mastery modules and target revision modules.

### 🛡️ Admin Features
*   **Real-time Analytics**: Telemetry dashboard plotting active sessions, active user counts, and platform performance parameters.
*   **User Management**: Student profiles database, roles management (Admin/Student statuses), and bans control center.
*   **System Monitoring**: Real-time serverless API failure ratios, latency stats, and active system configuration limits.
*   **Subscription Management**: Pro-tier revenue trackers, annual payment completions, and pricing coupons compiler.

---

## Tech Stack

### Frontend
*   **React** (v19) - Component architecture and hooks management.
*   **Vite** - Lightning-fast frontend development runtime and compiler.
*   **Tailwind CSS** - Custom utility styling classes and dark-mode themes.
*   **Lucide React** - High-quality clean SVG iconography package.
*   **Framer Motion / GSAP** - Premium animations and layout shifts.

### Backend & API
*   **Firebase** - Distributed Client Auth SDK, Firestore security-hardened rules, and real-time database listener channels.
*   **Serverless APIs** - Lightweight Vercel API functions serving the core LLM orchestration pipelines.

### Artificial Intelligence
*   **Google Gemini** - Advanced `gemini-2.5-flash` model mapping syllabi, generating study plans, and auto-grading theoretical exam questions.

### Deployment
*   **Vercel** - Scale-ready production serverless hosting.

---

## Installation

To configure the workspace on your local environment:

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/yourusername/hyperbrain.git
    cd hyperbrain
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```

---

## Environment Variables

Create a `.env` file in the root directory of the project and populate the following parameters:

```env
# Client-Side Firebase Configurations (Prefixed with VITE_ for Vite build bundling)
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_sender_id_here
VITE_FIREBASE_APP_ID=your_firebase_app_id_here

# Backend Serverless API Configurations (Private keys, never exposed on client-side)
GEMINI_API_KEY=your_gemini_api_key_here
RESEND_API_KEY=your_resend_api_key_here
```

---

## Project Structure

The project has been restructured according to a scalable SaaS layout:

```text
src/
├── api/             # Core Vercel serverless API handlers (AI tutor, note, exam generation, emails)
├── assets/          # Application design assets
│   ├── images/      # High-definition illustrations
│   ├── icons/       # Actionable SVGs
│   ├── logos/       # Core company brand assets
│   └── animations/  # Lottie/motion configurations
├── components/      # UI component tree
│   ├── common/      # Primitives (Button, Card, Modal, Loader, Input, Skeleton, ErrorBoundary)
│   ├── dashboard/   # Workspace modules (TopicContent, Syllabus checklists)
│   ├── tutor/       # AI conversation controls (ChatWidget, TutorDrawer)
│   └── layout/      # Sidebar templates, standard layout frames
├── contexts/        # Shared React context providers (AuthContext, ThemeContext, SubscriptionContext)
├── hooks/           # Reusable custom hooks
├── pages/           # High-level layouts and route views
│   ├── auth/        # Login and Register layouts
│   ├── student/     # Dashboard, Stats, Tutor, MockExams, Flashcards, Profile
│   ├── admin/       # Telemetry database panel
│   └── landing/     # Marketing landing page layout
├── routes/          # Navigation guards (ProtectedRoute, AdminRoute)
├── services/        # Third-party endpoints & service logic
│   ├── firebase/    # db/auth setups, firestoreService, userService, authService
│   └── ai/          # notesService, examService, flashcardService, tutorService
├── styles/          # Styling configurations (globals.css, themes.css)
├── utils/           # Shared utility tools
│   ├── helpers.js   # Calculations, time comparisons, countdowns
│   ├── constants.js # Application limits configuration settings
│   └── formatters.js# Display string modifications
├── App.jsx          # Root page routes mapping
└── main.jsx         # App startup bootstrapping with wrappers
```

---

## Deployment Guide

Deploying HyperBrain to **Vercel** is straightforward:

1.  **Deploy via Vercel CLI**
    Ensure you are logged in to the Vercel CLI:
    ```bash
    npm i -g vercel
    vercel
    ```
2.  **Link and Setup Environment Variables**
    Confirm settings and input project configurations. In your Vercel Dashboard under **Settings > Environment Variables**, input all the environment variables listed in the `.env` section.
3.  **Production Release**
    Deploy to production using:
    ```bash
    vercel --prod
    ```

---

## Screenshots

> *Add screenshots here representing the dynamic landing page, AI tutoring workspace, and real-time admin metrics panel.*

---

## Contributors

*   **Aditya** - Core Architect & Lead Engineer

---

## License

This project is licensed under the [MIT License](LICENSE).

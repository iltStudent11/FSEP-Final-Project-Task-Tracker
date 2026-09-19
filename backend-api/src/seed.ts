import dotenv from "dotenv";

dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "./config/db";
import User, { type IUser } from "./models/User";
import Project from "./models/Project";
import Task from "./models/Task";

const LAB_GUIDE_PROJECTS = [
  { prefix: "1.1", projectCode: "LAB-1", name: "1.1 Overview" },
  { prefix: "1.2", projectCode: "LAB-2", name: "1.2 Planning & Landing Page (~0.5 Day)" },
  { prefix: "1.3", projectCode: "LAB-3", name: "1.3 Express API & Database (~1 Day)" },
  { prefix: "1.4", projectCode: "LAB-4", name: "1.4 React Front-End (~1 Day)" },
  { prefix: "1.5", projectCode: "LAB-5", name: "1.5 Docker & EKS Deployment (~1 Day)" },
  { prefix: "1.6", projectCode: "LAB-6", name: "1.6 Testing, Polish & Presentation (~0.5 Day)" },
  { prefix: "1.7", projectCode: "LAB-7", name: "1.7 Thursday: Presentations" },
  { prefix: "1.8", projectCode: "LAB-8", name: "1.8 Friday: Retrospective & Cleanup" },
  { prefix: "1.9", projectCode: "LAB-9", name: "1.9 Final Checklist" },
] as const;

const LAB_GUIDE_TASKS = [
  { sectionPrefix: "1.1", title: "1.1.1. AI Tools Are Permitted", description: "" },
  {
    sectionPrefix: "1.1",
    title: "1.1.2. Application Domain",
    description:
      "- At least 3 data models (one must be User for authentication)\n- CRUD operations on at least 2 non-User models\n- Relationships between models (references)\n- A dashboard with aggregate statistics",
  },
  { sectionPrefix: "1.1", title: "1.1.3. Time Estimate", description: "" },
  {
    sectionPrefix: "1.1",
    title: "1.1.4. Schedule",
    description:
      "- Monday–Wednesday: Build — all development and deployment work\n- Thursday: Team presentations (10 min demo + 5 min Q&A per team)\n- Friday: Retrospective, AWS cleanup, program wrap-up",
  },
  {
    sectionPrefix: "1.2",
    title: "1.2.1. Team Setup & Repository",
    description:
      "- Create a shared GitHub repository with all team members as collaborators\n- Set up a branching strategy: main — production-ready code only (protected branch)\n- dev — integration branch for feature work\n- Feature branches — feature/landing-page , feature/api-auth , etc.\n- Add a .gitignore for Node.js projects\n- Agree on team roles — who leads each phase (everyone contributes to all phases)",
  },
  {
    sectionPrefix: "1.2",
    title: "1.2.2. Custom HTML/CSS Landing Page",
    description:
      "- Semantic HTML5 elements ( <nav> , <main> , <section> , <footer> )\n- Responsive design — must look good on mobile (< 640px) and desktop\n- CSS features: Flexbox or Grid layout, custom properties (CSS variables), hover transitions, media queries\n- Content sections: hero/header, feature highlights (3–6 cards), tech stack badges, team members, footer\n- A prominent link/button to launch the React application\n- No JavaScript — pure HTML + CSS only\n- Clean, professional design with consistent typography and color scheme\n- Correct: <Link to=\"/login\"> , navigate(\"/projects\")\n- Wrong: <Link to=\"/app/login\"> (becomes /app/app/login in the browser)\n- Configure Nginx to serve both paths from one container: # client/nginx.conf server { listen 80 ; # Landing page at / location = / { root /usr/share/nginx/html/landing; try_files /landing.html = 404 ; } # React SPA at /app (^~ so this wins over the regex asset cache block) location ^~ /app { alias /usr/share/nginx/html/app; try_files $uri $uri / /app/index.html; } # API proxy location /api/ { proxy_pass http://api:4000/api/; } } The Dockerfile copies the two outputs into the two directories Nginx expects: COPY --from=build /app/dist /usr/share/nginx/html/app COPY --from=build /app/public/landing.html /usr/share/nginx/html/landing/landing.html\n- Verify the wiring after docker compose up --build : http://localhost:3000/ → landing page loads (view source shows your HTML/CSS, no React)\n- Click \"Launch the App\" → browser navigates to http://localhost:3000/app/ → React app loads\n- React Router navigation (e.g. clicking \"Register\") updates the URL to http://localhost:3000/app/register and keeps you in the SPA",
  },
  {
    sectionPrefix: "1.2",
    title: "1.2.3. GitHub Actions CI Pipeline",
    description:
      "- Check out the code\n- Install dependencies for both API and client\n- Run TypeScript compilation checks ( tsc --noEmit )\n- Run tests (once tests exist in later parts)\n- Build Docker images (once Dockerfiles exist)",
  },
  {
    sectionPrefix: "1.2",
    title: "1.2.4. Checklist",
    description:
      "- ❏ GitHub repository created with branching strategy\n- ❏ Landing page built with semantic HTML5 and responsive CSS\n- ❏ Landing page passes mobile and desktop viewport checks\n- ❏ GitHub Actions workflow runs on push\n- ❏ All team members have made at least one commit",
  },
  {
    sectionPrefix: "1.3",
    title: "1.3.1. Project Scaffold",
    description:
      "- Create the api/ directory with the following structure: api/ ├── src/ │ ├── config/ │ │ └── db.ts # MongoDB connection │ ├── models/ │ │ ├── User.ts # User model │ │ └── [Resource].ts # Your domain models │ ├── middleware/ │ │ ├── auth.ts # JWT verification │ │ ├── errorHandler.ts │ │ └── validate.ts # Request validation │ ├── routes/ │ │ ├── auth.ts # Register + login │ │ ├── [resource].ts # CRUD routes for each model │ │ └── dashboard.ts # Aggregation stats │ └── server.ts # Express app + listen ├── package.json ├── tsconfig.json └── .env.example\n- Initialize the project: cd api npm init -y npm install express mongoose jsonwebtoken bcryptjs cors dotenv npm install -D typescript @types/express @types/jsonwebtoken @types/bcryptjs @types/cors tsx\n- Configure tsconfig.json with \"module\": \"Node16\" and \"moduleResolution\": \"Node16\"",
  },
  {
    sectionPrefix: "1.3",
    title: "1.3.2. Data Models",
    description:
      "- Fields: name, email (unique), password (hashed), role (enum with at least 2 roles)\n- Pre-save hook to hash passwords with bcrypt\n- Instance method to compare passwords\n- At least one model must reference User (e.g., owner , assignee )\n- At least one model must reference another domain model\n- Use appropriate Mongoose types: String, Number, Date, enums, arrays, embedded subdocuments\n- Include timestamps: true on all schemas",
  },
  {
    sectionPrefix: "1.3",
    title: "1.3.3. Authentication Routes",
    description:
      "- Registration: validate required fields, check for duplicate email, hash password, return JWT + user object\n- Login: find user by email, compare password, return JWT + user object\n- JWT payload should include user ID and role",
  },
  {
    sectionPrefix: "1.3",
    title: "1.3.4. CRUD Routes",
    description:
      "- GET /api/[resource] — List all (with query filters as needed)\n- POST /api/[resource] — Create (protected, requires auth)\n- GET /api/[resource]/:id — Get by ID (populate references)\n- PUT /api/[resource]/:id — Update (protected)\n- DELETE /api/[resource]/:id — Delete (protected)",
  },
  {
    sectionPrefix: "1.3",
    title: "1.3.5. Dashboard Route",
    description:
      "- Total count for each model\n- Counts grouped by status/category fields\n- Recent items (last 5–10)\n- Any other useful metrics for your domain",
  },
  {
    sectionPrefix: "1.3",
    title: "1.3.6. Checklist",
    description:
      "- ❏ Express + TypeScript API starts and connects to MongoDB\n- ❏ At least 3 Mongoose models with proper relationships\n- ❏ Registration and login endpoints work and return JWTs\n- ❏ CRUD endpoints for all domain models\n- ❏ Dashboard endpoint returns aggregate stats\n- ❏ Auth middleware protects write operations\n- ❏ Error handling middleware returns consistent error responses",
  },
  {
    sectionPrefix: "1.4",
    title: "1.4.1. Project Scaffold",
    description:
      "- Create the React app in client/ : npm create vite@latest client -- --template react-ts cd client npm install axios react-router-dom npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom\n- Configure the Vite dev server to proxy /api requests to the Express API",
  },
  {
    sectionPrefix: "1.4",
    title: "1.4.2. Authentication",
    description:
      "- Create an AuthContext with login, register, and logout functions\n- Store JWT in localStorage, attach to API requests via Axios interceptors\n- Create a ProtectedRoute component that redirects unauthenticated users\n- Build Login and Register pages with form validation and error display",
  },
  {
    sectionPrefix: "1.4",
    title: "1.4.3. Application Pages",
    description:
      "- Dashboard — Display stats from the dashboard API (cards, tables, or charts)\n- List page for each domain model — Table or card layout with status badges\n- Detail page for at least one model — Full information, status updates, related data\n- Create form — For adding new resources (inline or modal)\n- Navigation — Navbar with links, user info, and logout",
  },
  {
    sectionPrefix: "1.4",
    title: "1.4.4. Styling",
    description:
      "- Create a cohesive design with CSS (no UI framework required)\n- Use CSS variables for consistent colors\n- Add status badges with distinct colors per status\n- Ensure the app is usable and professional-looking",
  },
  {
    sectionPrefix: "1.4",
    title: "1.4.5. Component Tests",
    description:
      "- Test that a component renders expected content\n- Test that form inputs work correctly\n- Test that navigation elements appear for authenticated users",
  },
  {
    sectionPrefix: "1.4",
    title: "1.4.6. Checklist",
    description:
      "- ❏ React + TypeScript app runs with Vite\n- ❏ Login and registration work with the API\n- ❏ Dashboard displays real data from the API\n- ❏ CRUD operations work through the UI\n- ❏ Navigation between pages works via React Router\n- ❏ At least 3 component tests pass\n- ❏ UI is styled consistently and looks professional",
  },
  {
    sectionPrefix: "1.5",
    title: "1.5.1. Dockerfiles",
    description:
      "- Use node:20-alpine base\n- Copy package files, install dependencies, copy source, compile TypeScript\n- Expose port and set CMD\n- Multi-stage build: build stage compiles React app, production stage serves with Nginx\n- Copy the landing page to a separate Nginx location\n- Configure Nginx to serve both the landing page (at / ) and the React SPA (at /app )\n- Proxy /api/ requests to the API service",
  },
  {
    sectionPrefix: "1.5",
    title: "1.5.2. Docker Compose",
    description:
      "- Stop the local service occupying the port, for example: # Linux sudo systemctl stop mongod # macOS (Homebrew) brew services stop mongodb-community # Windows (PowerShell, admin) Stop-Service MongoDB\n- Or map the container to a different host port in docker-compose.yml (the container-side port stays the same so api can still reach mongo:27017 ): mongo: ports: - \"27018:27017\" # host:container",
  },
  {
    sectionPrefix: "1.5",
    title: "1.5.3. Push Images to ECR",
    description:
      "- Create ECR repositories for your API and client images\n- Tag and push images: # Authenticate Docker to ECR aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com # Build, tag, and push docker build -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/capstone-api:latest ./api docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/capstone-api:latest docker build -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/capstone-client:latest ./client docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/capstone-client:latest",
  },
  {
    sectionPrefix: "1.5",
    title: "1.5.4. EKS Cluster & Kubernetes Manifests",
    description:
      "- Create an EKS cluster (or reuse an existing one): eksctl create cluster --name capstone --region us-east-1 --nodes 2 --node-type t3.medium\n- Create Kubernetes manifests in a k8s/ directory: namespace.yaml — Dedicated namespace for your application\n- secrets.yaml — MongoDB URI and JWT secret\n- mongo.yaml — Deployment + Service for MongoDB\n- api.yaml — Deployment (2 replicas) + Service, reading secrets from environment\n- client.yaml — Deployment (2 replicas) + Service (type LoadBalancer)\n- Apply manifests and verify: kubectl apply -f k8s/ kubectl get pods -n <your-namespace> kubectl get svc -n <your-namespace>\n- Get the LoadBalancer external URL and verify the application works",
  },
  {
    sectionPrefix: "1.5",
    title: "1.5.5. Checklist",
    description:
      "- ❏ API and client Dockerfiles build successfully\n- ❏ Docker Compose starts all services locally\n- ❏ Landing page accessible at root, React app at /app\n- ❏ Docker images pushed to ECR\n- ❏ EKS cluster running with all pods healthy\n- ❏ Application accessible via LoadBalancer URL\n- ❏ GitHub Actions CI pipeline passes",
  },
  {
    sectionPrefix: "1.6",
    title: "1.6.1. Testing & Documentation",
    description:
      "- Write at least 5 API test scenarios (documented or automated): GET returns correct data\n- POST creates resources with valid data\n- POST rejects invalid data\n- Auth endpoints work (register, login)\n- Protected endpoints require valid tokens\n- Create or finalize README.md : Project name and description\n- Live deployment URL (LoadBalancer)\n- Feature list\n- How to run locally with Docker Compose\n- Team member names and responsibilities\n- Create ARCHITECTURE.md : System diagram (text-based is fine)\n- Technology stack with versions\n- API endpoint table\n- Deployment architecture",
  },
  {
    sectionPrefix: "1.6",
    title: "1.6.2. Presentation Preparation",
    description:
      "- Live Demo (5 min) — Walk through the deployed application: Start at the landing page — show the HTML/CSS design\n- Navigate to the React app — login, browse, create resources\n- Show the dashboard with real data\n- Demonstrate at least one advanced feature\n- Use the public EKS URL , not localhost\n- Architecture Walkthrough (3 min): System architecture — what runs where\n- Docker + Kubernetes setup\n- CI/CD pipeline overview\n- One interesting code pattern or challenge solved\n- Lessons Learned (2 min): What went well as a team?\n- Hardest technical challenge?\n- What would you do differently?\n- Every team member must speak\n- The application must be demonstrated from the live deployed URL\n- Practice with timing — most teams run over on first attempt",
  },
  {
    sectionPrefix: "1.6",
    title: "1.6.3. Checklist",
    description:
      "- ❏ At least 5 API tests documented or passing\n- ❏ At least 3 React component tests passing\n- ❏ README.md complete with deployment URL\n- ❏ ARCHITECTURE.md documents the system design\n- ❏ Presentation rehearsed and timed\n- ❏ All team members have practiced their sections",
  },
  {
    sectionPrefix: "1.7",
    title: "1.7. Thursday: Presentations",
    description:
      "- Express middleware and request lifecycle\n- Mongoose schema design (references vs. embedding)\n- Docker container networking\n- Kubernetes core concepts (Pods, Deployments, Services)\n- AWS deployment patterns",
  },
  {
    sectionPrefix: "1.8",
    title: "1.8.1. Program Retrospective",
    description:
      "- What skill are you most confident in?\n- What do you want to learn more about?\n- How was the team experience compared to individual work?\n- What surprised you about full-stack development?",
  },
  { sectionPrefix: "1.8", title: "1.8.2. AWS Resource Cleanup (Critical)", description: "" },
  {
    sectionPrefix: "1.8",
    title: "1.8.3. Portfolio Preparation",
    description:
      "- Keep the GitHub repository public and well-documented\n- Add the project to your resume or LinkedIn profile\n- Include screenshots if you take down the deployment",
  },
  {
    sectionPrefix: "1.9",
    title: "1.9. Final Checklist",
    description:
      "- ❏ Custom HTML/CSS landing page demonstrates Phase 1 skills\n- ❏ React + TypeScript SPA with authentication and CRUD\n- ❏ Express + TypeScript API with MongoDB and JWT auth\n- ❏ Application containerized with Docker Compose\n- ❏ Application deployed to EKS via LoadBalancer\n- ❏ GitHub Actions CI pipeline passing\n- ❏ At least 5 API tests and 3 component tests\n- ❏ README.md and ARCHITECTURE.md complete\n- ❏ Team presentation delivered (all members spoke)\n- ❏ AWS resources cleaned up",
  },
] as const;

const PROJECT_CATEGORIES = ["web", "mobile", "data"] as const;
const TASK_STATUSES = ["todo", "in-progress", "blocked", "done"] as const;

async function seed(): Promise<void> {
  await connectDB();

  console.log("Clearing existing data...");
  await Promise.all([User.deleteMany({}), Project.deleteMany({}), Task.deleteMany({})]);

  console.log("Creating users...");
  const [admin, alice, bob] = await Promise.all([
    User.create({
      name: "Admin User",
      email: "admin@tasktracker.com",
      password: "Admin123!",
      role: "admin",
    }),
    User.create({
      name: "Alice Adjuster",
      email: "alice@tasktracker.com",
      password: "Password123!",
      role: "adjuster",
    }),
    User.create({
      name: "Bob Adjuster",
      email: "bob@tasktracker.com",
      password: "Password123!",
      role: "adjuster",
    }),
  ]);

  console.log("Creating document-based projects...");
  const projectMap = new Map<string, { _id: mongoose.Types.ObjectId }>();

  for (const [index, projectSeed] of LAB_GUIDE_PROJECTS.entries()) {
    const owner = index % 2 === 0 ? alice : bob;
    const category = PROJECT_CATEGORIES[index % PROJECT_CATEGORIES.length]!;
    const status = projectSeed.prefix === "1.7" || projectSeed.prefix === "1.9" ? "on-hold" : "active";

    const project = await Project.create({
      projectCode: projectSeed.projectCode,
      name: projectSeed.name,
      category,
      budgetHours: 80 + index * 20,
      status,
      startDate: new Date(`2026-09-${String(index + 1).padStart(2, "0")}`),
      targetDate: new Date(`2026-12-${String(Math.min(28, 10 + index * 2)).padStart(2, "0")}`),
      owner: owner._id,
    });

    projectMap.set(projectSeed.prefix, project);
  }

  console.log("Creating tasks...");

  // Created sequentially: the Task model auto-generates taskNumber in a
  // pre("save") hook based on countDocuments(), so concurrent creates would race.
  const tasks: { taskNumber: string }[] = [];

  for (const [index, taskSeed] of LAB_GUIDE_TASKS.entries()) {
    const project = projectMap.get(taskSeed.sectionPrefix);

    if (!project) {
      throw new Error(`Missing project mapping for section prefix ${taskSeed.sectionPrefix}`);
    }

    const assignee = index % 2 === 0 ? alice : bob;
    const status = TASK_STATUSES[index % TASK_STATUSES.length]!;
    const assignedTo = status === "todo" ? undefined : status === "done" ? admin._id : assignee._id;
    const completedBy = status === "done" ? admin._id : undefined;

    const taskPayload = {
      project: project._id,
      title: taskSeed.title,
      dueDate: new Date(`2026-10-${String((index % 28) + 1).padStart(2, "0")}`),
      estimateHours: 2 + (index % 8) * 2,
      status,
      ...(taskSeed.description ? { description: taskSeed.description } : {}),
      ...(assignedTo ? { assignedTo } : {}),
      ...(completedBy ? { completedBy } : {}),
    };

    const task = await Task.create(taskPayload);

    tasks.push(task);
  }

  const users: IUser[] = [admin, alice, bob];
  console.log(`Seeded ${users.length} users, ${LAB_GUIDE_PROJECTS.length} projects, ${tasks.length} tasks.`);
  console.log("Task numbers:", tasks.map((task) => task.taskNumber).join(", "));

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

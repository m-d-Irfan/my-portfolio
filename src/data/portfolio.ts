export interface Social {
  id: string;
  title: string;
  link: string;
  icon: string; // Lucide icon name or emoji
}

export interface Project {
  id: string;
  title: string;
  category: string; // "Full Stack" | "Backend" | "CMS"
  description: string;
  bullets?: string[];
  imageSrc: string;
  liveUrl: string;
  githubUrl: string; // client / frontend repo
  githubBackendUrl?: string; // backend repo if separate
  techStack: string[];
  challenges: string;
  improvements: string;
}

export interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  dates: string;
  location: string;
  grade: string;
  description?: string;
}

export interface TrainingItem {
  id: string;
  title: string;
  provider: string;
  dates: string;
  description: string;
  link?: string;
}

export interface ExperienceItem {
  id: string;
  position: string;
  company: string;
  dates: string;
  location: string;
  type: string;
  bullets: string[];
}

export interface SkillCategory {
  title: string;
  skills: { name: string; level: number }[]; // level from 0 to 100
}

export interface PortfolioData {
  name: string;
  designation: string;
  email: string;
  phone: string;
  whatsapp?: string;
  location: string;
  githubUsername: string;
  linkedinUsername: string;
  portfolioUrl: string;
  codeforcesUsername: string;
  codechefUsername: string;
  resumePdfUrl: string;
  careerObjective: string;
  about: {
    bio: string;
    journey: string;
    enjoyWork: string;
    hobbies: string[];
  };
  socials: Social[];
  skills: SkillCategory[];
  hardSkills: string[];
  languages: string[];
  projects: Project[];
  education: EducationItem[];
  training: TrainingItem[];
  experience: ExperienceItem[];
}

export const portfolioData: PortfolioData = {
  name: "Monzurul Islam",
  designation: "Junior Software Engineer",
  email: "monsurulislamcse.0208@gmail.com",
  phone: "+8801611836864",
  whatsapp: "+8801611836864",
  location: "Chattogram, Bangladesh",
  githubUsername: "m-d-Irfan",
  linkedinUsername: "monzurul-islam-irfan",
  portfolioUrl: "https://monzurul-islam.vercel.app",
  codeforcesUsername: "monzurul.islam2022",
  codechefUsername: "montikuna_2",
  resumePdfUrl: "/Monzurul_Islam.pdf",
  careerObjective: "Backend-focused Computer Science graduate with hands-on experience designing and building secure, scalable REST APIs using Python, Django, and Django REST Framework. Proficient in PostgreSQL for data modeling, JWT-based authentication, and cloud deployment via Render with GitHub Actions CI/CD. Seeking a backend engineering position where I can contribute to production systems and grow within a structured engineering team.",
  about: {
    bio: "Hello! I am Monzurul Islam (online as Irfan). I am a passionate and detail-oriented Junior Software Engineer specializing in backend architecture, REST API design, and modern full-stack web technologies. I love solving complex algorithmic challenges, relational database modeling, and crafting clean, reliable systems.",
    journey: "My programming journey started during my Bachelor's in Computer Science & Engineering at Port City International University. I fell in love with Python and its ecosystem, particularly Django and Django REST Framework. To expand my skills, I completed rigorous industry-oriented training with Phitron (covering CS fundamentals, algorithms, OOP, database design, and cloud deployments) and Programming Hero Level-2 (covering Advanced TypeScript, Node.js, Next.js, and Prisma). Today, I build full-stack web applications with bulletproof backend APIs and reactive frontends.",
    enjoyWork: "I truly enjoy backend architecture, database schema design, authentication protocols (JWT, sessions), role-based access control, and setting up automated CI/CD pipelines. There is a special satisfaction in writing optimized SQL queries and seeing an API endpoint execute under 50ms.",
    hobbies: [
      "Competitive Programming (active on Codeforces as monzurul.islam2022 and Codechef as montikuna_2)",
      "Exploring new tech tools, AI web integration, and automation with n8n",
      "Algorithmic puzzle solving & Data Structure optimizations",
      "Traveling and exploring the green hills and scenic spots of Chattogram"
    ]
  },
  socials: [
    {
      id: "1",
      title: "GitHub",
      link: "https://github.com/m-d-Irfan",
      icon: "Github"
    },
    {
      id: "2",
      title: "LinkedIn",
      link: "https://linkedin.com/in/monzurul-islam-irfan/",
      icon: "Linkedin"
    },
    {
      id: "3",
      title: "Codeforces",
      link: "https://codeforces.com/profile/monzurul.islam2022",
      icon: "Code"
    },
    {
      id: "4",
      title: "Codechef",
      link: "https://www.codechef.com/users/montikuna_2",
      icon: "Code"
    },
    {
      id: "5",
      title: "Email",
      link: "mailto:monsurulislamcse.0208@gmail.com",
      icon: "Mail"
    }
  ],
  skills: [
    {
      title: "Languages",
      skills: [
        { name: "Python", level: 92 },
        { name: "TypeScript", level: 86 },
        { name: "JavaScript", level: 88 },
        { name: "C++", level: 78 }
      ]
    },
    {
      title: "Backend & DBs",
      skills: [
        { name: "Django", level: 92 },
        { name: "Django REST Framework (DRF)", level: 94 },
        { name: "REST APIs & JWT", level: 95 },
        { name: "PostgreSQL", level: 88 },
        { name: "MySQL", level: 85 }
      ]
    },
    {
      title: "Frontend Development",
      skills: [
        { name: "React.js (v19)", level: 88 },
        { name: "Next.js (v15)", level: 85 },
        { name: "Tailwind CSS", level: 92 },
        { name: "HTML5 & CSS3", level: 92 },
        { name: "Axios", level: 90 }
      ]
    },
    {
      title: "Tools & DevOps",
      skills: [
        { name: "Git & GitHub", level: 92 },
        { name: "Render & Vercel", level: 88 },
        { name: "Postman", level: 90 },
        { name: "AWS", level: 75 },
        { name: "Prisma", level: 82 },
        { name: "Docker", level: 75 }
      ]
    }
  ],
  hardSkills: ["MS Word", "PowerPoint", "Excel", "Bangla type"],
  languages: ["English (Conversational)", "Bangla (Native)"],
  projects: [
    {
      id: "educore-ai",
      title: "EduCore AI",
      category: "Full Stack",
      description: "A comprehensive full-stack learning platform featuring role-separated dashboards for students, instructors, and administrators. Built with a multi-app Django REST Framework backend and a modern Next.js 15 frontend.",
      bullets: [
        "Role-based access & admin control — Users register as student or instructor; instructor accounts stay pending until an admin approves or rejects them (with an emailed reason). Enforced via JWT auth and role-based route middleware, with an admin dashboard for stats, user/course management, and enrollment cancellation.",
        "Course authoring (instructor) — Instructors create courses with modules and ordered lessons (title, content, video URL, thumbnails, pricing, publish toggle), managed from an instructor dashboard.",
        "Enrollment & lesson progress tracking (student) — Students browse/search published courses, enroll, work through lessons, and have completion progress tracked per lesson.",
        "Automated certificate issuance — Once a student finishes every lesson in a course, the backend auto-generates a certificate (unique ID) and emails it; a certificates list is available on their dashboard."
      ],
      imageSrc: "/educore-ai.png",
      liveUrl: "https://educore-ai-tan.vercel.app/",
      githubUrl: "https://github.com/m-d-Irfan/LLC_FrontEnd",
      githubBackendUrl: "https://github.com/m-d-Irfan/LLC_backend",
      techStack: ["Django", "DRF", "JWT", "RestAPIs", "React.js", "Next.js 15", "TypeScript", "Tailwind CSS", "PostgreSQL", "Cloudinary"],
      challenges: "Enforcing role-based route protection across Next.js 15 App Router middleware and Django REST Framework. Configuring custom cookie-based JWT token injection with automatic refresh handling while avoiding client hydration mismatch. Another key challenge was designing the multi-tier approval workflow for instructor onboarding.",
      improvements: "Implement real-time WebSockets via Django Channels for live chat during course lectures, build interactive coding environments, and introduce AI-assisted student quiz generation."
    },
    {
      id: "sports-blog-cms",
      title: "Sports Blog CMS",
      category: "CMS",
      description: "A robust content management system built from scratch with complete CRUD functionality for posts and categories with zero third-party CMS bloat.",
      bullets: [
        "User authentication — Visitors sign up and log in (Django's built-in auth) to get posting rights; logged-out users can still browse.",
        "Post authoring & management — Logged-in users create, edit, and delete their own blog posts, each assigned to a category, with a personal \"my posts\" view filtered by author.",
        "Category browsing — Posts are organized into categories that can be created/updated/deleted, and visitors can filter posts by category to read related content together."
      ],
      imageSrc: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
      liveUrl: "https://sport-blogs.onrender.com/",
      githubUrl: "https://github.com/m-d-Irfan/Basic-Blog",
      techStack: ["Python", "Django", "MySQL", "HTML5", "Tailwind CSS", "JavaScript"],
      challenges: "Implementing granular permissions and moderation controls from scratch without depending on third-party CMS packages. Managing MySQL database queries with selective indexing to prevent table locks during simultaneous post submissions.",
      improvements: "Refactor the UI with Next.js 15 for SSR, implement Algolia instantaneous search indexing, and add newsletter subscription integration."
    },
    {
      id: "devflow-api",
      title: "DevFlow API Backend",
      category: "Backend",
      description: "A high-performance developer Q&A REST API platform featuring reputation scoring algorithms, question ranking, and relational tagging pipelines.",
      bullets: [
        "Scalable REST Architecture — Built with Django REST Framework, PostgreSQL, and JWT authentication.",
        "Advanced Data Modeling — Optimized relational queries for vote tallies, answers, and user reputation points.",
        "Automated Documentation & Testing — Integrated Swagger/OpenAPI with drf-spectacular and automated CI testing."
      ],
      imageSrc: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&w=800&q=80",
      liveUrl: "https://devflow-api-demo.render.com",
      githubUrl: "https://github.com/m-d-Irfan/devflow-api",
      techStack: ["Python", "Django REST Framework", "PostgreSQL", "Docker", "JWT", "Swagger"],
      challenges: "Designing high-performance PostgreSQL queries to calculate reputation points dynamically based on votes, questions, and answers without causing N+1 query overhead.",
      improvements: "Add Redis caching for rapid responses on hot topics and integrate Celery background workers for email notifications."
    }
  ],
  education: [
    {
      id: "edu-1",
      degree: "B.Sc. in Computer Science & Engineering",
      institution: "Port City International University, Chittagong",
      dates: "01/2022 – 02/2026",
      location: "Chittagong, Bangladesh",
      grade: "CGPA: 3.53 / 4.00",
      description: "Core studies in Data Structures and Algorithms, Object-Oriented Programming, Database Management Systems, Computer Networks, and Software Engineering."
    }
  ],
  training: [
    {
      id: "train-1",
      title: "Computer Science Fundamentals − with Phitron",
      provider: "Phitron",
      dates: "2023 – 2024",
      description: "Industry oriented training around 210 hours covering C++, Python, Data Structure and Algorithm, Object Oriented Programming, Competitive Programming, Database Management on SQL and PostgreSQL, Django, Django REST framework, RestAPIs, Server Deploy with AWS."
    },
    {
      id: "train-2",
      title: "Master Git and GitHub - Beginner to Expert",
      provider: "Online Certification",
      dates: "Feb 2025",
      description: "Covering basic setup, branching, project fork & clone, workflow (staging, upstaging, commit), 2way merge, 3way merge, resolve merge conflict, collaborations.",
      link: "https://udemy-certificate.s3.amazonaws.com/image/UC-491ed3e9-c16c-491d-8e8c-d331cf6cac92.jpg"
    },
    {
      id: "train-3",
      title: "Next Level Web Development – Programming Hero (Running)",
      provider: "Programming Hero",
      dates: "April ⎯ Sep 2026",
      description: "AI driven Software Engineering Oriented bootcamp covers Advance Typescript with OOP, Node.js, CRUD with Express.js, Advance PostgreSQL and Database modeling, Prisma ORM, Advance Querying, filtering, Advance Next.js, WT custom Authentication, Docker container and Data Management, AI chat integration with Node.js and automation with n8n."
    }
  ],
  experience: []
};

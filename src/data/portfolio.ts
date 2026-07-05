export interface Social {
  id: string;
  title: string;
  link: string;
  icon: string; // Lucide icon name or emoji
}

export interface Project {
  id: string;
  title: string;
  description: string;
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
  careerObjective: string;
  about: {
    bio: string;
    journey: string;
    enjoyWork: string;
    hobbies: string[];
  };
  socials: Social[];
  skills: SkillCategory[];
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
  careerObjective: "Backend-focused Computer Science graduate with hands-on experience designing and building secure, scalable REST APIs using Python, Django, and Django REST Framework. Proficient in PostgreSQL for data modeling, JWT-based authentication, and cloud deployment via Render with GitHub Actions CI/CD. Seeking a backend engineering position where I can contribute to production systems and grow within a structured engineering team.",
  about: {
    bio: "Hello! I am Monzurul Islam (often known online as Irfan). I am a passionate and detail-oriented software engineer specializing in backend systems and modern web technologies. I love solving complex algorithms, database scaling puzzles, and crafting secure APIs.",
    journey: "My programming journey started during my Bachelor's degree in Computer Science & Engineering. I fell in love with python and its ecosystem, particularly Django. To deepen my skills, I completed rigorous industry-oriented training programs, including Phitron (focused on Computer Science fundamentals, competitive programming, and backend development) and Programming Hero Level-2 (deep diving into Advanced TypeScript, Node.js, Next.js, and databases). Today, I build full-stack web applications with bulletproof backend APIs and clean, fast frontends.",
    enjoyWork: "I truly enjoy backend architecture, schema design, authentication protocols (JWT, sessions), and setting up automated CI/CD pipelines. There is a special satisfaction in writing optimized SQL queries and seeing a API route execute under 50ms.",
    hobbies: [
      "Competitive Programming (active on Codeforces as monzurul.islam2022 and Codechef as montikuna_2)",
      "Solving algorithmic puzzles on LeetCode",
      "Exploring new tech tools, Docker orchestration, and automation with n8n",
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
      title: "Email",
      link: "mailto:monsurulislamcse.0208@gmail.com",
      icon: "Mail"
    }
  ],
  skills: [
    {
      title: "Languages",
      skills: [
        { name: "Python", level: 90 },
        { name: "TypeScript", level: 85 },
        { name: "JavaScript", level: 85 },
        { name: "C++", level: 75 }
      ]
    },
    {
      title: "Backend & DBs",
      skills: [
        { name: "Django & DRF", level: 90 },
        { name: "REST APIs & JWT", level: 95 },
        { name: "PostgreSQL", level: 85 },
        { name: "MySQL", level: 80 },
        { name: "Node.js & Express.js", level: 80 }
      ]
    },
    {
      title: "Frontend Development",
      skills: [
        { name: "React.js (v19)", level: 85 },
        { name: "Next.js (v15)", level: 80 },
        { name: "Tailwind CSS & DaisyUI", level: 90 },
        { name: "HTML5 & CSS3", level: 90 }
      ]
    },
    {
      title: "Tools & DevOps",
      skills: [
        { name: "Git & GitHub", level: 90 },
        { name: "Docker", level: 75 },
        { name: "Render & Vercel", level: 85 },
        { name: "AWS S3 & EC2", level: 70 },
        { name: "Prisma ORM", level: 80 },
        { name: "Postman API Testing", level: 85 }
      ]
    }
  ],
  projects: [
    {
      id: "educore-ai",
      title: "EduCore AI",
      description: "A comprehensive full-stack learning platform featuring role-separated dashboards for students, instructors, and administrators. Supports course creations, modules management, progress tracking, and secure enrollments.",
      imageSrc: "/educore-ai.png",
      liveUrl: "https://educore-ai-tan.vercel.app/",
      githubUrl: "https://github.com/m-d-Irfan/LLC_FrontEnd",
      githubBackendUrl: "https://github.com/m-d-Irfan/LLC_backend",
      techStack: ["Next.js 15", "React 19", "TypeScript", "Tailwind CSS", "Django", "Django REST Framework", "PostgreSQL", "Cloudinary", "JWT"],
      challenges: "Setting up role-based route protection across the Next.js client and Django REST backend. Enforcing custom cookie middleware in Next.js to inject and validate JWT tokens securely while preventing page flash and unauthorized layouts. Another challenge was auto-generating beautiful API documentation using drf-spectacular while using custom route namespaces.",
      improvements: "Integrate WebSockets (Django Channels) for real-time chat between students and instructors, add interactive coding playgrounds, and incorporate automated quiz grading dashboards with interactive analytics charts."
    },
    {
      id: "sports-blog-cms",
      title: "Sports Blog CMS",
      description: "A custom content management system built from scratch with full CRUD capabilities for blog posts, comments, and categories. Designed with strict role authorization separation for administrators and regular users.",
      imageSrc: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
      liveUrl: "https://sport-blogs.onrender.com/",
      githubUrl: "https://github.com/m-d-Irfan/Basic-Blog",
      techStack: ["Python", "Django", "MySQL", "HTML5", "CSS3", "JavaScript"],
      challenges: "Building authentication and custom authorization filters from scratch without using any external pre-packaged third-party CMS libraries. Handling transactional safety in MySQL when multiple readers post comments simultaneously on the same sports article.",
      improvements: "Migrate the frontend to Next.js App Router for server-side rendering (SSR), optimize database queries with selective indexing, and implement Algolia search for instantaneous article discovery."
    },
    {
      id: "devflow-api",
      title: "DevFlow API Backend",
      description: "A highly scalable developer Q&A API engine supporting reputation scoring, questions upvote/downvote ranking, custom tagging systems, and comprehensive search capabilities.",
      imageSrc: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&w=800&q=80",
      liveUrl: "https://devflow-api-demo.render.com",
      githubUrl: "https://github.com/m-d-Irfan/devflow-api",
      techStack: ["Python", "Django REST Framework", "PostgreSQL", "Docker", "JWT", "Swagger"],
      challenges: "Designing high-performance PostgreSQL queries to calculate reputation points dynamically based on votes, questions, and answers without causing N+1 query overhead. Containerizing the multi-service system (Django, DB) for reliable cloud deployments.",
      improvements: "Add Redis caching for rapid responses on popular questions, implement email digests using Celery background workers, and add real-time notifications for question answers."
    }
  ],
  education: [
    {
      id: "edu-1",
      degree: "B.Sc. in Computer Science & Engineering",
      institution: "Port City International University",
      dates: "01/2022 – 02/2026",
      location: "Chittagong, Bangladesh",
      grade: "CGPA: 3.53 / 4.00",
      description: "Rigorous coursework focusing on Database Systems, Software Engineering, Object-Oriented Programming, Computer Networks, and Data Structures & Algorithms."
    },
    {
      id: "edu-2",
      degree: "Higher Secondary Certificate (HSC)",
      institution: "Saraipara Degree College",
      dates: "07/2018 – 05/2020",
      location: "Chittagong, Bangladesh",
      grade: "GPA: 4.75 / 5.00",
      description: "Focused in Science group, with high scores in Mathematics, Physics, and Chemistry."
    }
  ],
  training: [
    {
      id: "train-1",
      title: "Next Level Web Development (Level-2)",
      provider: "Programming Hero",
      dates: "April — Sep 2026",
      description: "AI-driven Software Engineering bootcamp covering Advanced TypeScript, Node.js, Express.js, PostgreSQL with Prisma ORM, advanced queries, authentication, Docker, AI API integration, and workflow automation with n8n."
    },
    {
      id: "train-2",
      title: "Computer Science Fundamentals",
      provider: "Phitron",
      dates: "2023 – 2024",
      description: "An intensive training containing 210 hours covering C++, Python, Data Structures & Algorithms, OOP, Competitive Programming, SQL, PostgreSQL, Django, DRF, and AWS deployments."
    },
    {
      id: "train-3",
      title: "Master Git and GitHub - Beginner to Expert",
      provider: "Udemy / Online Reference",
      dates: "Feb 2025",
      description: "Comprehensive workflow training: branch models, forks, merges (2-way/3-way), merge conflicts resolution, and Git teamwork best practices.",
      link: "https://github.com/m-d-Irfan"
    }
  ],
  experience: [] // No formal experience listed on CV, but we keep it empty to fulfill typescript typing
};

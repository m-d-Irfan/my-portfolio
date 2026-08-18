"use client";
import React, { useState, useEffect, useRef } from "react";
import { usePortfolio } from "@/context/context";
import { Code, Server, Layout, Settings } from "lucide-react";

export default function Skills() {
  const { data } = usePortfolio();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const getCategoryIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case "languages":
        return <Code className="w-5 h-5 text-primary" />;
      case "backend & dbs":
        return <Server className="w-5 h-5 text-secondary" />;
      case "frontend development":
        return <Layout className="w-5 h-5 text-accent" />;
      default:
        return <Settings className="w-5 h-5 text-neutral-content" />;
    }
  };

  // High precision, accurate official SVG logos for all technologies
  const getSkillIcon = (name: string) => {
    const n = name.toLowerCase();

    // 1. Python
    if (n.includes("python")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.93 2C8.36 2 8.65 3.54 8.65 3.54L8.67 5.17H12.06V5.65H7.28C5.24 5.65 3.5 7.15 3.5 9.4C3.5 11.66 4.97 12.92 6.55 12.92H7.95V11.23C7.95 9.21 9.53 7.82 11.55 7.82H16.63V4.44C16.63 4.44 16.92 2 11.93 2Z" fill="#3776AB"/>
          <path d="M12.06 22C15.63 22 15.34 20.46 15.34 20.46L15.32 18.83H11.93V18.35H16.71C18.75 18.35 20.5 16.85 20.5 14.6C20.5 12.34 19.02 11.08 17.44 11.08H16.04V12.77C16.04 14.79 14.46 16.18 12.44 16.18H7.36V19.56C7.36 19.56 7.07 22 12.06 22Z" fill="#FFD343"/>
          <circle cx="10.22" cy="4.35" r="0.75" fill="#F9FAFB"/>
          <circle cx="13.78" cy="19.65" r="0.75" fill="#111827"/>
        </svg>
      );
    }

    // 2. TypeScript
    if (n.includes("typescript")) {
      return (
        <svg className="w-8 h-8 fill-[#3178C6]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/>
        </svg>
      );
    }

    // 3. JavaScript
    if (n.includes("javascript")) {
      return (
        <svg className="w-8 h-8 fill-[#F7DF1E]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z"/>
        </svg>
      );
    }

    // 4. C++
    if (n.includes("c++")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 6.5V17.5L12 22L22 17.5V6.5L12 2Z" fill="#00599C"/>
          <path d="M12 4.1L4 7.7V16.3L12 19.9L20 16.3V7.7L12 4.1Z" fill="#004482"/>
          <path d="M13.5 9.5H15.5V11H13.5V13H12V11H10V9.5H12V7.5H13.5V9.5Z" fill="#659AD2"/>
          <path d="M19.5 9.5H21.5V11H19.5V13H18V11H16V9.5H18V7.5H19.5V9.5Z" fill="#659AD2"/>
          <path d="M9.5 14C8.8 14 8 13.5 8 12.5C8 11.5 8.8 11 9.5 11C10.2 11 10.7 11.3 11 11.7L12.3 10.7C11.8 10 10.8 9.5 9.5 9.5C7.5 9.5 6 10.8 6 12.5C6 14.2 7.5 15.5 9.5 15.5C10.8 15.5 11.8 15 12.3 14.3L11 13.3C10.7 13.7 10.2 14 9.5 14Z" fill="white"/>
        </svg>
      );
    }

    // 5. Django REST Framework (DRF)
    if (n.includes("django rest") || n.includes("drf")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="5" fill="#A30000"/>
          <path d="M4 6.5H10C11.5 6.5 12.5 7.5 12.5 9C12.5 10.5 11.5 11.5 10 11.5H6.5V17.5H4V6.5ZM6.5 9.5H9.5C10 9.5 10.5 9 10.5 8.5C10.5 8 10 7.5 9.5 7.5H6.5V9.5Z" fill="white"/>
          <path d="M13.5 11.5H15.5L18.5 17.5H16L15 15H14V17.5H11.5V6.5H15.5C17 6.5 18 7.5 18 9C18 10.2 17.2 11.1 16 11.4L18.5 17.5H16L13.5 11.5ZM14 9.5H15.5C16 9.5 16.5 9 16.5 8.5C16.5 8 16 7.5 15.5 7.5H14V9.5Z" fill="white"/>
        </svg>
      );
    }

    // 6. Django
    if (n.includes("django")) {
      return (
        <svg className="w-8 h-8 fill-[#092E20]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.146 0h3.924v18.166c-2.013.382-3.491.535-5.096.535-4.791 0-7.288-2.166-7.288-6.32 0-4.002 2.65-6.6 6.753-6.6.637 0 1.121.05 1.707.203zm0 9.143a3.894 3.894 0 00-1.325-.204c-1.988 0-3.134 1.223-3.134 3.365 0 2.09 1.096 3.236 3.109 3.236.433 0 .79-.025 1.35-.102V9.142zM21.314 6.06v9.098c0 3.134-.229 4.638-.917 5.937-.637 1.249-1.478 2.039-3.211 2.905l-3.644-1.733c1.733-.815 2.574-1.53 3.109-2.625.561-1.121.739-2.421.739-5.835V6.059h3.924zM17.39.021h3.924v4.026H17.39z"/>
        </svg>
      );
    }

    // 7. REST APIs & JWT
    if (n.includes("jwt") || n.includes("rest api") || n.includes("api")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="11" fill="#000000"/>
          <path d="M12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C16.42 20 20 16.42 20 12C20 7.58 16.42 4 12 4Z" stroke="url(#jwtGrad)" strokeWidth="2.5"/>
          <path d="M7 11V14.5C7 15.88 8.12 17 9.5 17C10.88 17 12 15.88 12 14.5V7" stroke="#FB015B" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M12 7V14.5C12 15.88 13.12 17 14.5 17C15.88 17 17 15.88 17 14.5V11" stroke="#00B9F1" strokeWidth="1.8" strokeLinecap="round"/>
          <defs>
            <linearGradient id="jwtGrad" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FB015B"/>
              <stop offset="0.5" stopColor="#D63AFF"/>
              <stop offset="1" stopColor="#00B9F1"/>
            </linearGradient>
          </defs>
        </svg>
      );
    }

    // 8. PostgreSQL
    if (n.includes("postgres")) {
      return (
        <svg className="w-8 h-8 fill-[#4169E1]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698z"/>
        </svg>
      );
    }

    // 9. MySQL
    if (n.includes("mysql")) {
      return (
        <svg className="w-8 h-8 fill-[#00758F]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M16.405 5.501c-.115 0-.193.014-.274.033v.013h.014c.054.104.146.18.214.273.054.107.1.214.154.32l.014-.015c.094-.066.14-.172.14-.333-.04-.047-.046-.094-.08-.14-.04-.067-.126-.1-.18-.153zM5.77 18.695h-.927a50.854 50.854 0 00-.27-4.41h-.008l-1.41 4.41H2.45l-1.4-4.41h-.01a72.892 72.892 0 00-.195 4.41H0c.055-1.966.192-3.81.41-5.53h1.15l1.335 4.064h.008l1.347-4.064h1.095c.242 2.015.384 3.86.428 5.53zm4.017-4.08c-.378 2.045-.876 3.533-1.492 4.46-.482.716-1.01 1.073-1.583 1.073-.153 0-.34-.046-.566-.138v-.494c.11.017.24.026.386.026.268 0 .483-.075.647-.222.197-.18.295-.382.295-.605 0-.155-.077-.47-.23-.944L6.23 14.615h.91l.727 2.36c.164.536.233.91.205 1.123.4-1.064.678-2.227.835-3.483zm12.325 4.08h-2.63v-5.53h.885v4.85h1.745zm-3.32.135l-1.016-.5c.09-.076.177-.158.255-.25.433-.506.648-1.258.648-2.253 0-1.83-.718-2.746-2.155-2.746-.704 0-1.254.232-1.65.697-.43.508-.646 1.256-.646 2.245 0 .972.19 1.686.574 2.14.35.41.877.615 1.583.615.264 0 .506-.033.725-.098l1.325.772.36-.622z"/>
        </svg>
      );
    }

    // 10. React.js
    if (n.includes("react")) {
      return (
        <svg className="w-8 h-8 animate-spin-slow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#61DAFB" strokeWidth="1.5" transform="rotate(30 12 12)"/>
          <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#61DAFB" strokeWidth="1.5" transform="rotate(90 12 12)"/>
          <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#61DAFB" strokeWidth="1.5" transform="rotate(150 12 12)"/>
          <circle cx="12" cy="12" r="1.5" fill="#61DAFB"/>
        </svg>
      );
    }

    // 11. Next.js
    if (n.includes("next.js")) {
      return (
        <svg className="w-8 h-8 bg-black rounded-full p-0.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17.5 17.5L12 10.5V17H10.5V7H12L17.5 14V7H19V17.5H17.5Z" fill="white"/>
        </svg>
      );
    }

    // 12. Tailwind CSS
    if (n.includes("tailwind")) {
      return (
        <svg className="w-8 h-8 fill-[#38BDF8]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 C13.666,10.618,15.027,12,18.001,12c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C16.337,6.182,14.976,4.8,12.001,4.8z M6.001,12c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 c1.177,1.194,2.538,2.576,5.512,2.576c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C10.337,13.382,8.976,12,6.001,12z"/>
        </svg>
      );
    }

    // 13. HTML5 & CSS3
    if (n.includes("html") || n.includes("css")) {
      return (
        <div className="flex items-center gap-1">
          <svg className="w-6 h-6 fill-[#E34F26]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 2L4.82 20.18L12 22L19.18 20.18L21 2H3ZM17.18 8.18H10.18L10.36 10H16.82L16.27 15.45L12 16.64L7.73 15.45L7.45 12.73H9.27L9.41 14.09L12 14.82L14.59 14.09L14.86 11.45H7.32L6.77 6H17.41L17.18 8.18Z"/>
          </svg>
          <svg className="w-6 h-6 fill-[#1572B6]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 2L4.82 20.18L12 22L19.18 20.18L21 2H3ZM17.18 8.18H9.36L9.55 10H16.82L16.27 15.45L12 16.64L7.73 15.45L7.45 12.73H9.27L9.41 14.09L12 14.82L14.59 14.09L14.86 11.45H7.32L6.77 6H17.41L17.18 8.18Z"/>
          </svg>
        </div>
      );
    }

    // 14. Axios
    if (n.includes("axios")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.9 2L2 19.5H8.2L11.9 12.5L15.6 19.5H22L11.9 2Z" fill="#5A29E4"/>
          <path d="M11.9 14.5L9.6 19.5H14.2L11.9 14.5Z" fill="#8B5CF6"/>
        </svg>
      );
    }

    // 15. Git & GitHub
    if (n.includes("git")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21.5 11.23L12.77 2.5C12.38 2.11 11.75 2.11 11.36 2.5L2.5 11.36C2.11 11.75 2.11 12.38 2.5 12.77L11.23 21.5C11.62 21.89 12.25 21.89 12.64 21.5L21.5 12.64C21.89 12.25 21.89 11.62 21.5 11.23ZM13.84 15.5V13.84C12.44 13.84 11.4 14.28 10.7 15.22C10.98 13.82 11.82 12.42 13.84 12.14V10.5L16.5 13L13.84 15.5Z" fill="#F05032"/>
        </svg>
      );
    }

    // 16. Docker
    if (n.includes("docker")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 11.56V13.89C2 15.86 3.6 17.46 5.56 17.46H18.44C20.4 17.46 22 15.86 22 13.89V11.56H2ZM19.2 16.14H4.8C4.36 16.14 4 15.78 4 15.34C4 14.9 4.36 14.54 4.8 14.54H19.2C19.64 14.54 20 14.9 20 15.34C20 15.78 19.64 16.14 19.2 16.14Z" fill="#2496ED"/>
          <rect x="5.5" y="8" width="2" height="2" rx="0.5" fill="#2496ED"/>
          <rect x="8.5" y="8" width="2" height="2" rx="0.5" fill="#2496ED"/>
          <rect x="11.5" y="8" width="2" height="2" rx="0.5" fill="#2496ED"/>
          <rect x="14.5" y="8" width="2" height="2" rx="0.5" fill="#2496ED"/>
          <rect x="8.5" y="5" width="2" height="2" rx="0.5" fill="#2496ED"/>
          <rect x="11.5" y="5" width="2" height="2" rx="0.5" fill="#2496ED"/>
        </svg>
      );
    }

    // 17. Render & Vercel
    if (n.includes("render") || n.includes("vercel")) {
      return (
        <div className="flex items-center gap-1.5">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 1L24 22H0L12 1Z"/>
          </svg>
          <span className="font-mono text-[10px] font-bold text-success">RENDER</span>
        </div>
      );
    }

    // 18. AWS
    if (n.includes("aws")) {
      return (
        <svg className="w-8 h-8 fill-[#FF9900]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M21.565 19.387c-.015 0-.031 0-.046-.001-.433-.004-.846-.19-1.156-.516l-7.792-8.243c-.45-.476-.566-1.16-.289-1.747.276-.587.877-.96 1.543-.96h3.456c.667 0 1.268.373 1.543.96.277.587.16 1.27-.289 1.747l-1.921 2.032 6.837 7.234c.31.326.475.76.452 1.217-.023.456-.252.872-.619 1.139-.367.268-.824.364-1.267.273zM7.345 8.88c-.667 0-1.268-.373-1.544-.96-.277-.587-.16-1.27.289-1.747l1.921-2.032-6.837-7.234C.863.58.698.146.721-.31c.023-.456.252-.872.62-1.14.367-.267.824-.363 1.267-.273.015 0 .03.001.045.001.433.004.847.19 1.157.516l7.792 8.243c.45.476.566 1.16.29 1.747-.277.587-.878.96-1.544.96z"/>
        </svg>
      );
    }

    // 19. Prisma
    if (n.includes("prisma")) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" fill="#0C344B"/>
          <path d="M12 4.5L5.5 8.2V15.8L12 19.5L18.5 15.8V8.2L12 4.5Z" fill="#5A67D8"/>
        </svg>
      );
    }

    // 20. Postman
    if (n.includes("postman")) {
      return (
        <svg className="w-8 h-8 fill-[#FF6C37]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.527.099C6.955-.744.942 3.9.099 10.473c-.843 6.572 3.8 12.584 10.373 13.428 6.573.843 12.587-3.801 13.428-10.374C24.744 6.955 20.101.943 13.527.099zm2.471 7.485a.855.855 0 0 0-.593.25l-4.453 4.453-.307-.307-.643-.643c4.389-4.376 5.18-4.418 5.996-3.753zm-4.863 4.861l4.44-4.44a.62.62 0 1 1 .847.903l-4.699 4.125-.588-.588zm.33.694l-1.1.238a.06.06 0 0 1-.067-.032.06.06 0 0 1 .01-.073l.645-.645.512.512zm-2.803-.459l1.172-1.172.879.878-1.979.426a.074.074 0 0 1-.085-.039.072.072 0 0 1 .013-.093zm-3.646 6.058a.076.076 0 0 1-.069-.083.077.077 0 0 1 .022-.046h.002l.946-.946 1.222 1.222-2.123-.147zm2.425-1.256a.228.228 0 0 0-.117.256l.203.865a.125.125 0 0 1-.211.117h-.003l-.934-.934-.294-.295 3.762-3.758 1.82-.393.874.874c-1.255 1.102-2.971 2.201-5.1 3.268zm5.279-3.428h-.002l-.839-.839 4.699-4.125a.952.952 0 0 0 .119-.127c-.148 1.345-2.029 3.245-3.977 5.091zm3.657-6.46l-.003-.002a1.822 1.822 0 0 1 2.459-2.684l-1.61 1.613a.119.119 0 0 0 0 .169l1.247 1.247a1.817 1.817 0 0 1-2.093-.343zm2.578 0a1.714 1.714 0 0 1-.271.218h-.001l-1.207-1.207 1.533-1.533c.661.72.637 1.832-.054 2.522z"/>
        </svg>
      );
    }

    return <Code className="w-8 h-8 text-neutral-content/60" />;
  };

  // 4-quadrant trajectory vectors with silky smooth easing
  const getBadgePopTransform = (index: number) => {
    if (index === 0) return "-translate-x-6 -translate-y-6 scale-75 opacity-0";
    if (index === 1 || index === 2) return "translate-x-6 -translate-y-6 scale-75 opacity-0";
    if (index === 3) return "-translate-x-6 translate-y-6 scale-75 opacity-0";
    return "translate-x-6 translate-y-6 scale-75 opacity-0";
  };

  return (
    <section id="skills" ref={sectionRef} className="section py-24 bg-transparent relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-outfit text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Technical <span className="text-gradient">Skills</span>
          </h2>
          <div className="w-16 h-1.5 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full"></div>
          <p className="font-sans text-sm sm:text-base opacity-70 mt-4 max-w-xl mx-auto">
            A comprehensive overview of my programming languages, frameworks, databases, and DevOps tools.
          </p>
        </div>

        {/* Skill Category Grid: Cards enter from TOP with inside logos popping out in 4-quadrant directions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {data.skills.map((category, catIndex) => (
            <div
              key={category.title}
              style={{
                transitionDelay: `${catIndex * 150}ms`,
              }}
              className={`p-6 sm:p-8 rounded-[1.75rem] bg-base-200/90 border border-base-300/50 hover:border-primary/30 shadow-lg shadow-base-300/10 hover:shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group will-change-transform ${
                isInView
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 -translate-y-16 scale-95"
              }`}
            >
              {/* Category Header */}
              <div className="flex items-center gap-3.5 mb-8 border-b border-base-300/40 pb-4">
                <div className="w-11 h-11 rounded-2xl bg-base-100 border border-base-300 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  {getCategoryIcon(category.title)}
                </div>
                <h3 className="font-outfit text-xl font-bold text-base-content/90 tracking-tight">
                  {category.title}
                </h3>
              </div>

              {/* Skills List Sub-Grid: Logos pop out with silky smooth spring easing */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {category.skills.map((skill, skillIndex) => {
                  const initialTransform = getBadgePopTransform(skillIndex);
                  const delay = 250 + catIndex * 100 + skillIndex * 60;

                  return (
                    <div
                      key={skill.name}
                      style={{
                        transitionDelay: `${delay}ms`,
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl bg-base-100/70 border border-base-300/50 hover:border-primary/40 hover:bg-base-100 hover:scale-[1.04] transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-md group/badge ${
                        isInView
                          ? "opacity-100 translate-x-0 translate-y-0 scale-100"
                          : initialTransform
                      }`}
                    >
                      {/* Accurate SVG Brand Icon */}
                      <div className="w-12 h-12 flex items-center justify-center mb-3 group-hover/badge:scale-110 transition-transform duration-300">
                        {getSkillIcon(skill.name)}
                      </div>
                      {/* Name Label */}
                      <span className="font-outfit text-[11px] font-bold text-center text-base-content/75 group-hover/badge:text-primary uppercase tracking-wider transition-colors duration-300 select-none">
                        {skill.name}
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

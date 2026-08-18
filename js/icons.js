/**
 * Dynamic SVG Brand Loader
 * Directly renders the exact SVG files stored in ./assets/icons/
 */

export const iconFileMap = {
  django: 'django.svg',
  drf: 'drf.svg',
  postgres: 'postgresql.svg',
  postgresql: 'postgresql.svg',
  mysql: 'mysql.svg',
  jwt: 'jwt.svg',
  prisma: 'prisma.svg',
  react: 'react.svg',
  nextjs: 'nextjs.svg',
  tailwind: 'tailwind.svg',
  html: 'html5.svg',
  css: 'css3.svg',
  axios: 'axios.svg',
  python: 'python.svg',
  javascript: 'javascript.svg',
  typescript: 'typescript.svg',
  cpp: 'cpp.svg',
  sql: 'sql.svg',
  c: 'c.svg',
  git: 'git.svg',
  docker: 'docker.svg',
  vercel: 'vercel.svg',
  aws: 'aws.svg',
  postman: 'postman.svg',
  n8n: 'n8n.svg'
};

export function getSkillSvg(iconKey) {
  const fileName = iconFileMap[iconKey] || `${iconKey}.svg`;
  return `<img src="./assets/icons/${fileName}" class="skill-svg-icon" alt="${iconKey}" loading="lazy" />`;
}

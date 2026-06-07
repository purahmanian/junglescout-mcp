FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
ENV PORT=3000
EXPOSE 3000
# HTTP entry (remote MCP connector). Stdio entry (dist/index.js) still works for desktop.
CMD ["node", "dist/http.js"]

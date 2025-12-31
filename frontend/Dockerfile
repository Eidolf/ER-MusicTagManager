FROM node:18-alpine as builder

WORKDIR /app
COPY package.json ./
# Run install with legacy-peer-deps to avoid potential conflicts with scaffolded versions
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

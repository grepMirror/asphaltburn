FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expose port 5173 for Vite
EXPOSE 5173

# Start Vite server, bind to all interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

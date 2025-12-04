# Start with an official Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first (if you have them) for efficient caching
COPY package.json package-lock.json ./

# Install Node.js dependencies (skip this step if you don't use npm modules)
RUN npm ci --only=production

# Copy the rest of your app's code
COPY . .

# Set environment variables if needed (replace or add as appropriate)
# ENV NODE_ENV=production

# Entry point: run your main init script
CMD ["node", "init.js"]

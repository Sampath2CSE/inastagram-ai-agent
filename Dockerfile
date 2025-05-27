# Use Apify's Node.js base image with Puppeteer pre-installed
FROM apify/actor-node-puppeteer-chrome:18

# Set the working directory
WORKDIR /usr/src/app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . ./

# Set up proper permissions
RUN chmod +x ./src/main.js

# Define the command to run the Actor
CMD npm start
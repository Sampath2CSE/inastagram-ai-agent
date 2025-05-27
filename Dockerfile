# Use Apify's Node.js base image with Puppeteer pre-installed
FROM apify/actor-node-puppeteer-chrome:18

# Copy package.json first for better Docker layer caching
COPY package.json ./

# Install dependencies using npm install instead of npm ci
RUN npm install --only=production

# Copy all source code
COPY . ./

# Start the application
CMD npm start
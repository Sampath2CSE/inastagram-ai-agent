# Use newer Node.js base image to avoid engine warnings
FROM apify/actor-node-puppeteer-chrome:20

# Copy package.json first for better Docker layer caching
COPY package.json ./

# Install dependencies with modern NPM syntax
RUN npm install --omit=dev

# Copy all source code
COPY . ./

# Start the application
CMD npm start
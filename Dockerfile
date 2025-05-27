# Use Apify's base image
FROM apify/actor-node-puppeteer-chrome:18

# The working directory is already set in the base image to /usr/src/app
# So we don't need WORKDIR again

# Copy package.json first (for better Docker caching)
COPY package.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the source code
COPY . ./

# Start command (npm start will run "node src/main.js")
CMD npm start
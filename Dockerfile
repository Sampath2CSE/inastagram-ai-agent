# Use Apify's Node.js base image with Puppeteer pre-installed
FROM apify/actor-node-puppeteer-chrome:18

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json specifically (not using wildcard)
COPY package.json ./

# Install dependencies
RUN npm ci --only=production

# Copy all source code
COPY . ./

# Define the command to run the Actor
CMD npm start
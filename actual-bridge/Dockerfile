FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json .
RUN npm install --production

COPY index.js .

EXPOSE 3788

CMD ["node", "index.js"]
